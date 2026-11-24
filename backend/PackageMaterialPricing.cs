using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;

namespace RepairEstimator.Drafts
{
    internal static class PackageMaterialPricing
    {
        internal const string Mode = "re_materialpricingmode";
        internal const string Enabled = "re_packagepricedkone";
        internal const string Cost = "re_materialbeforemarkup";
        internal const int Manual = 126110000, Package = 126110001;

        internal static void RequireSchema(IOrganizationService service)
        {
            foreach (var table in new[] { "re_estimatepackage", "re_estimatematerialline" })
            {
                var response = (RetrieveEntityResponse)service.Execute(new RetrieveEntityRequest {
                    LogicalName = table, EntityFilters = EntityFilters.Attributes, RetrieveAsIfPublished = false
                });
                var attributes = response.EntityMetadata.Attributes;
                var valid = table == "re_estimatepackage"
                    ? attributes.Any(a => a.LogicalName == Cost && a is MoneyAttributeMetadata) &&
                      attributes.Any(a => a.LogicalName == Enabled && a is BooleanAttributeMetadata)
                    : attributes.Any(a => a.LogicalName == Mode && a is PicklistAttributeMetadata choice &&
                        choice.OptionSet?.Options != null &&
                        new[] { Manual, Package }.All(v => choice.OptionSet.Options.Any(o => o.Value == v)));
                if (!valid) throw new InvalidPluginExecutionException(
                    "Package material pricing is not deployed. Publish the package material snapshot columns and update both backend assemblies.");
            }
        }

        internal static string Source(Entity row)
        {
            var mode = row.GetAttributeValue<OptionSetValue>(Mode)?.Value;
            if (!mode.HasValue) return null;
            if (mode == Package) return "package";
            if (mode == Manual) return "manual";
            throw new InvalidPluginExecutionException("Saved material pricing mode is invalid.");
        }

        internal static decimal Apply(MaterialInput line, Entity previous, Entity row)
        {
            if (line.pricingSource != "package" && line.pricingSource != "manual")
                throw new InvalidPluginExecutionException("Invalid material pricing source.");
            var package = line.pricingSource == "package";
            var unlistedKone = !package && line.partType == "kone";
            if ((!unlistedKone && line.partType != (package ? "kone" : "non-kone")) ||
                !string.IsNullOrEmpty(line.catalogPartId) || line.catalogDetails != null ||
                line.unitPrice.HasValue || line.refreshPart || (package && line.unitCost != 0) ||
                (!unlistedKone && (line.markupPercent.HasValue || line.sellingPrice.HasValue)))
                throw new InvalidPluginExecutionException("Package/manual material must not contain catalog prices or extra markup.");
            if (!package && previous != null && PartCatalog.IsManualKone(previous))
                foreach (var column in PartCatalog.SnapshotColumns) row[column] = null;
            else if (previous?.GetAttributeValue<OptionSetValue>("re_parttype") != null &&
                (!unlistedKone || Source(previous) != "manual"))
                throw new InvalidPluginExecutionException("Remove the catalog material line before replacing it with package/manual pricing.");
            row[Mode] = new OptionSetValue(package ? Package : Manual);
            if (unlistedKone)
            {
                if (!PartCatalog.Amount(line.unitCost, 10, true) || !PartCatalog.Amount(line.sellingPrice, 10, true))
                    throw new InvalidPluginExecutionException("Unlisted KONE unit cost and sell price must be positive, up to 1000000000 with at most ten decimals.");
                if (line.markupPercent != 10m)
                    throw new InvalidPluginExecutionException("KONE markup must be exactly 10 percent.");
                row["re_parttype"] = new OptionSetValue(126110000);
                row["re_materialsource"] = new OptionSetValue(126110001);
                row["re_unitcostprecise"] = line.unitCost;
                row["re_sellingprice"] = line.sellingPrice.Value;
                row["re_markuppct"] = 10m;
            }
            return package ? 0m : line.unitCost;
        }
    }
}
