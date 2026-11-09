from contextlib import closing
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "parallel", Path(__file__).parents[1] / "customer-import-parallel.py")
parallel = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(parallel)


class ParallelTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.state = Path(self.directory.name) / "state.sqlite"
        with closing(sqlite3.connect(self.state)) as db:
            db.execute("CREATE TABLE source(dataset TEXT,row_number INTEGER,source_id TEXT,"
                       "parent TEXT,payload TEXT,status TEXT,native_id TEXT)")
            db.executemany("INSERT INTO source VALUES (?,?,?,?,?,?,?)", [
                ("accounts", 1, "verified-parent", None, "{}", "verified", "native-parent"),
                ("accounts", 2, "pending-parent", None, "{}", "pending", None),
                ("contacts", 3, "safe-contact", "verified-parent", "{}", "pending", None),
                ("contacts", 4, "unsafe-contact", "pending-parent", "{}", "pending", None),
            ])
            db.commit()
        self.apis = {"accounts": object(), "contacts": object()}
        self.deferred = {"accounts": set(), "contacts": set()}

    def test_account_and_contact_batches_overlap_and_only_verified_parents_are_selected(self):
        barrier = threading.Barrier(2)
        seen = {}

        def apply_batch(db, api, dataset, rows):
            seen[dataset] = [row["source_id"] for row in rows]
            self.assertIs(api, self.apis[dataset])
            barrier.wait(timeout=5)
            return len(rows)

        with patch.object(parallel.bulk, "records_for_batch", return_value={}), \
                patch.object(parallel.bulk, "apply_batch", side_effect=apply_batch):
            results, elapsed = parallel.run_round(self.state, self.apis, 500, self.deferred)
        self.assertEqual(seen, {"accounts": ["pending-parent"], "contacts": ["safe-contact"]})
        self.assertEqual(sum(row["verified"] for row in results), 2)
        self.assertGreaterEqual(elapsed, 0)

    def test_existing_conflict_is_deferred_without_write(self):
        with patch.object(parallel.bulk, "records_for_batch", return_value={"safe-contact": {"x": 1}}), \
                patch.object(parallel.bulk, "matches", return_value=False), \
                patch.object(parallel.bulk, "apply_batch") as apply_batch:
            result = parallel.run_dataset(self.state, object(), "contacts", 500, self.deferred["contacts"])
        self.assertIsNone(result)
        apply_batch.assert_not_called()
        self.assertEqual(self.deferred["contacts"], {3})

    def test_failure_waits_for_other_worker_and_retains_committed_inflight_state(self):
        barrier = threading.Barrier(2)
        contact_finished = threading.Event()

        def apply_batch(db, api, dataset, rows):
            db.execute("UPDATE source SET status='inflight' WHERE dataset=? AND row_number=?",
                       (dataset, rows[0]["row_number"]))
            db.commit()
            barrier.wait(timeout=5)
            if dataset == "accounts":
                raise RuntimeError("uncertain write")
            contact_finished.set()
            return 1

        with patch.object(parallel.bulk, "records_for_batch", return_value={}), \
                patch.object(parallel.bulk, "apply_batch", side_effect=apply_batch):
            with self.assertRaisesRegex(RuntimeError, "reconcile inflight"):
                parallel.run_round(self.state, self.apis, 500, self.deferred)
        self.assertTrue(contact_finished.is_set())
        with closing(sqlite3.connect(self.state)) as db:
            self.assertEqual(db.execute("SELECT count(*) FROM source WHERE status='inflight'").fetchone()[0], 2)

    def test_shared_api_or_invalid_size_is_rejected(self):
        api = object()
        with self.assertRaisesRegex(ValueError, "Separate"):
            parallel.run_round(self.state, {"accounts": api, "contacts": api}, 500, self.deferred)
        for size in (0, 1001):
            with self.assertRaises(ValueError):
                parallel.run_dataset(self.state, api, "contacts", size, set())

    def test_mko_scope_excludes_other_markets_and_wrong_market_parents(self):
        with closing(sqlite3.connect(self.state)) as db:
            db.execute("UPDATE source SET payload=? WHERE dataset='accounts'",
                       ('{"re_salesorganizations":"MKOF"}',))
            db.execute("UPDATE source SET payload=? WHERE dataset='contacts'",
                       ('{"re_sourcesalesorganization":"MKOF"}',))
            db.executemany("INSERT INTO source VALUES (?,?,?,?,?,?,?)", [
                ("accounts", 5, "cad-parent", None, '{"re_salesorganizations":"CKE"}', "verified", "cad-native"),
                ("accounts", 6, "cad-pending", None, '{"re_salesorganizations":"CKQ"}', "pending", None),
                ("contacts", 7, "cad-contact", "verified-parent", '{"re_sourcesalesorganization":"CKE"}', "pending", None),
                ("contacts", 8, "wrong-parent", "cad-parent", '{"re_sourcesalesorganization":"MKOF"}', "pending", None),
            ])
            db.commit()
        seen = {}

        def apply_batch(db, api, dataset, rows):
            seen[dataset] = [row["source_id"] for row in rows]
            return len(rows)

        with patch.object(parallel.bulk, "records_for_batch", return_value={}), \
                patch.object(parallel.bulk, "apply_batch", side_effect=apply_batch):
            parallel.run_round(self.state, self.apis, 500, self.deferred, "MKOF")
        self.assertEqual(seen, {"accounts": ["pending-parent"], "contacts": ["safe-contact"]})
        with self.assertRaisesRegex(ValueError, "organization"):
            parallel.run_dataset(self.state, object(), "accounts", 500, set(), "MKO")


if __name__ == "__main__":
    unittest.main()
