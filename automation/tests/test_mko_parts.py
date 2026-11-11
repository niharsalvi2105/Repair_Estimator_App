import importlib.util
import json
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location(
    "mko_parts", Path(__file__).resolve().parents[1] / "import-mko-parts.py")
mko = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mko)


def cells():
    values = ["ZR00", "MKOM", "01", "0000123", "Synthetic material", "46023", "46387",
              "28.8412345", "USD", "1", "PC", "4.4912345", "USD", "0000765",
              "40.37772830000001", "CAD", "6.287728300000001", "CAD"]
    return {i: ("n" if i in (5, 6, 7, 9, 11, 14, 16) else "text", value)
            for i, value in enumerate(values)}


class MkoPartTests(unittest.TestCase):
    def test_part_type_uses_case_insensitive_km_prefix_without_changing_identifiers(self):
        for part, expected in [("KM001", 126110000), ("km001", 126110000),
                               ("Km001", 126110000), ("KM", 126110000),
                               ("0000123", 126110001), ("AKM001", 126110001),
                               ("K001", 126110001), (" KM001", 126110001)]:
            with self.subTest(part=part):
                source = cells()
                source[3] = ("text", part)
                result = mko.map_part(source, 2, "approved.xlsx", "digest", "2026-11-06T00:00:00Z")
                self.assertEqual(result["re_parttype"], expected)
                self.assertEqual(result["re_partnumber"], part)
                self.assertEqual(result["re_sourcekey"], "Material:ZR00:MKOM:01:" + part)

    def test_rounding_preserves_all_18_positional_originals(self):
        source = cells()
        result = mko.map_part(source, 2, "approved.xlsx", "a" * 64, "2026-11-06T00:00:00Z")
        self.assertEqual(result["re_usdcost"], 4.491235)
        self.assertEqual(result["re_usdprice"], 28.841235)
        self.assertEqual(result["re_sourcekey"], "Material:ZR00:MKOM:01:0000123")
        self.assertEqual(result["re_conditionrecord"], "0000765")
        self.assertEqual(result["statecode"], 0)
        raw = json.loads(result[mko.RAW])
        self.assertEqual(len(raw["columns"]), 18)
        self.assertEqual(raw["columns"][16]["value"], source[16][1])
        self.assertEqual(raw["columns"][11]["value"], "4.4912345")
        self.assertEqual(raw["columns"][8]["header"], raw["columns"][12]["header"])

    def test_zero_prices_and_costs_are_preserved_but_not_catalog_eligible(self):
        for index in (7, 11):
            source = cells()
            source[index] = ("n", "0")
            result = mko.map_part(source, 2, "approved.xlsx", "digest", "2026-11-06T00:00:00Z")
            self.assertEqual(result["statecode"], 1)
            self.assertEqual(result["re_usdprice" if index == 7 else "re_usdcost"], 0)

    def test_nonunit_basis_is_not_silently_normalized(self):
        source = cells()
        source[9] = ("n", "10")
        result = mko.map_part(source, 2, "approved.xlsx", "digest", "2026-11-06T00:00:00Z")
        self.assertEqual(result["statecode"], 1)
        self.assertEqual(result["re_pricingunit"], 10)

    def test_invalid_cached_cost_currency_identifier_and_date_fail(self):
        for index, value in [(11, ("e", "#N/A")), (8, ("text", "CAD")),
                             (3, ("text", "ambiguous:part")), (5, ("n", "46023.5")),
                             (7, ("n", "-1")), (7, ("n", "NaN"))]:
            with self.subTest(index=index, value=value):
                source = cells()
                source[index] = value
                with self.assertRaises(ValueError):
                    mko.map_part(source, 2, "approved.xlsx", "digest", "2026-11-06T00:00:00Z")

    def test_readback_preserves_precision_and_rejects_changed_values(self):
        expected = mko.map_part(cells(), 2, "approved.xlsx", "digest", "2026-11-06T00:00:00Z")
        actual = dict(expected)
        actual["re_effectivefrom"] += "T00:00:00Z"
        self.assertEqual(mko.differences(expected, actual), [])
        actual["re_usdcost"] += .000001
        self.assertEqual(mko.differences(expected, actual), ["re_usdcost"])


if __name__ == "__main__":
    unittest.main()
