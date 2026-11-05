"""Apply prepared customer staging with separately verified Create/UpdateMultiple actions."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.request

MODULE = importlib.util.spec_from_file_location(
    "customer_bulk", Path(__file__).with_name("import-customer-masters-bulk.py"))
bulk = importlib.util.module_from_spec(MODULE)
MODULE.loader.exec_module(bulk)
CHECKLIST_MODULE = importlib.util.spec_from_file_location(
    "customer_checklist", Path(__file__).with_name("customer-import-checklist.py"))
checklist = importlib.util.module_from_spec(CHECKLIST_MODULE)
CHECKLIST_MODULE.loader.exec_module(checklist)


class RefreshingApi(bulk.customer.Api):
    def request(self, method, endpoint, payload=None, concurrency=None):
        try:
            return super().request(method, endpoint, payload, concurrency)
        except RuntimeError as error:
            if method != "GET" or not str(error).startswith("Dataverse HTTP 401;"):
                raise
            super().__init__()
            return super().request(method, endpoint, payload, concurrency)


class CreateUpdateApi(bulk.BulkApi):
    def __init__(self):
        self.api = RefreshingApi()
        self.refreshed = time.monotonic()

    def refresh(self):
        if time.monotonic() - self.refreshed >= 2400:
            self.api = RefreshingApi()
            self.refreshed = time.monotonic()

    def send(self, spec, operation, targets):
        self.refresh()
        endpoint = bulk.customer.BASE + spec["set"] + "/Microsoft.Dynamics.CRM." + operation
        for attempt in range(6):
            request = urllib.request.Request(
                endpoint, data=bulk.encode({"Targets": targets}).encode("utf-8"),
                headers=self.api.headers, method="POST")
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    response.read()
                return
            except urllib.error.HTTPError as error:
                status = error.code
                retry = error.headers.get("Retry-After", "")
                request_id = error.headers.get("x-ms-service-request-id", "")
                body = error.read(65536)
                error.close()
                if status == 429 and attempt < 5:
                    time.sleep(min(120, int(retry) if retry.isdigit() else 2 ** attempt))
                    continue
                code = ""
                try:
                    document = json.loads(body)
                except (ValueError, UnicodeError):
                    document = None
                if isinstance(document, dict) and isinstance(document.get("error"), dict):
                    value = document["error"].get("code")
                    if isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{8}", value):
                        code = " code=" + value
                correlation = ""
                if re.fullmatch(r"[0-9a-fA-F-]{36}", request_id):
                    correlation = " request=" + request_id
                raise RuntimeError(operation + " HTTP " + str(status) + code + correlation +
                                   "; reconcile inflight rows before resume") from None
            except (urllib.error.URLError, TimeoutError):
                raise RuntimeError(operation + " transport failure; reconcile inflight rows") from None

    def upsert(self, spec, payloads):
        rows = [{"source_id": payload[spec["key"]]} for payload in payloads]
        existing = bulk.records_for_batch(self, spec, rows)
        creates, updates = [], []
        seen = set()
        for payload in payloads:
            key = payload[spec["key"]]
            if not re.fullmatch(r"[A-Za-z0-9]{18}", key) or key.casefold() in seen:
                raise RuntimeError("Invalid or duplicate source key")
            seen.add(key.casefold())
            target = dict(payload, **{"@odata.type": "Microsoft.Dynamics.CRM." + spec["entity"]})
            record = existing.get(key.casefold())
            if record:
                target[spec["id"]] = record[spec["id"]]
                updates.append(target)
            else:
                creates.append(target)
        if creates:
            self.send(spec, "CreateMultiple", creates)
        if updates:
            self.send(spec, "UpdateMultiple", updates)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--checklist", type=Path,
                        help="Optional sanitized checklist updated after each verified batch")
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--max-batches", type=int, default=0)
    parser.add_argument("--apply", action="store_true", required=True,
                        help="Explicit authorization to write the prepared staging")
    args = parser.parse_args()
    if not 1 <= args.batch_size <= 1000 or args.max_batches < 0:
        parser.error("batch-size must be 1..1000 and max-batches nonnegative")
    repository = Path(__file__).resolve().parents[1]
    if args.state.resolve().is_relative_to(repository) or args.report.resolve().is_relative_to(repository):
        parser.error("State and report must be outside the repository")
    if not args.state.is_file() or args.state.resolve() == args.report.resolve():
        parser.error("An existing prepared state and a different report path are required")
    if args.checklist and args.checklist.resolve() in (args.state.resolve(), args.report.resolve()):
        parser.error("Checklist must not overwrite state or report")
    write_report = bulk.write_report
    if args.checklist:
        def report_with_checklist(db, path, status):
            write_report(db, path, status)
            checklist.write_checklist(path, args.checklist)
        bulk.write_report = report_with_checklist
    try:
        return bulk.run(args, CreateUpdateApi())
    finally:
        bulk.write_report = write_report


if __name__ == "__main__":
    raise SystemExit(main())
