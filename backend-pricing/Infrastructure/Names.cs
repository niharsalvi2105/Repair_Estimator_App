namespace RepairEstimator.Plugins.Infrastructure
{
    /// <summary>
    /// Every schema name the plug-ins touch (prefix "re_", from DataverseSchema.xlsx). If a column is renamed,
    /// change it here only.
    /// </summary>
    public static class Names
    {
        // Global choices (option set names)
        public static class Sets
        {
            public const string PricingBand = "re_pricingband";
            public const string QuoteType = "re_quotetype";
            public const string QuoteTypeRule = "re_quotetypechoice";
            public const string EstimateStatus = "re_estimatestatuschoice";
            public const string EstimatePath = "re_estimatepathchoice";
            public const string ApprovalLevel = "re_approvallevel";
            public const string YesNo = "re_yesno";
            public const string YesNoUnknown = "re_yesnounknowchoice";
            public const string PaperType = "re_papertype";
            public const string CompetingBids = "re_competingbidstatus";
            public const string JobTypeRating = "re_ratingchoice";
            public const string TimeCategory = "re_timecateogry"; // spelling as created in the environment
            public const string LaborRole = "re_laborrole";
            public const string ProposalLanguage = "re_proposallanguagechoice";
            public const string Market = "re_marketchoice";
            public const string AdjustmentType = "re_adjusttype";
            public const string BandMatrixType = "re_bandmatrixtype";
        }

        public static class Estimate
        {
            public const string Entity = "re_repairestimate";
            public const string Id = "re_repairestimateid";
            public const string Name = "re_name";
            public const string Status = "re_estimatestatus";
            public const string Path = "re_estimatepath";
            public const string Revision = "re_revisionnumber";
            public const string Salesperson = "re_salesperson";
            public const string Branch = "re_branch";
            public const string Country = "re_country";
            public const string Market = "re_market";
            public const string Currency = "transactioncurrencyid";
            public const string BuildingProvince = "re_buildingprovincestate";
            public const string ProposalLanguage = "re_proposallanguage";
            public const string EquipmentType = "re_equipmenttype";
            public const string JobType = "re_jobtype";
            public const string CustomerVertical = "re_customervertical";
            public const string TimeCategory = "re_timecategory";
            public const string AdditionalEquipmentNumbers = "re_additionalequipmentnumbers";
            public const string NationalAccount = "re_nationalaccount";
            public const string Emergency = "re_emergency";
            public const string CustomerBudgeted = "re_customerbudgeted";
            public const string PaperType = "re_papertype";
            public const string CompetingBids = "re_competingbids";
            public const string StatedLaborRate = "re_statedlaborrate";
            public const string AdditionalLaborHours = "re_additionallaborhours";
            public const string AdditionalMaterial = "re_additionalmaterial";
            public const string AdditionalMisc = "re_additionalmiscellaneous";
            public const string KoneSparesSalesPrice = "re_konesparessalespricevk13";
            public const string SellPrice = "re_sellprice";
            public const string MarginComments = "re_margincomments";
            public const string BillingPlan = "re_billingplan";

            // Use tax / freight: "Use Tax %" (re_usetax) is the input; the *percentage columns are kept in step.
            public const string UseTax = "re_usetax";
            public const string UseTaxPercentage = "re_usetaxpercentage";
            public const string Freight = "re_freight";
            public const string FreightPercentage = "re_freightpercentage";

            // Outputs
            public const string NumberOfEquipment = "re_numberofequipment";
            public const string MechanicLaborRate = "re_mechaniclaborrate";
            public const string PackageLaborHours = "re_packagelaborhours";
            public const string PackageLaborCost = "re_packagelaborcost";
            public const string PackageMaterialCost = "re_packagematerialcost";
            public const string PackageEstimatedCost = "re_packageestimatedcost";
            public const string AdditionalLaborCost = "re_additionallaborcost";
            public const string UseTaxAmount = "re_usetaxamount";
            public const string FreightAmount = "re_freightamount";
            public const string TotalAdditionalCost = "re_totaladditionalcost";
            public const string CustomLaborCost = "re_customlaborcost";
            public const string CustomMaterialCost = "re_custommaterialcost";
            public const string KoneMaterialCost = "re_konematerialcost";
            public const string LaborCost = "re_laborcost";
            public const string MaterialCost = "re_materialcost";
            public const string MiscellaneousCost = "re_miscellaneouscost";
            public const string TotalTrueCost = "re_totaltruecost";
            public const string MedianMarginSellPrice = "re_medianmarginsellprice";
            public const string QuoteType = "re_quotetype";
            public const string JobSizeBand = "re_jobsizeband";
            public const string OemBand = "re_oemband";
            public const string EquipmentAgeBand = "re_equipmentageband";
            public const string EquipmentBand = "re_equipmentband";
            public const string VerticalBand = "re_verticalband";
            public const string RedundancyBand = "re_redundancyband";
            public const string RedundancyCount = "re_redundancycount";
            public const string CustomerBaseBand = "re_customerbaseband";
            public const string NationalAccountBand = "re_nationalaccountband";
            public const string CustomerBand = "re_customerband";
            public const string JobTypeRating = "re_jobtyperating";
            public const string JobTypeBand = "re_jobtypeband";
            public const string PrimaryEquipmentFound = "re_primaryequipmentfound";
            public const string MarginGroup = "re_margingroup";
            public const string MarginRule = "re_marginrule";
            public const string BaseTargetCm2 = "re_basetargetcm2";
            public const string BaseTargetCmii = "re_basetargetcmii";
            public const string SituationalAdjustment = "re_situationaladjustment";
            public const string TotalAdjustment = "re_totaladjustment";
            public const string TargetCm2 = "re_targetcm2";
            public const string AdjustedTargetCmii = "re_adjustedtargetcmii";
            public const string StatedRateMargin = "re_statedratemargin";
            public const string RecommendedCmii = "re_recommendedcmii";
            public const string SuggestedPrice = "re_suggestedprice";
            public const string SuggestedSellPrice = "re_suggestedsellprice";
            public const string SuggestedPriceKoneMaterial = "re_suggestedpricewithkonematerial";
            public const string ActualCmii = "re_actualcmii";
            public const string CmiiVariance = "re_cmiivariance";
            public const string AmIncentive = "re_amincentive";
            public const string BdIncentive = "re_bdincentive";
            public const string ApprovalLevel = "re_approvallevel";
            public const string RequiresApproval = "re_requiresapproval";
            public const string SubmittedOn = "re_submittedon";
            /// <summary>Doubles as the "recalculation requested" marker: child plug-ins stamp it, which re-runs the calculation.</summary>
            public const string CalculatedOn = "re_calculatedon";
            public const string CalculationVersion = "re_calculationversion";
        }

        /// <summary>Lookup from every child table to its estimate. Must exist on all child tables (see README).</summary>
        public const string ChildParentLookup = "re_repairestimate";

        public static class EstimateEquipment
        {
            public const string Entity = "re_estimateequipment";
            public const string Name = "re_name";
            public const string Sequence = "re_sequence";
            public const string IsPrimary = "re_isprimary";
            public const string Equipment = "re_equipment";
            public const string NumberSnapshot = "re_equipmentnumber";
            public const string NameSnapshot = "re_equipmentnamesnapshot";
            public const string OemSnapshot = "re_oem";
            public const string AgeSnapshot = "re_equipmentage";
            public const string VerticalCode = "re_verticalcode";
            public const string SoldTo = "re_soldtonumber";
        }

        public static class EstimatePackage
        {
            public const string Entity = "re_estimatepackage";
            public const string Name = "re_name";
            public const string RepairPackage = "re_repairpackage";
            public const string Hours = "re_mechanichoursperunit";
            public const string Material = "re_materialcostperunit";
        }

        public static class EstimateLaborLine
        {
            public const string Entity = "re_estimatelaborline";
            public const string Hours = "re_hours";
            public const string Rate = "re_hourlycost";
        }

        public static class EstimateMaterialLine
        {
            public const string Entity = "re_estimatematerialline";
            public const string Quantity = "re_quantity";
            public const string UnitCost = "re_unitcost";
            public const string TaxApplicable = "re_taxapplicable";
            public const string FreightApplicable = "re_freightapplicable";
            public const string Vendor = "re_vendor";
            public const string PartNumber = "re_partnumber";
        }

        public static class EstimateCostLine
        {
            public const string Entity = "re_estimatecostline";
        }

        public static class StatusHistory
        {
            public const string Entity = "re_estimatestatushistory";
            public const string Name = "re_name";
            public const string Estimate = "re_repairestimate";
            public const string FromStatus = "re_fromstatus";
            public const string ToStatus = "re_tostatus";
            public const string ChangedBy = "re_changedby";
            public const string ChangedOn = "re_changedon";
        }

        public static class Branch
        {
            public const string Entity = "re_branch";
            public const string Name = "re_branchname";
            public const string MarginGroup = "re_margingroup";
            public const string Country = "re_country";
            public const string Currency = "re_currency";
            public const string Market = "re_market";
            public const string StateProvince = "re_stateprovince";
            public const string DefaultUseTax = "re_defaultusetax";
            public const string DefaultFreight = "re_defaultfreight";
            public const string DefaultLanguage = "re_defaultlanguage";
        }

        public static class StateProvince
        {
            public const string Entity = "re_stateprovince";
            public const string DefaultUseTax = "re_defaultusetax";
            public const string DefaultFreight = "re_defaultfreight";
            public const string DefaultLanguage = "re_defaultlanguage";
            public const string FrenchRequired = "re_frenchrequired";
        }

        public static class Equipment
        {
            public const string Entity = "re_equipment";
            public const string Number = "re_equipment";
            public const string Name = "re_equipmentname";
            public const string Oem = "re_oem";
            public const string Age = "re_equipmentage";
            public const string SoldToNumber = "re_soldtonumber";
            public const string FunctionalLocation = "re_functionallocation";
            public const string VerticalCode = "re_verticalcode";
            public const string CustomerVertical = "re_customervertical";
        }

        public static class CustomerVertical
        {
            public const string Entity = "re_customervertical";
            public const string Code = "re_verticalcode";
            public const string Band = "re_verticalband";
        }

        public static class EquipmentType
        {
            public const string Entity = "re_equipmenttype";
            public const string FixedTargetCmii = "re_fixedtargetcmii";
        }

        public static class JobType
        {
            public const string Entity = "re_jobtype";
            public const string Rating = "re_rating";
        }

        public static class RepairPackage
        {
            public const string Entity = "re_repairpackage";
            public const string Number = "re_packagenumber";
            public const string NameEn = "re_packagenameen";
            public const string MechanicHours = "re_mechanichours";
            public const string MaterialMiscTaxCost = "re_materialmisctaxcost";
            public const string IsCustom = "re_iscustompackage";
        }

        public static class LaborRate
        {
            public const string Entity = "re_laborrate";
            public const string Branch = "re_branch";
            public const string Role = "re_laborrole";
            public const string TimeCategory = "re_timecategory";
            public const string HourlyCost = "re_hourlycost";
        }

        public static class MarginRule
        {
            public const string Entity = "re_marginrule";
            public const string Group = "re_margingroup";
            public const string QuoteType = "re_quotetype";
            public const string EquipmentBand = "re_equipmentband";
            public const string CustomerBand = "re_customerband";
            public const string JobTypeBand = "re_jobtypeband";
            public const string TargetCm2 = "re_targetcm2";
        }

        public static class JobSizeBand
        {
            public const string Entity = "re_jobsizeband";
            public const string QuoteType = "re_quotetype";
            public const string Minimum = "re_minimumamount";
            public const string Maximum = "re_maximumamount";
            public const string Complexity = "re_complexityband";
        }

        public static class OemBandRule
        {
            public const string Entity = "re_oembandrule";
            public const string Keyword = "re_name";
            public const string Band = "re_oemband";
        }

        public static class RedundancyBand
        {
            public const string Entity = "re_redundancyband";
            public const string Minimum = "re_minimumequipment";
            public const string Maximum = "re_maximumequipment";
            public const string Band = "re_redundancyband";
        }

        public static class BandMatrix
        {
            public const string Entity = "re_bandmatrix";
            public const string Type = "re_matrixtype";
            public const string Input1 = "re_input1band";
            public const string Input2 = "re_input2band";
            public const string Result = "re_resultband";
        }

        public static class SituationalAdjustment
        {
            public const string Entity = "re_situationaladjustment";
            public const string Type = "re_adjustmenttype";
            public const string InputValue = "re_inputvalue";
            public const string Adjustment = "re_adjustment";
            public const string IsApplied = "re_isapplied";
            public const string RequiresPaperType = "re_requirespapertype";
        }

        public static class IncentiveRate
        {
            public const string Entity = "re_incentiverate";
            public const string Country = "re_country";
            public const string MinimumCmii = "re_minimumcmii";
            public const string AmPayout = "re_ampayout";
            public const string BdPayout = "re_bdpayout";
        }

        public static class PricingParameter
        {
            public const string Entity = "re_pricingparameter";
            public const string Code = "re_name";
            public const string Country = "re_country";
            public const string DecimalValue = "re_decimalvalue";
            public const string TextValue = "re_textvalue";
        }

        public static class AppUserPreference
        {
            public const string Entity = "re_appuserpreference";
            public const string User = "re_user";
            public const string Language = "re_preferredlanguage";
        }

        public const string EffectiveFrom = "re_effectivefrom";
        public const string EffectiveTo = "re_effectiveto";
    }

    /// <summary>English option labels the plug-ins rely on. Values are resolved from metadata, never hard-coded.</summary>
    public static class Labels
    {
        public const string Mechanic = "Mechanic";
        public const string Yes = "Yes";
        public const string Submitted = "Submitted";
        public const string Approved = "Approved";
        public const string Custom = "Custom";
        public const string Standard = "Standard";
        public const string French = "French";
        public const string English = "English";
        public const string MarketQuebec = "CKQ";

        public const int DraftStatus = 126110000;
        public const int SubmittedStatus = 126110002;
    }
}
