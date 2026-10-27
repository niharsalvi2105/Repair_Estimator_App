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
        [DataMember] public bool isCustom;
        [DataMember] public bool isTimeMaterial;
    }

    [DataContract]
    public sealed class LaborInput
    {
        [DataMember] public string id;
        [DataMember] public int role;
        [DataMember] public int time;
        [DataMember] public decimal hours;
        [DataMember] public decimal rate;
    }

    [DataContract]
    public sealed class MaterialInput
    {
        [DataMember] public string id;
        [DataMember] public string description;
        [DataMember] public string vendor;
        [DataMember] public string part;
        [DataMember] public decimal quantity;
        [DataMember] public decimal unitCost;
    }

    [DataContract]
    public sealed class Draft
    {
        [DataMember] public string mode;
        [DataMember] public int status;
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
        [DataMember] public List<LaborInput> laborLines;
        [DataMember] public List<MaterialInput> materialLines;
    }

    public sealed class DraftPlugin : IPlugin
    {
        const string Estimate = "re_repairestimate";
        const string Equipment = "re_estimateequipment";
        const string Package = "re_estimatepackage";
        const string Labor = "re_estimatelaborline";
        const string Material = "re_estimatematerialline";
        const int MaxPayloadBytes = 200000;
        const int MaxChildOperations = 1000;
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
            "re_additionalmiscellaneous", "re_sellprice", "re_konesparessalespricevk13"
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
                if (input.mode != "save" && input.mode != "submit") Fail("Unsupported draft operation.");
                Save(service, context.UserId, input, id);
                // Recalculate once, after all snapshot rows exist, if the pricing assembly is registered.
                service.Update(new Entity(Estimate, id) { ["re_numberofequipment"] = input.equipment.Count });
                if (input.mode == "submit") Submit(service, id);
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
            if (input.packages.Count < 1) Fail("Select at least one package.");
            if (input.equipment.Any(x => x == null) || input.packages.Any(x => x == null) || input.fields.Any(x => x == null))
                Fail("Invalid draft row.");
            var priorLabor = Children(service, Labor, id);
            var priorMaterial = Children(service, Material, id);
            if ((input.laborLines == null && priorLabor.Count != 0) || (input.materialLines == null && priorMaterial.Count != 0))
                Fail("This draft contains labor lines or material lines. Reload with the current app before editing.");
            input.laborLines = input.laborLines ?? new List<LaborInput>();
            input.materialLines = input.materialLines ?? new List<MaterialInput>();
            if (input.laborLines.Any(x => x == null) || input.materialLines.Any(x => x == null)) Fail("Invalid custom line.");
            if (input.packages.Count + input.equipment.Count + input.laborLines.Count + input.materialLines.Count > MaxChildOperations)
                Fail("Draft exceeds the technical processing budget. Split this request into smaller estimates.");
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
                    row.Id = previous.Id;
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
                    row.Id = previous.Id;
                    Copy(previous, row, "re_packagenumber", "re_packagenameen", "re_packagenamefr", "re_proposalscopeen",
                        "re_proposalscopefr", "re_mechanichoursperunit", "re_materialcostperunit", "re_iscustompackage", "re_istimematerial");
                }
                else
                {
                    var master = service.Retrieve("re_repairpackage", packageId,
                        new ColumnSet("re_packagenumber", "re_packagenameen", "re_packagenamefr", "re_proposalscopeen",
                            "re_proposalscopefr", "re_mechanichours", "re_materialmisctaxcost", "re_country",
                            "re_currency", "transactioncurrencyid", "re_iscustompackage", "re_istimematerial",
                            "re_effectivefrom", "re_effectiveto", "statecode"));
                    Active(master);
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
                    row["re_iscustompackage"] = master.GetAttributeValue<bool>("re_iscustompackage");
                    row["re_istimematerial"] = master.GetAttributeValue<bool>("re_istimematerial");
                }
                row["re_name"] = row.GetAttributeValue<string>("re_packagenumber");
                if (row.GetAttributeValue<decimal>("re_mechanichoursperunit") < 0 ||
                    row.GetAttributeValue<Money>("re_materialcostperunit").Value < 0)
                    Fail("Package hours and material cost must be nonnegative.");
                row["re_repairpackage"] = new EntityReference("re_repairpackage", packageId);
                row["re_repairestimate"] = header.ToEntityReference();
                row["ownerid"] = old?.GetAttributeValue<EntityReference>("ownerid") ?? new EntityReference("systemuser", user);
                row["transactioncurrencyid"] = currency;
                row["re_packagerole"] = new OptionSetValue(126110000 + Math.Min(i, 2));
                row["re_sequence"] = i + 1;
                row["re_quantity"] = input.equipment.Count;
                row["re_totalhours"] = row.GetAttributeValue<decimal>("re_mechanichoursperunit") * input.equipment.Count;
                row["re_totalmaterial"] = new Money(row.GetAttributeValue<Money>("re_materialcostperunit").Value * input.equipment.Count);
                packageRows.Add(row);
            }
            bool custom = packageRows.Any(p => p.GetAttributeValue<bool>("re_iscustompackage"));
            if (!custom && (input.laborLines.Count != 0 || input.materialLines.Count != 0))
                Fail("Custom labor/material lines require a CSTM package. Remove the lines explicitly before removing CSTM.");
            if (!custom && header.GetAttributeValue<Money>("re_konesparessalespricevk13")?.Value > 0)
                Fail("KONE spares sales price requires a CSTM package.");
            var lineRows = BuildLines(service, input, priorLabor, priorMaterial, header, branch, currency,
                old?.GetAttributeValue<EntityReference>("ownerid") ?? new EntityReference("systemuser", user));
            var prior = priorEquipment.Concat(priorPackages).Concat(priorLabor).Concat(priorMaterial).ToList();
            var desired = equipmentRows.Concat(packageRows).Concat(lineRows).ToList();
            var retained = new HashSet<Guid>(desired.Where(r => r.Id != Guid.Empty).Select(r => r.Id));
            var removed = prior.Where(r => !retained.Contains(r.Id)).OrderBy(r => r.LogicalName == Equipment ? 1 : 0).ToList();
            if (priorLabor.Concat(priorMaterial).Any(r => retained.Contains(r.Id) &&
                r.GetAttributeValue<EntityReference>("re_estimateequipment") is EntityReference linked &&
                removed.Any(e => e.LogicalName == Equipment && e.Id == linked.Id)))
                Fail("Remove custom lines linked to removed equipment before saving.");
            if (desired.Count + removed.Count > MaxChildOperations)
                Fail("Draft exceeds the technical processing budget. Split this request into smaller estimates.");
            foreach (var row in removed)
            {
                var delete = new DeleteRequest { Target = row.ToEntityReference() };
                delete["tag"] = "RepairEstimator.DraftBatch:" + id.ToString("D");
                service.Execute(delete);
            }
            var existing = new HashSet<Guid>(prior.Select(r => r.Id));
            foreach (var row in desired)
            {
                OrganizationRequest write = existing.Contains(row.Id)
                    ? (OrganizationRequest)new UpdateRequest { Target = row } : new CreateRequest { Target = row };
                write["tag"] = "RepairEstimator.DraftBatch:" + id.ToString("D");
                service.Execute(write);
            }
            var path = new UpdateRequest { Target = new Entity(Estimate, id) {
                ["re_estimatepath"] = new OptionSetValue(custom ? 126110001 : 126110000)
            }};
            path["tag"] = "RepairEstimator.DraftBatch:" + id.ToString("D");
            service.Execute(path);
        }

        static void Submit(IOrganizationService service, Guid id)
        {
            var row = service.Retrieve(Estimate, id, new ColumnSet("re_estimatestatus", "re_calculationversion",
                "re_calculatedon", "re_totaltruecost", "re_suggestedprice", "re_recommendedcmii",
                "re_sellprice", "re_actualcmii", "re_cmiivariance", "re_margincomments"));
            if (row.GetAttributeValue<OptionSetValue>("re_estimatestatus")?.Value != DraftStatus)
                Fail("Only Draft estimates can be submitted.");
            var calculation = row.GetAttributeValue<string>("re_calculationversion");
            var margin = row.GetAttributeValue<decimal?>("re_recommendedcmii");
            if (string.IsNullOrWhiteSpace(calculation) || calculation == "unavailable" ||
                !row.Contains("re_calculatedon") || row["re_calculatedon"] == null ||
                row.GetAttributeValue<Money>("re_totaltruecost") == null ||
                row.GetAttributeValue<Money>("re_suggestedprice") == null ||
                !margin.HasValue || margin < 0 || margin >= 1)
                Fail("RE-102|PRICING_NOT_AVAILABLE");
            if ((row.GetAttributeValue<Money>("re_sellprice")?.Value ?? 0m) <= 0m)
                Fail("RE-100|SELL_PRICE_REQUIRED");
            if (!row.GetAttributeValue<decimal?>("re_actualcmii").HasValue ||
                !row.GetAttributeValue<decimal?>("re_cmiivariance").HasValue)
                Fail("RE-102|PRICING_NOT_AVAILABLE");
            if (row.GetAttributeValue<decimal>("re_cmiivariance") < 0m &&
                string.IsNullOrWhiteSpace(row.GetAttributeValue<string>("re_margincomments")))
                Fail("RE-101|MARGIN_COMMENT_REQUIRED");
            // This untagged status update runs the calculation plug-in's full submission validation.
            service.Update(new Entity(Estimate, id) {
                ["re_estimatestatus"] = new OptionSetValue(126110002),
                ["re_submittedon"] = DateTime.UtcNow
            });
        }

        static List<Entity> BuildLines(IOrganizationService service, Draft input, List<Entity> priorLabor,
            List<Entity> priorMaterial, Entity header, Entity branch, EntityReference currency, EntityReference owner)
        {
            var rows = new List<Entity>();
            var seen = new HashSet<string>();
            var rates = new Dictionary<string, Entity>();
            foreach (var line in input.laborLines)
            {
                if (!string.IsNullOrEmpty(line.id) && !seen.Add(line.id)) Fail("Duplicate custom line ID.");
                if (line.role < 126110000 || line.role > 126110002 || line.time < 126110000 || line.time > 126110001 ||
                    line.hours < 0 || line.hours > 100000 || decimal.Round(line.hours, 2) != line.hours)
                    Fail("Invalid labor role, time category or hours (maximum 100000, two decimals).");
                var previous = priorLabor.FirstOrDefault(r => r.Id.ToString() == line.id);
                var row = new Entity(Labor, previous?.Id ?? Guid.NewGuid());
                if (previous != null && previous.GetAttributeValue<OptionSetValue>("re_laborrole")?.Value == line.role &&
                    previous.GetAttributeValue<OptionSetValue>("re_timecategory")?.Value == line.time &&
                    previous.Contains("re_hourlycost") && previous.Contains("re_laborrate"))
                    Copy(previous, row, "re_hourlycost", "re_laborrate");
                else
                {
                    var key = line.role + ":" + line.time;
                    if (!rates.TryGetValue(key, out var rate))
                    {
                        var query = new QueryExpression("re_laborrate") {
                            ColumnSet = new ColumnSet("re_hourlycost"), TopCount = 2
                        };
                        query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
                        query.Criteria.AddCondition("re_branch", ConditionOperator.Equal, branch.Id);
                        query.Criteria.AddCondition("re_laborrole", ConditionOperator.Equal, line.role);
                        query.Criteria.AddCondition("re_timecategory", ConditionOperator.Equal, line.time);
                        query.Criteria.AddCondition("re_effectivefrom", ConditionOperator.LessEqual, DateTime.UtcNow.Date);
                        var end = query.Criteria.AddFilter(LogicalOperator.Or);
                        end.AddCondition("re_effectiveto", ConditionOperator.Null);
                        end.AddCondition("re_effectiveto", ConditionOperator.GreaterEqual, DateTime.UtcNow.Date);
                        var matches = service.RetrieveMultiple(query).Entities;
                        if (matches.Count != 1 || !matches[0].Contains("re_hourlycost") ||
                            matches[0].GetAttributeValue<decimal>("re_hourlycost") < 0)
                            Fail("Labor rate is missing, invalid or ambiguous for the selected branch, role and time category.");
                        rate = matches[0]; rates.Add(key, rate);
                    }
                    row["re_hourlycost"] = new Money(decimal.Round(rate.GetAttributeValue<decimal>("re_hourlycost"), 2, MidpointRounding.AwayFromZero));
                    row["re_laborrate"] = rate.ToEntityReference();
                }
                row["re_name"] = "Custom labor";
                row["re_laborrole"] = new OptionSetValue(line.role);
                row["re_timecategory"] = new OptionSetValue(line.time);
                row["re_hours"] = line.hours;
                row["re_totalcost"] = new Money(decimal.Round(line.hours * row.GetAttributeValue<Money>("re_hourlycost").Value, 2, MidpointRounding.AwayFromZero));
                rows.Add(row);
            }
            foreach (var line in input.materialLines)
            {
                if (!string.IsNullOrEmpty(line.id) && !seen.Add(line.id)) Fail("Duplicate custom line ID.");
                if (line.quantity < 0 || line.quantity > 100000 || line.unitCost < 0 || line.unitCost > 1000000000 ||
                    decimal.Round(line.quantity, 2) != line.quantity || decimal.Round(line.unitCost, 2) != line.unitCost)
                    Fail("Invalid material quantity or unit cost (two decimals required).");
                var previous = priorMaterial.FirstOrDefault(r => r.Id.ToString() == line.id);
                var row = new Entity(Material, previous?.Id ?? Guid.NewGuid());
                row["re_name"] = "Custom material";
                row["re_estimatematerialline"] = "Custom material";
                row["re_entereddescription"] = Required(line.description, 2000, "Material description");
                row["re_vendor"] = Optional(line.vendor, 100);
                row["re_partnumber"] = Optional(line.part, 100);
                row["re_quantity"] = line.quantity;
                row["re_unitcost"] = new Money(line.unitCost);
                row["re_taxapplicable"] = true;
                row["re_freightapplicable"] = true;
                row["re_extendedcost"] = new Money(decimal.Round(line.quantity * line.unitCost, 2, MidpointRounding.AwayFromZero));
                var extended = line.quantity * line.unitCost;
                var tax = header.GetAttributeValue<decimal>("re_usetax");
                var freight = header.GetAttributeValue<decimal>("re_freight");
                row["re_taxamount"] = new Money(decimal.Round(extended * tax, 2, MidpointRounding.AwayFromZero));
                row["re_freightamount"] = new Money(decimal.Round(extended * freight, 2, MidpointRounding.AwayFromZero));
                row["re_totalcost"] = new Money(decimal.Round(extended * (1m + tax + freight), 2, MidpointRounding.AwayFromZero));
                rows.Add(row);
            }
            foreach (var row in rows)
            {
                row["re_repairestimate"] = header.ToEntityReference();
                row["ownerid"] = owner;
                row["transactioncurrencyid"] = currency;
            }
            return rows;
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
            var status = row.GetAttributeValue<OptionSetValue>("re_estimatestatus")?.Value;
            if (status != DraftStatus && status != 126110002) Fail("This estimate status cannot be opened here.");
            var result = new Draft {
                mode = "save", status = status.Value, id = id.ToString(), version = row.RowVersion,
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
            var laborRows = Children(service, Labor, id);
            var materialRows = Children(service, Material, id);
            if (laborRows.Any(e => new[] { "re_laborrole", "re_timecategory", "re_hours", "re_hourlycost" }.Any(k => !e.Contains(k))))
                Fail("Saved labor snapshot is incomplete. Ask an administrator to correct it before editing.");
            if (materialRows.Any(e => new[] { "re_entereddescription", "re_quantity", "re_unitcost" }.Any(k => !e.Contains(k))))
                Fail("Saved material snapshot is incomplete. Ask an administrator to correct it before editing.");
            result.laborLines = laborRows.OrderBy(e => e.Id).Select(e => new LaborInput {
                id = e.Id.ToString(), role = e.GetAttributeValue<OptionSetValue>("re_laborrole")?.Value ?? 0,
                time = e.GetAttributeValue<OptionSetValue>("re_timecategory")?.Value ?? 0,
                hours = e.GetAttributeValue<decimal>("re_hours"), rate = e.GetAttributeValue<Money>("re_hourlycost").Value
            }).ToList();
            result.materialLines = materialRows.OrderBy(e => e.Id).Select(e => new MaterialInput {
                id = e.Id.ToString(), description = e.GetAttributeValue<string>("re_entereddescription"),
                vendor = e.GetAttributeValue<string>("re_vendor"), part = e.GetAttributeValue<string>("re_partnumber"),
                quantity = e.GetAttributeValue<decimal>("re_quantity"), unitCost = e.GetAttributeValue<Money>("re_unitcost").Value
            }).ToList();
            foreach (var p in Children(service, Package, id).OrderBy(p => p.GetAttributeValue<int?>("re_sequence") ??
                p.GetAttributeValue<OptionSetValue>("re_packagerole").Value - 126110000))
                result.packages.Add(new PackageInput {
                    id = Id(p, "re_repairpackage"), number = p.GetAttributeValue<string>("re_packagenumber"),
                    nameEn = p.GetAttributeValue<string>("re_packagenameen"), nameFr = p.GetAttributeValue<string>("re_packagenamefr"),
                    scopeEn = p.GetAttributeValue<string>("re_proposalscopeen"), scopeFr = p.GetAttributeValue<string>("re_proposalscopefr"),
                    hours = p.GetAttributeValue<decimal>("re_mechanichoursperunit"),
                    material = p.GetAttributeValue<Money>("re_materialcostperunit").Value,
                    isCustom = p.GetAttributeValue<bool>("re_iscustompackage"), isTimeMaterial = p.GetAttributeValue<bool>("re_istimematerial")
                });
            if (Encoding.UTF8.GetByteCount(Serialize(result)) > 1000000)
                Fail("Draft response exceeds the technical size budget. Split this request into smaller estimates.");
            return result;
        }

        static List<Entity> Children(IOrganizationService service, string table, Guid id)
        {
            var query = new QueryExpression(table) { ColumnSet = new ColumnSet(true),
                PageInfo = new PagingInfo { Count = 100, PageNumber = 1 } };
            query.Criteria.AddCondition("re_repairestimate", ConditionOperator.Equal, id);
            query.AddOrder(table + "id", OrderType.Ascending);
            var rows = new List<Entity>();
            do
            {
                var records = service.RetrieveMultiple(query);
                rows.AddRange(records.Entities);
                if (rows.Count > MaxChildOperations) Fail("Draft exceeds the technical processing budget.");
                if (!records.MoreRecords) return rows;
                if (records.Entities.Count == 0) Fail("Invalid draft paging response.");
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = records.PagingCookie;
            } while (true);
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
            if (json == null || json.Length > MaxPayloadBytes || Encoding.UTF8.GetByteCount(json) > MaxPayloadBytes)
                throw new InvalidPluginExecutionException("Draft exceeds the 200000-byte request budget. Split this request into smaller estimates.");
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
