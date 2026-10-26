using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using RepairEstimator.Plugins.Data;
using RepairEstimator.Plugins.Infrastructure;
using RepairEstimator.Plugins.Pricing;

namespace RepairEstimator.Plugins.Plugins
{
    /// <summary>
    /// re_repairestimate - Create and Update - Pre-operation (stage 20), synchronous.
    /// Register a pre-image named "pre" on Update. Filtering attributes on Update: see README.
    /// Writes straight into the Target, so there is no second update and no recursion.
    /// </summary>
    public sealed class EstimateCalculationPlugin : PluginBase
    {
        protected override void ExecuteCore(LocalContext local)
        {
            var ctx = local.Context;
            var target = local.Target;
            if (target == null) return;

            bool isCreate = string.Equals(ctx.MessageName, "Create", StringComparison.OrdinalIgnoreCase);
            if (isCreate) EstimateDefaults.Apply(local, target);
            if (DraftBatch.Contains(ctx, target.Id)) return;

            var estimate = Merge(target, local.PreImage);
            if (!isCreate && local.PreImage == null)
                throw new InvalidPluginExecutionException("RE-115|PREIMAGE_REQUIRED");
            try
            {
                var loaded = EstimateInputLoader.Load(local.UserService, local.SystemService, estimate, DateTime.UtcNow.Date);
                if (loaded.Input.EquipmentLineCount < 1 || !loaded.HasPackages)
                    throw new PricingException("RE-116", "SELECTIONS_REQUIRED");
                var result = PricingEngine.Calculate(loaded.Input);
                foreach (var warning in result.Warnings) local.Trace.Trace("Pricing warning: " + warning);
                if (!result.SuggestedPrice.HasValue || result.Warnings.Count != 0)
                    throw new PricingException("RE-102", "PRICING_NOT_AVAILABLE");
                CalculationWriter.Write(local.SystemService, target, loaded, result);
                ValidateOnSubmit(local, target, estimate, loaded, result);
            }
            catch (PricingException ex)
            {
                local.Trace.Trace("Pricing unavailable: {0}", ex);
                if (estimate.GetAttributeValue<OptionSetValue>(Names.Estimate.Status)?.Value != Labels.DraftStatus)
                    throw new InvalidPluginExecutionException(ex.Code + "|" + ex.Key, ex);
                CalculationWriter.Clear(target);
            }
        }

        private static Entity Merge(Entity target, Entity pre)
        {
            var merged = new Entity(target.LogicalName, target.Id);
            if (pre != null) foreach (var a in pre.Attributes) merged[a.Key] = a.Value;
            foreach (var a in target.Attributes) merged[a.Key] = a.Value;
            return merged;
        }

        private static void ValidateOnSubmit(LocalContext local, Entity target, Entity estimate, LoadedEstimate loaded, PricingResult result)
        {
            if (!target.Contains(Names.Estimate.Status)) return;

            if (target.GetAttributeValue<OptionSetValue>(Names.Estimate.Status)?.Value != Labels.SubmittedStatus) return;

            var errors = PricingEngine.Validate(loaded.Input, result);
            if (errors.Any())
                throw new InvalidPluginExecutionException(string.Join("; ", errors));

            if (!estimate.Contains(Names.Estimate.SubmittedOn) || estimate[Names.Estimate.SubmittedOn] == null)
                target[Names.Estimate.SubmittedOn] = DateTime.UtcNow;
        }
    }
}
