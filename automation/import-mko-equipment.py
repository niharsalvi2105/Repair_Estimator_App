"""MKO-only Equipment creation using explicitly approved exact Branch/location mappings."""
import argparse
from contextlib import closing
from decimal import Decimal, ROUND_HALF_UP
import importlib.util
import json
from pathlib import Path
import sqlite3
import uuid

SPEC = importlib.util.spec_from_file_location(
    "equipment", Path(__file__).with_name("import-equipment-master.py"))
equipment = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(equipment)
apply = equipment.apply
bulk = apply.bulk


def build_payload(raw_cells, mapping, attributes):
    if "Sales_Organization__c" in raw_cells:
        original = {c["position"] - 1: tuple(raw_cells[c["header"]]) for c in mapping["columns"]}
    else:
        original = {int(key): tuple(value) for key, value in raw_cells.items()}
    adjusted = dict(original)
    headers = [c["header"] for c in sorted(mapping["columns"], key=lambda c: c["position"])]
    for column in mapping["columns"]:
        if column["field"] not in ("re_latitude", "re_longitude"):
            continue
        index = column["position"] - 1
        kind, value = original.get(index, ("text", None))
        if value in (None, "") or kind in ("e", "uncached_formula"):
            continue
        number = Decimal(str(value))
        if not number.is_finite():
            raise bulk.customer.Rejected("invalid_coordinate")
        attribute = attributes[column["field"]]
        if not Decimal(str(attribute["MinValue"])) <= number <= Decimal(str(attribute["MaxValue"])):
            raise bulk.customer.Rejected("coordinate_out_of_range")
        # Only coordinates have an approved rounding policy; other typed values stay exact.
        adjusted[index] = (kind, format(number.quantize(Decimal(".00000001"), rounding=ROUND_HALF_UP), "f"))
    key, parent, payload = equipment.payload_for_row(headers, adjusted, mapping, attributes)
    payload[equipment.RAW_FIELD] = bulk.encode({
        header: {"storage": original.get(index, ("text", None))[0],
                 "value": original.get(index, ("text", None))[1]}
        for index, header in enumerate(headers)})
    if len(payload[equipment.RAW_FIELD].encode("utf-16-le")) // 2 > equipment.RAW_LIMIT:
        raise bulk.customer.Rejected("raw_metadata_length_exceeded")
    location_index = headers.index("Location.Functional_Location_SAP_Number__c")
    location_cell = original.get(location_index, ("text", None))
    if location_cell[0] in ("e", "uncached_formula"):
        raise bulk.customer.Rejected("invalid_location")
    location = bulk.customer.text(location_cell) if location_cell[1] not in ("", None) else ""
    return key, parent, payload, location


def branch_index(branches):
    result = {}
    for branch in branches:
        if branch["re_market"] != 126110000 or branch["statecode"] != 0:
            continue
        number = branch.get("re_branchnumber")
        if not number:
            continue
        if number in result:
            raise RuntimeError("Ambiguous active MKO Branch number")
        result[number] = branch["re_branchid"]
    return result


def normalized(record, payload, attributes):
    result = dict(record)
    equipment.normalize_dates(result, payload, attributes)
    return result


def matches(payload, record, branch, parent, attributes):
    if record is None:
        return False
    result = normalized(record, payload, attributes)
    return all(key in result and result[key] == value for key, value in payload.items()) and (
        result.get("_re_branch_value") == branch and result.get("_re_customeraccount_value") == parent)


def fetch(api, keys):
    records = {}
    for offset in range(0, len(keys), 100):
        condition = " or ".join("re_equipment eq '" + key.replace("'", "''") + "'"
                                for key in keys[offset:offset + 100])
        for row in api.query("re_equipments", ["*"], condition):
            key = row["re_equipment"].casefold()
            if key in records:
                raise RuntimeError("Duplicate native Equipment key")
            records[key] = row
    return records


def report(db, path, status):
    states = dict(db.execute("SELECT status,count(*) FROM work GROUP BY status"))
    value = {"status": status, "dataset": "MKO Equipment", "source_rows": sum(states.values()),
             "states": states, "reasons": dict(db.execute(
                 "SELECT reason,count(*) FROM work WHERE reason IS NOT NULL GROUP BY reason")),
             "mapping": "Exact MKOF Plant_Section to unique active MKO Branch number; exact source SAP location",
             "coordinate_policy": "ROUND_HALF_UP to eight decimals; originals in raw-source Memo",
             "parent_policy": "Exact verified Account Salesforce ID only", "estimate_writes": False}
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)
    print(json.dumps(value), flush=True)


def prepare(db, source_db, mapping, attributes, branches, args):
    db.executescript(
        "CREATE TABLE IF NOT EXISTS meta(name TEXT PRIMARY KEY,value TEXT);"
        "CREATE TABLE IF NOT EXISTS work(row_number INTEGER PRIMARY KEY,source_key TEXT COLLATE NOCASE,"
        "parent TEXT COLLATE NOCASE,branch TEXT,location TEXT,status TEXT,native_id TEXT,reason TEXT);"
        "CREATE INDEX IF NOT EXISTS work_status ON work(status,row_number);"
        "CREATE INDEX IF NOT EXISTS work_key ON work(source_key);")
    source_meta = dict(source_db.execute("SELECT name,value FROM metadata"))
    expected = {"contract": bulk.fingerprint(Path(__file__)), "source": source_meta["source"],
                "mapping": bulk.fingerprint(args.mapping), "branches": bulk.encode(branches),
                "attributes": bulk.encode(equipment.writable_contract(attributes))}
    old = dict(db.execute("SELECT name,value FROM meta"))
    if old:
        if old.get("prepared") != "1" or any(old.get(k) != v for k, v in expected.items()):
            raise RuntimeError("MKO Equipment contract/source/branch/schema changed; preserve state")
        return
    if source_meta.get("schema_deployed") != "true":
        raise RuntimeError("Existing Equipment source schema is not deployed")
    db.executemany("INSERT INTO meta VALUES (?,?)", list(expected.items()))
    for row in source_db.execute("SELECT row_number,raw_cells FROM equipment"):
        cells = json.loads(row["raw_cells"])
        if cells.get("Sales_Organization__c", ("", None))[1] != "MKOF":
            continue
        try:
            key, parent, payload, location = build_payload(cells, mapping, attributes)
            plant = payload["re_plantsection"]
            branch = branches.get(plant)
            if not parent:
                status, reason = "deferred", "missing_source_parent"
            elif not branch:
                status, reason = "deferred", "no_exact_mko_branch"
            elif not location:
                status, reason = "deferred", "missing_source_location"
            elif len(location.encode("utf-16-le")) // 2 > attributes["re_functionallocation"]["MaxLength"]:
                status, reason = "rejected", "location_length_exceeded"
            else:
                status, reason = "pending", None
            db.execute("INSERT INTO work VALUES (?,?,?,?,?,?,NULL,?)",
                       (row["row_number"], key, parent, branch, location, status, reason))
        except bulk.customer.Rejected as error:
            db.execute("INSERT INTO work VALUES (?,NULL,NULL,NULL,NULL,'rejected',NULL,?)",
                       (row["row_number"], str(error)))
    db.execute("UPDATE work SET status='rejected',reason='duplicate_source_equipment_key' "
               "WHERE source_key IN (SELECT source_key FROM work WHERE source_key IS NOT NULL "
               "GROUP BY source_key HAVING count(*)>1)")
    if db.execute("SELECT count(*) FROM work").fetchone()[0] == 0:
        raise RuntimeError("No MKO source Equipment found; preparation is not complete")
    db.execute("INSERT INTO meta VALUES ('prepared','1')")
    db.commit()


def run(args):
    root = Path(__file__).resolve().parents[1]
    if args.state.resolve().is_relative_to(root) or args.report.resolve().is_relative_to(root):
        raise RuntimeError("Private state/report must be outside repository")
    paths = [p.resolve() for p in (args.state, args.report, args.source_state, args.customer_state, args.mapping)]
    if len(set(paths)) != len(paths):
        raise RuntimeError("All input/output paths must differ")
    lock = args.state.with_suffix(args.state.suffix + ".lock")
    with lock.open("x") as handle:
        handle.write("MKO Equipment exclusive writer\n")
    try:
        api = apply.CreateUpdateApi()
        solution = api.find("solutions", ["solutionid"], "uniquename", "RepairEstimatorApp")
        if len(solution) != 1 or solution[0]["solutionid"] != "05dd7469-373e-46ad-acd4-856e50ac3777":
            raise RuntimeError("Unexpected Dev solution")
        attributes = equipment.constraints(api)
        if any(attributes[field]["Precision"] != 8 for field in ("re_latitude", "re_longitude")):
            raise RuntimeError("Coordinate schema no longer has approved eight-decimal precision")
        branches = branch_index(list(api.query("re_branchs",
            ["re_branchid", "re_branchnumber", "re_market", "statecode"])))
        mapping = json.loads(args.mapping.read_text())
        with closing(sqlite3.connect(args.source_state.as_uri() + "?mode=ro", uri=True)) as source, \
                closing(sqlite3.connect(args.state, uri=True)) as db:
            source.row_factory = db.row_factory = sqlite3.Row
            prepare(db, source, mapping, attributes, branches, args)
            report(db, args.report, "prepared_not_imported")
            if not args.apply:
                return
            relations = api.request("GET", "EntityDefinitions(LogicalName='re_equipment')/"
                "ManyToOneRelationships?$select=ReferencingAttribute,ReferencingEntityNavigationPropertyName")["value"]
            navigation = {r["ReferencingAttribute"]: r["ReferencingEntityNavigationPropertyName"] for r in relations}
            for key in ("re_branch", "re_customeraccount"):
                if key not in navigation:
                    raise RuntimeError("Missing Equipment relationship metadata")
            db.execute("ATTACH DATABASE ? AS customers", (args.customer_state.as_uri() + "?mode=ro",))
            # Reconcile uncertain records by exact readback before allowing another create.
            for row in db.execute("SELECT * FROM work WHERE status='inflight'").fetchall():
                raw = source.execute("SELECT raw_cells FROM equipment WHERE row_number=?", (row["row_number"],)).fetchone()
                _, _, payload, _ = build_payload(json.loads(raw[0]), mapping, attributes)
                payload["re_functionallocation"] = row["location"]
                parent = db.execute("SELECT native_id FROM customers.source WHERE dataset='accounts' "
                    "AND source_id=? AND status='verified'", (row["parent"],)).fetchone()
                if parent is None:
                    raise RuntimeError("Uncertain Equipment parent no longer verified")
                found = fetch(api, [row["source_key"]]).get(row["source_key"].casefold())
                if found is None:
                    db.execute("UPDATE work SET status='pending' WHERE row_number=?", (row["row_number"],))
                elif matches(payload, found, row["branch"], parent[0], attributes):
                    db.execute("UPDATE work SET status='verified',native_id=? WHERE row_number=?",
                               (found["re_equipmentid"], row["row_number"]))
                else:
                    raise RuntimeError("Uncertain Equipment differs; no overwrite")
            db.commit()
            batches = 0
            while args.max_batches == 0 or batches < args.max_batches:
                rows = db.execute("SELECT w.*,a.native_id AS account_id FROM work w JOIN customers.source a "
                    "ON a.dataset='accounts' AND a.source_id=w.parent AND a.status='verified' "
                    "WHERE w.status='pending' ORDER BY w.row_number LIMIT 250").fetchall()
                if not rows:
                    break
                existing = fetch(api, [r["source_key"] for r in rows])
                expected, creates = [], []
                for row in rows:
                    raw = source.execute("SELECT raw_cells FROM equipment WHERE row_number=?", (row["row_number"],)).fetchone()
                    _, _, payload, _ = build_payload(json.loads(raw[0]), mapping, attributes)
                    payload["re_functionallocation"] = row["location"]
                    previous = existing.get(row["source_key"].casefold())
                    if previous is not None:
                        if not matches(payload, previous, row["branch"], row["account_id"], attributes):
                            db.execute("UPDATE work SET status='conflict',native_id=?,"
                                "reason='existing_source_or_context_mismatch' WHERE row_number=?",
                                (previous["re_equipmentid"], row["row_number"]))
                            continue
                        identity = previous["re_equipmentid"]
                    else:
                        identity = str(uuid.uuid5(uuid.NAMESPACE_URL, "RepairEstimator:Equipment:" + row["source_key"]))
                        target = dict(payload, re_equipmentid=identity,
                            **{"@odata.type": "Microsoft.Dynamics.CRM.re_equipment",
                               navigation["re_branch"] + "@odata.bind": "/re_branchs(" + row["branch"] + ")",
                               navigation["re_customeraccount"] + "@odata.bind": "/accounts(" + row["account_id"] + ")"})
                        creates.append(target)
                    expected.append((row, payload, identity))
                    db.execute("UPDATE work SET status='inflight',native_id=? WHERE row_number=?",
                               (identity, row["row_number"]))
                db.commit()
                if creates:
                    api.send({"set": "re_equipments"}, "CreateMultiple", creates)
                found = fetch(api, [r["source_key"] for r, _, _ in expected]) if expected else {}
                for row, payload, identity in expected:
                    current = found.get(row["source_key"].casefold())
                    if not matches(payload, current, row["branch"], row["account_id"], attributes) or current["re_equipmentid"] != identity:
                        raise RuntimeError("Equipment full-field/relationship/native-ID readback failed")
                db.executemany("UPDATE work SET status='verified' WHERE row_number=?",
                               [(r["row_number"],) for r, _, _ in expected])
                db.commit()
                batches += 1
                report(db, args.report, "importing_verified_parent_equipment")
            remaining = db.execute("SELECT count(*) FROM work WHERE status='pending'").fetchone()[0]
            unresolved = db.execute("SELECT count(*) FROM work WHERE status IN ('deferred','conflict','rejected')").fetchone()[0]
            report(db, args.report, "paused_or_waiting_for_verified_parents" if remaining else
                   "mapped_rows_verified_unresolved_sources_remain" if unresolved else "completed_all_source_rows")
    finally:
        lock.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("source-state", "customer-state", "mapping", "state", "report"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--max-batches", type=int, default=0)
    args = parser.parse_args()
    if args.max_batches < 0:
        parser.error("max-batches must be nonnegative")
    for name in ("source_state", "customer_state", "mapping", "state", "report"):
        setattr(args, name, getattr(args, name).resolve())
    run(args)


if __name__ == "__main__":
    main()
