using System;
using Microsoft.Xrm.Sdk;

namespace RepairEstimator.Plugins.Infrastructure
{
    public abstract class PluginBase : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var trace = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            var local = new LocalContext
            {
                Context = context,
                Trace = trace,
                UserService = factory.CreateOrganizationService(context.UserId),
                // Reads pricing configuration that estimators have no privilege to read
                SystemService = factory.CreateOrganizationService(null)
            };

            try
            {
                ExecuteCore(local);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Pricing.PricingException ex)
            {
                trace.Trace(ex.ToString());
                throw new InvalidPluginExecutionException(ex.Code + "|" + ex.Key, ex);
            }
            catch (Exception ex)
            {
                trace.Trace(ex.ToString());
                throw new InvalidPluginExecutionException("RE-500|UNEXPECTED_ERROR", ex);
            }
        }

        protected abstract void ExecuteCore(LocalContext local);
    }

    public sealed class LocalContext
    {
        public IPluginExecutionContext Context { get; set; }
        public ITracingService Trace { get; set; }
        public IOrganizationService UserService { get; set; }
        public IOrganizationService SystemService { get; set; }

        public Entity Target
        {
            get
            {
                return Context.InputParameters.Contains("Target") ? Context.InputParameters["Target"] as Entity : null;
            }
        }

        public EntityReference TargetReference
        {
            get
            {
                return Context.InputParameters.Contains("Target") ? Context.InputParameters["Target"] as EntityReference : null;
            }
        }

        public Entity PreImage
        {
            get { return Context.PreEntityImages.Contains("pre") ? Context.PreEntityImages["pre"] : null; }
        }
    }
}
