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
        [InlineData("2027-01-01T05:59:59Z", 2026)]
        [InlineData("2027-01-01T06:00:00Z", 2027)]
        public void Server_uses_Lisle_midnight_at_the_year_boundary(string instant, int year)
        {
            var service = new Mock<IOrganizationService>(MockBehavior.Strict);
            var queries = new List<string>();
            service.Setup(s => s.RetrieveMultiple(It.IsAny<QueryBase>())).Returns((QueryBase q) => {
                var xml = ((FetchExpression)q).Query;
                queries.Add(xml);
                if (!xml.Contains("alias='average'")) return new EntityCollection();
                var row = new Entity("aggregate");
                row["count"] = new AliasedValue("re_repairestimate", "count", 0);
                return new EntityCollection(new[] { row });
            });
            var reader = typeof(DraftPlugin).Assembly.GetType("RepairEstimator.Drafts.DashboardReader");
            var result = (DashboardResult)reader.GetMethod("Read").Invoke(null, new object[] {
                service.Object, Guid.NewGuid(), 126110000,
                DateTime.Parse(instant, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal)
            });
            Assert.Equal(year, result.year);
            Assert.All(queries, xml => {
                Assert.Contains("value='" + year + "-01-01T06:00:00Z'", xml);
                Assert.Contains("value='" + (year + 1) + "-01-01T06:00:00Z'", xml);
            });
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void Dashboard_is_read_only_and_uses_caller_owner_market_and_current_year(bool empty)
        {
            var user = Guid.NewGuid();
            var queries = new List<string>();
            var service = new Mock<IOrganizationService>(MockBehavior.Strict);
            service.Setup(s => s.RetrieveMultiple(It.IsAny<QueryBase>())).Returns((QueryBase q) => {
                var xml = ((FetchExpression)q).Query;
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
                Assert.Contains(conditions, c => (string)c.Attribute("attribute") == "createdon" &&
                    (string)c.Attribute("operator") == "ge" &&
                    (string)c.Attribute("value") == TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
                        TimeZoneInfo.FindSystemTimeZoneById("Central Standard Time")).Year + "-01-01T06:00:00Z");
                Assert.Contains(conditions, c => (string)c.Attribute("attribute") == "createdon" &&
                    (string)c.Attribute("operator") == "lt" &&
                    (string)c.Attribute("value") == (TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
                        TimeZoneInfo.FindSystemTimeZoneById("Central Standard Time")).Year + 1) + "-01-01T06:00:00Z");
            }
            Assert.Contains("value='unavailable'", queries[2]);
            Assert.Contains("attribute='re_sellprice' operator='gt' value='0'", queries[2]);
            Assert.Contains("attribute='re_actualcmii' operator='not-null'", queries[2]);
        }

        [Fact]
        public void Invalid_market_and_truncated_aggregates_are_errors_not_zero_counts()
        {
            var service = new Mock<IOrganizationService>(MockBehavior.Strict);
            Assert.Throws<InvalidPluginExecutionException>(() => Run(service.Object, Guid.NewGuid(),
                "{\"mode\":\"dashboard\",\"market\":7}"));
            service.Setup(s => s.RetrieveMultiple(It.IsAny<QueryBase>()))
                .Returns(new EntityCollection { MoreRecords = true });
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
