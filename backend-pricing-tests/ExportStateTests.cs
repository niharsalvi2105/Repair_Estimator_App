using System;
using Microsoft.Xrm.Sdk;
using RepairEstimator.Plugins.Automation;
using Xunit;

namespace RepairEstimator.Tests
{
    public class ExportStateTests
    {
        [Theory]
        [InlineData("pending", "claim", "generating")]
        [InlineData("generating", "generated", "generated")]
        [InlineData("generated", "sending", "sending")]
        [InlineData("sending", "accepted", "accepted")]
        [InlineData("accepted", "finalize", "completed")]
        [InlineData("completed", "finalize", "completed")]
        [InlineData("sending", "review", "needs-review")]
        [InlineData("generating", "fail", "failed")]
        public void Allowed_transitions(string state, string operation, string expected)
        {
            Assert.Equal(expected, ExportState.Next(state, operation));
        }

        [Theory]
        [InlineData("sending", "sending")]
        [InlineData("sending", "fail")]
        [InlineData("needs-review", "claim")]
        [InlineData("needs-review", "sending")]
        [InlineData("failed", "claim")]
        [InlineData("pending", "finalize")]
        [InlineData("completed", "sending")]
        public void Forbidden_transitions_never_resend_or_finalize_unsent_requests(string state, string operation)
        {
            Assert.Throws<InvalidPluginExecutionException>(() => ExportState.Next(state, operation));
        }

        [Theory]
        [InlineData("https://example.com/file.xlsx")]
        [InlineData("https://kone.sharepoint.com/sites/Other/Shared%20Documents/RepairEstimator/Generated/file.xlsx")]
        [InlineData("https://kone.sharepoint.com/sites/Automation_Testing62/Shared%20Documents/RepairEstimator/Generated/../Templates/file.xlsx")]
        [InlineData("https://kone.sharepoint.com/sites/Automation_Testing62/Shared%20Documents/RepairEstimator/Generated/file.xlsx?token=anything")]
        public void Only_generated_test_site_workbooks_are_accepted(string url)
        {
            Assert.Throws<InvalidPluginExecutionException>(() => ExportState.VerifyFile(url));
        }

        [Fact]
        public void Snapshot_preserves_identifiers_precision_and_hash_and_excludes_system_attributes()
        {
            var row = new Entity("re_estimateline", Guid.NewGuid());
            row["re_partnumber"] = "000123";
            row["re_unitcostprecise"] = 49.6624800000m;
            row["ownerid"] = new EntityReference("systemuser", Guid.NewGuid());
            var snapshot = ExportSnapshot.Row(row);
            var json = ExportSnapshot.Serialize(snapshot);
            Assert.DoesNotContain("ownerid", json);
            var restored = ExportSnapshot.Deserialize<ExportRow>(json);
            Assert.Equal("000123", restored.cells.Find(cell => cell.key == "re_partnumber").text);
            Assert.Equal(49.66248m, restored.cells.Find(cell => cell.key == "re_unitcostprecise").number);
            Assert.Equal(64, ExportSnapshot.Hash(json).Length);
            Assert.NotEqual(ExportSnapshot.Hash(json), ExportSnapshot.Hash(json + " "));
            Assert.Throws<InvalidPluginExecutionException>(() => ExportState.VerifyRun("run-1", "run-2"));
        }

        [Fact]
        public void Snapshot_boolean_identity_is_independent_of_language_and_dataverse_dates_are_utc()
        {
            var row = new Entity("re_estimatepackage", Guid.NewGuid());
            row["re_iscustompackage"] = true;
            row.FormattedValues["re_iscustompackage"] = "Oui";
            row["re_effectiveon"] = new DateTime(2026, 1, 1, 12, 30, 0, DateTimeKind.Unspecified);
            var snapshot = ExportSnapshot.Row(row);
            Assert.Equal(1m, snapshot.cells.Find(cell => cell.key == "re_iscustompackage").number);
            Assert.Equal("Oui", snapshot.cells.Find(cell => cell.key == "re_iscustompackage").text);
            Assert.Equal("2026-01-01T12:30:00.0000000Z", snapshot.cells.Find(cell => cell.key == "re_effectiveon").text);
            Assert.Throws<InvalidPluginExecutionException>(() => ExportSnapshot.Hash(null));
            row["re_scope"] = new string('x', 32701);
            Assert.Throws<InvalidPluginExecutionException>(() => ExportSnapshot.Row(row));
        }
    }
}
