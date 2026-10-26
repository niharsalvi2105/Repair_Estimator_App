using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using RepairEstimator.Plugins.Infrastructure;

namespace RepairEstimator.Plugins.Plugins
{
    internal static class EstimateLock
    {
        public static void EnsureEditable(LocalContext local, Guid estimateId)
        {
            var estimate = local.UserService.Retrieve(Names.Estimate.Entity, estimateId,
                new ColumnSet(Names.Estimate.Status));
            if (estimate.GetAttributeValue<OptionSetValue>(Names.Estimate.Status)?.Value != Labels.DraftStatus)
                throw new InvalidPluginExecutionException("RE-130|ESTIMATE_LOCKED");
        }
    }

    public sealed class EstimateLockPlugin : PluginBase
    {
        protected override void ExecuteCore(LocalContext local)
        {
            var id = local.Target?.Id ?? local.TargetReference?.Id ?? Guid.Empty;
            if (id != Guid.Empty) EstimateLock.EnsureEditable(local, id);
        }
    }

    public sealed class ChildLockPlugin : PluginBase
    {
        protected override void ExecuteCore(LocalContext local)
        {
            var parents = new HashSet<Guid>();
            var next = local.Target?.GetAttributeValue<EntityReference>(Names.ChildParentLookup);
            if (next != null) parents.Add(next.Id);
            if (!string.Equals(local.Context.MessageName, "Create", StringComparison.OrdinalIgnoreCase))
            {
                var id = local.Target?.Id ?? local.TargetReference?.Id ?? Guid.Empty;
                var previous = local.UserService.Retrieve(local.Context.PrimaryEntityName, id,
                    new ColumnSet(Names.ChildParentLookup));
                var parent = previous.GetAttributeValue<EntityReference>(Names.ChildParentLookup);
                if (parent != null) parents.Add(parent.Id);
            }
            if (parents.Count == 0)
                throw new InvalidPluginExecutionException("RE-131|ESTIMATE_PARENT_REQUIRED");
            foreach (var id in parents) EstimateLock.EnsureEditable(local, id);
        }
    }
}
