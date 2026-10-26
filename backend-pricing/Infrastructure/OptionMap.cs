using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;

namespace RepairEstimator.Plugins.Infrastructure
{
    /// <summary>
    /// Translates between choice values and their English labels. The schema export has no option values, so
    /// reading them from metadata keeps the plug-ins correct whatever values the environment assigned.
    /// </summary>
    public static class OptionMap
    {
        private sealed class Entry
        {
            public DateTime LoadedUtc;
            public Dictionary<int, string> ByValue;
        }

        private static readonly object Gate = new object();
        private static readonly ConditionalWeakTable<IOrganizationService, Dictionary<string, Entry>> Caches =
            new ConditionalWeakTable<IOrganizationService, Dictionary<string, Entry>>();
        private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(10);
        private const int EnglishLcid = 1033;

        public static string Label(IOrganizationService service, string setName, OptionSetValue value)
        {
            if (value == null) return null;
            string label;
            if (!Load(service, setName).TryGetValue(value.Value, out label))
                throw new InvalidPluginExecutionException("RE-120|OPTION_MISSING: " + setName);
            return label;
        }

        public static OptionSetValue Value(IOrganizationService service, string setName, string label)
        {
            if (label == null) return null;
            var hit = Load(service, setName).FirstOrDefault(kv => string.Equals(kv.Value, label, StringComparison.OrdinalIgnoreCase));
            return hit.Value == null
                ? throw new InvalidPluginExecutionException("RE-120|OPTION_MISSING: " + setName + " / " + label)
                : new OptionSetValue(hit.Key);
        }

        /// <summary>First option whose label contains the text, e.g. "Custom" for "Custom Estimate".</summary>
        public static OptionSetValue ValueContaining(IOrganizationService service, string setName, string text)
        {
            var hit = Load(service, setName).FirstOrDefault(kv => kv.Value != null
                && kv.Value.IndexOf(text, StringComparison.OrdinalIgnoreCase) >= 0);
            return hit.Value == null
                ? throw new InvalidPluginExecutionException("RE-120|OPTION_MISSING: " + setName + " / " + text)
                : new OptionSetValue(hit.Key);
        }

        public static OptionSetValue Require(IOrganizationService service, string setName, string label)
        {
            return Value(service, setName, label)
                ?? throw new InvalidPluginExecutionException("RE-120|OPTION_MISSING: " + setName + " / " + label);
        }

        private static Dictionary<int, string> Load(IOrganizationService service, string setName)
        {
            var cache = Caches.GetValue(service, _ => new Dictionary<string, Entry>(StringComparer.OrdinalIgnoreCase));
            lock (Gate)
            {
                Entry entry;
                if (cache.TryGetValue(setName, out entry) && DateTime.UtcNow - entry.LoadedUtc < Ttl) return entry.ByValue;
            }

            var response = (RetrieveOptionSetResponse)service.Execute(new RetrieveOptionSetRequest { Name = setName });
            var meta = (OptionSetMetadata)response.OptionSetMetadata;
            var map = new Dictionary<int, string>();
            foreach (var option in meta.Options)
            {
                if (!option.Value.HasValue) continue;
                var english = option.Label?.LocalizedLabels?.FirstOrDefault(l => l.LanguageCode == EnglishLcid);
                map[option.Value.Value] = (english ?? option.Label?.UserLocalizedLabel)?.Label;
            }

            lock (Gate)
            {
                cache[setName] = new Entry { LoadedUtc = DateTime.UtcNow, ByValue = map };
            }
            return map;
        }
    }
}
