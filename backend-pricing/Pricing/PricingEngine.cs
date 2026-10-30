using System;
using System.Collections.Generic;
using System.Linq;

namespace RepairEstimator.Plugins.Pricing
{
    /// <summary>
    /// Calculation Rules engine without Dataverse dependencies. Synthetic cases test formulas, not workbook parity.
    /// Missing or invalid configuration yields warnings or PricingException; the plug-in controls draft recovery.
    /// </summary>
    public static class PricingEngine
    {
        public const string Version = "2026.5";

        public static PricingResult Calculate(EstimateInput i)
        {
            var itemizedKone = i.MaterialLines.Where(m => m.IsKone == true && !m.IsPackageReference).ToList();
            var packageKone = i.Packages.Where(x => x.PackagePricedKone).ToList();
            if (packageKone.Any(x => !x.IsCustom || !x.MaterialBeforeMarkup.HasValue || x.MaterialBeforeMarkup < 0) ||
                (packageKone.Count == 0 && i.MaterialLines.Any(m => m.IsPackageReference)) ||
                (packageKone.Count > 0 && (!i.IsCustomPath || i.KoneSparesSalesPrice > 0 || itemizedKone.Count > 0 ||
                    i.MaterialLines.Any(m => !m.IsKone.HasValue && IsKoneMaterial(m)))) ||
                i.MaterialLines.Any(m => m.IsPackageReference && (m.IsKone != true || m.UnitCost != 0 ||
                    m.UnitSellingPrice.HasValue || m.MarkupPercent.HasValue || m.TaxApplicable || m.FreightApplicable)))
                throw new PricingException("RE-111", "PRICING_INPUT_INVALID");
            if (itemizedKone.Any(m => !m.UnitSellingPrice.HasValue || m.UnitSellingPrice <= 0 ||
                !m.MarkupPercent.HasValue || m.MarkupPercent < 0 || m.MarkupPercent > 100 ||
                decimal.Round(m.MarkupPercent.Value, 2) != m.MarkupPercent.Value) ||
                i.MaterialLines.Any(m => m.IsKone == false && m.MarkupPercent.HasValue) ||
                (itemizedKone.Count > 0 && (i.KoneSparesSalesPrice > 0 ||
                    i.MaterialLines.Any(m => !m.IsKone.HasValue && IsKoneMaterial(m)))))
                throw new PricingException("RE-111", "PRICING_INPUT_INVALID");
            var r = new PricingResult();
            var p = i.Parameters;
            if (i.MechanicLaborRate < 0 || i.UseTaxPct < 0 || i.UseTaxPct > 1 || i.FreightPct < 0 || i.FreightPct > 1 ||
                i.Packages.Any(x => x.MechanicHoursPerUnit < 0 || x.MaterialCostPerUnit < 0) ||
                i.AdditionalLaborHours < 0 || i.AdditionalMaterial < 0 || i.AdditionalMisc < 0 ||
                i.KoneSparesSalesPrice < 0 ||
                i.LaborLines.Any(x => x.Hours < 0 || x.Rate < 0 || x.Multiplier < 0) ||
                i.MaterialLines.Any(x => x.Quantity < 0 || x.UnitCost < 0))
                throw new PricingException("RE-111", "PRICING_INPUT_INVALID");

            r.NumberOfEquipment = Math.Max(1, i.EquipmentLineCount + i.AdditionalEquipmentCount);
            r.MechanicLaborRate = i.MechanicLaborRate;

            CalculateCost(i, r);

            // Steps 11-12: median price and quote type
            decimal medianMargin = p.Get(ParamCode.MedianQrMargin);
            if (medianMargin < 0m || medianMargin >= 1m) throw new PricingException("RE-111", "PARAMETER_INVALID", ParamCode.MedianQrMargin);
            r.MedianMarginSellPrice = R2(r.TotalTrueCost / (1m - medianMargin));
            decimal median = r.TotalTrueCost / (1m - medianMargin);
            r.QuoteType = r.TotalTrueCost == 0m || median >= p.Get(ParamCode.QqThreshold) ? QuoteType.QR : QuoteType.QQ;

            // Step 13: job size band (QR bands drive complexity, as in the Excel)
            var sizes = i.JobSizeBands
                .Where(b => Same(b.QuoteType, QuoteType.QR))
                .Where(b => (b.Minimum ?? 0m) <= median && (!b.Maximum.HasValue || median < b.Maximum.Value)).ToList();
            if (sizes.Count > 1) throw new PricingException("RE-117", "JOB_SIZE_BAND_AMBIGUOUS");
            var size = sizes.SingleOrDefault();
            r.JobSizeBandId = size?.Id;
            r.JobSizeComplexityBand = size?.ComplexityBand ?? Band.High;
            if (size == null) r.Warnings.Add("No Job Size Band matched; complexity defaulted to High.");

            // Steps 14-16: equipment band
            r.OemBand = ResolveOemBand(i);
            r.EquipmentAgeBand = i.PrimaryEquipmentAge.HasValue && i.PrimaryEquipmentAge.Value >= p.Get(ParamCode.AgeThreshold)
                ? Band.High : Band.Low;
            r.EquipmentBand = !i.PrimaryEquipmentFound
                ? Band.High
                : Matrix(i, r, MatrixType.Equipment, r.OemBand, r.EquipmentAgeBand);

            // Steps 17-21: customer band
            string verticalBand = string.IsNullOrWhiteSpace(i.VerticalBand) ? Band.Low : i.VerticalBand;
            r.RedundancyBand = ResolveRedundancyBand(i, r);
            r.CustomerBaseBand = Matrix(i, r, MatrixType.CustomerBase, verticalBand, r.RedundancyBand);
            r.NationalAccountBand = Same(i.NationalAccount, "Yes") ? Band.Low : Band.High;
            r.CustomerBand = !i.PrimaryEquipmentFound
                ? Band.Medium
                : Matrix(i, r, MatrixType.CustomerFinal, r.CustomerBaseBand, r.NationalAccountBand);

            // Steps 22-23: job type band
            r.JobTypeRating = string.IsNullOrWhiteSpace(i.JobTypeRating) ? Band.Medium : i.JobTypeRating;
            r.JobTypeBand = Matrix(i, r, MatrixType.JobType, r.JobTypeRating, r.JobSizeComplexityBand);

            // Steps 24-26: target CM2
            var rule = FindMarginRule(i, r);
            r.MarginRuleId = rule?.Id;
            r.BaseTargetCm2 = rule?.TargetCm2;
            if (rule == null) r.Warnings.Add("No Margin Rule matched; recommended CMII not calculated.");
            r.SituationalAdjustment = SituationalAdjustment(i, r);
            r.TargetCm2 = r.BaseTargetCm2.HasValue ? r.BaseTargetCm2 + r.SituationalAdjustment : null;

            // Steps 27-28: recommended CMII
            r.StatedRateMargin = i.StatedLaborRate > 0m ? StatedRateMargin(i, r) : (decimal?)null;
            if (i.StatedLaborRate > 0m) r.RecommendedCmii = r.StatedRateMargin;
            else if (i.FixedTargetCmii.HasValue) r.RecommendedCmii = i.FixedTargetCmii;
            else r.RecommendedCmii = r.TargetCm2;
            if (r.RecommendedCmii.HasValue && (r.RecommendedCmii < 0 || r.RecommendedCmii >= 1))
                throw new PricingException("RE-111", "MARGIN_INVALID");

            // Step 29: suggested price
            if (r.RecommendedCmii.HasValue && r.RecommendedCmii.Value < 1m)
            {
                decimal rec = r.RecommendedCmii.Value;
                r.SuggestedPrice = R2(r.TotalTrueCost / (1m - rec));
                if (i.IsCustomPath && (i.KoneSparesSalesPrice > 0m || itemizedKone.Count > 0 || packageKone.Count > 0))
                {
                    var selling = packageKone.Count > 0
                        ? packageKone.Sum(x => x.MaterialCostPerUnit) * r.NumberOfEquipment
                        : itemizedKone.Count > 0
                        ? itemizedKone.Sum(m => m.Quantity * m.UnitSellingPrice.Value *
                            (1m + p.Get(ParamCode.KoneSparesTax) + p.Get(ParamCode.KoneSparesFreight) + m.MarkupPercent.Value / 100m))
                        : i.KoneSparesSalesPrice * (1m + p.Get(ParamCode.KoneSparesTax) +
                            p.Get(ParamCode.KoneSparesFreight) + p.Get(ParamCode.KoneSparesMarkup));
                    r.SuggestedPriceWithKoneMaterial = R2((r.TotalTrueCost - r.KoneMaterialCost) / (1m - rec) + selling);
                }
            }

            // Steps 30-31: actual CMII and variance
            if (i.SellPrice > 0m)
            {
                r.ActualCmii = Math.Round((i.SellPrice - r.TotalTrueCost) / i.SellPrice, 4, MidpointRounding.AwayFromZero);
                if (r.RecommendedCmii.HasValue) r.CmiiVariance = r.ActualCmii - r.RecommendedCmii;
            }

            // Step 32: incentives
            if (r.ActualCmii.HasValue)
            {
                var incentive = i.IncentiveRates
                    .Where(x => x.MinimumCmii <= r.ActualCmii.Value)
                    .OrderByDescending(x => x.MinimumCmii)
                    .FirstOrDefault();
                if (incentive != null)
                {
                    r.AmIncentive = Math.Round(i.SellPrice * incentive.AmPayout, 0, MidpointRounding.AwayFromZero);
                    r.BdIncentive = Math.Round(i.SellPrice * incentive.BdPayout, 0, MidpointRounding.AwayFromZero);
                }
                else if (!(r.ActualCmii.Value < 0m && i.IncentiveRates.Any(x =>
                    x.MinimumCmii == 0m && x.AmPayout == 0m && x.BdPayout == 0m)))
                    r.Warnings.Add("No Incentive Rate matched the actual CMII.");
            }

            // Step 33: approval level
            r.ApprovalLevel = i.SellPrice >= p.Get(ParamCode.ApprovalRegional) ? Pricing.ApprovalLevel.Regional
                : i.SellPrice >= p.Get(ParamCode.ApprovalDistrict) ? Pricing.ApprovalLevel.District
                : Pricing.ApprovalLevel.None;

            return r;
        }

        /// <summary>Step 34. Returns the error keys (without the RE-nnn prefix) that must block submission.</summary>
        public static List<string> Validate(EstimateInput i, PricingResult r)
        {
            var errors = new List<string>();
            if (i.SellPrice <= 0m) errors.Add("RE-100|SELL_PRICE_REQUIRED");
            if (!r.RecommendedCmii.HasValue || !r.SuggestedPrice.HasValue ||
                r.RecommendedCmii < 0 || r.RecommendedCmii >= 1)
                errors.Add("RE-102|PRICING_NOT_AVAILABLE");
            if (r.CmiiVariance.HasValue && r.CmiiVariance.Value < 0m && string.IsNullOrWhiteSpace(i.MarginComments))
                errors.Add("RE-101|MARGIN_COMMENT_REQUIRED");
            if (i.SellPrice > i.Parameters.Get(ParamCode.DownPaymentThreshold) && !i.BillingPlanSelected)
                errors.Add("RE-103|BILLING_PLAN_REQUIRED");
            return errors;
        }

        private static void CalculateCost(EstimateInput i, PricingResult r)
        {
            decimal rate = i.MechanicLaborRate;
            decimal tax = i.IsCustomPath ? i.UseTaxPct : EstimateInput.StandardUseTax;
            decimal freight = i.IsCustomPath ? i.FreightPct : EstimateInput.StandardFreight;
            decimal markup = 1m + tax + freight;

            // Package costs scale by equipment; custom lines and additions are estimate-level.
            decimal hours = i.Packages.Sum(x => x.MechanicHoursPerUnit) * r.NumberOfEquipment;
            decimal packageKone = i.Packages.Where(x => x.PackagePricedKone).Sum(x => x.MaterialBeforeMarkup.Value) * r.NumberOfEquipment;
            decimal customPackageMaterial = i.Packages.Where(x => x.IsCustom && !x.PackagePricedKone).Sum(x => x.MaterialCostPerUnit) * r.NumberOfEquipment;
            decimal standardPackageMaterial = i.Packages.Where(x => !x.IsCustom).Sum(x => x.MaterialCostPerUnit) * r.NumberOfEquipment;
            decimal packageMaterial = standardPackageMaterial + customPackageMaterial + packageKone;
            decimal packageTax = standardPackageMaterial * EstimateInput.StandardUseTax + customPackageMaterial * tax;
            decimal packageFreight = standardPackageMaterial * EstimateInput.StandardFreight + customPackageMaterial * freight;
            decimal packageLabor = hours * rate;
            decimal additionalLabor = i.AdditionalLaborHours * rate;
            decimal labor = i.IsCustomPath ? i.LaborLines.Sum(l => l.Hours * (l.Rate ?? rate) * (l.Multiplier ?? 1m)) : 0m;
            decimal materialBase = 0m, materialMarked = 0m, koneMarked = 0m, taxBase = 0m, freightBase = 0m;
            foreach (var m in i.IsCustomPath ? i.MaterialLines : Enumerable.Empty<MaterialLineInput>())
            {
                decimal extended = m.Quantity * m.UnitCost;
                decimal marked = extended * (1m + (m.TaxApplicable ? tax : 0m) + (m.FreightApplicable ? freight : 0m));
                materialBase += extended;
                materialMarked += marked;
                if (m.TaxApplicable) taxBase += extended;
                if (m.FreightApplicable) freightBase += extended;
                if (IsKoneMaterial(m)) koneMarked += marked;
            }
            decimal misc = i.AdditionalMisc;
            decimal totalAdditional = additionalLabor + labor + materialMarked + (i.AdditionalMaterial + misc) * markup;
            decimal packageEstimated = packageLabor + packageMaterial + packageTax + packageFreight;
            r.PackageLaborHours = hours;
            r.PackageLaborCost = R2(packageLabor);
            r.PackageMaterialCost = R2(packageMaterial);
            r.PackageEstimatedCost = R2(packageEstimated);
            r.AdditionalLaborCost = R2(additionalLabor);
            r.CustomLaborCost = R2(labor);
            r.CustomMaterialCost = R2(materialBase);
            r.KoneMaterialCost = R2(koneMarked + packageKone);
            r.LaborCost = R2(packageLabor + additionalLabor + labor);
            r.MaterialCost = R2(packageMaterial + i.AdditionalMaterial + materialBase);
            r.MiscellaneousCost = R2(misc);
            r.UseTaxAmount = R2(packageTax + (i.AdditionalMaterial + taxBase + misc) * tax);
            r.FreightAmount = R2(packageFreight + (i.AdditionalMaterial + freightBase + misc) * freight);
            r.TotalAdditionalCost = R2(totalAdditional);
            r.TotalTrueCost = R2(packageEstimated + totalAdditional);
        }

        private static string ResolveOemBand(EstimateInput i)
        {
            string oem = i.PrimaryOem ?? string.Empty;
            var hit = i.OemBandRules.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.Keyword)
                && oem.IndexOf(x.Keyword.Trim(), StringComparison.OrdinalIgnoreCase) >= 0);
            return hit != null ? hit.Band : i.Parameters.GetText(ParamCode.OemDefaultBand, Band.Low);
        }

        private static string ResolveRedundancyBand(EstimateInput i, PricingResult r)
        {
            var hit = i.RedundancyBands.FirstOrDefault(b =>
                (b.MinimumEquipment ?? 0) <= i.RedundancyCount && (!b.MaximumEquipment.HasValue || i.RedundancyCount <= b.MaximumEquipment.Value));
            if (hit == null) r.Warnings.Add("No Redundancy Band matched count " + i.RedundancyCount + ".");
            return hit?.Band;
        }

        private static string Matrix(EstimateInput i, PricingResult r, string type, string input1, string input2)
        {
            var hit = i.BandMatrix.FirstOrDefault(m => Same(m.MatrixType, type) && Same(m.Input1, input1) && Same(m.Input2, input2));
            if (hit == null) r.Warnings.Add(string.Format("Band Matrix '{0}' has no row for ({1}, {2}).", type, input1, input2));
            return hit?.Result;
        }

        private static MarginRuleRow FindMarginRule(EstimateInput i, PricingResult r)
        {
            if (r.EquipmentBand == null || r.CustomerBand == null) return null;
            bool needsJobType = r.QuoteType == QuoteType.QR;
            if (needsJobType && r.JobTypeBand == null) return null;
            var matches = i.MarginRules.Where(m =>
                Same(m.QuoteType, r.QuoteType)
                && Same(m.EquipmentBand, r.EquipmentBand)
                && Same(m.CustomerBand, r.CustomerBand)
                && (!needsJobType || Same(m.JobTypeBand, r.JobTypeBand))).ToList();
            if (matches.Count > 1) throw new PricingException("RE-117", "MARGIN_RULE_AMBIGUOUS");
            return matches.SingleOrDefault();
        }

        private static decimal SituationalAdjustment(EstimateInput i, PricingResult r)
        {
            decimal total = 0m;
            foreach (var rule in i.SituationalRules.Where(x => x.IsApplied))
            {
                string input = InputFor(i, rule.Type);
                if (input == null)
                {
                    r.Warnings.Add("Unrecognised Situational Adjustment type '" + rule.Type + "'.");
                    continue;
                }
                if (!Same(NormalizeInput(rule.InputValue), NormalizeInput(input))) continue;
                if (Has(rule.Type, "compet") && NormalizeInput(i.PaperType) != "NON_KONE_PAPER") continue;
                if (!string.IsNullOrWhiteSpace(rule.RequiresPaperType) &&
                    !Same(NormalizeInput(rule.RequiresPaperType), NormalizeInput(i.PaperType))) continue;
                total += rule.Adjustment;
            }
            return total;
        }

        private static string NormalizeInput(string value)
        {
            switch ((value ?? "").Trim().ToUpperInvariant().Replace("-", "_").Replace(" ", "_"))
            {
                case "KONE": case "KONE_PAPER": return "KONE_PAPER";
                case "NON_KONE": case "NON_KONE_PAPER": case "CUSTOMER_PAPER": return "NON_KONE_PAPER";
                default: return (value ?? "").Trim().ToUpperInvariant();
            }
        }

        private static string InputFor(EstimateInput i, string type)
        {
            string t = type ?? string.Empty;
            if (Has(t, "emergen")) return i.Emergency ?? string.Empty;
            if (Has(t, "budget")) return i.CustomerBudgeted ?? string.Empty;
            if (Has(t, "compet")) return i.CompetingBids ?? string.Empty;
            if (Has(t, "paper") || Has(t, "kone")) return i.PaperType ?? string.Empty;
            return null;
        }

        private static decimal? StatedRateMargin(EstimateInput i, PricingResult r)
        {
            if (!r.TargetCm2.HasValue) return null;
            decimal packageMaterial = i.Packages.Sum(x => x.PackagePricedKone ? x.MaterialBeforeMarkup.Value : x.MaterialCostPerUnit *
                (1m + (x.IsCustom ? i.UseTaxPct : EstimateInput.StandardUseTax)
                    + (x.IsCustom ? i.FreightPct : EstimateInput.StandardFreight))) * r.NumberOfEquipment;
            decimal hours, material;
            if (i.IsCustomPath)
            {
                hours = i.Packages.Sum(x => x.MechanicHoursPerUnit) * r.NumberOfEquipment
                    + i.AdditionalLaborHours + i.LaborLines.Sum(l => l.Hours);
                material = i.MaterialLines.Sum(m => m.Quantity * m.UnitCost * (1m + (m.TaxApplicable ? i.UseTaxPct : 0m) + (m.FreightApplicable ? i.FreightPct : 0m)))
                    + packageMaterial
                    + i.AdditionalMaterial + i.AdditionalMisc;
            }
            else
            {
                decimal units = r.NumberOfEquipment;
                hours = i.Packages.Sum(x => x.MechanicHoursPerUnit) * units + i.AdditionalLaborHours;
                material = packageMaterial + i.AdditionalMaterial + i.AdditionalMisc;
            }

            decimal cost = hours * i.MechanicLaborRate + material;
            decimal floor = i.Parameters.Get(ParamCode.MaterialMarginFloor);
            if (floor < 0 || floor >= 1 || r.TargetCm2 < 0 || r.TargetCm2 >= 1)
                throw new PricingException("RE-111", "MARGIN_INVALID");
            decimal sell = hours * i.StatedLaborRate + material / (1m - Math.Max(floor, r.TargetCm2.Value));
            return sell == 0m ? (decimal?)null : (sell - cost) / sell;
        }

        private static bool IsKoneMaterial(MaterialLineInput m)
        {
            if (m.IsKone.HasValue) return m.IsKone.Value;
            string vendor = m.Vendor ?? string.Empty;
            string part = m.PartNumber ?? string.Empty;
            return Has(vendor, "KONE") || Has(vendor, "Spares") || Has(part, "KM") || Has(part, "US");
        }

        private static bool Has(string value, string fragment) =>
            value != null && value.IndexOf(fragment, StringComparison.OrdinalIgnoreCase) >= 0;

        private static bool Same(string a, string b) =>
            string.Equals((a ?? string.Empty).Trim(), (b ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase);

        private static decimal R2(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
    }
}
