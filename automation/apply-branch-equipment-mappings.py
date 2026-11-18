"""Reconcile and apply exact Branch, Planner Group and Equipment lookups."""
import argparse
import csv
import importlib.util
import json
from pathlib import Path
import urllib.parse


API_MODULE = importlib.util.spec_from_file_location(
    "branch_mapping_api", Path(__file__).with_name("import-account-contact-masters.py"))
api_module = importlib.util.module_from_spec(API_MODULE)
API_MODULE.loader.exec_module(api_module)

BRANCH_HEADERS = (
    "re_branchnumber", "re_branchname", "re_companycode",
    "re_parentbranch (Branch Number)",
)
PLANNER_HEADERS = (
    "re_name", "re_companycode", "re_salesorganization", "re_sapcode",
    "re_mainbranchcode", "re_ismainbranch", "re_primarybranch (Branch Number)",
    "re_district", "re_region", "re_sourcekey", "re_salesforceterritoryid",
    "re_sourceactive",
)
EQUIPMENT_HEADERS = (
    "re_equipment", "Source Sales Organization",
    "re_plannergroup (Company Code)", "re_plannergroup (Sub-Branch Code)",
    "re_plannergroup (Name)", "Main Branch Code",
    "re_mainbranch (Branch Number)",
)
SOLUTION_ID = "05dd7469-373e-46ad-acd4-856e50ac3777"
BRANCH_FIELDS = (
    "re_branchid", "re_branchnumber", "_re_mappedequipmentbranch_value", "statecode",
)
PLANNER_FIELDS = (
    "re_plannergroupid", "re_companycode", "re_salesorganization",
    "re_subbranchcode", "re_plannergroupname", "re_mainbranchcode",
    "_re_mainbranch_value", "statecode",
)
EQUIPMENT_FIELDS = (
    "re_equipment", "re_equipmentid", "_re_branch_value", "_re_plannergroup_value",
)


def read_csv(path, expected_headers):
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if tuple(reader.fieldnames or ()) != expected_headers:
            raise RuntimeError("Unexpected CSV headers: " + path.name)
        rows = list(reader)
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise RuntimeError("Malformed CSV row: " + path.name)
    return rows


def exact_index(rows, key, label):
    result = {}
    for row in rows:
        value = key(row)
        if value is None:
            continue
        if value in result:
            raise RuntimeError("Ambiguous " + label + " identity")
        result[value] = row
    return result


def planner_key(company, sales_organization, subbranch):
    if not company or not sales_organization or not subbranch:
        return None
    return company, sales_organization, subbranch


def classify_lookup(current, expected):
    if expected is None:
        return "unresolved"
    if current == expected:
        return "correct"
    if current is None:
        return "blank"
    return "conflict"


class MappingApi(api_module.Api):
    def iter_rows(self, entity_set, fields):
        query = urllib.parse.urlencode({"$select": ",".join(fields)})
        response = self.request(
            "GET", entity_set + "?" + query,
            concurrency={"Prefer": "odata.maxpagesize=5000"})
        while True:
            yield from response.get("value", [])
            next_link = response.get("@odata.nextLink")
            if not next_link:
                return
            if not next_link.startswith(api_module.BASE):
                raise RuntimeError("Unexpected Dataverse paging origin")
            response = self.request("GET", next_link[len(api_module.BASE):])

    def verify_solution(self):
        rows = self.find("solutions", ["solutionid"], "uniquename", "RepairEstimatorApp")
        if len(rows) != 1 or rows[0]["solutionid"].lower() != SOLUTION_ID:
            raise RuntimeError("Unexpected Dataverse solution")

    def update_multiple(self, entity_set, targets):
        endpoint = entity_set + "/Microsoft.Dynamics.CRM.UpdateMultiple"
        for offset in range(0, len(targets), 500):
            batch = targets[offset:offset + 500]
            self.request("POST", endpoint, {"Targets": batch})
            completed = min(offset + len(batch), len(targets))
            print(json.dumps({"entity": entity_set, "submitted": completed}), flush=True)


def plan_updates(branch_source, planner_source, equipment_source, branch_rows, planner_rows,
                 equipment_rows):
    active_branches = exact_index(
        (row for row in branch_rows if row.get("statecode") == 0),
        lambda row: row.get("re_branchnumber") or None, "active Branch")
    active_planners = exact_index(
        (row for row in planner_rows if row.get("statecode") == 0),
        lambda row: planner_key(row.get("re_companycode"), row.get("re_salesorganization"),
                                row.get("re_subbranchcode")),
        "active Planner Group")

    branch_updates = []
    branch_stats = {
        "source_with_parent": 0, "already_correct": 0, "safe_blank": 0,
        "conflict": 0, "unresolved": 0,
    }
    for source in branch_source:
        parent_number = source["re_parentbranch (Branch Number)"]
        if not parent_number:
            continue
        branch_stats["source_with_parent"] += 1
        current = active_branches.get(source["re_branchnumber"])
        parent = active_branches.get(parent_number)
        if current is None or parent is None:
            branch_stats["unresolved"] += 1
            continue
        status = classify_lookup(current.get("_re_mappedequipmentbranch_value"),
                                 parent["re_branchid"])
        if status == "correct":
            branch_stats["already_correct"] += 1
        elif status == "blank":
            branch_stats["safe_blank"] += 1
            branch_updates.append({
                "@odata.type": "Microsoft.Dynamics.CRM.re_branch",
                "re_branchid": current["re_branchid"],
                "re_MappedEquipmentBranch@odata.bind":
                    "/re_branchs(" + parent["re_branchid"] + ")",
            })
        elif status == "conflict":
            branch_stats["conflict"] += 1

    planner_updates = []
    planner_stats = {
        "source_with_primary_branch": 0, "already_correct": 0, "safe_blank": 0,
        "conflict": 0, "unmatched_identity": 0, "blank_primary_branch": 0,
        "unresolved_parent": 0,
    }
    for source in planner_source:
        key = planner_key(source["re_companycode"], source["re_salesorganization"],
                          source["re_sapcode"])
        current = active_planners.get(key)
        if current is None:
            planner_stats["unmatched_identity"] += 1
            continue
        parent_number = source["re_primarybranch (Branch Number)"]
        if not parent_number:
            planner_stats["blank_primary_branch"] += 1
            continue
        planner_stats["source_with_primary_branch"] += 1
        parent = active_branches.get(parent_number)
        if parent is None:
            planner_stats["unresolved_parent"] += 1
            continue
        status = classify_lookup(current.get("_re_mainbranch_value"), parent["re_branchid"])
        if status == "correct":
            planner_stats["already_correct"] += 1
        elif status == "blank":
            planner_stats["safe_blank"] += 1
            planner_updates.append({
                "@odata.type": "Microsoft.Dynamics.CRM.re_plannergroup",
                "re_plannergroupid": current["re_plannergroupid"],
                "re_MainBranch@odata.bind": "/re_branchs(" + parent["re_branchid"] + ")",
            })
        elif status == "conflict":
            planner_stats["conflict"] += 1

    expected_equipment = {}
    equipment_stats = {
        "source_without_mapping": 0, "unresolved_planner_target": 0,
        "unresolved_branch_target": 0, "native_matches": 0, "native_missing": 0,
        "already_correct_branch": 0, "safe_blank_branch": 0, "branch_conflict": 0,
        "already_correct_planner": 0, "safe_blank_planner": 0, "planner_conflict": 0,
    }
    for source in equipment_source:
        equipment_number = source["re_equipment"]
        planner_code = source["re_plannergroup (Sub-Branch Code)"]
        company = source["re_plannergroup (Company Code)"]
        sales = source["Source Sales Organization"]
        planner = active_planners.get(planner_key(company, sales, planner_code))
        branch_number = source["re_mainbranch (Branch Number)"]
        branch = active_branches.get(branch_number) if branch_number else None
        if not planner_code and not branch_number:
            equipment_stats["source_without_mapping"] += 1
            continue
        if planner_code and planner is None:
            equipment_stats["unresolved_planner_target"] += 1
        if branch_number and branch is None:
            equipment_stats["unresolved_branch_target"] += 1
        expected_equipment[equipment_number] = (
            branch["re_branchid"] if branch else None,
            planner["re_plannergroupid"] if planner else None,
        )

    equipment_updates = []
    seen = set()
    for current in equipment_rows:
        number = current.get("re_equipment")
        if number not in expected_equipment:
            continue
        if number in seen:
            raise RuntimeError("Ambiguous live Equipment identity")
        seen.add(number)
        equipment_stats["native_matches"] += 1
        expected_branch, expected_planner = expected_equipment[number]
        target = {
            "@odata.type": "Microsoft.Dynamics.CRM.re_equipment",
            "re_equipmentid": current["re_equipmentid"],
        }
        if expected_branch is not None:
            status = classify_lookup(current.get("_re_branch_value"), expected_branch)
            if status == "correct":
                equipment_stats["already_correct_branch"] += 1
            elif status == "blank":
                equipment_stats["safe_blank_branch"] += 1
                target["re_Branch@odata.bind"] = "/re_branchs(" + expected_branch + ")"
            elif status == "conflict":
                equipment_stats["branch_conflict"] += 1
        if expected_planner is not None:
            status = classify_lookup(current.get("_re_plannergroup_value"), expected_planner)
            if status == "correct":
                equipment_stats["already_correct_planner"] += 1
            elif status == "blank":
                equipment_stats["safe_blank_planner"] += 1
            elif status == "conflict":
                equipment_stats["planner_conflict"] += 1
        if len(target) > 2:
            equipment_updates.append(target)
    equipment_stats["native_missing"] = len(expected_equipment) - len(seen)
    if equipment_stats["safe_blank_planner"]:
        raise RuntimeError("Planner Group relationship needs navigation-property verification")

    stats = {
        "branch_parent": branch_stats,
        "planner_main_branch": planner_stats,
        "equipment": equipment_stats,
    }
    updates = {
        "re_branchs": branch_updates,
        "re_plannergroups": planner_updates,
        "re_equipments": equipment_updates,
    }
    return updates, stats, expected_equipment


def verify_updates(api, entity_set, fields, id_field, expected):
    verified = set()
    for row in api.iter_rows(entity_set, fields):
        record_id = row.get(id_field)
        target = expected.get(record_id)
        if target is None:
            continue
        if all(row.get(field) == value for field, value in target.items()):
            verified.add(record_id)
    if len(verified) != len(expected):
        raise RuntimeError("Dataverse mapping read-back did not match submitted values")
    return len(verified)


def run(args):
    branches = read_csv(args.branches, BRANCH_HEADERS)
    planners = read_csv(args.planners, PLANNER_HEADERS)
    equipment = read_csv(args.equipment, EQUIPMENT_HEADERS)
    api = MappingApi()
    api.verify_solution()

    branch_rows = list(api.iter_rows("re_branchs", BRANCH_FIELDS))
    planner_rows = list(api.iter_rows("re_plannergroups", PLANNER_FIELDS))
    equipment_rows = api.iter_rows("re_equipments", EQUIPMENT_FIELDS)
    updates, stats, expected_equipment = plan_updates(
        branches, planners, equipment, branch_rows, planner_rows, equipment_rows)
    summary = {
        "status": "preflight_complete",
        "source_rows": {
            "branches": len(branches), "planner_groups": len(planners),
            "equipment_links": len(equipment),
        },
        "live_rows": {
            "branches": len(branch_rows), "planner_groups": len(planner_rows),
        },
        "planned_writes": {entity: len(rows) for entity, rows in updates.items()},
        "reconciliation": stats,
        "apply_requested": args.apply,
        "writes_performed": False,
    }
    print(json.dumps(summary, separators=(",", ":")), flush=True)
    if not args.apply:
        return

    for entity_set in ("re_branchs", "re_plannergroups", "re_equipments"):
        api.update_multiple(entity_set, updates[entity_set])

    branch_expected = {
        row["re_branchid"]: {
            "_re_mappedequipmentbranch_value":
                row["re_MappedEquipmentBranch@odata.bind"].split("(")[1][:-1],
        }
        for row in updates["re_branchs"]
    }
    planner_expected = {
        row["re_plannergroupid"]: {
            "_re_mainbranch_value": row["re_MainBranch@odata.bind"].split("(")[1][:-1],
        }
        for row in updates["re_plannergroups"]
    }
    equipment_expected = {}
    for row in updates["re_equipments"]:
        expected = {}
        if "re_Branch@odata.bind" in row:
            expected["_re_branch_value"] = row["re_Branch@odata.bind"].split("(")[1][:-1]
        equipment_expected[row["re_equipmentid"]] = expected

    readback = {
        "branch_parent": verify_updates(
            api, "re_branchs", ["re_branchid", "_re_mappedequipmentbranch_value"],
            "re_branchid", branch_expected),
        "planner_main_branch": verify_updates(
            api, "re_plannergroups", ["re_plannergroupid", "_re_mainbranch_value"],
            "re_plannergroupid", planner_expected),
        "equipment_branch": verify_updates(
            api, "re_equipments", ["re_equipmentid", "_re_branch_value"],
            "re_equipmentid", equipment_expected),
    }
    print(json.dumps({
        "status": "verified",
        "writes": {entity: len(rows) for entity, rows in updates.items()},
        "readback": readback,
        "source_equipment_with_unresolved_planner_target":
            stats["equipment"]["unresolved_planner_target"],
        "source_equipment_without_mapping": stats["equipment"]["source_without_mapping"],
        "source_equipment_missing_in_dataverse": stats["equipment"]["native_missing"],
        "conflicting_equipment_branch_values_preserved":
            stats["equipment"]["branch_conflict"],
    }, separators=(",", ":")), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--branches", type=Path, required=True)
    parser.add_argument("--planners", type=Path, required=True)
    parser.add_argument("--equipment", type=Path, required=True)
    parser.add_argument("--apply", action="store_true",
                        help="Apply only exact, unambiguous lookups that are currently blank")
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
