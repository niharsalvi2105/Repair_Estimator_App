import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).parents[1] / "apply-branch-equipment-mappings.py"
SPEC = importlib.util.spec_from_file_location("branch_equipment_mapping", MODULE_PATH)
mapping = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mapping)


def branch(branch_id, number, mapped=None):
    return {
        "re_branchid": branch_id,
        "re_branchnumber": number,
        "_re_mappedequipmentbranch_value": mapped,
        "statecode": 0,
    }


def planner(planner_id, subbranch, mainbranch=None):
    return {
        "re_plannergroupid": planner_id,
        "re_companycode": "CKE",
        "re_salesorganization": "CKE",
        "re_subbranchcode": subbranch,
        "_re_mainbranch_value": mainbranch,
        "statecode": 0,
    }


class BranchEquipmentMappingTests(unittest.TestCase):
    def test_exact_empty_relationships_are_planned_and_conflicts_are_preserved(self):
        branches = [
            {"re_branchnumber": "CKE 110", "re_parentbranch (Branch Number)": ""},
            {"re_branchnumber": "CKE 11A", "re_parentbranch (Branch Number)": "CKE 110"},
        ]
        planners = [{
            "re_companycode": "CKE",
            "re_salesorganization": "CKE",
            "re_sapcode": "11A",
            "re_primarybranch (Branch Number)": "CKE 110",
        }]
        equipment = [
            {
                "re_equipment": "EQ-1",
                "re_plannergroup (Company Code)": "CKE",
                "Source Sales Organization": "CKE",
                "re_plannergroup (Sub-Branch Code)": "11A",
                "re_mainbranch (Branch Number)": "CKE 110",
            },
            {
                "re_equipment": "EQ-2",
                "re_plannergroup (Company Code)": "CKE",
                "Source Sales Organization": "CKE",
                "re_plannergroup (Sub-Branch Code)": "11A",
                "re_mainbranch (Branch Number)": "CKE 110",
            },
            {
                "re_equipment": "EQ-3",
                "re_plannergroup (Company Code)": "",
                "Source Sales Organization": "",
                "re_plannergroup (Sub-Branch Code)": "",
                "re_mainbranch (Branch Number)": "",
            },
        ]
        branch_rows = [branch("b110", "CKE 110"), branch("b11a", "CKE 11A")]
        planner_rows = [planner("p11a", "11A", "b110")]
        equipment_rows = [
            {
                "re_equipment": "EQ-1",
                "re_equipmentid": "e1",
                "_re_branch_value": None,
                "_re_plannergroup_value": "p11a",
            },
            {
                "re_equipment": "EQ-2",
                "re_equipmentid": "e2",
                "_re_branch_value": "different-branch",
                "_re_plannergroup_value": "p11a",
            },
        ]

        updates, stats, _ = mapping.plan_updates(
            branches, planners, equipment, branch_rows, planner_rows, equipment_rows)

        self.assertEqual(len(updates["re_branchs"]), 1)
        self.assertEqual(len(updates["re_plannergroups"]), 0)
        self.assertEqual(len(updates["re_equipments"]), 1)
        self.assertEqual(updates["re_equipments"][0]["re_Branch@odata.bind"], "/re_branchs(b110)")
        self.assertEqual(stats["equipment"]["safe_blank_branch"], 1)
        self.assertEqual(stats["equipment"]["branch_conflict"], 1)
        self.assertEqual(stats["equipment"]["source_without_mapping"], 1)

    def test_unmatched_planner_identity_does_not_block_exact_branch_mapping(self):
        branches = [
            {"re_branchnumber": "MKO 1", "re_parentbranch (Branch Number)": ""},
        ]
        planners = [{
            "re_companycode": "MKO",
            "re_salesorganization": "MKO",
            "re_sapcode": "01A",
            "re_primarybranch (Branch Number)": "MKO 1",
        }]
        equipment = [{
            "re_equipment": "EQ-1",
            "re_plannergroup (Company Code)": "MKO",
            "Source Sales Organization": "MKO",
            "re_plannergroup (Sub-Branch Code)": "01A",
            "re_mainbranch (Branch Number)": "MKO 1",
        }]
        branch_rows = [branch("b1", "MKO 1")]
        planner_rows = []
        equipment_rows = [{
            "re_equipment": "EQ-1",
            "re_equipmentid": "e1",
            "_re_branch_value": None,
            "_re_plannergroup_value": None,
        }]

        updates, stats, expected = mapping.plan_updates(
            branches, planners, equipment, branch_rows, planner_rows, equipment_rows)

        self.assertEqual(len(updates["re_equipments"]), 1)
        self.assertEqual(expected["EQ-1"], ("b1", None))
        self.assertEqual(stats["equipment"]["unresolved_planner_target"], 1)

    def test_ambiguous_live_branch_number_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "Ambiguous active Branch identity"):
            mapping.plan_updates(
                [{"re_branchnumber": "B", "re_parentbranch (Branch Number)": ""}],
                [],
                [],
                [branch("b1", "B"), branch("b2", "B")],
                [],
                [],
            )

    def test_lookup_classifier_never_replaces_a_conflict(self):
        self.assertEqual(mapping.classify_lookup(None, "expected"), "blank")
        self.assertEqual(mapping.classify_lookup("expected", "expected"), "correct")
        self.assertEqual(mapping.classify_lookup("other", "expected"), "conflict")
        self.assertEqual(mapping.classify_lookup(None, None), "unresolved")


if __name__ == "__main__":
    unittest.main()
