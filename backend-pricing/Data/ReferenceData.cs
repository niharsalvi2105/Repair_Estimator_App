using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using RepairEstimator.Plugins.Infrastructure;
using RepairEstimator.Plugins.Pricing;

namespace RepairEstimator.Plugins.Data
{
    /// <summary>
    /// Small configuration tables (bands, matrices, adjustments, parameters, incentives). Read through the system
    /// service for each calculation, without a cross-environment or stale configuration cache.
    /// </summary>
    internal sealed class ReferenceData
    {
        private sealed class ParameterRow
        {
            public string Code;
            public Guid? Country;
            public decimal? Decimal;
            public string Text;
        }

        private sealed class IncentiveRow
        {
            public Guid? Country;
            public IncentiveRule Rule;
        }


        private readonly List<ParameterRow> _parameters = new List<ParameterRow>();
        private readonly List<IncentiveRow> _incentives = new List<IncentiveRow>();

        public List<JobSizeBandRule> JobSizeBands { get; } = new List<JobSizeBandRule>();
        public List<OemBandRule> OemBandRules { get; } = new List<OemBandRule>();
        public List<RedundancyBandRule> RedundancyBands { get; } = new List<RedundancyBandRule>();
        public List<BandMatrixRule> BandMatrix { get; } = new List<BandMatrixRule>();
        public List<SituationalRule> SituationalRules { get; } = new List<SituationalRule>();

        public static ReferenceData Get(IOrganizationService service, DateTime date)
        {
            return Load(service, date.Date);
        }

        public ParameterSet ParametersFor(Guid? country)
        {
            var set = new ParameterSet();
            foreach (var group in _parameters.GroupBy(p => p.Code, StringComparer.OrdinalIgnoreCase))
            {
                if (group.GroupBy(p => p.Country).Any(rows => rows.Count() > 1))
                    throw new PricingException("RE-117", "PARAMETER_AMBIGUOUS", group.Key);
                var row = group.FirstOrDefault(p => country.HasValue && p.Country == country) ?? group.FirstOrDefault(p => p.Country == null);
                if (row != null) set.Set(row.Code, row.Decimal, row.Text);
            }
            return set;
        }

        public List<IncentiveRule> IncentivesFor(Guid? country)
        {
            var specific = _incentives.Where(i => country.HasValue && i.Country == country).ToList();
            var rows = specific.Count > 0 ? specific : _incentives.Where(i => i.Country == null).ToList();
            return rows.Select(i => i.Rule).ToList();
        }

        private static ReferenceData Load(IOrganizationService s, DateTime date)
        {
            var data = new ReferenceData();

            foreach (var e in Fetch(s, date, Names.JobSizeBand.Entity, Names.JobSizeBand.QuoteType, Names.JobSizeBand.Minimum, Names.JobSizeBand.Maximum, Names.JobSizeBand.Complexity))
            {
                data.JobSizeBands.Add(new JobSizeBandRule
                {
                    Id = e.Id,
                    QuoteType = OptionMap.Label(s, Names.Sets.QuoteType, e.GetAttributeValue<OptionSetValue>(Names.JobSizeBand.QuoteType)),
                    Minimum = Query.Money(e, Names.JobSizeBand.Minimum),
                    Maximum = Query.Money(e, Names.JobSizeBand.Maximum),
                    ComplexityBand = Band(s, e, Names.JobSizeBand.Complexity)
                });
            }

            foreach (var e in Fetch(s, date, Names.OemBandRule.Entity, Names.OemBandRule.Keyword, Names.OemBandRule.Band))
            {
                data.OemBandRules.Add(new OemBandRule { Keyword = e.GetAttributeValue<string>(Names.OemBandRule.Keyword), Band = Band(s, e, Names.OemBandRule.Band) });
            }

            foreach (var e in Fetch(s, date, Names.RedundancyBand.Entity, Names.RedundancyBand.Minimum, Names.RedundancyBand.Maximum, Names.RedundancyBand.Band))
            {
                data.RedundancyBands.Add(new RedundancyBandRule
                {
                    MinimumEquipment = e.GetAttributeValue<int?>(Names.RedundancyBand.Minimum),
                    MaximumEquipment = e.GetAttributeValue<int?>(Names.RedundancyBand.Maximum),
                    Band = Band(s, e, Names.RedundancyBand.Band)
                });
            }

            foreach (var e in Fetch(s, date, Names.BandMatrix.Entity, Names.BandMatrix.Type, Names.BandMatrix.Input1, Names.BandMatrix.Input2, Names.BandMatrix.Result))
            {
                data.BandMatrix.Add(new BandMatrixRule
                {
                    MatrixType = OptionMap.Label(s, Names.Sets.BandMatrixType, e.GetAttributeValue<OptionSetValue>(Names.BandMatrix.Type)),
                    Input1 = Band(s, e, Names.BandMatrix.Input1),
                    Input2 = Band(s, e, Names.BandMatrix.Input2),
                    Result = Band(s, e, Names.BandMatrix.Result)
                });
            }

            foreach (var e in Fetch(s, date, Names.SituationalAdjustment.Entity, Names.SituationalAdjustment.Type, Names.SituationalAdjustment.InputValue,
                Names.SituationalAdjustment.Adjustment, Names.SituationalAdjustment.IsApplied, Names.SituationalAdjustment.RequiresPaperType))
            {
                data.SituationalRules.Add(new SituationalRule
                {
                    Type = OptionMap.Label(s, Names.Sets.AdjustmentType, e.GetAttributeValue<OptionSetValue>(Names.SituationalAdjustment.Type)),
                    InputValue = e.GetAttributeValue<string>(Names.SituationalAdjustment.InputValue),
                    Adjustment = Query.Dec(e, Names.SituationalAdjustment.Adjustment) ?? 0m,
                    IsApplied = e.GetAttributeValue<bool?>(Names.SituationalAdjustment.IsApplied) ?? true,
                    RequiresPaperType = OptionMap.Label(s, Names.Sets.PaperType, e.GetAttributeValue<OptionSetValue>(Names.SituationalAdjustment.RequiresPaperType))
                });
            }

            foreach (var e in Fetch(s, date, Names.PricingParameter.Entity, Names.PricingParameter.Code, Names.PricingParameter.Country,
                Names.PricingParameter.DecimalValue, Names.PricingParameter.TextValue))
            {
                var country = e.GetAttributeValue<EntityReference>(Names.PricingParameter.Country);
                data._parameters.Add(new ParameterRow
                {
                    Code = e.GetAttributeValue<string>(Names.PricingParameter.Code),
                    Country = country == null ? (Guid?)null : country.Id,
                    Decimal = Query.Dec(e, Names.PricingParameter.DecimalValue),
                    Text = e.GetAttributeValue<string>(Names.PricingParameter.TextValue)
                });
            }

            foreach (var e in Fetch(s, date, Names.IncentiveRate.Entity, Names.IncentiveRate.Country, Names.IncentiveRate.MinimumCmii,
                Names.IncentiveRate.AmPayout, Names.IncentiveRate.BdPayout))
            {
                var country = e.GetAttributeValue<EntityReference>(Names.IncentiveRate.Country);
                data._incentives.Add(new IncentiveRow
                {
                    Country = country == null ? (Guid?)null : country.Id,
                    Rule = new IncentiveRule
                    {
                        MinimumCmii = Query.Dec(e, Names.IncentiveRate.MinimumCmii) ?? 0m,
                        AmPayout = Query.Dec(e, Names.IncentiveRate.AmPayout) ?? 0m,
                        BdPayout = Query.Dec(e, Names.IncentiveRate.BdPayout) ?? 0m
                    }
                });
            }

            return data;
        }

        private static List<Entity> Fetch(IOrganizationService s, DateTime date, string entity, params string[] columns)
        {
            var query = Query.Active(entity, columns);
            Query.EffectiveOn(query, date);
            return Query.All(s, query);
        }

        internal static string Band(IOrganizationService s, Entity e, string attribute)
        {
            return OptionMap.Label(s, Names.Sets.PricingBand, e.GetAttributeValue<OptionSetValue>(attribute));
        }
    }
}
