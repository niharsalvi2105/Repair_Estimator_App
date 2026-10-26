using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using RepairEstimator.Plugins.Data;
using RepairEstimator.Plugins.Infrastructure;

namespace RepairEstimator.Plugins.Plugins
{
    /// <summary>Step 0 of the Calculation Rules: defaults that Dataverse cannot hold natively, applied on Create.</summary>
    internal static class EstimateDefaults
    {
        public static void Apply(LocalContext local, Entity target)
        {
            var s = local.UserService;

            if (!target.Contains(Names.Estimate.Revision)) target[Names.Estimate.Revision] = 1;
            if (!target.Contains(Names.Estimate.Salesperson))
                target[Names.Estimate.Salesperson] = new EntityReference("systemuser", local.Context.InitiatingUserId);

            var branchRef = target.GetAttributeValue<EntityReference>(Names.Estimate.Branch);
            if (branchRef == null) return;

            var branch = s.Retrieve(Names.Branch.Entity, branchRef.Id, new ColumnSet(
                Names.Branch.Country, Names.Branch.Currency, Names.Branch.Market, Names.Branch.StateProvince, Names.Branch.DefaultLanguage));

            var country = branch.GetAttributeValue<EntityReference>(Names.Branch.Country);
            var currency = branch.GetAttributeValue<EntityReference>(Names.Branch.Currency);
            var market = branch.GetAttributeValue<OptionSetValue>(Names.Branch.Market);

            if (!target.Contains(Names.Estimate.Country) && country != null) target[Names.Estimate.Country] = country;
            if (!target.Contains(Names.Estimate.Currency) && currency != null) target[Names.Estimate.Currency] = currency;
            if (!target.Contains(Names.Estimate.Market) && market != null) target[Names.Estimate.Market] = market;
            if (!target.Contains(Names.Estimate.BuildingProvince) && branch.GetAttributeValue<EntityReference>(Names.Branch.StateProvince) != null)
                target[Names.Estimate.BuildingProvince] = branch.GetAttributeValue<EntityReference>(Names.Branch.StateProvince);

            if (!target.Contains(Names.Estimate.ProposalLanguage))
            {
                var language = ResolveLanguage(local, target, branch, market);
                if (language != null) target[Names.Estimate.ProposalLanguage] = language;
            }
        }

        /// <summary>French if the province requires it or the market is Quebec; else province, branch, then user preference.</summary>
        private static OptionSetValue ResolveLanguage(LocalContext local, Entity target, Entity branch, OptionSetValue market)
        {
            var s = local.UserService;
            var provinceRef = target.GetAttributeValue<EntityReference>(Names.Estimate.BuildingProvince);
            Entity province = provinceRef == null ? null : s.Retrieve(provinceRef.LogicalName, provinceRef.Id,
                new ColumnSet(Names.StateProvince.FrenchRequired, Names.StateProvince.DefaultLanguage));

            bool quebec = OptionMap.Label(local.SystemService, Names.Sets.Market, market)?.IndexOf(Labels.MarketQuebec, StringComparison.OrdinalIgnoreCase) >= 0;
            if (quebec || province?.GetAttributeValue<bool?>(Names.StateProvince.FrenchRequired) == true)
                return OptionMap.ValueContaining(local.SystemService, Names.Sets.ProposalLanguage, Labels.French);

            var fromProvince = province?.GetAttributeValue<OptionSetValue>(Names.StateProvince.DefaultLanguage);
            if (fromProvince != null) return fromProvince;

            var fromBranch = branch.GetAttributeValue<OptionSetValue>(Names.Branch.DefaultLanguage);
            if (fromBranch != null) return fromBranch;

            var preference = Query.Active(Names.AppUserPreference.Entity, Names.AppUserPreference.Language);
            preference.Criteria.AddCondition(Names.AppUserPreference.User, ConditionOperator.Equal, local.Context.InitiatingUserId);
            return Query.First(s, preference)?.GetAttributeValue<OptionSetValue>(Names.AppUserPreference.Language);
        }
    }
}
