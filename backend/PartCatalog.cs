using System;
using System.Collections.Generic;
using System.Globalization;
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
        [DataMember] public decimal? unitCost;
        [DataMember] public decimal? unitPrice;
        [DataMember] public string uom;
        [DataMember] public CatalogDetails details;
    }

    [DataContract]
    public sealed class CatalogDetails
    {
        [DataMember] public int version = 1;
        [DataMember] public string number;
        [DataMember] public string masterPartType;
        [DataMember] public int? state;
        [DataMember] public decimal? sourceCost;
        [DataMember] public decimal? sourcePrice;
        [DataMember] public decimal? pricingUnit;
        [DataMember] public string sourceCurrency;
        [DataMember] public string sourceKey;
        [DataMember] public string sourceVersion;
        [DataMember] public string description;
        [DataMember] public string descriptionFr;
        [DataMember] public string uom;
        [DataMember] public string effectiveFrom;
        [DataMember] public string effectiveTo;
        [DataMember] public string refreshedOn;
        [DataMember] public string salesOrganization;
        [DataMember] public string distributionChannel;
        [DataMember] public string conditionRecord;
        [DataMember] public decimal? unitCost;
        [DataMember] public decimal? unitPrice;
        [DataMember] public bool requiresCost;
        [DataMember] public bool requiresSellingPrice;
        [DataMember] public bool requiresDescription;
        [DataMember] public bool requiresUom;
        [DataMember] public List<string> issues = new List<string>();
    }

    [DataContract]
    public sealed class CatalogResult
    {
        [DataMember] public string mode = "partcatalog";
        [DataMember] public int catalogVersion = 2;
        [DataMember] public bool available;
        [DataMember] public string reason;
        [DataMember] public string currency;
        [DataMember] public decimal defaultMarkupPercent = 10m;
        [DataMember] public bool more;
        [DataMember] public int? nextPage;
        [DataMember] public string nextCursor;
        [DataMember] public List<CatalogPart> parts = new List<CatalogPart>();
    }

    internal static class PartCatalog
    {
        internal const string DetailsColumn = "re_catalogdetailsjson";
        internal static readonly string[] SnapshotColumns = {
            "re_sparepart", "re_parttype", "re_materialsource", "re_materialscope", "re_sourcekey", "re_sourceversion",
            "re_conversionversion", "re_sourceusdcost", "re_sourceusdprice", "re_unitcostprecise",
            "re_unitpriceprecise", "re_sellingprice", "re_pricingunit", "re_uom", "re_usdtocadfactor", "re_costonlyfactor",
            "re_markuppct", "re_sourcecurrency", "re_amountcurrency", "re_refreshedon", DetailsColumn
        };
        static readonly string[] PartColumns = {
            "re_partnumber", "re_name", "re_descriptionen", "re_descriptionfr", "re_parttype",
            "re_usdcost", "re_usdprice", "re_sourcecurrency", "re_pricingunit", "re_uom",
            "re_sourcekey", "re_sourceversion", "re_effectivefrom", "re_effectiveto", "re_refreshedon", "statecode",
            "re_salesorganization", "re_distributionchannel", "re_conditionrecord"
        };
        static readonly string[] ConfigColumns = {
            "re_market", "re_currency", "re_version", "re_usdtocadfactor", "re_costonlyfactor",
            "re_defaultmarkuppct", "re_effectivefrom", "re_effectiveto", "re_isenabled", "statecode"
        };
        static void Fail(string message) { throw new InvalidPluginExecutionException(message); }

        static bool Compatible(AttributeMetadata attribute)
        {
            var name = attribute.LogicalName;
            if (name == DetailsColumn) return attribute is MemoAttributeMetadata memo && memo.MaxLength >= 20000;
            var precision = name == "re_unitcostprecise" || name == "re_unitpriceprecise" || name == "re_sellingprice" ? 10 :
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
                defaultMarkupPercent = 10m };
            if (input.mode == "partcapabilities") return result;
            var search = (input.search ?? "").Trim();
            if (search.Length > 100) Fail("Enter at most 100 characters to search parts.");
            var page = input.partPage == 0 ? 1 : input.partPage;
            if (page < 1 || page > 100000 || (input.catalogCursor?.Length ?? 0) > 8000 ||
                (page > 1 && string.IsNullOrEmpty(input.catalogCursor)) ||
                (page == 1 && !string.IsNullOrEmpty(input.catalogCursor)))
                Fail("Invalid parts catalog continuation. Restart the search.");
            var query = new QueryExpression("re_sparepart") { ColumnSet = new ColumnSet(PartColumns),
                PageInfo = new PagingInfo { Count = 20, PageNumber = page, PagingCookie = input.catalogCursor } };
            if (search.IndexOfAny(new[] { '%', '_', '[', ']' }) >= 0)
                Fail("Part search cannot contain wildcard characters.");
            if (search.Length > 0)
            {
                var filter = query.Criteria.AddFilter(LogicalOperator.Or);
                filter.AddCondition("re_partnumber", ConditionOperator.Like, "%" + search + "%");
                filter.AddCondition("re_descriptionen", ConditionOperator.Like, "%" + search + "%");
                filter.AddCondition("re_descriptionfr", ConditionOperator.Like, "%" + search + "%");
                filter.AddCondition("re_name", ConditionOperator.Like, "%" + search + "%");
            }
            query.AddOrder("re_partnumber", OrderType.Ascending);
            query.AddOrder("re_sparepartid", OrderType.Ascending);
            var response = service.RetrieveMultiple(query);
            foreach (var part in response.Entities)
            {
                var details = Describe(part, config, input.market);
                result.parts.Add(new CatalogPart {
                    id = part.Id.ToString(), number = part.GetAttributeValue<string>("re_partnumber"),
                    description = details.description ?? "", partType = details.masterPartType,
                    unitCost = details.unitCost, unitPrice = details.unitPrice,
                    uom = details.uom ?? "", details = details
                });
            }
            result.more = response.MoreRecords;
            if (result.more)
            {
                if (string.IsNullOrEmpty(response.PagingCookie)) Fail("Parts catalog continuation is unavailable.");
                result.nextPage = page + 1;
                result.nextCursor = response.PagingCookie;
            }
            return result;
        }

        internal static bool Amount(decimal? value, int precision, bool positive)
        {
            return value.HasValue && (positive ? value > 0 : value >= 0) && value <= 1000000000m &&
                decimal.Round(value.Value, precision) == value.Value;
        }

        static decimal? ConvertAmount(decimal? value, decimal factor)
        {
            if (!Amount(value, 6, false)) return null;
            if (value > 0 && factor > 1000000000m / value.Value) return null;
            var converted = value.Value * factor;
            return Amount(converted, 10, false) ? converted : (decimal?)null;
        }

        static string Date(Entity row, string column, bool timestamp = false)
        {
            return row.GetAttributeValue<DateTime?>(column)?.ToString(timestamp ? "o" : "yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        static CatalogDetails Describe(Entity part, Entity config, int market)
        {
            var type = part.GetAttributeValue<OptionSetValue>("re_parttype")?.Value;
            var details = new CatalogDetails {
                number = part.GetAttributeValue<string>("re_partnumber"),
                masterPartType = type == 126110000 ? "kone" : type == 126110001 ? "non-kone" : null,
                state = part.GetAttributeValue<OptionSetValue>("statecode")?.Value,
                sourceCost = part.GetAttributeValue<decimal?>("re_usdcost"),
                sourcePrice = part.GetAttributeValue<decimal?>("re_usdprice"),
                pricingUnit = part.GetAttributeValue<decimal?>("re_pricingunit"),
                sourceCurrency = part.GetAttributeValue<string>("re_sourcecurrency"),
                sourceKey = part.GetAttributeValue<string>("re_sourcekey"),
                sourceVersion = part.GetAttributeValue<string>("re_sourceversion"),
                description = part.GetAttributeValue<string>("re_descriptionen"),
                descriptionFr = part.GetAttributeValue<string>("re_descriptionfr"),
                uom = part.GetAttributeValue<string>("re_uom"),
                effectiveFrom = Date(part, "re_effectivefrom"), effectiveTo = Date(part, "re_effectiveto"),
                refreshedOn = Date(part, "re_refreshedon", true),
                salesOrganization = part.GetAttributeValue<string>("re_salesorganization"),
                distributionChannel = part.GetAttributeValue<string>("re_distributionchannel"),
                conditionRecord = part.GetAttributeValue<string>("re_conditionrecord")
            };
            if (details.state != 0) details.issues.Add("inactive");
            var start = part.GetAttributeValue<DateTime?>("re_effectivefrom");
            var end = part.GetAttributeValue<DateTime?>("re_effectiveto");
            if (!start.HasValue) details.issues.Add("missing-valid-from");
            else if (start.Value.Date > DateTime.UtcNow.Date) details.issues.Add("future");
            if (end.HasValue && end.Value.Date < DateTime.UtcNow.Date) details.issues.Add("expired");
            if (string.IsNullOrWhiteSpace(details.sourceKey)) details.issues.Add("missing-source-key");
            if (string.IsNullOrWhiteSpace(details.sourceVersion)) details.issues.Add("missing-source-version");
            if (details.refreshedOn == null) details.issues.Add("missing-refreshed-on");
            details.requiresDescription = string.IsNullOrWhiteSpace(details.description);
            details.requiresUom = string.IsNullOrWhiteSpace(details.uom);
            if (details.requiresDescription) details.issues.Add("missing-description");
            if (details.requiresUom) details.issues.Add("missing-uom");
            if (details.masterPartType == null) details.issues.Add("invalid-master-type");
            if (details.sourceCurrency != "USD") details.issues.Add("invalid-source-currency");
            if (details.pricingUnit != 1m) details.issues.Add("unsupported-pricing-unit");
            if (!Amount(details.sourceCost, 6, true)) details.issues.Add("invalid-cost");
            if (!Amount(details.sourcePrice, 6, true)) details.issues.Add("invalid-price");
            var fx = market == 126110000 ? 1m : config.GetAttributeValue<decimal>("re_usdtocadfactor");
            var uplift = market == 126110000 ? 1m : config.GetAttributeValue<decimal>("re_costonlyfactor");
            if (details.sourceCurrency == "USD" && details.pricingUnit == 1m)
            {
                details.unitCost = ConvertAmount(details.sourceCost, fx * uplift);
                details.unitPrice = ConvertAmount(details.sourcePrice, fx * uplift);
                if (Amount(details.sourceCost, 6, true) && details.unitCost == null)
                    details.issues.Add("invalid-converted-cost");
                if (Amount(details.sourcePrice, 6, true) && details.unitPrice == null)
                    details.issues.Add("invalid-converted-price");
            }
            details.requiresCost = !Amount(details.unitCost, 10, true);
            details.requiresSellingPrice = !Amount(details.unitPrice, 10, true);
            return details;
        }

        internal static CatalogDetails ReadDetails(Entity row)
        {
            var json = row.GetAttributeValue<string>(DetailsColumn);
            if (string.IsNullOrEmpty(json)) return null;
            var details = DraftPlugin.Deserialize<CatalogDetails>(json);
            if (details == null || details.version != 1 || details.issues == null)
                Fail("Saved catalog details are invalid. Reselect the part.");
            return details;
        }

        static Entity Snapshot(Entity part, CatalogDetails details, Entity config, int market)
        {
            return new Entity("re_estimatematerialline") {
                ["re_sparepart"] = part.ToEntityReference(),
                ["re_materialsource"] = new OptionSetValue(126110000), ["re_sourcekey"] = details.sourceKey,
                ["re_sourceversion"] = details.sourceVersion,
                ["re_conversionversion"] = config.GetAttributeValue<string>("re_version"),
                ["re_sourceusdcost"] = Amount(details.sourceCost, 6, false) ? details.sourceCost : null,
                ["re_sourceusdprice"] = Amount(details.sourcePrice, 6, false) ? details.sourcePrice : null,
                ["re_unitcostprecise"] = details.unitCost, ["re_unitpriceprecise"] = details.unitPrice,
                ["re_pricingunit"] = details.pricingUnit, ["re_uom"] = details.uom,
                ["re_usdtocadfactor"] = market == 126110000 ? 1m : config.GetAttributeValue<decimal>("re_usdtocadfactor"),
                ["re_costonlyfactor"] = market == 126110000 ? 1m : config.GetAttributeValue<decimal>("re_costonlyfactor"),
                ["re_sourcecurrency"] = details.sourceCurrency,
                ["re_amountcurrency"] = market == 126110000 ? "USD" : "CAD",
                ["re_refreshedon"] = part.GetAttributeValue<DateTime?>("re_refreshedon"),
                ["re_entereddescription"] = details.description, ["re_partnumber"] = details.number,
                [DetailsColumn] = DraftPlugin.Serialize(details)
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
                if (!string.IsNullOrEmpty(line.catalogPartId) || line.markupPercent.HasValue || line.sellingPrice.HasValue)
                    Fail("Part classification is required.");
                return line.unitCost;
            }
            if (line.partType != "kone" && line.partType != "non-kone") Fail("Invalid part classification.");
            var type = line.partType == "kone" ? 126110000 : 126110001;
            Guid catalogId;
            var hasCatalog = !string.IsNullOrEmpty(line.catalogPartId);
            if (!Guid.TryParse(line.catalogPartId, out catalogId) && hasCatalog) Fail("Invalid catalog part ID.");
            var sameCatalog = previous != null && hasCatalog &&
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
                if (!Amount(row.GetAttributeValue<decimal?>("re_unitcostprecise"), 10, true) ||
                    row.GetAttributeValue<OptionSetValue>("re_materialsource")?.Value != 126110000 ||
                    row.GetAttributeValue<string>("re_amountcurrency") != (input.market == 126110000 ? "USD" : "CAD") ||
                    previous.GetAttributeValue<EntityReference>("transactioncurrencyid")?.Id != currency.Id ||
                    string.IsNullOrWhiteSpace(row.GetAttributeValue<string>("re_uom")))
                    Fail("Saved catalog material snapshot is incomplete or its currency has changed. Reselect the part.");
            }
            if (!sameCatalog && !sameManual)
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
                var details = Describe(part, configuration, input.market);
                if (string.IsNullOrWhiteSpace(details.number)) Fail("The selected catalog record has no part number.");
                var snapshot = Snapshot(part, details, configuration, input.market);
                foreach (var attribute in snapshot.Attributes) row[attribute.Key] = attribute.Value;
            }
            else if (!sameCatalog)
            {
                if (type == 126110000) Fail("KONE material requires catalog selection.");
                if (line.refreshPart) Fail("Only catalog parts can be refreshed.");
                foreach (var key in SnapshotColumns) row[key] = null;
                row["re_materialsource"] = new OptionSetValue(126110001);
                row["re_parttype"] = new OptionSetValue(type);
                row["re_unitcostprecise"] = line.unitCost;
                row["re_amountcurrency"] = input.market == 126110000 ? "USD" : "CAD";
            }
            if (hasCatalog)
            {
                var details = ReadDetails(row);
                if (line.unitCostOverride.HasValue)
                {
                    if (details == null) Fail("Reselect the catalog part before overriding its unit cost.");
                    if (!Amount(line.unitCostOverride, 10, true))
                        Fail("Enter a positive unit cost in estimate currency, up to 1000000000 with at most ten decimals.");
                    row["re_unitcostprecise"] = line.unitCostOverride.Value;
                }
                if (details != null)
                {
                    if (details.requiresCost && !line.unitCostOverride.HasValue)
                    {
                        if (!Amount(line.unitCost, 10, true)) Fail("Enter a positive unit cost in estimate currency, up to 1000000000 with at most ten decimals.");
                        row["re_unitcostprecise"] = line.unitCost;
                    }
                    if (details.requiresDescription)
                    {
                        if (string.IsNullOrWhiteSpace(line.description) || line.description.Length > 2000)
                            Fail("Complete the missing material description (at most 2000 characters).");
                        row["re_entereddescription"] = line.description.Trim();
                    }
                    if (details.requiresUom)
                    {
                        if (string.IsNullOrWhiteSpace(line.uom) || line.uom.Length > 20)
                            Fail("Complete the missing unit of measure (at most 20 characters).");
                        row["re_uom"] = line.uom.Trim();
                    }
                }
                if (!Amount(row.GetAttributeValue<decimal?>("re_unitcostprecise"), 10, true))
                    Fail("Complete the missing or invalid unit cost in estimate currency before saving.");
                row["re_parttype"] = new OptionSetValue(type);
                row["re_vendor"] = type == 126110000 ? "KONE" : "";
            }
            if (type == 126110000)
            {
                if (line.markupPercent != 10m) Fail("KONE markup must be exactly 10 percent.");
                row["re_markuppct"] = 10m;
            }
            else
            {
                if (line.markupPercent.HasValue) Fail("Markup is only available for KONE parts.");
                row["re_markuppct"] = null;
            }
            row["re_materialscope"] = new OptionSetValue(126110000);
            if (line.sellingPrice.HasValue)
            {
                if (!hasCatalog || !Amount(line.sellingPrice, 10, true))
                    Fail("Selling price requires a catalog part and a positive amount up to 1000000000 with at most ten decimals.");
                row["re_sellingprice"] = line.sellingPrice.Value;
            }
            else
                row["re_sellingprice"] = sameCatalog ? previous.GetAttributeValue<decimal?>("re_sellingprice") : null;
            if (hasCatalog && !Amount(row.GetAttributeValue<decimal?>("re_sellingprice") ??
                row.GetAttributeValue<decimal?>("re_unitpriceprecise"), 10, true))
                Fail("Complete the missing or invalid selling price in estimate currency before saving.");
            return row.GetAttributeValue<decimal>("re_unitcostprecise");
        }
    }
}
