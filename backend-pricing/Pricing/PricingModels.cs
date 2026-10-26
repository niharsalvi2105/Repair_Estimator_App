using System;
using System.Collections.Generic;

namespace RepairEstimator.Plugins.Pricing
{
    /// <summary>Business or configuration error raised by the pricing engine. Code is the "RE-nnn" part, Key the translatable part.</summary>
    public sealed class PricingException : Exception
    {
        public string Code { get; }
        public string Key { get; }

        public PricingException(string code, string key, string detail = null)
            : base(detail == null ? code + "|" + key : code + "|" + key + ": " + detail)
        {
            Code = code;
            Key = key;
        }
    }

    /// <summary>Band labels are the English option labels of the re_pricingband choice (High / Medium / Low).</summary>
    public static class Band
    {
        public const string High = "High";
        public const string Medium = "Medium";
        public const string Low = "Low";
    }

    public static class QuoteType
    {
        public const string QQ = "QQ";
        public const string QR = "QR";
    }

    public static class ApprovalLevel
    {
        public const string None = "None";
        public const string District = "District";
        public const string Regional = "Regional";
    }

    public static class MatrixType
    {
        public const string Equipment = "Equipment";
        public const string JobType = "Job Type";
        public const string CustomerBase = "Customer Base";
        public const string CustomerFinal = "Customer Final";
    }

    public static class ParamCode
    {
        public const string MedianQrMargin = "MEDIAN_QR_MARGIN";
        public const string QqThreshold = "QQ_THRESHOLD";
        public const string AgeThreshold = "AGE_THRESHOLD";
        public const string MaterialMarginFloor = "MATERIAL_MARGIN_FLOOR";
        public const string DefaultUseTax = "DEFAULT_USE_TAX";
        public const string DefaultFreight = "DEFAULT_FREIGHT";
        public const string KoneSparesTax = "KONE_SPARES_TAX";
        public const string KoneSparesFreight = "KONE_SPARES_FREIGHT";
        public const string KoneSparesMarkup = "KONE_SPARES_MARKUP";
        public const string DownPaymentThreshold = "DOWN_PAYMENT_THRESHOLD";
        public const string ApprovalDistrict = "APPROVAL_DISTRICT";
        public const string ApprovalRegional = "APPROVAL_REGIONAL";
        public const string OemDefaultBand = "OEM_DEFAULT_BAND";
    }

    /// <summary>Pricing Parameter values keyed by code. The loader resolves country-specific rows over global rows.</summary>
    public sealed class ParameterSet
    {
        private readonly Dictionary<string, decimal> _decimals = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string> _texts = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        public void Set(string code, decimal? decimalValue, string textValue)
        {
            if (decimalValue.HasValue) _decimals[code] = decimalValue.Value;
            if (!string.IsNullOrWhiteSpace(textValue)) _texts[code] = textValue.Trim();
        }

        public bool Has(string code) => _decimals.ContainsKey(code);

        public decimal Get(string code)
        {
            decimal value;
            if (!_decimals.TryGetValue(code, out value))
                throw new PricingException("RE-110", "PARAMETER_MISSING", code);
            return value;
        }

        public decimal GetOrDefault(string code, decimal fallback)
        {
            decimal value;
            return _decimals.TryGetValue(code, out value) ? value : fallback;
        }

        public string GetText(string code, string fallback)
        {
            string value;
            return _texts.TryGetValue(code, out value) ? value : fallback;
        }
    }

    public sealed class JobSizeBandRule
    {
        public Guid Id { get; set; }
        public string QuoteType { get; set; }
        public decimal? Minimum { get; set; }
        public decimal? Maximum { get; set; }
        public string ComplexityBand { get; set; }
    }

    public sealed class OemBandRule
    {
        public string Keyword { get; set; }
        public string Band { get; set; }
    }

    public sealed class RedundancyBandRule
    {
        public int? MinimumEquipment { get; set; }
        public int? MaximumEquipment { get; set; }
        public string Band { get; set; }
    }

    public sealed class BandMatrixRule
    {
        public string MatrixType { get; set; }
        public string Input1 { get; set; }
        public string Input2 { get; set; }
        public string Result { get; set; }
    }

    public sealed class MarginRuleRow
    {
        public Guid Id { get; set; }
        public string QuoteType { get; set; }
        public string EquipmentBand { get; set; }
        public string CustomerBand { get; set; }
        public string JobTypeBand { get; set; }
        public decimal TargetCm2 { get; set; }
    }

    public sealed class SituationalRule
    {
        /// <summary>Adjustment type label, e.g. "Emergency", "Customer Budgeted", "Paper Type", "Competing Bids".</summary>
        public string Type { get; set; }
        public string InputValue { get; set; }
        public decimal Adjustment { get; set; }
        public bool IsApplied { get; set; }
        public string RequiresPaperType { get; set; }
    }

    public sealed class IncentiveRule
    {
        public decimal MinimumCmii { get; set; }
        public decimal AmPayout { get; set; }
        public decimal BdPayout { get; set; }
    }

    public sealed class LaborLineInput
    {
        public decimal Hours { get; set; }
        public decimal? Rate { get; set; }
        public decimal? Multiplier { get; set; }
    }

    public sealed class MaterialLineInput
    {
        public decimal Quantity { get; set; }
        public decimal UnitCost { get; set; }
        public bool TaxApplicable { get; set; }
        public bool FreightApplicable { get; set; }
        public string Vendor { get; set; }
        public string PartNumber { get; set; }
    }

    public sealed class PackageInput
    {
        public decimal MechanicHoursPerUnit { get; set; }
        /// <summary>Total material, misc and tax cost per unit (Quote sheet column G).</summary>
        public decimal MaterialCostPerUnit { get; set; }
    }

    public sealed class EstimateInput
    {
        // Equipment
        public int EquipmentLineCount { get; set; }
        public int AdditionalEquipmentCount { get; set; }
        public bool PrimaryEquipmentFound { get; set; }
        public string PrimaryOem { get; set; }
        public int? PrimaryEquipmentAge { get; set; }
        public int RedundancyCount { get; set; }

        // Customer / job profile
        public string VerticalBand { get; set; }
        public string NationalAccount { get; set; }
        public string JobTypeRating { get; set; }
        public decimal? FixedTargetCmii { get; set; }

        // Costs
        public bool IsCustomPath { get; set; }
        public decimal MechanicLaborRate { get; set; }
        public decimal UseTaxPct { get; set; }
        public decimal FreightPct { get; set; }
        public List<PackageInput> Packages { get; } = new List<PackageInput>();
        public decimal AdditionalLaborHours { get; set; }
        public decimal AdditionalMaterial { get; set; }
        public decimal AdditionalMisc { get; set; }
        public List<LaborLineInput> LaborLines { get; } = new List<LaborLineInput>();
        public List<MaterialLineInput> MaterialLines { get; } = new List<MaterialLineInput>();
        public decimal KoneSparesSalesPrice { get; set; }

        // Pricing inputs
        public decimal SellPrice { get; set; }
        public decimal StatedLaborRate { get; set; }
        public string Emergency { get; set; }
        public string CustomerBudgeted { get; set; }
        public string PaperType { get; set; }
        public string CompetingBids { get; set; }

        // Submit validation inputs
        public string MarginComments { get; set; }
        public bool BillingPlanSelected { get; set; }

        // Reference data
        public ParameterSet Parameters { get; set; } = new ParameterSet();
        public List<JobSizeBandRule> JobSizeBands { get; } = new List<JobSizeBandRule>();
        public List<OemBandRule> OemBandRules { get; } = new List<OemBandRule>();
        public List<RedundancyBandRule> RedundancyBands { get; } = new List<RedundancyBandRule>();
        public List<BandMatrixRule> BandMatrix { get; } = new List<BandMatrixRule>();
        public List<MarginRuleRow> MarginRules { get; } = new List<MarginRuleRow>();
        public List<SituationalRule> SituationalRules { get; } = new List<SituationalRule>();
        public List<IncentiveRule> IncentiveRates { get; } = new List<IncentiveRule>();
    }

    public sealed class PricingResult
    {
        public int NumberOfEquipment { get; set; }
        public decimal MechanicLaborRate { get; set; }

        public decimal PackageLaborHours { get; set; }
        public decimal PackageLaborCost { get; set; }
        public decimal PackageMaterialCost { get; set; }
        public decimal PackageEstimatedCost { get; set; }
        public decimal AdditionalLaborCost { get; set; }
        public decimal UseTaxAmount { get; set; }
        public decimal FreightAmount { get; set; }
        public decimal TotalAdditionalCost { get; set; }
        public decimal CustomLaborCost { get; set; }
        public decimal CustomMaterialCost { get; set; }
        public decimal KoneMaterialCost { get; set; }
        public decimal LaborCost { get; set; }
        public decimal MaterialCost { get; set; }
        public decimal MiscellaneousCost { get; set; }
        public decimal TotalTrueCost { get; set; }

        public decimal MedianMarginSellPrice { get; set; }
        public string QuoteType { get; set; }
        public Guid? JobSizeBandId { get; set; }
        public string JobSizeComplexityBand { get; set; }
        public string OemBand { get; set; }
        public string EquipmentAgeBand { get; set; }
        public string EquipmentBand { get; set; }
        public string RedundancyBand { get; set; }
        public string CustomerBaseBand { get; set; }
        public string NationalAccountBand { get; set; }
        public string CustomerBand { get; set; }
        public string JobTypeRating { get; set; }
        public string JobTypeBand { get; set; }

        public Guid? MarginRuleId { get; set; }
        public decimal? BaseTargetCm2 { get; set; }
        public decimal SituationalAdjustment { get; set; }
        public decimal? TargetCm2 { get; set; }
        public decimal? StatedRateMargin { get; set; }
        public decimal? RecommendedCmii { get; set; }
        public decimal? SuggestedPrice { get; set; }
        public decimal? SuggestedPriceWithKoneMaterial { get; set; }

        public decimal? ActualCmii { get; set; }
        public decimal? CmiiVariance { get; set; }
        public decimal AmIncentive { get; set; }
        public decimal BdIncentive { get; set; }
        public string ApprovalLevel { get; set; }

        public List<string> Warnings { get; } = new List<string>();
    }
}
