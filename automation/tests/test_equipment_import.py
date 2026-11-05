import importlib.util
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "equipment_import", Path(__file__).parents[1] / "import-equipment-master.py")
equipment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(equipment)


class EquipmentImportTests(unittest.TestCase):
    def test_text_limits_never_truncate(self):
        attribute = {"LogicalName": "re_accountname", "AttributeType": "String", "MaxLength": 3}
        with self.assertRaisesRegex(equipment.customer.Rejected, "field_length_exceeded"):
            equipment.scalar(("text", "four"), attribute)

    def test_dates_require_exact_date_only_semantics(self):
        attribute = {"LogicalName": "re_contractstartdate", "AttributeType": "DateTime",
                     "DateTimeBehavior": {"Value": "DateOnly"}}
        self.assertEqual(equipment.scalar(("text", "2026-11-05"), attribute), "2026-11-05")
        with self.assertRaises(equipment.customer.Rejected):
            equipment.scalar(("n", "45000"), attribute)
        attribute["DateTimeBehavior"]["Value"] = "UserLocal"
        with self.assertRaisesRegex(equipment.customer.Rejected, "timezone_contract"):
            equipment.scalar(("text", "2026-11-05"), attribute)

    def test_numeric_precision_loss_is_rejected(self):
        attribute = {"LogicalName": "re_latitude", "AttributeType": "Decimal",
                     "MinValue": -90, "MaxValue": 90, "Precision": 8}
        with self.assertRaisesRegex(equipment.customer.Rejected, "precision_exceeded"):
            equipment.scalar(("n", "1.123456789"), attribute)

    def test_full_raw_values_preserved_without_cross_table_overwrite(self):
        headers = ["Name", "Account.Id", "Account.Type"]
        mapping = {"columns": [
            {"position": 1, "table": "re_equipment", "field": "re_equipment"},
            {"position": 2, "table": "re_equipment", "field": "re_customeraccount"},
            {"position": 3, "table": "account", "field": "re_sourceaccountclassification"}]}
        attribute = {"LogicalName": "re_equipment", "AttributeType": "String",
                     "MaxLength": 850, "IsValidForCreate": True, "IsValidForUpdate": True}
        key, parent, payload = equipment.payload_for_row(
            headers, {0: ("text", "00042"), 1: ("text", "A" * 18),
                      2: ("text", "Synthetic source classification")},
            mapping, {"re_equipment": attribute})
        self.assertEqual(key, "00042")
        self.assertEqual(parent, "A" * 18)
        self.assertNotIn("re_sourceaccountclassification", payload)
        raw = json.loads(payload[equipment.RAW_FIELD])
        self.assertEqual(raw["Account.Type"]["value"], "Synthetic source classification")
        self.assertEqual(len(raw), 3)

    def test_errors_in_unmapped_columns_reject_row(self):
        with self.assertRaisesRegex(equipment.customer.Rejected, "source_error"):
            equipment.payload_for_row(["marker"], {0: ("e", "#N/A")}, {"columns": []}, {})

    def test_blank_boolean_is_not_false(self):
        self.assertIsNone(equipment.scalar(("text", None), {"AttributeType": "Boolean"}))

    def test_date_normalization_does_not_guess_non_midnight(self):
        record = {"start": "2026-11-05T00:00:00Z", "end": "2026-11-05T01:00:00Z"}
        attributes = {field: {"AttributeType": "DateTime"} for field in record}
        equipment.normalize_dates(record, record, attributes)
        self.assertEqual(record["start"], "2026-11-05")
        self.assertEqual(record["end"], "2026-11-05T01:00:00Z")

    def test_existing_exact_records_keep_guid_and_required_context(self):
        with tempfile.TemporaryDirectory() as directory:
            parent_path = Path(directory) / "parents.sqlite"
            with closing(sqlite3.connect(parent_path)) as db:
                db.execute("CREATE TABLE source(dataset,status,native_id,source_id)")
                db.commit()
            db = sqlite3.connect(":memory:")
            db.row_factory = sqlite3.Row
            db.executescript(
                "CREATE TABLE metadata(name,value); INSERT INTO metadata VALUES ('schema_deployed','true');"
                "CREATE TABLE equipment(row_number,source_key,parent,payload,status,reason,native_id);")
            payload = {"re_equipment": "00042", equipment.RAW_FIELD: "{}"}
            db.execute("INSERT INTO equipment VALUES (1,'00042',NULL,?,'pending',NULL,NULL)",
                       (json.dumps(payload),))
            record = dict(payload, re_equipmentid="original-guid",
                          _re_branch_value="original-branch", re_functionallocation="original-location",
                          _re_customeraccount_value=None)
            api = SimpleNamespace(send=lambda *args: self.fail("Exact row should not be written"))
            with patch.object(equipment, "existing_batch", return_value={"00042": record}), patch.object(
                    equipment, "constraints", return_value={}):
                equipment.apply_existing(db, SimpleNamespace(batch_size=1, customer_state=parent_path), api)
            row = db.execute("SELECT status,native_id FROM equipment").fetchone()
            self.assertEqual(tuple(row), ("verified", "original-guid"))
            db.close()

    def test_missing_existing_record_is_deferred_not_created(self):
        with tempfile.TemporaryDirectory() as directory:
            parent_path = Path(directory) / "parents.sqlite"
            with closing(sqlite3.connect(parent_path)):
                pass
            db = sqlite3.connect(":memory:")
            db.row_factory = sqlite3.Row
            db.executescript(
                "CREATE TABLE metadata(name,value); INSERT INTO metadata VALUES ('schema_deployed','true');"
                "CREATE TABLE equipment(row_number,source_key,parent,payload,status,reason,native_id);"
                "INSERT INTO equipment VALUES (1,'00042',NULL,'{\"re_equipment\":\"00042\"}',"
                "'pending',NULL,NULL);")
            api = SimpleNamespace(send=lambda *args: self.fail("Must not invent branch or create"))
            with patch.object(equipment, "existing_batch", return_value={}), patch.object(
                    equipment, "constraints", return_value={}):
                equipment.apply_existing(db, SimpleNamespace(batch_size=1, customer_state=parent_path), api)
            self.assertEqual(db.execute("SELECT status FROM equipment").fetchone()[0], "deferred_create")
            db.close()

    def test_preparation_inserts_private_row_before_count_guard(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "equipment.xlsx"
            mapping_path = Path(directory) / "mapping.json"
            headers = ["Name", "Account.Id"] + ["column-" + str(index) for index in range(58)]
            mapping = {"source": source.name, "columns_accounted": 60,
                       "worksheet_rows_excluding_header": 428400,
                       "columns": [{"header": header, "position": index + 1, "table": None,
                                    "field": None} for index, header in enumerate(headers)]}
            mapping_path.write_text(json.dumps(mapping), encoding="utf-8")
            db = sqlite3.connect(":memory:")
            args = SimpleNamespace(source=source, mapping=mapping_path)
            with patch.object(equipment.bulk, "fingerprint", return_value="synthetic-hash"), patch.object(
                    equipment, "constraints", return_value={}), patch.object(
                    equipment.bulk, "stream_rows",
                    return_value=iter([(1, {index: ("text", header) for index, header in enumerate(headers)}),
                                      (2, {0: ("text", "00042")})])), patch.object(
                    equipment, "payload_for_row", return_value=("00042", None, {"re_equipment": "00042"})):
                with self.assertRaisesRegex(RuntimeError, "source count"):
                    equipment.prepare(db, args, None)
            row = db.execute("SELECT source_key,status FROM equipment").fetchone()
            self.assertEqual(row, ("00042", "pending"))
            self.assertFalse(db.execute("SELECT 1 FROM metadata WHERE name='prepared'").fetchone())
            db.close()


if __name__ == "__main__":
    unittest.main()
