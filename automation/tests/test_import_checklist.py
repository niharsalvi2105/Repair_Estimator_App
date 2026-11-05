import importlib.util
from pathlib import Path
import unittest


spec = importlib.util.spec_from_file_location(
    "checklist", Path(__file__).parents[1] / "customer-import-checklist.py")
checklist = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checklist)


class ChecklistTests(unittest.TestCase):
    def report(self, states, status="applying"):
        return {"status": status, "datasets": {
            "accounts": {"candidate_states": states, "rejected_count": 4},
            "contacts": {"candidate_states": {"pending": 381724}, "rejected_count": 4387},
        }}

    def test_pending_and_inflight_are_not_completed(self):
        text = checklist.render(self.report(
            {"verified": 22511, "inflight": 1000, "pending": 417694}))
        self.assertNotIn("Accounts - validated candidates | [x]", text)
        self.assertIn("1,000 unverified", text)

    def test_verified_candidates_complete_but_rejects_remain_unfinished(self):
        text = checklist.render(self.report({"verified": 441205}))
        self.assertIn("Accounts - validated candidates | [x]", text)
        self.assertIn("Accounts - source rejects | [ ]", text)
        self.assertIn("Equipment Master | [ ]", text)

    def test_unaccounted_rows_fail_explicitly(self):
        with self.assertRaisesRegex(ValueError, "accounting mismatch"):
            checklist.render(self.report({"verified": 1}))

    def test_error_status_is_not_running_or_completed(self):
        text = checklist.render(self.report({"pending": 441205}, "failed_or_unverified"))
        self.assertIn("Stopped / reconciliation required", text)

    def test_contacts_are_queued_not_active_before_their_first_batch(self):
        text = checklist.render(self.report({"pending": 441205}))
        self.assertIn("Contacts - validated candidates | [ ] Queued after Accounts", text)

    def test_equipment_preparation_is_not_import_completion(self):
        equipment = {"source_rows": 428400, "candidate_states": {"pending": 428396, "rejected": 4},
                     "schema_deployed": False}
        text = checklist.render(self.report({"pending": 441205}), equipment)
        self.assertIn("Equipment Master | [ ] Incomplete", text)
        self.assertIn("Equipment full-source staging | [x]", text)
        self.assertIn("Equipment raw metadata / KOL schema | [ ]", text)

    def test_equipment_report_must_account_for_all_source_rows(self):
        with self.assertRaisesRegex(ValueError, "Equipment source accounting"):
            checklist.render(self.report({"pending": 441205}), {
                "source_rows": 428400, "candidate_states": {"verified": 1}, "schema_deployed": True})

    def test_verified_dev_sample_does_not_complete_full_import_or_acceptance(self):
        text = checklist.render(self.report({"pending": 441205}))
        self.assertIn("CAD reference package sample | [x]", text)
        self.assertIn("Real source-linked draft Save / calculation | [x]", text)
        self.assertIn("Non-admin app acceptance / external export rendering | [ ]", text)
        self.assertIn("MKO / CKE / CKQ calculator reference and pricing configuration | [ ]", text)
        self.assertNotIn("Accounts - validated candidates | [x]", text)


if __name__ == "__main__":
    unittest.main()
