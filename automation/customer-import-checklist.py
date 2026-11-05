"""Render verified customer progress and the remaining dataset checklist."""
import argparse
import json
from pathlib import Path


def render(report, equipment_report=None):
    lines = [
        "# Dataverse import checklist",
        "",
        "Only exact read-back verification counts as imported. Source rejects are",
        "tracked separately; existing table counts are not import completion evidence.",
        "This checklist contains no source records or personal data.",
        "",
        "| Dataset / task | Status | Verified / expected | Remaining action |",
        "|---|---|---|---|",
    ]
    for dataset, expected, source_total in (
            ("accounts", 441205, 441209), ("contacts", 381724, 386111)):
        value = report["datasets"][dataset]
        states = value["candidate_states"]
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
        elif report["status"] == "applying":
            status = "[ ] In progress (last verified checkpoint)"
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
        states = equipment_report["candidate_states"]
        if equipment_report["source_rows"] != 428400 or sum(states.values()) != 428400:
            raise ValueError("Equipment source accounting mismatch")
        verified = states.get("verified", 0)
        complete = verified == 428400
        lines.append(
            f"| Equipment Master | {'[x] Imported and verified' if complete else '[ ] Incomplete'} | "
            f"{verified:,} / 428,400 source rows | " +
            "; ".join(f"{name}: {count:,}" for name, count in sorted(states.items()) if name != "verified") +
            " |")
        lines.append("| Equipment full-source staging | [x] Prepared locally | 428,400 rows accounted for | Preparation is not tenant import completion |")
        lines.append(
            "| Equipment raw metadata / KOL schema | " +
            ("[x] Deployed and metadata-verified" if equipment_report["schema_deployed"]
             else "[ ] Not deployed") +
            " | 2 additive Equipment fields | Source-preservation schema, not app publication |")
    lines.extend([
        "| Refined material pricing / Spare Parts | [ ] Not imported by this run | Not verified / 37,473 source rows | Preserve all 18 positional columns; reconcile source keys, costs, currency, pricing basis and effective dates |",
        "| Employee source | [ ] Not imported by this run | Not verified / 341 source rows | Approved identity/organisation/branch persistence; no role inference or automatic privilege grants |",
        "| Organisation / branch / sub-branch / planner mappings | [ ] Missing authoritative mappings | Not verified | Preserve absent mappings as blank; explicit manual mapping writeback is not implemented |",
        "| Functional locations / sites / Account associations | [ ] Unresolved relationships | Not verified | Preserve identifiers and descriptions; do not substitute billing addresses or guess cardinality |",
        "| MKO / CKE / CKQ calculator reference and pricing configuration | [ ] Reconciliation required | Existing rows are not source-verified | Compare each master/configuration range, identities and effectivity; do not load example estimates |",
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
    if report_path.resolve() == checklist_path.resolve():
        raise ValueError("Checklist must not overwrite its report")
    equipment_path = report_path.with_name("equipment-import-report.json")
    equipment_report = json.loads(equipment_path.read_text(encoding="utf-8")) if equipment_path.is_file() else None
    text = render(json.loads(report_path.read_text(encoding="utf-8")), equipment_report)
    checklist_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = checklist_path.with_suffix(checklist_path.suffix + ".tmp")
    temporary.write_text(text, encoding="utf-8")
    temporary.replace(checklist_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--checklist", type=Path, required=True)
    arguments = parser.parse_args()
    write_checklist(arguments.report, arguments.checklist)
