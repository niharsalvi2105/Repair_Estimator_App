"""Private Equipment staging and exact, non-destructive existing-record updates."""
import argparse
from contextlib import closing
import datetime
import importlib.util
import json
from pathlib import Path
import sqlite3


MODULE = importlib.util.spec_from_file_location(
    "equipment_apply", Path(__file__).with_name("apply-customer-masters.py"))
apply = importlib.util.module_from_spec(MODULE)
MODULE.loader.exec_module(apply)
bulk = apply.bulk
customer = bulk.customer
RAW_FIELD = "re_sourceexportmetadata"
RAW_LIMIT = 100000
KOL_LIMIT = 100
ENTITY = "re_equipment"
ENTITY_SET = "re_equipments"
ID = "re_equipmentid"
KEY = "re_equipment"


def constraints(api):
    endpoint = "EntityDefinitions(LogicalName='re_equipment')"
    metadata = api.request(
        "GET", endpoint + "/Attributes?$select=LogicalName,AttributeType,IsValidForCreate,IsValidForUpdate")
    result = {value["LogicalName"]: value for value in metadata["value"]}
    for kind, fields in (
            ("String", "MaxLength"), ("Memo", "MaxLength"),
            ("Integer", "MinValue,MaxValue"), ("Decimal", "MinValue,MaxValue,Precision"),
            ("Double", "MinValue,MaxValue,Precision"), ("DateTime", "DateTimeBehavior,Format")):
        values = api.request("GET", endpoint + "/Attributes/Microsoft.Dynamics.CRM." +
                             kind + "AttributeMetadata?$select=LogicalName," + fields)
        for value in values["value"]:
            result[value["LogicalName"]].update(value)
    keys = api.request("GET", endpoint + "/Keys?$select=KeyAttributes,EntityKeyIndexStatus")["value"]
    if sum(value["KeyAttributes"] == [KEY] and value["EntityKeyIndexStatus"] == "Active"
           for value in keys) != 1:
        raise RuntimeError("Required unique Equipment key is not active")
    result.setdefault("re_koltype", {
        "LogicalName": "re_koltype", "AttributeType": "String", "MaxLength": KOL_LIMIT,
        "IsValidForCreate": True, "IsValidForUpdate": True, "planned": True})
    return result


def writable_contract(attributes):
    keys = ("LogicalName", "AttributeType", "IsValidForCreate", "IsValidForUpdate",
            "MaxLength", "MinValue", "MaxValue", "Precision", "DateTimeBehavior", "Format")
    return {name: {key: value[key] for key in keys if key in value}
            for name, value in attributes.items() if name.startswith("re_") and name != RAW_FIELD}


def scalar(cell, attribute):
    kind = attribute["AttributeType"]
    if cell[0] in ("e", "uncached_formula"):
        raise customer.Rejected("source_error_or_uncached_formula")
    if cell[1] in (None, ""):
        return None
    if kind in ("String", "Memo"):
        value = customer.text(cell)
        if len(value.encode("utf-16-le")) // 2 > attribute["MaxLength"]:
            raise customer.Rejected("field_length_exceeded:" + attribute["LogicalName"])
        return value
    if kind == "Boolean":
        return customer.boolean(cell)
    if kind in ("Integer", "Decimal", "Double"):
        return customer.number(cell, {
            "type": kind, "min": attribute["MinValue"], "max": attribute["MaxValue"],
            "precision": attribute.get("Precision", 0)})
    if kind == "DateTime":
        if attribute.get("DateTimeBehavior", {}).get("Value") != "DateOnly":
            raise customer.Rejected("date_timezone_contract_required:" + attribute["LogicalName"])
        value = customer.text(cell)
        try:
            parsed = datetime.date.fromisoformat(value)
        except (TypeError, ValueError):
            raise customer.Rejected("date_representation_requires_correction:" +
                                    attribute["LogicalName"]) from None
        return parsed.isoformat()
    raise RuntimeError("Unsupported mapped Equipment attribute type: " + kind)


def payload_for_row(headers, cells, mapping, attributes):
    raw = {}
    for index, header in enumerate(headers):
        cell = cells.get(index, ("text", None))
        if cell[0] in ("e", "uncached_formula"):
            raise customer.Rejected("source_error_or_uncached_formula")
        raw[header] = {"storage": cell[0], "value": cell[1]}
    serialized = bulk.encode(raw)
    if len(serialized.encode("utf-16-le")) // 2 > RAW_LIMIT:
        raise customer.Rejected("raw_metadata_length_exceeded")
    payload = {RAW_FIELD: serialized}
    for column in mapping["columns"]:
        if column["table"] != ENTITY or column["field"] == "re_customeraccount":
            continue
        field = column["field"]
        if not field:
            continue
        attribute = attributes.get(field)
        if not attribute or not attribute["IsValidForCreate"] or not attribute["IsValidForUpdate"]:
            raise RuntimeError("Missing writable Equipment destination: " + field)
        payload[field] = scalar(cells.get(column["position"] - 1, ("text", None)), attribute)
    key = payload.get(KEY)
    if not key or key != key.strip():
        raise customer.Rejected("missing_or_whitespace_equipment_key")
    parent = customer.source_id(cells[headers.index("Account.Id")]) if raw["Account.Id"]["value"] else None
    return key, parent, payload


def save_report(db, path, status):
    states = dict(db.execute("SELECT status,COUNT(*) FROM equipment GROUP BY status"))
    reasons = dict(db.execute(
        "SELECT reason,COUNT(*) FROM equipment WHERE status='rejected' GROUP BY reason"))
    report = {"status": status, "source_rows": sum(states.values()), "candidate_states": states,
              "rejection_reasons": reasons,
              "rejected_rows": [{"row": row, "reason": reason} for row, reason in db.execute(
                  "SELECT row_number,reason FROM equipment WHERE status='rejected' ORDER BY row_number")],
              "writes_scope": "existing Equipment rows only; creation and missing mappings remain deferred",
              "raw_preservation": "All 60 source columns and XML cell storage/value retained privately",
              "schema_deployed": json.loads(db.execute(
                  "SELECT value FROM metadata WHERE name='schema_deployed'").fetchone()[0])}
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    print(bulk.encode({"status": status, "source_rows": report["source_rows"],
                       "candidate_states": states, "rejection_reasons": reasons}), flush=True)


def prepare(db, args, api):
    contract = (bulk.fingerprint(Path(__file__)) + bulk.fingerprint(Path(apply.__file__)) +
                bulk.fingerprint(Path(bulk.__file__)) + bulk.fingerprint(Path(customer.__file__)))
    files = {"source": bulk.fingerprint(args.source), "mapping": bulk.fingerprint(args.mapping),
             "contract": contract}
    if db.execute("SELECT 1 FROM sqlite_master WHERE name='metadata'").fetchone():
        previous = dict(db.execute("SELECT name,value FROM metadata"))
        if not previous.get("prepared"):
            raise RuntimeError("Incomplete Equipment preparation; preserve evidence and use fresh state")
        for name, value in files.items():
            if previous.get(name) != value:
                raise RuntimeError("Equipment source or contract changed; refuse resume")
        if json.loads(previous["writable_contract"]) != writable_contract(constraints(api)):
            raise RuntimeError("Equipment writable metadata changed; refuse resume")
        return
    mapping = json.loads(args.mapping.read_text(encoding="utf-8"))
    if mapping["source"] != args.source.name or mapping["columns_accounted"] != 60:
        raise RuntimeError("Unexpected Equipment mapping contract")
    attributes = constraints(api)
    db.executescript(
        "CREATE TABLE metadata(name TEXT PRIMARY KEY,value TEXT);"
        "CREATE TABLE equipment(row_number INTEGER PRIMARY KEY,source_key TEXT COLLATE NOCASE,"
        "parent TEXT,raw_cells TEXT NOT NULL,payload TEXT,status TEXT NOT NULL,reason TEXT,native_id TEXT);"
        "CREATE INDEX equipment_key ON equipment(source_key);"
        "CREATE INDEX equipment_status ON equipment(status,row_number);")
    db.executemany("INSERT INTO metadata VALUES (?,?)", files.items())
    db.execute("INSERT INTO metadata VALUES ('schema_deployed','false')")
    db.execute("INSERT INTO metadata VALUES ('writable_contract',?)",
               (bulk.encode(writable_contract(attributes)),))
    rows = bulk.stream_rows(args.source, "Equipment Master")
    row_number, cells = next(rows)
    headers = [cells[index][1] for index in range(60)]
    if row_number != 1 or len(cells) != 60 or headers != [c["header"] for c in mapping["columns"]]:
        raise RuntimeError("Equipment headers changed")
    total = 0
    for row_number, cells in rows:
        if any(index >= 60 for index in cells):
            raise RuntimeError("Unexpected extra source column")
        raw = bulk.encode({headers[index]: cells.get(index, ("text", None)) for index in range(60)})
        key = parent = payload = reason = None
        try:
            key, parent, payload = payload_for_row(headers, cells, mapping, attributes)
            status = "pending"
        except customer.Rejected as error:
            reason, status = str(error), "rejected"
            key_cell = cells.get(headers.index("Name"), ("text", None))
            if key_cell[0] in ("text", "n") and key_cell[1]:
                key = key_cell[1]
        db.execute("INSERT INTO equipment VALUES (?,?,?,?,?,?,?,NULL)", (
            row_number, key, parent, raw, bulk.encode(payload) if payload else None, status, reason))
        total += 1
        if total % 10000 == 0:
            db.commit()
            print(bulk.encode({"staged_equipment_rows": total}), flush=True)
    if total != mapping["worksheet_rows_excluding_header"] or total != 428400:
        raise RuntimeError("Equipment source count does not match approved extract")
    db.execute(
        "UPDATE equipment SET status='rejected',reason='duplicate_source_equipment_key' "
        "WHERE source_key IN (SELECT source_key FROM equipment WHERE source_key IS NOT NULL "
        "GROUP BY source_key HAVING COUNT(*)>1)")
    db.execute("INSERT INTO metadata VALUES ('prepared','true')")
    db.commit()


def deploy_schema(db, api):
    endpoint = "EntityDefinitions(LogicalName='re_equipment')/Attributes"
    for field, kind, limit, label in (
            (RAW_FIELD, "Memo", RAW_LIMIT, "Equipment Source Export Metadata"),
            ("re_koltype", "String", KOL_LIMIT, "KOL Type")):
        metadata = api.request("GET", endpoint + "?$select=LogicalName,AttributeType")["value"]
        found = [value for value in metadata if value["LogicalName"] == field]
        if found:
            detail = api.request("GET", endpoint + "(LogicalName='" + field + "')/"
                                 "Microsoft.Dynamics.CRM." + kind + "AttributeMetadata?$select=MaxLength")
            if len(found) != 1 or found[0]["AttributeType"] != kind or detail["MaxLength"] < limit:
                raise RuntimeError("Incompatible Equipment import schema")
        else:
            api.request("POST", endpoint, {
                "@odata.type": "Microsoft.Dynamics.CRM." + kind + "AttributeMetadata",
                "SchemaName": field, "MaxLength": limit,
                "DisplayName": {"LocalizedLabels": [{"Label": label, "LanguageCode": 1033}]},
                "RequiredLevel": {"Value": "None"}})
    api.request("POST", "PublishXml", {
        "ParameterXml": "<importexportxml><entities><entity>re_equipment</entity>"
                        "</entities></importexportxml>"})
    current = constraints(api)
    raw = current.get(RAW_FIELD)
    kol = current["re_koltype"]
    if (not raw or raw["AttributeType"] != "Memo" or raw["MaxLength"] < RAW_LIMIT or
            kol.get("planned") or kol["MaxLength"] < KOL_LIMIT):
        raise RuntimeError("Equipment schema read-back failed")
    db.execute("UPDATE metadata SET value='true' WHERE name='schema_deployed'")
    db.commit()


def existing_batch(api, rows, fields):
    keys = [row["source_key"] for row in rows]
    found = {}
    for offset in range(0, len(keys), 25):
        expression = " or ".join(KEY + " eq '" + key.replace("'", "''") + "'"
                                 for key in keys[offset:offset + 25])
        for record in api.query(ENTITY_SET, fields, expression):
            key = record[KEY].casefold()
            if key in found:
                raise RuntimeError("Duplicate destination Equipment identity")
            found[key] = record
    return found


def normalize_dates(record, payload, attributes):
    for field in payload:
        if attributes.get(field, {}).get("AttributeType") == "DateTime" and record.get(field):
            value = record[field]
            if isinstance(value, str) and len(value) == 20 and value.endswith("T00:00:00Z"):
                record[field] = value[:10]


def apply_existing(db, args, api):
    deployed = db.execute("SELECT value FROM metadata WHERE name='schema_deployed'").fetchone()[0]
    if deployed != "true":
        raise RuntimeError("Equipment import schema must be deployed and verified first")
    rows = db.execute(
        "SELECT * FROM equipment WHERE status IN ('pending','inflight') ORDER BY row_number LIMIT ?",
        (args.batch_size,)).fetchall()
    if not rows:
        return
    payloads = [json.loads(row["payload"]) for row in rows]
    fields = sorted(set().union(*(payload.keys() for payload in payloads)) |
                    {ID, KEY, "_re_customeraccount_value", "_re_branch_value", "re_functionallocation"})
    found = existing_batch(api, rows, fields)
    attributes = constraints(api)
    writes = []
    updates = []
    with closing(sqlite3.connect(
            "file:" + str(args.customer_state.resolve()) + "?mode=ro", uri=True)) as parents:
        for row, payload in zip(rows, payloads):
            record = found.get(row["source_key"].casefold())
            if record is None:
                db.execute("UPDATE equipment SET status='deferred_create',reason='branch_mapping_required' "
                           "WHERE row_number=?", (row["row_number"],))
                continue
            normalize_dates(record, payload, attributes)
            if not record.get("_re_branch_value") or not record.get("re_functionallocation"):
                db.execute("UPDATE equipment SET status='deferred_context',reason='existing_required_context_missing' "
                           "WHERE row_number=?", (row["row_number"],))
                continue
            parent_id = None
            if row["parent"]:
                parent = parents.execute(
                    "SELECT status,native_id FROM source WHERE dataset='accounts' AND source_id=?",
                    (row["parent"],)).fetchone()
                if parent and parent[0] == "verified" and parent[1]:
                    parent_id = parent[1]
                    if record.get("_re_customeraccount_value") not in (None, parent_id):
                        raise RuntimeError("Existing Equipment Account relationship conflicts with source")
                else:
                    db.execute("UPDATE equipment SET status='deferred_parent',reason='account_not_yet_verified' "
                               "WHERE row_number=?", (row["row_number"],))
                    continue
            elif record.get("_re_customeraccount_value"):
                raise RuntimeError("Missing source parent conflicts with existing Equipment relationship")
            if not bulk.matches(payload, record) or (
                    parent_id and bulk.normalized(record.get("_re_customeraccount_value")) !=
                    bulk.normalized(parent_id)):
                target = dict(payload, **{ID: record[ID],
                                          "@odata.type": "Microsoft.Dynamics.CRM.re_equipment"})
                if parent_id:
                    target["re_customeraccount@odata.bind"] = "/accounts(" + parent_id + ")"
                writes.append(target)
            updates.append((row, payload, parent_id, record))
            db.execute("UPDATE equipment SET status='inflight' WHERE row_number=?", (row["row_number"],))
    db.commit()
    if writes:
        api.send({"set": ENTITY_SET}, "UpdateMultiple", writes)
    if updates:
        verified = existing_batch(api, [value[0] for value in updates], fields)
        for row, payload, parent_id, prior in updates:
            record = verified.get(row["source_key"].casefold())
            if record:
                normalize_dates(record, payload, attributes)
            if not bulk.matches(payload, record) or record[ID] != prior[ID]:
                raise RuntimeError("Equipment exact field or native-ID verification failed")
            if (record.get("_re_branch_value") != prior["_re_branch_value"] or
                    record.get("re_functionallocation") != prior["re_functionallocation"]):
                raise RuntimeError("Existing Equipment branch/location unexpectedly changed")
            if parent_id and bulk.normalized(record.get("_re_customeraccount_value")) != bulk.normalized(parent_id):
                raise RuntimeError("Equipment Account relationship verification failed")
        db.executemany("UPDATE equipment SET status='verified',native_id=? WHERE row_number=?",
                       [(prior[ID], row["row_number"]) for row, _, _, prior in updates])
    db.commit()
    print(bulk.encode({"equipment_rows_verified": len(updates), "rows_written": len(writes)}), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--mapping", type=Path, required=True)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--deploy-schema", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--customer-state", type=Path)
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    paths = [args.source, args.mapping, args.state, args.report]
    if len({path.resolve() for path in paths}) != len(paths):
        parser.error("Source, mapping, state and report must be distinct")
    if args.state.resolve().is_relative_to(repo) or args.report.resolve().is_relative_to(repo):
        parser.error("Private Equipment state and report must be outside the repository")
    if args.apply and (not args.customer_state or not args.customer_state.is_file()):
        parser.error("Apply requires existing private customer staging")
    if not 1 <= args.batch_size <= 100:
        parser.error("batch-size must be 1..100")
    args.state.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    lock = args.state.with_suffix(args.state.suffix + ".lock")
    with lock.open("x", encoding="utf-8") as handle:
        handle.write("Exclusive Equipment import; confirm no process exists before removing a stale lock.\n")
    try:
        api = apply.CreateUpdateApi()
        with closing(sqlite3.connect(args.state)) as db:
            db.row_factory = sqlite3.Row
            prepare(db, args, api)
            try:
                if args.deploy_schema:
                    deploy_schema(db, api)
                if args.apply:
                    apply_existing(db, args, api)
                save_report(db, args.report, "verified_existing_batch" if args.apply else "prepared_not_imported")
            except (RuntimeError, OSError, ValueError, sqlite3.Error):
                db.commit()
                save_report(db, args.report, "failed_or_unverified")
                raise
    finally:
        lock.unlink()


if __name__ == "__main__":
    main()
