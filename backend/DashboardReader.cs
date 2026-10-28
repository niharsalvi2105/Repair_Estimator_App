using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Runtime.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace RepairEstimator.Drafts
{
    [DataContract]
    public sealed class DashboardStatus
    {
        [DataMember] public int status;
        [DataMember] public int count;
    }

    [DataContract]
    public sealed class DashboardJobType
    {
        [DataMember] public string id;
        [DataMember] public string en;
        [DataMember] public string fr;
        [DataMember] public int count;
    }

    [DataContract]
    public sealed class DashboardResult
    {
        [DataMember] public string mode = "dashboard";
        [DataMember] public string ownerId;
        [DataMember] public int market;
        [DataMember] public string period = "all-time";
        [DataMember] public string generatedAt;
        [DataMember] public int total;
        [DataMember] public List<DashboardStatus> statuses;
        [DataMember] public List<DashboardJobType> jobTypes;
        [DataMember] public int marginCount;
        [DataMember] public decimal? averageCmii;
    }

    internal static class DashboardReader
    {
        public static DashboardResult Read(IOrganizationService service, Guid user, int market, DateTime now)
        {
            if (user == Guid.Empty || !new[] { 126110000, 126110001, 126110002 }.Contains(market))
                throw new InvalidPluginExecutionException("Invalid dashboard owner or market.");
            if (now.Kind != DateTimeKind.Utc)
                throw new InvalidPluginExecutionException("Dashboard reporting requires a UTC timestamp.");
            bool admin = IsAdmin(service, user);
            var scope = string.Format(CultureInfo.InvariantCulture,
                "<condition attribute='statecode' operator='eq' value='0' />" +
                "<condition attribute='re_market' operator='eq' value='{0}' />", market);
            if (!admin) scope += string.Format(CultureInfo.InvariantCulture,
                "<condition attribute='ownerid' operator='eq' value='{0:D}' />", user);
            var statuses = Aggregate(service, scope,
                "<attribute name='re_estimatestatus' alias='status' groupby='true' />")
                .Select(e => new DashboardStatus {
                    status = Value<OptionSetValue>(e, "status").Value,
                    count = Value<int>(e, "count")
                }).ToList();
            if (statuses.Any(s => s.status < 126110000 || s.status > 126110002))
                throw new InvalidPluginExecutionException("Dashboard encountered an unsupported estimate status.");
            var types = Aggregate(service, scope,
                "<attribute name='re_jobtype' alias='jobtype' groupby='true' />")
                .Select(e => {
                    var raw = e.GetAttributeValue<AliasedValue>("jobtype")?.Value;
                    if (raw != null && !(raw is EntityReference))
                        throw new InvalidPluginExecutionException("Invalid dashboard job type aggregate.");
                    var reference = raw as EntityReference;
                    var label = reference == null ? null : service.Retrieve("re_jobtype", reference.Id,
                        new ColumnSet("re_jobtypeen", "re_jobtypefr"));
                    if (label != null && string.IsNullOrWhiteSpace(label.GetAttributeValue<string>("re_jobtypeen")))
                        throw new InvalidPluginExecutionException("Dashboard job type is missing its English label.");
                    return new DashboardJobType {
                        id = reference?.Id.ToString("D"),
                        en = label?.GetAttributeValue<string>("re_jobtypeen"),
                        fr = label?.GetAttributeValue<string>("re_jobtypefr"),
                        count = Value<int>(e, "count")
                    };
                }).ToList();
            var margin = Aggregate(service, scope +
                "<condition attribute='re_calculationversion' operator='not-null' />" +
                "<condition attribute='re_calculationversion' operator='ne' value='unavailable' />" +
                "<condition attribute='re_calculatedon' operator='not-null' />" +
                "<condition attribute='re_sellprice' operator='gt' value='0' />" +
                "<condition attribute='re_actualcmii' operator='not-null' />",
                "<attribute name='re_actualcmii' alias='average' aggregate='avg' />");
            if (margin.Count != 1)
                throw new InvalidPluginExecutionException("Invalid dashboard margin aggregate response.");
            var count = Value<int>(margin[0], "count");
            decimal? average = count == 0 ? (decimal?)null : Value<decimal>(margin[0], "average");
            int total = statuses.Sum(s => s.count);
            if (total != types.Sum(t => t.count) || count > total)
                throw new InvalidPluginExecutionException("Dashboard records changed during calculation. Refresh the dashboard.");
            return new DashboardResult {
                ownerId = admin ? null : user.ToString("D"), market = market,
                generatedAt = now.ToString("o", CultureInfo.InvariantCulture),
                total = total, statuses = statuses, jobTypes = types, marginCount = count, averageCmii = average
            };
        }

        private static bool IsAdmin(IOrganizationService service, Guid user)
        {
            var links = new[] {
                "<link-entity name='systemuserroles' from='roleid' to='roleid'>" +
                "<filter><condition attribute='systemuserid' operator='eq' value='{0:D}' /></filter></link-entity>",
                "<link-entity name='teamroles' from='roleid' to='roleid'>" +
                "<link-entity name='teammembership' from='teamid' to='teamid'>" +
                "<filter><condition attribute='systemuserid' operator='eq' value='{0:D}' /></filter>" +
                "</link-entity></link-entity>"
            };
            foreach (var link in links)
            {
                var roles = service.RetrieveMultiple(new FetchExpression(
                    "<fetch top='1'><entity name='role'><attribute name='roleid' />" +
                    "<filter><condition attribute='name' operator='eq' value='Repair Estimator - Admin' /></filter>" +
                    string.Format(CultureInfo.InvariantCulture, link, user) + "</entity></fetch>"));
                if (roles.Entities.Count > 0) return true;
            }
            return false;
        }

        private static T Value<T>(Entity entity, string name)
        {
            var value = entity.GetAttributeValue<AliasedValue>(name)?.Value;
            if (!(value is T result))
                throw new InvalidPluginExecutionException("Invalid dashboard aggregate value: " + name);
            if (value is int count && count < 0)
                throw new InvalidPluginExecutionException("Invalid negative dashboard count.");
            return result;
        }

        private static List<Entity> Aggregate(IOrganizationService service, string scope, string attributes)
        {
            var rows = service.RetrieveMultiple(new FetchExpression(
                "<fetch aggregate='true'><entity name='re_repairestimate'>" +
                "<attribute name='re_repairestimateid' alias='count' aggregate='count' />" +
                attributes + "<filter>" + scope + "</filter></entity></fetch>"));
            if (rows.MoreRecords)
                throw new InvalidPluginExecutionException("Dashboard aggregate result is truncated. Narrow the reporting scope.");
            return rows.Entities.ToList();
        }
    }
}
