import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "account_repair", Path(__file__).parents[1] / "repair-account-number-zeros.py")
repair = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(repair)


def account(source="A" * 18, number="42", identity="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"):
    return {"accountid": identity, "re_salesforceaccountid": source,
            "accountnumber": number, "@odata.etag": 'W/"1"'}


class AccountRepairTests(unittest.TestCase):
    def test_exact_source_id_not_number_drives_matching(self):
        records = [account(), account("B" * 18, "0042", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")]
        plan, counts = repair.correction_plan({"A" * 18: "00042"}, records, 20)
        self.assertEqual(len(plan), 1)
        self.assertEqual(plan[0][0:2], ("A" * 18, "00042"))
        self.assertEqual(counts["planned_corrections"], 1)

    def test_correct_accounts_and_missing_imports_are_not_written(self):
        plan, counts = repair.correction_plan(
            {"A" * 18: "00042", "B" * 18: "00123"}, [account(number="00042")], 20)
        self.assertEqual(plan, [])
        self.assertEqual(counts["already_exact"], 1)
        self.assertEqual(counts["source_accounts_not_imported"], 1)
        self.assertEqual(counts["tenant_accounts_read"], 1)

    def test_existing_zeros_are_never_removed(self):
        plan, counts = repair.correction_plan({"A" * 18: "42"}, [account(number="00042")], 20)
        self.assertEqual(plan, [])
        self.assertEqual(counts["blocked_not_missing_leading_zeros"], 1)

    def test_nonzero_digit_changes_are_blocked(self):
        for current in ("43", None, "A42", " 42"):
            with self.subTest(current=current):
                plan, counts = repair.correction_plan({"A" * 18: "00042"}, [account(number=current)], 20)
                self.assertEqual(plan, [])
                self.assertEqual(counts["blocked_nonzero_digit_difference"], 1)

    def test_collisions_duplicate_source_and_missing_etag_block_updates(self):
        base = account()
        other = account("B" * 18, "00042", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
        for records, reason in [
                ([base, other], "blocked_number_collision"),
                ([base, base], "blocked_duplicate_source_identity"),
                ([{key: value for key, value in base.items() if key != "@odata.etag"}], "blocked_missing_etag")]:
            with self.subTest(reason=reason):
                plan, counts = repair.correction_plan({"A" * 18: "00042"}, records, 20)
                self.assertEqual(plan, [])
                self.assertEqual(counts[reason], 1)

    def test_duplicate_desired_numbers_and_overlength_values_are_blocked(self):
        plan, counts = repair.correction_plan({"A" * 18: "00042", "B" * 18: "00042"}, [account()], 20)
        self.assertEqual(plan, [])
        self.assertEqual(counts["blocked_number_collision"], 1)
        plan, counts = repair.correction_plan({"A" * 18: "00042"}, [account()], 4)
        self.assertEqual(plan, [])
        self.assertEqual(counts["blocked_length"], 1)

    def test_patch_is_etag_guarded_column_only_and_readback_verified(self):
        class Api:
            def __init__(self):
                self.calls = []

            def find(self, *args):
                return []

            def request(self, method, endpoint, payload=None, concurrency=None):
                self.calls.append((method, payload, concurrency))
                return account(number="00042")

        api = Api()
        repair.apply_correction(api, "A" * 18, "00042", account())
        self.assertEqual(api.calls[0], ("PATCH", {"accountnumber": "00042"}, {"If-Match": 'W/"1"'}))
        self.assertEqual(api.calls[1][0], "GET")

    def test_wrong_readback_is_an_explicit_failure(self):
        class Api:
            def find(self, *args):
                return []

            def request(self, *args, **kwargs):
                return account(number="42")

        with self.assertRaisesRegex(RuntimeError, "readback failed"):
            repair.apply_correction(Api(), "A" * 18, "00042", account())

    def test_new_collision_prevents_a_write(self):
        class Api:
            def find(self, *args):
                return [{"accountid": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}]

            def request(self, *args, **kwargs):
                raise AssertionError("A collision must prevent writes")

        with self.assertRaisesRegex(RuntimeError, "collision appeared"):
            repair.apply_correction(Api(), "A" * 18, "00042", account())

    def test_batch_contains_only_number_update_with_individual_etag(self):
        _, body = repair.batch_body([("A" * 18, "00042", account())])
        self.assertIn(b'If-Match: W/"1"', body)
        self.assertIn(b'{"accountnumber": "00042"}', body)
        self.assertNotIn(b'"re_salesforceaccountid"', body)
        self.assertEqual(body.count(b"PATCH "), 1)

    def test_batch_response_must_verify_each_individual_status(self):
        content_type = "multipart/mixed; boundary=response"
        def response(status):
            return (b"--response\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 "
                    + status + b"\r\n\r\n\r\n--response--\r\n")
        repair.verify_batch_response(content_type, response(b"204 No Content"), 1)
        for body, count in [(response(b"412 Precondition Failed"), 1),
                            (response(b"204 No Content"), 2), (b"{}", 1)]:
            with self.subTest(count=count, body=body):
                with self.assertRaisesRegex(RuntimeError, "not fully successful"):
                    repair.verify_batch_response(content_type, body, count)

    def test_batch_readback_verifies_identity_and_exact_number(self):
        class Api:
            api = SimpleNamespace(headers={})
            def __init__(self, number):
                self.number = number
                self.queries = 0

            def refresh(self):
                pass

            def query(self, *args):
                self.queries += 1
                return [] if self.queries == 1 else [account(number=self.number)]

        response = SimpleNamespace(
            headers={"Content-Type": "multipart/mixed; boundary=r"},
            read=lambda: b"--r\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 204 No Content\r\n\r\n\r\n--r--\r\n")
        with patch.object(repair.urllib.request, "urlopen") as send:
            send.return_value.__enter__.return_value = response
            repair.apply_batch(Api("00042"), [("A" * 18, "00042", account())])
            with self.assertRaisesRegex(RuntimeError, "readback failed"):
                repair.apply_batch(Api("42"), [("A" * 18, "00042", account())])


if __name__ == "__main__":
    unittest.main()
