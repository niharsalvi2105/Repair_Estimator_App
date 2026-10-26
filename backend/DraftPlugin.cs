using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;

namespace RepairEstimator.Drafts
{
    [DataContract]
    public sealed class Field
    {
        [DataMember] public string key;
        [DataMember] public string value;
    }

    [DataContract]
    public sealed class EquipmentInput
    {
        [DataMember] public string id;
        [DataMember] public string number;
        [DataMember] public string name;
        [DataMember] public string location;
        [DataMember] public string customer;
        [DataMember] public string oem;
        [DataMember] public int? age;
        [DataMember] public bool matched;
    }

    [DataContract]
    public sealed class PackageInput
    {
        [DataMember] public string id;
        [DataMember] public string number;
        [DataMember] public string nameEn;
        [DataMember] public string nameFr;
        [DataMember] public string scopeEn;
        [DataMember] public string scopeFr;
        [DataMember] public decimal hours;
        [DataMember] public decimal material;
    }

    [DataContract]
    public sealed class Draft
    {
        [DataMember] public string mode;
        [DataMember] public string id;
        [DataMember] public string version;
        [DataMember] public string number;
        [DataMember] public string title;
        [DataMember] public string branchId;
        [DataMember] public string stateId;
        [DataMember] public string equipmentTypeId;
        [DataMember] public string jobTypeId;
        [DataMember] public string building;
        [DataMember] public string customer;
        [DataMember] public string email;
        [DataMember] public string phone;
        [DataMember] public string salesperson;
        [DataMember] public string pricingState;
        [DataMember] public int market;
        [DataMember] public List<Field> fields = new List<Field>();
        [DataMember] public List<EquipmentInput> equipment = new List<EquipmentInput>();
        [DataMember] public List<PackageInput> packages = new List<PackageInput>();
    }

    public sealed class DraftPlugin : IPlugin
    {
        const string Estimate = "re_repairestimate";
        const string Equipment = "re_estimateequipment";
        const string Package = "re_estimatepackage";
        const int DraftStatus = 126110000;
        static readonly string[] TextFields = {
            "re_supervisor", "re_additionalscope", "re_margincomments", "re_prospectaccount",
            "re_soldto", "re_billto", "re_payer", "re_notesforcttteam"
        };
        static readonly string[] DecimalFields = {
            "re_additionallaborhours", "re_usetax", "re_freight"
        };
        static readonly string[] MoneyFields = {
            "re_subcontractorcost", "re_statedlaborrate", "re_additionalmaterial",
            "re_additionalmiscellaneous", "re_sellprice"
        };
        static readonly Dictionary<string, int> ChoiceFields = new Dictionary<string, int> {
            {"re_workcenterrequest", 2}, {"re_hasbeenapproved", 3}, {"re_nationalaccount", 2},
            {"re_emergency", 2}, {"re_customerbudgeted", 2}, {"re_papertype", 3},
            {"re_consultantinvolved", 2}, {"re_competingbids", 4},
            {"re_proposallanguage", 2}, {"re_timecategory", 2}, {"re_billingplan", 4}
        };

        public void Execute(IServiceProvider provider)
        {
            var context = (IPluginExecutionContext)provider.GetService(typeof(IPluginExecutionContext));
            var trace = (ITracingService)provider.GetService(typeof(ITracingService));
            if (!context.IsInTransaction)
                throw new InvalidPluginExecutionException("Draft saving requires a synchronous Dataverse transaction.");
            var factory = (IOrganizationServiceFactory)provider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(context.UserId);
            bool dashboardOperation = false;
            try
            {
                var input = Deserialize<Draft>((string)context.InputParameters["InputJson"]);
                dashboardOperation = input.mode == "dashboard";
                if (input.mode == "dashboard")
                {
                    context.OutputParameters["ResultJson"] = Serialize(
                        DashboardReader.Read(service, context.InitiatingUserId, input.market, DateTime.UtcNow));
                    return;
                }
                var id = Guid.Parse(input.id);
                if (input.mode == "load")
                {
                    context.OutputParameters["ResultJson"] = Serialize(Read(service, id));
                    return;
                }
                if (input.mode != "save") Fail("Unsupported draft operation.");
                Save(service, context.UserId, input, id);
                // Recalculate once, after all snapshot rows exist, if the pricing assembly is registered.
                service.Update(new Entity(Estimate, id) { ["re_numberofequipment"] = input.equipment.Count });
                context.OutputParameters["ResultJson"] = Serialize(Read(service, id));
            }
            catch (InvalidPluginExecutionException) { throw; }
            catch (Exception ex)
            {
                trace.Trace("{0} operation failed: {1}", dashboardOperation ? "Dashboard" : "Draft", ex);
                throw new InvalidPluginExecutionException(
                    (dashboardOperation ? "Dashboard could not be loaded. " : "The draft was not saved. ") + ex.Message, ex);
            }
        }

        static void Save(IOrganizationService service, Guid user, Draft input, Guid id)
        {
            if (input.fields == null || input.equipment == null || input.packages == null) Fail("Incomplete draft payload.");
            if (input.equipment.Count < 1 || input.equipment.Count > 14) Fail("Select between 1 and 14 equipment units.");
            if (input.packages.Count < 1 || input.packages.Count > 3) Fail("Select between 1 and 3 standard packages.");
            if (input.equipment.Select(x => x.number?.Trim().ToUpperInvariant()).Distinct().Count() != input.equipment.Count)
                Fail("Equipment numbers must be unique.");
            if (input.packages.Select(x => x.id).Distinct().Count() != input.packages.Count) Fail("Packages must be unique.");
            var branch = service.Retrieve("re_branch", Guid.Parse(input.branchId),
                new ColumnSet("re_country", "re_currency", "re_market", "statecode"));
            Active(branch);
            if (branch.GetAttributeValue<OptionSetValue>("re_market")?.Value != input.market) Fail("Branch does not belong to the selected market.");
            var country = branch.GetAttributeValue<EntityReference>("re_country");
            var currency = branch.GetAttributeValue<EntityReference>("re_currency");
            if (country == null || currency == null) Fail("Branch requires country and currency configuration.");
            var province = service.Retrieve("re_stateprovince", Guid.Parse(input.stateId), new ColumnSet("re_country", "re_frenchrequired", "statecode"));
            Active(province);
            if (province.GetAttributeValue<EntityReference>("re_country")?.Id != country.Id) Fail("Building province/state does not belong to the branch country.");
            var old = string.IsNullOrEmpty(input.version) ? null : service.Retrieve(Estimate, id,
                new ColumnSet("re_estimatestatus", "statecode", "re_salesperson", "re_branch", "transactioncurrencyid", "ownerid"));
            if (old != null)
            {
                if (old.GetAttributeValue<OptionSetValue>("re_estimatestatus")?.Value != DraftStatus) Fail("Only Draft estimates can be edited.");
                Active(old);
                if (old.GetAttributeValue<EntityReference>("re_branch")?.Id != branch.Id ||
                    old.GetAttributeValue<EntityReference>("transactioncurrencyid")?.Id != currency.Id)
                    Fail("An existing draft cannot change branch or currency. Start a new estimate instead.");
                var labor = new QueryExpression("re_estimatelaborline") { ColumnSet = new ColumnSet(false), TopCount = 1 };
                labor.Criteria.AddCondition("re_repairestimate", ConditionOperator.Equal, id);
                if (service.RetrieveMultiple(labor).Entities.Count != 0)
                    Fail("This draft contains labor lines. Editing it requires the line-preserving workflow, which is not available yet.");
            }
            var header = new Entity(Estimate, id);
            header["re_estimatename"] = Required(input.title, 100, "Estimate title");
            header["re_buildingname"] = Required(input.building, 300, "Building name");
            header["re_customername"] = Required(input.customer, 300, "Customer name");
            header["re_customeremail"] = Optional(input.email, 100);
            header["re_customerphone"] = Optional(input.phone, 100);
            header["re_branch"] = branch.ToEntityReference();
            header["re_country"] = country;
            header["re_buildingprovincestate"] = province.ToEntityReference();
            header["transactioncurrencyid"] = currency;
            header["re_equipmenttype"] = Reference(service, "re_equipmenttype", input.equipmentTypeId);
            header["re_jobtype"] = string.IsNullOrEmpty(input.jobTypeId) ? null : Reference(service, "re_jobtype", input.jobTypeId);
            header["re_market"] = new OptionSetValue(input.market);
            header["re_numberofequipment"] = input.equipment.Count;
            header["re_estimatepath"] = new OptionSetValue(126110000);
            header["re_estimatetype"] = new OptionSetValue(126110000);
            ApplyFields(header, input.fields);
            if (province.GetAttributeValue<bool>("re_frenchrequired") &&
                header.GetAttributeValue<OptionSetValue>("re_proposallanguage")?.Value != 126110001)
                Fail("The selected province requires French proposal language.");
            if (old == null)
            {
                header["re_estimatestatus"] = new OptionSetValue(DraftStatus);
                header["re_revisionnumber"] = 1;
                header["re_salesperson"] = new EntityReference("systemuser", user);
                var create = new CreateRequest { Target = header };
                create["tag"] = "RepairEstimator.DraftBatch:" + id.ToString("D");
                service.Execute(create);
            }
            else
            {
                header.RowVersion = input.version;
                var update = new UpdateRequest { Target = header, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches };
                update["tag"] = "RepairEstimator.DraftBatch:" + id.ToString("D");
                service.Execute(update);
            }
            var priorEquipment = Children(service, Equipment, id);
            var priorPackages = Children(service, Package, id);
            var equipmentRows = new List<Entity>();
            for (int i = 0; i < input.equipment.Count; i++)
            {
                var item = input.equipment[i];
                var row = new Entity(Equipment);
                row["re_name"] = Required(item.number, 20, "Equipment number");
                row["re_equipmentnumber"] = item.number.Trim();
                row["re_sequence"] = i + 1;
                row["re_isprimary"] = i == 0;
                row["re_repairestimate"] = header.ToEntityReference();
                row["ownerid"] = old?.GetAttributeValue<EntityReference>("ownerid") ?? new EntityReference("systemuser", user);
                Entity previous = priorEquipment.FirstOrDefault(e =>
                    e.GetAttributeValue<string>("re_equipmentnumber") == item.number &&
                    (e.GetAttributeValue<EntityReference>("re_equipment")?.Id.ToString() ?? "") == (item.matched ? item.id : ""));
                if (previous != null)
                {
                    Copy(previous, row, "re_equipment", "re_equipmentnamesnapshot", "re_functionallocation",
                        "re_soldtoname", "re_soldtonumber", "re_verticalcode", "re_oem", "re_equipmentage");
                }
                else if (item.matched)
                {
                    var master = service.Retrieve("re_equipment", Guid.Parse(item.id),
                        new ColumnSet("re_equipment", "re_equipmentname", "re_branch", "re_functionallocation",
                            "re_soldtoname", "re_soldtonumber", "re_verticalcode", "re_oem", "re_equipmentage", "statecode"));
                    Active(master);
                    if (master.GetAttributeValue<EntityReference>("re_branch")?.Id != branch.Id) Fail("Equipment is outside the selected branch.");
                    if (master.GetAttributeValue<string>("re_equipment") != item.number) Fail("Equipment number does not match its lookup.");
                    row["re_equipment"] = master.ToEntityReference();
                    row["re_equipmentnamesnapshot"] = master.GetAttributeValue<string>("re_equipmentname");
                    Copy(master, row, "re_functionallocation", "re_soldtoname", "re_soldtonumber", "re_verticalcode", "re_oem", "re_equipmentage");
                }
                equipmentRows.Add(row);
            }
            var packageRows = new List<Entity>();
            for (int i = 0; i < input.packages.Count; i++)
            {
                var packageId = Guid.Parse(input.packages[i].id);
                var row = new Entity(Package);
                var previous = priorPackages.FirstOrDefault(p => p.GetAttributeValue<EntityReference>("re_repairpackage")?.Id == packageId);
                if (previous != null)
                {
                    Copy(previous, row, "re_packagenumber", "re_packagenameen", "re_packagenamefr", "re_proposalscopeen",
                        "re_proposalscopefr", "re_mechanichoursperunit", "re_materialcostperunit");
                }
                else
                {
                    var master = service.Retrieve("re_repairpackage", packageId,
                        new ColumnSet("re_packagenumber", "re_packagenameen", "re_packagenamefr", "re_proposalscopeen",
                            "re_proposalscopefr", "re_mechanichours", "re_materialmisctaxcost", "re_country",
                            "re_currency", "transactioncurrencyid", "re_iscustompackage", "re_istimematerial",
                            "re_effectivefrom", "re_effectiveto", "statecode"));
                    Active(master);
                    if (master.GetAttributeValue<bool>("re_iscustompackage") || master.GetAttributeValue<bool>("re_istimematerial"))
                        Fail("This draft workflow supports standard packages only.");
                    var pc = master.GetAttributeValue<EntityReference>("re_country");
                    if (pc != null && pc.Id != country.Id) Fail("Package country does not match the branch.");
                    var mc = master.GetAttributeValue<EntityReference>("re_currency") ?? master.GetAttributeValue<EntityReference>("transactioncurrencyid");
                    if (mc == null || mc.Id != currency.Id) Fail("Package currency does not match the branch.");
                    if (master.GetAttributeValue<DateTime>("re_effectivefrom").Date > DateTime.UtcNow.Date ||
                        (master.Contains("re_effectiveto") && master.GetAttributeValue<DateTime>("re_effectiveto").Date < DateTime.UtcNow.Date))
                        Fail("Package is outside its effective dates.");
                    Copy(master, row, "re_packagenumber", "re_packagenameen", "re_packagenamefr", "re_proposalscopeen", "re_proposalscopefr");
                    if (!master.Contains("re_mechanichours") || !master.Contains("re_materialmisctaxcost")) Fail("Package hours or material cost is missing.");
                    row["re_mechanichoursperunit"] = master.GetAttributeValue<decimal>("re_mechanichours");
                    row["re_materialcostperunit"] = master.GetAttributeValue<Money>("re_materialmisctaxcost");
                }
                row["re_name"] = row.GetAttributeValue<string>("re_packagenumber");
                row["re_repairpackage"] = new EntityReference("re_repairpackage", packageId);
                row["re_repairestimate"] = header.ToEntityReference();
                row["ownerid"] = old?.GetAttributeValue<EntityReference>("ownerid") ?? new EntityReference("systemuser", user);
                row["transactioncurrencyid"] = currency;
                row["re_packagerole"] = new OptionSetValue(126110000 + i);
                row["re_quantity"] = input.equipment.Count;
                row["re_totalhours"] = row.GetAttributeValue<decimal>("re_mechanichoursperunit") * input.equipment.Count;
                row["re_totalmaterial"] = new Money(row.GetAttributeValue<Money>("re_materialcostperunit").Value * input.equipment.Count);
                packageRows.Add(row);
            }
            foreach (var row in priorPackages.Concat(priorEquipment))
            {
                var delete = new DeleteRequest { Target = row.ToEntityReference() };
                delete["tag"] = "RepairEstimator.DraftBatch:" + id.ToString("D");
                service.Execute(delete);
            }
            foreach (var row in equipmentRows.Concat(packageRows))
            {
                var create = new CreateRequest { Target = row };
                create["tag"] = "RepairEstimator.DraftBatch:" + id.ToString("D");
                service.Execute(create);
            }
        }

        static void ApplyFields(Entity header, List<Field> fields)
        {
            if (fields.GroupBy(f => f.key).Any(g => g.Count() != 1)) Fail("Duplicate input field.");
            foreach (var field in fields)
            {
                var key = field.key;
                var value = field.value;
                if (TextFields.Contains(key))
                {
                    header[key] = Optional(value, new[] { "re_prospectaccount", "re_soldto", "re_billto", "re_payer" }.Contains(key) ? 50 :
                        key == "re_supervisor" ? 100 : 10000);
                }
                else if (ChoiceFields.ContainsKey(key))
                {
                    if (string.IsNullOrEmpty(value)) { header[key] = null; continue; }
                    int choice;
                    if (!int.TryParse(value, out choice) || choice < 126110000 || choice >= 126110000 + ChoiceFields[key])
                        Fail("Invalid choice: " + key);
                    header[key] = new OptionSetValue(choice);
                }
                else if (key == "re_numberoftechs")
                {
                    if (string.IsNullOrEmpty(value)) { header[key] = null; continue; }
                    int count;
                    if (!int.TryParse(value, out count) || count < 1 || count > 3) Fail("Technician count must be 1 to 3.");
                    header[key] = count;
                }
                else if (DecimalFields.Contains(key) || MoneyFields.Contains(key))
                {
                    if (string.IsNullOrEmpty(value)) { header[key] = null; continue; }
                    decimal number;
                    if (!decimal.TryParse(value, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out number) || number < 0)
                        Fail("Invalid non-negative number: " + key);
                    if (key == "re_usetax" || key == "re_freight")
                    {
                        if (number > 100) Fail("Tax and freight must be between 0 and 100 percent.");
                        number /= 100m;
                    }
                    header[key] = MoneyFields.Contains(key) ? (object)new Money(number) : number;
                }
                else Fail("Unsupported draft field: " + key);
            }
            foreach (var key in new[] { "re_proposallanguage", "re_timecategory", "re_usetax", "re_freight" })
                if (!header.Contains(key) || header[key] == null) Fail("Required input is missing: " + key);
        }

        static Draft Read(IOrganizationService service, Guid id)
        {
            var row = service.Retrieve(Estimate, id, new ColumnSet(true));
            Active(row);
            if (row.GetAttributeValue<OptionSetValue>("re_estimatestatus")?.Value != DraftStatus) Fail("Only Draft estimates can be reopened here.");
            var result = new Draft {
                mode = "save", id = id.ToString(), version = row.RowVersion,
                number = row.GetAttributeValue<string>("re_name"), title = row.GetAttributeValue<string>("re_estimatename"),
                branchId = Id(row, "re_branch"), stateId = Id(row, "re_buildingprovincestate"),
                equipmentTypeId = Id(row, "re_equipmenttype"), jobTypeId = Id(row, "re_jobtype"),
                building = row.GetAttributeValue<string>("re_buildingname"), customer = row.GetAttributeValue<string>("re_customername"),
                email = row.GetAttributeValue<string>("re_customeremail"), phone = row.GetAttributeValue<string>("re_customerphone"),
                salesperson = row.GetAttributeValue<EntityReference>("re_salesperson")?.Name,
                pricingState = row.GetAttributeValue<string>("re_calculationversion"),
                market = row.GetAttributeValue<OptionSetValue>("re_market").Value
            };
            foreach (var key in TextFields.Concat(DecimalFields).Concat(MoneyFields).Concat(ChoiceFields.Keys).Concat(new[] { "re_numberoftechs" }))
            {
                object value;
                row.Attributes.TryGetValue(key, out value);
                if (value is OptionSetValue option) value = option.Value;
                if (value is Money money) value = money.Value;
                if ((key == "re_usetax" || key == "re_freight") && value is decimal rate) value = rate * 100m;
                result.fields.Add(new Field { key = key, value = value == null ? "" : Convert.ToString(value, CultureInfo.InvariantCulture) });
            }
            foreach (var e in Children(service, Equipment, id).OrderBy(e => e.GetAttributeValue<int>("re_sequence")))
                result.equipment.Add(new EquipmentInput {
                    id = Id(e, "re_equipment"), matched = e.Contains("re_equipment"),
                    number = e.GetAttributeValue<string>("re_equipmentnumber"), name = e.GetAttributeValue<string>("re_equipmentnamesnapshot"),
                    location = e.GetAttributeValue<string>("re_functionallocation"), customer = e.GetAttributeValue<string>("re_soldtoname"),
                    oem = e.GetAttributeValue<string>("re_oem"), age = e.Contains("re_equipmentage") ? (int?)e.GetAttributeValue<int>("re_equipmentage") : null
                });
            foreach (var p in Children(service, Package, id).OrderBy(p => p.GetAttributeValue<OptionSetValue>("re_packagerole").Value))
                result.packages.Add(new PackageInput {
                    id = Id(p, "re_repairpackage"), number = p.GetAttributeValue<string>("re_packagenumber"),
                    nameEn = p.GetAttributeValue<string>("re_packagenameen"), nameFr = p.GetAttributeValue<string>("re_packagenamefr"),
                    scopeEn = p.GetAttributeValue<string>("re_proposalscopeen"), scopeFr = p.GetAttributeValue<string>("re_proposalscopefr"),
                    hours = p.GetAttributeValue<decimal>("re_mechanichoursperunit"),
                    material = p.GetAttributeValue<Money>("re_materialcostperunit").Value
                });
            return result;
        }

        static List<Entity> Children(IOrganizationService service, string table, Guid id)
        {
            var query = new QueryExpression(table) { ColumnSet = new ColumnSet(true), TopCount = 100 };
            query.Criteria.AddCondition("re_repairestimate", ConditionOperator.Equal, id);
            var records = service.RetrieveMultiple(query);
            if (records.MoreRecords || records.Entities.Count >= 100) Fail("Draft child count exceeds the supported limit.");
            return records.Entities.ToList();
        }
        static EntityReference Reference(IOrganizationService service, string table, string id)
        {
            var row = service.Retrieve(table, Guid.Parse(id), new ColumnSet("statecode"));
            Active(row);
            return row.ToEntityReference();
        }
        static string Id(Entity row, string key) => row.GetAttributeValue<EntityReference>(key)?.Id.ToString() ?? "";
        static void Active(Entity row) { if (row.GetAttributeValue<OptionSetValue>("statecode")?.Value != 0) Fail("Selected record is inactive."); }
        static void Copy(Entity source, Entity target, params string[] fields)
        { foreach (var field in fields) if (source.Contains(field)) target[field] = source[field]; }
        static string Required(string value, int max, string name)
        { if (string.IsNullOrWhiteSpace(value)) Fail(name + " is required."); return Optional(value.Trim(), max); }
        static string Optional(string value, int max)
        { if (value != null && value.Length > max) Fail("Text exceeds " + max + " characters."); return string.IsNullOrEmpty(value) ? null : value; }
        static void Fail(string message) { throw new InvalidPluginExecutionException(message); }
        static T Deserialize<T>(string json)
        {
            if (json == null || json.Length > 200000) throw new InvalidPluginExecutionException("Invalid draft payload size.");
            using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(json)))
                return (T)new DataContractJsonSerializer(typeof(T)).ReadObject(stream);
        }
        static string Serialize<T>(T value)
        {
            using (var stream = new MemoryStream())
            { new DataContractJsonSerializer(typeof(T)).WriteObject(stream, value); return Encoding.UTF8.GetString(stream.ToArray()); }
        }
    }
}
