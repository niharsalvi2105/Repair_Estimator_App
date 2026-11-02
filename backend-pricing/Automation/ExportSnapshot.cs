using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using RepairEstimator.Plugins.Infrastructure;

namespace RepairEstimator.Plugins.Automation
{
    [DataContract]
    public sealed class ExportCell
    {
        [DataMember] public string key;
        [DataMember] public string text;
        [DataMember] public decimal? number;
    }

    [DataContract]
    public sealed class ExportRow
    {
        [DataMember] public string id;
        [DataMember] public List<ExportCell> cells = new List<ExportCell>();
    }

    [DataContract]
    public sealed class ExportPayload
    {
        [DataMember] public string schemaVersion = "1";
        [DataMember] public string templateVersion = "1";
        [DataMember] public string submissionId;
        [DataMember] public string revision;
        [DataMember] public string mode;
        [DataMember] public ExportRow header;
        [DataMember] public List<ExportRow> equipment;
        [DataMember] public List<ExportRow> packages;
        [DataMember] public List<ExportRow> labor;
        [DataMember] public List<ExportRow> materials;
        [DataMember] public List<ExportRow> costs;
    }

    public static class ExportSnapshot
    {
        public const int MaxBytes = 900000;
        public const int MaxRows = 1000;

        public static string Serialize<T>(T value)
        {
            using (var stream = new MemoryStream())
            {
                new DataContractJsonSerializer(typeof(T)).WriteObject(stream, value);
                return Encoding.UTF8.GetString(stream.ToArray());
            }
        }

        public static T Deserialize<T>(string json)
        {
            if (json == null || Encoding.UTF8.GetByteCount(json) > MaxBytes)
                throw new InvalidPluginExecutionException("RE-143|EXPORT_PAYLOAD_LIMIT");
            using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(json)))
                return (T)new DataContractJsonSerializer(typeof(T)).ReadObject(stream);
        }

        public static string Hash(string payload)
        {
            if (string.IsNullOrEmpty(payload) || Encoding.UTF8.GetByteCount(payload) > MaxBytes)
                throw new InvalidPluginExecutionException("RE-143|EXPORT_PAYLOAD_LIMIT");
            using (var hash = SHA256.Create())
                return string.Concat(hash.ComputeHash(Encoding.UTF8.GetBytes(payload))
                    .Select(b => b.ToString("x2", CultureInfo.InvariantCulture)));
        }

        public static ExportRow Row(Entity entity)
        {
            var row = new ExportRow { id = entity.Id.ToString("D") };
            foreach (var attribute in entity.Attributes.Where(a =>
                a.Key.StartsWith("re_", StringComparison.Ordinal) || a.Key == "transactioncurrencyid").OrderBy(a => a.Key))
            {
                var cell = new ExportCell { key = attribute.Key };
                object value = attribute.Value;
                if (value is Money money) cell.number = money.Value;
                else if (value is decimal number) cell.number = number;
                else if (value is int integer) cell.number = integer;
                else if (value is double floating)
                {
                    if (double.IsNaN(floating) || double.IsInfinity(floating))
                        throw new InvalidPluginExecutionException("RE-144|EXPORT_NUMBER_INVALID");
                    cell.number = Convert.ToDecimal(floating, CultureInfo.InvariantCulture);
                }
                else if (value is bool boolean)
                {
                    cell.number = boolean ? 1 : 0;
                    cell.text = boolean ? "Yes" : "No";
                }
                else if (value is OptionSetValue choice) cell.number = choice.Value;
                else if (value is EntityReference reference) cell.text = reference.Name ?? reference.Id.ToString("D");
                else if (value is DateTime date) cell.text =
                    (date.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(date, DateTimeKind.Utc) : date.ToUniversalTime())
                    .ToString("o", CultureInfo.InvariantCulture);
                else if (value is Guid id) cell.text = id.ToString("D");
                else if (value is string text) cell.text = text;
                else if (value != null) throw new InvalidPluginExecutionException("RE-145|EXPORT_FIELD_UNSUPPORTED");
                if (entity.FormattedValues.Contains(attribute.Key))
                    cell.text = entity.FormattedValues[attribute.Key];
                if (cell.text != null && cell.text.Length > 32700)
                    throw new InvalidPluginExecutionException("RE-143|EXPORT_PAYLOAD_LIMIT");
                // Lookup/choice labels are captured now; the workbook never queries current master data.
                row.cells.Add(cell);
            }
            return row;
        }

        public static ExportPayload Capture(IOrganizationService service, Entity header, Guid submission, string mode)
        {
            Func<string, List<ExportRow>> children = table =>
            {
                var query = new QueryExpression(table) { ColumnSet = new ColumnSet(true), TopCount = MaxRows + 1 };
                query.Criteria.AddCondition(Names.ChildParentLookup, ConditionOperator.Equal, header.Id);
                return service.RetrieveMultiple(query).Entities.OrderBy(e => e.GetAttributeValue<int>("re_sequence"))
                    .ThenBy(e => e.Id).Select(Row).ToList();
            };
            var result = new ExportPayload {
                submissionId = submission.ToString("D"), revision = header.RowVersion, mode = mode,
                header = Row(header), equipment = children(Names.EstimateEquipment.Entity),
                packages = children(Names.EstimatePackage.Entity), labor = children(Names.EstimateLaborLine.Entity),
                materials = children(Names.EstimateMaterialLine.Entity), costs = children(Names.EstimateCostLine.Entity)
            };
            if (result.equipment.Count == 0 || result.packages.Count == 0 ||
                result.equipment.Count + result.packages.Count + result.labor.Count + result.materials.Count + result.costs.Count > MaxRows ||
                string.IsNullOrEmpty(result.revision) || Encoding.UTF8.GetByteCount(Serialize(result)) > MaxBytes)
                throw new InvalidPluginExecutionException("RE-143|EXPORT_PAYLOAD_LIMIT");
            return result;
        }
    }
}
