"""Exact-source MKOM part import with approved six-decimal rounding and raw provenance."""
import argparse
import datetime
from decimal import Decimal, ROUND_HALF_UP
import importlib.util
import json
from pathlib import Path
import sqlite3
import uuid

MODULE = importlib.util.spec_from_file_location(
    "customer_apply", Path(__file__).with_name("apply-customer-masters.py"))
apply = importlib.util.module_from_spec(MODULE)
MODULE.loader.exec_module(apply)
bulk = apply.bulk

HEADERS = [
    "Condition Type", "Sales Organization", "Distribution Channel", "Material",
    "Material Description", "Valid From", "Valid to", "Price (USD)", "Condition currency",
    "Pricing unit", "Unit of measure", "Cost (USD)", "Condition currency",
    "Condition record no.", "Price (CAD)", "Condition currency", "Cost (CAD)", "Condition currency"]
RAW = "re_sourceexportmetadata"
NUMBERS = {"re_usdcost", "re_usdprice", "re_pricingunit"}
DATES = {"re_effectivefrom", "re_effectiveto", "re_refreshedon"}


def source_text(cells, index, limit):
    kind, value = cells.get(index, ("text", None))
    if kind in ("e", "uncached_formula") or not isinstance(value, str) or not value.strip():
        raise ValueError("invalid_text_column:" + str(index + 1))
    if len(value.encode("utf-16-le")) // 2 > limit:
        raise ValueError("text_length_column:" + str(index + 1))
    return value


def source_amount(cells, index, rounded=False):
    kind, value = cells.get(index, ("text", None))
    if kind in ("e", "uncached_formula") or value in (None, ""):
        raise ValueError("source_error_column:" + str(index + 1))
    try:
        number = Decimal(str(value))
    except ArithmeticError:
        raise ValueError("invalid_number_column:" + str(index + 1)) from None
    if not number.is_finite() or not 0 <= number <= 1000000000:
        raise ValueError("number_range_column:" + str(index + 1))
    return number.quantize(Decimal(".000001"), rounding=ROUND_HALF_UP) if rounded else number


def source_date(cells, index):
    kind, value = cells.get(index, ("text", None))
    if kind != "n":
        raise ValueError("date_storage_column:" + str(index + 1))
    number = Decimal(str(value))
    if not number.is_finite() or number != number.to_integral_value() or not 61 <= number <= 2958465:
        raise ValueError("invalid_date_column:" + str(index + 1))
    return (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(number))).isoformat()


def map_part(cells, row, filename, digest, refreshed):
    if any(cells.get(i, ("", None))[0] in ("e", "uncached_formula") for i in range(18)):
        raise ValueError("source_error_or_uncached_formula")
    if [source_text(cells, i, 50) for i in (0, 1, 2)] != ["ZR00", "MKOM", "01"]:
        raise ValueError("unapproved_source_context")
    if [source_text(cells, i, 3) for i in (8, 12, 15, 17)] != ["USD", "USD", "CAD", "CAD"]:
        raise ValueError("source_currency_mismatch")
    part = source_text(cells, 3, 100)
    if ":" in part:
        raise ValueError("ambiguous_source_key_separator")
    description = source_text(cells, 4, 2000)
    start, end = source_date(cells, 5), source_date(cells, 6)
    if start > end:
        raise ValueError("reversed_dates")
    price, cost, unit = (source_amount(cells, i, True) for i in (7, 11, 9))
    if unit <= 0 or unit != source_amount(cells, 9):
        raise ValueError("pricing_unit_precision_or_range")
    # CAD values are preserved verbatim, not fed into the USD-based server conversion.
    for index in (14, 16):
        source_amount(cells, index)
    raw = json.dumps({
        "workbook": filename, "sha256": digest, "sheet": "Material", "row": row,
        "moneyPolicy": "USD ROUND_HALF_UP to six decimals; original USD/CAD values retained",
        "columns": [{"position": i + 1, "header": HEADERS[i],
                     "storage": cells.get(i, ("text", None))[0],
                     "value": cells.get(i, ("text", None))[1]} for i in range(18)]
    }, ensure_ascii=True, separators=(",", ":"))
    if len(raw) > 100000:
        raise ValueError("raw_metadata_length")
    return {
        "re_sourcekey": "Material:ZR00:MKOM:01:" + part, "re_partnumber": part, "re_name": part,
        "re_descriptionen": description, "re_parttype": 126110000,
        "re_usdcost": float(cost), "re_usdprice": float(price), "re_pricingunit": float(unit),
        "re_sourcecurrency": "USD", "re_uom": source_text(cells, 10, 20),
        "re_salesorganization": "MKOM", "re_distributionchannel": "01",
        "re_conditionrecord": source_text(cells, 13, 100), "re_sourceversion": filename,
        "re_effectivefrom": start, "re_effectiveto": end, "re_refreshedon": refreshed,
        RAW: raw, "statecode": 0 if cost > 0 and price > 0 and unit == 1 else 1,
    }


def differences(expected, actual, ignore=()):
    result = []
    for key, value in expected.items():
        if key in ignore:
            continue
        present = actual.get(key)
        if key in NUMBERS:
            equal = present is not None and Decimal(str(present)) == Decimal(str(value))
        elif key in DATES:
            equal = isinstance(present, str) and present[:10] == value[:10]
        else:
            equal = present == value
        if not equal:
            result.append(key)
    return result


def raw_schema(api, deploy):
    endpoint = "EntityDefinitions(LogicalName='re_sparepart')/Attributes"
    attrs = api.request("GET", endpoint + "?$select=LogicalName,AttributeType,IsValidForCreate,IsValidForUpdate")["value"]
    found = [a for a in attrs if a["LogicalName"] == RAW]
    if not found and deploy:
        api.request("POST", endpoint, {
            "@odata.type": "Microsoft.Dynamics.CRM.MemoAttributeMetadata", "SchemaName": RAW,
            "DisplayName": {"LocalizedLabels": [{"Label": "Source export metadata", "LanguageCode": 1033}]},
            "RequiredLevel": {"Value": "None"}, "MaxLength": 100000, "Format": "TextArea"})
        api.request("POST", "PublishXml", {"ParameterXml":
                    "<importexportxml><entities><entity>re_sparepart</entity></entities></importexportxml>"})
        return raw_schema(api, False)
    if not found:
        raise RuntimeError("Missing raw-source Memo; use explicitly approved --deploy-source-column")
    if len(found) != 1 or found[0]["AttributeType"] != "Memo" or not all(
            found[0][key] for key in ("IsValidForCreate", "IsValidForUpdate")):
        raise RuntimeError("Incompatible raw-source column")
    meta = api.request("GET", endpoint + "(LogicalName='" + RAW +
                       "')/Microsoft.Dynamics.CRM.MemoAttributeMetadata?$select=MaxLength")
    if meta["MaxLength"] < 100000:
        raise RuntimeError("Insufficient raw-source capacity")
    keys = api.request("GET", "EntityDefinitions(LogicalName='re_sparepart')/Keys")["value"]
    if sum(k["KeyAttributes"] == ["re_sourcekey"] and k["EntityKeyIndexStatus"] == "Active" for k in keys) != 1:
        raise RuntimeError("Required active part source key missing")
    for name in NUMBERS:
        meta = api.request("GET", endpoint + "(LogicalName='" + name +
                           "')/Microsoft.Dynamics.CRM.DecimalAttributeMetadata?$select=Precision,MinValue,MaxValue")
        if meta["Precision"] < 6 or meta["MaxValue"] < 1000000000 or meta["MinValue"] > (0 if name != "re_pricingunit" else .000001):
            raise RuntimeError("Part numeric schema changed")


def prepare(db, source):
    digest, contract = bulk.fingerprint(source), bulk.fingerprint(Path(__file__))
    db.executescript(
        "CREATE TABLE IF NOT EXISTS meta(name TEXT PRIMARY KEY,value TEXT);"
        "CREATE TABLE IF NOT EXISTS parts(row_number INTEGER PRIMARY KEY,source_key TEXT UNIQUE COLLATE NOCASE,"
        "payload TEXT,status TEXT,native_id TEXT,reason TEXT);")
    previous = dict(db.execute("SELECT name,value FROM meta"))
    if previous:
        if previous.get("source") != digest or previous.get("contract") != contract or previous.get("prepared") != "1":
            raise RuntimeError("Source/contract changed or preparation incomplete; preserve state")
        return
    refreshed = datetime.datetime.now(datetime.timezone.utc).isoformat()
    db.executemany("INSERT INTO meta VALUES (?,?)",
                   [("source", digest), ("contract", contract), ("refreshed", refreshed)])
    for row, cells in bulk.customer.source_rows(source, "Material"):
        if row == 1:
            if [cells.get(i, ("", None))[1] for i in range(18)] != HEADERS:
                raise RuntimeError("Refined Material positional headers changed")
            continue
        if not any(c[1] not in ("", None) for c in cells.values()):
            continue
        try:
            payload = map_part(cells, row, source.name, digest, refreshed)
        except ValueError as error:
            db.execute("INSERT INTO parts VALUES (?,NULL,NULL,'rejected',NULL,?)", (row, str(error)))
            continue
        db.execute("INSERT INTO parts VALUES (?,?,?,'pending',NULL,NULL)",
                   (row, payload["re_sourcekey"], json.dumps(payload)))
    if bulk.fingerprint(source) != digest:
        raise RuntimeError("Workbook changed during preparation")
    db.execute("INSERT INTO meta VALUES ('prepared','1')")
    db.commit()


def report(db, path, status):
    counts = dict(db.execute("SELECT status,count(*) FROM parts GROUP BY status"))
    value = {"status": status, "dataset": "MKOM refined parts", "states": counts,
             "source_rows": sum(counts.values()), "rejection_reasons": dict(db.execute(
                 "SELECT reason,count(*) FROM parts WHERE status='rejected' GROUP BY reason")),
             "rounding": "USD six-decimal ROUND_HALF_UP; original 18 positional source columns retained",
             "availability": "Positive per-unit KONE cost/price only; original effectivity retained",
             "estimate_writes": False}
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    print(json.dumps(value), flush=True)


def verify_batch(api, rows):
    result = {}
    for offset in range(0, len(rows), 40):
        ids = [row["native_id"] for row in rows[offset:offset + 40]]
        for record in api.query("re_spareparts", ["*"], " or ".join("re_sparepartid eq " + value for value in ids)):
            result[record["re_sparepartid"]] = record
    return result


def run(args):
    if args.state.resolve().is_relative_to(Path(__file__).resolve().parents[1]):
        raise RuntimeError("Private state must be outside repository")
    if args.state.resolve() in (args.report.resolve(), args.source.resolve()) or args.report.resolve() == args.source.resolve():
        raise RuntimeError("State/report/source paths must differ")
    lock = args.state.with_suffix(args.state.suffix + ".lock")
    with lock.open("x") as handle:
        handle.write("MKO part importer; exclusive lock\n")
    try:
        with sqlite3.connect(args.state) as db:
            db.row_factory = sqlite3.Row
            prepare(db, args.source)
            report(db, args.report, "prepared_not_imported")
            if not args.apply:
                return
            api = apply.CreateUpdateApi()
            solution = api.find("solutions", ["solutionid"], "uniquename", "RepairEstimatorApp")
            if len(solution) != 1 or solution[0]["solutionid"] != "05dd7469-373e-46ad-acd4-856e50ac3777":
                raise RuntimeError("Unexpected Dev solution")
            raw_schema(api, args.deploy_source_column)
            existing = {}
            for record in api.query("re_spareparts", ["*"]):
                key = (record.get("re_sourcekey") or "").casefold()
                if key in existing:
                    raise RuntimeError("Duplicate or missing existing part source identity")
                existing[key] = record
            for row in db.execute("SELECT * FROM parts WHERE status IN ('pending','inflight')").fetchall():
                expected = json.loads(row["payload"])
                current = existing.get(row["source_key"].casefold())
                if current:
                    changes = differences(expected, current, ignore=(RAW, "re_refreshedon", "re_name", "re_descriptionen"))
                    if changes:
                        raise RuntimeError("Existing part differs at row " + str(row["row_number"]) + ": " + ",".join(changes))
                    if current.get(RAW) and current[RAW] != expected[RAW]:
                        raise RuntimeError("Existing part provenance differs; no overwrite")
                    expected["re_refreshedon"] = current["re_refreshedon"]
                    expected["re_name"] = current.get("re_name")
                    identity = current["re_sparepartid"]
                    status = "verified" if not differences(expected, current) else "existing"
                else:
                    identity = str(uuid.uuid5(uuid.NAMESPACE_URL, "RepairEstimator:sparepart:" + row["source_key"]))
                    status = "pending"
                db.execute("UPDATE parts SET payload=?,status=?,native_id=? WHERE row_number=?",
                           (json.dumps(expected), status, identity, row["row_number"]))
            db.commit()
            report(db, args.report, "preflight_passed")
            batches = 0
            while args.max_batches == 0 or batches < args.max_batches:
                rows = db.execute("SELECT * FROM parts WHERE status='pending' ORDER BY row_number LIMIT 500").fetchall()
                if not rows:
                    break
                db.executemany("UPDATE parts SET status='inflight' WHERE row_number=?",
                               [(r["row_number"],) for r in rows])
                db.commit()
                targets = [dict(json.loads(r["payload"]), re_sparepartid=r["native_id"],
                                **{"@odata.type": "Microsoft.Dynamics.CRM.re_sparepart"}) for r in rows]
                api.send({"set": "re_spareparts"}, "CreateMultiple", targets)
                found = verify_batch(api, rows)
                for row in rows:
                    current = found.get(row["native_id"])
                    if current is None or differences(json.loads(row["payload"]), current):
                        raise RuntimeError("New part full-field readback mismatch")
                db.executemany("UPDATE parts SET status='verified' WHERE row_number=?",
                               [(r["row_number"],) for r in rows])
                db.commit()
                batches += 1
                report(db, args.report, "importing_new_parts")
            # Existing financial fields are never rewritten. Enrich source metadata/text with ETag guards.
            for row in db.execute("SELECT * FROM parts WHERE status='existing' ORDER BY row_number").fetchall():
                if args.max_batches and batches >= args.max_batches:
                    break
                current = api.request("GET", "re_spareparts(" + row["native_id"] + ")")
                expected = json.loads(row["payload"])
                changes = differences(expected, current)
                if any(k not in (RAW, "re_descriptionen") for k in changes):
                    raise RuntimeError("Existing part changed concurrently; no overwrite")
                if changes:
                    api.api.request("PATCH", "re_spareparts(" + row["native_id"] + ")",
                                    {k: expected[k] for k in changes}, {"If-Match": current["@odata.etag"]})
                current = api.request("GET", "re_spareparts(" + row["native_id"] + ")")
                if differences(expected, current):
                    raise RuntimeError("Existing part readback mismatch")
                db.execute("UPDATE parts SET status='verified' WHERE row_number=?", (row["row_number"],))
                db.commit()
                batches += 1
                if batches % 100 == 0:
                    report(db, args.report, "enriching_existing_parts")
            remaining = db.execute("SELECT count(*) FROM parts WHERE status!='verified' AND status!='rejected'").fetchone()[0]
            report(db, args.report, "completed_valid_candidates" if not remaining else "paused_after_batch_limit")
    finally:
        lock.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--deploy-source-column", action="store_true")
    parser.add_argument("--max-batches", type=int, default=0)
    args = parser.parse_args()
    if args.max_batches < 0 or args.deploy_source_column and not args.apply:
        parser.error("Nonnegative batch limit and explicit apply required for deployment")
    run(args)


if __name__ == "__main__":
    main()
