import importlib.util
import json
from pathlib import Path
import tempfile
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

    def test_measured_customer_checkpoint_is_not_labelled_paused(self):
        text = checklist.render(self.report({"pending": 441205}, "measuring_verified_batches"))
        self.assertIn("Accounts - validated candidates | [ ] In progress (last verified checkpoint)", text)
        self.assertIn("not a process-health check", text)

    def test_invalid_or_unknown_states_cannot_fake_completion(self):
        for states in ({"verified": 441206, "pending": -1},
                       {"verified": 441204, "unknown": 1},
                       {"verified": 441204, "pending": True}):
            with self.subTest(states=states), self.assertRaisesRegex(ValueError, "accounting mismatch"):
                checklist.render(self.report(states))

    def test_mko_equipment_is_separate_from_historical_full_source_checkpoint(self):
        equipment = {"source_rows": 428400, "candidate_states": {
            "verified": 474, "pending": 427926}, "schema_deployed": True}
        mko = {"source_rows": 368994, "states": {
            "verified": 6159, "conflict": 3341, "deferred": 65821,
            "pending": 293669, "rejected": 4}}
        text = checklist.render(self.report({"pending": 441205}), equipment, mko_equipment_report=mko)
        self.assertIn("474 / 428,400", text)
        self.assertIn("6,159 / 368,994", text)
        self.assertIn("conflict: 3,341", text)
        self.assertIn("must never be added together", text)
        self.assertNotIn("6,633", text)
        self.assertNotIn("MKO Equipment - current approved mapping | [x]", text)

    def test_parts_existing_and_inflight_do_not_count_as_verified(self):
        parts = {"source_rows": 37473, "states": {
            "verified": 19000, "existing": 10635, "pending": 7326, "inflight": 500, "rejected": 12}}
        text = checklist.render(self.report({"pending": 441205}), parts_report=parts)
        self.assertIn("19,000 / 37,461", text)
        self.assertIn("existing: 10,635", text)
        self.assertIn("inflight: 500", text)
        self.assertIn("Spare Parts - source rejects | [ ]", text)
        self.assertNotIn("Spare Parts - validated candidates | [x]", text)
        parts["states"] = {"verified": 37461, "rejected": 12}
        text = checklist.render(self.report({"pending": 441205}), parts_report=parts)
        self.assertIn("Spare Parts - validated candidates | [x]", text)
        self.assertIn("Spare Parts - source rejects | [ ]", text)

    def test_incomplete_mko_reports_fail_accounting(self):
        for key, value in (("mko_equipment_report", {"source_rows": 368994, "states": {"verified": 1}}),
                           ("parts_report", {"source_rows": 37473, "states": {"verified": 1}})):
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "accounting mismatch"):
                checklist.render(self.report({"pending": 441205}), **{key: value})

    def test_packages_require_preservation_evidence_not_just_counts(self):
        mko = {"status": "completed", "source_packages": 280, "verified": 280}
        cad = {"status": "completed", "distinct_cad_packages": 280, "verified": 280}
        report = self.report({"pending": 441205})
        text = checklist.render(report, mko_package_report=mko, cad_package_report=cad)
        self.assertNotIn("MKO / USD packages | [x]", text)
        self.assertNotIn("CAD packages - full source reconciliation | [x]", text)
        mko.update(financial_writes=False, all_guids_preserved=True,
                   financial_fields_unchanged=True, non_usd_packages_unchanged=True)
        cad.update(business_estimate_writes=False, usd_unchanged=True,
                   original_cad_sample_guids_preserved=True)
        text = checklist.render(report, mko_package_report=mko, cad_package_report=cad)
        self.assertIn("MKO / USD packages | [x]", text)
        self.assertIn("CAD packages - full source reconciliation | [x]", text)
        self.assertIn("Dataflow pilot / handover | [ ]", text)
        self.assertIn("Employee source | [ ]", text)
        self.assertIn("Non-admin app acceptance / external export rendering | [ ]", text)

    def test_labor_amount_agreement_is_not_full_contract_completion(self):
        labor = {"counts": {"source_branch_rows": 223, "source_branch_sections": 446,
                 "matching_current_amounts": 1197, "different_current_amounts": 111,
                 "differences_equal_after_cent_rounding": 111, "differences_remaining_at_cent_precision": 0,
                 "unmatched_sfdc": 10, "ambiguous_exact_context": 0, "missing_current_rates": 0,
                 "ambiguous_current_rates": 0, "invalid_source_amounts": 0}}
        text = checklist.render(self.report({"pending": 441205}), labor_report=labor)
        self.assertIn("1,308 / 1,338 amounts agree", text)
        self.assertIn("30 unresolved", text)
        self.assertIn("MKO labor rates - partial read-only comparison | [ ]", text)
        labor["counts"]["differences_equal_after_cent_rounding"] = 112
        with self.assertRaisesRegex(ValueError, "MKO labor source accounting"):
            checklist.render(self.report({"pending": 441205}), labor_report=labor)

    def test_writer_loads_latest_sibling_reports_and_preserves_input_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report = root / "customer-bulk-report.json"
            target = root / "dataverse-import-checklist.md"
            parts_path = root / "mko-parts-import-report.json"
            report.write_text(json.dumps(self.report({"pending": 441205})), encoding="utf-8")
            parts = {"source_rows": 37473, "states": {
                "verified": 19000, "existing": 10635, "pending": 7826, "rejected": 12}}
            parts_path.write_text(json.dumps(parts), encoding="utf-8")
            checklist.write_checklist(report, target)
            self.assertIn("19,000 / 37,461", target.read_text(encoding="utf-8"))
            parts["states"] = {"verified": 37461, "rejected": 12}
            parts_path.write_text(json.dumps(parts), encoding="utf-8")
            checklist.write_checklist(report, target)
            text = target.read_text(encoding="utf-8")
            self.assertIn("Spare Parts - validated candidates | [x]", text)
            self.assertIn("`mko-parts-import-report.json`:", text)
            self.assertEqual(list(root.glob("*.tmp")), [])
            original = parts_path.read_bytes()
            with self.assertRaisesRegex(ValueError, "must not overwrite"):
                checklist.write_checklist(report, parts_path)
            self.assertEqual(parts_path.read_bytes(), original)
            parts_path.write_text("{", encoding="utf-8")
            with self.assertRaises(json.JSONDecodeError):
                checklist.write_checklist(report, target)
            self.assertEqual(target.read_text(encoding="utf-8"), text)


if __name__ == "__main__":
    unittest.main()
