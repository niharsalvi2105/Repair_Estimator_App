using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;

namespace RepairEstimator.Drafts
{
    [DataContract]
    public sealed class ContractEquipmentResult
    {
        [DataMember] public string mode = "contracts";
        [DataMember] public bool available;
        [DataMember] public string reason;
        [DataMember] public bool more;
        [DataMember] public List<string> contracts = new List<string>();
        [DataMember] public List<string> notFound = new List<string>();
        [DataMember] public List<EquipmentInput> equipment = new List<EquipmentInput>();
    }

    internal static class ContractEquipment
    {
        static void Fail(string message) { throw new InvalidPluginExecutionException(message); }

        internal static ContractEquipmentResult Read(IOrganizationService service, Draft input)
        {
            Guid branchId;
            if (!Guid.TryParse(input.branchId, out branchId)) Fail("Select a valid branch for contract equipment.");
            var branch = service.Retrieve("re_branch", branchId, new ColumnSet("statecode", "re_market"));
            if (branch.GetAttributeValue<OptionSetValue>("statecode")?.Value != 0 ||
                branch.GetAttributeValue<OptionSetValue>("re_market")?.Value != input.market)
                Fail("Contract branch is inactive or does not match the selected market.");
            var metadata = ((RetrieveEntityResponse)service.Execute(new RetrieveEntityRequest {
                LogicalName = "re_equipment", EntityFilters = EntityFilters.Attributes, RetrieveAsIfPublished = false
            })).EntityMetadata;
            var result = new ContractEquipmentResult();
            if (new[] { "re_contractnumber", "re_contractstatus" }.Any(name =>
                !metadata.Attributes.Any(a => a.LogicalName == name && a is StringAttributeMetadata text && text.MaxLength >= 100)))
            {
                result.reason = "Contract lookup unavailable: deploy contract mapping columns, backend and approved Equipment Master data.";
                return result;
            }
            result.available = true;
            if (input.mode == "contractcapabilities") return result;
            var query = new QueryExpression("re_equipment");
            query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            query.Criteria.AddCondition("re_branch", ConditionOperator.Equal, branchId);
            query.Criteria.AddCondition("re_contractstatus", ConditionOperator.Equal, "Active");
            if (input.mode == "contractsearch")
            {
                var search = (input.search ?? "").Trim();
                if (search.Length > 100 || search.Any(c => !char.IsLetterOrDigit(c) && c != '-' && c != '.'))
                    Fail("Search contracts using letters, numbers, hyphens or dots (at most 100 characters).");
                query.ColumnSet = new ColumnSet("re_contractnumber");
                query.Distinct = true;
                query.Criteria.AddCondition("re_contractnumber", ConditionOperator.NotNull);
                if (search.Length > 0)
                    query.Criteria.AddCondition("re_contractnumber", ConditionOperator.Like, "%" + search + "%");
                query.AddOrder("re_contractnumber", OrderType.Ascending);
                query.TopCount = 21;
                var rows = service.RetrieveMultiple(query).Entities;
                result.contracts = rows.Take(20).Select(r => r.GetAttributeValue<string>("re_contractnumber")).ToList();
                if (result.contracts.Any(string.IsNullOrWhiteSpace)) Fail("Contract mapping contains empty identifiers.");
                result.more = rows.Count > 20;
                return result;
            }
            if (input.mode != "contractresolve") Fail("Unsupported contract operation.");
            var numbers = input.contractNumbers;
            if (numbers == null || numbers.Count < 1 || numbers.Count > 50 ||
                numbers.Any(n => string.IsNullOrWhiteSpace(n) || n.Length > 100 ||
                    n.Any(c => !char.IsLetterOrDigit(c) && c != '-' && c != '.')))
                Fail("Resolve between 1 and 50 valid contract numbers.");
            numbers = numbers.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            query.Criteria.AddCondition("re_contractnumber", ConditionOperator.In, numbers.Cast<object>().ToArray());
            query.ColumnSet = new ColumnSet("re_equipment", "re_equipmentname", "re_functionallocation",
                "re_soldtoname", "re_oem", "re_equipmentage", "re_contractnumber");
            query.AddOrder("re_equipment", OrderType.Ascending);
            query.AddOrder("re_equipmentid", OrderType.Ascending);
            query.PageInfo = new PagingInfo { Count = 500, PageNumber = 1 };
            var found = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var seen = new HashSet<Guid>();
            var equipmentNumbers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var cookies = new HashSet<string>();
            while (true)
            {
                var page = service.RetrieveMultiple(query);
                foreach (var row in page.Entities)
                {
                    if (!seen.Add(row.Id)) Fail("Contract equipment paging returned duplicate records.");
                    found.Add(row.GetAttributeValue<string>("re_contractnumber"));
                    var number = row.GetAttributeValue<string>("re_equipment");
                    if (string.IsNullOrWhiteSpace(number)) Fail("Contract equipment number is missing.");
                    if (!equipmentNumbers.Add(number)) Fail("Contract equipment master contains ambiguous duplicate equipment numbers.");
                    result.equipment.Add(new EquipmentInput {
                        id = row.Id.ToString(), number = number, name = row.GetAttributeValue<string>("re_equipmentname"),
                        location = row.GetAttributeValue<string>("re_functionallocation"),
                        customer = row.GetAttributeValue<string>("re_soldtoname"), oem = row.GetAttributeValue<string>("re_oem"),
                        age = row.GetAttributeValue<int?>("re_equipmentage"), matched = true
                    });
                    if (result.equipment.Count > 1000) Fail("Contract equipment exceeds the estimate processing budget. Split the request.");
                }
                if (!page.MoreRecords) break;
                if (string.IsNullOrEmpty(page.PagingCookie) || !cookies.Add(page.PagingCookie))
                    Fail("Contract equipment returned an invalid paging cookie.");
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
            result.notFound = numbers.Where(n => !found.Contains(n)).ToList();
            return result;
        }
    }
}
