"""Run one guarded batch per customer dataset concurrently, using separate connections."""
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
from pathlib import Path
import sqlite3
import time

SPEC = importlib.util.spec_from_file_location(
    "customer_apply", Path(__file__).with_name("apply-customer-masters.py"))
apply = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(apply)
bulk = apply.bulk


def run_dataset(state, api, dataset, batch_size, deferred, organization=None):
    if dataset not in ("accounts", "contacts") or not 1 <= batch_size <= 1000:
        raise ValueError("Expected Accounts/Contacts and batch size 1..1000")
    if organization not in (None, "MKOF", "CKE", "CKQ"):
        raise ValueError("Unsupported source organization")
    started = time.monotonic()
    with closing(sqlite3.connect(state, timeout=60)) as db:
        db.row_factory = sqlite3.Row
        if dataset == "contacts":
            rows = db.execute(
                "SELECT c.* FROM source c JOIN source a ON a.dataset='accounts' "
                "AND a.source_id=c.parent AND a.status='verified' AND a.native_id IS NOT NULL "
                "WHERE c.dataset='contacts' AND c.status='pending' "
                "AND (? IS NULL OR (json_extract(c.payload,'$.re_sourcesalesorganization')=? "
                "AND json_extract(a.payload,'$.re_salesorganizations')=?)) "
                "ORDER BY c.row_number LIMIT ?", (organization, organization, organization, batch_size)).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM source WHERE dataset='accounts' AND status='pending' "
                "AND (? IS NULL OR json_extract(payload,'$.re_salesorganizations')=?) "
                "ORDER BY row_number LIMIT ?", (organization, organization, batch_size)).fetchall()
        if not rows:
            return None
        spec = bulk.customer.SPECS[dataset]
        existing = bulk.records_for_batch(api, spec, rows)
        safe = []
        for row in rows:
            record = existing.get(row["source_id"].casefold())
            parent_id = None
            if row["parent"]:
                parent = db.execute(
                    "SELECT native_id,status FROM source WHERE dataset='accounts' AND source_id=?",
                    (row["parent"],)).fetchone()
                if parent is None or parent["status"] != "verified" or not parent["native_id"]:
                    raise RuntimeError("Contact parent is no longer verified")
                parent_id = parent["native_id"]
            if record and not bulk.matches(json.loads(row["payload"]), record, parent_id):
                deferred.add(row["row_number"])
                continue
            safe.append(row)
        if not safe:
            return None
        changed = bulk.apply_batch(db, api, dataset, safe)
        elapsed = time.monotonic() - started
        return {"dataset": dataset, "verified": len(safe), "rows_written": changed,
                "seconds": round(elapsed, 3),
                "verified_records_per_second": round(len(safe) / elapsed, 3)}


def run_round(state, apis, batch_size, deferred, organization=None):
    if set(apis) != {"accounts", "contacts"} or apis["accounts"] is apis["contacts"]:
        raise ValueError("Separate Account and Contact API instances are required")
    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=2, thread_name_prefix="customer-import") as pool:
        futures = {dataset: pool.submit(run_dataset, state, api, dataset, batch_size, deferred[dataset], organization)
                   for dataset, api in apis.items()}
        # All submitted workers settle before an error escapes; never leave an unseen write running.
        results = []
        failures = []
        for dataset, future in futures.items():
            try:
                result = future.result()
                if result is not None:
                    results.append(result)
            except Exception as error:
                failures.append((dataset, error))
    if failures:
        datasets = ",".join(dataset for dataset, _ in failures)
        raise RuntimeError("Parallel customer batch failed for " + datasets +
                           "; reconcile inflight rows before resume") from failures[0][1]
    return results, round(time.monotonic() - started, 3)
