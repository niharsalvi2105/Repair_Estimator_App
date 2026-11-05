import importlib.util
from pathlib import Path
import tempfile
import unittest

import openpyxl


spec = importlib.util.spec_from_file_location(
    "remaining_preflight", Path(__file__).parents[1] / "preflight-remaining-masters.py")
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


class MetadataApi:
    def request(self, method, endpoint):
        if endpoint.startswith("EntityDefinitions?"):
            return {"value": [{"LogicalName": "re_equipment"}]}
        return {"value": [{"LogicalName": "re_equipment", "AttributeType": "String",
                           "IsValidForCreate": True, "IsValidForUpdate": True}]}


class RemainingPreflightTests(unittest.TestCase):
    def inspect(self, conflicting=False):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "Equipment Master v3Nov2026 1.xlsx"
            schema = Path(directory) / "schema.xlsx"
            book = openpyxl.Workbook()
            book.active.title = "Equipment Master"
            book.active.append(["_", "Name"])
            book.active.append(["synthetic source marker", "synthetic private value"])
            book.save(source)
            book.close()
            book = openpyxl.Workbook()
            book.active.title = "Source Mapping"
            book.active.append(["Source Mapping"])
            marker = [source.name, "Equipment Master", "A", "_", None, None, "marker", "retain"]
            book.active.append(marker)
            book.active.append(marker)
            book.active.append([source.name, "Equipment Master", "B", "Name",
                                "re_equipment", "re_equipment", "reuse", "validate"])
            if conflicting:
                book.active.append([source.name, "Equipment Master", "B", "Name",
                                    "re_equipment", "different_column", "reuse", "validate"])
            book.save(schema)
            book.close()
            return preflight.inspect_mapping(source, schema, MetadataApi())

    def test_identical_contract_duplicates_deduplicate_and_raw_values_are_not_reported(self):
        report = self.inspect()
        self.assertEqual(report["columns_accounted"], 2)
        self.assertEqual(report["mapping_status_counts"],
                         {"raw_preservation_required": 1, "typed_row_validation_required": 1})
        self.assertNotIn("synthetic private value", str(report))
        self.assertNotIn("synthetic source marker", str(report))

    def test_different_targets_for_exact_header_fail(self):
        with self.assertRaisesRegex(RuntimeError, "ambiguous exact Equipment"):
            self.inspect(conflicting=True)


if __name__ == "__main__":
    unittest.main()
