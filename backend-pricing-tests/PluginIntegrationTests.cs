using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using Moq;
using RepairEstimator.Drafts;
using RepairEstimator.Plugins.Infrastructure;
using RepairEstimator.Plugins.Plugins;
using RepairEstimator.Plugins.Pricing;
using Xunit;

namespace RepairEstimator.Tests
{
    public class PluginIntegrationTests
    {
        [Theory]
        [InlineData(true, true, true)]
        [InlineData(false, true, false)]
        [InlineData(true, false, false)]
        public void Request_tag_requires_matching_estimate_and_trusted_api_ancestry(
            bool trustedApi, bool matchingId, bool expected)
        {
            var id = Guid.NewGuid();
            var root = new Mock<IPluginExecutionContext>();
            root.SetupGet(c => c.MessageName).Returns(trustedApi ? "re_DraftEstimate" : "Update");
            root.SetupGet(c => c.SharedVariables).Returns(new ParameterCollection());
            var operation = new Mock<IPluginExecutionContext>();
            operation.SetupGet(c => c.MessageName).Returns("Create");
            operation.SetupGet(c => c.SharedVariables).Returns(new ParameterCollection {
                ["tag"] = "RepairEstimator.DraftBatch:" + (matchingId ? id : Guid.NewGuid()).ToString("D")
            });
            operation.SetupGet(c => c.ParentContext).Returns(root.Object);
            var step = new Mock<IPluginExecutionContext>();
            step.SetupGet(c => c.MessageName).Returns("Create");
            step.SetupGet(c => c.SharedVariables).Returns(new ParameterCollection());
            step.SetupGet(c => c.ParentContext).Returns(operation.Object);
            step.SetupGet(c => c.InputParameters).Returns(new ParameterCollection {
                ["Target"] = new Entity(Names.EstimateEquipment.Entity, Guid.NewGuid()) {
                    [Names.ChildParentLookup] = new EntityReference(Names.Estimate.Entity, id)
                }
            });
            var factory = new Mock<IOrganizationServiceFactory>();
            var trace = new Mock<ITracingService>();
            var provider = new Mock<IServiceProvider>();
            provider.Setup(p => p.GetService(typeof(IPluginExecutionContext))).Returns(step.Object);
            provider.Setup(p => p.GetService(typeof(IOrganizationServiceFactory))).Returns(factory.Object);
            provider.Setup(p => p.GetService(typeof(ITracingService))).Returns(trace.Object);
            var error = Record.Exception(() => new EstimateEquipmentSnapshotPlugin().Execute(provider.Object));
            if (expected) Assert.Null(error);
            else Assert.Contains("RE-141", Assert.IsType<InvalidPluginExecutionException>(error).Message);
        }

        [Fact]
        public void Real_draft_api_runs_one_final_calculation_and_preserves_snapshots_on_update()
        {
            var db = new Pipeline();
            var request = db.DraftJson();
            var result = db.Save(request);
            Assert.Contains("\"pricingState\":\"" + PricingEngine.Version + "\"", result);
            Assert.Equal(1, db.Calculations);
            var header = db.Rows[db.EstimateId];
            Assert.Equal(300m, header.GetAttributeValue<Money>(Names.Estimate.TotalTrueCost).Value);
            Assert.Equal(600m, header.GetAttributeValue<Money>(Names.Estimate.SuggestedPrice).Value);
            db.Rows[db.PackageId]["re_mechanichours"] = 999m;
            db.Rows[db.PackageId]["re_materialmisctaxcost"] = new Money(999m);
            var version = header.RowVersion;
            db.Save(db.DraftJson(version));
            Assert.Equal(2, db.Calculations);
            Assert.Equal(300m, db.Rows[db.EstimateId].GetAttributeValue<Money>(Names.Estimate.TotalTrueCost).Value);
            Assert.Throws<InvalidPluginExecutionException>(() => db.Save(db.DraftJson(version)));
            Assert.Equal(2, db.Calculations);
        }

        [Fact]
        public void Below_cost_sell_price_keeps_server_pricing_and_negative_actual_margin()
        {
            var db = new Pipeline();
            db.Add(Names.IncentiveRate.Entity,
                (Names.IncentiveRate.MinimumCmii, 0m),
                (Names.IncentiveRate.AmPayout, 0m),
                (Names.IncentiveRate.BdPayout, 0m));
            db.Save(db.DraftJson());
            db.Caller.Update(new Entity(Names.Estimate.Entity, db.EstimateId) {
                [Names.Estimate.SellPrice] = new Money(25m)
            });
            var header = db.Rows[db.EstimateId];
            Assert.Equal(PricingEngine.Version, header.GetAttributeValue<string>(Names.Estimate.CalculationVersion));
            Assert.Equal(600m, header.GetAttributeValue<Money>(Names.Estimate.SuggestedPrice).Value);
            Assert.Equal(-11m, header.GetAttributeValue<decimal>(Names.Estimate.ActualCmii));
            Assert.Equal(0m, header.GetAttributeValue<Money>(Names.Estimate.AmIncentive).Value);
            Assert.Equal(0m, header.GetAttributeValue<Money>(Names.Estimate.BdIncentive).Value);
        }

        [Fact]
        public void Missing_rate_keeps_draft_but_clears_stale_pricing_and_returns_unavailable()
        {
            var db = new Pipeline();
            db.Save(db.DraftJson());
            db.RemoveTable(Names.LaborRate.Entity);
            var result = db.Save(db.DraftJson(db.Rows[db.EstimateId].RowVersion));
            Assert.Contains("\"pricingState\":\"unavailable\"", result);
            Assert.Null(db.Rows[db.EstimateId].GetAttributeValue<Money>(Names.Estimate.SuggestedPrice));
            Assert.Null(db.Rows[db.EstimateId].GetAttributeValue<Money>(Names.Estimate.TotalTrueCost));
            Assert.Contains(db.Traces, t => t.Contains("LABOR_RATE_MISSING"));
        }

        [Fact]
        public void Missing_configuration_does_not_prevent_draft_capture()
        {
            var db = new Pipeline();
            db.RemoveTable(Names.PricingParameter.Entity);
            Assert.Contains("\"pricingState\":\"unavailable\"", db.Save(db.DraftJson()));
            Assert.Single(db.Rows.Values, r => r.LogicalName == Names.EstimatePackage.Entity);
        }

        [Fact]
        public void Missing_pricing_blocks_submission()
        {
            var db = new Pipeline();
            db.RemoveTable(Names.LaborRate.Entity);
            db.Save(db.DraftJson());
            var target = new Entity(Names.Estimate.Entity, db.EstimateId) {
                [Names.Estimate.Status] = new OptionSetValue(Labels.SubmittedStatus)
            };
            Assert.Throws<InvalidPluginExecutionException>(() => db.Caller.Update(target));
        }

        [Theory]
        [InlineData(1)]
        [InlineData(3)]
        public void Submitted_estimates_are_locked_even_for_nested_admin_operations(int depth)
        {
            var db = new Pipeline();
            db.Save(db.DraftJson());
            db.Rows[db.EstimateId][Names.Estimate.Status] = new OptionSetValue(Labels.SubmittedStatus);
            var target = new Entity(Names.Estimate.Entity, db.EstimateId) { [Names.Estimate.SellPrice] = new Money(1m) };
            var error = Assert.Throws<InvalidPluginExecutionException>(() =>
                db.Invoke(new EstimateLockPlugin(), "Update", target, null, depth));
            Assert.Contains("ESTIMATE_LOCKED", error.Message);
        }

        [Fact]
        public void Moving_child_checks_old_locked_parent_as_well_as_new_parent()
        {
            var db = new Pipeline();
            db.Save(db.DraftJson());
            var child = db.Rows.Values.First(r => r.LogicalName == Names.EstimateEquipment.Entity);
            var nextParent = db.Add(Names.Estimate.Entity, (Names.Estimate.Status, new OptionSetValue(Labels.DraftStatus)));
            db.Rows[db.EstimateId][Names.Estimate.Status] = new OptionSetValue(Labels.SubmittedStatus);
            var target = new Entity(child.LogicalName, child.Id) {
                [Names.ChildParentLookup] = nextParent.ToEntityReference()
            };
            Assert.Throws<InvalidPluginExecutionException>(() => db.Invoke(new ChildLockPlugin(), "Update", target, null, 3));
        }

        [Fact]
        public void Direct_snapshot_writes_are_rejected_outside_the_draft_api()
        {
            var db = new Pipeline();
            db.Save(db.DraftJson());
            var child = db.Rows.Values.First(r => r.LogicalName == Names.EstimatePackage.Entity);
            var target = new Entity(child.LogicalName, child.Id) { [Names.EstimatePackage.Material] = new Money(1m) };
            Assert.Throws<InvalidPluginExecutionException>(() =>
                db.Invoke(new EstimatePackageSnapshotPlugin(), "Update", target));
        }

        [Fact]
        public void Matched_equipment_uses_location_not_sold_to_for_redundancy()
        {
            var db = new Pipeline();
            db.UseMatchedEquipment = true;
            db.Add(Names.Equipment.Entity, ("re_functionallocation", "SITE-A"), ("re_equipment", "E2"), ("re_soldtonumber", "OTHER"));
            db.Add(Names.Equipment.Entity, ("re_functionallocation", "SITE-B"), ("re_equipment", "E3"), ("re_soldtonumber", "CUSTOMER"));
            db.Save(db.DraftJson());
            Assert.Equal(2, db.Rows[db.EstimateId].GetAttributeValue<int>(Names.Estimate.RedundancyCount));
        }

        [Fact]
        public void Configuration_services_never_read_customer_or_estimate_rows()
        {
            var db = new Pipeline();
            db.UseMatchedEquipment = true;
            db.Save(db.DraftJson());
            Assert.DoesNotContain(db.ConfigReads, name => name == Names.Equipment.Entity ||
                name == Names.Estimate.Entity || name == Names.Branch.Entity ||
                name == Names.EstimateEquipment.Entity || name == Names.EstimatePackage.Entity);
        }

        [Fact]
        public void Missing_snapshot_never_falls_back_to_the_package_master()
        {
            var db = new Pipeline();
            db.Save(db.DraftJson());
            var child = db.Rows.Values.Single(r => r.LogicalName == Names.EstimatePackage.Entity);
            child.Attributes.Remove(Names.EstimatePackage.Hours);
            db.Caller.Update(new Entity(Names.Estimate.Entity, db.EstimateId) {
                [Names.Estimate.NumberOfEquipment] = 1
            });
            Assert.Equal("unavailable", db.Rows[db.EstimateId].GetAttributeValue<string>(Names.Estimate.CalculationVersion));
            Assert.Contains(db.Traces, t => t.Contains("PACKAGE_SNAPSHOT_MISSING"));
        }

        [Fact]
        public void Custom_draft_api_uses_trusted_rates_and_calculates_once_with_package_costs()
        {
            var db = new Pipeline();
            db.Rows[db.PackageId]["re_iscustompackage"] = true;
            var json = db.DraftJson();
            json = json.Substring(0, json.Length - 1) +
                ",\"laborLines\":[{\"id\":\"new-labor\",\"role\":126110000,\"time\":126110000,\"hours\":3,\"rate\":1}]," +
                "\"materialLines\":[{\"id\":\"new-material\",\"description\":\"Motor\",\"vendor\":\"KONE\",\"part\":\"KM1\",\"quantity\":2,\"unitCost\":25}]}";
            var result = db.Save(json);
            Assert.Equal(1, db.Calculations);
            Assert.Contains("\"rate\":100", result);
            Assert.Equal(650m, db.Rows[db.EstimateId].GetAttributeValue<Money>(Names.Estimate.TotalTrueCost).Value);
            var labor = db.Rows.Values.Single(e => e.LogicalName == Names.EstimateLaborLine.Entity);
            Assert.Equal(100m, labor.GetAttributeValue<Money>(Names.EstimateLaborLine.Rate).Value);
            var error = Assert.Throws<InvalidPluginExecutionException>(() => db.Caller.Update(
                new Entity(labor.LogicalName, labor.Id) { ["re_hourlycost"] = new Money(1m) }));
            Assert.Contains("RE-141", error.Message);
        }

        [Theory]
        [InlineData("re_estimatelaborline")]
        [InlineData("re_estimatematerialline")]
        public void Custom_line_direct_creation_cannot_bypass_the_draft_api(string table)
        {
            var db = new Pipeline();
            db.Save(db.DraftJson());
            var error = Assert.Throws<InvalidPluginExecutionException>(() => db.Caller.Create(
                new Entity(table) { ["re_repairestimate"] = new EntityReference(Names.Estimate.Entity, db.EstimateId) }));
            Assert.Contains("RE-141", error.Message);
        }

        [Fact]
        public void Oversized_draft_fails_before_creating_records()
        {
            var db = new Pipeline();
            var error = Assert.Throws<InvalidPluginExecutionException>(() =>
                db.Save(db.DraftJson().Replace("\"title\":\"Draft\"", "\"title\":\"" + new string('x', 200000) + "\"")));
            Assert.Contains("request budget", error.Message);
            Assert.False(db.Rows.ContainsKey(db.EstimateId));
        }

        [Fact]
        public void Custom_path_loads_lines_and_keeps_package_costs()
        {
            var db = new Pipeline();
            db.Save(db.DraftJson());
            db.Caller.Update(new Entity(Names.Estimate.Entity, db.EstimateId) {
                [Names.Estimate.Path] = new OptionSetValue(126110001)
            });
            Assert.NotEqual("unavailable", db.Rows[db.EstimateId].GetAttributeValue<string>(Names.Estimate.CalculationVersion));
            Assert.True(db.Rows[db.EstimateId].GetAttributeValue<Money>(Names.Estimate.TotalTrueCost).Value > 0);
        }

        sealed class Pipeline
        {
            public readonly Dictionary<Guid, Entity> Rows = new Dictionary<Guid, Entity>();
            public readonly List<string> Traces = new List<string>(), ConfigReads = new List<string>();
            public readonly Guid EstimateId = Guid.NewGuid(), BranchId = Guid.NewGuid(), StateId = Guid.NewGuid(),
                CountryId = Guid.NewGuid(), CurrencyId = Guid.NewGuid(), TypeId = Guid.NewGuid(),
                PackageId = Guid.NewGuid(), EquipmentId = Guid.NewGuid(), UserId = Guid.NewGuid();
            public IOrganizationService Caller { get; }
            readonly IOrganizationService config;
            IPluginExecutionContext current;
            string requestTag;
            long version;
            public int Calculations;
            public bool UseMatchedEquipment;

            public Pipeline()
            {
                var caller = new Mock<IOrganizationService>(MockBehavior.Strict);
                Caller = caller.Object;
                caller.Setup(s => s.Retrieve(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<ColumnSet>()))
                    .Returns((string name, Guid id, ColumnSet cols) => Select(Rows[id], cols));
                caller.Setup(s => s.RetrieveMultiple(It.IsAny<QueryBase>())).Returns((QueryBase q) => Query((QueryExpression)q));
                caller.Setup(s => s.Create(It.IsAny<Entity>())).Returns((Entity e) => Write(e, true));
                caller.Setup(s => s.Update(It.IsAny<Entity>())).Callback((Entity e) => Write(e, false));
                caller.Setup(s => s.Delete(It.IsAny<string>(), It.IsAny<Guid>())).Callback((string name, Guid id) => {
                    var row = Rows[id];
                    Invoke(new ChildLockPlugin(), "Delete", row.ToEntityReference());
                    Rows.Remove(id);
                    Invoke(new ChildChangeTriggerPlugin(), "Delete", row.ToEntityReference(), row);
                });
                caller.Setup(s => s.Execute(It.IsAny<OrganizationRequest>())).Returns((OrganizationRequest r) => {
                    var previousTag = requestTag;
                    requestTag = r.Parameters.Contains("tag") ? (string)r["tag"] : null;
                    try
                    {
                        if (r is CreateRequest create) {
                            var response = new CreateResponse();
                            response.Results["id"] = Write(create.Target, true);
                            return response;
                        }
                        if (r is DeleteRequest delete) {
                            Caller.Delete(delete.Target.LogicalName, delete.Target.Id);
                            return new DeleteResponse();
                        }
                        var update = (UpdateRequest)r;
                        if (update.ConcurrencyBehavior == ConcurrencyBehavior.IfRowVersionMatches &&
                            Rows[update.Target.Id].RowVersion != update.Target.RowVersion)
                            throw new InvalidPluginExecutionException("Row version conflict");
                        Write(update.Target, false); return new UpdateResponse();
                    }
                    finally { requestTag = previousTag; }
                });
                var system = new Mock<IOrganizationService>(MockBehavior.Strict);
                config = system.Object;
                system.Setup(s => s.RetrieveMultiple(It.IsAny<QueryBase>())).Returns((QueryBase q) => {
                    var query = (QueryExpression)q; ConfigReads.Add(query.EntityName); return Query(query);
                });
                system.Setup(s => s.Execute(It.IsAny<OrganizationRequest>())).Returns((OrganizationRequest r) => {
                    var request = (RetrieveOptionSetRequest)r;
                    var labels = LabelsFor(request.Name);
                    var meta = new OptionSetMetadata { Name = request.Name };
                    for (var n = 0; n < labels.Length; n++)
                        meta.Options.Add(new OptionMetadata(new Label(labels[n], 1033), 126110000 + n));
                    var response = new RetrieveOptionSetResponse();
                    response.Results["OptionSetMetadata"] = meta; return response;
                });
                Seed();
            }

            public string Save(string json)
            {
                var output = Invoke(new DraftPlugin(), "re_DraftEstimate", null, null, 1, json);
                return (string)output["ResultJson"];
            }

            public ParameterCollection Invoke(IPlugin plugin, string message, object target, Entity pre = null,
                int depth = 2, string json = null)
            {
                var input = new ParameterCollection();
                if (target != null) input["Target"] = target;
                if (json != null) input["InputJson"] = json;
                var output = new ParameterCollection();
                var images = new EntityImageCollection();
                if (pre != null) images["pre"] = Select(pre, new ColumnSet(true));
                var context = new Mock<IPluginExecutionContext>();
                context.SetupGet(c => c.MessageName).Returns(message);
                context.SetupGet(c => c.PrimaryEntityName).Returns(
                    target is Entity e ? e.LogicalName : (target as EntityReference)?.LogicalName);
                context.SetupGet(c => c.InputParameters).Returns(input);
                context.SetupGet(c => c.OutputParameters).Returns(output);
                context.SetupGet(c => c.PreEntityImages).Returns(images);
                var shared = new ParameterCollection();
                if (requestTag != null) shared["tag"] = requestTag;
                context.SetupGet(c => c.SharedVariables).Returns(shared);
                context.SetupGet(c => c.ParentContext).Returns(current);
                context.SetupGet(c => c.UserId).Returns(UserId);
                context.SetupGet(c => c.InitiatingUserId).Returns(UserId);
                context.SetupGet(c => c.Depth).Returns(depth);
                context.SetupGet(c => c.IsInTransaction).Returns(true);
                var factory = new Mock<IOrganizationServiceFactory>();
                factory.Setup(f => f.CreateOrganizationService(It.IsAny<Guid?>()))
                    .Returns((Guid? id) => id.HasValue ? Caller : config);
                var trace = new Mock<ITracingService>();
                trace.Setup(t => t.Trace(It.IsAny<string>(), It.IsAny<object[]>()))
                    .Callback((string format, object[] args) => Traces.Add(string.Format(format, args)));
                var provider = new Mock<IServiceProvider>();
                provider.Setup(p => p.GetService(typeof(IPluginExecutionContext))).Returns(context.Object);
                provider.Setup(p => p.GetService(typeof(IOrganizationServiceFactory))).Returns(factory.Object);
                provider.Setup(p => p.GetService(typeof(ITracingService))).Returns(trace.Object);
                var previous = current; current = context.Object;
                try { plugin.Execute(provider.Object); return output; }
                finally { current = previous; }
            }

            Guid Write(Entity target, bool create)
            {
                if (target.Id == Guid.Empty) target.Id = Guid.NewGuid();
                var pre = create ? null : Select(Rows[target.Id], new ColumnSet(true));
                var message = create ? "Create" : "Update";
                if (target.LogicalName == Names.Estimate.Entity)
                {
                    if (!create) Invoke(new EstimateLockPlugin(), message, target);
                    if (!IsBatch(target.Id)) Calculations++;
                    Invoke(new EstimateCalculationPlugin(), message, target, pre);
                }
                else
                {
                    Invoke(new ChildLockPlugin(), message, target, pre);
                    IPlugin guard = target.LogicalName == Names.EstimateEquipment.Entity
                        ? (IPlugin)new EstimateEquipmentSnapshotPlugin() : target.LogicalName == Names.EstimatePackage.Entity
                        ? new EstimatePackageSnapshotPlugin() : (IPlugin)new EstimateCustomLineSnapshotPlugin();
                    Invoke(guard, message, target, pre);
                }
                var row = pre ?? new Entity(target.LogicalName, target.Id);
                foreach (var a in target.Attributes) row[a.Key] = a.Value;
                if (create) {
                    row["statecode"] = new OptionSetValue(0);
                    row["ownerid"] = new EntityReference("systemuser", UserId);
                    if (target.LogicalName == Names.Estimate.Entity) row["re_name"] = "0000000042";
                }
                row.RowVersion = (++version).ToString(); Rows[row.Id] = row;
                if (target.LogicalName != Names.Estimate.Entity)
                    Invoke(new ChildChangeTriggerPlugin(), message, target, pre);
                return row.Id;
            }

            bool IsBatch(Guid id) => requestTag == "RepairEstimator.DraftBatch:" + id.ToString("D");

            static Entity Select(Entity row, ColumnSet cols) {
                var copy = new Entity(row.LogicalName, row.Id) { RowVersion = row.RowVersion };
                foreach (var a in row.Attributes)
                    if (cols.AllColumns || cols.Columns.Contains(a.Key)) copy[a.Key] = a.Value;
                return copy;
            }
            EntityCollection Query(QueryExpression q) {
                var rows = Rows.Values.Where(e => e.LogicalName == q.EntityName && Matches(e, q.Criteria));
                if (q.TopCount.HasValue) rows = rows.Take(q.TopCount.Value);
                return new EntityCollection(rows.Select(e => Select(e, q.ColumnSet)).ToList());
            }
            static object Scalar(object value) => value is EntityReference r ? (object)r.Id :
                value is OptionSetValue o ? o.Value : value;
            static bool Matches(Entity row, FilterExpression f) {
                var values = f.Conditions.Select(c => {
                    row.Attributes.TryGetValue(c.AttributeName, out var value); value = Scalar(value);
                    if (c.Operator == ConditionOperator.Null) return value == null;
                    if (c.Operator == ConditionOperator.Equal) return Equals(value, Scalar(c.Values[0]));
                    if (value == null) return false;
                    var comparison = ((IComparable)value).CompareTo(c.Values[0]);
                    return c.Operator == ConditionOperator.LessEqual ? comparison <= 0 : comparison >= 0;
                }).Concat(f.Filters.Select(child => Matches(row, child)));
                return f.FilterOperator == LogicalOperator.And ? values.All(v => v) : values.Any(v => v);
            }
            public Entity Add(string table, params (string key, object value)[] values) {
                var row = new Entity(table, Guid.NewGuid()) { ["statecode"] = new OptionSetValue(0),
                    [Names.EffectiveFrom] = DateTime.UtcNow.AddDays(-1) };
                foreach (var value in values) row[value.key] = value.value;
                Rows[row.Id] = row; return row;
            }
            void Fixed(Guid id, string table, params (string key, object value)[] values) {
                var row = Add(table, values); Rows.Remove(row.Id); row.Id = id; Rows[id] = row;
            }
            public void RemoveTable(string table) {
                foreach (var id in Rows.Values.Where(e => e.LogicalName == table).Select(e => e.Id).ToList()) Rows.Remove(id);
            }
            void Seed() {
                var group = Guid.NewGuid();
                Fixed(BranchId, Names.Branch.Entity, ("re_country", new EntityReference("re_country", CountryId)),
                    ("re_currency", new EntityReference("transactioncurrency", CurrencyId)),
                    ("re_market", new OptionSetValue(126110000)), ("re_margingroup", new EntityReference("re_margingroup", group)));
                Fixed(StateId, Names.StateProvince.Entity, ("re_country", new EntityReference("re_country", CountryId)));
                Fixed(TypeId, Names.EquipmentType.Entity);
                Fixed(PackageId, Names.RepairPackage.Entity, ("re_packagenumber", "P1"), ("re_packagenameen", "Package"),
                    ("re_proposalscopeen", "Scope"), ("re_mechanichours", 2m), ("re_materialmisctaxcost", new Money(100m)),
                    ("re_currency", new EntityReference("transactioncurrency", CurrencyId)));
                Fixed(EquipmentId, Names.Equipment.Entity, ("re_equipment", "E1"), ("re_branch", new EntityReference("re_branch", BranchId)),
                    ("re_functionallocation", "SITE-A"), ("re_oem", "OTIS"), ("re_equipmentage", 10), ("re_soldtonumber", "CUSTOMER"));
                Add(Names.LaborRate.Entity, ("re_branch", new EntityReference("re_branch", BranchId)),
                    ("re_laborrole", new OptionSetValue(126110000)), ("re_timecategory", new OptionSetValue(126110000)), ("re_hourlycost", 100m));
                foreach (var pair in new[] { (ParamCode.MedianQrMargin, .5m), (ParamCode.QqThreshold, 5000m),
                    (ParamCode.AgeThreshold, 15m), (ParamCode.MaterialMarginFloor, .65m),
                    (ParamCode.ApprovalDistrict, 150000m), (ParamCode.ApprovalRegional, 250000m),
                    (ParamCode.DownPaymentThreshold, 5000m) })
                    Add(Names.PricingParameter.Entity, ("re_name", pair.Item1), ("re_decimalvalue", pair.Item2));
                foreach (var band in new[] { 126110000, 126110001, 126110002 })
                    Add(Names.MarginRule.Entity, ("re_margingroup", new EntityReference("re_margingroup", group)),
                        ("re_quotetype", new OptionSetValue(126110000)), ("re_equipmentband", new OptionSetValue(band)),
                        ("re_customerband", new OptionSetValue(126110001)), ("re_targetcm2", .5m));
                Add(Names.JobSizeBand.Entity, ("re_quotetype", new OptionSetValue(126110001)),
                    ("re_minimumamount", new Money(0)), ("re_complexityband", new OptionSetValue(126110000)));
                foreach (var type in new[] { 126110000, 126110001, 126110002, 126110003 })
                    foreach (var b1 in new[] { 126110000, 126110001, 126110002 })
                        foreach (var b2 in new[] { 126110000, 126110001, 126110002 })
                            Add(Names.BandMatrix.Entity, ("re_matrixtype", new OptionSetValue(type)),
                                ("re_input1band", new OptionSetValue(b1)), ("re_input2band", new OptionSetValue(b2)),
                                ("re_resultband", new OptionSetValue(126110001)));
                Add(Names.RedundancyBand.Entity, ("re_minimumequipment", 1), ("re_redundancyband", new OptionSetValue(126110000)));
            }
            public string DraftJson(string rowVersion = null) {
                return "{\"mode\":\"save\",\"id\":\"" + EstimateId + "\",\"version\":" +
                    (rowVersion == null ? "null" : "\"" + rowVersion + "\"") +
                    ",\"title\":\"Draft\",\"building\":\"Building\",\"customer\":\"Customer\",\"branchId\":\"" +
                    BranchId + "\",\"stateId\":\"" + StateId + "\",\"equipmentTypeId\":\"" + TypeId +
                    "\",\"market\":126110000,\"fields\":[{\"key\":\"re_proposallanguage\",\"value\":\"126110000\"}," +
                    "{\"key\":\"re_timecategory\",\"value\":\"126110000\"},{\"key\":\"re_usetax\",\"value\":\"0\"}," +
                    "{\"key\":\"re_freight\",\"value\":\"0\"}],\"equipment\":[{\"number\":\"E1\",\"matched\":" +
                    (UseMatchedEquipment ? "true,\"id\":\"" + EquipmentId + "\"" : "false") +
                    "}],\"packages\":[{\"id\":\"" + PackageId + "\"}]}";
            }
            static string[] LabelsFor(string set) {
                switch (set) {
                    case "re_pricingband": return new[] { "High", "Medium", "Low" };
                    case "re_quotetype": case "re_quotetypechoice": return new[] { "QQ", "QR" };
                    case "re_laborrole": return new[] { "Mechanic" };
                    case "re_estimatepathchoice": return new[] { "Standard", "Custom" };
                    case "re_approvallevel": return new[] { "None", "District", "Regional" };
                    case "re_yesno": return new[] { "Yes", "No" };
                    case "re_bandmatrixtype": return new[] { "Equipment", "Job Type", "Customer Base", "Customer Final" };
                    case "re_estimatestatuschoice": return new[] { "Draft", "Pending", "Submitted" };
                    default: throw new Exception("Unexpected metadata query " + set);
                }
            }
        }
    }
}
