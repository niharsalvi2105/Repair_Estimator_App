import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

SPEC = importlib.util.spec_from_file_location(
    "master_import", Path(__file__).parents[1] / "import-account-contact-masters.py")
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def account_row():
    spec = module.SPECS["accounts"]
    row = {name: ("text", None) for name in [*spec["fields"], *spec["extras"], *spec["raw_fields"]]}
    row.update(Id=("text", "A" * 18), Name=("text", "Synthetic account"),
               AccountNumber=("text", "000123"), Active_KONE_Customer__c=("b", "1"))
    return row


class FakeApi:
    def __init__(self, existing=None, collision=False):
        self.existing = existing
        self.collision = collision
        self.writes = []

    def find(self, entity_set, fields, field, value):
        if field == "accountnumber" and self.collision:
            return [{"re_salesforceaccountid": None, "accountid": "native"}]
        return [self.existing] if self.existing else []

    def request(self, method, endpoint, payload=None, concurrency=None):
        self.writes.append((method, endpoint, payload, concurrency))
        self.existing = dict(payload, accountid="synthetic", **{"@odata.etag": 'W/"1"'})
        return {}


class FakeContactApi:
    def __init__(self, email_records=()):
        self.email_records = list(email_records)

    def find(self, entity_set, fields, field, value):
        if field == "re_salesforceaccountid":
            return [{"accountid": "parent"}]
        if field == "emailaddress1":
            return self.email_records
        return []

    def request(self, method, endpoint, payload=None, concurrency=None):
        raise AssertionError("A dry-run must not write or read a contact parent")


class MasterImportTests(unittest.TestCase):
    def setUp(self):
        self.spec = module.SPECS["accounts"]
        self.lengths = {name: 1000 for name in self.spec["fields"].values()}
        self.lengths[self.spec["raw_metadata_field"]] = 2000
        self.row = account_row()
        self.payload = module.build_payload(self.spec, self.row, self.lengths)

    def test_numeric_storage_is_not_padded_or_rounded(self):
        self.assertEqual(module.text(("text", "000123")), "000123")
        self.assertEqual(module.text(("n", "123")), "123")
        for value in ("123.0", "1.23E+12", "-1"):
            with self.assertRaises(module.Rejected):
                module.text(("n", value))

    def test_errors_and_missing_formula_cache_are_rejected(self):
        for typ in ("e", "uncached_formula"):
            with self.assertRaises(module.Rejected):
                module.text((typ, None))
            with self.assertRaises(module.Rejected):
                module.boolean((typ, None))

    def test_boolean_null_stays_distinct_from_false(self):
        self.assertIsNone(module.boolean(("text", None)))
        self.assertFalse(module.boolean(("b", "0")))
        self.assertTrue(module.boolean(("text", "TRUE")))

    def test_source_id_requires_original_18_character_text(self):
        with self.assertRaises(module.Rejected):
            module.source_id(("n", "1" * 18))
        with self.assertRaises(module.Rejected):
            module.source_id(("text", "A" * 15))

    def test_no_truncation_and_utf16_length_is_checked(self):
        self.lengths["name"] = 1
        self.row["Name"] = ("text", "\U0001f600")
        with self.assertRaisesRegex(module.Rejected, "field_length_exceeded:name"):
            module.build_payload(self.spec, self.row, self.lengths)

    def test_contact_name_is_preserved_without_splitting(self):
        spec = module.SPECS["contacts"]
        row = {name: ("text", None) for name in [*spec["fields"], *spec["extras"], *spec["raw_fields"]]}
        row.update(Id=("text", "C" * 18), Name=("text", "Synthetic Full Name"),
                   **{"Account.Id": ("text", "A" * 18)})
        lengths = {name: 1000 for name in list(spec["fields"].values()) + ["lastname"]}
        lengths[spec["raw_metadata_field"]] = 2000
        payload = module.build_payload(spec, row, lengths)
        self.assertIsNone(payload["firstname"])
        self.assertEqual(payload["lastname"], "Synthetic Full Name")
        self.assertEqual(payload["lastname"], payload["re_salesforcename"])

    def test_dry_run_never_writes(self):
        api = FakeApi()
        self.assertEqual(module.reconcile(api, self.spec, self.row, self.payload, False), "would_create")
        self.assertEqual(api.writes, [])

    def test_existing_native_number_is_not_matched_or_overwritten(self):
        api = FakeApi(collision=True)
        with self.assertRaisesRegex(module.Rejected, "native_account_number_collision"):
            module.reconcile(api, self.spec, self.row, self.payload, True)
        self.assertEqual(api.writes, [])

    def test_distinct_source_contacts_may_share_email(self):
        spec = module.SPECS["contacts"]
        row = {name: ("text", None) for name in [*spec["fields"], *spec["extras"], *spec["raw_fields"]]}
        row.update(Id=("text", "C" * 18), Name=("text", "Synthetic Contact"),
                   Email=("text", "shared@example.com"), **{"Account.Id": ("text", "A" * 18)})
        lengths = {name: 1000 for name in spec["fields"].values()}
        lengths.update(lastname=300, **{spec["raw_metadata_field"]: 2000})
        payload = module.build_payload(spec, row, lengths)
        api = FakeContactApi([{"contactid": "other", "re_salesforcecontactid": "D" * 18}])
        self.assertEqual(module.reconcile(api, spec, row, payload, False), "would_create")

    def test_native_contact_email_collision_is_rejected(self):
        spec = module.SPECS["contacts"]
        row = {name: ("text", None) for name in [*spec["fields"], *spec["extras"], *spec["raw_fields"]]}
        row.update(Id=("text", "C" * 18), Name=("text", "Synthetic Contact"),
                   Email=("text", "native@example.com"), **{"Account.Id": ("text", "A" * 18)})
        lengths = {name: 1000 for name in spec["fields"].values()}
        lengths.update(lastname=300, **{spec["raw_metadata_field"]: 2000})
        payload = module.build_payload(spec, row, lengths)
        api = FakeContactApi([{"contactid": "native", "re_salesforcecontactid": None}])
        with self.assertRaisesRegex(module.Rejected, "native_contact_email_collision"):
            module.reconcile(api, spec, row, payload, False)

    def test_create_is_verified_and_second_run_is_unchanged(self):
        api = FakeApi()
        self.assertEqual(module.reconcile(api, self.spec, self.row, self.payload, True), "created")
        self.assertEqual(api.writes[0][:2], ("POST", "accounts"))
        self.assertEqual(module.reconcile(api, self.spec, self.row, self.payload, True), "unchanged")
        self.assertEqual(len(api.writes), 1)

    def test_source_export_columns_are_preserved_as_json(self):
        self.row["_"] = ("text", "[]")
        self.row["Owner"] = ("text", '[{"Name":"Owner"}]')
        payload = module.build_payload(self.spec, self.row, self.lengths)
        self.assertEqual(json.loads(payload["re_sourceexportmetadata"]), {"_": "[]", "Owner": '[{"Name":"Owner"}]'})

    def test_unmapped_source_headers_are_reported_and_rejected(self):
        headers = [*self.spec["fields"], *self.spec["extras"], *self.spec["raw_fields"]]
        report = {}
        self.assertEqual(module.validate_source_headers(headers, self.spec, report), headers)
        self.assertEqual(report["unmapped_source_headers"], [])
        with self.assertRaisesRegex(RuntimeError, "Unmapped source headers"):
            module.validate_source_headers(headers + ["Unexpected"], self.spec, report)
        self.assertEqual(report["unmapped_source_headers"], ["Unexpected"])

    def test_update_requires_concurrency_token(self):
        existing = dict(self.payload, name="Old", accountid="synthetic")
        with self.assertRaisesRegex(RuntimeError, "Missing concurrency token"):
            module.reconcile(FakeApi(existing), self.spec, self.row, self.payload, True)

    def test_streaming_reader_preserves_headers_and_flags_uncached_formula(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic.xlsx"
            with zipfile.ZipFile(path, "w") as workbook:
                workbook.writestr("xl/workbook.xml",
                    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                    '<sheets><sheet name="Data" r:id="r1"/></sheets></workbook>')
                workbook.writestr("xl/_rels/workbook.xml.rels",
                    '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>')
                workbook.writestr("xl/worksheets/sheet1.xml",
                    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                    '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Id</t></is></c></row>'
                    '<row r="2"><c r="A2"><f>1+1</f></c></row></sheetData></worksheet>')
            rows = list(module.source_rows(path, "Data"))
            self.assertEqual(rows[0][1][0], ("text", "Id"))
            self.assertEqual(rows[1][1][0][0], "uncached_formula")


if __name__ == "__main__":
    unittest.main()
