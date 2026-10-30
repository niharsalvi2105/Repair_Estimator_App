using System;
using System.Collections.Generic;
using System.Reflection;
using Microsoft.Xrm.Sdk;
using RepairEstimator.Drafts;

class Program
{
    static readonly MethodInfo Apply = typeof(DraftPlugin).GetMethod("ApplyFields", BindingFlags.Static | BindingFlags.NonPublic);
    static List<Field> Valid() => new List<Field> {
        new Field { key = "re_proposallanguage", value = "126110000" },
        new Field { key = "re_timecategory", value = "126110000" },
        new Field { key = "re_usetax", value = "5" },
        new Field { key = "re_freight", value = "14" },
    };
    static void Assert(bool value, string message) { if (!value) throw new Exception(message); }
    static void Reject(List<Field> fields)
    {
        try { Apply.Invoke(null, new object[] { new Entity(), fields, true }); }
        catch (TargetInvocationException e) when (e.InnerException is InvalidPluginExecutionException) { return; }
        throw new Exception("Invalid field input was accepted.");
    }
    static void Main()
    {
        var header = new Entity();
        Apply.Invoke(null, new object[] { header, Valid(), true });
        Assert((decimal)header["re_usetax"] == .05m && (decimal)header["re_freight"] == .14m, "Percentage conversion");
        Reject(new List<Field>());
        var fields = Valid(); fields.Add(new Field { key = "re_sellprice", value = "-1" }); Reject(fields);
        fields = Valid(); fields.Add(new Field { key = "re_estimatestatus", value = "126110002" }); Reject(fields);
        fields = Valid(); fields.Add(new Field { key = "re_numberoftechs", value = "4" }); Reject(fields);
        fields = Valid(); fields.Add(new Field { key = "re_usetax", value = "10" }); Reject(fields);
        fields = Valid(); fields[2].value = "101"; Reject(fields);
        fields = Valid(); fields.Add(new Field { key = "re_billingplan", value = "126110003" });
        Apply.Invoke(null, new object[] { new Entity(), fields, true });
        fields = Valid(); fields.Add(new Field { key = "re_competingbids", value = "126110003" });
        Apply.Invoke(null, new object[] { new Entity(), fields, true });
        Console.WriteLine("9 backend field validation cases passed.");
        DraftServiceTests.RunAll();
    }
}
