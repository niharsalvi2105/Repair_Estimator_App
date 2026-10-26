using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using RepairEstimator.Plugins.Infrastructure;

namespace RepairEstimator.Plugins.Plugins
{
    /// <summary>
    /// re_estimateequipment and re_estimatepackage - Create, Update, Delete -
    /// Post-operation (stage 40), synchronous. Register a pre-image named "pre" (parent lookup) on Update and Delete.
    /// Stamps re_calculatedon on the parent, which re-runs EstimateCalculationPlugin.
    /// </summary>
    public sealed class ChildChangeTriggerPlugin : PluginBase
    {
        protected override void ExecuteCore(LocalContext local)
        {
            var ctx = local.Context;
            if (IsCascadeFromEstimateDelete(ctx)) return;

            var parents = new HashSet<Guid>();
            Add(parents, local.Target?.GetAttributeValue<EntityReference>(Names.ChildParentLookup));
            Add(parents, local.PreImage?.GetAttributeValue<EntityReference>(Names.ChildParentLookup));

            foreach (var id in parents)
            {
                if (DraftBatch.Contains(ctx, id)) continue;
                var touch = new Entity(Names.Estimate.Entity, id);
                touch[Names.Estimate.CalculatedOn] = DateTime.UtcNow;
                local.UserService.Update(touch);
            }
        }

        private static void Add(HashSet<Guid> ids, EntityReference parent)
        {
            if (parent != null && string.Equals(parent.LogicalName, Names.Estimate.Entity, StringComparison.OrdinalIgnoreCase))
                ids.Add(parent.Id);
        }

        private static bool IsCascadeFromEstimateDelete(IPluginExecutionContext ctx)
        {
            for (var parent = ctx.ParentContext; parent != null; parent = parent.ParentContext)
            {
                if (string.Equals(parent.MessageName, "Delete", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(parent.PrimaryEntityName, Names.Estimate.Entity, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            return false;
        }
    }
}
