"""Bounded, non-destructive Account/Contact import. Dry run is the default."""
import argparse
import collections
import decimal
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
import posixpath

BASE = "https://org79f23007.api.crm.dynamics.com/api/data/v9.2/"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
SPECS = {
    "accounts": {
        "file": "AME SFDC Account Master.xlsx", "sheet": "Sheet2",
        "entity": "account", "set": "accounts", "id": "accountid",
        "key": "re_salesforceaccountid",
        "fields": {
            "Id": "re_salesforceaccountid", "AccountNumber": "accountnumber",
            "Name": "name", "BillingStreet": "address1_line1",
            "BillingCity": "address1_city", "BillingState": "address1_stateorprovince",
            "BillingPostalCode": "address1_postalcode", "BillingCountry": "address1_country",
            "Sales_Organizations__c": "re_salesorganizations", "Kone_Country__c": "re_konecountry",
            "Owner.Sales_Office__c": "re_ownersalesoffice",
            "Owner.Branch_Office__c": "re_ownerbranchoffice",
            "Active_KONE_Customer__c": "re_activekonecustomer",
            "Industry_Segment__c": "re_industrysegment", "Customer_Type__c": "re_customertype",
            "Customer_Group__c": "re_customergroup", "Customer_Language__c": "re_customerlanguage",
            "Owner.Name": "re_ownername", "Owner.Title": "re_ownertitle",
            "AmountofEquipments__c": "re_equipmentcount", "Number_of_LIO__c": "re_liocount",
            "Data_Quality_Description__c": "re_dataqualitydescription",
            "Data_Quality_Score__c": "re_dataqualityscore",
            "Main_Business_Type__c": "re_mainbusinesstype", "Top_Parent_Account__c": "re_topparentaccount",
        },
        "booleans": {"Active_KONE_Customer__c"},
        "numbers": {"AmountofEquipments__c": "Integer", "Number_of_LIO__c": "Integer", "Data_Quality_Score__c": "Decimal"},
        "organization_header": "Sales_Organizations__c",
        "extras": [],
        "raw_fields": ["_", "Owner"],
        "raw_metadata_field": "re_sourceexportmetadata",
    },
    "contacts": {
        "file": "Account Contacts with Non-Null Email v1Nov2026.xlsx", "sheet": "Data",
        "entity": "contact", "set": "contacts", "id": "contactid",
        "key": "re_salesforcecontactid",
        "fields": {
            "Id": "re_salesforcecontactid", "Name": "re_salesforcename",
            "Email": "emailaddress1", "Phone": "telephone1", "MobilePhone": "mobilephone",
            "HomePhone": "telephone2", "AssistantName": "assistantname",
            "AssistantPhone": "assistantphone", "Title": "jobtitle",
            "Primary_Contact__c": "re_primarycontact", "Active__c": "re_sourceactive",
            "Linked_to_Active_KONE_customer__c": "re_linkedtoactivekonecustomer",
            "HasOptedOutOfEmail": "donotemail",
            "Account.Sales_Organizations__c": "re_sourcesalesorganization",
            "Account.AccountNumber": "re_sourceaccountnumber",
        },
        "booleans": {"Primary_Contact__c", "Active__c", "Linked_to_Active_KONE_customer__c", "HasOptedOutOfEmail"},
        "extras": ["Account.Id"],
        "numbers": {},
        "organization_header": "Account.Sales_Organizations__c",
        "raw_fields": ["_", "Account"],
        "raw_metadata_field": "re_sourceexportmetadata",
    },
}


class Rejected(ValueError):
    pass


def column_index(reference):
    letters = re.match(r"[A-Z]+", reference)
    if letters is None:
        raise Rejected("invalid_cell_reference")
    result = 0
    for char in letters[0]:
        result = result * 26 + ord(char) - 64
    return result - 1


def source_rows(path, sheet_name):
    """Stream cells and retain shared strings in a disposable local database."""
    descriptor, db_path = tempfile.mkstemp(prefix="repair-master-", suffix=".sqlite")
    os.close(descriptor)
    db = sqlite3.connect(db_path)
    try:
        db.execute("CREATE TABLE shared(id INTEGER PRIMARY KEY, value TEXT)")
        with zipfile.ZipFile(path) as workbook:
            if "xl/sharedStrings.xml" in workbook.namelist():
                with workbook.open("xl/sharedStrings.xml") as source:
                    root = None
                    index = 0
                    for event, elem in ET.iterparse(source, events=("start", "end")):
                        if root is None:
                            root = elem
                        if event == "end" and elem.tag == NS + "si":
                            db.execute("INSERT INTO shared VALUES (?,?)",
                                       (index, "".join(t.text or "" for t in elem.iter(NS + "t"))))
                            index += 1
                            root.clear()
                db.commit()
            relationships = ET.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))
            targets = {entry.get("Id"): entry.get("Target") for entry in relationships}
            metadata = ET.fromstring(workbook.read("xl/workbook.xml"))
            sheet = next((entry for entry in metadata.find(NS + "sheets")
                          if entry.get("name") == sheet_name), None)
            if sheet is None:
                raise Rejected("missing_source_sheet")
            relationship_id = sheet.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            target = targets[relationship_id]
            member = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join("xl", target))
            with workbook.open(member) as source:
                sheet_data = None
                for event, elem in ET.iterparse(source, events=("start", "end")):
                    if event == "start" and elem.tag == NS + "sheetData":
                        sheet_data = elem
                    if event != "end" or elem.tag != NS + "row":
                        continue
                    cells = {}
                    for cell in elem.findall(NS + "c"):
                        index = column_index(cell.get("r", ""))
                        typ = cell.get("t", "n")
                        cached = cell.find(NS + "v")
                        value = cached.text if cached is not None else None
                        if cell.find(NS + "f") is not None and value is None:
                            typ = "uncached_formula"
                        elif typ == "s" and value is not None:
                            found = db.execute("SELECT value FROM shared WHERE id=?", (int(value),)).fetchone()
                            if found is None:
                                raise Rejected("invalid_shared_string_reference")
                            typ, value = "text", found[0]
                        elif typ == "inlineStr":
                            typ, value = "text", "".join(t.text or "" for t in cell.iter(NS + "t"))
                        elif typ == "str":
                            typ = "text"
                        cells[index] = (typ, value)
                    yield int(elem.get("r", "0")), cells
                    sheet_data.remove(elem)
    finally:
        db.close()
        Path(db_path).unlink()


def text(cell):
    typ, value = cell
    if typ in ("e", "uncached_formula"):
        raise Rejected("source_error_or_uncached_formula")
    if value in ("", None):
        return None
    if typ == "n" and not re.fullmatch(r"[0-9]+", value):
        raise Rejected("ambiguous_numeric_text_representation")
    if typ not in ("text", "n"):
        raise Rejected("unsupported_text_storage_type")
    return value


def boolean(cell):
    typ, value = cell
    if value in ("", None) and typ not in ("e", "uncached_formula"):
        return None
    if typ in ("e", "uncached_formula"):
        raise Rejected("invalid_boolean_cell")
    if value.lower() in ("true", "1", "yes", "y"):
        return True
    if value.lower() in ("false", "0", "no", "n"):
        return False
    raise Rejected("invalid_boolean_representation")


def source_id(cell):
    value = text(cell)
    if cell[0] != "text" or value is None or re.fullmatch(r"[A-Za-z0-9]{18}", value) is None:
        raise Rejected("invalid_source_id")
    return value


def number(cell, constraints):
    typ, value = cell
    if typ in ("e", "uncached_formula") or typ not in ("text", "n"):
        raise Rejected("invalid_numeric_cell")
    if value in ("", None):
        return None
    try:
        amount = decimal.Decimal(value)
    except decimal.InvalidOperation:
        raise Rejected("invalid_numeric_representation") from None
    if not amount.is_finite() or not constraints["min"] <= amount <= constraints["max"]:
        raise Rejected("numeric_out_of_range")
    if constraints["type"] == "Integer":
        if amount != amount.to_integral_value():
            raise Rejected("fractional_integer_value")
        return int(amount)
    if amount.normalize().as_tuple().exponent < -constraints["precision"]:
        raise Rejected("numeric_precision_exceeded")
    result = float(amount)
    if decimal.Decimal(str(result)) != amount:
        raise Rejected("numeric_serialization_precision_loss")
    return result


def build_payload(spec, row, lengths):
    source_id(row["Id"])
    result = {}
    for source, destination in spec["fields"].items():
        if source in spec["numbers"]:
            value = number(row[source], lengths[destination])
        else:
            value = boolean(row[source]) if source in spec["booleans"] else text(row[source])
        if isinstance(value, str) and len(value.encode("utf-16-le")) // 2 > lengths[destination]:
            raise Rejected("field_length_exceeded:" + destination)
        result[destination] = value
    if spec["entity"] == "account":
        if not result["name"] or not result["accountnumber"]:
            raise Rejected("missing_account_name_or_number")
    else:
        name = result["re_salesforcename"]
        if not name:
            raise Rejected("missing_contact_name")
        if len(name.encode("utf-16-le")) // 2 > lengths["lastname"]:
            raise Rejected("field_length_exceeded:lastname")
        source_id(row["Account.Id"])
        result.update(lastname=name, firstname=None)
    raw_metadata = {name: text(row[name]) for name in spec["raw_fields"]}
    serialized_metadata = json.dumps(raw_metadata, ensure_ascii=False, separators=(",", ":"))
    if len(serialized_metadata.encode("utf-16-le")) // 2 > lengths[spec["raw_metadata_field"]]:
        raise Rejected("field_length_exceeded:" + spec["raw_metadata_field"])
    result[spec["raw_metadata_field"]] = serialized_metadata
    return result


class Api:
    def __init__(self):
        command = [r"C:\Program Files\Microsoft SDKs\Azure\CLI2\python.exe", "-IBm", "azure.cli",
                   "account", "get-access-token", "--resource", BASE.split("/api/")[0],
                   "--query", "accessToken", "-o", "tsv"]
        auth = subprocess.run(command, capture_output=True, text=True, timeout=120)
        if auth.returncode or not auth.stdout.strip():
            raise RuntimeError("Dataverse authentication failed")
        self.headers = {"Authorization": "Bearer " + auth.stdout.strip(), "Accept": "application/json",
                        "MSCRM.SolutionUniqueName": "RepairEstimatorApp", "Content-Type": "application/json"}

    def request(self, method, endpoint, payload=None, concurrency=None):
        headers = dict(self.headers)
        if concurrency:
            headers.update(concurrency)
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        for attempt in range(6):
            request = urllib.request.Request(BASE + endpoint, data=body, headers=headers, method=method)
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    value = response.read()
                    return json.loads(value) if value else {}
            except urllib.error.HTTPError as error:
                status = error.code
                retry_after = error.headers.get("Retry-After", "")
                error_code = None
                try:
                    error_code = json.loads(error.read()).get("error", {}).get("code")
                except (json.JSONDecodeError, UnicodeDecodeError):
                    error_code = None
                error.close()
                if status in (429, 502, 503, 504) and attempt < 5:
                    time.sleep(min(120, int(retry_after) if retry_after.isdigit() else 2 ** attempt))
                    continue
                safe_code = error_code if isinstance(error_code, str) and re.fullmatch(r"[A-Za-z0-9_]+", error_code) else "unavailable"
                raise RuntimeError("Dataverse HTTP " + str(status) + "; code " + safe_code + "; method " + method) from None
            except urllib.error.URLError:
                raise RuntimeError("Dataverse transport failure; stop and reconcile this row before resuming") from None

    def find(self, entity_set, fields, field, value):
        query = urllib.parse.urlencode({"$select": ",".join(fields), "$filter": field + " eq '" + value.replace("'", "''") + "'", "$top": "2"})
        response = self.request("GET", entity_set + "?" + query)
        if "@odata.nextLink" in response:
            raise Rejected("ambiguous_existing_records")
        return response["value"]


def preflight(api, spec):
    solutions = api.find("solutions", ["solutionid"], "uniquename", "RepairEstimatorApp")
    if len(solutions) != 1 or solutions[0]["solutionid"] != "05dd7469-373e-46ad-acd4-856e50ac3777":
        raise RuntimeError("Unexpected target solution")
    entity = "EntityDefinitions(LogicalName='" + spec["entity"] + "')"
    keys = api.request("GET", entity + "/Keys?$select=KeyAttributes,EntityKeyIndexStatus")["value"]
    if not any(key["KeyAttributes"] == [spec["key"]] and key["EntityKeyIndexStatus"] == "Active" for key in keys):
        raise RuntimeError("Required source key is not active")
    attributes = api.request("GET", entity + "/Attributes?$select=LogicalName,AttributeType,IsValidForCreate,IsValidForUpdate")["value"]
    by_name = {attribute["LogicalName"]: attribute for attribute in attributes}
    strings = api.request("GET", entity + "/Attributes/Microsoft.Dynamics.CRM.StringAttributeMetadata?$select=LogicalName,MaxLength")["value"]
    lengths = {attribute["LogicalName"]: attribute["MaxLength"] for attribute in strings}
    destinations = list(spec["fields"].values()) + [spec["raw_metadata_field"]] + (
        ["firstname", "lastname"] if spec["entity"] == "contact" else [])
    numeric_types = {spec["fields"][source]: typ for source, typ in spec["numbers"].items()}
    for destination in destinations:
        attribute = by_name.get(destination)
        expected = numeric_types.get(destination, "Boolean" if destination in [spec["fields"][source] for source in spec["booleans"]] else "String")
        if attribute is None or attribute["AttributeType"] != expected or not attribute["IsValidForCreate"] or not attribute["IsValidForUpdate"]:
            raise RuntimeError("Incompatible writable metadata: " + destination)
        if expected == "String" and destination not in lengths:
            raise RuntimeError("Missing length metadata: " + destination)
        if destination in numeric_types:
            select = "MinValue,MaxValue" + (",Precision" if expected == "Decimal" else "")
            numeric = api.request("GET", entity + "/Attributes(LogicalName='" + destination +
                                  "')/Microsoft.Dynamics.CRM." + expected + "AttributeMetadata?$select=" + select)
            lengths[destination] = {"type": expected, "min": decimal.Decimal(str(numeric["MinValue"])),
                                    "max": decimal.Decimal(str(numeric["MaxValue"])), "precision": numeric.get("Precision", 0)}
    return lengths


def reconcile(api, spec, row, payload, apply):
    selected = list(payload) + [spec["id"]]
    existing = api.find(spec["set"], selected, spec["key"], payload[spec["key"]])
    if len(existing) > 1:
        raise Rejected("duplicate_source_key")
    if spec["entity"] == "account":
        collisions = api.find("accounts", ["accountid", spec["key"]], "accountnumber", payload["accountnumber"])
        if any(record.get(spec["key"]) != payload[spec["key"]] for record in collisions):
            raise Rejected("native_account_number_collision")
    else:
        parents = api.find("accounts", ["accountid"], "re_salesforceaccountid", source_id(row["Account.Id"]))
        if len(parents) != 1:
            raise Rejected("missing_or_ambiguous_imported_parent")
        payload["parentcustomerid_account@odata.bind"] = "/accounts(" + parents[0]["accountid"] + ")"
        if payload.get("emailaddress1"):
            collisions = api.find("contacts", ["contactid", spec["key"]], "emailaddress1", payload["emailaddress1"])
            if any(not record.get(spec["key"]) for record in collisions):
                raise Rejected("native_contact_email_collision")
        if existing:
            parent = api.request("GET", "contacts(" + existing[0]["contactid"] + ")?$select=_parentcustomerid_value")
            existing[0]["parentcustomerid_account@odata.bind"] = (
                "/accounts(" + parent["_parentcustomerid_value"] + ")" if parent.get("_parentcustomerid_value") else None)
    if existing and all(existing[0].get(field) == value for field, value in payload.items()):
        return "unchanged"
    outcome = "update" if existing else "create"
    if not apply:
        return "would_" + outcome
    if existing:
        etag = existing[0].get("@odata.etag")
        if not etag:
            raise RuntimeError("Missing concurrency token")
        endpoint = spec["set"] + "(" + existing[0][spec["id"]] + ")"
        api.request("PATCH", endpoint, payload, {"If-Match": etag})
    else:
        api.request("POST", spec["set"], payload)
    verified = api.find(spec["set"], selected, spec["key"], payload[spec["key"]])
    comparable = {key: value for key, value in payload.items() if not key.endswith("@odata.bind")}
    if len(verified) != 1 or any(verified[0].get(field) != value for field, value in comparable.items()):
        raise RuntimeError("Post-write verification failed")
    if spec["entity"] == "contact":
        parent = api.request("GET", "contacts(" + verified[0]["contactid"] + ")?$select=_parentcustomerid_value")
        if "/accounts(" + str(parent.get("_parentcustomerid_value")) + ")" != payload["parentcustomerid_account@odata.bind"]:
            raise RuntimeError("Post-write parent relationship verification failed")
    return "created" if outcome == "create" else "updated"


def validate_source_headers(headers, spec, report):
    if len(headers) != len(set(headers)):
        raise RuntimeError("Duplicate source headers")
    names = list(spec["fields"]) + spec["extras"] + spec["raw_fields"]
    missing = [name for name in names if name not in headers]
    if missing:
        raise RuntimeError("Required source headers missing: " + json.dumps(missing))
    report["mapped_source_headers"] = names
    report["unmapped_source_headers"] = [name for name in headers if name not in names]
    if report["unmapped_source_headers"]:
        raise RuntimeError("Unmapped source headers: " +
                           json.dumps(report["unmapped_source_headers"], ensure_ascii=False))
    return names


def run(args, api):
    spec = SPECS[args.dataset]
    rules = json.loads((Path(__file__).parent / "master-import-rules.json").read_text(encoding="utf-8"))
    allowed_organizations = rules["sourceOrganizationToMarket"]["accounts"]
    lengths = preflight(api, spec)
    path = args.source_dir / spec["file"]
    before = path.stat()
    after_row = 1
    if args.resume_report:
        previous = json.loads(args.resume_report.read_text(encoding="utf-8"))
        if (previous["dataset"], previous["mode"], previous["source_size"], previous["source_mtime_ns"]) != (
                args.dataset, "apply" if args.apply else "dry_run", before.st_size, before.st_mtime_ns):
            raise RuntimeError("Resume report does not match dataset, mode or unchanged source file")
        after_row = previous["last_processed_row"]
    report = {"dataset": args.dataset, "mode": "apply" if args.apply else "dry_run",
              "status": "in_progress", "source_size": before.st_size, "source_mtime_ns": before.st_mtime_ns,
              "counts": collections.Counter(), "resolved_market_counts": collections.Counter(),
              "rejected_rows": [], "last_processed_row": after_row}
    rows = source_rows(path, spec["sheet"])
    try:
        header_number, cells = next(rows)
        if header_number != 1:
            raise RuntimeError("Missing source header")
        headers = [cell[1] for _, cell in sorted(cells.items())]
        positions = {cell[1]: i for i, cell in cells.items()}
        names = validate_source_headers(headers, spec, report)
        seen_ids = set()
        for row_number, cells in rows:
            if row_number <= after_row:
                continue
            report["current_row"] = row_number
            row = {name: cells.get(positions[name], ("text", None)) for name in names}
            try:
                payload = build_payload(spec, row, lengths)
                organization = text(row[spec["organization_header"]])
                if organization not in allowed_organizations:
                    raise Rejected("unmapped_source_organization")
                key = payload[spec["key"]]
                if key in seen_ids:
                    raise Rejected("duplicate_source_id_in_batch")
                seen_ids.add(key)
                outcome = reconcile(api, spec, row, payload, args.apply)
                report["counts"][outcome] += 1
                report["resolved_market_counts"][allowed_organizations[organization]] += 1
            except Rejected as error:
                report["counts"]["rejected"] += 1
                report["rejected_rows"].append({"row": row_number, "reason": str(error)})
            report["counts"]["processed"] += 1
            report["last_processed_row"] = row_number
            if report["counts"]["processed"] >= args.limit:
                break
        after = path.stat()
        if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise RuntimeError("Source changed during run; reconcile applied rows before resuming")
        report["status"] = "completed_with_rejections" if report["counts"]["rejected"] else "complete"
    except (RuntimeError, OSError, ValueError, ET.ParseError, zipfile.BadZipFile):
        report["status"] = "failed"
        raise
    finally:
        rows.close()
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))
    return 2 if report["counts"]["rejected"] else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--dataset", choices=SPECS, required=True)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--resume-report", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000:
        parser.error("limit must be 1..1000")
    if args.report.exists():
        parser.error("report already exists; choose a fresh path")
    return run(args, Api())


if __name__ == "__main__":
    raise SystemExit(main())
