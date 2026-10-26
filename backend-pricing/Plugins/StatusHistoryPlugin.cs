using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using RepairEstimator.Plugins.Infrastructure;

namespace RepairEstimator.Plugins.Plugins
{
    /// <summary>
    /// re_repairestimate - Update (filter: re_estimatestatus) - Post-operation (stage 40).
    /// Register a pre-image named "pre" containing re_estimatestatus. Writes with the system service so estimators
    /// need no privilege on the history table; re_changedby still records the real user.
    /// </summary>
    public sealed class StatusHistoryPlugin : PluginBase
    {
        protected override void ExecuteCore(LocalContext local)
        {
            var target = local.Target;
            if (target == null || !target.Contains(Names.Estimate.Status)) return;

            var to = target.GetAttributeValue<OptionSetValue>(Names.Estimate.Status);
            var from = local.PreImage?.GetAttributeValue<OptionSetValue>(Names.Estimate.Status);
            if (to == null || (from != null && from.Value == to.Value)) return;

            var s = local.SystemService;
            string fromLabel = OptionMap.Label(s, Names.Sets.EstimateStatus, from) ?? "New";
            string toLabel = OptionMap.Label(s, Names.Sets.EstimateStatus, to) ?? to.Value.ToString();

            var row = new Entity(Names.StatusHistory.Entity);
            var estimate = local.UserService.Retrieve(Names.Estimate.Entity, target.Id, new ColumnSet("ownerid"));
            row["ownerid"] = estimate.GetAttributeValue<EntityReference>("ownerid");
            row[Names.StatusHistory.Name] = fromLabel + " -> " + toLabel;
            row[Names.StatusHistory.Estimate] = new EntityReference(Names.Estimate.Entity, target.Id);
            row[Names.StatusHistory.ToStatus] = to;
            if (from != null) row[Names.StatusHistory.FromStatus] = from;
            row[Names.StatusHistory.ChangedBy] = new EntityReference("systemuser", local.Context.InitiatingUserId);
            row[Names.StatusHistory.ChangedOn] = DateTime.UtcNow;
            s.Create(row);
        }
    }
}
