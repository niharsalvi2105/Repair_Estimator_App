"""Apply unchanged customer staging with four bounded parallel verification reads."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import importlib.util
from pathlib import Path
import re
import time


MODULE = importlib.util.spec_from_file_location(
    "customer_apply", Path(__file__).with_name("apply-customer-masters.py"))
apply = importlib.util.module_from_spec(MODULE)
MODULE.loader.exec_module(apply)
bulk = apply.bulk
ORIGINAL_READ = bulk.records_for_batch


class FastApi(apply.CreateUpdateApi):
    def read_chunk(self, spec, rows):
        reader = object.__new__(apply.CreateUpdateApi)
        reader.api = object.__new__(apply.RefreshingApi)
        reader.api.headers = dict(self.api.headers)
        reader.refreshed = self.refreshed
        return ORIGINAL_READ(reader, spec, rows)


def parallel_records(api, spec, rows):
    if not isinstance(api, FastApi):
        return ORIGINAL_READ(api, spec, rows)
    for row in rows:
        if not re.fullmatch(r"[A-Za-z0-9]{18}", row["source_id"]):
            raise RuntimeError("Invalid customer source key")
    api.refresh()
    chunks = [rows[start:start + 100] for start in range(0, len(rows), 100)]
    found = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(lambda chunk: api.read_chunk(spec, chunk), chunks):
            for key, record in result.items():
                if key in found:
                    raise RuntimeError("Duplicate destination source key across verification chunks")
                found[key] = record
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--checklist", type=Path, required=True)
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--max-batches", type=int, default=0)
    parser.add_argument("--apply", action="store_true", required=True)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    if len({path.resolve() for path in (args.state, args.report, args.checklist)}) != 3:
        parser.error("State, report and checklist must be distinct")
    if any(path.resolve().is_relative_to(repo) for path in (args.state, args.report)):
        parser.error("Private state and report must be outside the repository")
    if not args.state.is_file() or not 1 <= args.batch_size <= 1000 or args.max_batches < 0:
        parser.error("Prepared state required; batch-size 1..1000; max-batches nonnegative")
    write_report = bulk.write_report

    def report_with_checklist(db, path, status):
        write_report(db, path, status)
        apply.checklist.write_checklist(path, args.checklist)

    bulk.records_for_batch = parallel_records
    bulk.write_report = report_with_checklist
    started = time.monotonic()
    try:
        return bulk.run(args, FastApi())
    finally:
        bulk.records_for_batch = ORIGINAL_READ
        bulk.write_report = write_report
        print(bulk.encode({"elapsed_seconds": round(time.monotonic() - started, 1)}), flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
