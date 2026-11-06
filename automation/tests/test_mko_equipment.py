import importlib.util
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "mko_equipment", Path(__file__).resolve().parents[1] / "import-mko-equipment.py")
mko = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mko)


class MkoEquipmentTests(unittest.TestCase):
    def fixture(self):
        names = [("Name", "re_equipment"), ("Sales_Organization__c", "re_salesorganization"),
                 ("Account.Id", "re_customeraccount"), ("Plant_Section__c", "re_plantsection"),
                 ("Location.Functional_Location_SAP_Number__c", None),
                 ("Geolocation__Latitude__s", "re_latitude"), ("Geolocation__Longitude__s", "re_longitude")]
        mapping = {"columns": [{"position": i + 1, "header": header,
                               "table": "re_equipment", "field": field}
                              for i, (header, field) in enumerate(names)]}
        attributes = {}
        for _, name in names:
            if name is None or name == "re_customeraccount":
                continue
            attributes[name] = {"LogicalName": name, "AttributeType": "String", "MaxLength": 100,
                                "IsValidForCreate": True, "IsValidForUpdate": True}
        for name, limit in [("re_latitude", 90), ("re_longitude", 180)]:
            attributes[name].update(AttributeType="Decimal", Precision=8, MinValue=-limit, MaxValue=limit)
        values = ["00042", "MKOF", "A" * 18, "001", "000123", "1.123456785", "-1.123456785"]
        cells = {str(i): ["n" if i >= 5 else "text", value] for i, value in enumerate(values)}
        return cells, mapping, attributes

    def test_round_coordinates_only_and_preserve_originals(self):
        cells, mapping, attrs = self.fixture()
        key, parent, payload, location = mko.build_payload(cells, mapping, attrs)
        self.assertEqual(key, "00042")
        self.assertEqual(parent, "A" * 18)
        self.assertEqual(location, "000123")
        self.assertEqual(payload["re_latitude"], 1.12345679)
        self.assertEqual(payload["re_longitude"], -1.12345679)
        raw = json.loads(payload[mko.equipment.RAW_FIELD])
        self.assertEqual(raw["Geolocation__Latitude__s"]["value"], "1.123456785")
        self.assertEqual(raw["Geolocation__Longitude__s"]["value"], "-1.123456785")

    def test_out_of_range_is_rejected_before_rounding(self):
        cells, mapping, attrs = self.fixture()
        cells["5"] = ["n", "90.000000001"]
        with self.assertRaisesRegex(mko.bulk.customer.Rejected, "coordinate_out_of_range"):
            mko.build_payload(cells, mapping, attrs)

    def test_existing_prepared_header_keyed_raw_storage_is_supported(self):
        cells, mapping, attrs = self.fixture()
        raw = {c["header"]: cells[str(c["position"] - 1)] for c in mapping["columns"]}
        self.assertEqual(mko.build_payload(raw, mapping, attrs), mko.build_payload(cells, mapping, attrs))

    def test_branch_index_is_exact_mko_only_and_rejects_ambiguity(self):
        branches = [{"re_market": 126110000, "statecode": 0, "re_branchnumber": "001", "re_branchid": "mko"},
                    {"re_market": 126110001, "statecode": 0, "re_branchnumber": "001", "re_branchid": "cad"}]
        self.assertEqual(mko.branch_index(branches), {"001": "mko"})
        self.assertNotIn("1", mko.branch_index(branches))
        with self.assertRaisesRegex(RuntimeError, "Ambiguous"):
            mko.branch_index(branches + [branches[0]])

    def test_relationship_and_all_field_readback_are_required(self):
        cells, mapping, attrs = self.fixture()
        _, _, payload, _ = mko.build_payload(cells, mapping, attrs)
        record = dict(payload, _re_branch_value="branch", _re_customeraccount_value="account")
        self.assertTrue(mko.matches(payload, record, "branch", "account", attrs))
        self.assertFalse(mko.matches(payload, record, "wrong", "account", attrs))
        record["re_equipment"] = "42"
        self.assertFalse(mko.matches(payload, record, "branch", "account", attrs))

    def test_preparation_accounts_for_header_keyed_mko_source_and_duplicates(self):
        cells, mapping, attrs = self.fixture()
        attrs["re_functionallocation"] = {"MaxLength": 100}
        raw = {c["header"]: cells[str(c["position"] - 1)] for c in mapping["columns"]}
        for duplicate in (False, True):
            with self.subTest(duplicate=duplicate), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "mapping.json"
                path.write_text(json.dumps(mapping))
                with closing(sqlite3.connect(":memory:")) as source, closing(sqlite3.connect(":memory:")) as db:
                    source.row_factory = sqlite3.Row
                    source.executescript("CREATE TABLE metadata(name,value);"
                        "INSERT INTO metadata VALUES ('source','source-sha');"
                        "INSERT INTO metadata VALUES ('schema_deployed','true');"
                        "CREATE TABLE equipment(row_number,raw_cells);")
                    source.execute("INSERT INTO equipment VALUES (2,?)", (json.dumps(raw),))
                    if duplicate:
                        source.execute("INSERT INTO equipment VALUES (3,?)", (json.dumps(raw),))
                    mko.prepare(db, source, mapping, attrs, {"001": "branch"}, SimpleNamespace(mapping=path))
                    rows = db.execute("SELECT status,count(*) FROM work GROUP BY status").fetchall()
                    self.assertEqual(rows, [("rejected", 2)] if duplicate else [("pending", 1)])

    def test_native_conflict_is_deferred_while_safe_new_equipment_is_verified(self):
        cells, mapping, attrs = self.fixture()
        attrs["re_functionallocation"] = {"MaxLength": 100}
        raw = {c["header"]: cells[str(c["position"] - 1)] for c in mapping["columns"]}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            args = SimpleNamespace(source_state=root / "source.sqlite", customer_state=root / "parents.sqlite",
                mapping=root / "mapping.json", state=root / "work.sqlite", report=root / "report.json",
                apply=True, max_batches=1)
            args.mapping.write_text(json.dumps(mapping))
            with closing(sqlite3.connect(args.source_state)) as source:
                source.executescript("CREATE TABLE metadata(name,value);"
                    "INSERT INTO metadata VALUES ('source','source-sha');"
                    "INSERT INTO metadata VALUES ('schema_deployed','true');"
                    "CREATE TABLE equipment(row_number,raw_cells);")
                source.execute("INSERT INTO equipment VALUES (2,?)", (json.dumps(raw),))
                raw["Name"] = ["text", "00043"]
                source.execute("INSERT INTO equipment VALUES (3,?)", (json.dumps(raw),))
                source.commit()
            with closing(sqlite3.connect(args.customer_state)) as parents:
                parents.execute("CREATE TABLE source(dataset,source_id,status,native_id)")
                parents.execute("INSERT INTO source VALUES ('accounts',?,'verified','account')", ("A" * 18,))
                parents.commit()
            existing = {"00042": {"re_equipment": "00042", "re_equipmentid": "preserved-id"}}
            creates = []

            def send(spec, operation, targets):
                self.assertEqual(operation, "CreateMultiple")
                for target in targets:
                    self.assertEqual(target["re_equipment"], "00043")
                    creates.append(target)
                    existing[target["re_equipment"]] = dict(target,
                        _re_branch_value="branch", _re_customeraccount_value="account")

            api = SimpleNamespace(
                find=lambda *a: [{"solutionid": "05dd7469-373e-46ad-acd4-856e50ac3777"}],
                query=lambda *a: [{"re_market": 126110000, "statecode": 0,
                                  "re_branchnumber": "001", "re_branchid": "branch"}],
                request=lambda *a: {"value": [
                    {"ReferencingAttribute": "re_branch", "ReferencingEntityNavigationPropertyName": "re_Branch"},
                    {"ReferencingAttribute": "re_customeraccount", "ReferencingEntityNavigationPropertyName": "re_customeraccount"}]},
                send=send)
            with patch.object(mko.apply, "CreateUpdateApi", return_value=api), \
                    patch.object(mko.equipment, "constraints", return_value=attrs), \
                    patch.object(mko, "fetch", side_effect=lambda api, keys: {
                        key: existing[key] for key in keys if key in existing}):
                mko.run(args)
            self.assertEqual(len(creates), 1)
            with closing(sqlite3.connect(args.state)) as db:
                self.assertEqual(db.execute("SELECT source_key,status FROM work ORDER BY row_number").fetchall(),
                                 [("00042", "conflict"), ("00043", "verified")])
            self.assertEqual(existing["00042"]["re_equipmentid"], "preserved-id")


if __name__ == "__main__":
    unittest.main()
