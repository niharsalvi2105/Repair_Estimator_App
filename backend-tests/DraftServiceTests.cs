using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
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
        (Draft)Read.Invoke(null, new object[] { service, Guid.Parse(input.id), false });
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
        customer = "Customer", email = "customer@example.invalid", branchId = Branch.ToString(), stateId = Province.ToString(),
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
        TestChoices();
        TestUnlistedEquipmentDetails();
        TestPresets();
        TestPackageMaterialPricing();
        var service = Setup(); var input = Input(); input.email = null;
        Reject(() => Run(service, input), "Customer email is required");
        Assert(!service.Rows.ContainsKey(Guid.Parse(input.id)), "Missing customer email must fail before creating the estimate");
        service = Setup(); input = Input(); input.email = "   ";
        Reject(() => Run(service, input), "Customer email is required");
        Assert(!service.Rows.ContainsKey(Guid.Parse(input.id)), "Whitespace customer email must fail before creating the estimate");
        service = Setup(); input = Input(); Run(service, input);
        var result = Load(service, input);
        Assert(result.email == "customer@example.invalid", "Customer email must be persisted");
        Assert(result.equipment.Single().name == "Master equipment name", "Equipment must use server snapshot");
        Assert(result.packages.Single().hours == 2.5m && result.packages.Single().material == 125m,
            "Package values must come from master, not client");
        Assert(result.number == "0000000042" && result.version != null, "Server number and version must return");
        Assert(decimal.Parse(result.fields.Single(f => f.key == "re_usetax").value,
            System.Globalization.CultureInfo.InvariantCulture) == 5m, "Percentage roundtrip");
        Assert(decimal.Parse(result.fields.Single(f => f.key == "re_freight").value,
            System.Globalization.CultureInfo.InvariantCulture) == 14m, "Standard freight overrides submitted zero");
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
        input.laborLines = null;
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
        TestFlexiblePackages();
        TestFlexibleEquipment();
        TestCustomLines();
        TestRequiredCustomPackages();
        TestAllLaborCombinations();
        TestCatalogParts();
        Console.WriteLine("Draft service cases passed: snapshots, totals, roundtrip, updates, stale version, dependent lines, duplicate create, French, currency, number, dates, status, 125 packages, custom lines, all six labor combinations and rate-query caching.");
    }

    static void TestChoices()
    {
        var service = Setup();
        var input = Input();
        input.fields.Add(new Field { key = "re_papertype", value = "727000042" });
        input.fields.Add(new Field { key = "re_nationalaccount", value = "126110002" });
        Run(service, input);
        var saved = Load(service, input).fields;
        Assert(saved.Single(f => f.key == "re_papertype").value == "727000042" &&
            saved.Single(f => f.key == "re_nationalaccount").value == "126110002",
            "Published non-contiguous choices must roundtrip");
        var readChoices = typeof(DraftPlugin).GetMethod("ReadChoices", BindingFlags.Static | BindingFlags.NonPublic);
        service.ChoiceReads.Clear();
        var choices = (DraftPlugin.Choices)readChoices.Invoke(null, new object[] { service });
        Assert(choices.fields.Count == 11 && choices.fields.All(f => f.options.Count > 0), "All draft choice fields must load");
        Assert(choices.fields.Single(f => f.key == "re_papertype").options.Single(o => o.value == 727000042).fr == "Choix re_papertype",
            "Published labels must come from global choice metadata");
        Assert(service.ChoiceReads.Count == 8 && service.ChoiceReads.Distinct().Count() == 8,
            "Each global choice must be read once per request");
        service.ChoiceValues["re_papertype"] = new[] { 126110000 };
        input = Input();
        input.fields.Add(new Field { key = "re_papertype", value = "126110001" });
        Reject(() => Run(service, input), "Invalid published choice for re_papertype");
        Assert(!service.Rows.ContainsKey(Guid.Parse(input.id)), "Invalid choice must fail before header writes");
        input = Input();
        input.fields[1].value = "126110009";
        Reject(() => Run(service, input), "Invalid published choice for re_timecategory");
        service.ChoiceValues["re_papertype"] = new int[0];
        Reject(() => readChoices.Invoke(null, new object[] { service }), "unavailable");
        Console.WriteLine("Live choice metadata and validation cases passed.");
    }

    static void TestUnlistedEquipmentDetails()
    {
        var service = Setup();
        var input = Input();
        input.equipment.Add(new EquipmentInput {
            number = "00000711", name = "Lobby lift", location = "Ground floor", oem = "Other manufacturer",
            age = 0, customer = "Forged customer", matched = false
        });
        var masters = service.Rows.Values.Count(row => row.LogicalName == "re_equipment");
        Run(service, input);
        var loaded = Load(service, input);
        var equipment = loaded.equipment.Single(row => row.number == "00000711");
        Assert(!equipment.matched && equipment.name == "Lobby lift" && equipment.location == "Ground floor" &&
            equipment.oem == "Other manufacturer" && equipment.age == 0 && equipment.customer == input.customer,
            "Unlisted details must roundtrip with the estimate customer, not a forged customer.");
        Assert(service.Rows.Values.Count(row => row.LogicalName == "re_equipment") == masters,
            "Uploading unlisted equipment must never create master equipment records.");
        input = loaded;
        input.equipment.Single(row => !row.matched).name = "Changed browser value";
        Run(service, input);
        Assert(Load(service, input).equipment.Single(row => !row.matched).name == "Lobby lift",
            "Unrelated saves preserve equipment snapshots.");
        foreach (var age in new[] { -1, 201 })
        {
            input = Input();
            input.equipment.Add(new EquipmentInput { number = "NEW", age = age });
            Reject(() => Run(Setup(), input), "Equipment age");
        }
        input = Input();
        input.equipment.Add(new EquipmentInput { number = "NEW", name = new string('X', 101) });
        Reject(() => Run(Setup(), input), "100");
        Console.WriteLine("Unlisted equipment snapshot cases passed: details, age zero, validation, estimate customer, no master writes and snapshot preservation.");
    }

    static void TestCatalogParts()
    {
        var catalogType = typeof(DraftPlugin).Assembly.GetType("RepairEstimator.Drafts.PartCatalog");
        var search = catalogType.GetMethod("Search", BindingFlags.Static | BindingFlags.NonPublic);
        var service = Setup();
        var disabled = (CatalogResult)search.Invoke(null, new object[] { service,
            new Draft { mode = "partcapabilities", market = 126110000 } });
        Assert(!disabled.available && disabled.reason.Contains("unavailable"), "Missing catalog schema must disable features explicitly.");
        service.CatalogSchema = true;
        var configId = Guid.NewGuid();
        service.Add(new Entity("transactioncurrency", Currency) { ["isocurrencycode"] = "CAD" });
        service.Add(new Entity("re_partpricingconfiguration", configId) {
            ["re_market"] = new OptionSetValue(126110001), ["re_currency"] = new EntityReference("transactioncurrency", Currency),
            ["re_version"] = "v1", ["re_usdtocadfactor"] = 1.4m, ["re_costonlyfactor"] = 1.23m,
            ["re_defaultmarkuppct"] = 10m, ["re_isenabled"] = false, ["re_effectivefrom"] = DateTime.UtcNow.AddDays(-1)
        });
        Assert(!((CatalogResult)search.Invoke(null, new object[] { service,
            new Draft { mode = "partcapabilities", market = 126110001 } })).available, "Configuration must opt in explicitly.");
        service.Rows[configId]["re_isenabled"] = true;
        service.SnapshotPrecision = 2;
        Assert(!((CatalogResult)search.Invoke(null, new object[] { service,
            new Draft { mode = "partcapabilities", market = 126110001 } })).available,
            "Lossy Money/two-decimal snapshot schema must not activate the catalog.");
        service.SnapshotPrecision = 10;
        var partId = Guid.NewGuid();
        service.Add(new Entity("re_sparepart", partId) {
            ["re_sourcekey"] = "MATERIAL:0001", ["re_partnumber"] = "0001", ["re_name"] = "Catalog motor",
            ["re_descriptionen"] = "Catalog motor", ["re_parttype"] = new OptionSetValue(126110000),
            ["re_usdcost"] = 4.49m, ["re_usdprice"] = 28.84m, ["re_sourcecurrency"] = "USD",
            ["re_pricingunit"] = 1m, ["re_uom"] = "PC", ["re_sourceversion"] = "approved-v1",
            ["re_effectivefrom"] = DateTime.UtcNow.AddDays(-1), ["re_refreshedon"] = DateTime.UtcNow
        });
        var found = (CatalogResult)search.Invoke(null, new object[] { service,
            new Draft { mode = "partcatalog", market = 126110001, partType = "kone", search = "00" } });
        Assert(found.available && found.parts.Single().unitCost == 7.73178m &&
            found.parts.Single().unitPrice == 40.376m, "Catalog query must return exact CAD formulas.");
        service.Rows[configId]["re_market"] = new OptionSetValue(126110002);
        Assert(((CatalogResult)search.Invoke(null, new object[] { service,
            new Draft { mode = "partcatalog", market = 126110002, partType = "kone", search = "00" } }))
            .parts.Single().unitCost == 7.73178m, "CKQ uses the same CAD formula as CKE.");
        service.Rows[configId]["re_market"] = new OptionSetValue(126110000);
        Reject(() => search.Invoke(null, new object[] { service,
            new Draft { mode = "partcapabilities", market = 126110000 } }), "currency");
        service.Rows[Currency]["isocurrencycode"] = "USD";
        var usd = (CatalogResult)search.Invoke(null, new object[] { service,
            new Draft { mode = "partcatalog", market = 126110000, partType = "kone", search = "00" } });
        Assert(usd.parts.Single().unitCost == 4.49m && usd.parts.Single().unitPrice == 28.84m,
            "MKO must not convert USD amounts.");
        service.Rows[Currency]["isocurrencycode"] = "CAD";
        service.Rows[configId]["re_market"] = new OptionSetValue(126110001);
        service.Rows[partId]["re_pricingunit"] = 10m;
        Reject(() => search.Invoke(null, new object[] { service,
            new Draft { mode = "partcatalog", market = 126110001, partType = "kone", search = "00" } }), "per-unit");
        service.Rows[partId]["re_pricingunit"] = 1m;
        service.Rows[Branch]["re_market"] = new OptionSetValue(126110001);
        service.Rows[MasterPackage]["re_iscustompackage"] = true;
        service.Add(new Entity("re_laborrate", Guid.NewGuid()) {
            ["re_branch"] = new EntityReference("re_branch", Branch), ["re_laborrole"] = new OptionSetValue(126110000),
            ["re_timecategory"] = new OptionSetValue(126110000), ["re_hourlycost"] = 100m,
            ["re_effectivefrom"] = DateTime.UtcNow.AddDays(-1)
        });
        var input = Input(); input.market = 126110001;
        input.laborLines = new List<LaborInput> { new LaborInput { hours = 1, role = 126110000, time = 126110000 } };
        input.materialLines = new List<MaterialInput> { new MaterialInput {
            description = "Forged", part = "FAKE", unitCost = 1, unitPrice = 1, quantity = 3,
            partType = "kone", catalogPartId = partId.ToString(), markupPercent = 10
        } };
        Run(service, input);
        var loaded = Load(service, input);
        var material = loaded.materialLines.Single();
        Assert(material.unitCost == 7.73178m && material.unitPrice == 40.376m &&
            material.part == "0001" && material.description == "Catalog motor" && material.markupPercent == 10m,
            "Server must ignore spoofed catalog costs/prices/description and preserve exact snapshots.");
        var stored = service.Rows[Guid.Parse(material.id)];
        Assert(stored.GetAttributeValue<Money>("re_extendedcost").Value == 23.20m, "Round only extended/display amounts.");
        input = loaded; input.mode = "save";
        service.Rows[partId]["re_usdcost"] = 100m;
        service.Rows[partId]["re_usdprice"] = 200m;
        service.Rows[configId]["re_isenabled"] = false;
        Run(service, input);
        loaded = Load(service, input);
        Assert(loaded.materialLines.Single().unitCost == 7.73178m,
            "Saved snapshots survive source changes and unrelated saves even when catalog disabled.");
        input = loaded; input.materialLines[0].markupPercent = 20;
        Reject(() => Run(service, input), "not enabled");
        input.version = service.Rows[Guid.Parse(input.id)].RowVersion;
        service.Rows[configId]["re_isenabled"] = true;
        input.materialLines[0].partType = "non-kone";
        Reject(() => Run(service, input), "classification");
        input.version = service.Rows[Guid.Parse(input.id)].RowVersion;
        input.materialLines[0].partType = "kone";
        input.materialLines[0].markupPercent = 101;
        Reject(() => Run(service, input), "markup");
        input.version = service.Rows[Guid.Parse(input.id)].RowVersion;
        input.materialLines[0].markupPercent = 10;
        input.materialLines[0].refreshPart = true;
        Run(service, input);
        loaded = Load(service, input);
        Assert(loaded.materialLines.Single().unitCost == 172.2m && loaded.materialLines.Single().unitPrice == 280m,
            "Explicit reselection refreshes trusted cost and selling snapshots.");
        input = loaded; input.materialLines[0].partType = null; input.materialLines[0].catalogPartId = null;
        Reject(() => Run(service, input), "Reload the current app");
        input = Load(service, loaded);
        input.fields.Single(field => field.key == "re_konesparessalespricevk13").value = "100";
        Reject(() => Run(service, input), "aggregate VK13");
        service.Rows[partId]["re_effectiveto"] = DateTime.UtcNow.AddDays(-1);
        var stale = (CatalogResult)search.Invoke(null, new object[] { service,
            new Draft { mode = "partcatalog", market = 126110001, partType = "kone", search = "00" } });
        Assert(stale.parts.Count == 0, "Expired parts cannot be searched.");
        var replacement = new Entity("re_sparepart", Guid.NewGuid());
        foreach (var attribute in service.Rows[partId].Attributes) replacement[attribute.Key] = attribute.Value;
        replacement["re_effectiveto"] = null;
        service.Add(replacement);
        input = Load(service, loaded);
        input.materialLines[0].refreshPart = true;
        Reject(() => Run(service, input), "expired or ambiguous");
        input.version = service.Rows[Guid.Parse(input.id)].RowVersion;
        input.materialLines[0].partType = "non-kone";
        input.materialLines[0].catalogPartId = null;
        input.materialLines[0].refreshPart = false;
        input.materialLines[0].markupPercent = null;
        input.materialLines[0].unitCost = 25m;
        Reject(() => Run(service, input), "classified as KONE");
        input.version = service.Rows[Guid.Parse(input.id)].RowVersion;
        input.materialLines[0].part = "MANUAL-1";
        Run(service, input);
        input = Load(service, input);
        service.Rows[configId]["re_isenabled"] = false;
        input.materialLines[0].unitCost = 30m;
        Run(service, input);
        Assert(Load(service, input).materialLines.Single().unitCost == 30m,
            "Existing explicit manual non-KONE remains editable without activating the catalog.");
        Console.WriteLine("Catalog cases passed: missing schema/disabled gate, CAD precision, spoof rejection, snapshots, refresh, classification, markup and legacy VK13 protection.");
    }

    static void TestFlexibleEquipment()
    {
        var service = Setup(); var input = Input();
        for (int n = 1; n < 125; n++)
            input.equipment.Add(new EquipmentInput { number = "UNLISTED-" + n, matched = false });
        Run(service, input);
        var loaded = Load(service, input);
        Assert(loaded.equipment.Count == 125, "Paging must not truncate equipment above fourteen");
        Assert(service.Rows.Values.Single(r => r.LogicalName == "re_estimatepackage")
            .GetAttributeValue<int>("re_quantity") == 125, "Package quantity must include all equipment");
        input.version = loaded.version;
        Run(service, input);
        Assert(Load(service, input).equipment.Count == 125, "Large equipment selection must resave intact");
        input.version = Load(service, input).version;
        input.equipment = new List<EquipmentInput>();
        Reject(() => Run(service, input), "Select at least one equipment");
        input.equipment = Enumerable.Range(0, 1000)
            .Select(n => new EquipmentInput { number = "UNIT-" + n, matched = false }).ToList();
        Reject(() => Run(service, input), "technical processing budget");
    }

    static void TestFlexiblePackages()
    {
        var service = Setup(); var input = Input();
        for (int n = 1; n < 125; n++)
        {
            var master = new Entity("re_repairpackage", Guid.NewGuid());
            foreach (var a in service.Rows[MasterPackage].Attributes) master[a.Key] = a.Value;
            master["re_packagenumber"] = "P" + n;
            master["re_istimematerial"] = n == 1;
            service.Add(master);
            input.packages.Add(new PackageInput { id = master.Id.ToString() });
        }
        Run(service, input);
        var loaded = Load(service, input);
        Assert(loaded.packages.Count == 125, "Paging must not truncate packages");
        Assert(loaded.packages[1].isTimeMaterial, "T&M flag must roundtrip");
        Assert(service.Rows.Values.Where(r => r.LogicalName == "re_estimatepackage")
            .All(r => r.GetAttributeValue<OptionSetValue>("re_packagerole").Value <= 126110002), "Do not invent role choice values");
        var equipmentId = service.Rows.Values.Single(r => r.LogicalName == "re_estimateequipment").Id;
        input.version = loaded.version;
        Run(service, input);
        Assert(service.Rows.ContainsKey(equipmentId), "Equipment identity must remain stable");
        Assert(Load(service, input).packages.Count == 125, "Large package set must resave intact");
        input.version = Load(service, input).version;
        input.packages.Add(input.packages[0]);
        Reject(() => Run(service, input), "unique");
        input.packages = Enumerable.Range(0, 1000).Select(n => new PackageInput { id = Guid.NewGuid().ToString() }).ToList();
        Reject(() => Run(service, input), "technical processing budget");
    }

    static void TestPackageMaterialPricing()
    {
        var service = Setup(); var input = Input();
        service.PackagePricingSchema = true;
        service.Rows[MasterPackage]["re_iscustompackage"] = true;
        service.Rows[MasterPackage]["re_materialbeforemarkup"] = new Money(617.45m);
        service.Rows[MasterPackage]["re_materialmisctaxcost"] = new Money(849.77m);
        service.Add(new Entity("re_laborrate", Guid.NewGuid()) {
            ["re_branch"] = new EntityReference("re_branch", Branch), ["re_laborrole"] = new OptionSetValue(126110000),
            ["re_timecategory"] = new OptionSetValue(126110000), ["re_hourlycost"] = 100m,
            ["re_effectivefrom"] = DateTime.UtcNow.AddDays(-1)
        });
        input.laborLines = new List<LaborInput> { new LaborInput {
            packageId = MasterPackage.ToString(), role = 126110000, time = 126110000, hours = 1
        }};
        input.materialLines = new List<MaterialInput> {
            new MaterialInput { packageId = MasterPackage.ToString(), description = "Motor", part = "KM1", quantity = 50,
                pricingSource = "package", partType = "kone", unitCost = 0 },
            new MaterialInput { packageId = MasterPackage.ToString(), description = "Bracket", part = "MANUAL", quantity = 2,
                pricingSource = "manual", partType = "non-kone", unitCost = 10 }
        };
        service.PackagePricingSchema = false;
        Reject(() => Run(service, input), "Package material pricing is not deployed");
        service.PackagePricingSchema = true;
        input.materialLines[0].unitCost = 1;
        Reject(() => Run(service, input), "must not contain");
        input.id = Guid.NewGuid().ToString();
        input.materialLines[0].unitCost = 0;
        service.Rows[MasterPackage].Attributes.Remove("re_materialbeforemarkup");
        Reject(() => Run(service, input), "are required for KONE pricing");
        input.id = Guid.NewGuid().ToString();
        service.Rows[MasterPackage]["re_materialbeforemarkup"] = new Money(-1m);
        Reject(() => Run(service, input), "Before Markup is missing or invalid");
        input.id = Guid.NewGuid().ToString();
        service.Rows[MasterPackage]["re_materialbeforemarkup"] = new Money(617.45m);
        Run(service, input);
        var loaded = Load(service, input);
        Assert(loaded.packages.Single().materialBeforeMarkup == 617.45m && loaded.packages.Single().material == 849.77m,
            "KONE package values must come from the server master, never client amounts");
        Assert(loaded.materialLines.Single(m => m.part == "KM1").pricingSource == "package" &&
            loaded.materialLines.Single(m => m.part == "KM1").unitCost == 0,
            "KONE part numbers must roundtrip as descriptive zero-cost references");
        Assert(loaded.materialLines.Single(m => m.part == "MANUAL").partType == "non-kone",
            "Manual non-KONE classification must persist without the separate catalog schema");
        var package = service.Rows.Values.Single(r => r.LogicalName == "re_estimatepackage");
        Assert(package.GetAttributeValue<bool>("re_packagepricedkone") &&
            package.GetAttributeValue<Money>("re_totalmaterial").Value == 617.45m,
            "Before-markup cost replaces the existing package material contribution");
        input.version = loaded.version;
        input.materialLines = loaded.materialLines; input.laborLines = loaded.laborLines;
        service.Rows[MasterPackage]["re_materialbeforemarkup"] = new Money(999m);
        service.Rows[MasterPackage]["re_materialmisctaxcost"] = new Money(1999m);
        input.equipment.Add(new EquipmentInput { number = "SECOND", matched = false });
        input.materialLines.Add(new MaterialInput { packageId = MasterPackage.ToString(), description = "Second reference",
            quantity = 99, part = "KM2", partType = "kone", pricingSource = "package" });
        Run(service, input);
        loaded = Load(service, input);
        Assert(loaded.packages.Single().materialBeforeMarkup == 617.45m && loaded.packages.Single().material == 849.77m,
            "Saved KONE cost/final pair must survive master changes and descriptive quantity edits");
        package = service.Rows.Values.Single(r => r.LogicalName == "re_estimatepackage");
        Assert(package.GetAttributeValue<Money>("re_totalmaterial").Value == 1234.90m,
            "Package cost scales by equipment only, not KONE reference count");
        input.version = loaded.version;
        var savedSource = input.materialLines[0].pricingSource;
        input.materialLines[0].pricingSource = null;
        Reject(() => Run(service, input), "Reload the current app");
        input.materialLines[0].pricingSource = savedSource;
        input.version = service.Rows[Guid.Parse(input.id)].RowVersion;
        input.fields.Add(new Field { key = "re_konesparessalespricevk13", value = "100" });
        Reject(() => Run(service, input), "Do not mix");
        Console.WriteLine("Package KONE pricing cases passed: schema gate, trusted cost/final snapshots, mixed manual materials, no double count, equipment scaling and snapshot preservation.");
    }

    static void TestCustomLines()
    {
        var service = Setup(); var input = Input();
        service.Rows[MasterPackage]["re_iscustompackage"] = true;
        var rate = new Entity("re_laborrate", Guid.NewGuid()) {
            ["re_branch"] = new EntityReference("re_branch", Branch), ["re_laborrole"] = new OptionSetValue(126110001),
            ["re_timecategory"] = new OptionSetValue(126110001), ["re_hourlycost"] = 200m,
            ["re_effectivefrom"] = DateTime.UtcNow.AddDays(-1)
        };
        service.Add(rate);
        input.laborLines = new List<LaborInput> { new LaborInput {
            id = Guid.NewGuid().ToString(), role = 126110001, time = 126110001, hours = 2m, rate = 1m
        }};
        input.materialLines = new List<MaterialInput> { new MaterialInput {
            id = Guid.NewGuid().ToString(), description = "Motor", vendor = "KONE", part = "KM1", quantity = 2m, unitCost = 25m
        }};
        Run(service, input);
        var loaded = Load(service, input);
        Assert(loaded.laborLines.Single().rate == 200m, "Never trust browser rate");
        Assert(loaded.materialLines.Single().unitCost == 25m, "Custom material roundtrip");
        Assert(service.Rows[Guid.Parse(input.id)].GetAttributeValue<OptionSetValue>("re_estimatepath").Value == 126110001,
            "Server must derive custom path");
        input.version = loaded.version;
        input.laborLines = loaded.laborLines; input.materialLines = loaded.materialLines;
        var lineId = input.laborLines[0].id;
        rate["re_hourlycost"] = 999m;
        input.laborLines[0].hours = 3m;
        Run(service, input);
        loaded = Load(service, input);
        Assert(loaded.laborLines.Single().rate == 200m && loaded.laborLines.Single().id == lineId,
            "Unchanged role/time must preserve rate and stable line identity");
        Assert(service.Rows[Guid.Parse(lineId)].GetAttributeValue<Money>("re_totalcost").Value == 600m, "Server labor cost");
        input.version = loaded.version;
        input.laborLines[0].hours = -1;
        Reject(() => Run(service, input), "Invalid labor");
        input.version = service.Rows[Guid.Parse(input.id)].RowVersion;
        input.laborLines[0].hours = 2;
        input.materialLines[0].quantity = -1;
        Reject(() => Run(service, input), "Invalid material");
    }

    static void TestAllLaborCombinations()
    {
        var service = Setup(); var input = Input();
        service.Rows[MasterPackage]["re_iscustompackage"] = true;
        input.laborLines = new List<LaborInput>();
        input.materialLines = new List<MaterialInput> {
            new MaterialInput { description = "Material", quantity = 1, unitCost = 1 }
        };
        for (int role = 0; role < 3; role++)
        for (int time = 0; time < 2; time++)
        {
            service.Add(new Entity("re_laborrate", Guid.NewGuid()) {
                ["re_branch"] = new EntityReference("re_branch", Branch), ["re_laborrole"] = new OptionSetValue(126110000 + role),
                ["re_timecategory"] = new OptionSetValue(126110000 + time),
                ["re_hourlycost"] = 100m + role * 50m + time * 75m, ["re_effectivefrom"] = DateTime.UtcNow.AddDays(-1)
            });
            for (int duplicate = 0; duplicate < 2; duplicate++)
                input.laborLines.Add(new LaborInput { id = Guid.NewGuid().ToString(),
                    role = 126110000 + role, time = 126110000 + time, hours = 2m, rate = 1m });
        }

        Run(service, input);
        var loaded = Load(service, input);
        Assert(loaded.laborLines.Count == 12 && loaded.laborLines.All(l =>
            l.rate == 100m + (l.role - 126110000) * 50m + (l.time - 126110000) * 75m),
            "All six role/time combinations must resolve the correct trusted rate");
        Assert(service.RateQueries == 6, "Rate lookups must be cached within the save");
    }

    static void TestRequiredCustomPackages()
        {
            var service = Setup(); var input = Input();
            service.Rows[MasterPackage]["re_iscustompackage"] = true;
            Reject(() => Run(service, input), "at least one labor line and one material line");
            service.Add(new Entity("re_laborrate", Guid.NewGuid()) {
                ["re_branch"] = new EntityReference("re_branch", Branch), ["re_laborrole"] = new OptionSetValue(126110000),
                ["re_timecategory"] = new OptionSetValue(126110000), ["re_hourlycost"] = 100m,
                ["re_effectivefrom"] = DateTime.UtcNow.AddDays(-1)
            });
            input.version = service.Rows[Guid.Parse(input.id)].RowVersion;
            input.laborLines = new List<LaborInput> { new LaborInput { role = 126110000, time = 126110000, hours = 0 } };
            input.materialLines = new List<MaterialInput> { new MaterialInput { description = "Material", quantity = 1, unitCost = 10 } };
            Reject(() => Run(service, input), "Invalid labor");
            input.version = service.Rows[Guid.Parse(input.id)].RowVersion;
            input.laborLines[0].hours = 2;
            input.materialLines[0].unitCost = 0;
            Reject(() => Run(service, input), "Invalid material");
            input.version = service.Rows[Guid.Parse(input.id)].RowVersion;
            input.materialLines[0].unitCost = 10;
            Run(service, input);
            var loaded = Load(service, input);
            Assert(loaded.laborLines[0].packageId == MasterPackage.ToString()
                && loaded.materialLines[0].packageId == MasterPackage.ToString(), "Single custom package must be assigned");
            var packageRow = service.Rows.Values.Single(r => r.LogicalName == "re_estimatepackage");
            Assert(service.Rows.Values.Where(r => r.LogicalName == "re_estimatelaborline" || r.LogicalName == "re_estimatematerialline")
                .All(r => r.GetAttributeValue<EntityReference>("re_estimatepackage")?.Id == packageRow.Id), "Store trusted package lookup");
            service.Rows[Guid.Parse(loaded.laborLines[0].id)].Attributes.Remove("re_estimatepackage");
            service.Rows[Guid.Parse(loaded.materialLines[0].id)].Attributes.Remove("re_estimatepackage");
            loaded = Load(service, input);
            Assert(loaded.laborLines[0].packageId == MasterPackage.ToString()
                && loaded.materialLines[0].packageId == MasterPackage.ToString(), "Legacy single-package lines must be assigned on load");
            var second = new Entity("re_repairpackage", Guid.NewGuid());
            foreach (var a in service.Rows[MasterPackage].Attributes) second[a.Key] = a.Value;
            second["re_packagenumber"] = "CSTM2"; service.Add(second);
            input.version = loaded.version;
            input.packages.Add(new PackageInput { id = second.Id.ToString() });
            input.laborLines = loaded.laborLines; input.materialLines = loaded.materialLines;
            input.laborLines[0].packageId = null;
            Reject(() => Run(service, input), "Assign each custom line");
            input.version = service.Rows[Guid.Parse(input.id)].RowVersion;
            input.laborLines[0].packageId = MasterPackage.ToString();
            Reject(() => Run(service, input), "at least one labor line and one material line");
            input.version = service.Rows[Guid.Parse(input.id)].RowVersion;
            input.laborLines.Add(new LaborInput { packageId = second.Id.ToString(), role = 126110000, time = 126110000, hours = 3 });
            input.materialLines.Add(new MaterialInput { packageId = second.Id.ToString(), description = "Second", quantity = 2, unitCost = 20 });
            Run(service, input);
            loaded = Load(service, input);
            Assert(loaded.laborLines.Select(l => l.packageId).Distinct().Count() == 2
                && loaded.materialLines.Select(l => l.packageId).Distinct().Count() == 2, "Custom packages must retain separate costs");
            input.version = loaded.version;
            input.packages.RemoveAt(0);
            input.laborLines = loaded.laborLines; input.materialLines = loaded.materialLines;
            foreach (var line in input.laborLines) line.packageId = second.Id.ToString();
            foreach (var line in input.materialLines) line.packageId = second.Id.ToString();
            Run(service, input);
            Assert(Load(service, input).laborLines.All(l => l.packageId == second.Id.ToString()),
                "Reassign lines before deleting the old package with Restrict Delete");
        }
    static void TestPresets()
    {
        var method = typeof(DraftPlugin).Assembly.GetType("RepairEstimator.Drafts.OpportunityPresets")
            .GetMethod("Execute", BindingFlags.Static | BindingFlags.NonPublic);
        Func<FakeService, Guid, Draft, PresetResult> call = (service, user, input) =>
            (PresetResult)method.Invoke(null, new object[] { service, user, input });
        var service = Setup();
        Reject(() => call(service, User, new Draft { mode = "presetlist", market = 126110000 }), "Deploy the private preset table");
        service.PresetSchema = true;
        var draft = Input();
        var values = new OpportunityValues {
            branchId = draft.branchId, stateId = draft.stateId, equipmentTypeId = draft.equipmentTypeId,
            jobTypeId = "", building = draft.building, customer = draft.customer, email = draft.email,
            phone = "", market = draft.market,
            fields = new List<Field> { new Field { key = "re_proposallanguage", value = "126110000" } }
        };
        var save = new Draft { mode = "presetsave", presetName = "Office", opportunity = values };
        var result = call(service, User, save);
        Assert(result.presets.Single().name == "Office", "Preset create returns saved data");
        Assert(service.Rows.Values.Count(r => r.LogicalName == "re_opportunitypreset") == 1 &&
            !service.Rows.Values.Any(r => r.LogicalName == "re_repairestimate"), "Presets must not create drafts or masters");
        var list = new Draft { mode = "presetlist", market = draft.market };
        Assert(call(service, User, list).presets.Count == 1, "Owner lists own preset");
        var other = Guid.NewGuid();
        Assert(call(service, other, list).presets.Count == 0, "Other user cannot list private preset");
        Assert(call(service, User, new Draft { mode = "presetlist", market = 126110001 }).presets.Count == 0,
            "Preset lists must be market scoped");
        Reject(() => call(service, User, save), "already exists");
        var remove = new Draft { mode = "presetdelete", id = result.presets[0].id };
        Reject(() => call(service, other, remove), "Only the creator");
        values.fields.Add(new Field { key = "re_sellprice", value = "99" });
        Reject(() => call(service, User, save), "Invalid Opportunity preset fields");
        values.fields.RemoveAt(1);
        values.email = "";
        Reject(() => call(service, User, save), "Complete valid Opportunity details");
        values.email = draft.email;
        values.fields.Add(new Field { key = "re_proposallanguage", value = "126110001" });
        Reject(() => call(service, User, save), "Duplicate");
        values.fields.RemoveAt(1);
        service.Rows[Branch]["statecode"] = new OptionSetValue(1);
        Reject(() => call(service, User, save), "inactive");
        service.Rows[Branch]["statecode"] = new OptionSetValue(0);
        call(service, User, remove);
        for (var index = 0; index < 51; index++) {
            save.presetName = "Preset " + index; call(service, User, save);
        }
        var first = call(service, User, list);
        Assert(first.presets.Count == 50 && !string.IsNullOrEmpty(first.nextToken), "Presets return real continuation token");
        var next = new Draft { mode = "presetlist", market = draft.market, nextToken = first.nextToken };
        Assert(call(service, User, next).presets.Count == 1, "Preset continuation returns remaining records");
        Reject(() => call(service, other, next), "Invalid preset paging token");
        service.Rows.Values.First(r => r.LogicalName == "re_opportunitypreset")["re_payload"] = "null";
        Reject(() => call(service, User, list), "Saved Opportunity preset is invalid");

        service = Setup(); draft = Input(); Run(service, draft);
        service.Rows[Guid.Parse(draft.id)]["re_estimatestatus"] = new OptionSetValue(126110001);
        Assert(((Draft)Read.Invoke(null, new object[] { service, Guid.Parse(draft.id), true })).status == 126110001,
            "Pending requests can be read as clone sources");
        Reject(() => Load(service, draft), "cannot be opened");
        Console.WriteLine("Private Opportunity preset ownership, validation, paging and pending clone cases passed.");
    }

    sealed class FakeService : IOrganizationService
    {
        public readonly Dictionary<Guid, Entity> Rows = new Dictionary<Guid, Entity>();
        public int Deletes;
        public int RateQueries;
        public bool CatalogSchema;
        public bool PackagePricingSchema;
        public bool PresetSchema;
        public int SnapshotPrecision = 10;
        public readonly Dictionary<string, int[]> ChoiceValues = new Dictionary<string, int[]> {
            {"re_papertype", new[] { 126110000, 126110001, 126110002, 727000042 }},
            {"re_yesnounknowchoice", new[] { 126110000, 126110001, 126110002 }},
            {"re_competingbidstatus", new[] { 126110000, 126110001, 126110002, 126110003 }},
            {"re_billingplan", new[] { 126110000, 126110001, 126110002, 126110003 }},
            {"re_yesno", new[] { 126110000, 126110001 }},
            {"re_workcenterrequestchoice", new[] { 126110000, 126110001 }},
            {"re_proposallanguagechoice", new[] { 126110000, 126110001 }},
            {"re_timecateogry", new[] { 126110000, 126110001 }},
        };
        public readonly List<string> ChoiceReads = new List<string>();
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
            if (q.EntityName == "re_laborrate") RateQueries++;
            var rows = Rows.Values.Where(r => r.LogicalName == q.EntityName && Matches(r, q.Criteria));
            var all = rows.ToList();
            if (q.TopCount.HasValue) return new EntityCollection(all.Take(q.TopCount.Value).Select(Clone).ToList());
            var count = q.PageInfo?.Count ?? 0;
            if (count == 0) return new EntityCollection(all.Select(Clone).ToList());
            var offset = (q.PageInfo.PageNumber - 1) * count;
            return new EntityCollection(all.Skip(offset).Take(count).Select(Clone).ToList()) {
                MoreRecords = offset + count < all.Count, PagingCookie = "page"
            };
        }
        static object Scalar(object value) => value is EntityReference r ? (object)r.Id : value is OptionSetValue o ? o.Value : value;
        static bool Matches(Entity row, FilterExpression filter) {
            var results = filter.Conditions.Select(c => {
                row.Attributes.TryGetValue(c.AttributeName, out var value); value = Scalar(value);
                if (c.Operator == ConditionOperator.Null) return value == null;
                if (c.Operator == ConditionOperator.Equal) return Equals(value, Scalar(c.Values[0]));
                if (c.Operator == ConditionOperator.BeginsWith)
                    return value is string text && text.StartsWith((string)c.Values[0], StringComparison.OrdinalIgnoreCase);
                if (value == null) return false;
                var comparison = ((IComparable)value).CompareTo(c.Values[0]);
                return c.Operator == ConditionOperator.LessEqual ? comparison <= 0 : comparison >= 0;
            }).Concat(filter.Filters.Select(f => Matches(row, f)));
            return filter.FilterOperator == LogicalOperator.And ? results.All(x => x) : results.Any(x => x);
        }
        public void Update(Entity row) {
            foreach (var value in row.Attributes) Rows[row.Id][value.Key] = value.Value;
            Rows[row.Id].RowVersion = (++version).ToString();
        }
        public void Delete(string name, Guid id) {
            if (name == "re_estimatepackage" && Rows.Values.Any(r =>
                r.GetAttributeValue<EntityReference>("re_estimatepackage")?.Id == id))
                throw new InvalidPluginExecutionException("Package deletion is restricted by linked custom lines.");
            Rows.Remove(id); Deletes++;
        }
        public OrganizationResponse Execute(OrganizationRequest request) {
            if (request is RetrieveAllEntitiesRequest) {
                var response = new RetrieveAllEntitiesResponse();
                response.Results["EntityMetadata"] = (CatalogSchema
                    ? new[] { "re_sparepart", "re_partpricingconfiguration", "re_estimatematerialline" }
                    : new string[0]).Concat(PresetSchema ? new[] { "re_opportunitypreset" } : new string[0])
                    .Select(name => new EntityMetadata { LogicalName = name }).ToArray();
                return response;
            }
            if (request is RetrieveEntityRequest entity) {
                if (entity.LogicalName == "re_estimatepackage") {
                    var package = new EntityMetadata { LogicalName = entity.LogicalName };
                    typeof(EntityMetadata).GetProperty("Attributes").SetValue(package, PackagePricingSchema
                        ? new AttributeMetadata[] {
                            new MoneyAttributeMetadata { LogicalName = "re_materialbeforemarkup" },
                            new BooleanAttributeMetadata { LogicalName = "re_packagepricedkone" }
                        } : new AttributeMetadata[0]);
                    var packageResponse = new RetrieveEntityResponse();
                    packageResponse.Results["EntityMetadata"] = package;
                    return packageResponse;
                }
                if (entity.LogicalName == "re_opportunitypreset") {
                    var preset = new EntityMetadata { LogicalName = entity.LogicalName, OwnershipType = OwnershipTypes.UserOwned };
                    typeof(EntityMetadata).GetProperty("Attributes").SetValue(preset, new AttributeMetadata[] {
                        new StringAttributeMetadata { LogicalName = "re_name", MaxLength = 100 },
                        new MemoAttributeMetadata { LogicalName = "re_payload", MaxLength = 20000 },
                        new PicklistAttributeMetadata { LogicalName = "re_market", OptionSet = new OptionSetMetadata(new OptionMetadataCollection(
                            new[] { 126110000, 126110001, 126110002 }.Select(v => new OptionMetadata(new Label("", 1033), v)).ToList())) }
                    });
                    var presetResponse = new RetrieveEntityResponse();
                    presetResponse.Results["EntityMetadata"] = preset;
                    return presetResponse;
                }
                var type = typeof(DraftPlugin).Assembly.GetType("RepairEstimator.Drafts.PartCatalog");
                var field = entity.LogicalName == "re_sparepart" ? "PartColumns" :
                    entity.LogicalName == "re_partpricingconfiguration" ? "ConfigColumns" : "SnapshotColumns";
                var names = ((string[])type.GetField(field, BindingFlags.Static | BindingFlags.NonPublic).GetValue(null))
                    .Concat(new[] { "re_estimatepackage" });
                var metadata = new EntityMetadata { LogicalName = entity.LogicalName };
                typeof(EntityMetadata).GetProperty("Attributes").SetValue(metadata, names.Select(name => {
                    AttributeMetadata attribute;
                    if (name == "re_unitcostprecise" || name == "re_unitpriceprecise")
                        attribute = new DecimalAttributeMetadata { Precision = SnapshotPrecision };
                    else if (new[] { "re_usdcost", "re_usdprice", "re_sourceusdcost", "re_sourceusdprice", "re_pricingunit" }.Contains(name))
                        attribute = new DecimalAttributeMetadata { Precision = 6 };
                    else if (new[] { "re_usdtocadfactor", "re_costonlyfactor", "re_markuppct", "re_defaultmarkuppct" }.Contains(name))
                        attribute = new DecimalAttributeMetadata { Precision = 2 };
                    else if (name == "re_sparepart" || name == "re_currency" || name == "re_estimatepackage")
                        attribute = new LookupAttributeMetadata { Targets = new[] { name == "re_currency" ? "transactioncurrency" : name } };
                    else if (name == "re_parttype" || name == "re_materialsource" || name == "re_materialscope" || name == "re_market")
                        attribute = new PicklistAttributeMetadata { OptionSet = new OptionSetMetadata(new OptionMetadataCollection(
                            new[] { 126110000, 126110001, 126110002 }.Select(value => new OptionMetadata(new Label("", 1033), value)).ToList())) };
                    else if (name == "re_isenabled") attribute = new BooleanAttributeMetadata();
                    else if (name == "statecode") attribute = new StateAttributeMetadata();
                    else if (name == "re_effectivefrom" || name == "re_effectiveto" || name == "re_refreshedon") attribute = new DateTimeAttributeMetadata();
                    else attribute = new StringAttributeMetadata();
                    attribute.LogicalName = name;
                    return attribute;
                }).Concat(PackagePricingSchema && entity.LogicalName == "re_estimatematerialline"
                    ? new AttributeMetadata[] { new PicklistAttributeMetadata { LogicalName = "re_materialpricingmode",
                        OptionSet = new OptionSetMetadata(new OptionMetadataCollection(new[] { 126110000, 126110001 }
                            .Select(v => new OptionMetadata(new Label("", 1033), v)).ToList())) } }
                    : new AttributeMetadata[0]).ToArray());
                var response = new RetrieveEntityResponse();
                response.Results["EntityMetadata"] = metadata;
                return response;
            }
            if (request is RetrieveOptionSetRequest choice) {
                Assert(ChoiceValues.ContainsKey(choice.Name) && !choice.RetrieveAsIfPublished,
                    "Read only published global draft choices");
                ChoiceReads.Add(choice.Name);
                var metadata = new OptionSetMetadata();
                foreach (var value in ChoiceValues[choice.Name]) {
                    var label = new Label("Live " + choice.Name + " " + value, 1033);
                    label.LocalizedLabels.Add(new LocalizedLabel("Choix " + choice.Name, 1036));
                    metadata.Options.Add(new OptionMetadata(label, value));
                }
                var response = new RetrieveOptionSetResponse();
                response.Results["OptionSetMetadata"] = metadata;
                return response;
            }
            if (request is CreateRequest create) {
                var response = new CreateResponse();
                response.Results["id"] = Create(create.Target);
                return response;
            }
            if (request is DeleteRequest delete) {
                Delete(delete.Target.LogicalName, delete.Target.Id);
                return new DeleteResponse();
            }
            var update = (UpdateRequest)request;
            if (update.ConcurrencyBehavior == ConcurrencyBehavior.IfRowVersionMatches) {
                LastConcurrency = update.ConcurrencyBehavior;
                if (Rows[update.Target.Id].RowVersion != update.Target.RowVersion)
                    throw new InvalidPluginExecutionException("Row version conflict");
            }
            Update(update.Target); return new UpdateResponse();
        }
        public void Associate(string name, Guid id, Relationship relationship, EntityReferenceCollection entities) =>
            throw new NotSupportedException();
        public void Disassociate(string name, Guid id, Relationship relationship, EntityReferenceCollection entities) =>
            throw new NotSupportedException();
    }
}
