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
            if (line.partType != (package ? "kone" : "non-kone") ||
                !string.IsNullOrEmpty(line.catalogPartId) || line.markupPercent.HasValue ||
                line.unitPrice.HasValue || line.refreshPart || (package && line.unitCost != 0))
                throw new InvalidPluginExecutionException("Package/manual material must not contain catalog prices or extra markup.");
            if (previous?.GetAttributeValue<OptionSetValue>("re_parttype") != null)
                throw new InvalidPluginExecutionException("Remove the catalog material line before replacing it with package/manual pricing.");
            row[Mode] = new OptionSetValue(package ? Package : Manual);
            return package ? 0m : line.unitCost;
        }
    }
}
