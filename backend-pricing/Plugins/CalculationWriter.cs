using System;
using Microsoft.Xrm.Sdk;
using RepairEstimator.Plugins.Data;
using RepairEstimator.Plugins.Infrastructure;
using RepairEstimator.Plugins.Pricing;

namespace RepairEstimator.Plugins.Plugins
{
    /// <summary>Copies a PricingResult onto the estimate being saved. Unavailable results are written as null so stale values never linger.</summary>
    internal static class CalculationWriter
    {
        public static void Write(IOrganizationService s, Entity t, LoadedEstimate loaded, PricingResult r)
        {
            var input = loaded.Input;

            t[Names.Estimate.NumberOfEquipment] = r.NumberOfEquipment;
            t[Names.Estimate.MechanicLaborRate] = new Money(r.MechanicLaborRate);
            t[Names.Estimate.UseTax] = input.UseTaxPct;
            t[Names.Estimate.UseTaxPercentage] = input.UseTaxPct;
            t[Names.Estimate.Freight] = input.FreightPct;
            t[Names.Estimate.FreightPercentage] = input.FreightPct;

            t[Names.Estimate.PackageLaborHours] = r.PackageLaborHours;
            t[Names.Estimate.PackageLaborCost] = new Money(r.PackageLaborCost);
            t[Names.Estimate.PackageMaterialCost] = new Money(r.PackageMaterialCost);
            t[Names.Estimate.PackageEstimatedCost] = new Money(r.PackageEstimatedCost);
            t[Names.Estimate.AdditionalLaborCost] = new Money(r.AdditionalLaborCost);
            t[Names.Estimate.UseTaxAmount] = new Money(r.UseTaxAmount);
            t[Names.Estimate.FreightAmount] = new Money(r.FreightAmount);
            t[Names.Estimate.TotalAdditionalCost] = new Money(r.TotalAdditionalCost);
            t[Names.Estimate.CustomLaborCost] = new Money(r.CustomLaborCost);
            t[Names.Estimate.CustomMaterialCost] = new Money(r.CustomMaterialCost);
            t[Names.Estimate.KoneMaterialCost] = new Money(r.KoneMaterialCost);
            t[Names.Estimate.LaborCost] = new Money(r.LaborCost);
            t[Names.Estimate.MaterialCost] = new Money(r.MaterialCost);
            t[Names.Estimate.MiscellaneousCost] = new Money(r.MiscellaneousCost);
            t[Names.Estimate.TotalTrueCost] = new Money(r.TotalTrueCost);
            t[Names.Estimate.MedianMarginSellPrice] = new Money(r.MedianMarginSellPrice);

            t[Names.Estimate.QuoteType] = OptionMap.Value(s, Names.Sets.QuoteType, r.QuoteType);
            t[Names.Estimate.JobSizeBand] = r.JobSizeBandId.HasValue ? new EntityReference(Names.JobSizeBand.Entity, r.JobSizeBandId.Value) : null;
            t[Names.Estimate.OemBand] = Band(s, r.OemBand);
            t[Names.Estimate.EquipmentAgeBand] = Band(s, r.EquipmentAgeBand);
            t[Names.Estimate.EquipmentBand] = Band(s, r.EquipmentBand);
            t[Names.Estimate.VerticalBand] = Band(s, string.IsNullOrWhiteSpace(loaded.VerticalBand) ? null : loaded.VerticalBand);
            t[Names.Estimate.RedundancyBand] = Band(s, r.RedundancyBand);
            t[Names.Estimate.RedundancyCount] = loaded.RedundancyCount;
            t[Names.Estimate.CustomerBaseBand] = Band(s, r.CustomerBaseBand);
            t[Names.Estimate.NationalAccountBand] = Band(s, r.NationalAccountBand);
            t[Names.Estimate.CustomerBand] = Band(s, r.CustomerBand);
            t[Names.Estimate.JobTypeRating] = Band(s, r.JobTypeRating);
            t[Names.Estimate.JobTypeBand] = Band(s, r.JobTypeBand);
            t[Names.Estimate.PrimaryEquipmentFound] = OptionMap.Value(s, Names.Sets.YesNo, input.PrimaryEquipmentFound ? "Yes" : "No");

            t[Names.Estimate.MarginGroup] = loaded.MarginGroup;
            t[Names.Estimate.MarginRule] = r.MarginRuleId.HasValue ? new EntityReference(Names.MarginRule.Entity, r.MarginRuleId.Value) : null;
            t[Names.Estimate.BaseTargetCm2] = r.BaseTargetCm2;
            t[Names.Estimate.BaseTargetCmii] = r.BaseTargetCm2;
            t[Names.Estimate.SituationalAdjustment] = r.SituationalAdjustment;
            t[Names.Estimate.TotalAdjustment] = r.SituationalAdjustment;
            t[Names.Estimate.TargetCm2] = r.TargetCm2;
            t[Names.Estimate.AdjustedTargetCmii] = r.TargetCm2;
            t[Names.Estimate.StatedRateMargin] = r.StatedRateMargin;
            t[Names.Estimate.RecommendedCmii] = r.RecommendedCmii;

            t[Names.Estimate.SuggestedPrice] = r.SuggestedPrice.HasValue ? new Money(r.SuggestedPrice.Value) : null;
            t[Names.Estimate.SuggestedSellPrice] = r.SuggestedPrice.HasValue ? new Money(r.SuggestedPrice.Value) : null;
            t[Names.Estimate.SuggestedPriceKoneMaterial] = r.SuggestedPriceWithKoneMaterial.HasValue ? new Money(r.SuggestedPriceWithKoneMaterial.Value) : null;

            t[Names.Estimate.ActualCmii] = r.ActualCmii;
            t[Names.Estimate.CmiiVariance] = r.CmiiVariance;
            t[Names.Estimate.AmIncentive] = new Money(r.AmIncentive);
            t[Names.Estimate.BdIncentive] = new Money(r.BdIncentive);
            t[Names.Estimate.ApprovalLevel] = OptionMap.Value(s, Names.Sets.ApprovalLevel, r.ApprovalLevel);
            t[Names.Estimate.RequiresApproval] = r.ApprovalLevel != ApprovalLevel.None;

            if (loaded.HasPackages)
                t[Names.Estimate.Path] = OptionMap.ValueContaining(s, Names.Sets.EstimatePath, loaded.IsCustomPath ? Labels.Custom : Labels.Standard);

            t[Names.Estimate.CalculatedOn] = DateTime.UtcNow;
            t[Names.Estimate.CalculationVersion] = PricingEngine.Version;
        }

        public static void Clear(Entity target)
        {
            foreach (var name in OutputFields) target[name] = null;
            target[Names.Estimate.CalculatedOn] = null;
            target[Names.Estimate.CalculationVersion] = "unavailable";
        }

        private static readonly System.Collections.Generic.HashSet<string> OutputFields =
            new System.Collections.Generic.HashSet<string> {
                Names.Estimate.MechanicLaborRate, Names.Estimate.PackageLaborHours, Names.Estimate.PackageLaborCost,
                Names.Estimate.PackageMaterialCost, Names.Estimate.PackageEstimatedCost, Names.Estimate.AdditionalLaborCost,
                Names.Estimate.UseTaxAmount, Names.Estimate.FreightAmount, Names.Estimate.TotalAdditionalCost,
                Names.Estimate.CustomLaborCost, Names.Estimate.CustomMaterialCost, Names.Estimate.KoneMaterialCost,
                Names.Estimate.LaborCost, Names.Estimate.MaterialCost, Names.Estimate.MiscellaneousCost, Names.Estimate.TotalTrueCost,
                Names.Estimate.MedianMarginSellPrice, Names.Estimate.QuoteType, Names.Estimate.JobSizeBand, Names.Estimate.OemBand,
                Names.Estimate.EquipmentAgeBand, Names.Estimate.EquipmentBand, Names.Estimate.VerticalBand,
                Names.Estimate.RedundancyBand, Names.Estimate.RedundancyCount, Names.Estimate.CustomerBaseBand,
                Names.Estimate.NationalAccountBand, Names.Estimate.CustomerBand, Names.Estimate.JobTypeRating,
                Names.Estimate.JobTypeBand, Names.Estimate.PrimaryEquipmentFound, Names.Estimate.MarginGroup, Names.Estimate.MarginRule,
                Names.Estimate.BaseTargetCm2, Names.Estimate.BaseTargetCmii, Names.Estimate.SituationalAdjustment,
                Names.Estimate.TotalAdjustment, Names.Estimate.TargetCm2, Names.Estimate.AdjustedTargetCmii,
                Names.Estimate.StatedRateMargin, Names.Estimate.RecommendedCmii, Names.Estimate.SuggestedPrice,
                Names.Estimate.SuggestedSellPrice, Names.Estimate.SuggestedPriceKoneMaterial, Names.Estimate.ActualCmii,
                Names.Estimate.CmiiVariance, Names.Estimate.AmIncentive, Names.Estimate.BdIncentive,
                Names.Estimate.ApprovalLevel, Names.Estimate.RequiresApproval, "re_cmiiwithkonematerial"
            };
        private static OptionSetValue Band(IOrganizationService s, string label)
        {
            return label == null ? null : OptionMap.Value(s, Names.Sets.PricingBand, label);
        }
    }
}
