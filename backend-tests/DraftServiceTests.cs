using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using RepairEstimator.Drafts;

static class DraftServiceTests
{
    static readonly MethodInfo Save = typeof(DraftPlugin).GetMethod("Save", BindingFlags.Static | BindingFlags.NonPublic);
    static readonly MethodInfo Read = typeof(DraftPlugin).GetMethod("Read", BindingFlags.Static | BindingFlags.NonPublic);
    static readonly Guid User = Guid.NewGuid(), Branch = Guid.NewGuid(), Country = Guid.NewGuid(),
        Currency = Guid.NewGuid(), Province = Guid.NewGuid(), Type = Guid.NewGuid(),
        MasterEquipment = Guid.NewGuid(), MasterPackage = Guid.NewGuid();

    static void Assert(bool condition, string message) { if (!condition) throw new Exception(message); }
    static void Run(FakeService service, Draft input) =>
        Save.Invoke(null, new object[] { service, User, input, Guid.Parse(input.id) });
    static Draft Load(FakeService service, Draft input) =>
        (Draft)Read.Invoke(null, new object[] { service, Guid.Parse(input.id) });
    static void Reject(Action action, string expected)
    {
        try { action(); }
        catch (TargetInvocationException e) when (e.InnerException is InvalidPluginExecutionException &&
            e.InnerException.Message.Contains(expected)) { return; }
        throw new Exception("Expected rejection: " + expected);
    }

    static FakeService Setup()
    {
        var service = new FakeService();
        service.Add(new Entity("re_branch", Branch) {
            ["re_country"] = new EntityReference("re_country", Country),
            ["re_currency"] = new EntityReference("transactioncurrency", Currency),
            ["re_market"] = new OptionSetValue(126110000)
        });
        service.Add(new Entity("re_stateprovince", Province) { ["re_country"] = new EntityReference("re_country", Country) });
        service.Add(new Entity("re_equipmenttype", Type));
        service.Add(new Entity("re_equipment", MasterEquipment) {
            ["re_branch"] = new EntityReference("re_branch", Branch),
            ["re_equipment"] = "E1", ["re_equipmentname"] = "Master equipment name", ["re_equipmentage"] = 20
        });
        service.Add(new Entity("re_repairpackage", MasterPackage) {
            ["re_packagenumber"] = "P1", ["re_packagenameen"] = "Master package",
            ["re_proposalscopeen"] = "Master scope", ["re_mechanichours"] = 2.5m,
            ["re_materialmisctaxcost"] = new Money(125m),
            ["re_country"] = new EntityReference("re_country", Country),
            ["re_currency"] = new EntityReference("transactioncurrency", Currency),
            ["re_effectivefrom"] = DateTime.UtcNow.AddDays(-1)
        });
        return service;
    }

    static Draft Input() => new Draft {
        mode = "save", id = Guid.NewGuid().ToString(), title = "Draft", building = "Building",
        customer = "Customer", branchId = Branch.ToString(), stateId = Province.ToString(),
        equipmentTypeId = Type.ToString(), market = 126110000,
        fields = new List<Field> {
            new Field {key="re_proposallanguage",value="126110000"},
            new Field {key="re_timecategory",value="126110000"},
            new Field {key="re_usetax",value="5"}, new Field {key="re_freight",value="0"}
        },
        equipment = new List<EquipmentInput> {
            new EquipmentInput {id=MasterEquipment.ToString(),number="E1",matched=true,name="Forged"}
        },
        packages = new List<PackageInput> {
            new PackageInput {id=MasterPackage.ToString(),hours=999,material=999,nameEn="Forged"}
        }
    };

    public static void RunAll()
    {
        var service = Setup(); var input = Input(); Run(service, input);
        var result = Load(service, input);
        Assert(result.equipment.Single().name == "Master equipment name", "Equipment must use server snapshot");
        Assert(result.packages.Single().hours == 2.5m && result.packages.Single().material == 125m,
            "Package values must come from master, not client");
        Assert(result.number == "0000000042" && result.version != null, "Server number and version must return");
        Assert(decimal.Parse(result.fields.Single(f => f.key == "re_usetax").value,
            System.Globalization.CultureInfo.InvariantCulture) == 5m, "Percentage roundtrip");
        Assert(service.Rows.Values.Single(e => e.LogicalName == "re_estimateequipment").GetAttributeValue<bool>("re_isprimary"),
            "First equipment must be primary");
        Assert(service.Rows.Values.Single(e => e.LogicalName == "re_estimatepackage").GetAttributeValue<int>("re_quantity") == 1,
            "Package quantity must equal equipment count");
        var originalVersion = result.version;
        input.version = result.version;
        service.Rows[MasterPackage]["re_mechanichours"] = 50m;
        service.Rows[MasterEquipment]["re_equipmentname"] = "Changed master";
        input.title = "Updated"; Run(service, input);
        result = Load(service, input);
        Assert(result.title == "Updated" && result.version != originalVersion, "Update must advance version");
        Assert(result.packages.Single().hours == 2.5m && result.equipment.Single().name == "Master equipment name",
            "Unchanged selections must preserve saved snapshots");
        Assert(service.LastConcurrency == ConcurrencyBehavior.IfRowVersionMatches, "Conditional header update required");
        var deletes = service.Deletes;
        Reject(() => Run(service, input), "version conflict");
        Assert(service.Deletes == deletes, "Stale update must not delete children");
        input.version = result.version;
        service.Add(new Entity("re_estimatelaborline", Guid.NewGuid()) {
            ["re_repairestimate"] = new EntityReference("re_repairestimate", Guid.Parse(input.id))
        });
        Reject(() => Run(service, input), "labor lines");
        Assert(service.Deletes == deletes, "Dependent labor lines must remain intact");

        service = Setup(); input = Input();
        input.equipment[0] = new EquipmentInput {number="UNLISTED",matched=false};
        Run(service, input);
        Assert(!Load(service, input).equipment.Single().matched, "Unlisted number must roundtrip without lookup");
        Reject(() => Run(service, input), "Duplicate record");

        service = Setup(); input = Input();
        service.Rows[Province]["re_frenchrequired"] = true;
        Reject(() => Run(service, input), "French proposal");
        Assert(!service.Rows.ContainsKey(Guid.Parse(input.id)), "French validation before creating header");
        input.fields[0].value = "126110001"; Run(service, input);
        Assert(Load(service, input).fields.Single(f => f.key == "re_proposallanguage").value == "126110001", "French allowed");

        service = Setup(); input = Input(); service.Rows[MasterPackage]["re_currency"] =
            new EntityReference("transactioncurrency", Guid.NewGuid());
        Reject(() => Run(service, input), "currency");
        service = Setup(); input = Input(); input.equipment[0].number = "WRONG";
        Reject(() => Run(service, input), "number does not match");
        service = Setup(); input = Input(); service.Rows[MasterPackage]["re_effectivefrom"] = DateTime.UtcNow.AddDays(2);
        Reject(() => Run(service, input), "effective dates");
        service = Setup(); input = Input(); Run(service, input); input.version = Load(service, input).version;
        service.Rows[Guid.Parse(input.id)]["re_estimatestatus"] = new OptionSetValue(126110002);
        Reject(() => Run(service, input), "Only Draft");
        Console.WriteLine("Draft service cases passed: snapshots, totals, roundtrip, updates, stale version, dependent lines, duplicate create, French, currency, number, dates, status.");
    }

    sealed class FakeService : IOrganizationService
    {
        public readonly Dictionary<Guid, Entity> Rows = new Dictionary<Guid, Entity>();
        public int Deletes;
        public ConcurrencyBehavior LastConcurrency;
        long version;
        public void Add(Entity row) { row["statecode"] = new OptionSetValue(0); row.RowVersion = (++version).ToString(); Rows[row.Id] = row; }
        static Entity Clone(Entity row) { var clone = new Entity(row.LogicalName, row.Id) { RowVersion = row.RowVersion };
            foreach (var value in row.Attributes) clone[value.Key] = value.Value; return clone; }
        public Guid Create(Entity row) {
            if (row.Id == Guid.Empty) row.Id = Guid.NewGuid();
            if (Rows.ContainsKey(row.Id)) throw new InvalidPluginExecutionException("Duplicate record");
            var copy = Clone(row);
            if (row.LogicalName == "re_repairestimate") copy["re_name"] = "0000000042";
            Add(copy); return row.Id;
        }
        public Entity Retrieve(string name, Guid id, ColumnSet columns) => Clone(Rows[id]);
        public EntityCollection RetrieveMultiple(QueryBase query) {
            var q = (QueryExpression)query;
            return new EntityCollection(Rows.Values.Where(r => r.LogicalName == q.EntityName &&
                q.Criteria.Conditions.All(c => r.Contains(c.AttributeName) &&
                    (r[c.AttributeName] is EntityReference reference ? reference.Id.Equals(c.Values[0]) :
                        r[c.AttributeName].Equals(c.Values[0])))).Select(Clone).ToList());
        }
        public void Update(Entity row) {
            foreach (var value in row.Attributes) Rows[row.Id][value.Key] = value.Value;
            Rows[row.Id].RowVersion = (++version).ToString();
        }
        public void Delete(string name, Guid id) { Rows.Remove(id); Deletes++; }
        public OrganizationResponse Execute(OrganizationRequest request) {
            if (request is CreateRequest create) {
                var response = new CreateResponse();
                response.Results["id"] = Create(create.Target);
                return response;
            }
            if (request is DeleteRequest delete) {
                Delete(delete.Target.LogicalName, delete.Target.Id);
                return new DeleteResponse();
            }
            var update = (UpdateRequest)request; LastConcurrency = update.ConcurrencyBehavior;
            if (Rows[update.Target.Id].RowVersion != update.Target.RowVersion)
                throw new InvalidPluginExecutionException("Row version conflict");
            Update(update.Target); return new UpdateResponse();
        }
        public void Associate(string name, Guid id, Relationship relationship, EntityReferenceCollection entities) =>
            throw new NotSupportedException();
        public void Disassociate(string name, Guid id, Relationship relationship, EntityReferenceCollection entities) =>
            throw new NotSupportedException();
    }
}
