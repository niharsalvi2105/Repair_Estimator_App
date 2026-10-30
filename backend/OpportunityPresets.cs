using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;

namespace RepairEstimator.Drafts
{
    [DataContract]
    public sealed class OpportunityPreset
    {
        [DataMember] public string id;
        [DataMember] public string name;
        [DataMember] public OpportunityValues opportunity;
    }

    [DataContract]
    public sealed class PresetResult
    {
        [DataMember] public string mode = "presets";
        [DataMember] public List<OpportunityPreset> presets = new List<OpportunityPreset>();
        [DataMember] public string nextToken;
    }

    internal static class OpportunityPresets
    {
        const string Table = "re_opportunitypreset";
        static readonly string[] Fields = {
            "re_supervisor", "re_workcenterrequest", "re_numberoftechs", "re_nationalaccount", "re_emergency",
            "re_customerbudgeted", "re_papertype", "re_consultantinvolved", "re_competingbids", "re_proposallanguage"
        };
        static void Fail(string message) { throw new InvalidPluginExecutionException(message); }
        static Entity Active(IOrganizationService service, string table, string id, params string[] columns)
        {
            Guid key;
            if (!Guid.TryParse(id, out key)) Fail("Invalid Opportunity reference: " + table);
            var row = service.Retrieve(table, key, new ColumnSet(columns.Concat(new[] { "statecode" }).ToArray()));
            if (row.GetAttributeValue<OptionSetValue>("statecode")?.Value != 0) Fail("Opportunity reference is inactive: " + table);
            return row;
        }
        static string Required(string value, int max)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length > max) Fail("Complete valid Opportunity details before saving a preset.");
            return value.Trim();
        }
        static string Optional(string value, int max)
        {
            if (value != null && value.Length > max) Fail("Opportunity text is too long.");
            return (value ?? "").Trim();
        }
        static OpportunityValues Validate(IOrganizationService service, OpportunityValues value)
        {
            if (value == null || value.market < 126110000 || value.market > 126110002 || value.fields == null ||
                value.fields.Any(field => field == null || !Fields.Contains(field.key)))
                Fail("Invalid Opportunity preset fields.");
            var branch = Active(service, "re_branch", value.branchId, "re_market", "re_country", "re_currency");
            if (branch.GetAttributeValue<OptionSetValue>("re_market")?.Value != value.market ||
                branch.GetAttributeValue<EntityReference>("re_currency") == null)
                Fail("Opportunity branch market/currency is invalid.");
            var province = Active(service, "re_stateprovince", value.stateId, "re_country", "re_frenchrequired");
            if (branch.GetAttributeValue<EntityReference>("re_country") == null ||
                branch.GetAttributeValue<EntityReference>("re_country")?.Id != province.GetAttributeValue<EntityReference>("re_country")?.Id)
                Fail("Opportunity province/state does not match the branch country.");
            Active(service, "re_equipmenttype", value.equipmentTypeId);
            if (!string.IsNullOrEmpty(value.jobTypeId)) Active(service, "re_jobtype", value.jobTypeId);
            var header = new Entity("re_repairestimate");
            DraftPlugin.ApplyFields(header, value.fields, false);
            DraftPlugin.ValidateChoices(service, header);
            if (province.GetAttributeValue<bool>("re_frenchrequired") &&
                header.GetAttributeValue<OptionSetValue>("re_proposallanguage")?.Value != 126110001)
                Fail("The selected province requires French proposal language.");
            return new OpportunityValues {
                branchId = branch.Id.ToString(), stateId = province.Id.ToString(),
                equipmentTypeId = value.equipmentTypeId, jobTypeId = value.jobTypeId ?? "",
                market = value.market, building = Required(value.building, 300),
                customer = Required(value.customer, 300), email = Required(value.email, 100),
                phone = Optional(value.phone, 100), fields = value.fields
            };
        }
        static void Schema(IOrganizationService service)
        {
            var entities = (RetrieveAllEntitiesResponse)service.Execute(new RetrieveAllEntitiesRequest {
                EntityFilters = EntityFilters.Entity, RetrieveAsIfPublished = false
            });
            if (!entities.EntityMetadata.Any(entity => entity.LogicalName == Table))
                Fail("Opportunity presets are unavailable. Deploy the private preset table and updated draft API.");
            var metadata = ((RetrieveEntityResponse)service.Execute(new RetrieveEntityRequest {
                LogicalName = Table, EntityFilters = EntityFilters.Entity | EntityFilters.Attributes, RetrieveAsIfPublished = false
            })).EntityMetadata;
            if (metadata.OwnershipType != OwnershipTypes.UserOwned ||
                !metadata.Attributes.Any(a => a.LogicalName == "re_name" && a is StringAttributeMetadata name && name.MaxLength >= 100) ||
                !metadata.Attributes.Any(a => a.LogicalName == "re_payload" && a is MemoAttributeMetadata memo && memo.MaxLength >= 20000) ||
                !metadata.Attributes.Any(a => a.LogicalName == "re_market" && a is PicklistAttributeMetadata choice &&
                    choice.OptionSet != null && new[] { 126110000, 126110001, 126110002 }
                        .All(v => choice.OptionSet.Options.Any(option => option.Value == v))))
                Fail("Opportunity preset schema is incompatible. Review ownership, fields and payload capacity.");
        }
        internal static PresetResult Execute(IOrganizationService service, Guid user, Draft input)
        {
            Schema(service);
            if (input.mode == "presetlist")
            {
                if (input.market < 126110000 || input.market > 126110002) Fail("Invalid preset market.");
                var query = new QueryExpression(Table) {
                    ColumnSet = new ColumnSet("re_name", "re_payload", "re_market"),
                    PageInfo = new PagingInfo { Count = 50, PageNumber = 1 }
                };
                if (!string.IsNullOrEmpty(input.nextToken))
                {
                    var token = DraftPlugin.Deserialize<PresetPage>(input.nextToken);
                    if (token == null || token.page < 2 || token.user != user.ToString() || token.market != input.market) Fail("Invalid preset paging token.");
                    query.PageInfo.PageNumber = token.page;
                    query.PageInfo.PagingCookie = token.cookie;
                }
                query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
                query.Criteria.AddCondition("ownerid", ConditionOperator.Equal, user);
                query.Criteria.AddCondition("re_market", ConditionOperator.Equal, input.market);
                query.AddOrder("re_name", OrderType.Ascending);
                query.AddOrder("re_opportunitypresetid", OrderType.Ascending);
                var rows = service.RetrieveMultiple(query);
                var result = new PresetResult();
                foreach (var row in rows.Entities)
                {
                    var payload = row.GetAttributeValue<string>("re_payload");
                    if (string.IsNullOrWhiteSpace(payload)) Fail("Saved Opportunity preset has no payload. Contact your administrator.");
                    var data = DraftPlugin.Deserialize<OpportunityValues>(payload);
                    if (data == null || data.market != input.market || data.fields == null || data.fields.Any(field => field == null || !Fields.Contains(field.key)))
                        Fail("Saved Opportunity preset is invalid. Contact your administrator.");
                    result.presets.Add(new OpportunityPreset { id = row.Id.ToString(), name = row.GetAttributeValue<string>("re_name"), opportunity = data });
                }
                if (rows.MoreRecords)
                {
                    if (rows.Entities.Count == 0) Fail("Invalid preset paging response.");
                    result.nextToken = DraftPlugin.Serialize(new PresetPage {
                        page = query.PageInfo.PageNumber + 1, cookie = rows.PagingCookie, user = user.ToString(), market = input.market
                    });
                }
                return result;
            }
            if (input.mode == "presetsave")
            {
                var data = Validate(service, input.opportunity);
                var payload = DraftPlugin.Serialize(data);
                if (Encoding.UTF8.GetByteCount(payload) > 20000) Fail("Opportunity preset exceeds the supported size.");
                var name = Required(input.presetName, 100);
                var duplicates = new QueryExpression(Table) { ColumnSet = new ColumnSet(false), TopCount = 1 };
                duplicates.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
                duplicates.Criteria.AddCondition("ownerid", ConditionOperator.Equal, user);
                duplicates.Criteria.AddCondition("re_market", ConditionOperator.Equal, data.market);
                duplicates.Criteria.AddCondition("re_name", ConditionOperator.Equal, name);
                if (service.RetrieveMultiple(duplicates).Entities.Count > 0) Fail("A preset with this name already exists. Choose another name.");
                var id = service.Create(new Entity(Table) {
                    ["re_name"] = name, ["re_payload"] = payload, ["re_market"] = new OptionSetValue(data.market),
                    ["ownerid"] = new EntityReference("systemuser", user)
                });
                return new PresetResult { presets = new List<OpportunityPreset> {
                    new OpportunityPreset { id = id.ToString(), name = name, opportunity = data }
                } };
            }
            if (input.mode == "presetdelete")
            {
                Guid id;
                if (!Guid.TryParse(input.id, out id)) Fail("Invalid preset ID.");
                var row = service.Retrieve(Table, id, new ColumnSet("ownerid"));
                if (row.GetAttributeValue<EntityReference>("ownerid")?.Id != user)
                    Fail("Only the creator can delete this Opportunity preset.");
                service.Delete(Table, id);
                return new PresetResult();
            }
            Fail("Unsupported Opportunity preset operation.");
            return null;
        }
        [DataContract]
        sealed class PresetPage
        {
            [DataMember] public int page;
            [DataMember] public string cookie;
            [DataMember] public string user;
            [DataMember] public int market;
        }
    }
}
