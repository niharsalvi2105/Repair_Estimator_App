using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using RepairEstimator.Plugins.Infrastructure;

namespace RepairEstimator.Plugins.Plugins
{
    internal static class SnapshotGuard
    {
        public static void RequireDraftApi(LocalContext local)
        {
            var parent = local.Target?.GetAttributeValue<EntityReference>(Names.ChildParentLookup);
            if (parent == null && local.Target != null && local.Context.MessageName == "Update")
                parent = local.UserService.Retrieve(local.Context.PrimaryEntityName, local.Target.Id,
                    new ColumnSet(Names.ChildParentLookup)).GetAttributeValue<EntityReference>(Names.ChildParentLookup);
            if (parent == null || !DraftBatch.Contains(local.Context, parent.Id))
            {
                local.Trace.Trace("Snapshot guard rejected write. Parent lookup present: {0}", parent != null);
                for (var context = local.Context; context != null; context = context.ParentContext)
                {
                    var marker = context.SharedVariables.Contains(DraftBatch.Key)
                        ? context.SharedVariables[DraftBatch.Key] : null;
                    local.Trace.Trace(
                        "Snapshot context: message={0}, stage={1}, depth={2}, markerType={3}, markerMatches={4}",
                        context.MessageName, context.Stage, context.Depth,
                        marker?.GetType().FullName ?? "missing",
                        parent != null && marker is string tag &&
                        tag == "RepairEstimator.DraftBatch:" + parent.Id.ToString("D"));
                }
                throw new InvalidPluginExecutionException("RE-141|USE_DRAFT_API_FOR_SNAPSHOTS");
            }
        }
    }

    // The draft API is the single snapshot writer and preserves unchanged selections.
    public sealed class EstimateEquipmentSnapshotPlugin : PluginBase
    {
        protected override void ExecuteCore(LocalContext local) => SnapshotGuard.RequireDraftApi(local);
    }

    public sealed class EstimatePackageSnapshotPlugin : PluginBase
    {
        protected override void ExecuteCore(LocalContext local) => SnapshotGuard.RequireDraftApi(local);
    }
}
