import importlib.util
import io
from pathlib import Path
import sqlite3
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import urllib.error

SPEC = importlib.util.spec_from_file_location(
    "customer_bulk", Path(__file__).parents[1] / "import-customer-masters-bulk.py")
bulk = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bulk)
APPLY_SPEC = importlib.util.spec_from_file_location(
    "customer_apply", Path(__file__).parents[1] / "apply-customer-masters.py")
apply = importlib.util.module_from_spec(APPLY_SPEC)
APPLY_SPEC.loader.exec_module(apply)


class FakeApi:
    def __init__(self, records=None, lose_field=None, fail=False):
        self.records = records or {}
        self.writes = []
        self.lose_field = lose_field
        self.fail = fail

    def query(self, entity_set, fields, filter_value=None):
        if entity_set == "contacts":
            return
        for record in self.records.values():
            if not filter_value or " eq '" not in filter_value or record["re_salesforceaccountid"] in filter_value:
                result = dict(record)
                if self.lose_field:
                    result.pop(self.lose_field, None)
                yield result

    def upsert(self, spec, payloads):
        self.writes.append(payloads)
        if self.fail:
            raise RuntimeError("Transport failure")
        for index, payload in enumerate(payloads):
            self.records[payload[spec["key"]]] = dict(payload, accountid="synthetic-" + str(index))


class BulkImportTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        bulk.initialize(self.db)
        spec = bulk.customer.SPECS["accounts"]
        self.key = "A" * 18
        self.payload = {field: None for field in spec["fields"].values()}
        self.payload.update(re_salesforceaccountid=self.key, accountnumber="00042",
                            name="Synthetic account", re_sourceexportmetadata='{"_":null,"Owner":null}')
        self.db.execute("INSERT INTO source(dataset,row_number,source_id,natural_key,payload) "
                        "VALUES ('accounts',2,?,'00042',?)",
                        (self.key, bulk.encode(self.payload)))

    def tearDown(self):
        self.db.close()

    def rows(self):
        return self.db.execute("SELECT * FROM source").fetchall()

    def test_creates_then_verifies_all_fields(self):
        api = FakeApi()
        self.assertEqual(bulk.apply_batch(self.db, api, "accounts", self.rows()), 1)
        row = self.rows()[0]
        self.assertEqual(row["status"], "verified")
        self.assertEqual(row["native_id"], "synthetic-0")
        self.assertEqual(api.records[self.key]["accountnumber"], "00042")

    def test_resume_skips_exact_existing_record_and_keeps_guid(self):
        api = FakeApi({self.key: dict(self.payload, accountid="original-guid")})
        self.assertEqual(bulk.apply_batch(self.db, api, "accounts", self.rows()), 0)
        self.assertEqual(api.writes, [])
        self.assertEqual(self.rows()[0]["native_id"], "original-guid")

    def test_transport_failure_does_not_checkpoint_batch(self):
        with self.assertRaisesRegex(RuntimeError, "Transport failure"):
            bulk.apply_batch(self.db, FakeApi(fail=True), "accounts", self.rows())
        self.assertEqual(self.rows()[0]["status"], "inflight")
        self.assertIsNone(self.rows()[0]["native_id"])

    def test_missing_selected_field_is_explicit_error(self):
        api = FakeApi({self.key: dict(self.payload, accountid="original")},
                      lose_field="address1_city")
        with self.assertRaisesRegex(RuntimeError, "omitted mapped field"):
            bulk.apply_batch(self.db, api, "accounts", self.rows())

    def test_zero_false_and_null_are_preserved(self):
        self.assertTrue(bulk.matches({"a": None, "b": False, "c": 0},
                                    {"a": None, "b": False, "c": 0}))
        self.assertFalse(bulk.matches({"a": None}, {"a": ""}))

    def test_parent_relationship_is_verified(self):
        self.assertFalse(bulk.matches({"name": "Synthetic"},
                                     {"name": "Synthetic", "_parentcustomerid_value": "wrong"},
                                     "expected"))
        self.assertTrue(bulk.matches({"name": "Synthetic"},
                                    {"name": "Synthetic", "_parentcustomerid_value": "EXPECTED"},
                                    "expected"))

    def test_native_number_collision_quarantines_candidate(self):
        native = dict(self.payload, accountid="native", re_salesforceaccountid=None)
        api = FakeApi({"native": native})
        bulk.collision_preflight(self.db, api)
        self.assertEqual(self.rows(), [])
        rejected = self.db.execute("SELECT * FROM rejected").fetchone()
        self.assertEqual(rejected["reason"], "destination_natural_key_collision")
        self.assertEqual(api.writes, [])

    def test_reject_manifest_has_no_customer_payload(self):
        bulk.reject(self.db, "accounts", 2, "synthetic_error")
        row = self.db.execute("SELECT * FROM rejected").fetchone()
        self.assertEqual(dict(row), {
            "dataset": "accounts", "row_number": 2, "reason": "synthetic_error"})

    def test_metadata_roundtrips(self):
        bulk.set_meta(self.db, "test", {"value": 1})
        self.assertEqual(bulk.get_meta(self.db, "test"), {"value": 1})

    def test_previous_write_cannot_be_silently_quarantined(self):
        self.db.execute("UPDATE source SET status='inflight'")
        with self.assertRaisesRegex(RuntimeError, "previously attempted row"):
            bulk.reject(self.db, "accounts", 2, "collision")
        self.assertEqual(self.rows()[0]["status"], "inflight")

    def test_boolean_verification_does_not_accept_numeric_proxy(self):
        self.assertFalse(bulk.matches({"flag": False}, {"flag": 0}))

    def test_contact_parent_must_be_checkpointed_before_writing(self):
        spec = bulk.customer.SPECS["contacts"]
        payload = {field: None for field in spec["fields"].values()}
        payload.update(re_salesforcecontactid="B" * 18, re_salesforcename="Synthetic contact",
                       firstname=None, lastname="Synthetic contact", re_sourceexportmetadata="{}")
        self.db.execute(
            "INSERT INTO source(dataset,row_number,source_id,parent,payload) VALUES (?,?,?,?,?)",
            ("contacts", 2, "B" * 18, self.key, bulk.encode(payload)))
        rows = self.db.execute("SELECT * FROM source WHERE dataset='contacts'").fetchall()
        with self.assertRaisesRegex(RuntimeError, "parent has not been verified"):
            bulk.apply_batch(self.db, FakeApi(), "contacts", rows)
        self.assertEqual(rows[0]["status"], "pending")

    def test_corrupted_write_is_not_success_shaped(self):
        class CorruptApi(FakeApi):
            def upsert(self, spec, payloads):
                super().upsert(spec, payloads)
                for record in self.records.values():
                    record["accountnumber"] = "42"

        with self.assertRaisesRegex(RuntimeError, "post-write verification failed"):
            bulk.apply_batch(self.db, CorruptApi(), "accounts", self.rows())
        self.assertEqual(self.rows()[0]["status"], "inflight")

    def test_separate_create_update_transport_preserves_existing_identity(self):
        payload = self.payload
        key = self.key

        class Transport(apply.CreateUpdateApi):
            def __init__(self):
                self.calls = []

            def query(self, entity_set, fields, filter_value=None):
                yield dict(payload, accountid="original-guid")

            def send(self, spec, operation, targets):
                self.calls.append((operation, targets))

        transport = Transport()
        second = dict(payload, re_salesforceaccountid="B" * 18)
        transport.upsert(bulk.customer.SPECS["accounts"], [payload, second])
        self.assertEqual([call[0] for call in transport.calls], ["CreateMultiple", "UpdateMultiple"])
        self.assertNotIn("accountid", transport.calls[0][1][0])
        self.assertEqual(transport.calls[1][1][0]["accountid"], "original-guid")
        self.assertEqual(transport.calls[1][1][0]["re_salesforceaccountid"], key)

    def test_separate_transport_rejects_duplicate_keys_before_write(self):
        payload = self.payload

        class Transport(apply.CreateUpdateApi):
            def __init__(self):
                self.calls = []

            def query(self, entity_set, fields, filter_value=None):
                return iter(())

            def send(self, spec, operation, targets):
                self.calls.append((operation, targets))

        transport = Transport()
        with self.assertRaisesRegex(RuntimeError, "duplicate source key"):
            transport.upsert(bulk.customer.SPECS["accounts"], [payload, payload])
        self.assertEqual(transport.calls, [])

    def test_direct_transport_reports_code_without_customer_error_message(self):
        transport = object.__new__(apply.CreateUpdateApi)
        transport.api = SimpleNamespace(headers={})
        error = urllib.error.HTTPError(
            "https://example.invalid", 400, "Bad Request", {},
            io.BytesIO(b'{"error":{"code":"0x80040216","message":"private synthetic value"}}'))
        with patch.object(transport, "refresh"), patch.object(
                apply.urllib.request, "urlopen", side_effect=error):
            with self.assertRaisesRegex(RuntimeError, "HTTP 400 code=0x80040216") as failure:
                transport.send(bulk.customer.SPECS["accounts"], "CreateMultiple", [self.payload])
        self.assertNotIn("private synthetic value", str(failure.exception))

    def test_direct_transport_retries_only_explicit_throttling(self):
        transport = object.__new__(apply.CreateUpdateApi)
        transport.api = SimpleNamespace(headers={})
        errors = [urllib.error.HTTPError(
            "https://example.invalid", 429, "Throttled", {"Retry-After": "0"},
            io.BytesIO(b"{}")) for _ in range(6)]
        with patch.object(transport, "refresh"), patch.object(
                apply.urllib.request, "urlopen", side_effect=errors) as request, patch.object(
                apply.time, "sleep"):
            with self.assertRaisesRegex(RuntimeError, "HTTP 429"):
                transport.send(bulk.customer.SPECS["accounts"], "CreateMultiple", [self.payload])
        self.assertEqual(request.call_count, 6)

    def test_direct_contact_create_keeps_parent_lookup_binding(self):
        class Transport(apply.CreateUpdateApi):
            def __init__(self):
                self.calls = []

            def query(self, entity_set, fields, filter_value=None):
                return iter(())

            def send(self, spec, operation, targets):
                self.calls.append((operation, targets))

        transport = Transport()
        payload = {"re_salesforcecontactid": "C" * 18,
                   "parentcustomerid_account@odata.bind": "/accounts(synthetic-parent)"}
        transport.upsert(bulk.customer.SPECS["contacts"], [payload])
        target = transport.calls[0][1][0]
        self.assertEqual(target["parentcustomerid_account@odata.bind"],
                         "/accounts(synthetic-parent)")
        self.assertEqual(target["@odata.type"], "Microsoft.Dynamics.CRM.contact")

    def test_expired_read_token_refreshes_once(self):
        api = object.__new__(apply.RefreshingApi)
        with patch.object(apply.bulk.customer.Api, "__init__") as refresh, patch.object(
                apply.bulk.customer.Api, "request",
                side_effect=[RuntimeError("Dataverse HTTP 401; code unavailable; method GET"),
                             {"value": []}]) as request:
            self.assertEqual(api.request("GET", "accounts"), {"value": []})
        refresh.assert_called_once()
        self.assertEqual(request.call_count, 2)

    def test_expired_write_token_is_not_replayed(self):
        api = object.__new__(apply.RefreshingApi)
        with patch.object(apply.bulk.customer.Api, "__init__") as refresh, patch.object(
                apply.bulk.customer.Api, "request",
                side_effect=RuntimeError("Dataverse HTTP 401; code unavailable; method POST")):
            with self.assertRaisesRegex(RuntimeError, "HTTP 401"):
                api.request("POST", "accounts", {})
        refresh.assert_not_called()


if __name__ == "__main__":
    unittest.main()
