"""Register the synchronous draft API using the active Azure CLI user, without reading tokens."""
import base64
import json
from pathlib import Path
import subprocess
import tempfile
import os

CLI = r"C:\Program Files\Microsoft SDKs\Azure\CLI2\python.exe"
BASE = "https://org79f23007.api.crm.dynamics.com/api/data/v9.2/"
SOLUTION = "RepairEstimatorApp"


def request(method, path, body=None):
    args = [CLI, "-IBm", "azure.cli", "rest", "--method", method,
            "--resource", "https://org79f23007.crm.dynamics.com",
            "--url", BASE + path, "--output", "json",
            "--headers", "MSCRM.SolutionUniqueName=" + SOLUTION]
    filename = None
    try:
        if body is not None:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as file:
                json.dump(body, file)
                filename = file.name
            args += ["--body", "@" + filename]
        result = subprocess.run(args, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stderr)
        return json.loads(result.stdout) if result.stdout.strip() else None
    finally:
        if filename:
            os.unlink(filename)


def upsert(entity, key, filter_text, body):
    rows = request("get", entity + "?$select=" + key + "&$top=3&$filter=" + filter_text)["value"]
    if len(rows) > 1:
        raise RuntimeError("Ambiguous registration: " + entity)
    if rows:
        record_id = rows[0][key]
        request("patch", entity + "(" + record_id + ")", body)
    else:
        request("post", entity, body)
        rows = request("get", entity + "?$select=" + key + "&$top=3&$filter=" + filter_text)["value"]
        if len(rows) != 1:
            raise RuntimeError("Registration could not be verified: " + entity)
        record_id = rows[0][key]
    return record_id


if __name__ == "__main__":
    dll = Path(__file__).parent / "bin" / "Release" / "net462" / "RepairEstimator.Drafts.dll"
    assembly = upsert("pluginassemblies", "pluginassemblyid", "name eq 'RepairEstimator.Drafts'", {
        "name": "RepairEstimator.Drafts", "isolationmode": 2, "sourcetype": 0,
        "content": base64.b64encode(dll.read_bytes()).decode("ascii"),
    })
    plugin = upsert("plugintypes", "plugintypeid", "typename eq 'RepairEstimator.Drafts.DraftPlugin'", {
        "typename": "RepairEstimator.Drafts.DraftPlugin",
        "name": "RepairEstimator.Drafts.DraftPlugin",
        "friendlyname": "Repair Estimator transactional draft operations",
        "pluginassemblyid@odata.bind": "/pluginassemblies(" + assembly + ")",
    })
    api = upsert("customapis", "customapiid", "uniquename eq 're_DraftEstimate'", {
        "uniquename": "re_DraftEstimate", "name": "Repair Estimator Draft",
        "displayname": "Repair Estimator Draft", "bindingtype": 0,
        "isfunction": False, "isprivate": False, "allowedcustomprocessingsteptype": 0,
        "plugintypeid@odata.bind": "/plugintypes(" + plugin + ")",
    })
    for entity, key, name in [
        ("customapirequestparameters", "customapirequestparameterid", "InputJson"),
        ("customapiresponseproperties", "customapiresponsepropertyid", "ResultJson"),
    ]:
        upsert(entity, key, "uniquename eq '" + name + "' and _customapiid_value eq " + api, {
            "uniquename": name, "name": name, "displayname": name, "type": 10,
            "customapiid@odata.bind": "/customapis(" + api + ")",
        })
    print("Registered re_DraftEstimate in " + SOLUTION + "; assembly " + assembly)
