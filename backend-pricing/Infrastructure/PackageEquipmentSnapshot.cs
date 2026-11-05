using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using Microsoft.Xrm.Sdk;

namespace RepairEstimator.Shared
{
    internal static class PackageEquipmentSnapshot
    {
        public const string Attribute = "re_equipmentnumbers";
        public const int MaxLength = 32700;

        public static string Write(List<string> numbers)
        {
            if (numbers == null) return null;
            using (var stream = new MemoryStream())
            {
                new DataContractJsonSerializer(typeof(List<string>)).WriteObject(stream, numbers);
                var json = Encoding.UTF8.GetString(stream.ToArray());
                if (json.Length > MaxLength)
                    throw new InvalidPluginExecutionException("RE-142|PACKAGE_EQUIPMENT_LIMIT");
                return json;
            }
        }

        public static void Validate(IList<string> numbers, IEnumerable<string> equipment)
        {
            if (numbers == null) return;
            var available = new HashSet<string>(equipment, StringComparer.Ordinal);
            if (numbers.Count == 0 || numbers.Any(string.IsNullOrWhiteSpace) ||
                numbers.Distinct(StringComparer.Ordinal).Count() != numbers.Count || numbers.Any(n => !available.Contains(n)))
                throw new InvalidPluginExecutionException("RE-142|PACKAGE_EQUIPMENT_INVALID");
        }

        public static List<string> Read(Entity row, IEnumerable<string> equipment)
        {
            var json = row.GetAttributeValue<string>(Attribute);
            if (json == null) return null;
            if (json.Length > MaxLength) throw new InvalidPluginExecutionException("RE-142|PACKAGE_EQUIPMENT_LIMIT");
            List<string> numbers;
            try
            {
                using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(json)))
                    numbers = (List<string>)new DataContractJsonSerializer(typeof(List<string>)).ReadObject(stream);
            }
            catch (SerializationException)
            {
                throw new InvalidPluginExecutionException("RE-142|PACKAGE_EQUIPMENT_INVALID");
            }
            if (numbers == null) throw new InvalidPluginExecutionException("RE-142|PACKAGE_EQUIPMENT_INVALID");
            Validate(numbers, equipment);
            if (row.GetAttributeValue<int?>("re_quantity") != numbers.Count)
                throw new InvalidPluginExecutionException("RE-142|PACKAGE_EQUIPMENT_QUANTITY_MISMATCH");
            return numbers;
        }
    }
}
