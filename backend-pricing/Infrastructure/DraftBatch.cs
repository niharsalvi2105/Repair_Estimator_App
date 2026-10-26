using System;
using Microsoft.Xrm.Sdk;

namespace RepairEstimator.Plugins.Infrastructure
{
    internal static class DraftBatch
    {
        public const string Key = "tag";

        public static bool Contains(IPluginExecutionContext context, Guid estimateId)
        {
            var expected = "RepairEstimator.DraftBatch:" + estimateId.ToString("D");
            bool tagged = false;
            for (var current = context; current != null; current = current.ParentContext)
            {
                if (current.MessageName == "re_DraftEstimate")
                    return tagged;
                if (current.SharedVariables.Contains(Key))
                    tagged = string.Equals(current.SharedVariables[Key] as string, expected, StringComparison.Ordinal);
            }
            return false;
        }
    }
}
