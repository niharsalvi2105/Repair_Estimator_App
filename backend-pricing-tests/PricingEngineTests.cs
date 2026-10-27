using System;
using System.Linq;
using RepairEstimator.Plugins.Pricing;
using Xunit;

namespace RepairEstimator.Tests
{
    public class PricingEngineTests
    {
        private static readonly Guid RuleQq = Guid.NewGuid();
        private static readonly Guid RuleQr = Guid.NewGuid();
        private static readonly Guid SizeSmall = Guid.NewGuid();
        private static readonly Guid SizeMid = Guid.NewGuid();

        /// <summary>Package: 8 h + $108.3648 material, 1 unit, $170.95/h, 5% tax, 14% freight.
        /// Cost = 8 x 170.95 + 108.3648 x 1.19 = 1496.55.</summary>
        private static EstimateInput Baseline()
        {
            var i = new EstimateInput
            {
                EquipmentLineCount = 1,
                PrimaryEquipmentFound = true,
                PrimaryOem = "OTIS",
                PrimaryEquipmentAge = 10,
                RedundancyCount = 1,
                VerticalBand = Band.Medium,
                NationalAccount = "No",
                JobTypeRating = Band.Low,
                MechanicLaborRate = 170.95m,
                UseTaxPct = 0.05m,
                FreightPct = 0.14m,
                SellPrice = 0m,
                Emergency = "No",
                CustomerBudgeted = "No",
                PaperType = "KONE",
                CompetingBids = "No"
            };
            i.Packages.Add(new PackageInput { MechanicHoursPerUnit = 8m, MaterialCostPerUnit = 108.3648m });

            i.Parameters.Set(ParamCode.MedianQrMargin, 0.53m, null);
            i.Parameters.Set(ParamCode.QqThreshold, 5000m, null);
            i.Parameters.Set(ParamCode.AgeThreshold, 15m, null);
            i.Parameters.Set(ParamCode.MaterialMarginFloor, 0.65m, null);
            i.Parameters.Set(ParamCode.KoneSparesTax, 0.05m, null);
            i.Parameters.Set(ParamCode.KoneSparesFreight, 0.10m, null);
            i.Parameters.Set(ParamCode.KoneSparesMarkup, 0.10m, null);
            i.Parameters.Set(ParamCode.DownPaymentThreshold, 5000m, null);
            i.Parameters.Set(ParamCode.ApprovalDistrict, 150000m, null);
            i.Parameters.Set(ParamCode.ApprovalRegional, 250000m, null);
            i.Parameters.Set(ParamCode.OemDefaultBand, null, "Low");

            i.JobSizeBands.Add(new JobSizeBandRule { Id = SizeSmall, QuoteType = QuoteType.QR, Minimum = null, Maximum = 5000m, ComplexityBand = Band.High });
            i.JobSizeBands.Add(new JobSizeBandRule { Id = SizeMid, QuoteType = QuoteType.QR, Minimum = 5000m, Maximum = 10000m, ComplexityBand = Band.High });
            i.JobSizeBands.Add(new JobSizeBandRule { QuoteType = QuoteType.QR, Minimum = 10000m, Maximum = null, ComplexityBand = Band.Low });

            i.OemBandRules.Add(new OemBandRule { Keyword = "KONE", Band = Band.High });
            i.OemBandRules.Add(new OemBandRule { Keyword = "MONTGOMERY", Band = Band.High });

            i.RedundancyBands.Add(new RedundancyBandRule { MinimumEquipment = 1, MaximumEquipment = 1, Band = Band.High });
            i.RedundancyBands.Add(new RedundancyBandRule { MinimumEquipment = 2, MaximumEquipment = 2, Band = Band.Medium });
            i.RedundancyBands.Add(new RedundancyBandRule { MinimumEquipment = 3, MaximumEquipment = null, Band = Band.Low });

            i.BandMatrix.Add(new BandMatrixRule { MatrixType = MatrixType.Equipment, Input1 = Band.Low, Input2 = Band.Low, Result = Band.Medium });
            i.BandMatrix.Add(new BandMatrixRule { MatrixType = MatrixType.CustomerBase, Input1 = Band.Medium, Input2 = Band.High, Result = Band.High });
            i.BandMatrix.Add(new BandMatrixRule { MatrixType = MatrixType.CustomerFinal, Input1 = Band.High, Input2 = Band.High, Result = Band.Medium });
            i.BandMatrix.Add(new BandMatrixRule { MatrixType = MatrixType.JobType, Input1 = Band.Low, Input2 = Band.High, Result = Band.Medium });

            i.MarginRules.Add(new MarginRuleRow { Id = RuleQq, QuoteType = QuoteType.QQ, EquipmentBand = Band.Medium, CustomerBand = Band.Medium, TargetCm2 = 0.62m });
            i.MarginRules.Add(new MarginRuleRow { Id = RuleQr, QuoteType = QuoteType.QR, EquipmentBand = Band.Medium, CustomerBand = Band.Medium, JobTypeBand = Band.Medium, TargetCm2 = 0.55m });

            i.SituationalRules.Add(new SituationalRule { Type = "Emergency", InputValue = "Yes", Adjustment = 0.02m, IsApplied = true });
            i.SituationalRules.Add(new SituationalRule { Type = "Competing Bids", InputValue = "Yes", Adjustment = -0.03m, IsApplied = true, RequiresPaperType = "Non-KONE" });

            i.IncentiveRates.Add(new IncentiveRule { MinimumCmii = 0m, AmPayout = 0m, BdPayout = 0m });
            i.IncentiveRates.Add(new IncentiveRule { MinimumCmii = 0.60m, AmPayout = 0.028m, BdPayout = 0.0181m });
            i.IncentiveRates.Add(new IncentiveRule { MinimumCmii = 0.65m, AmPayout = 0.033m, BdPayout = 0.0215m });
            return i;
        }

        [Fact]
        public void Negative_cmii_has_zero_incentives_without_discarding_valid_pricing()
        {
            var input = Baseline();
            input.SellPrice = 25m;
            var result = PricingEngine.Calculate(input);
            Assert.True(result.ActualCmii < 0m);
            Assert.Equal(0m, result.AmIncentive);
            Assert.Equal(0m, result.BdIncentive);
            Assert.NotNull(result.SuggestedPrice);
            Assert.Empty(result.Warnings);
            Assert.Contains("RE-101|MARGIN_COMMENT_REQUIRED", PricingEngine.Validate(input, result));
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(0)]
        [InlineData(1)]
        public void Missing_incentive_configuration_is_not_treated_as_valid_zero_payout(int costOffset)
        {
            var input = Baseline();
            input.SellPrice = 1496.55m + costOffset;
            input.IncentiveRates.Clear();
            var result = PricingEngine.Calculate(input);
            Assert.Contains("No Incentive Rate matched the actual CMII.", result.Warnings);
        }

        [Fact]
        public void Negative_cmii_requires_an_explicit_zero_payout_baseline()
        {
            var input = Baseline();
            input.SellPrice = 25m;
            input.IncentiveRates[0].AmPayout = 0.01m;
            var result = PricingEngine.Calculate(input);
            Assert.Contains("No Incentive Rate matched the actual CMII.", result.Warnings);
        }

        [Fact]
        public void Duplicate_matching_margin_rules_are_rejected()
        {
            var input = Baseline();
            input.MarginRules.Add(input.MarginRules[0]);
            Assert.Equal("MARGIN_RULE_AMBIGUOUS",
                Assert.Throws<PricingException>(() => PricingEngine.Calculate(input)).Key);
        }

        [Fact]
        public void Overlapping_job_size_bands_are_rejected()
        {
            var input = Baseline();
            input.JobSizeBands.Add(input.JobSizeBands[0]);
            Assert.Equal("JOB_SIZE_BAND_AMBIGUOUS",
                Assert.Throws<PricingException>(() => PricingEngine.Calculate(input)).Key);
        }

        [Fact]
        public void Standard_package_cost_includes_tax_and_freight_on_material()
        {
            var r = PricingEngine.Calculate(Baseline());

            Assert.Equal(1, r.NumberOfEquipment);
            Assert.Equal(1367.60m, r.PackageLaborCost);
            Assert.Equal(1496.55m, r.TotalTrueCost);
            Assert.Equal(5.42m, r.UseTaxAmount);
            Assert.Equal(15.17m, r.FreightAmount);
        }

        [Fact]
        public void Equipment_count_adds_comma_separated_additional_equipment_and_multiplies_package_costs()
        {
            var i = Baseline();
            i.EquipmentLineCount = 2;
            i.AdditionalEquipmentCount = 1;

            var r = PricingEngine.Calculate(i);

            Assert.Equal(3, r.NumberOfEquipment);
            Assert.Equal(24m, r.PackageLaborHours);
            Assert.Equal(4489.66m, r.TotalTrueCost);
        }

        [Fact]
        public void Equipment_count_never_drops_below_one()
        {
            var i = Baseline();
            i.EquipmentLineCount = 0;
            Assert.Equal(1, PricingEngine.Calculate(i).NumberOfEquipment);
        }

        [Fact]
        public void Small_job_is_a_quick_quote_and_uses_the_qq_margin_rule_without_job_type_band()
        {
            var r = PricingEngine.Calculate(Baseline());

            Assert.Equal(QuoteType.QQ, r.QuoteType);
            Assert.Equal(Band.Low, r.OemBand);
            Assert.Equal(Band.Low, r.EquipmentAgeBand);
            Assert.Equal(Band.Medium, r.EquipmentBand);
            Assert.Equal(Band.High, r.RedundancyBand);
            Assert.Equal(Band.Medium, r.CustomerBand);
            Assert.Equal(RuleQq, r.MarginRuleId);
            Assert.Equal(0.62m, r.RecommendedCmii);
            Assert.Equal(3938.29m, r.SuggestedPrice);
            Assert.Empty(r.Warnings);
        }

        [Fact]
        public void Large_job_is_a_QR_and_needs_the_job_type_band()
        {
            var i = Baseline();
            i.Packages[0].MechanicHoursPerUnit = 20m; // cost 3547.95, median 7548 -> $5,000-$10,000 band

            var r = PricingEngine.Calculate(i);

            Assert.Equal(QuoteType.QR, r.QuoteType);
            Assert.Equal(SizeMid, r.JobSizeBandId);
            Assert.Equal(Band.Medium, r.JobTypeBand);
            Assert.Equal(RuleQr, r.MarginRuleId);
            Assert.Equal(0.55m, r.RecommendedCmii);
        }

        [Fact]
        public void Kone_oem_old_unit_and_missing_equipment_raise_the_bands()
        {
            var i = Baseline();
            i.PrimaryOem = "KONE ELEVATOR";
            i.PrimaryEquipmentAge = 15;
            var r = PricingEngine.Calculate(i);
            Assert.Equal(Band.High, r.OemBand);
            Assert.Equal(Band.High, r.EquipmentAgeBand);

            i.PrimaryEquipmentFound = false;
            r = PricingEngine.Calculate(i);
            Assert.Equal(Band.High, r.EquipmentBand);
            Assert.Equal(Band.Medium, r.CustomerBand);
        }

        [Fact]
        public void Situational_adjustments_apply_and_competing_bids_require_non_kone_paper()
        {
            var i = Baseline();
            i.Emergency = "Yes";
            i.CompetingBids = "Yes";

            var kone = PricingEngine.Calculate(i);
            Assert.Equal(0.02m, kone.SituationalAdjustment);
            Assert.Equal(0.64m, kone.RecommendedCmii);

            i.PaperType = "Non-KONE";
            var nonKone = PricingEngine.Calculate(i);
            Assert.Equal(-0.01m, nonKone.SituationalAdjustment);
            Assert.Equal(0.61m, nonKone.RecommendedCmii);
        }

        [Fact]
        public void Actual_cmii_variance_and_incentives_come_from_sell_price()
        {
            var i = Baseline();
            i.SellPrice = 4000m;

            var r = PricingEngine.Calculate(i);

            Assert.Equal(0.6259m, r.ActualCmii);
            Assert.Equal(0.0059m, r.CmiiVariance);
            Assert.Equal(112m, r.AmIncentive);
            Assert.Equal(72m, r.BdIncentive);
            Assert.Equal(ApprovalLevel.None, r.ApprovalLevel);
        }

        [Theory]
        [InlineData(149999, ApprovalLevel.None)]
        [InlineData(150000, ApprovalLevel.District)]
        [InlineData(249999, ApprovalLevel.District)]
        [InlineData(250000, ApprovalLevel.Regional)]
        public void Approval_level_follows_the_sell_price_thresholds(int sell, string expected)
        {
            var i = Baseline();
            i.SellPrice = sell;
            Assert.Equal(expected, PricingEngine.Calculate(i).ApprovalLevel);
        }

        [Fact]
        public void Stated_labor_rate_switches_recommended_cmii_to_the_stated_rate_margin()
        {
            var i = Baseline();
            i.StatedLaborRate = 220m;

            var r = PricingEngine.Calculate(i);

            // H = 8, M = 108.3648 x 1.19, Sell = 8 x 220 + M / (1 - max(0.65, 0.62)); margin = (Sell - Cost) / Sell
            decimal m = 108.3648m * 1.19m;
            decimal sell = 8m * 220m + m / (1m - 0.65m);
            decimal expected = (sell - (8m * 170.95m + m)) / sell;
            Assert.Equal(expected, r.StatedRateMargin.Value, 10);
            Assert.Equal(r.StatedRateMargin, r.RecommendedCmii);
        }

        [Fact]
        public void Fixed_equipment_type_target_overrides_the_matrix_target()
        {
            var i = Baseline();
            i.FixedTargetCmii = 0.45m;
            Assert.Equal(0.45m, PricingEngine.Calculate(i).RecommendedCmii);
        }

        [Fact]
        public void Missing_margin_rule_leaves_pricing_empty_and_warns_instead_of_throwing()
        {
            var i = Baseline();
            i.MarginRules.Clear();

            var r = PricingEngine.Calculate(i);

            Assert.Null(r.RecommendedCmii);
            Assert.Null(r.SuggestedPrice);
            Assert.Contains(r.Warnings, w => w.Contains("Margin Rule"));
            Assert.Contains("RE-102|PRICING_NOT_AVAILABLE", PricingEngine.Validate(i, r));
        }

        [Fact]
        public void Missing_required_parameter_throws_a_coded_error()
        {
            var i = Baseline();
            i.Parameters = new ParameterSet();

            var ex = Assert.Throws<PricingException>(() => PricingEngine.Calculate(i));
            Assert.Equal("RE-110", ex.Code);
        }

        [Fact]
        public void Mixed_packages_scale_by_equipment_but_custom_lines_and_additions_count_once()
        {
            var i = Baseline();
            i.IsCustomPath = true;
            i.EquipmentLineCount = 2;
            i.MechanicLaborRate = 100m;
            i.Packages.Clear();
            i.Packages.Add(new PackageInput { MechanicHoursPerUnit = 3m, MaterialCostPerUnit = 200m });
            i.Packages.Add(new PackageInput { MechanicHoursPerUnit = 1m, MaterialCostPerUnit = 100m });
            i.Packages.Add(new PackageInput()); // CSTM/T&M templates have no predefined costs.
            i.AdditionalLaborHours = 2m;
            i.AdditionalMaterial = 50m;
            i.AdditionalMisc = 20m;
            i.LaborLines.Add(new LaborLineInput { Hours = 4m, Rate = 150m });
            i.MaterialLines.Add(new MaterialLineInput { Quantity = 2m, UnitCost = 25m, TaxApplicable = true, FreightApplicable = true });
            var r = PricingEngine.Calculate(i);
            Assert.Equal(8m, r.PackageLaborHours);
            Assert.Equal(1514m, r.PackageEstimatedCost); // 800 + 600 * 1.19
            Assert.Equal(600m, r.CustomLaborCost);
            Assert.Equal(50m, r.CustomMaterialCost);
            Assert.Equal(942.8m, r.TotalAdditionalCost); // 200 + 600 + (50 + 50 + 20) * 1.19
            Assert.Equal(2456.8m, r.TotalTrueCost);
            Assert.Equal(36m, r.UseTaxAmount);
            Assert.Equal(100.8m, r.FreightAmount);
        }

        [Fact]
        public void Many_packages_are_summed_without_truncation()
        {
            var i = Baseline();
            i.Packages.Clear();
            for (var n = 0; n < 125; n++)
                i.Packages.Add(new PackageInput { MechanicHoursPerUnit = 1m, MaterialCostPerUnit = 10m });
            i.EquipmentLineCount = 2;
            var r = PricingEngine.Calculate(i);
            Assert.Equal(250m, r.PackageLaborHours);
            Assert.Equal(2500m, r.PackageMaterialCost);
            Assert.Equal(45712.5m, r.TotalTrueCost);
        }

        [Fact]
        public void Invalid_custom_values_are_rejected()
        {
            var i = Baseline();
            i.IsCustomPath = true;
            i.MaterialLines.Add(new MaterialLineInput { Quantity = -1m });
            Assert.Equal("PRICING_INPUT_INVALID", Assert.Throws<PricingException>(() => PricingEngine.Calculate(i)).Key);
            i.MaterialLines.Clear();
            i.LaborLines.Add(new LaborLineInput { Hours = 1m, Rate = -1m });
            Assert.Equal("PRICING_INPUT_INVALID", Assert.Throws<PricingException>(() => PricingEngine.Calculate(i)).Key);
        }

        [Fact]
        public void Custom_path_costs_lines_and_splits_kone_material()
        {
            var i = Baseline();
            i.IsCustomPath = true;
            i.Packages.Clear();
            i.LaborLines.Add(new LaborLineInput { Hours = 10m });                           // default rate 170.95
            i.LaborLines.Add(new LaborLineInput { Hours = 2m, Rate = 200m, Multiplier = 2m }); // 800
            i.MaterialLines.Add(new MaterialLineInput { Quantity = 2m, UnitCost = 50m, TaxApplicable = true, FreightApplicable = true, Vendor = "Acme" });
            i.MaterialLines.Add(new MaterialLineInput { Quantity = 1m, UnitCost = 100m, TaxApplicable = false, FreightApplicable = false, Vendor = "KONE Spares" });
            i.KoneSparesSalesPrice = 150m;

            var r = PricingEngine.Calculate(i);

            Assert.Equal(2509.50m, r.CustomLaborCost);
            Assert.Equal(200m, r.CustomMaterialCost);
            Assert.Equal(100m, r.KoneMaterialCost);
            Assert.Equal(2509.50m + 119m + 100m, r.TotalTrueCost);
            Assert.NotNull(r.SuggestedPriceWithKoneMaterial);
            Assert.Equal(Math.Round((r.TotalTrueCost - 100m) / (1m - r.RecommendedCmii.Value) +
                150m * 1.25m, 2, MidpointRounding.AwayFromZero), r.SuggestedPriceWithKoneMaterial);
        }

        [Fact]
        public void Validation_requires_sell_price_comments_and_billing_plan()
        {
            var i = Baseline();
            var empty = PricingEngine.Calculate(i);
            Assert.Contains("RE-100|SELL_PRICE_REQUIRED", PricingEngine.Validate(i, empty));

            i.SellPrice = 3000m; // below the 0.62 recommendation
            var low = PricingEngine.Calculate(i);
            var errors = PricingEngine.Validate(i, low);
            Assert.Contains("RE-101|MARGIN_COMMENT_REQUIRED", errors);
            Assert.DoesNotContain("RE-103|BILLING_PLAN_REQUIRED", errors);

            i.MarginComments = "Contract rate cap";
            i.SellPrice = 6000m;
            var big = PricingEngine.Calculate(i);
            Assert.Contains("RE-103|BILLING_PLAN_REQUIRED", PricingEngine.Validate(i, big));

            i.BillingPlanSelected = true;
            Assert.DoesNotContain("RE-103|BILLING_PLAN_REQUIRED", PricingEngine.Validate(i, PricingEngine.Calculate(i)));
        }

        [Theory]
        [InlineData("Kone Paper", "KONE_PAPER", .03)]
        [InlineData("Customer Paper", "NON_KONE_PAPER", .02)]
        public void Live_paper_labels_match_imported_adjustment_codes(string paper, string code, double adjustment)
        {
            var input = Baseline();
            input.PaperType = paper;
            input.SituationalRules.Clear();
            input.SituationalRules.Add(new SituationalRule {
                Type = "Paper Type", InputValue = code, Adjustment = (decimal)adjustment, IsApplied = true
            });
            Assert.Equal((decimal)adjustment, PricingEngine.Calculate(input).SituationalAdjustment);
        }

        [Theory]
        [InlineData("Customer Paper", -.03)]
        [InlineData("Kone Paper", 0)]
        public void Known_competition_applies_only_to_customer_paper(string paper, double expected)
        {
            var input = Baseline();
            input.PaperType = paper;
            input.CompetingBids = "Known";
            input.SituationalRules.Clear();
            input.SituationalRules.Add(new SituationalRule {
                Type = "Competing Bids", InputValue = "KNOWN", RequiresPaperType = "Non-KONE Paper",
                Adjustment = -.03m, IsApplied = true
            });
            Assert.Equal((decimal)expected, PricingEngine.Calculate(input).SituationalAdjustment);
        }

        [Theory]
        [InlineData(1)]
        [InlineData(1.1)]
        [InlineData(-.1)]
        public void Invalid_margins_cannot_produce_a_zero_suggested_price(double margin)
        {
            var input = Baseline();
            input.FixedTargetCmii = (decimal)margin;
            Assert.Throws<PricingException>(() => PricingEngine.Calculate(input));
        }

        [Fact]
        public void Material_floor_of_one_cannot_divide_by_zero()
        {
            var input = Baseline();
            input.StatedLaborRate = 220m;
            input.Parameters.Set(ParamCode.MaterialMarginFloor, 1m, null);
            Assert.Throws<PricingException>(() => PricingEngine.Calculate(input));
        }
    }
}
