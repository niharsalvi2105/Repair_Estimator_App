using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;

namespace RepairEstimator.Drafts
{
    [DataContract]
    public sealed class CatalogPart
    {
        [DataMember] public string id;
        [DataMember] public string number;
        [DataMember] public string description;
        [DataMember] public string partType;
        [DataMember] public decimal unitCost;
        [DataMember] public decimal? unitPrice;
        [DataMember] public string uom;
    }

    [DataContract]
    public sealed class CatalogResult
    {
        [DataMember] public string mode = "partcatalog";
        [DataMember] public bool available;
        [DataMember] public string reason;
        [DataMember] public string currency;
        [DataMember] public decimal defaultMarkupPercent;
        [DataMember] public bool more;
        [DataMember] public List<CatalogPart> parts = new List<CatalogPart>();
    }

    internal static class PartCatalog
    {
        internal static readonly string[] SnapshotColumns = {
            "re_sparepart", "re_parttype", "re_materialsource", "re_materialscope", "re_sourcekey", "re_sourceversion",
            "re_conversionversion", "re_sourceusdcost", "re_sourceusdprice", "re_unitcostprecise",
            "re_unitpriceprecise", "re_pricingunit", "re_uom", "re_usdtocadfactor", "re_costonlyfactor",
            "re_markuppct", "re_sourcecurrency", "re_amountcurrency", "re_refreshedon"
        };
        static readonly string[] PartColumns = {
            "re_partnumber", "re_name", "re_descriptionen", "re_descriptionfr", "re_parttype",
            "re_usdcost", "re_usdprice", "re_sourcecurrency", "re_pricingunit", "re_uom",
            "re_sourcekey", "re_sourceversion", "re_effectivefrom", "re_effectiveto", "re_refreshedon", "statecode"
        };
        static readonly string[] ConfigColumns = {
            "re_market", "re_currency", "re_version", "re_usdtocadfactor", "re_costonlyfactor",
            "re_defaultmarkuppct", "re_effectivefrom", "re_effectiveto", "re_isenabled", "statecode"
        };
        static void Fail(string message) { throw new InvalidPluginExecutionException(message); }

        static bool Compatible(AttributeMetadata attribute)
        {
            var name = attribute.LogicalName;
            var precision = name == "re_unitcostprecise" || name == "re_unitpriceprecise" ? 10 :
                new[] { "re_usdcost", "re_usdprice", "re_sourceusdcost", "re_sourceusdprice", "re_pricingunit" }.Contains(name) ? 6 :
                new[] { "re_usdtocadfactor", "re_costonlyfactor", "re_markuppct", "re_defaultmarkuppct" }.Contains(name) ? 2 : 0;
            if (precision > 0) return attribute is DecimalAttributeMetadata number && number.Precision >= precision;
            var target = name == "re_sparepart" ? "re_sparepart" : name == "re_estimatepackage" ? "re_estimatepackage" :
                name == "re_currency" ? "transactioncurrency" : null;
            if (target != null) return attribute is LookupAttributeMetadata lookup && lookup.Targets != null && lookup.Targets.Contains(target);
            if (name == "re_isenabled") return attribute is BooleanAttributeMetadata;
            if (name == "statecode") return attribute.AttributeType == AttributeTypeCode.State;
            if (name == "re_effectivefrom" || name == "re_effectiveto" || name == "re_refreshedon")
                return attribute is DateTimeAttributeMetadata;
            if (name == "re_parttype" || name == "re_materialsource" || name == "re_materialscope" || name == "re_market")
            {
                var choice = attribute as PicklistAttributeMetadata;
                var expected = name == "re_market" ? new[] { 126110000, 126110001, 126110002 } : new[] { 126110000, 126110001 };
                return choice?.OptionSet?.Options != null && expected.All(value => choice.OptionSet.Options.Any(option => option.Value == value));
            }
            return attribute is StringAttributeMetadata || attribute is MemoAttributeMetadata;
        }

        internal static string TypeName(OptionSetValue value)
        {
            if (value == null) return null;
            if (value.Value != 126110000 && value.Value != 126110001) Fail("Saved material classification is invalid.");
            return value.Value == 126110000 ? "kone" : "non-kone";
        }

        static bool HasSchema(IOrganizationService service)
        {
            var entities = (RetrieveAllEntitiesResponse)service.Execute(new RetrieveAllEntitiesRequest {
                EntityFilters = EntityFilters.Entity, RetrieveAsIfPublished = false
            });
            foreach (var name in new[] { "re_sparepart", "re_partpricingconfiguration", "re_estimatematerialline" })
            {
                if (!entities.EntityMetadata.Any(e => e.LogicalName == name)) return false;
                var response = (RetrieveEntityResponse)service.Execute(new RetrieveEntityRequest {
                    LogicalName = name, EntityFilters = EntityFilters.Attributes, RetrieveAsIfPublished = false
                });
                var required = name == "re_sparepart" ? PartColumns :
                    name == "re_partpricingconfiguration" ? ConfigColumns :
                    SnapshotColumns.Concat(new[] { "re_estimatepackage" }).ToArray();
                if (required.Any(column => !response.EntityMetadata.Attributes.Any(a => a.LogicalName == column && Compatible(a))))
                    return false;
            }
            return true;
        }

        static QueryExpression Effective(string table, string[] columns)
        {
            var query = new QueryExpression(table) { ColumnSet = new ColumnSet(columns) };
            query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            query.Criteria.AddCondition("re_effectivefrom", ConditionOperator.LessEqual, DateTime.UtcNow.Date);
            var end = query.Criteria.AddFilter(LogicalOperator.Or);
            end.AddCondition("re_effectiveto", ConditionOperator.Null);
            end.AddCondition("re_effectiveto", ConditionOperator.GreaterEqual, DateTime.UtcNow.Date);
            return query;
        }

        internal static Entity Configuration(IOrganizationService service, int market)
        {
            if (market < 126110000 || market > 126110002) Fail("Unsupported parts market.");
            if (!HasSchema(service)) return null;
            var query = Effective("re_partpricingconfiguration", ConfigColumns);
            query.Criteria.AddCondition("re_market", ConditionOperator.Equal, market);
            query.TopCount = 2;
            var rows = service.RetrieveMultiple(query).Entities;
            if (rows.Count == 0) return null;
            if (rows.Count != 1) Fail("Part pricing configuration is ambiguous.");
            var config = rows[0];
            if (!config.GetAttributeValue<bool>("re_isenabled")) return null;
            if (config.GetAttributeValue<EntityReference>("re_currency") == null ||
                string.IsNullOrWhiteSpace(config.GetAttributeValue<string>("re_version")) ||
                !config.Contains("re_defaultmarkuppct") || !config.Contains("re_usdtocadfactor") ||
                !config.Contains("re_costonlyfactor") ||
                config.GetAttributeValue<decimal>("re_defaultmarkuppct") < 0 ||
                config.GetAttributeValue<decimal>("re_defaultmarkuppct") > 100 ||
                config.GetAttributeValue<decimal>("re_usdtocadfactor") <= 0 ||
                config.GetAttributeValue<decimal>("re_costonlyfactor") <= 0)
                Fail("Part pricing configuration is incomplete or invalid.");
            foreach (var column in new[] { "re_defaultmarkuppct", "re_usdtocadfactor", "re_costonlyfactor" })
                if (decimal.Round(config.GetAttributeValue<decimal>(column), 2) != config.GetAttributeValue<decimal>(column))
                    Fail("Part pricing configuration exceeds supported precision.");
            var currency = service.Retrieve("transactioncurrency", config.GetAttributeValue<EntityReference>("re_currency").Id,
                new ColumnSet("isocurrencycode")).GetAttributeValue<string>("isocurrencycode");
            if (currency != (market == 126110000 ? "USD" : "CAD")) Fail("Parts market currency does not match configuration.");
            return config;
        }

        internal static CatalogResult Search(IOrganizationService service, Draft input)
        {
            var config = Configuration(service, input.market);
            if (config == null) return new CatalogResult {
                reason = "Catalog unavailable: schema and approved pricing configuration must be deployed and enabled."
            };
            var currency = input.market == 126110000 ? "USD" : "CAD";
            var result = new CatalogResult { available = true, currency = currency,
                defaultMarkupPercent = config.GetAttributeValue<decimal>("re_defaultmarkuppct") };
            if (input.mode == "partcapabilities") return result;
            if (input.partType != "kone" && input.partType != "non-kone") Fail("Select a valid part type.");
            var search = (input.search ?? "").Trim();
            if (search.Length < 2 || search.Length > 100) Fail("Enter between 2 and 100 characters to search parts.");
            var query = Effective("re_sparepart", PartColumns);
            query.Criteria.AddCondition("re_parttype", ConditionOperator.Equal, input.partType == "kone" ? 126110000 : 126110001);
            var filter = query.Criteria.AddFilter(LogicalOperator.Or);
            filter.AddCondition("re_partnumber", ConditionOperator.BeginsWith, search);
            filter.AddCondition("re_descriptionen", ConditionOperator.BeginsWith, search);
            filter.AddCondition("re_descriptionfr", ConditionOperator.BeginsWith, search);
            query.AddOrder("re_partnumber", OrderType.Ascending);
            query.AddOrder("re_sparepartid", OrderType.Ascending);
            query.TopCount = 21;
            var rows = service.RetrieveMultiple(query).Entities;
            foreach (var part in rows.Take(20))
            {
                var snapshot = Snapshot(service, part, config, input.market);
                result.parts.Add(new CatalogPart {
                    id = part.Id.ToString(), number = part.GetAttributeValue<string>("re_partnumber"),
                    description = part.GetAttributeValue<string>("re_descriptionen") ?? part.GetAttributeValue<string>("re_name"),
                    partType = input.partType, unitCost = snapshot.GetAttributeValue<decimal>("re_unitcostprecise"),
                    unitPrice = snapshot.GetAttributeValue<decimal?>("re_unitpriceprecise"),
                    uom = part.GetAttributeValue<string>("re_uom")
                });
            }
            result.more = rows.Count > 20;
            return result;
        }

        static Entity Snapshot(IOrganizationService service, Entity part, Entity config, int market)
        {
            var sourceKey = part.GetAttributeValue<string>("re_sourcekey");
            if (string.IsNullOrWhiteSpace(sourceKey)) Fail("Part source key is missing.");
            var unique = Effective("re_sparepart", new[] { "re_sourcekey" });
            unique.Criteria.AddCondition("re_sourcekey", ConditionOperator.Equal, sourceKey);
            unique.TopCount = 2;
            var matches = service.RetrieveMultiple(unique).Entities;
            if (matches.Count != 1 || matches[0].Id != part.Id) Fail("Part is missing, expired or ambiguous.");
            if (part.GetAttributeValue<string>("re_sourcecurrency") != "USD" ||
                !part.Contains("re_usdcost") || part.GetAttributeValue<decimal>("re_usdcost") <= 0 ||
                !part.Contains("re_pricingunit") || part.GetAttributeValue<decimal>("re_pricingunit") != 1m ||
                string.IsNullOrWhiteSpace(part.GetAttributeValue<string>("re_uom")) ||
                string.IsNullOrWhiteSpace(part.GetAttributeValue<string>("re_sourceversion")) ||
                !part.Contains("re_refreshedon"))
                Fail("Part cost/source/UOM is incomplete. Only approved per-unit parts are supported.");
            var type = part.GetAttributeValue<OptionSetValue>("re_parttype")?.Value;
            if (type != 126110000 && type != 126110001) Fail("Part classification is invalid.");
            if (type == 126110000 && (!part.Contains("re_usdprice") || part.GetAttributeValue<decimal>("re_usdprice") <= 0))
                Fail("KONE part requires a positive VK13 price.");
            foreach (var column in new[] { "re_usdcost", "re_usdprice" })
            {
                var amount = part.GetAttributeValue<decimal?>(column);
                if (amount.HasValue && (amount.Value < 0 || amount.Value > 1000000000m ||
                    decimal.Round(amount.Value, 6) != amount.Value))
                    Fail("Part source amount exceeds supported precision or range.");
            }
            if (string.IsNullOrWhiteSpace(part.GetAttributeValue<string>("re_partnumber")) ||
                string.IsNullOrWhiteSpace(part.GetAttributeValue<string>("re_descriptionen") ?? part.GetAttributeValue<string>("re_name")))
                Fail("Part number or description is missing.");
            var fx = market == 126110000 ? 1m : config.GetAttributeValue<decimal>("re_usdtocadfactor");
            var uplift = market == 126110000 ? 1m : config.GetAttributeValue<decimal>("re_costonlyfactor");
            var cost = part.GetAttributeValue<decimal>("re_usdcost") * fx * uplift;
            var price = part.GetAttributeValue<decimal?>("re_usdprice") * fx;
            if (cost > 1000000000m || decimal.Round(cost, 10) != cost ||
                (price.HasValue && (price < 0 || price > 1000000000m || decimal.Round(price.Value, 10) != price.Value)))
                Fail("Converted part amounts exceed supported precision or range.");
            return new Entity("re_estimatematerialline") {
                ["re_sparepart"] = part.ToEntityReference(), ["re_parttype"] = new OptionSetValue(type.Value),
                ["re_materialsource"] = new OptionSetValue(126110000), ["re_sourcekey"] = sourceKey,
                ["re_sourceversion"] = part.GetAttributeValue<string>("re_sourceversion"),
                ["re_conversionversion"] = config.GetAttributeValue<string>("re_version"),
                ["re_sourceusdcost"] = part.GetAttributeValue<decimal>("re_usdcost"),
                ["re_sourceusdprice"] = part.GetAttributeValue<decimal?>("re_usdprice"),
                ["re_unitcostprecise"] = cost, ["re_unitpriceprecise"] = price,
                ["re_pricingunit"] = 1m, ["re_uom"] = part.GetAttributeValue<string>("re_uom"),
                ["re_usdtocadfactor"] = fx, ["re_costonlyfactor"] = uplift, ["re_sourcecurrency"] = "USD",
                ["re_amountcurrency"] = market == 126110000 ? "USD" : "CAD",
                ["re_refreshedon"] = part.GetAttributeValue<DateTime>("re_refreshedon"),
                ["re_entereddescription"] = part.GetAttributeValue<string>("re_descriptionen") ?? part.GetAttributeValue<string>("re_name"),
                ["re_partnumber"] = part.GetAttributeValue<string>("re_partnumber"),
                ["re_vendor"] = type == 126110000 ? "KONE" : ""
            };
        }

        internal static decimal Apply(IOrganizationService service, MaterialInput line, Entity previous,
            Entity row, Draft input, EntityReference currency, ref Entity configuration)
        {
            var savedType = previous?.GetAttributeValue<OptionSetValue>("re_parttype")?.Value;
            TypeName(previous?.GetAttributeValue<OptionSetValue>("re_parttype"));
            if (line.partType == null)
            {
                if (savedType.HasValue) Fail("Reload the current app before editing catalog material.");
                if (!string.IsNullOrEmpty(line.catalogPartId) || line.markupPercent.HasValue)
                    Fail("Part classification is required.");
                return line.unitCost;
            }
            if (line.partType != "kone" && line.partType != "non-kone") Fail("Invalid part classification.");
            var type = line.partType == "kone" ? 126110000 : 126110001;
            Guid catalogId;
            var hasCatalog = !string.IsNullOrEmpty(line.catalogPartId);
            if (!Guid.TryParse(line.catalogPartId, out catalogId) && hasCatalog) Fail("Invalid catalog part ID.");
            var sameCatalog = previous != null && savedType == type && hasCatalog &&
                previous.GetAttributeValue<EntityReference>("re_sparepart")?.Id == catalogId && !line.refreshPart;
            var sameManual = previous != null && savedType == 126110001 && type == 126110001 && !hasCatalog &&
                previous.GetAttributeValue<OptionSetValue>("re_materialsource")?.Value == 126110001 &&
                previous.GetAttributeValue<EntityReference>("re_sparepart") == null &&
                previous.GetAttributeValue<EntityReference>("transactioncurrencyid")?.Id == currency.Id &&
                previous.GetAttributeValue<string>("re_amountcurrency") == (input.market == 126110000 ? "USD" : "CAD") &&
                string.Equals(previous.GetAttributeValue<string>("re_partnumber") ?? "", (line.part ?? "").Trim(), StringComparison.OrdinalIgnoreCase);
            if (sameCatalog)
            {
                foreach (var key in SnapshotColumns.Concat(new[] { "re_entereddescription", "re_vendor", "re_partnumber" }))
                    if (previous.Contains(key)) row[key] = previous[key];
                if (!(row.GetAttributeValue<decimal?>("re_unitcostprecise") > 0) ||
                    row.GetAttributeValue<OptionSetValue>("re_materialsource")?.Value != 126110000 ||
                    row.GetAttributeValue<string>("re_sourcecurrency") != "USD" ||
                    row.GetAttributeValue<string>("re_amountcurrency") != (input.market == 126110000 ? "USD" : "CAD") ||
                    previous.GetAttributeValue<EntityReference>("transactioncurrencyid")?.Id != currency.Id ||
                    new[] { "re_sourcekey", "re_sourceversion", "re_conversionversion", "re_uom" }
                        .Any(column => string.IsNullOrWhiteSpace(row.GetAttributeValue<string>(column))) ||
                    (type == 126110000 && !(row.GetAttributeValue<decimal?>("re_unitpriceprecise") > 0)))
                    Fail("Saved catalog material snapshot is incomplete or its currency has changed. Reselect the part.");
            }
            if ((!sameCatalog && !sameManual) ||
                (sameCatalog && previous.GetAttributeValue<decimal?>("re_markuppct") != line.markupPercent))
            {
                if (configuration == null) configuration = Configuration(service, input.market);
                if (configuration == null) Fail("Parts catalog is not enabled. Existing manual material entry remains available.");
                if (configuration.GetAttributeValue<EntityReference>("re_currency").Id != currency.Id)
                    Fail("Part currency does not match estimate currency.");
            }
            if (!sameCatalog && !string.IsNullOrEmpty(line.catalogPartId))
            {
                Guid id;
                if (!Guid.TryParse(line.catalogPartId, out id)) Fail("Invalid catalog part ID.");
                var part = service.Retrieve("re_sparepart", id, new ColumnSet(PartColumns));
                if (part.GetAttributeValue<OptionSetValue>("re_parttype")?.Value != type)
                    Fail("Part classification does not match catalog.");
                var snapshot = Snapshot(service, part, configuration, input.market);
                foreach (var attribute in snapshot.Attributes) row[attribute.Key] = attribute.Value;
            }
            else if (!sameCatalog)
            {
                if (type == 126110000) Fail("KONE material requires catalog selection.");
                if (line.refreshPart) Fail("Only catalog parts can be refreshed.");
                if (!sameManual)
                {
                    var existingKone = Effective("re_sparepart", new[] { "re_partnumber" });
                    existingKone.Criteria.AddCondition("re_partnumber", ConditionOperator.Equal, (line.part ?? "").Trim());
                    existingKone.Criteria.AddCondition("re_parttype", ConditionOperator.Equal, 126110000);
                    existingKone.TopCount = 1;
                    if (service.RetrieveMultiple(existingKone).Entities.Count > 0)
                        Fail("This part is classified as KONE in the catalog. Select it as a KONE part.");
                }
                foreach (var key in SnapshotColumns) row[key] = null;
                row["re_materialsource"] = new OptionSetValue(126110001);
                row["re_parttype"] = new OptionSetValue(type);
                row["re_unitcostprecise"] = line.unitCost;
                row["re_amountcurrency"] = input.market == 126110000 ? "USD" : "CAD";
            }
            if (type == 126110000)
            {
                if (!line.markupPercent.HasValue || line.markupPercent < 0 || line.markupPercent > 100 ||
                    decimal.Round(line.markupPercent.Value, 2) != line.markupPercent)
                    Fail("KONE markup must be between 0 and 100 percent, with at most two decimals.");
                row["re_markuppct"] = line.markupPercent.Value;
            }
            else
            {
                if (line.markupPercent.HasValue) Fail("Markup is only available for KONE parts.");
                row["re_markuppct"] = null;
            }
            row["re_materialscope"] = new OptionSetValue(126110000);
            return row.GetAttributeValue<decimal>("re_unitcostprecise");
        }
    }
}
