"""Reconcile Account leading zeros from Equipment by exact Account.Id; dry-run by default."""
import argparse
import collections
from email import policy
from email.parser import BytesParser
import importlib.util
import json
from pathlib import Path
import re
import urllib.error
import urllib.request
import uuid

MODULE = importlib.util.spec_from_file_location(
    "customer_bulk", Path(__file__).with_name("import-customer-masters-bulk.py"))
bulk = importlib.util.module_from_spec(MODULE)
MODULE.loader.exec_module(bulk)


def source_numbers(path):
    numbers = {}
    conflicts = set()
    counts = collections.Counter()
    before = bulk.fingerprint(path)
    rows = bulk.stream_rows(path, "Equipment Master")
    try:
        row_number, header = next(rows)
        positions = {value: index for index, (_, value) in header.items()}
        if row_number != 1 or not {"Account.Id", "Account.AccountNumber"} <= positions.keys():
            raise RuntimeError("Missing Equipment Account source columns")
        for _, cells in rows:
            counts["equipment_rows"] += 1
            try:
                parent = bulk.customer.source_id(cells.get(positions["Account.Id"], ("text", None)))
                number = bulk.customer.text(cells.get(positions["Account.AccountNumber"], ("text", None)))
            except bulk.customer.Rejected:
                counts["invalid_source_rows"] += 1
                continue
            if not number or number != number.strip():
                counts["missing_or_whitespace_number_rows"] += 1
                continue
            if parent in numbers and numbers[parent] != number:
                conflicts.add(parent)
            numbers[parent] = number
    finally:
        rows.close()
    if bulk.fingerprint(path) != before:
        raise RuntimeError("Equipment workbook changed during audit")
    counts["source_accounts"] = len(numbers)
    counts["conflicting_source_accounts"] = len(conflicts)
    if conflicts:
        raise RuntimeError("Conflicting Equipment Account numbers; no correction may be inferred")
    return numbers, dict(counts)


def correction_plan(numbers, records, max_length):
    by_source = collections.defaultdict(list)
    by_number = collections.defaultdict(set)
    desired_counts = collections.Counter(numbers.values())
    counts = collections.Counter()
    for record in records:
        counts["tenant_accounts_read"] += 1
        source = record.get("re_salesforceaccountid")
        if source:
            by_source[source].append(record)
        if record.get("accountnumber") is not None:
            by_number[record["accountnumber"]].add(record["accountid"])
    planned = []
    for source, expected in numbers.items():
        matches = by_source.get(source, [])
        if not matches:
            counts["source_accounts_not_imported"] += 1
            continue
        if len(matches) != 1:
            counts["blocked_duplicate_source_identity"] += 1
            continue
        record = matches[0]
        current = record.get("accountnumber")
        if current == expected:
            counts["already_exact"] += 1
            continue
        if (not isinstance(current, str) or not re.fullmatch(r"[0-9]+", current)
                or not re.fullmatch(r"[0-9]+", expected)
                or current.lstrip("0") != expected.lstrip("0")):
            counts["blocked_nonzero_digit_difference"] += 1
            continue
        if len(expected) > max_length:
            counts["blocked_length"] += 1
            continue
        if len(expected) <= len(current) or not expected.startswith("0"):
            counts["blocked_not_missing_leading_zeros"] += 1
            continue
        if desired_counts[expected] > 1 or by_number[expected] - {record["accountid"]}:
            counts["blocked_number_collision"] += 1
            continue
        if not record.get("@odata.etag"):
            counts["blocked_missing_etag"] += 1
            continue
        planned.append((source, expected, record))
    counts["planned_corrections"] = len(planned)
    return planned, dict(counts)


def apply_correction(api, source, expected, record):
    account_id = record["accountid"]
    if re.fullmatch(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", account_id) is None:
        raise RuntimeError("Invalid Account GUID; correction stopped")
    endpoint = "accounts(" + account_id + ")"
    collisions = api.find("accounts", ["accountid"], "accountnumber", expected)
    if any(row["accountid"] != account_id for row in collisions):
        raise RuntimeError("Account number collision appeared after audit")
    api.request("PATCH", endpoint, {"accountnumber": expected},
                concurrency={"If-Match": record["@odata.etag"]})
    actual = api.request("GET", endpoint + "?$select=accountid,re_salesforceaccountid,accountnumber")
    if (actual.get("accountid") != account_id or actual.get("re_salesforceaccountid") != source
            or actual.get("accountnumber") != expected):
        raise RuntimeError("Account correction readback failed; stop and reconcile before retry")


def batch_body(planned):
    boundary = "batch_" + uuid.uuid4().hex
    changeset = "changeset_" + uuid.uuid4().hex
    lines = ["--" + boundary, "Content-Type: multipart/mixed; boundary=" + changeset, ""]
    for index, (_, expected, record) in enumerate(planned, 1):
        account_id = record["accountid"]
        if re.fullmatch(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", account_id) is None:
            raise RuntimeError("Invalid Account GUID; no batch sent")
        etag = record["@odata.etag"]
        if re.fullmatch(r'W/"[0-9]+"', etag) is None:
            raise RuntimeError("Invalid Account ETag; no batch sent")
        lines.extend(["--" + changeset, "Content-Type: application/http",
                      "Content-Transfer-Encoding: binary", "Content-ID: " + str(index), "",
                      "PATCH " + bulk.customer.BASE + "accounts(" + account_id + ") HTTP/1.1",
                      "Content-Type: application/json", "If-Match: " + etag, "",
                      json.dumps({"accountnumber": expected}), ""])
    lines.extend(["--" + changeset + "--", "--" + boundary + "--", ""])
    return boundary, "\r\n".join(lines).encode("utf-8")


def verify_batch_response(content_type, body, expected_count):
    message = BytesParser(policy=policy.default).parsebytes(
        ("Content-Type: " + content_type + "\r\nMIME-Version: 1.0\r\n\r\n").encode("ascii") + body)
    statuses = []
    for part in message.walk():
        if part.get_content_type() == "application/http":
            payload = part.get_payload(decode=True)
            match = re.match(rb"HTTP/1\.[01] ([0-9]{3})", payload)
            if not match:
                raise RuntimeError("Invalid batch response; stop and reconcile before retry")
            statuses.append(int(match[1]))
    if len(statuses) != expected_count or any(status != 204 for status in statuses):
        raise RuntimeError("Account batch was not fully successful; stop and reconcile before retry")


def apply_batch(api, planned):
    conditions = ["accountnumber eq '" + number.replace("'", "''") + "'" for _, number, _ in planned]
    expected_ids = {number: record["accountid"] for _, number, record in planned}
    for record in api.query("accounts", ["accountid", "accountnumber"], " or ".join(conditions)):
        if record["accountid"] != expected_ids[record["accountnumber"]]:
            raise RuntimeError("Account number collision appeared after audit; no batch sent")
    api.refresh()
    boundary, body = batch_body(planned)
    headers = dict(api.api.headers, **{"Content-Type": "multipart/mixed; boundary=" + boundary})
    request = urllib.request.Request(bulk.customer.BASE + "$batch", data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            verify_batch_response(response.headers["Content-Type"], response.read(), len(planned))
    except urllib.error.HTTPError as error:
        status = error.code
        error.close()
        raise RuntimeError("Account batch HTTP " + str(status) + "; stop and reconcile before retry") from None
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError("Account batch outcome unknown; stop and reconcile before retry") from None
    source_filter = " or ".join("re_salesforceaccountid eq '" + source + "'" for source, _, _ in planned)
    actual = list(api.query("accounts", ["accountid", "re_salesforceaccountid", "accountnumber"], source_filter))
    expected = {(record["accountid"], source, number) for source, number, record in planned}
    observed = {(row["accountid"], row.get("re_salesforceaccountid"), row.get("accountnumber")) for row in actual}
    if len(actual) != len(planned) or observed != expected:
        raise RuntimeError("Account batch readback failed; stop and reconcile before retry")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True, help="Sanitized counts only")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-updates", type=int,
                        help="Required with --apply; must match a freshly audited correction count")
    parser.add_argument("--backup", type=Path, help="New private JSON file outside the repository, required for --apply")
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()
    if args.report.resolve() == args.source.resolve():
        parser.error("Report must not overwrite the source workbook")
    if args.apply and (args.expected_updates is None or args.expected_updates < 0):
        parser.error("--apply requires a nonnegative --expected-updates count")
    if not 1 <= args.batch_size <= 100:
        parser.error("--batch-size must be 1..100")
    if args.apply and (not args.backup or args.backup.exists()
                       or args.backup.resolve().is_relative_to(Path(__file__).resolve().parents[1])
                       or args.backup.resolve() in (args.source.resolve(), args.report.resolve())):
        parser.error("--apply requires a new private backup outside the repository")
    report = {"status": "auditing", "verified_corrections": 0}
    try:
        numbers, source_counts = source_numbers(args.source)
        report.update(source_counts)
        api = bulk.BulkApi()
        lengths = bulk.customer.preflight(api, bulk.customer.SPECS["accounts"])
        records = api.query("accounts", ["accountid", "re_salesforceaccountid", "accountnumber"])
        planned, counts = correction_plan(numbers, records, lengths["accountnumber"])
        report.update(counts)
        if args.apply:
            if len(planned) != args.expected_updates:
                raise RuntimeError("Fresh correction count differs from the approved count; no writes started")
            args.backup.parent.mkdir(parents=True, exist_ok=True)
            with args.backup.open("x", encoding="utf-8") as backup:
                json.dump({"source_sha256": bulk.fingerprint(args.source), "changes": [
                    {"source_id": source, "expected": expected, "before": record}
                    for source, expected, record in planned]}, backup)
            for start in range(0, len(planned), args.batch_size):
                batch = planned[start:start + args.batch_size]
                apply_batch(api, batch)
                report["verified_corrections"] += len(batch)
                report["status"] = "applying_verified_batches"
                args.report.parent.mkdir(parents=True, exist_ok=True)
                args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
                if start == 0 or report["verified_corrections"] % 1000 == 0:
                    print(json.dumps({"verified_corrections": report["verified_corrections"]}), flush=True)
            report["status"] = "corrections_verified"
        else:
            report["status"] = "dry_run_no_writes"
    except (RuntimeError, OSError, ValueError):
        report["status"] = "failed_stop_and_reconcile"
        raise
    finally:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
