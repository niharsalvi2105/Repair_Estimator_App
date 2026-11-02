using System;
using Microsoft.Xrm.Sdk;

namespace RepairEstimator.Plugins.Automation
{
    public static class ExportState
    {
        public const string Pending = "pending";
        public const string Generating = "generating";
        public const string Generated = "generated";
        public const string Sending = "sending";
        public const string Accepted = "accepted";
        public const string Completed = "completed";
        public const string Failed = "failed";
        public const string Review = "needs-review";

        public static string Next(string state, string operation)
        {
            switch (operation)
            {
                case "claim":
                    if (state == Pending || state == Generating) return Generating;
                    break;
                case "generated":
                    if (state == Generating || state == Generated) return Generated;
                    break;
                case "sending":
                    if (state == Generated) return Sending;
                    break;
                case "accepted":
                    if (state == Sending || state == Accepted) return Accepted;
                    break;
                case "finalize":
                    if (state == Accepted || state == Completed) return Completed;
                    break;
                case "fail":
                    if (state == Pending || state == Generating || state == Generated || state == Failed) return Failed;
                    break;
                case "review":
                    if (state == Sending || state == Review) return Review;
                    break;
            }
            throw new InvalidPluginExecutionException("RE-140|EXPORT_TRANSITION_INVALID");
        }

        public static void VerifyRun(string savedRun, string requestedRun)
        {
            if (string.IsNullOrWhiteSpace(requestedRun) || requestedRun.Length > 100 ||
                !System.Text.RegularExpressions.Regex.IsMatch(requestedRun, "^[A-Za-z0-9_-]+$") ||
                (!string.IsNullOrEmpty(savedRun) && !string.Equals(savedRun, requestedRun, StringComparison.Ordinal)))
                throw new InvalidPluginExecutionException("RE-141|EXPORT_CLAIM_CONFLICT");
        }

        public static void VerifyFile(string url)
        {
            Uri value;
            if (!Uri.TryCreate(url, UriKind.Absolute, out value) || value.Scheme != Uri.UriSchemeHttps ||
                !string.Equals(value.Host, "kone.sharepoint.com", StringComparison.OrdinalIgnoreCase) ||
                !value.AbsolutePath.StartsWith("/sites/Automation_Testing62/Shared%20Documents/RepairEstimator/Generated/",
                    StringComparison.Ordinal) || !value.AbsolutePath.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase) ||
                !string.IsNullOrEmpty(value.UserInfo) || !string.IsNullOrEmpty(value.Query) || !string.IsNullOrEmpty(value.Fragment))
                throw new InvalidPluginExecutionException("RE-142|EXPORT_FILE_INVALID");
        }
    }
}
