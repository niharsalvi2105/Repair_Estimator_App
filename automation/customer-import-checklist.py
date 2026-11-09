"""Render verified customer progress and the remaining dataset checklist."""
import argparse
import datetime
import json
from pathlib import Path
import tempfile


def checked_states(report, field, expected, label, allowed):
    states = report[field]
    if (not isinstance(states, dict) or set(states) - allowed
            or any(type(count) is not int or count < 0 for count in states.values())
            or sum(states.values()) != expected):
        raise ValueError(label + " source accounting mismatch")
    return states


def remaining_states(states):
    return "; ".join(f"{name}: {count:,}" for name, count in sorted(states.items())
                     if name != "verified" and count) or "No remaining candidates"


def package_row(report, label, expected_field, guards):
    if report is None:
        return f"| {label} | [ ] Not verified | No completion report | Reconcile source values, native GUIDs and financial preservation |"
    expected, verified = report[expected_field], report["verified"]
    if expected != 280 or type(verified) is not int or not 0 <= verified <= expected:
        raise ValueError(label + " source accounting mismatch")
    complete = (report["status"] == "completed" and verified == expected
                and all(report.get(key) is value for key, value in guards.items()))
    return (
        f"| {label} | {'[x] Imported and verified' if complete else '[ ] Reconciliation required'} | "
        f"{verified:,} / {expected:,} | " +
        ("Source readback and preservation checks passed; saved estimates unchanged"
         if complete else "Verify all candidates and required preservation checks") + " |")


def render(report, equipment_report=None, *, mko_equipment_report=None, parts_report=None,
           mko_package_report=None, cad_package_report=None, labor_report=None):
    lines = [
        "# Dataverse import checklist",
        "",
        "Only exact read-back verification counts as imported. Source rejects are",
        "tracked separately; existing table counts are not import completion evidence.",
        "This checklist contains no source records or personal data.",
        "Customer totals cover all prepared contexts; MKO-only progress is labelled separately.",
        "Historical Equipment and MKO checkpoints overlap and must never be added together.",
        "",
        "| Dataset / task | Status | Verified / expected | Remaining action |",
        "|---|---|---|---|",
    ]
    for dataset, expected, source_total in (
            ("accounts", 441205, 441209), ("contacts", 381724, 386111)):
        value = report["datasets"][dataset]
        states = checked_states(value, "candidate_states", expected, dataset,
                                {"pending", "inflight", "verified"})
        verified = states.get("verified", 0)
        rejected = value["rejected_count"]
        accounted = sum(states.values()) + rejected
        if accounted != source_total:
            raise ValueError("Source accounting mismatch for " + dataset)
        complete = verified == expected and not states.get("pending", 0) and not states.get("inflight", 0)
        if complete:
            status = "[x] Validated candidates imported"
        elif report["status"] == "failed_or_unverified":
            status = "[ ] Stopped / reconciliation required"
        elif dataset == "contacts" and not verified and not states.get("inflight", 0):
            status = "[ ] Queued after Accounts"
        elif report["status"] in ("applying", "measuring_verified_batches"):
            status = "[ ] In progress (last verified checkpoint)"
        elif report["status"] == "uncertain_reconciled_read_only":
            status = "[ ] Reconciled checkpoint; awaiting next verified batch"
        else:
            status = "[ ] Pending / paused"
        lines.append(
            f"| {dataset.title()} - validated candidates | {status} | {verified:,} / {expected:,} | "
            f"{states.get('pending', 0):,} pending; {states.get('inflight', 0):,} unverified |")
        lines.append(
            f"| {dataset.title()} - source rejects | [ ] Correction required | 0 / {rejected:,} | "
            "Retain quarantine; correct source and revalidate, never invent values |")
    if equipment_report is None:
        lines.append("| Equipment Master | [ ] Not imported by this run | Not verified / 428,400 source rows | Exact typed mapping, preserve all 60 columns, reconcile existing identities and Account/branch/site links |")
    else:
        states = checked_states(equipment_report, "candidate_states", 428400, "Equipment",
                                {"pending", "inflight", "verified", "rejected",
                                 "deferred_context", "deferred_parent", "deferred_create"})
        if equipment_report["source_rows"] != 428400:
            raise ValueError("Equipment source accounting mismatch")
        verified = states.get("verified", 0)
        complete = verified == 428400
        lines.append(
            f"| Equipment Master | {'[x] Imported and verified' if complete else '[ ] Incomplete'} | "
            f"{verified:,} / 428,400 source rows | " +
            remaining_states(states) +
            ("; historical full-source checkpoint, not combined with MKO below" if mko_equipment_report else "") +
            " |")
        lines.append("| Equipment full-source staging | [x] Prepared locally | 428,400 rows accounted for | Preparation is not tenant import completion |")
        lines.append(
            "| Equipment raw metadata / KOL schema | " +
            ("[x] Deployed and metadata-verified" if equipment_report["schema_deployed"]
             else "[ ] Not deployed") +
            " | 2 additive Equipment fields | Source-preservation schema, not app publication |")
    if mko_equipment_report is not None:
        states = checked_states(mko_equipment_report, "states", 368994, "MKO Equipment",
                                {"pending", "inflight", "verified", "rejected", "deferred", "conflict"})
        if mko_equipment_report["source_rows"] != 368994:
            raise ValueError("MKO Equipment source accounting mismatch")
        complete = states.get("verified", 0) == 368994
        lines.append(
            f"| MKO Equipment - current approved mapping | {'[x] Imported and verified' if complete else '[ ] Incomplete'} | "
            f"{states.get('verified', 0):,} / 368,994 source rows | {remaining_states(states)}; "
            "preserve conflicts; resolve authoritative Branch/location/Account mappings |")
    if parts_report is None:
        lines.append("| Refined material pricing / Spare Parts | [ ] Not verified | No current MKO report / 37,473 source rows | Preserve all 18 positional columns and reconcile source identity, values and dates |")
    else:
        states = checked_states(parts_report, "states", 37473, "MKO parts",
                                {"pending", "inflight", "verified", "rejected", "existing"})
        if parts_report["source_rows"] != 37473 or states.get("rejected", 0) != 12:
            raise ValueError("MKO parts source accounting mismatch")
        complete = states.get("verified", 0) == 37461
        lines.extend([
            f"| Refined material pricing / Spare Parts - validated candidates | "
            f"{'[x] Validated candidates imported' if complete else '[ ] Incomplete'} | "
            f"{states.get('verified', 0):,} / 37,461 | {remaining_states({k: v for k, v in states.items() if k != 'rejected'})}; "
            "existing means provenance/text enrichment awaiting full verification, not completed |",
            "| Refined material pricing / Spare Parts - source rejects | [ ] Correction required | 0 / 12 | Correct source errors and revalidate; no zero-filled prices |",
        ])
    lines.extend([
        package_row(mko_package_report, "MKO / USD packages", "source_packages", {
            "financial_writes": False, "all_guids_preserved": True,
            "financial_fields_unchanged": True, "non_usd_packages_unchanged": True}),
        package_row(cad_package_report, "CAD packages - full source reconciliation", "distinct_cad_packages", {
            "business_estimate_writes": False, "usd_unchanged": True,
            "original_cad_sample_guids_preserved": True}),
        "| Employee source | [ ] Not imported by this run | Not verified / 341 source rows | Approved identity/organisation/branch persistence; no role inference or automatic privilege grants |",
        "| Organisation / branch / sub-branch / planner mappings | [ ] Missing authoritative mappings | Not verified | Preserve absent mappings as blank; explicit manual mapping writeback is not implemented |",
        "| Functional locations / sites / Account associations | [ ] Unresolved relationships | Not verified | Preserve identifiers and descriptions; do not substitute billing addresses or guess cardinality |",
        "| MKO / CKE / CKQ calculator reference and pricing configuration | [ ] Reconciliation required | Existing rows are not source-verified | Compare each master/configuration range, identities and effectivity; do not load example estimates |",
    ])
    if labor_report is not None:
        counts = labor_report["counts"]
        compared = sum(counts[key] for key in ("matching_current_amounts", "different_current_amounts",
                       "missing_current_rates", "ambiguous_current_rates", "invalid_source_amounts"))
        unresolved = 3 * (counts["unmatched_sfdc"] + counts["ambiguous_exact_context"])
        if (counts["source_branch_rows"] != 223 or counts["source_branch_sections"] != 446
                or compared + unresolved != 1338
                or counts["differences_equal_after_cent_rounding"] +
                counts["differences_remaining_at_cent_precision"] != counts["different_current_amounts"]
                or any(type(value) is not int or value < 0 for value in counts.values())):
            raise ValueError("MKO labor source accounting mismatch")
        matching = counts["matching_current_amounts"] + counts["differences_equal_after_cent_rounding"]
        lines.append(
            "| MKO labor rates - partial read-only comparison | [ ] Full contract not verified | "
            f"{matching:,} / 1,338 amounts agree at cent precision | {unresolved:,} unresolved Branch/role/time contexts; "
            "currency/provenance/effectivity contract still requires certification; no rate writes |")
    lines.extend([
        "| Dataflow pilot / handover | [ ] Not verified | No validated refresh or throughput comparison | Authenticate source, reconcile a fresh pilot and pause overlapping API writers before any refresh |",
        "| Small Spares reference workbook | [ ] Reference-only inspection | Not a verified catalog load | Blank first worksheet row; approved revised Material tab has precedence |",
        "| Source inventory and customer preparation | [x] Completed locally | Account / Contact candidates and rejects accounted for | Preparation is not tenant import completion |",
        "| Customer prerequisite schema | [x] Published and metadata-verified in Dev | Source keys, export metadata, estimate lookup relationships | Does not prove runtime or row import completion |",
        "| Package currency identity / assignment schema | [x] Dev metadata verified 2026-11-05 | Composite number + currency key active; both Memo columns published | Existing package GUIDs/prices preserved |",
        "| CAD reference package sample | [x] Exact Dev sample verified 2026-11-05 | 3 CKE Quote rows imported; 280 preexisting packages unchanged | Full calculator reference reconciliation remains incomplete |",
        "| Published lookup API / app | [x] Dev publication and admin Save/Load verified 2026-11-05 | Signed assembly hashes and running app asset verified; customer searches passed | Does not establish non-admin acceptance |",
        "| Real source-linked draft Save / calculation | [x] Dev sample verified 2026-11-05 | One Equipment, linked Account/Contact, three package assignments; CAD / 2026.7 | Exact cost reconciliation; customer/currency rejection retained; no Submit/email |",
        "| Non-admin app acceptance / external export rendering | [ ] Not verified | Admin Dev sample is not permission or export certification | Test authorized non-admin access and external package quantity rendering separately |",
        "| Autofetch plus confirmed manual master writeback | [ ] Not implemented / deployed | User-approved requirement | Blank missing fields; explicit confirmation before shared-value edits; permissions, identities and concurrency enforced |",
        "",
        "Transaction/snapshot/history/approval/export tables are populated by real",
        "application actions, not calculator example imports. Preserve their existing rows.",
        "",
        "## Completion rule",
        "",
        "Mark a dataset completed only after every approved candidate has a verified",
        "Dataverse identity, every mapped value and relationship matches, and every",
        "source row is accounted for. Quarantined rows remain a separate unfinished",
        "item until corrected and imported. Do not equate a reported worksheet/table",
        "count with source-record reconciliation.",
        "",
        "Account source reconciliation: 441,210 worksheet rows including the header",
        "= 441,209 records = 441,205 candidates + 4 rejects. The reported 441,211",
        "figure was not confirmed by the supplied data sheet.",
        "",
        "Report status: `" + report["status"] + "` (a checkpoint, not a process-health check).",
        "",
    ])
    return "\n".join(lines)


def write_checklist(report_path, checklist_path):
    filenames = {
        "equipment_report": "equipment-import-report.json",
        "mko_equipment_report": "mko-equipment-import-report.json",
        "parts_report": "mko-parts-import-report.json",
        "mko_package_report": "mko-package-text-report.json",
        "cad_package_report": "all-cad-packages-checkpoint.json",
        "labor_report": "mko-labor-exact-sfdc-reconciliation.json",
    }
    inputs = [report_path] + [report_path.with_name(name) for name in filenames.values()]
    if checklist_path.resolve() in (path.resolve() for path in inputs):
        raise ValueError("Checklist must not overwrite its report")
    reports = {}
    evidence = []
    for key, name in filenames.items():
        path = report_path.with_name(name)
        if path.is_file():
            reports[key] = json.loads(path.read_text(encoding="utf-8"))
    text = render(json.loads(report_path.read_text(encoding="utf-8")), **reports)
    refreshed = datetime.datetime.now(datetime.timezone.utc)
    local_refreshed = refreshed.astimezone()
    refresh_note = (
        f"Last checklist refresh: **{local_refreshed.isoformat(timespec='seconds')}** "
        f"(UTC: {refreshed.isoformat(timespec='seconds')}).\n\n"
        "Refresh time is not import progress. Verified counts change only when a new "
        "read-back-verified batch is checkpointed; preflight reads do not increase counts. "
        "Report checkpoint times appear below. Worker health is not inferred from unchanged counts.\n\n"
    )
    text = text.replace("# Dataverse import checklist\n\n",
                        "# Dataverse import checklist\n\n" + refresh_note, 1)
    for path in inputs:
        if path.is_file():
            modified = datetime.datetime.fromtimestamp(path.stat().st_mtime, datetime.timezone.utc)
            evidence.append(f"- `{path.name}`: {modified.isoformat(timespec='seconds')}")
    text += "\n## Evidence checkpoints (report file UTC modification times)\n\n"
    text += "\n".join(evidence) + "\n"
    checklist_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=checklist_path.parent,
                                     prefix=checklist_path.name + ".", suffix=".tmp", delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(text)
    try:
        temporary.replace(checklist_path)
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--checklist", type=Path, required=True)
    arguments = parser.parse_args()
    write_checklist(arguments.report, arguments.checklist)
