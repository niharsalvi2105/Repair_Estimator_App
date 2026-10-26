using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using RepairEstimator.Plugins.Infrastructure;
using RepairEstimator.Plugins.Pricing;

namespace RepairEstimator.Plugins.Data
{
    /// <summary>Engine input plus the resolved values the calculation plug-in needs to write back.</summary>
    internal sealed class LoadedEstimate
    {
        public EstimateInput Input { get; } = new EstimateInput();
        public EntityReference MarginGroup { get; set; }
        public bool IsCustomPath { get; set; }
        public bool HasPackages { get; set; }
        public int RedundancyCount { get; set; }
        public string VerticalBand { get; set; }
    }

    internal static class EstimateInputLoader
    {
        public static LoadedEstimate Load(IOrganizationService s, IOrganizationService config, Entity est, DateTime today)
        {
            var loaded = new LoadedEstimate();
            var input = loaded.Input;

            var branch = Retrieve(s, est.GetAttributeValue<EntityReference>(Names.Estimate.Branch),
                Names.Branch.MarginGroup, Names.Branch.Country, Names.Branch.StateProvince, Names.Branch.DefaultUseTax, Names.Branch.DefaultFreight);
            loaded.MarginGroup = branch?.GetAttributeValue<EntityReference>(Names.Branch.MarginGroup);

            var countryRef = est.GetAttributeValue<EntityReference>(Names.Estimate.Country)
                ?? branch?.GetAttributeValue<EntityReference>(Names.Branch.Country);
            var provinceRef = est.GetAttributeValue<EntityReference>(Names.Estimate.BuildingProvince)
                ?? branch?.GetAttributeValue<EntityReference>(Names.Branch.StateProvince);
            var province = Retrieve(s, provinceRef, Names.StateProvince.DefaultUseTax, Names.StateProvince.DefaultFreight);

            var data = ReferenceData.Get(config, today);
            Guid? countryId = countryRef == null ? (Guid?)null : countryRef.Id;
            input.Parameters = data.ParametersFor(countryId);
            input.JobSizeBands.AddRange(data.JobSizeBands);
            input.OemBandRules.AddRange(data.OemBandRules);
            input.RedundancyBands.AddRange(data.RedundancyBands);
            input.BandMatrix.AddRange(data.BandMatrix);
            input.SituationalRules.AddRange(data.SituationalRules);
            input.IncentiveRates.AddRange(data.IncentivesFor(countryId));

            var taxes = TaxDefaults.Resolve(est, province, branch, input.Parameters);
            input.UseTaxPct = taxes.UseTax;
            input.FreightPct = taxes.Freight;

            input.SellPrice = Query.Money(est, Names.Estimate.SellPrice, 0m);
            input.StatedLaborRate = Query.Money(est, Names.Estimate.StatedLaborRate, 0m);
            input.AdditionalLaborHours = Query.Dec(est, Names.Estimate.AdditionalLaborHours) ?? 0m;
            input.AdditionalMaterial = Query.Money(est, Names.Estimate.AdditionalMaterial, 0m);
            input.AdditionalMisc = Query.Money(est, Names.Estimate.AdditionalMisc, 0m);
            input.KoneSparesSalesPrice = Query.Money(est, Names.Estimate.KoneSparesSalesPrice, 0m);
            input.MarginComments = est.GetAttributeValue<string>(Names.Estimate.MarginComments);
            input.BillingPlanSelected = est.GetAttributeValue<OptionSetValue>(Names.Estimate.BillingPlan) != null;
            input.AdditionalEquipmentCount = CountAdditionalEquipment(est.GetAttributeValue<string>(Names.Estimate.AdditionalEquipmentNumbers));

            input.NationalAccount = OptionMap.Label(config, Names.Sets.YesNoUnknown, est.GetAttributeValue<OptionSetValue>(Names.Estimate.NationalAccount));
            input.Emergency = OptionMap.Label(config, Names.Sets.YesNo, est.GetAttributeValue<OptionSetValue>(Names.Estimate.Emergency));
            input.CustomerBudgeted = OptionMap.Label(config, Names.Sets.YesNo, est.GetAttributeValue<OptionSetValue>(Names.Estimate.CustomerBudgeted));
            input.PaperType = OptionMap.Label(config, Names.Sets.PaperType, est.GetAttributeValue<OptionSetValue>(Names.Estimate.PaperType));
            input.CompetingBids = OptionMap.Label(config, Names.Sets.CompetingBids, est.GetAttributeValue<OptionSetValue>(Names.Estimate.CompetingBids));

            var jobType = Retrieve(s, est.GetAttributeValue<EntityReference>(Names.Estimate.JobType), Names.JobType.Rating);
            input.JobTypeRating = jobType == null ? null
                : OptionMap.Label(config, Names.Sets.JobTypeRating, jobType.GetAttributeValue<OptionSetValue>(Names.JobType.Rating));

            var equipmentType = Retrieve(s, est.GetAttributeValue<EntityReference>(Names.Estimate.EquipmentType), Names.EquipmentType.FixedTargetCmii);
            input.FixedTargetCmii = equipmentType == null ? null : Query.Dec(equipmentType, Names.EquipmentType.FixedTargetCmii);

            input.MechanicLaborRate = LookupMechanicRate(config, est, today);

            if (est.Id != Guid.Empty)
            {
                LoadEquipment(s, config, est, loaded);
                LoadPackages(s, config, est, loaded);
                if (loaded.IsCustomPath) throw new PricingException("RE-140", "CUSTOM_PATH_UNAVAILABLE");
            }
            else
            {
                loaded.IsCustomPath = IsCustomByPathChoice(config, est);
                input.IsCustomPath = loaded.IsCustomPath;
                input.RedundancyCount = 1;
                loaded.RedundancyCount = 1;
            }

            if (loaded.MarginGroup != null)
            {
                var rules = Query.Active(Names.MarginRule.Entity, Names.MarginRule.QuoteType, Names.MarginRule.EquipmentBand,
                    Names.MarginRule.CustomerBand, Names.MarginRule.JobTypeBand, Names.MarginRule.TargetCm2);
                rules.Criteria.AddCondition(Names.MarginRule.Group, ConditionOperator.Equal, loaded.MarginGroup.Id);
                Query.EffectiveOn(rules, today);
                foreach (var e in Query.All(config, rules))
                {
                    input.MarginRules.Add(new MarginRuleRow
                    {
                        Id = e.Id,
                        QuoteType = OptionMap.Label(config, Names.Sets.QuoteTypeRule, e.GetAttributeValue<OptionSetValue>(Names.MarginRule.QuoteType)),
                        EquipmentBand = ReferenceData.Band(config, e, Names.MarginRule.EquipmentBand),
                        CustomerBand = ReferenceData.Band(config, e, Names.MarginRule.CustomerBand),
                        JobTypeBand = ReferenceData.Band(config, e, Names.MarginRule.JobTypeBand),
                        TargetCm2 = Query.Dec(e, Names.MarginRule.TargetCm2) ?? 0m
                    });
                }
            }

            return loaded;
        }

        /// <summary>Excel: MAX(1, equipment rows + comma-separated extras). The extras cell is skipped when blank or starts with "***".</summary>
        public static int CountAdditionalEquipment(string text)
        {
            if (string.IsNullOrWhiteSpace(text) || text.TrimStart().StartsWith("***", StringComparison.Ordinal)) return 0;
            return text.Split(',').Count(part => !string.IsNullOrWhiteSpace(part));
        }

        private static decimal LookupMechanicRate(IOrganizationService s, Entity est, DateTime today)
        {
            var branch = est.GetAttributeValue<EntityReference>(Names.Estimate.Branch);
            var time = est.GetAttributeValue<OptionSetValue>(Names.Estimate.TimeCategory);
            var role = OptionMap.Value(s, Names.Sets.LaborRole, Labels.Mechanic);
            if (branch == null || time == null || role == null)
                throw new PricingException("RE-112", "LABOR_RATE_MISSING");

            var query = Query.Active(Names.LaborRate.Entity, Names.LaborRate.HourlyCost);
            query.Criteria.AddCondition(Names.LaborRate.Branch, ConditionOperator.Equal, branch.Id);
            query.Criteria.AddCondition(Names.LaborRate.Role, ConditionOperator.Equal, role.Value);
            query.Criteria.AddCondition(Names.LaborRate.TimeCategory, ConditionOperator.Equal, time.Value);
            Query.EffectiveOn(query, today);
            query.AddOrder(Names.EffectiveFrom, OrderType.Descending);
            var rates = Query.All(s, query);
            if (rates.Count != 1 || Query.Dec(rates[0], Names.LaborRate.HourlyCost) == null)
                throw new PricingException("RE-112", "LABOR_RATE_MISSING_OR_AMBIGUOUS");
            return Query.Dec(rates[0], Names.LaborRate.HourlyCost).Value;
        }

        private static void LoadEquipment(IOrganizationService s, IOrganizationService config, Entity est, LoadedEstimate loaded)
        {
            var input = loaded.Input;
            var query = Query.Active(Names.EstimateEquipment.Entity, Names.EstimateEquipment.Sequence, Names.EstimateEquipment.IsPrimary,
                Names.EstimateEquipment.NumberSnapshot, Names.EstimateEquipment.OemSnapshot, Names.EstimateEquipment.AgeSnapshot,
                Names.EstimateEquipment.Equipment, Names.EstimateEquipment.VerticalCode, "re_functionallocation");
            query.Criteria.AddCondition(Names.ChildParentLookup, ConditionOperator.Equal, est.Id);
            var lines = Query.All(s, query);
            input.EquipmentLineCount = lines.Count;

            var primary = lines.FirstOrDefault(l => l.GetAttributeValue<bool?>(Names.EstimateEquipment.IsPrimary) == true)
                ?? lines.OrderBy(l => l.GetAttributeValue<int?>(Names.EstimateEquipment.Sequence) ?? int.MaxValue).FirstOrDefault();

            input.RedundancyCount = 1;
            if (primary == null) return;

            var master = Retrieve(s, primary.GetAttributeValue<EntityReference>(Names.EstimateEquipment.Equipment),
                Names.Equipment.SoldToNumber, Names.Equipment.FunctionalLocation);

            input.PrimaryEquipmentFound = master != null;
            input.PrimaryOem = primary.GetAttributeValue<string>(Names.EstimateEquipment.OemSnapshot);
            input.PrimaryEquipmentAge = primary.GetAttributeValue<int?>(Names.EstimateEquipment.AgeSnapshot);

            if (master != null)
            {
                var location = primary.GetAttributeValue<string>("re_functionallocation");
                if (string.IsNullOrWhiteSpace(location))
                    throw new PricingException("RE-113", "EQUIPMENT_LOCATION_REQUIRED");
                var count = Query.Active(Names.Equipment.Entity, Names.Equipment.Number);
                count.Criteria.AddCondition(Names.Equipment.FunctionalLocation, ConditionOperator.Equal, location);
                input.RedundancyCount = Math.Max(1, Query.All(s, count).Count);
            }

            var verticalRef = est.GetAttributeValue<EntityReference>(Names.Estimate.CustomerVertical);
            Entity vertical = Retrieve(s, verticalRef, Names.CustomerVertical.Band);
            if (vertical == null && !string.IsNullOrWhiteSpace(primary.GetAttributeValue<string>(Names.EstimateEquipment.VerticalCode)))
            {
                var v = Query.Active(Names.CustomerVertical.Entity, Names.CustomerVertical.Band);
                v.Criteria.AddCondition(Names.CustomerVertical.Code, ConditionOperator.Equal, primary.GetAttributeValue<string>(Names.EstimateEquipment.VerticalCode));
                vertical = Query.First(s, v);
            }
            input.VerticalBand = vertical == null ? null : ReferenceData.Band(config, vertical, Names.CustomerVertical.Band);
            loaded.VerticalBand = input.VerticalBand;

            loaded.RedundancyCount = input.RedundancyCount;
        }

        private static void LoadPackages(IOrganizationService s, IOrganizationService config, Entity est, LoadedEstimate loaded)
        {
            var input = loaded.Input;
            var query = Query.Active(Names.EstimatePackage.Entity, Names.EstimatePackage.RepairPackage,
                Names.EstimatePackage.Hours, Names.EstimatePackage.Material);
            query.Criteria.AddCondition(Names.ChildParentLookup, ConditionOperator.Equal, est.Id);

            foreach (var line in Query.All(s, query))
            {
                loaded.HasPackages = true;
                if (!line.Contains(Names.EstimatePackage.Hours) || !line.Contains(Names.EstimatePackage.Material))
                    throw new PricingException("RE-114", "PACKAGE_SNAPSHOT_MISSING");
                input.Packages.Add(new PackageInput
                {
                    MechanicHoursPerUnit = Query.Dec(line, Names.EstimatePackage.Hours).Value,
                    MaterialCostPerUnit = Query.Money(line, Names.EstimatePackage.Material).Value
                });
            }

            loaded.IsCustomPath = IsCustomByPathChoice(config, est);
            input.IsCustomPath = loaded.IsCustomPath;
        }

        private static bool IsCustomByPathChoice(IOrganizationService s, Entity est)
        {
            string label = OptionMap.Label(s, Names.Sets.EstimatePath, est.GetAttributeValue<OptionSetValue>(Names.Estimate.Path));
            return label != null && label.IndexOf(Labels.Custom, StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static Entity Retrieve(IOrganizationService s, EntityReference reference, params string[] columns)
        {
            return reference == null ? null : s.Retrieve(reference.LogicalName, reference.Id, new ColumnSet(columns));
        }
    }

    /// <summary>Use tax / freight: value on the estimate, else province, else branch, else Pricing Parameter.</summary>
    internal static class TaxDefaults
    {
        public sealed class Result
        {
            public decimal UseTax;
            public decimal Freight;
        }

        public static Result Resolve(Entity est, Entity province, Entity branch, ParameterSet parameters)
        {
            return new Result
            {
                UseTax = Query.Dec(est, Names.Estimate.UseTax)
                    ?? Query.Dec(est, Names.Estimate.UseTaxPercentage)
                    ?? (province == null ? null : Query.Dec(province, Names.StateProvince.DefaultUseTax))
                    ?? (branch == null ? null : Query.Dec(branch, Names.Branch.DefaultUseTax))
                    ?? parameters.Get(ParamCode.DefaultUseTax),
                Freight = Query.Dec(est, Names.Estimate.Freight)
                    ?? Query.Dec(est, Names.Estimate.FreightPercentage)
                    ?? (province == null ? null : Query.Dec(province, Names.StateProvince.DefaultFreight))
                    ?? (branch == null ? null : Query.Dec(branch, Names.Branch.DefaultFreight))
                    ?? parameters.Get(ParamCode.DefaultFreight)
            };
        }
    }
}
