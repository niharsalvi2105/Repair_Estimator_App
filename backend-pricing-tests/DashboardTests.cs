using System;
using System.Collections.Generic;
using System.Linq;
using System.Xml.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Moq;
using RepairEstimator.Drafts;
using Xunit;

namespace RepairEstimator.Tests
{
    public class DashboardTests
    {
        [Theory]
        [InlineData(false, false)]
        [InlineData(true, false)]
        [InlineData(false, true)]
        public void Server_derives_direct_or_team_admin_scope_and_includes_all_dates(bool directAdmin, bool teamAdmin)
        {
            var service = new Mock<IOrganizationService>(MockBehavior.Strict);
            var queries = new List<string>();
            service.Setup(s => s.RetrieveMultiple(It.IsAny<QueryBase>())).Returns((QueryBase q) => {
                var xml = ((FetchExpression)q).Query;
                if (xml.Contains("<entity name='role'>"))
                    return new EntityCollection((xml.Contains("name='systemuserroles'") ? directAdmin : teamAdmin)
                        ? new[] { new Entity("role", Guid.NewGuid()) } : new Entity[0]);
                queries.Add(xml);
                if (!xml.Contains("alias='average'")) return new EntityCollection();
                var row = new Entity("aggregate");
                row["count"] = new AliasedValue("re_repairestimate", "count", 0);
                return new EntityCollection(new[] { row });
            });
            var reader = typeof(DraftPlugin).Assembly.GetType("RepairEstimator.Drafts.DashboardReader");
            var result = (DashboardResult)reader.GetMethod("Read").Invoke(null, new object[] {
                service.Object, Guid.NewGuid(), 126110000,
                DateTime.Parse("2027-01-01T05:59:59Z", System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal)
            });
            Assert.Equal("all-time", result.period);
            Assert.Equal(directAdmin || teamAdmin, result.ownerId == null);
            Assert.All(queries, xml => {
                Assert.DoesNotContain("createdon", xml);
                Assert.Equal(!(directAdmin || teamAdmin), xml.Contains("attribute='ownerid'"));
            });
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void Dashboard_is_read_only_and_uses_caller_owner_market_and_all_dates(bool empty)
        {
            var user = Guid.NewGuid();
            var queries = new List<string>();
            var service = new Mock<IOrganizationService>(MockBehavior.Strict);
            service.Setup(s => s.RetrieveMultiple(It.IsAny<QueryBase>())).Returns((QueryBase q) => {
                var xml = ((FetchExpression)q).Query;
                if (xml.Contains("<entity name='role'>")) return new EntityCollection();
                queries.Add(xml);
                var count = empty ? 0 : 2;
                var row = new Entity("aggregate");
                row["count"] = new AliasedValue("re_repairestimate", "count", count);
                if (xml.Contains("alias='average'")) {
                    if (!empty) row["average"] = new AliasedValue("re_repairestimate", "average", -0.25m);
                }
                else if (empty) return new EntityCollection();
                else if (xml.Contains("alias='status'"))
                    row["status"] = new AliasedValue("re_repairestimate", "status", new OptionSetValue(126110000));
                return new EntityCollection(new[] { row });
            });
            var output = Run(service.Object, user,
                "{\"mode\":\"dashboard\",\"market\":126110000,\"ownerId\":\"" + Guid.NewGuid() + "\"}");
            Assert.Contains("\"mode\":\"dashboard\"", output);
            Assert.Contains(empty ? "\"averageCmii\":null" : "\"averageCmii\":-0.25", output);
            Assert.Equal(3, queries.Count);
            foreach (var xml in queries) {
                var conditions = XDocument.Parse(xml).Descendants("condition").ToList();
                Assert.Contains(conditions, c => (string)c.Attribute("attribute") == "ownerid" &&
                    (string)c.Attribute("value") == user.ToString("D"));
                Assert.Contains(conditions, c => (string)c.Attribute("attribute") == "re_market" &&
                    (string)c.Attribute("value") == "126110000");
                Assert.Contains(conditions, c => (string)c.Attribute("attribute") == "statecode" &&
                    (string)c.Attribute("value") == "0");
                Assert.DoesNotContain(conditions, c => (string)c.Attribute("attribute") == "createdon");
            }
            Assert.Contains("value='unavailable'", queries[2]);
            Assert.Contains("attribute='re_sellprice' operator='gt' value='0'", queries[2]);
            Assert.Contains("attribute='re_actualcmii' operator='not-null'", queries[2]);
        }

        [Fact]
        public void Four_drafts_across_owners_and_years_match_admin_table_but_estimator_counts_own()
        {
            var user = Guid.NewGuid();
            foreach (bool admin in new[] { false, true })
            {
                var service = new Mock<IOrganizationService>(MockBehavior.Strict);
                service.Setup(s => s.RetrieveMultiple(It.IsAny<QueryBase>())).Returns((QueryBase q) => {
                    var xml = ((FetchExpression)q).Query;
                    if (xml.Contains("<entity name='role'>"))
                    {
                        Assert.Contains(user.ToString("D"), xml);
                        return new EntityCollection(admin
                            ? new[] { new Entity("role", Guid.NewGuid()) } : new Entity[0]);
                    }
                    var conditions = XDocument.Parse(xml).Descendants("condition").ToList();
                    var drafts = new[] {
                        new { Owner = user, Created = new DateTime(2026, 1, 1) },
                        new { Owner = user, Created = new DateTime(2025, 1, 1) },
                        new { Owner = Guid.NewGuid(), Created = new DateTime(2026, 1, 1) },
                        new { Owner = Guid.NewGuid(), Created = new DateTime(2024, 1, 1) }
                    };
                    Assert.DoesNotContain(conditions, c => (string)c.Attribute("attribute") == "createdon");
                    int count = drafts.Count(d => conditions.Where(c => (string)c.Attribute("attribute") == "ownerid")
                        .All(c => d.Owner == Guid.Parse((string)c.Attribute("value"))));
                    var row = new Entity("aggregate");
                    row["count"] = new AliasedValue("re_repairestimate", "count", count);
                    if (xml.Contains("alias='average'"))
                        row["average"] = new AliasedValue("re_repairestimate", "average", 0.25m);
                    else if (xml.Contains("alias='status'"))
                        row["status"] = new AliasedValue("re_repairestimate", "status", new OptionSetValue(126110000));
                    return new EntityCollection(new[] { row });
                });
                var output = Run(service.Object, user,
                    "{\"mode\":\"dashboard\",\"market\":126110000,\"ownerId\":null,\"period\":\"all-time\",\"role\":\"admin\"}");
                Assert.Contains("\"total\":" + (admin ? 4 : 2), output);
                Assert.Contains("\"period\":\"all-time\"", output);
                Assert.Contains(admin ? "\"ownerId\":null" : "\"ownerId\":\"" + user.ToString("D") + "\"", output);
            }
        }

        [Fact]
        public void Invalid_market_and_truncated_aggregates_are_errors_not_zero_counts()
        {
            var service = new Mock<IOrganizationService>(MockBehavior.Strict);
            Assert.Throws<InvalidPluginExecutionException>(() => Run(service.Object, Guid.NewGuid(),
                "{\"mode\":\"dashboard\",\"market\":7}"));
            service.Setup(s => s.RetrieveMultiple(It.IsAny<QueryBase>()))
                .Returns((QueryBase q) => new EntityCollection {
                    MoreRecords = !((FetchExpression)q).Query.Contains("<entity name='role'>")
                });
            Assert.Contains("truncated", Assert.Throws<InvalidPluginExecutionException>(() =>
                Run(service.Object, Guid.NewGuid(), "{\"mode\":\"dashboard\",\"market\":126110000}")).Message);
        }

        [Fact]
        public void Permission_failures_do_not_become_empty_dashboard_success()
        {
            var service = new Mock<IOrganizationService>(MockBehavior.Strict);
            service.Setup(s => s.RetrieveMultiple(It.IsAny<QueryBase>()))
                .Throws(new InvalidPluginExecutionException("Read denied"));
            Assert.Contains("Read denied", Assert.Throws<InvalidPluginExecutionException>(() =>
                Run(service.Object, Guid.NewGuid(), "{\"mode\":\"dashboard\",\"market\":126110000}")).Message);
        }

        static string Run(IOrganizationService service, Guid user, string json)
        {
            var context = new Mock<IPluginExecutionContext>();
            context.SetupGet(c => c.IsInTransaction).Returns(true);
            context.SetupGet(c => c.UserId).Returns(user);
            context.SetupGet(c => c.InitiatingUserId).Returns(user);
            context.SetupGet(c => c.InputParameters).Returns(new ParameterCollection { ["InputJson"] = json });
            var output = new ParameterCollection();
            context.SetupGet(c => c.OutputParameters).Returns(output);
            var factory = new Mock<IOrganizationServiceFactory>(MockBehavior.Strict);
            factory.Setup(f => f.CreateOrganizationService(user)).Returns(service);
            var provider = new Mock<IServiceProvider>();
            provider.Setup(p => p.GetService(typeof(IPluginExecutionContext))).Returns(context.Object);
            provider.Setup(p => p.GetService(typeof(IOrganizationServiceFactory))).Returns(factory.Object);
            provider.Setup(p => p.GetService(typeof(ITracingService))).Returns(Mock.Of<ITracingService>());
            new DraftPlugin().Execute(provider.Object);
            return (string)output["ResultJson"];
        }
    }
}
