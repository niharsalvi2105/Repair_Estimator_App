using System;
using System.Linq;
using System.Runtime.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using RepairEstimator.Plugins.Data;
using RepairEstimator.Plugins.Infrastructure;
using RepairEstimator.Plugins.Pricing;
using RepairEstimator.Plugins.Plugins;

namespace RepairEstimator.Plugins.Automation
{
    [DataContract]
    public sealed class ExportCommand
    {
        [DataMember] public string operation;
        [DataMember] public string estimateId;
        [DataMember] public string requestId;
        [DataMember] public string mode;
        [DataMember] public string runId;
        [DataMember] public string workbookUrl;
        [DataMember] public string receipt;
    }

    [DataContract]
    public sealed class ExportResponse
    {
        [DataMember] public string requestId;
        [DataMember] public string state;
        [DataMember] public bool claimed;
        [DataMember(EmitDefaultValue = false)] public string payload;
        [DataMember(EmitDefaultValue = false)] public string hash;
    }

    public sealed class ExportRequestPlugin : PluginBase
    {
        public const string Api = "re_EstimateExport";
        public const string Table = "re_estimateexport";
        public const string HeaderRequest = "re_exportrequest";
        public const string LockVersion = "re_exportlockversion";
        internal const string TrustedWrite = "RepairEstimator.ExportWrite";
        readonly Guid flowUser;

        public ExportRequestPlugin() { }
        public ExportRequestPlugin(string unsecure, string secure)
        {
            if (!string.IsNullOrWhiteSpace(unsecure) && !Guid.TryParse(unsecure, out flowUser))
                throw new InvalidPluginExecutionException("RE-146|EXPORT_CONFIGURATION_INVALID");
        }

        internal static bool IsTrusted(IPluginExecutionContext context, Guid estimateId)
        {
            for (var current = context; current != null; current = current.ParentContext)
                if (current.MessageName == Api && current.SharedVariables.Contains(TrustedWrite) &&
                    current.SharedVariables[TrustedWrite] is Guid id && id == estimateId)
                    return true;
            return false;
        }

        internal static bool IsChildTouch(IPluginExecutionContext context, Guid estimateId)
        {
            for (var current = context.ParentContext; current != null; current = current.ParentContext)
                if (new[] { Names.EstimateEquipment.Entity, Names.EstimatePackage.Entity,
                    Names.EstimateLaborLine.Entity, Names.EstimateMaterialLine.Entity, Names.EstimateCostLine.Entity }
                    .Contains(current.PrimaryEntityName) && current.SharedVariables.Contains("RepairEstimator.ExportChildTouch") &&
                    current.SharedVariables["RepairEstimator.ExportChildTouch"] is Guid id && id == estimateId)
                    return true;
            return false;
        }

        internal static void Update(IOrganizationService service, Entity row)
        {
            if (string.IsNullOrEmpty(row.RowVersion))
                throw new InvalidPluginExecutionException("RE-147|EXPORT_CONCURRENCY_REQUIRED");
            service.Execute(new UpdateRequest { Target = row,
                ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
        }

        protected override void ExecuteCore(LocalContext local)
        {
            if (local.Context.MessageName != Api || !local.Context.IsInTransaction)
                throw new InvalidPluginExecutionException("RE-148|EXPORT_TRANSACTION_REQUIRED");
            var command = ExportSnapshot.Deserialize<ExportCommand>(local.Context.InputParameters["InputJson"] as string);
            if (command == null) throw new InvalidPluginExecutionException("RE-149|EXPORT_COMMAND_REQUIRED");
            var authorizedFlowUser = flowUser;
            if (authorizedFlowUser == Guid.Empty)
            {
                var configQuery = new QueryExpression("re_exportconfiguration") {
                    ColumnSet = new ColumnSet("re_flowuser", "re_enabled"), TopCount = 2
                };
                configQuery.Criteria.AddCondition("re_name", ConditionOperator.Equal, "RepairEstimator");
                configQuery.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
                var configs = local.SystemService.RetrieveMultiple(configQuery).Entities;
                if (configs.Count != 1 || !configs[0].GetAttributeValue<bool>("re_enabled") ||
                    configs[0].GetAttributeValue<EntityReference>("re_flowuser") == null)
                    throw new InvalidPluginExecutionException("RE-146|EXPORT_CONFIGURATION_INVALID");
                authorizedFlowUser = configs[0].GetAttributeValue<EntityReference>("re_flowuser").Id;
            }
            ExportResponse response;
            if (command.operation == "queue") response = Queue(local, command);
            else
            {
                if (local.Context.InitiatingUserId != authorizedFlowUser)
                    throw new InvalidPluginExecutionException("RE-150|EXPORT_FLOW_USER_REQUIRED");
                response = Advance(local, command);
            }
            local.Context.OutputParameters["ResultJson"] = ExportSnapshot.Serialize(response);
        }

        ExportResponse Queue(LocalContext local, ExportCommand command)
        {
            Guid id;
            if (!Guid.TryParse(command.estimateId, out id) || (command.mode != "sample" && command.mode != "expanded"))
                throw new InvalidPluginExecutionException("RE-149|EXPORT_COMMAND_REQUIRED");
            // Access is checked with the caller before any system-service write.
            var header = local.UserService.Retrieve(Names.Estimate.Entity, id, new ColumnSet(true));
            var existing = header.GetAttributeValue<EntityReference>(HeaderRequest);
            if (existing != null)
            {
                var prior = local.SystemService.Retrieve(Table, existing.Id, new ColumnSet("re_deliverystate"));
                return Response(prior);
            }
            if (header.GetAttributeValue<OptionSetValue>(Names.Estimate.Status)?.Value != Labels.DraftStatus ||
                header.GetAttributeValue<OptionSetValue>("statecode")?.Value != 0)
                throw new InvalidPluginExecutionException("RE-130|ESTIMATE_LOCKED");
            local.Context.SharedVariables[TrustedWrite] = id;
            // Serialize all child writers with the same header before reading the snapshots.
            var locked = new Entity(Names.Estimate.Entity, id) { RowVersion = header.RowVersion };
            locked[LockVersion] = checked(header.GetAttributeValue<int>(LockVersion) + 1);
            Update(local.UserService, locked);
            header = local.UserService.Retrieve(Names.Estimate.Entity, id, new ColumnSet(true));
            var loaded = EstimateInputLoader.Load(local.UserService, local.SystemService, header, DateTime.UtcNow.Date);
            var result = PricingEngine.Calculate(loaded.Input);
            var errors = PricingEngine.Validate(loaded.Input, result);
            if (!loaded.HasPackages || loaded.Input.EquipmentLineCount < 1 || result.Warnings.Any() ||
                !result.SuggestedPrice.HasValue || errors.Any())
                throw new InvalidPluginExecutionException(errors.Any() ? string.Join("; ", errors) : "RE-102|PRICING_NOT_AVAILABLE");
            var calculated = new Entity(Names.Estimate.Entity, id) { RowVersion = header.RowVersion };
            CalculationWriter.Write(local.SystemService, calculated, loaded, result);
            Update(local.UserService, calculated);
            header = local.UserService.Retrieve(Names.Estimate.Entity, id, new ColumnSet(true));
            var requestId = Guid.NewGuid();
            var payload = ExportSnapshot.Serialize(ExportSnapshot.Capture(local.UserService, header, requestId, command.mode));
            var request = new Entity(Table, requestId);
            request["re_name"] = requestId.ToString("D");
            request["re_estimate"] = new EntityReference(Names.Estimate.Entity, id);
            request["ownerid"] = header.GetAttributeValue<EntityReference>("ownerid");
            request["re_submissionkey"] = id.ToString("D") + ":" + header.RowVersion;
            request["re_revision"] = header.RowVersion;
            request["re_payload"] = payload;
            request["re_payloadhash"] = ExportSnapshot.Hash(payload);
            request["re_outputmode"] = command.mode;
            request["re_deliverystate"] = ExportState.Pending;
            local.SystemService.Create(request);
            var link = new Entity(Names.Estimate.Entity, id) { RowVersion = header.RowVersion };
            link[HeaderRequest] = new EntityReference(Table, requestId);
            Update(local.UserService, link);
            return Response(request);
        }

        static ExportResponse Response(Entity request)
        {
            return new ExportResponse { requestId = request.Id.ToString("D"),
                state = request.GetAttributeValue<string>("re_deliverystate") };
        }

        ExportResponse Advance(LocalContext local, ExportCommand command)
        {
            Guid id;
            if (!Guid.TryParse(command.requestId, out id))
                throw new InvalidPluginExecutionException("RE-149|EXPORT_COMMAND_REQUIRED");
            var request = local.SystemService.Retrieve(Table, id, new ColumnSet(true));
            var state = request.GetAttributeValue<string>("re_deliverystate");
            var savedRun = request.GetAttributeValue<string>("re_flowrun");
            if (command.operation == "claim" && (!string.IsNullOrEmpty(savedRun) && savedRun != command.runId ||
                state != ExportState.Pending && state != ExportState.Generating))
                return Response(request); // An occupied request is an explicit no-claim result, never permission to send.
            ExportState.VerifyRun(savedRun, command.runId);
            var next = ExportState.Next(state, command.operation);
            var parent = request.GetAttributeValue<EntityReference>("re_estimate");
            if (parent == null) throw new InvalidPluginExecutionException("RE-151|EXPORT_PARENT_INVALID");
            local.Context.SharedVariables[TrustedWrite] = parent.Id;
            var header = local.SystemService.Retrieve(Names.Estimate.Entity, parent.Id, new ColumnSet(true));
            if (header.GetAttributeValue<EntityReference>(HeaderRequest)?.Id != id)
                throw new InvalidPluginExecutionException("RE-151|EXPORT_PARENT_INVALID");
            var payload = request.GetAttributeValue<string>("re_payload");
            if (ExportSnapshot.Hash(payload) != request.GetAttributeValue<string>("re_payloadhash"))
                throw new InvalidPluginExecutionException("RE-152|EXPORT_HASH_INVALID");
            var change = new Entity(Table, id) { RowVersion = request.RowVersion };
            change["re_deliverystate"] = next;
            change["re_flowrun"] = command.runId;
            if (command.operation == "generated")
            {
                ExportState.VerifyFile(command.workbookUrl);
                if (state == ExportState.Generated &&
                    request.GetAttributeValue<string>("re_workbookurl") != command.workbookUrl)
                    throw new InvalidPluginExecutionException("RE-142|EXPORT_FILE_INVALID");
                change["re_workbookurl"] = command.workbookUrl;
            }
            if (command.operation == "sending")
            {
                ExportState.VerifyFile(request.GetAttributeValue<string>("re_workbookurl"));
                change["re_sendingon"] = DateTime.UtcNow;
            }
            if (command.operation == "accepted")
            {
                if (string.IsNullOrWhiteSpace(command.receipt) || command.receipt.Length > 200 ||
                    state == ExportState.Accepted && request.GetAttributeValue<string>("re_sendreceipt") != command.receipt)
                    throw new InvalidPluginExecutionException("RE-153|EXPORT_SEND_EVIDENCE_REQUIRED");
                change["re_sendreceipt"] = command.receipt;
                change["re_acceptedon"] = request.GetAttributeValue<DateTime?>("re_acceptedon") ?? DateTime.UtcNow;
            }
            if (command.operation == "finalize" && state != ExportState.Completed)
            {
                if (!request.Contains("re_acceptedon") || string.IsNullOrWhiteSpace(request.GetAttributeValue<string>("re_sendreceipt")))
                    throw new InvalidPluginExecutionException("RE-153|EXPORT_SEND_EVIDENCE_REQUIRED");
                if (header.GetAttributeValue<OptionSetValue>(Names.Estimate.Status)?.Value != Labels.DraftStatus)
                    throw new InvalidPluginExecutionException("RE-130|ESTIMATE_LOCKED");
                var submitted = new Entity(Names.Estimate.Entity, parent.Id) { RowVersion = header.RowVersion };
                submitted[Names.Estimate.Status] = new OptionSetValue(Labels.SubmittedStatus);
                submitted[Names.Estimate.SubmittedOn] = request.GetAttributeValue<DateTime>("re_acceptedon");
                Update(local.SystemService, submitted);
                change["re_completedon"] = DateTime.UtcNow;
            }
            Update(local.SystemService, change);
            var response = new ExportResponse { requestId = id.ToString("D"), state = next,
                claimed = command.operation == "claim" };
            if (response.claimed)
            {
                response.payload = payload;
                response.hash = request.GetAttributeValue<string>("re_payloadhash");
            }
            return response;
        }
    }

    public sealed class ExportLockPlugin : PluginBase
    {
        protected override void ExecuteCore(LocalContext local)
        {
            var target = local.Target;
            var id = target?.Id ?? local.TargetReference?.Id ?? Guid.Empty;
            if (local.Context.PrimaryEntityName == ExportRequestPlugin.Table)
            {
                Entity row = target;
                if (local.Context.MessageName != "Create")
                    row = local.SystemService.Retrieve(ExportRequestPlugin.Table, id, new ColumnSet("re_estimate"));
                var parent = row?.GetAttributeValue<EntityReference>("re_estimate");
                if (parent == null || !ExportRequestPlugin.IsTrusted(local.Context, parent.Id))
                    throw new InvalidPluginExecutionException("RE-154|EXPORT_IMMUTABLE");
                return;
            }
            if (local.Context.PrimaryEntityName == Names.Estimate.Entity)
            {
                if (local.Context.MessageName == "Create")
                {
                    if (target != null && (target.Contains(ExportRequestPlugin.HeaderRequest) ||
                        target.Contains(ExportRequestPlugin.LockVersion)))
                        throw new InvalidPluginExecutionException("RE-154|EXPORT_IMMUTABLE");
                    return;
                }
                if (target != null && target.Attributes.Count == 1 && target.Contains(ExportRequestPlugin.LockVersion) &&
                    ExportRequestPlugin.IsChildTouch(local.Context, id)) return;
                if (!ExportRequestPlugin.IsTrusted(local.Context, id))
                {
                    if (target != null && (target.Contains(ExportRequestPlugin.HeaderRequest) ||
                        target.Contains(ExportRequestPlugin.LockVersion)))
                        throw new InvalidPluginExecutionException("RE-154|EXPORT_IMMUTABLE");
                    EnsureUnlocked(local, id, false);
                }
                return;
            }
            var parents = new System.Collections.Generic.HashSet<Guid>();
            var next = target?.GetAttributeValue<EntityReference>(Names.ChildParentLookup);
            if (next != null) parents.Add(next.Id);
            if (local.Context.MessageName != "Create")
            {
                var old = local.UserService.Retrieve(local.Context.PrimaryEntityName, id, new ColumnSet(Names.ChildParentLookup));
                var previous = old.GetAttributeValue<EntityReference>(Names.ChildParentLookup);
                if (previous != null) parents.Add(previous.Id);
            }
            if (!parents.Any()) throw new InvalidPluginExecutionException("RE-131|ESTIMATE_PARENT_REQUIRED");
            foreach (var parent in parents.OrderBy(p => p)) EnsureUnlocked(local, parent, true);
        }

        static void EnsureUnlocked(LocalContext local, Guid id, bool serializeChild)
        {
            var row = local.UserService.Retrieve(Names.Estimate.Entity, id,
                new ColumnSet(ExportRequestPlugin.HeaderRequest, ExportRequestPlugin.LockVersion));
            if (row.GetAttributeValue<EntityReference>(ExportRequestPlugin.HeaderRequest) != null)
                throw new InvalidPluginExecutionException("RE-130|ESTIMATE_LOCKED");
            if (serializeChild)
            {
                // This write takes the same row lock as queuing; a concurrent queue cannot freeze stale child data.
                var touch = new Entity(Names.Estimate.Entity, id) { RowVersion = row.RowVersion };
                touch[ExportRequestPlugin.LockVersion] = checked(row.GetAttributeValue<int>(ExportRequestPlugin.LockVersion) + 1);
                // The child pipeline is not the export API, so only the lock-version write is tagged separately.
                local.Context.SharedVariables["RepairEstimator.ExportChildTouch"] = id;
                ExportRequestPlugin.Update(local.UserService, touch);
            }
        }
    }
}
