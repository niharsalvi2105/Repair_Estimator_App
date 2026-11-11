"""Exact Account/Contact bulk import; preparation is read-only, apply is explicit."""
import argparse
import collections
import hashlib
import importlib.util
import json
from pathlib import Path
import posixpath
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

MODULE = importlib.util.spec_from_file_location(
    "customer_import", Path(__file__).with_name("import-account-contact-masters.py"))
customer = importlib.util.module_from_spec(MODULE)
MODULE.loader.exec_module(customer)


def fingerprint(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def normalized(value):
    return value.casefold().strip() if value else None


def stream_rows(path, sheet_name):
    """Keep shared strings in memory and release XML elements as rows are consumed."""
    ns = customer.NS
    with zipfile.ZipFile(path) as workbook:
        formats = customer.workbook_number_formats(workbook)
        account_columns = set()
        strings = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            with workbook.open("xl/sharedStrings.xml") as source:
                root = None
                for event, element in ET.iterparse(source, events=("start", "end")):
                    if root is None:
                        root = element
                    if event == "end" and element.tag == ns + "si":
                        strings.append("".join(t.text or "" for t in element.iter(ns + "t")))
                        root.clear()
        targets = {r.get("Id"): r.get("Target") for r in
                   ET.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))}
        metadata = ET.fromstring(workbook.read("xl/workbook.xml"))
        sheet = next((s for s in metadata.find(ns + "sheets")
                      if s.get("name") == sheet_name), None)
        if sheet is None:
            raise RuntimeError("Missing configured source sheet")
        target = targets[sheet.get(
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")]
        member = target.lstrip("/") if target.startswith("/") else posixpath.normpath(
            posixpath.join("xl", target))
        with workbook.open(member) as source:
            parent = None
            for event, element in ET.iterparse(source, events=("start", "end")):
                if event == "start" and element.tag == ns + "sheetData":
                    parent = element
                if event != "end" or element.tag != ns + "row":
                    continue
                cells = {}
                for cell in element.findall(ns + "c"):
                    column = customer.column_index(cell.get("r", ""))
                    typ = cell.get("t", "n")
                    cached = cell.find(ns + "v")
                    value = cached.text if cached is not None else None
                    if cell.find(ns + "f") is not None and value is None:
                        typ = "uncached_formula"
                    elif typ == "s" and value is not None:
                        index = int(value)
                        if not 0 <= index < len(strings):
                            raise RuntimeError("Invalid source shared-string reference")
                        typ, value = "text", strings[index]
                    elif typ == "inlineStr":
                        typ, value = "text", "".join(t.text or "" for t in cell.iter(ns + "t"))
                    elif typ == "str":
                        typ = "text"
                    if column in account_columns:
                        typ, value = customer.account_number_cell(cell, typ, value, formats)
                    cells[column] = (typ, value)
                if element.get("r") == "1":
                    account_columns = {index for index, (_, value) in cells.items()
                                       if value in ("AccountNumber", "Account.AccountNumber")}
                yield int(element.get("r", "0")), cells
                parent.remove(element)


class BulkApi:
    def __init__(self):
        self.api = customer.Api()
        self.refreshed = time.monotonic()

    def request(self, method, endpoint, payload=None):
        self.refresh()
        return self.api.request(method, endpoint, payload)

    def find(self, *args):
        self.refresh()
        return self.api.find(*args)

    def refresh(self):
        if time.monotonic() - self.refreshed >= 2400:
            self.api = customer.Api()
            self.refreshed = time.monotonic()

    def query(self, entity_set, fields, filter_value=None):
        self.refresh()
        query = {"$select": ",".join(fields)}
        if filter_value:
            query["$filter"] = filter_value
        endpoint = entity_set + "?" + urllib.parse.urlencode(query)
        if len(endpoint) > 15000:
            raise RuntimeError("Verification query exceeds safe URL budget")
        result = self.api.request("GET", endpoint,
                                  concurrency={"Prefer": "odata.maxpagesize=5000"})
        while True:
            yield from result["value"]
            link = result.get("@odata.nextLink")
            if not link:
                return
            if not link.startswith(customer.BASE):
                raise RuntimeError("Unexpected Dataverse paging origin")
            result = self.request("GET", link[len(customer.BASE):])

    def upsert(self, spec, payloads):
        self.refresh()
        targets = []
        seen = set()
        for payload in payloads:
            key = payload[spec["key"]]
            if key.casefold() in seen:
                raise RuntimeError("Duplicate source key in bulk request")
            seen.add(key.casefold())
            targets.append(dict(payload, **{
                "@odata.type": "Microsoft.Dynamics.CRM." + spec["entity"],
                "@odata.id": spec["set"] + "(" + spec["key"] + "='" + key + "')"}))
        request = urllib.request.Request(
            customer.BASE + spec["set"] + "/Microsoft.Dynamics.CRM.UpsertMultiple",
            data=encode({"Targets": targets}).encode("utf-8"),
            headers=self.api.headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                response.read()
        except urllib.error.HTTPError as error:
            status = error.code
            error.close()
            raise RuntimeError("Bulk HTTP " + str(status) +
                               "; batch remains unverified; reconcile before retry") from None
        except (urllib.error.URLError, TimeoutError):
            raise RuntimeError("Bulk transport failure; batch remains unverified") from None


def initialize(db):
    db.executescript("""
        CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE source (
            dataset TEXT NOT NULL, row_number INTEGER NOT NULL,
            source_id TEXT NOT NULL COLLATE NOCASE, natural_key TEXT,
            parent TEXT COLLATE NOCASE, payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending', native_id TEXT,
            PRIMARY KEY(dataset,row_number), UNIQUE(dataset,source_id));
        CREATE INDEX natural_keys ON source(dataset,natural_key);
        CREATE INDEX pending_rows ON source(dataset,status,row_number);
        CREATE TABLE rejected (
            dataset TEXT NOT NULL, row_number INTEGER NOT NULL, reason TEXT NOT NULL,
            PRIMARY KEY(dataset,row_number));
    """)


def set_meta(db, name, value):
    db.execute("INSERT OR REPLACE INTO meta VALUES (?,?)", (name, encode(value)))


def get_meta(db, name):
    row = db.execute("SELECT value FROM meta WHERE name=?", (name,)).fetchone()
    return json.loads(row[0]) if row else None


def reject(db, dataset, row_number, reason):
    existing = db.execute("SELECT status FROM source WHERE dataset=? AND row_number=?",
                          (dataset, row_number)).fetchone()
    if existing and existing["status"] != "pending":
        raise RuntimeError("Collision involves a previously attempted row; reconcile explicitly")
    db.execute("DELETE FROM source WHERE dataset=? AND row_number=?", (dataset, row_number))
    db.execute("INSERT OR REPLACE INTO rejected VALUES (?,?,?)", (dataset, row_number, reason))


def metadata_preflight(api, spec):
    lengths = customer.preflight(api, spec)
    query = urllib.parse.urlencode({
        "$select": "primaryobjecttypecode",
        "$expand": "sdkmessageid($select=name)",
        "$filter": "primaryobjecttypecode eq '" + spec["entity"] +
        "' and (sdkmessageid/name eq 'CreateMultiple' or sdkmessageid/name eq 'UpdateMultiple')"})
    messages = api.request("GET", "sdkmessagefilters?" + query)
    if messages.get("@odata.nextLink"):
        raise RuntimeError("Unexpected bulk message metadata pagination")
    names = {r["sdkmessageid"]["name"] for r in messages["value"]}
    if not {"CreateMultiple", "UpdateMultiple"} <= names:
        raise RuntimeError("Bulk upsert support not verified for " + spec["entity"])
    if spec["entity"] == "contact":
        attribute = api.request("GET", "EntityDefinitions(LogicalName='contact')/"
                                "Attributes(LogicalName='parentcustomerid')/"
                                "Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select="
                                "Targets,IsValidForCreate,IsValidForUpdate")
        if ("account" not in attribute["Targets"] or not attribute["IsValidForCreate"]
                or not attribute["IsValidForUpdate"]):
            raise RuntimeError("Writable Contact Account parent not verified")
    return lengths


def prepare(db, source_dir, api):
    if get_meta(db, "prepared"):
        return
    rules = json.loads(Path(__file__).with_name("master-import-rules.json").read_text("utf-8"))
    for dataset, spec in customer.SPECS.items():
        path = source_dir / spec["file"]
        digest = fingerprint(path)
        lengths = metadata_preflight(api, spec)
        set_meta(db, dataset + "_sha256", digest)
        set_meta(db, dataset + "_metadata", json.loads(json.dumps(lengths, default=str)))
        rows = stream_rows(path, spec["sheet"])
        try:
            header_row, cells = next(rows)
            if header_row != 1:
                raise RuntimeError("Missing source header")
            headers = [cell[1] for _, cell in sorted(cells.items())]
            names = customer.validate_source_headers(headers, spec, {})
            positions = {cell[1]: i for i, cell in cells.items()}
            for row_number, cells in rows:
                row = {name: cells.get(positions[name], ("text", None)) for name in names}
                try:
                    payload = customer.build_payload(spec, row, lengths)
                    org = customer.text(row[spec["organization_header"]])
                    if org not in rules["sourceOrganizationToMarket"]["accounts"]:
                        raise customer.Rejected("unmapped_source_organization")
                    parent = customer.source_id(row["Account.Id"]) if dataset == "contacts" else None
                    if parent and not db.execute(
                            "SELECT 1 FROM source WHERE dataset='accounts' AND source_id=?",
                            (parent,)).fetchone():
                        raise customer.Rejected("missing_or_ambiguous_importable_parent")
                    natural = normalized(payload.get(
                        "accountnumber" if dataset == "accounts" else "emailaddress1"))
                    db.execute("INSERT INTO source(dataset,row_number,source_id,natural_key,"
                               "parent,payload) VALUES (?,?,?,?,?,?)",
                               (dataset, row_number, payload[spec["key"]], natural,
                                parent, encode(payload)))
                except customer.Rejected as error:
                    reject(db, dataset, row_number, str(error))
                except sqlite3.IntegrityError:
                    raise RuntimeError("Duplicate source identity; preparation aborted") from None
                if row_number % 25000 == 0:
                    db.commit()
                    print(encode({"phase": "source_validation", "dataset": dataset,
                                  "through_row": row_number}), flush=True)
        finally:
            rows.close()
        if fingerprint(path) != digest:
            raise RuntimeError("Source changed during preparation")
        if dataset == "accounts":
            duplicate_numbers = db.execute(
                "SELECT natural_key FROM source WHERE dataset='accounts' "
                "GROUP BY natural_key HAVING COUNT(*)>1").fetchall()
            if duplicate_numbers:
                raise RuntimeError("Ambiguous source AccountNumber; preparation aborted")
        db.commit()
    set_meta(db, "prepared", True)
    db.commit()


def collision_preflight(db, api):
    for dataset, spec in customer.SPECS.items():
        natural_field = "accountnumber" if dataset == "accounts" else "emailaddress1"
        count = 0
        for record in api.query(spec["set"], [spec["id"], spec["key"], natural_field],
                                natural_field + " ne null or " + spec["key"] + " ne null"):
            count += 1
            natural = normalized(record.get(natural_field))
            if not natural:
                continue
            candidates = db.execute(
                "SELECT row_number,source_id FROM source WHERE dataset=? AND natural_key=?",
                (dataset, natural)).fetchall()
            for row_number, source_id in candidates:
                existing_key = record.get(spec["key"])
                collision = (not existing_key or existing_key.casefold() != source_id.casefold()
                             if dataset == "accounts" else not existing_key)
                if collision:
                    reject(db, dataset, row_number, "destination_natural_key_collision")
        set_meta(db, dataset + "_destination_rows_scanned", count)
        db.commit()
    orphans = db.execute(
        "SELECT row_number FROM source c WHERE c.dataset='contacts' AND NOT EXISTS "
        "(SELECT 1 FROM source a WHERE a.dataset='accounts' AND a.source_id=c.parent)").fetchall()
    for (row_number,) in orphans:
        reject(db, "contacts", row_number, "quarantined_parent_after_destination_preflight")
    db.commit()


def records_for_batch(api, spec, rows):
    fields = list(spec["fields"].values()) + [spec["raw_metadata_field"], spec["id"]]
    if spec["entity"] == "contact":
        fields += ["firstname", "lastname", "_parentcustomerid_value"]
    found = {}
    for start in range(0, len(rows), 100):
        filter_value = " or ".join(spec["key"] + " eq '" + row["source_id"] + "'"
                                   for row in rows[start:start + 100])
        for record in api.query(spec["set"], fields, filter_value):
            key = record[spec["key"]].casefold()
            if key in found:
                raise RuntimeError("Duplicate destination source key")
            found[key] = record
    return found


def matches(payload, record, parent_id=None):
    if record is None:
        return False
    for field, value in payload.items():
        if field.endswith("@odata.bind"):
            continue
        if field not in record:
            raise RuntimeError("Verification response omitted mapped field")
        if record[field] != value or (isinstance(value, bool) and not isinstance(record[field], bool)):
            return False
    if parent_id is not None:
        return normalized(record.get("_parentcustomerid_value")) == normalized(parent_id)
    return True


def apply_batch(db, api, dataset, rows):
    spec = customer.SPECS[dataset]
    payloads = []
    parents = []
    existing = records_for_batch(api, spec, rows)
    for row in rows:
        payload = json.loads(row["payload"])
        parent_id = None
        if row["parent"]:
            parent = db.execute(
                "SELECT native_id,status FROM source WHERE dataset='accounts' AND source_id=?",
                (row["parent"],)).fetchone()
            if not parent or parent["status"] != "verified" or not parent["native_id"]:
                raise RuntimeError("Contact parent has not been verified")
            parent_id = parent["native_id"]
            payload["parentcustomerid_account@odata.bind"] = "/accounts(" + parent_id + ")"
        parents.append(parent_id)
        record = existing.get(row["source_id"].casefold())
        if not matches(payload, record, parent_id):
            payloads.append(payload)
    db.executemany("UPDATE source SET status='inflight' WHERE dataset=? AND row_number=?",
                   [(dataset, row["row_number"]) for row in rows])
    db.commit()
    if payloads:
        api.upsert(spec, payloads)
    verified = records_for_batch(api, spec, rows)
    for row, parent_id in zip(rows, parents):
        record = verified.get(row["source_id"].casefold())
        if not matches(json.loads(row["payload"]), record, parent_id):
            raise RuntimeError("Exact post-write verification failed; batch not checkpointed")
    db.executemany(
        "UPDATE source SET status='verified',native_id=? WHERE dataset=? AND row_number=?",
        [(verified[row["source_id"].casefold()][spec["id"]], dataset, row["row_number"])
         for row in rows])
    db.commit()
    return len(payloads)


def write_report(db, path, status):
    report = {"status": status, "target": customer.BASE, "datasets": {}}
    for dataset in customer.SPECS:
        counts = dict(db.execute(
            "SELECT status,COUNT(*) FROM source WHERE dataset=? GROUP BY status",
            (dataset,)).fetchall())
        reasons = dict(db.execute(
            "SELECT reason,COUNT(*) FROM rejected WHERE dataset=? GROUP BY reason",
            (dataset,)).fetchall())
        report["datasets"][dataset] = {
            "candidate_states": counts, "rejected_count": sum(reasons.values()),
            "rejection_reasons": reasons,
            "destination_rows_scanned": get_meta(db, dataset + "_destination_rows_scanned"),
            "rejected_rows": [{"row": row, "reason": reason} for row, reason in db.execute(
                "SELECT row_number,reason FROM rejected WHERE dataset=? ORDER BY row_number",
                (dataset,))]}
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    print(encode({"status": status, "counts": {
        dataset: {"candidate_states": value["candidate_states"],
                  "rejected": value["rejected_count"]}
        for dataset, value in report["datasets"].items()}}), flush=True)


def run_locked(args, api):
    new = not args.state.exists()
    args.state.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(args.state) as db:
        db.row_factory = sqlite3.Row
        if new:
            initialize(db)
        try:
            if not new and not get_meta(db, "prepared"):
                raise RuntimeError("Incomplete preparation; use a fresh state database")
            contract = fingerprint(Path(__file__)) + fingerprint(Path(customer.__file__)) + fingerprint(
                Path(__file__).with_name("master-import-rules.json"))
            if new:
                set_meta(db, "contract", contract)
            elif contract != get_meta(db, "contract"):
                raise RuntimeError("Import contract changed; refuse resume")
            prepare(db, args.source_dir, api)
            for dataset, spec in customer.SPECS.items():
                if fingerprint(args.source_dir / spec["file"]) != get_meta(db, dataset + "_sha256"):
                    raise RuntimeError("Source fingerprint changed; refuse resume")
                current = json.loads(json.dumps(metadata_preflight(api, spec), default=str))
                if current != get_meta(db, dataset + "_metadata"):
                    raise RuntimeError("Writable metadata changed; refuse resume")
            collision_preflight(db, api)
            if not args.apply:
                write_report(db, args.report, "prepared_no_business_writes")
                return 0
            batches = 0
            for dataset in customer.SPECS:
                while True:
                    rows = db.execute(
                        "SELECT * FROM source WHERE dataset=? AND status!='verified' "
                        "ORDER BY row_number LIMIT ?", (dataset, args.batch_size)).fetchall()
                    if not rows:
                        break
                    changed = apply_batch(db, api, dataset, rows)
                    write_report(db, args.report, "applying")
                    print(encode({"dataset": dataset, "batch_verified": len(rows),
                                  "rows_upserted": changed}), flush=True)
                    batches += 1
                    if args.max_batches and batches >= args.max_batches:
                        write_report(db, args.report, "paused_after_verified_batches")
                        return 0
            write_report(db, args.report, "completed_with_reported_quarantine")
            return 0
        except (RuntimeError, OSError, ValueError, ET.ParseError, zipfile.BadZipFile,
                sqlite3.Error):
            db.commit()
            write_report(db, args.report, "failed_or_unverified")
            raise


def run(args, api):
    args.state.parent.mkdir(parents=True, exist_ok=True)
    lock = args.state.with_suffix(args.state.suffix + ".lock")
    with lock.open("x", encoding="utf-8") as handle:
        handle.write("Exclusive customer import; remove only after confirming no importer is running.\n")
    try:
        return run_locked(args, api)
    finally:
        lock.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--state", type=Path, required=True,
                        help="Private local SQLite staging; contains source records, never commit")
    parser.add_argument("--report", type=Path, required=True,
                        help="Counts and rejected worksheet row numbers, never raw customer values")
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--max-batches", type=int, default=0,
                        help="Stop after verified batches for pilot/checkpoint; 0 processes all")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.batch_size <= 1000:
        parser.error("batch-size must be 1..1000")
    if args.max_batches < 0:
        parser.error("max-batches must be nonnegative")
    repository = Path(__file__).resolve().parents[1]
    if args.state.resolve().is_relative_to(repository) or args.report.resolve().is_relative_to(repository):
        parser.error("State and report must be outside the repository")
    if args.state.resolve() == args.report.resolve():
        parser.error("State and report must use different paths")
    return run(args, BulkApi())


if __name__ == "__main__":
    raise SystemExit(main())
