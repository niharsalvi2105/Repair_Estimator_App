# Repair Estimator - Dataverse implementation and persistence reference

## 1. Purpose, evidence and reading guide

### Direct-edit labor matrix and seven-column materials (local UI change)

The UI no longer expands/collapses or pages cost rows. Labor displays Equipment plus six Mechanic/Helper/Adjuster ST/DT hour cells and read-only Total Cost; materials use exactly Equipment Number, Material Description, Vendor Name, Part Mfg, Part #, Quantity, Unit Cost. Matrix grouping, row keys, footer totals and scroll state are UI-only. A matrix row maps to up to six existing labor role/time snapshots with unchanged `packageId`, exact `equipmentNumber`, saved IDs and rates; duplicate role/time snapshots remain separate rows. New positive cells create individual lines, cleared cells remove lines, and a wholly blank row retains a zero-hour placeholder which remains invalid for Save until completed or removed. No zero-hour lines are newly permitted by the Draft API.

Read-only totals use saved/unique available Branch rates and round each labor amount to cents; missing rates are explicit. Existing material ownership/catalog/manual rules, field limits, package/equipment validation, Save/Review locks and frozen export mappings are unchanged. No additional columns, relationships, API operations, plugin changes, permissions or automation changes are required for this presentation change. The earlier, separately documented material-equipment lookup prerequisite remains undeployed.

Local evidence: 60 selected matrix/parser/contract/clone/documentation tests, build/type-check/lint and twenty mocked desktop/mobile EN/FR browser cases passed, including Save/reopen, exact headers, six-cell import grouping/editing, totals and catalog safeguards. Final label styling exposed French mobile page overflow; containing positioned labels inside grid scroll regions fixed it. Both EN/FR import cases passed again with Review page-width assertions. These tests are not tenant metadata or published behavior verification. No deployment or tenant writes performed.

### Equipment-linked labor/material Excel imports (local source, not deployed)

The approved additive schema is `backend/custom-material-equipment-schema.json`: optional lookup `re_estimatematerialline.re_estimateequipment` targeting `re_estimateequipment`, with Restrict deletion and no cascade assignment/sharing/reparenting. `re_estimatelaborline.re_estimateequipment` already exists in the recorded metadata. The material lookup is a design prerequisite, not a verified published column; the historical live inventory below is not evidence that it exists. Existing unassigned rows are not backfilled. Estimator roles need Read/Append on both cost tables and Read/Append To on their same-estimate equipment snapshots within existing ownership rules; tenant role coverage has not been verified.

Frontend/API `laborLines[].equipmentNumber` and `materialLines[].equipmentNumber` identify exact selected equipment snapshot numbers (20 characters maximum, no whitespace, leading zeros retained). Save resolves to the corresponding snapshot lookup only within the line's CSTM package subset; omission preserves a saved association, empty string clears it. Load rejects broken/cross-estimate links. Clone with equipment retains number-based associations and receives fresh snapshot identities; cloning without equipment clears line links. The manual equipment selector, file selection/name, import progress/errors/confirmation, grid scroll state and template Instructions are UI-only and do not add Dataverse columns. Optional vendor/description/part/quantity/cost inputs retain existing 100/2000/100-character, whole-quantity and pricing limits. Import scope is the open package and line type only, with full validation and confirmation before replacement.

Labor's six spreadsheet hour columns expand into existing role/time/hours rows; rates are resolved from Branch data, not workbook values. Non-KONE material rows map to existing manual snapshot columns. KONE imports require exact unique catalog matches and blank/zero spreadsheet cost; approved catalog costs/description/price/UOM/markup are fetched then validated again on Save. There are no master writes, fabricated rates, changed estimate/package total formulas or duplicated costs. Per-equipment cards allocate linked costs directly and share only unassigned costs, superseding historical equal-sharing-only display notes below.

Frozen export rows carry a derived `re_equipmentnumber` cell resolved from the raw lookup ID against the captured estimate equipment; this cell is not a new cost-table text column. Both workbook formats expose exact equipment numbers; missing links fail instead of displaying a lookup label/GUID as a number. Existing export lifecycle, locks, Account/Contact mappings and French clear markers remain.

Local evidence: all 74 selected parser/template/contract/clone/allocation/workbook/documentation tests, production build/type-check/lint, twelve focused backend cases (three new equipment-link cases) and six mocked EN/FR browser cases passed. Desktop and mobile panel screenshots were inspected. No tenant metadata readback, schema/data writes, assembly/frontend/Office Script deployment or production acceptance. Publish the lookup and grant/verify existing-role relationship privileges before coordinated source deployment; historical rows remain unassigned.

### Intentional clears and private repair backups (PR #9 correction, local source)

Two optional Boolean columns are required on `re_estimatepackage`: `re_customnamefrcleared` and `re_customscopefrcleared`, default false, as defined in `backend/custom-translation-clears-schema.json`. These distinguish deliberately cleared CSTM French name/scope snapshots from historically missing translations after Dataverse normalizes empty text to null. Save updates markers only when French text is supplied; Load/clone return marked fields as empty strings. Both Office Scripts honor the markers without changing English text, prices or export delivery lifecycle. No shared package writes or historical marker backfill. Coordinated columns/Drafts/frontend/Office Script deployment required; not deployed or tenant-verified.

Location initialization/clear state is UI-only, retained across step remounts; loaded blanks remain blank and the empty linked-location option clears the existing `re_buildingname` snapshot. It adds no location columns or API fields. The repair CLI now creates backups exclusively with verified owner-only access before writing sensitive contents: POSIX mode 0600 or a protected current-user Windows DACL, then flush/fsync before correction batches. Permission setup/verification errors stop before tenant writes; inherited permissive ACLs are not a fallback. Existing backups are not modified by this source change and must be checked separately.

Local evidence: 15 focused repair tests completed successfully (one POSIX-only case skipped on Windows), including actual Windows ACL/exclusive-file checks and failure blocking correction calls; Python compilation passed. Build/type-check/lint, 54 selected unit/contract/clone/workbook/documentation tests, nine focused backend cases and ten mocked EN/FR browser cases also passed. All fixtures are synthetic; no tenant reads/corrections, existing-backup inspection, deployment or published behavior certification. Historical French nulls are not backfilled.

### CSTM description snapshots (2026-11-10, local source)

CSTM editor name/scope inputs map to existing `re_estimatepackage.re_packagenameen` / `re_packagenamefr` (500 characters) and `re_proposalscopeen` / `re_proposalscopefr` (10,000 characters), using the current UI language. Draft Save accepts these optional snapshot overrides only when the trusted master/prior snapshot identifies the package as CSTM; standard/T&M text remains server-derived. Omitted values retain master/prior values, empty text clears the corresponding snapshot, and absent English name/scope serialize as empty strings. Review/clone/export use these existing snapshots; master package records, IDs, numeric pricing, schema, permissions and locking are unchanged. The frontend checks response text retention and keeps edits visible with an error on an incompatible server.

Local evidence: build/type-check/lint, 38 contract/clone/export/documentation tests, nine focused backend cases (including five custom text snapshot/limit cases) and four EN/FR/light/dark mobile mixed-package browser cases passed. Tests use fake persistence/mocked APIs; no deployment, tenant writes or live verification. Coordinated frontend/Drafts deployment is required.

### Optional location snapshot, required email (2026-11-10, local source)

`re_repairestimate.re_buildingname` is optional in the app and Draft API Save/Submit path, retaining its 300-character limit. Empty/whitespace input writes null (also clearing an existing value); Load/Save/Submit responses return `building: ""` when no value is stored. The frontend no longer blocks Next/Save/Calculate/Submit for missing description, and both location input/dropdown omit mandatory markers. Opportunity preset payloads and cloning permit blank location text too. Existing source-pair fetching/autofill, market/Branch scoping and province/state requirements are unchanged.

`re_customeremail` remains required and syntactically validated, maximum 100 characters, using available authoritative Contact email or validated manual snapshot fallback. No new fields, master writes, schema-required-level edits, permissions, formulas, registration/images, locks or export lifecycle changes. Existing exports receive blank location text rather than a fabricated replacement.

Local validation: 11 focused backend cases passed for optional-location persistence/clear/Load/Submit, text limits, presets and required email; 37 selected frontend contract/clone/export/documentation tests and 14 mocked EN/FR browser cases passed. Blank location export retains an empty cell and the contact email. Production build/type-check and changed-source/test lint passed. These fake-pipeline/browser results are not live persistence or schema evidence.

Local source only, not pushed/deployed or tenant-verified. Coordinated Drafts assembly/frontend deployment is needed; tenant metadata, business rules and external downstream automation were not inspected or changed. Historical required-location wording below is superseded by this source behavior.

### Teammate integration (2026-11-09, local merge)

The merged frontend retains source-exact `account.accountnumber` handling and the existing estimate-only customer/location snapshots while adding the teammate's component-memory read reuse, timings and validation-focus corrections. No new tables, columns, API operations/payloads, formulas, permissions, locks, plugin registrations or export lifecycle changes are introduced by this integration. Branch/Account/market isolation, failed-request eviction, Retry and Save/Reload invalidation remain required. Single/multiple/missing location selection continues to use the existing 300-character `re_repairestimate.re_buildingname`; SAP pair identity and cache revisions remain UI-only.

Integration evidence: production build/type-check, full lint, 162 frontend unit tests, 100 Python automation tests and all 102 distinct selected mocked browser cases passed across the main run and isolated recheck. New EN/FR cases combine cached defaults with adaptive location controls and manual Contacts. Pricing regression coverage now explicitly verifies cached step navigation, Reload rejecting a different saved version, and Retry recovery. An initial local dev-server connection-refused failure passed in isolation; the pre-existing ExcelJS chunk-size warning remains. No live persistence, production latency or non-admin behavior was certified.

Work is local only, without GitHub push, app/plugin publication or tenant reads/writes. Earlier authorized Account-number corrections and tenant observations below are historical evidence, not actions repeated by this merge.

### Source-exact Account numbers and location UI (2026-11-09, local source only)

Both customer Excel readers now honor explicit all-zero number formats for AccountNumber and Account.AccountNumber numeric cells, preserving source-defined leading zeros before payload/staging creation. Literal text remains exact and General-format numbers are not padded to an invented width. Formula identifiers, unsupported numeric formats, fractional/nonfinite/negative identifiers and numeric values beyond Excel's reliable 15-digit precision are explicitly rejected. Existing source IDs, GUID relationship resolution, collision checks and post-write exact comparisons remain unchanged. The change affects source mapping into `account.accountnumber`, `contact.re_sourceaccountnumber` and mapped Equipment account-number copies through the shared bulk reader; no columns or schemas are added.

Old prepared customer staging cannot simply resume under the changed reader contract (existing script fingerprint guard). Reprepare from original authoritative workbooks into fresh private staging before a separately approved reconciliation. Do not edit checkpoint fingerprints or pad existing records by assumption. The formatting fix itself does not reconcile differing source exports; do not replay old unpadded Account-master payloads over corrected numbers.

Location control selection is frontend-only: one available name uses an input, multiple source pairs use a dropdown, no usable names use free text. Complete sole results autofill blank text; incomplete results retain warnings and permit explicit confirmation of the available source value. `re_repairestimate.re_buildingname` remains the required 300-character snapshot, with no persisted SAP-pair reference, new lookup or master write.

Validation: the formatted numeric-cell regression failed in both old readers (`123` instead of source-displayed `000123`) and passed after the fix; all 100 Python automation cases and 10 focused mocked EN/FR browser cases passed, plus frontend build/type-check/lint and five changed-Python-file syntax checks. The user explicitly selected Equipment.Account.AccountNumber by exact Account.Id as the authority for existing Account corrections, rather than a guessed fixed width or the differing Contact export.

The new `automation\repair-account-number-zeros.py` defaults to read-only auditing. A full Equipment scan found 428,400 rows, 101,841 Account IDs, zero inconsistent number mappings. The tenant comparison read 441,206 Account rows (not the user-estimated 441,205): 64,447 covered Accounts already exact; 36,215 missing-leading-zero candidates; 1,179 Equipment-source Accounts not imported. Remaining tenant Accounts lack coverage in this workbook and are left unchanged. Only additional source-defined zeros are eligible; removing zeros, altering nonzero digits, duplicate identities/numbers, missing ETags and overlength values are blocked.

Approved tenant correction completed: **36,215 Account numbers updated and readback-verified**. Before writes, the script saved a private outside-repository backup of affected values/IDs/ETags and source fingerprint. Each bounded atomic batch patched **only** `account.accountnumber`, using individual If-Match headers, a fresh collision check and exact source-ID/GUID/number readback. A changed candidate count aborts before writes; uncertain responses stop for reconciliation rather than blind replay. Sanitized progress reports contain counts only. A subsequent independent dry-run reread the entire source and all 441,206 tenant Accounts: **100,662 covered Accounts exactly match the Equipment source; zero missing-leading-zero corrections remain**. The 1,179 source Accounts absent from the tenant were not created, and 340,544 tenant Accounts without coverage in this workbook were left unchanged.

No Contact/Equipment records, estimate snapshots, schema, permissions, relationships, plugins or source workbooks were modified. The Account primary GUIDs/source identities were preserved. Frontend location changes remain local source and are not published; tenant correction is not frontend deployment or end-to-end UI certification. No Contact-export override or Account creation was authorized/performed.

### Equipment-cache race corrections (frontend only)

Branch changes invalidate the component-memory equipment cache even with no
selected equipment. Active loads retain their original selected promises so a
failed `re_equipment` read cannot disappear through cache eviction while another
batch is pending; errors remain visible with Retry. No queries, columns,
payloads, persistence, snapshots, permissions, pricing or plugin behavior changed.
Five focused mocked browser tests, build/type-check, changed-source lint and
diff checks passed. Source only, not published or tenant-verified; no tenant
reads/writes or schema/plugin deployment occurred.

### Change Contact layout (frontend only)

The existing selected Contact email/phone display and Change Contact action
now use content-width spacing with responsive wrapping. No field mapping,
length limits, selection, snapshots, API, permissions or persistence changed.
This is source-only styling, not deployed or tenant-verified.
Six local mocked browser tests passed at mobile/tablet/desktop widths in
English/French; build/type-check, changed-source lint and diff checks passed.

### Performance measurement and customer-defaults reuse (frontend source only)

**Affected reads:** existing Account/Contact search and Account/Branch defaults
through `re_DraftEstimate`, linked `re_equipment` location metadata, equipment
search/details, saved `re_repairestimate` pricing and draft operations.
No new columns/tables, API payloads, choice values, plugin queries/registration,
permissions, persistence, formulas, locking or export lifecycle changes.

The open workspace retains one current defaults promise keyed by native
Account, Branch, market and UI-only draft-read revision. Reopening the customer
step reuses it, avoiding repeated location scans/metadata parsing. Save/
Calculate/Reload, different context and Retry refresh it. Clearing Account/
Branch or leaving the workspace discards it. Failed requests are evicted and
reported normally; manual edits and superseded-response guards are preserved.
The per-request backend scan remains bounded to 2,000 Equipment rows and 20
location pairs with all source/active/market checks unchanged.

User Timing records contain static operation labels, elapsed milliseconds and
completed/failed outcomes only. They remain in browser memory, with at most
100 entries per label before that label resets. No record IDs, search strings,
financial/customer data, errors or tokens are recorded. Nested timed SDK/
context promises are counted separately from validated operations; these are
not raw HTTP counts or production latency measurements. Session startup is
identity/access loading; Calculate uses the existing `draft-save` timing.
See [the app reference](./app.md) for inspection instructions and limits.

Local mocked evidence verifies defaults reuse, Save/Reload refresh, pending
request sharing, failure Retry, Account isolation and existing customer/
submission behavior. Real adapters with mocked services verify timing/error
contracts, scoped equipment queries and SDK-call counts; unit tests cover
data-free bounded retention and timeout/error preservation. Seventeen focused
mocked browser cases, all 162 unit tests, build/type-check, changed-source lint
and diff checks passed. No tenant
verification, business/master writes, schema/plugin changes or frontend
publication occurred. Existing incomplete source-data and scan limits remain.

### Billing Plan required marker (frontend only)

The existing `re_repairestimate.re_billingplan` choice now has a red required
star and accessible required indication in the UI. Submit still requires it;
draft Save/Calculate still permit it to be blank. No schema requirement level,
choice values, API payload, persistence, pricing or plugin behavior changed.
Local validation evidence is recorded after checks; no deployment or tenant
writes are included.

### Frontend read reuse (local source only)

**Affected reads:** existing Branch-filtered `re_equipment` detail reads and
saved calculation outputs on `re_repairestimate`. No columns, relationships,
API operations/payloads, security roles, persistence, calculations, snapshots,
registration or export lifecycle changed.

**Expected behavior:** component-memory equipment reads reuse completed and
in-flight results for selected numbers, fetching only missing units in
sequential batches of 50. Branch changes, Retry and saved/reloaded drafts reset
this cache. Pricing and Review reuse one request keyed by estimate ID, saved
version and UI-only draft-read revision; Save/Calculate/Reload and Retry trigger
fresh reads. Failed requests are evicted, not converted into successful empty
responses. Closing the workspace or opening another estimate discards caches.
Unsaved edits still mark saved pricing stale. Bulk matching and new-unit detail
reads remain separate; no new persisted cache fields or pricing source exist.

**Actual local evidence:** 26 targeted mocked browser cases passed for request
counts, invalidation, in-flight sharing, error recovery, Save/Submit and stale
update regressions, bulk equipment and bilingual mobile/desktop display.
Adding one unit reads only the added number; reselecting it
adds no read; Pricing/Review navigation shares one saved-pricing read. Build,
changed-source lint and 24 related unit/documentation tests passed.
This is frontend source/mock evidence only. No tenant verification,
business/master writes, schema/plugin deployment or frontend publication
occurred; live latency and non-admin behavior remain unmeasured/unverified.

### Validation focus variants (2026-11-09, frontend only)

The location dropdown now receives required-field focus through its existing
`opportunity-building-error` association. Its source location selection still
copies to `re_repairestimate.re_buildingname`; no new persisted field is added.
A UI-only operation-attempt counter retriggers identical local Save/Calculate/
Submit errors. Neither change modifies API dispatch/payload, validation rules,
permissions, pricing or export lifecycle. Eight focused mocked browser cases
passed for dropdown/repeated-error focus and previous submission regressions,
including English desktop and French mobile. All 34 required-field-category
browser cases, build/type-check, changed-source lint and 10 validation/
documentation unit tests also passed. No tenant reads/writes, schema or
plugin changes, or deployment occurred in this correction.

### Submission error visibility (2026-11-09, frontend source only)

The saved reported CKE estimate was inspected read-only: `re_billingplan` is
null, `re_sellprice` is positive and `re_estimatestatus` remains Draft. This is
one saved-record observation, not evidence of unsaved client state or of every
condition required for submission. No customer data or record values were
changed. The source UI now focuses the first invalid field, provides an explicit
Billing Plan instruction and focuses operation errors near the footer. The
`re_billingplan` choice, server validation, API payload, permissions, calculation
and export lifecycle are unchanged. Focused mocked browser tests, local build
and lint are frontend evidence only; the update has not been published or
verified with a live submission.

Follow-up frontend evidence: 34 mocked browser cases passed, testing each of
the 17 required UI prerequisites independently in English desktop and French
mobile, including conditional CSTM tax/freight and submit-only selling price/
Billing Plan. They assert invalid-control/error associations, visible errors,
focus and blocked persistence. Read-only/disabled derived fields use focusable
errors where the control cannot accept focus. No additional Dataverse reads,
writes, schema changes or deployment were performed for this coverage check.

### Click-time form validation and freestyle Opportunity Name (2026-11-09, frontend source only)

Opportunity Name is now blank/free-text for new requests, clones and presets, with no generated replacement on clear. It continues to map to `re_repairestimate.re_estimatename` (required, 100 characters); existing saved names are unchanged. A complete empty Contact result uses a plain name input rather than a lookup popup. Linked `re_customercontact`, source-authoritative nonblank master values and estimate-only `re_customername`/`re_customeremail`/`re_customerphone` snapshots retain their existing rules and 100/100/50-character limits. No shared `account` or `contact` writes are introduced.

Contact result panels now flow above, rather than overlay, the location control and dismiss on blur/Escape. Functional Location Description still maps to required `re_buildingname` (300 characters), using verified source Location.Name or an explicit manual description; SAP pair selection is still UI-only. Missing source data is not repaired or substituted.

Missing fields no longer disable Next/Save/Submit. Localized red label-adjacent errors and invalid-control associations are UI-only state, reset for a new draft. Next preserves customer-free local browsing, checking step-specific name/Branch/location/equipment type or equipment/package assignments. Save checks existing header/customer/reference/cost prerequisites and routes to the earliest incomplete step without a write; Submit also checks positive `re_sellprice` and `re_billingplan`. Existing busy/import/access and submitted/export locks, API validation, persistence contracts, calculations, permissions, registration and export lifecycle are unchanged.

Validation evidence: frontend build/type-check, changed-source lint and frontend unit suite passed; 33 distinct focused mocked browser cases passed across runs, including free text, no-contact fallback, popup dismissal/layout, inline/hidden-step errors/reset, linked/manual Contact persistence, location choices/stale responses, clones/presets and existing cost guards. Two mobile timeouts passed an isolated single-worker rerun without source changes. These do not prove tenant persistence or production behavior. Deployment status for this change: local source only, not published; no tenant verification or business/master writes. Existing source-data gaps and earlier deployment evidence below remain unresolved/separately scoped.

### Unified customer controls (2026-11-07, frontend only)

The customer UI now uses single-column, single Contact-name and single Location-Description controls. Linked Contact selection continues to retain `re_customercontact` and source-authoritative available name/email/phone; unmatched custom details remain estimate-only snapshots under existing 100-character name/email and 50-character phone limits. Location dropdown selection copies source Location.Name into the existing 300-character `re_buildingname`; custom entry uses that same field. SAP location pair identity remains UI-only, shown as supplementary text/choices, not a new lookup or column.

Only one location input or dropdown is rendered at once; multiple Contacts use the unified name combobox's dropdown. Source-active/market/Branch/result-limit policies and Account/Contact relationships are unchanged. No new schema/API/plugin/import/master writes, permissions, financial outputs or export changes. Six contract/five documentation cases, final build/type-check/lint and 16 focused mocked browser cases passed across runs, including manual/partial Contact Save/reopen, keyboard/dropdown behavior, desktop/mobile English/French and in-flight custom edits. The frontend was published to Dev in `RepairEstimatorApp`; after refreshing the verification tab, `index-D58AHTms.js` loaded and displayed populated Contact/location single controls vertically. This is read-only unsaved UI evidence, not tenant Save/Submit or teammate access certification. No further plugin publication or master writes; absent source records remain unresolved.

### Account location number/name defaults (2026-11-07, source correction)

Subsequent Dev deployment: signed Drafts SHA-256 `1ac5903cc3455438ce900e7076de0053cd5230f3aca3f6252853ed4dfe8d0506` was readback-verified with unchanged type/signing identities and assembly solution membership (type 91). The latest frontend was pushed into the same solution; fresh read-only verification confirms app component type 300 and the published `index-eXQteb7d.js` bundle. A live defaults response returned one source location pair matching independent native reads; the published step-1 UI displayed the SAP number/name option and autofilled its blank description before Equipment selection. No business-record writes, Save/Submit, schema or permission changes. Individual teammate/non-admin access remains unverified; localhost development URLs do not point to this shared publication.

The defaults operation on `re_DraftEstimate` now returns additive `locationOptions: [{number, name}]` and `locationNamesUnavailable`, retaining legacy location/description lists derived from those source pairs. It resolves the selected Account by native GUID from Account-master search (not Equipment account-number copies), checks Account/Branch market and active status, and reads active `re_equipment` using `re_customeraccount`, `re_branch`, `re_functionallocation` and `re_sourceexportmetadata`. Exact `Location.Functional_Location_SAP_Number__c` / `Location.Name` source cells in the Memo must agree with the typed functional-location number. `re_description` is no longer the source for this customer location default.

No new table/column or import contract is added. A separate Location table is not populated by this change. Duplicate Equipment rows collapse by exact number/name pair; up to 20 choices are returned, scanning at most 2,000 rows in 100-row pages. Missing/unverifiable source pairs and names exceeding the existing 300-character estimate-description limit are explicitly flagged without truncation/substitution. Incomplete lists cannot infer a sole location. Invalid JSON/import-size metadata causes an explicit plugin error.

Frontend dropdown pair selection is UI-only; `Location.Name` is copied into the existing `re_repairestimate.re_buildingname` text snapshot. The selected SAP number/legacy location ID is not newly persisted, and no Equipment, Account or Contact master is modified. Existing saved/manual descriptions remain preserved; same-name locations cannot be uniquely recovered from a saved name alone. Equipment browsing is still Branch-scoped. Unimported/conflicting Equipment can omit source locations, so this does not certify a complete Account-location directory.

Local evidence: six frontend contract cases and focused backend defaults cases passed, including paging/deduplication, same-name pairs, source-number mismatches, missing/invalid metadata, limits and unchanged Contact eligibility. Signed Drafts/test build, frontend build/type-check, changed-source lint, five documentation checks and eight mocked English/French desktop/mobile browser cases passed, followed by a missing-source-warning browser check and exact-2,000-row backend boundary check. Fresh read-only tenant sampling found valid Location.Name and exact raw/typed SAP-number agreement in 25 of 25 MKO Equipment rows; 24 source names differed from Equipment Description. This bounded sample is not a whole-directory audit. The unrelated full legacy harness fails in `TestChoices` for a fixture with no required Account; full-suite acceptance remains unresolved. Subsequent deployment/read-only UI evidence is recorded above; no business/master, schema, permission or registration writes occurred.

### MKO source mapping audit and fresh read-only verification (2026-11-06)

Full MKO Contact-parent verification completed on 2026-11-07 at 05:55 +05:30. Fresh paged tenant reads matched all 333,414 imported Contact source IDs/native identities to their exact checkpoint Account GUIDs and Account-number provenance: zero missing Contacts, duplicate identities, parent mismatches or number mismatches. All links were already correct; zero relationship writes were necessary. This full-population check covers Contact identity/parent/Account-number mapping, not all Contact columns, current UI eligibility, primary-contact selection or every Account having a Contact. Prior full-field sample and source-column audit evidence below remain separately scoped. No schema, app/plugin behavior or deployment changed.

A private Excel audit accounts for all 105 columns across the Account master (27), Contact export (18) and Equipment export (60). Workbook fingerprints match prepared sources. The fixed private snapshots captured 359,754 verified MKO Accounts, 175,514 verified Contacts and 77,028 verified MKO Equipment; pending/inflight rows and source rejects remain separate. Source/payload comparisons cover all 387,948 Account candidates, 333,414 Contact candidates and the 77,028 verified Equipment rows. These are frozen checkpoint/source checks, not a fresh full-tenant audit or current completion totals; ongoing writers were not restarted.

Fresh read-only samples checked 11 Accounts, 7 Contacts and 16 Equipment records, including eight cross-market links: 1,232 mapped-field comparisons had no mismatches and 11 Account/default API checks matched direct tenant queries. A separate fresh customer audit checked 25 Accounts, 25 Contacts, 1,175 mapped fields, 25 parent relationships and 10 app lookup/default cases without mismatches. Of those 10 cases, one auto-selected a Contact and nine required linked selection under the existing uniqueness/truncation policy. Sample evidence does not certify every tenant row or non-admin access.

Unresolved findings: eight source-MKOF Equipment rows are linked by exact source Account ID to verified CKE Accounts; fresh readback confirms the links, but their MKO app context is invalid. Another 12,737 verified Equipment Account-number copies differ from the authoritative Account master only in leading-zero formatting; Equipment Account names agree. In three live tests the Account-master number found the intended Account, while the alternate Equipment-source number did not under prefix search. No identifiers or relationships were rewritten or normalized. Use the Account-master number to select the imported Account; authoritative source/market corrections remain required for cross-market rows.

The audit is private because record-level output contains business/contact data; none is included in this reference or committed. No schema, permissions, plugin, app publication, master correction or estimate Save/Submit was performed. Related Account/location fields preserved in Equipment raw metadata must not be described as separately materialized tables or automatically fetched UI values.

### Remaining-import recovery and checklist refresh (2026-11-06 evening)

User subsequently restricted further imports to MKO only, deferring CKE/CKQ. Customer parallel batches now accept an explicit optional source-organisation scope: `MKOF` filters Accounts and both Contact source organisation and verified parent Account organisation. Existing callers without a scope retain their prior behavior. Five focused importer tests pass, including exclusion of CKE/CKQ and wrong-market parents. The unscoped recovery process was stopped during collision preflight for a scoped restart; restart still reconciles uncertain writes and repeats source/schema/collision checks rather than bypassing them. Equipment and MKOM parts were already MKO-only. Existing Canadian records/checkpoints are preserved; their remaining rows are not newly authorized.

The prior parallel customer run stopped on a connection reset during writes, preserving 500 Account and 490 Contact inflight rows. The resumed guarded runner independently read back all 990 and verified exact source fields/parent relationships: checkpoints reached 406,511 Accounts and 217,314 Contacts with no inflight rows. It then entered the full collision preflight; running preflight is not completion of the remaining 34,694 Account and 164,410 Contact candidates. Batch size was reduced to 250; uncertain writes are still never blindly retried.

Equipment resumed using the unchanged approved importer, source/mapping/schema fingerprints and v3 checkpoint. To avoid the prior SQLite lock contention, its read-only parent input is a consistent private SQLite backup of customer staging, integrity-checked and containing 406,511 verified Account identities. It cannot consume Accounts verified after that snapshot until a later reconciled continuation uses a fresh snapshot. No live customer journal settings, source records, import contracts, native conflicts or schema were changed. First resumed Equipment batch reached 54,008 verified (67 additional exact readbacks), with 33,742 preserved conflicts and 215,419 pending. The existing parts writer was retained without launching an overlapping writer; its local checkpoint advanced to 30,897 verified with 6,564 awaiting enrichment and 12 source rejects.

The private generated Dataverse import checklist was refreshed from report checkpoints. It keeps source rejects, unverified rows, mapping deferrals/conflicts, employee/organisation/site prerequisites, reference reconciliation and dataflow acceptance unfinished. Package source reconciliation remains completed. Report status is not a process-health check and historical overlapping Equipment checkpoints must not be added together. These recovery operations do not change app/plugin behavior, saved estimates, pricing configuration, permissions or deployment.

Checklist refresh visibility: the generator now includes a visible generation timestamp with local UTC offset and UTC time, separate from report modification times and verified batch counts. A reconciled read-only customer checkpoint is labelled as awaiting the next verified batch, not evidence that the worker is paused. Preflight reads do not increase imported counts; a refresh alone does not establish worker health. The existing private refresh loop remains in use without a duplicate writer. No Dataverse table/column, import mapping, API, permissions or tenant deployment changes are involved.

Validation: 18 focused checklist tests passed, Pylance reported no generator syntax errors, and the existing loop published the visible timestamp at 20:14:36 +05:30. Read-only local heartbeat observations increased from 222 to 241 completed Account page reads; this proves ongoing preflight reads, not additional imported Accounts/Contacts or tenant acceptance. These are local tracking changes, not an app/plugin deployment.

### Imported Equipment display-column wiring (2026-11-06)

Read-only verification of the three screenshot Equipment records confirmed that legacy Name/OEM/Age columns were blank while source Description/Manufacturer/Construction Year were populated. With user approval, frontend Equipment reads now additionally select existing `re_equipment.re_description` (Memo), `re_manufacturer` (text) and `re_constructionyear` (integer), including Branch-scoped number/bulk lookups.

Description is labelled as such; Manufacturer falls back to legacy OEM. Existing valid legacy age is retained; otherwise display age is current calendar year minus a positive integer construction year not later than the current year. This UI-only derived age has no new column and is not written into `re_equipmentage`, `re_estimateequipment` snapshots, primary-equipment bands or pricing inputs. No schema/API/plugin, persistence, permission, import or master-write change. Existing functional location and legacy name remain mapped as before. Source detail fields are not added to Save/Submit payloads, and loading them must not dirty a draft.

Twelve local unit/documentation checks and seven mocked browser cases passed, plus build/type-check and focused lint. Browser coverage includes English/French dropdown/cards, Save/reopen without changing financial snapshots, mobile layout and existing bulk/typed-list paths. The frontend was published to Dev; `index-e-uRi3hk.js` and live source details were verified in a separate tab's equipment dropdown and unsaved selected card. This confirms read-only source wiring, not tenant Save/Submit, non-admin acceptance or source construction-year accuracy. No tenant business records were written.

### Dev deployment and UI placement correction (2026-11-06)

The customer snapshot fallback and coordinated frontend were deployed to Dev, together with current signed Pricing safeguards and Drafts assemblies. Assembly hashes/type identities were verified; the published frontend bundle was observed in a separate tab and a read-only Contact search succeeded. Earlier source-only statements below record predeployment evidence. No schema, registration or permission changes, business Save/Submit, email, live pricing recalculation or non-admin acceptance was performed.

The corrected additional-details breakdown is restricted to Pricing & Margin (step 4), reading the existing step-3 input fields documented below. Step 3 retains inputs and package subtotal; review has no duplicate additional card. Derived card values remain UI-only; existing limits/mappings and saved estimates are unchanged. Four focused mocked browser cases passed across successful runs, including edits/Save/reopen in English/French and mobile/desktop mixed-package totals. Fifteen cost/documentation checks and build/type-check/lint passed. PAC published the corrected frontend to Dev; the new `index-Cpj6WZd4.js` bundle was observed in a separate verification tab. No live business write or end-to-end financial acceptance was performed.

### New material UI defaults (current source)

New CSTM material rows initialize quantity 1 and KONE type in frontend state only. The existing material-line quantity/type and catalog mappings remain unchanged; users may override them, and loading/cloning existing lines retains saved values. No schema defaults, shared parts, financial formulas or tenant records are changed by initialization. KONE catalog validation still applies; no automatic manual-price fallback is introduced. Local regression and deployment evidence is recorded separately when completed.

### Additional-details cost breakdown (frontend only, current source)

The package summary now separates package subtotal, an additional-details card and combined estimated cost. The UI reads existing `re_additionallaborhours`, `re_additionalmaterial`, `re_additionalmiscellaneous`, `re_timecategory`, `re_usetax` and `re_freight`; branch mechanic role/time rate supplies additional labor cost. Additional material plus miscellaneous receive additive tax/freight; labor does not. Package-specific custom lines are already included in package subtotal, so they are not added twice.

Card breakdown and combined total are UI-only derived values, not new columns or authoritative persisted outputs. Existing field limits, Save/reopen mapping, backend financial formulas, snapshots, schema, registration and permissions remain unchanged. Blank optional additions are zero; invalid inputs or missing/ambiguous rates show unavailable rather than a false total. Ten cost tests, five documentation checks, build/type-check/lint and five mocked browser cases passed, including English/French card ordering, invalid inputs, total reconciliation, Save/reopen and mixed-package no-double-counting. No publication or tenant write occurred.

### CSTM per-equipment zero preview correction (current source)

Frontend equipment cards now include entered CSTM labor/material instead of showing only zero-valued predefined masters. Package-assigned custom amounts/hours are shared equally across assigned Equipment for display; predefined unit amounts retain existing scaling. Source lines remain in `re_estimatelaborline` / `re_estimatematerialline`, related to their `re_estimatepackage`; no equipment-level allocation columns or new persistence are introduced. Existing `re_mechanichours`, package snapshots, role/time rates, KONE exceptions, custom totals and estimate-level additions are not rewritten or recalculated by this display change.

Nine local cost tests, three material tests, five documentation checks, seven focused mocked browser cases across targeted runs and production build/type-check/lint passed. Browser checks cover English/French CSTM edits/subsets plus unchanged standard and carry-forward totals. No Dataverse schema, API, registration, permission, pricing output, master data or tenant business write changed. UI-only allocation uses the assigned Equipment count, with existing two-decimal formatting; rounded displayed shares can differ by cents from unrounded totals. No publication or tenant/non-admin acceptance is claimed.

### Missing Contact details: estimate-only persistence (current source)

The current source relaxes only the mandatory Contact selection, not Account identity or required customer name/email. `re_repairestimate.re_customeraccount` remains required by the API; existing optional `re_customercontact` is nullable and explicitly cleared when no Contact is supplied. `re_customername` and `re_customeremail` store validated required snapshots (100 characters); optional `re_customerphone` remains 50. Nonblank linked Contact values take precedence; only missing/whitespace fields accept manual input. Supplied inactive/wrong-parent/unimported Contacts and wrong-market Accounts remain errors. No shared `account`/`contact` records are created or updated.

Contact search/defaults now include source-active linked Contacts without email. Additive response-only `contactMaster` carries native available fields separately from completed snapshots, including through clone/preset payloads, to keep missing values editable after reopen. Manual Contact name is a UI field mapped to the existing snapshot, not a new Contact or schema column. Functional-location numbers remain read-only master evidence; existing manual description fallback is unchanged.

Local evidence: production frontend build, changed-source ESLint, 30 contract/clone tests, five documentation checks and 11 mocked browser cases passed, including English/French manual/partial Contact Save/reopen/update, invalid email and Account-change clearing. Thirteen backend cases passed, covering Save/reload/update/submission, partial Contact search, clearing the lookup and required/master-validation gates. No schema/registration/permission changes, tenant business writes, plugin deployment or app publication occurred for this fix; coordinated Drafts/frontend deployment and non-admin Save/Submit acceptance remain outstanding. This supersedes older mandatory-Contact descriptions, not historical deployment evidence.

### MKO priority import and approved refined-pricing policy (2026-11-06)

User reprioritized all MKO-related customers, Contacts, Equipment, packages, parts/pricing and reference masters over email work. Source aliases remain `MKOF` for Account/Equipment and `MKOM` for refined materials; no new inferred organisation crosswalk. The existing single customer writer was preserved. A stopped run had 306,511 verified Accounts and 119,314 verified Contacts plus 490 inflight Contacts; a subsequent read-only reconciliation verified all 490, reaching 119,804 verified Contacts. Recovery then stopped on a read timeout during collision preflight; the private runner uses 1,000-row read pages, bounded timed-out GET retries and a read-progress heartbeat. Uncertain writes are still reconciled, never blindly retried. These Account/Contact counts include other source contexts and are not MKO-only totals.

The new [MKO part importer](../automation/import-mko-parts.py) accounts for 37,473 refined Material rows as 37,461 candidates plus 12 source-error rejects. User explicitly approved six-decimal `ROUND_HALF_UP` for typed USD cost/price, raw preservation of all 18 positional source columns (including both CAD values and duplicate currency headers), and availability of valid effective parts. The additive optional `re_sparepart.re_sourceexportmetadata` Memo has a required capacity of 100,000 characters, storing source workbook/hash/sheet/row and original cell storage/value plus rounding policy. It is not a new CAD calculation input. Existing `re_sourcekey` identity namespace and native GUIDs remain stable. Existing financial values are compared and never rewritten by this import; only approved source description/provenance differences can be ETag-patched.

All valid source rows retain original effectivity, including expired/future rows. Source zero cost/price and non-unit pricing remain preserved but inactive because the current KONE catalog requires positive USD cost/VK13 and pricing unit 1; no zero-price fallback or silent unit division is introduced. Twelve error rows stay quarantined, not zero-filled. New records use bulk CreateMultiple with inflight checkpoints and complete readback; existing rows use conditional PATCH plus readback. The importer refuses differing source fingerprints, changed contracts, conflicting native mappings/provenance and duplicate keys. Preparation/local tests are not tenant import completion; actual deployment and verified counts must be recorded separately.

Read-only package reconciliation found all 280 MKO/USD masters already present; 210 differ from the supplied MKO Quote name and/or scope text. User approved correcting that text while retaining existing GUIDs and financial values. This does not authorize repricing saved estimates or changing rates, margins, registration, permissions or export behavior. Equipment coordinate precision, missing parents, planner/site/branch crosswalks, employee identity and calculator reference reconciliation remain separate unresolved gates.

Execution evidence: the transient Dataverse `EntityCustomization`/concurrent-solution-Import lock initially rejected Spare Part Memo creation. A later retry created/published it and verified metadata. The 500-new-part pilot passed complete source/provenance readback; after interruption and uncertain-write reconciliation, the latest bounded continuation reached 12,500 verified new rows, with 14,326 pending new rows, 10,635 preexisting rows awaiting provenance enrichment and 12 source-error rejects. The parts writer is paused after its batch limit. Counts are checkpoints, not full completion. The package source sync recovered after a read-authentication failure: final independent readback verified all 280 source packages, all package GUIDs preserved, financial fields unchanged and all non-USD packages unchanged. The original 210 text discrepancies were corrected across the resumed run.

User subsequently approved exact `Equipment.Plant_Section__c` to `re_branch.re_branchnumber` within MKO only, unchanged source `Location.Functional_Location_SAP_Number__c` to `re_equipment.re_functionallocation`, and eight-decimal `ROUND_HALF_UP` for typed latitude/longitude while preserving original values in the existing Equipment Memo. The separate [MKO Equipment importer](../automation/import-mko-equipment.py) reads the original prepared source read-only, leaves the earlier import contract/state untouched, and creates only records whose exact source Account ID is already verified. Missing/ambiguous Branches, missing locations/parents and duplicate numbers are not guessed. Coordinate ranges are validated before rounding. Other numeric fields retain exact precision checks. Native conflicts are explicitly deferred without overwriting existing Equipment; safe new rows may continue. Every created field, Branch and Account lookup is read back. No planner/site master associations, equipment age or privileges are inferred.

Live Equipment v3 bounded-pilot evidence: 368,994 MKO source rows are accounted for as 64 newly created/readback-verified records, 186 preserved native conflicts, 302,919 pending records, 65,821 context deferrals (53,383 without an exact MKO Branch and 12,438 without a source location) and four duplicate-source rejects. The pilot completed and paused; this is not full Equipment import completion or published-browser acceptance.

Dataflow handover status: user approved a Power Apps standard-dataflow pilot, with remaining imports switched only after correctness and measured-throughput checks pass. The maker navigation points to `/dataintegration`, not `/dataflows`. The first shared browser exposed a blank embedded panel; a subsequently shared Dataflows tab exposed the creation controls. An unpublished standard-dataflow wizard named `MKO Parts - Validated Pilot` was opened with analytical-only mode unchecked. A 500-pending-record parts CSV (19 destination fields, including raw provenance) passed exact text round-trip validation locally and the Upload connector reported successful upload to the user's company OneDrive for Business. This destination was disclosed and the user approved using that uploaded file. The source connection remained unauthenticated with an explicit popup-blocker error; no target mappings, publication, refresh, benchmark or Dataverse pilot writes occurred. The wizard was cancelled before resuming the parts API importer; the list again reported no created dataflows. The company OneDrive source file remains; no dataflow ownership switch occurred. The proposed pilot rows are not reserved and may now be imported by the API writer; regenerate/reconcile a fresh pilot and pause overlapping API writes before any future dataflow run.

Remaining-data continuation evidence (2026-11-06): user approved continuing safe API imports alongside pilot setup without overlapping target rows. After cancelling the non-running dataflow wizard, the existing fingerprint-checked parts state resumed with no batch limit, including guarded provenance/text enrichment of preexisting records. Equipment v3 resumed separately with no batch limit, verified Account parents and preserved native conflicts. The original customer writer remained active. At one subsequent readback checkpoint, parts had 14,500 verified, 12,326 pending new, 10,635 preexisting awaiting enrichment and 12 rejects; Equipment had 3,425 verified, 1,075 preserved conflicts, 298,669 pending, 65,821 context deferrals and four rejects. Customer checkpoints showed 319,511 verified Accounts and 132,544 verified Contacts across all source contexts, not MKO-only totals. These are evolving checkpoints, not completion claims. No estimate, finance configuration, schema, plugin or frontend deployment was performed during this continuation.

Read-only labor reconciliation: NewRates has independently ordered straight-time and double-time sections; never link the two sections by worksheet row. SFDC code alone is not unique: 57 active MKO code groups map to multiple native Branches. Exact source Branch Number text matched to `re_branch.re_branchname` together with exact `re_sfdcbranch`, scoped to active MKO, resolved 436 of 446 source sections with no duplicate composite source keys or ambiguous native matches. All 1,308 corresponding active/effective `re_laborrate` role/time records exist: 1,197 amounts are exact decimal matches and 111 differ only in original source decimal representation but equal the native amount after diagnostic two-decimal half-up comparison. There are no cent-level differences in this subset. This diagnostic rounding is not a new import rounding authorization or a write. Ten unresolved sections represent 30 role/time contexts, not proof that all those rates are missing. Currency/source-provenance parity and the full reference contract remain unverified; no labor-rate writes occurred. Other reference inventories, employee/planner/site prerequisites and Equipment mapping conflicts remain unresolved and must not be reported as imported.

Checklist reporting correction: [customer-import-checklist.py](../automation/customer-import-checklist.py) now reads optional sibling reports for current MKO Equipment, parts, USD package text/provenance, full CAD package reconciliation and partial labor comparison. Customer states including measured batches are labelled as checkpoint progress, not process-health proof. Historical full-source Equipment verification is kept separate from overlapping MKO results; these totals are never summed. Existing parts awaiting enrichment and inflight rows do not count as verified. Candidate completion does not close source-error quarantine. Both package rows require full source counts and explicit GUID/financial preservation evidence; missing or malformed evidence cannot silently produce a completed row. All report state totals are checked and output replacement uses an isolated temporary file. Report file UTC modification times identify evidence checkpoints, not verification timestamps or freshness guarantees.

Customer concurrency change (2026-11-06): user requested increased throughput and simultaneous Contacts. Previously one writer alternated 500-Account and approximately 490-safe-Contact batches; recent reported apply/readback intervals were 38-46 seconds for Accounts and about 43 seconds for Contacts, excluding their initial conflict reads. The new [parallel coordinator](../automation/customer-import-parallel.py) retains one exclusive customer orchestrator but runs at most one Account batch and one Contact batch concurrently, with separate authenticated API instances and SQLite connections. Contacts select only exact source Account parents already marked verified with a native ID; same-round unverified parents cannot qualify. Each dataset retains source-key/conflict checks, committed inflight checkpoints, supported bulk writes and complete mapped-field/parent readback. Native conflicts are deferred, not overwritten by this coordinator. Both workers settle before any failure propagates, leaving uncertain rows for reconciliation rather than blind resend.

The private runner was changed without editing prepared mapper/source/rules fingerprints. The prior writer was stopped by its verified PID and its orphaned lock preserved; replacement startup reconciles uncertain writes and reruns source/metadata/collision preflight before parallel writes. It uses two workers at batch size 500, retains existing bounded GET/authentication retries and service-protection handling, and records round wall time separately from individual batch times. A private stop-after-round flag supports a future checkpointed pause. Checkpoint-file permission failures receive bounded local-only retries; they do not retry writes. SQLite preparation, local barrier tests and a live process do not establish measured speedup: tenant parallel readback/throughput must be recorded after preflight. Existing Equipment/parts writers remain separate, with no dataflow refresh or schema/plugin/frontend deployment.

Live parallel evidence: replacement startup reconciled all 500 interrupted Account rows by readback and completed collision preflight. Its first two concurrent rounds each verified 500 Accounts plus 490 Contacts, in 50.627 and 53.673 seconds wall time (19.555 and 18.445 verified records/second). The immediately preceding sequential Account-plus-Contact apply/readback intervals totalled 88.961 and 82.233 seconds per 990 records; unlike the new round clock, these earlier metrics exclude initial conflict reads. This short sample supports improved combined throughput, not a sustained SLA or completion estimate. Ten differing existing Contact rows remain deferred without overwrite. Both dataset workers are active under one orchestrator, alongside separate Equipment/parts writers. Local validation passed 83 Python import tests (including four concurrency/parent/conflict/failure cases), five documentation checks and whitespace validation.

The private checklist can be regenerated with `python automation\customer-import-checklist.py --report <private-directory>\customer-bulk-report.json --checklist <private-directory>\dataverse-import-checklist.md`. The already-running customer process retains its previously loaded renderer; a private refresh process regenerates with current code every 15 seconds while known import writers remain, then performs its final update and exits. A cached writer may briefly replace the checklist between refreshes; this is eventually consistent reporting, not a transactional combined snapshot. It does not restart writers, bypass fingerprints, modify import states or write Dataverse. Generation failures surface in its log and retain the last valid checklist. Employee/master-writeback, unresolved mappings, rejects, full reference parity, non-admin/export acceptance and the unauthenticated dataflow pilot remain unchecked. Source/local checklist tests are not tenant import completion.

### Internal-submission template mapping contract (2026-11-06)

The new workbook-v2 script accepts the existing typed snapshot shape (`schemaVersion`/payload `templateVersion` both `"1"`): header plus equipment, packages, labor, materials and costs; each row retains its GUID and `{key,text,number}` cells. It does not retrieve or write Dataverse. Expected source tables remain `re_repairestimate`, `re_estimateequipment`, `re_estimatepackage`, `re_estimatelaborline`, `re_estimatematerialline` and `re_estimatecostline`. Snapshot labels must accompany numeric choices; currency is an explicit uppercase ISO code resolved by the flow, never a lookup GUID. Header amounts are saved authoritative values, not recomputed in Excel. The existing snapshot capture backend and legacy v1 scripts are unchanged.

The displayed Account name is the saved Account lookup label; Account number is an optional flow-enriched `re_accountnumber` payload cell from the linked native Account, not a new estimate column. Missing optional fields stay blank; a missing/unavailable calculation, positive-sell-price requirement, missing total/suggested/actual/recommended CMII or inconsistent equipment count blocks generation. Additional costs already include custom lines; displayed tax/freight are not added again. Subcontractor cost remains captured-only. Details preserves all supplied non-null fields, including precise numeric companions and unknown logical keys, rather than inventing absent source data.

Limits: 900,000 UTF-8 bytes, 1,000 child rows, 250 cells per row and 32,700 UTF-16 characters per text cell. The workbook marker is `RepairEstimatorSubmission:2`; each run requires a fresh blank copy and marks it only after successful filling. A failed workbook must be discarded, not reused. All summary anchors are validated before writes; runtime connector failures are not transactional. No schema, permissions, registrations, business records, export configuration or cloud flow were changed. Local type-check/tests and desktop Excel PDF rendering do not prove cloud connector support or tenant mapping/delivery. The existing export outbox remains disabled; the user-selected Submitted-trigger email flow still requires consistent snapshot construction, idempotency, PDF conversion and approved Dev-only recipient wiring.

Manual handoff: generate the blank workbook with `node automation\build-submission-template.cjs <output-directory>` (refuses to overwrite), upload that `.xlsx` as the template, and create an Excel Office Script from `FillSubmission.ts`. The flow must copy the blank workbook for each submission and supply `payloadJson`, `currencyCode` (for example `CAD`) and `generatedUtc` (UTC ISO timestamp ending `Z`). Convert only the filled copy to PDF; do not use the preview PDF or synthetic workbook as the automation template. Local validation: 18 focused new/legacy export/documentation tests, standalone strict TypeScript and changed-file ESLint passed. Desktop Excel produced a two-page blank template PDF and a variable-length synthetic PDF with a one-page summary; required headings, exact saved amounts, leading-zero Account number, CMII percent and percentage-point variance were checked. No customer data was used in those artifacts.

### Financial calculation audit and fail-closed rules (2026-11-06)

Source engine `2026.8` rejects ambiguous matching band-matrix/redundancy configuration and duplicate incentive thresholds with explicit `RE-117` errors; see [plugin.md](plugin.md). Affected reads are `re_bandmatrix` (type/input bands/result), `re_redundancyband` (minimum/maximum/band) and `re_incentiverate` (country/minimum CMII/payouts). No master rows, schema, formulas, registration or permissions changed. Existing Draft error recovery clears calculated `re_repairestimate` outputs and marks pricing unavailable; submitted transitions reject ambiguous calculations rather than selecting an arbitrary rule. Existing saved snapshots are not migrated/recalculated.

Read-only current Dev inspection found no duplicate effective matrix keys (28 rows), overlapping redundancy pairs (three rows) or duplicate incentive country/threshold keys (14 rows). Independent exact-decimal reconciliation of the existing three-package CAD standard sample matched five saved cost/hour outputs. No estimate writes or submission/export occurred, and its saved deployed version remains `2026.7`. Local pure-engine and mocked plugin acceptance remain distinct from that narrow tenant evidence; no blanket finance certification or verified full source-configuration reconciliation is claimed. Subcontractor cost is still saved as captured-only, not added to cost; a policy change must be explicitly specified.

### Accuracy-first customer import restart (2026-11-06)

User authorized restarting the priority import while retaining exact precision and relationship validation. A private bounded runner reuses the existing CreateMultiple/UpdateMultiple adapter without changing the immutable prepared import contract. Source fingerprints and writable Account/Contact metadata were compared before proceeding. All 1,000 previously uncertain Account rows were reconciled by readback with every mapped field matching; no writes were necessary. Account verified count reached 183,511 with 257,694 pending and four source rejects. This is source-backed reconciliation, not an assumption that an interrupted request succeeded.

The run next performs destination collision preflight, then benchmarks 250- and 500-row Account and eligible parent-linked Contact batches with exact readback. Existing mismatched destination values stop the private runner rather than being overwritten. Checkpoints retain inflight state on uncertain writes and sanitized counts/timings; no frontend, schema, API, plugin or submission/export change. Equipment precision approval and unresolved site/organisation mappings are not bypassed. Completion and throughput will be recorded only after the bounded run returns verified results.

First benchmark outcome: destination collision preflight passed; 250 new Accounts passed exact verification in 41.248 seconds (6.061 verified rows/second for that measured batch, excluding initial preflight). Verified Accounts reached 183,761. The Contact pre-write guard then stopped without Contact writes: ten exact-source existing Contacts had matching parent and other mapped fields but blank source Account number, source organisation and export metadata. These are incomplete preexisting mappings, not wrong parent relationships. The resumed bounded runner explicitly defers mismatched existing records, keeps them pending and reports their worksheet identities privately while benchmarking only safe matching/new records. It does not claim skipped rows completed or overwrite existing masters. Completing those ten records requires a separately concurrency-guarded integration-metadata update and full readback.

Resumed benchmark completed successfully: another 750 Accounts and 730 Contacts were newly written and exactly verified. Latest completed checkpoint is 184,511 verified Accounts and 734 verified Contacts; 256,694 Accounts and 380,990 Contacts remain pending, including the ten deferred Contacts. The 500-row Account batch verified at 10.983 rows/second and the 490-row Contact batch at 9.925 rows/second, excluding preflight and extra pre-write checks. These samples are not a sustained-throughput guarantee. A bounded continuation uses the measured 500-row size, alternating Accounts and eligible parent-linked Contacts for up to 100 cycles, with the same lock, fingerprints, metadata checks, collision preflight, full-field readback and explicit mismatch deferrals. This does not authorize coordinate rounding, schema modifications or bypassing application validation. The private reports/checklist update after each verified batch; final completion remains unclaimed.

Continuation check at approximately 04:16 IST: the original writer was still active with 229,511 verified Accounts and 44,344 verified Contacts; 490 Contacts were inflight and not counted verified. Pending counts were 211,694 Accounts and 336,890 Contacts. Recent batches remained approximately 10-12 verified rows/second. A separate continuation process was queued to wait for the exact current process to exit before acquiring the existing exclusive lock; it does not run overlapping database writers. It allows up to 1,000 alternating 500-row cycles and stops early when no safe eligible rows can progress. Deferred/mismatched records remain pending with explicit private reporting; transport failures retain uncertain state and stop. This continuation covers valid customer candidates, not Equipment precision rejects, remaining reference imports or complete source quarantine resolution. Current progress is from the private checkpoint, not a fresh full-tenant certification.

### Multiple Contacts under one Account - scoped import correction (2026-11-05)

A user-reported Account had two exact parent-linked Contact candidates in the fingerprint-verified source staging, but only one in Dataverse; the second remained pending. This was an incomplete Contact import, not multiple Account masters or a reason to merge by person name. One pending Contact was imported through the existing guarded apply adapter with an exclusive staging lock, unchanged source/contract fingerprints, writable Contact metadata comparison and a verified native Account parent. Every mapped source field and Account relationship passed readback; the previously imported Contact was not rewritten.

Independent native reads and the published empty `contactsearch` response both returned exactly two eligible linked Contacts, no truncation and no primary flag. Therefore the existing UI offers an explicit Contact choice rather than auto-selecting one; selecting a Contact fills that person's email/phone. Source Account IDs remain authoritative and repeated Account numbers do not merge people. No customer values or personal details are recorded here.

The private import report/checklist was refreshed: total verified Contacts is now four. This scoped correction does not complete or resume the broader bulk import, reconcile uncertain Account writes, change schema/API/plugins or save any estimate. Published UI choice rendering remains separate from the successful native/API verification.

### VK13 / itemized KONE pre-save validation (2026-11-05)

Frontend now rejects simultaneous positive `re_repairestimate.re_konesparessalespricevk13` and KONE material references before calling Draft Save/Submit, matching the existing server guard. An explicit Pricing action clears only the local aggregate input, preserving itemized material references/snapshots. The next user Save sends the existing field contract to clear the aggregate, then computes through existing server rules. No table/column/schema/API/plugin/formula change, automatic persistence or pricing-success fallback. A failed calculation still shows no saved dashboard values.

Five validation unit cases, production build/type-check, changed-file ESLint and a focused mocked browser regression passed. The browser test confirmed no Save occurs when clearing the conflict and the subsequent saved payload retains KONE references without positive aggregate VK13. Frontend Dev publication succeeded (built entry `index-s31LQpTJ.js`); live user-request financial acceptance/served-browser version remains unverified. No real estimate writes, Submit/email, schema or assembly deployment.

### Full CAD package catalog import (2026-11-05, approved rounding)

User designated the CKE and CKQ estimator workbooks as CAD package sources and approved two-decimal currency rounding while retaining exact raw Excel values in provenance. Quote contains 280 CKE rows and 273 CKQ rows. All 273 shared package identities have identical mapped names/scope/hours/material/before-markup values; the union is 280, not 553 duplicate CAD masters. The existing active number/currency key is retained. Canadian Branch country/currency context was verified consistent across CKE and CKQ.

Affected master columns: `re_repairpackage.re_packagenumber`, `re_packagenameen`, `re_proposalscopeen`, `re_mechanichours`, `re_materialmisctaxcost`, `re_materialbeforemarkup`, `re_packagecategory`, `re_country`, `re_currency`, `transactioncurrencyid`, `re_iscustompackage`, `re_istimematerial`, `re_effectivefrom`, and `re_sourceexportmetadata`. Numeric schema remains unchanged: hours Decimal precision 2, the two Money columns precision 2, CAD currency precision 2. Hours fit exactly; 204 material totals and 24 before-markup values require user-approved decimal `ROUND_HALF_UP` to cents. Raw typed cells, source workbook/sheet/row/fingerprint and both shared-source references remain in the Memo. Category mapping removes only its colon/whitespace display delimiter, retaining raw values. Existing standard/CSTM/T&M behavior flags must agree with source category.

Three previously verified CAD sample GUIDs are retained while completing their before-markup mappings/provenance. New identities use deterministic CAD+package-number GUIDs; reads reconcile before creates, updates to the three samples are concurrency guarded, and unexpected preexisting differences fail rather than overwrite. The 280 existing USD records must remain unchanged. New effective-from dates are Dev import activation configuration, not a historical source claim. No estimate Save/Submit/email, pricing/plugin/schema change or customer import restart.

Preflight passed against all source rows, numeric/range/text/category constraints, source fingerprints and unique currency identities. The first created CSTM row was independently reconciled after verification stopped on JSON integer-key/string-key representation; the comparison normalizes JSON without changing raw values or replaying the create. Later read transport/reset interruptions were reconciled before resuming; the final full-record comparison used 25-row pages to avoid oversized response transfers.

**Dev import completed and verified:** all 280 CAD packages match every mapped field and normalized full source provenance in an independent final paged read. Exactly 277 new CAD masters were added and all three original CAD sample GUIDs retained. All 280 preexisting USD rows match their before-import attributes unchanged. A separate native query using the frontend country/currency and effective-date eligibility rules returned exactly 280 CAD packages for CKE/CKQ, with no duplicate IDs/numbers, one CSTM and one T&M. The currency-filter unit contract passed. This completes the CAD package catalog, not other master imports or tenant-wide pricing certification. Published-browser dropdown rendering/non-admin acceptance remains unverified; no real estimate Save/Submit/email occurred.

### Additional details input availability (2026-11-05)

Frontend removes the CSTM-only edit restriction for existing estimate-header `re_additionallaborhours`, `re_additionalmaterial` and `re_additionalmiscellaneous`. `re_additionalscope` remains editable. These inputs persist through the existing explicit Draft Save and load; no new columns, schema, API or permissions. Additional labor uses the selected time-category mechanic rate and additional material/miscellaneous use existing standard/custom tax/freight calculations once per estimate, not per selected equipment. Standard package rates remain fixed at 5%/14%; CSTM package lines and snapshots are unchanged. Review/submitted/access locks are preserved.

Build/type-check and changed-file lint passed; four focused mocked browser cases verified editable standard additions, exact local preview, field persistence/reopen and separate CSTM workflow. Submitted locking and French mobile checks passed, with one unrelated early-navigation failure passing on isolated rerun. Frontend Dev publication succeeded (built entry `index-BYC_bpNr.js`), but published-browser served-version and live financial acceptance are not claimed. No business record Save/Submit/email, schema/API/plugin deployment or import restart.

### Account-number to Equipment Description mapping (2026-11-05)

User-approved mapping: selected `account.accountid` plus Branch resolves active `re_equipment` through `re_customeraccount` and `re_branch`; `re_description` supplies location-description candidates. Account number remains the search/display identity, not an unscoped text join. The empty `contactsearch` response adds `locationDescriptions` plus independent truncation/overlength flags. Source metadata was read-only verified: Equipment Description is Memo, while Account generic Description and Equipment Location are blank in the verified sample. Plant Section Description is not the approved source.

One complete distinct description autofills only a blank UI field; several offer a dropdown. Saved/manual text and edits during loading survive. Description candidates are UI-only until explicit Save persists the confirmed value to existing `re_repairestimate.re_buildingname` (300 UTF-16-character limit). The chosen candidate's Equipment GUID is not persisted and the existing API still accepts a manual description; this is not a new authoritative site entity or master-writeback mechanism. No tables, columns, relationships, pricing outputs or permissions change.

A separate bounded Equipment read probes 21 rows with non-null Memo descriptions, ordered by Equipment GUID; candidates come from the first 20, excluding blanks/overlength values and deduplicating ordinally. More rows or any overlength candidate prevents unique autofill and shows an explanation. Missing data requires manual confirmation, never billing-address/location-code substitution. Native read-only Dev inspection found two distinct within-limit linked descriptions for the existing sample, requiring explicit choice. No business values are recorded here.

Validation: 27 local unit cases, signed Drafts customer-defaults executable, production build/type-check, changed-file ESLint, seven mocked browser regressions and five documentation-guard tests passed. The local inactive fixture was corrected because its existing Add helper resets state to active; inactive state is now set after Add. Source/native metadata inspection is not deployment evidence.

Dev deployment evidence: signed Drafts content/hash and unchanged signing/version/type identities were independently verified after publication; the live API's two descriptions and flags matched an exact native query. Frontend push to the existing Code App/solution succeeded (built entry `index-CL4ZeH40.js`). Published-browser cached-version acceptance and non-admin validation remain pending. No new schema, business record writes, Submit/email or import restart.

### Opportunity defaults read contract (2026-11-05)

Frontend Account number/name now have separate visible controls backed by the selected `account.accountnumber`/`name`. `re_DraftEstimate` `contactsearch` accepts empty search for linked defaults, preserving initiating-user reads and active imported Account/Contact eligibility. Response adds Contact `primary` from `contact.re_primarycontact`, `contactsTruncated`, `locations` and `locationsTruncated`. Contacts still require `parentcustomerid`, source identity/active flag and an email. At most 20 are returned, with a 21st-row truncation probe; a truncated list never establishes a unique default.

When Branch context is supplied with an empty search, Account organization and Branch market must match the requested market. Functional-location numbers are distinct `re_equipment.re_functionallocation` values (100-character source-column limit) filtered by active state plus exact `re_customeraccount` and `re_branch` relationships, not by formatting-normalized account numbers, billing addresses or unlinked Equipment. At most 20 are returned with explicit truncation. These numbers are displayed as read-only UI context only, never persisted as a building name. The separately confirmed/entered description still uses existing `re_repairestimate.re_buildingname` (300-character limit) on explicit draft Save. No new table, column, relationship, permission or master update. Generated opportunity labels remain UI-only until saved to the existing title field (100-character limit); native request autonumber is unchanged. Contact choice still persists through existing validated Account/Contact lookups.

The signed Drafts enhancement was deployed in place and content/signing/type identities verified; an independent native-table read reconciled the real sample's one eligible Contact and one distinct functional-location number. The final frontend publication was observed as `index-BV0r7lbE.js`. In the published app a new unsaved request fetched the expected Account name, Contact email/phone, location number, CAD, province and salesperson from the real context. Building description remained blank, explicitly separate from the location code. Missing required inputs still disabled Save. No business record Save/Calculate/Submit/email was performed during this correction's acceptance. Local mocked tests are separate from this admin Dev evidence. Incomplete bulk imports and unresolved site-description/user-organization mappings limit available defaults; full completeness and non-admin behavior are not certified.

Follow-up read-only diagnosis: the user-selected Account from a later screenshot had no native linked Contacts or Equipment. The fingerprint-verified Contact workbook was scanned across all 386,111 data rows, including rows excluded from candidate staging, with no matching source Account ID or account number. Equipment raw staging, including quarantines, likewise had no matching source Account ID. This particular Account's missing defaults cannot be resolved merely by finishing the current import or changing frontend controls; an authoritative missing Contact/site source or corrected source relationship is required. No substitute customer, contact or billing-address mapping was created. With user approval, the existing verified sample was demonstrated separately; all available customer defaults loaded, but building description remained explicitly missing. No business records were written.

### Pricing dashboard display-only change (2026-11-05)

The redesigned summary reads the same version-checked `re_repairestimate` pricing columns and currency: suggested prices, entered price, total/package/additional/custom costs, tax/freight, CMII and incentives. No table, column, API, persisted calculation output or permission changes. UI-only composition shares use package + custom labor + custom material + remaining additional cost, avoiding double counting the saved inclusive `re_totaladditionalcost`. Incomplete/unreconciled chart inputs are explicitly unavailable. Gauge bounds affect only drawing, not stored/visible actual CMII. Missing optional values remain unavailable rather than zero. See [app.md](app.md) for layout, tests and deployment status.

Frontend-only publication succeeded and the matching `index-DkGDpMaF.js` runtime was observed after host refresh. Read-only reopening of the existing source-backed Dev draft confirmed the new cards/charts show saved CAD/version2026.7 with correct unavailable-value dashes. No draft mutation, Submit or email was performed by this UI check. Local mocked browser tests are separate from that live read-only evidence.

### Real-source Dev test and approved package currency identity (2026-11-05)

User approved three exact source-linked Contacts for real testing, retaining all submission rules, Save/Calculate only and no Submit/email. Three Contacts were created and every mapped field and Account parent read back exactly; their Accounts and Equipment links were preexisting verified imports. The interrupted Account batch reconciled with zero writes to 120,511 verified Accounts. No personal/business record values are recorded here.

Read-only live preflight found 280 active packages, no compatible package currency for the selected Canadian branches, and a globally unique package-number key. All 82 exact-money-precision CAD source candidates collided with existing numbers. The user explicitly approved migration to package number + `re_currency`, preserving source numbers, GUIDs and existing prices, plus coordinated Dev publication where required. [package-currency-schema.json](../backend/package-currency-schema.json) records the contract. Create/activate the composite key before removing the old key; do not overwrite USD records to create CAD prices.

Frontend package and clone queries now require branch currency, with transaction-currency fallback only when the explicit package currency is null, plus existing matching/global-country behavior. Package cache identity includes currency.

**Dev execution verified 2026-11-05:** both Memo columns are published with the required lengths; `re_PackageNumberCurrency` is Active on `re_currency` + `re_packagenumber`, and the old number-only key is absent. Metadata reads immediately after changes were temporarily stale; independent final reads confirmed the result. Three CAD packages from CKE Quote reference rows 7, 25 and 60 were created and every mapped value, currency/country/category relationship and typed source provenance read back. Category lookup removes the source's `": "` display delimiter only; the raw category cell is preserved. Effective-from is the current Dev import activation date, explicitly recorded as configuration rather than a historical Excel value. Source precision was not rounded. All 280 preexisting package rows were independently read back unchanged.

Both signed assemblies were updated in place, preserving signing identity, existing assembly and plugin-type GUIDs; uploaded content hashes were independently verified. The frontend push succeeded and the running browser loaded the matching production entry asset `index-D6rakLHR.js`. Correct-contract Account and Contact searches found the imported source records. Earlier probes used an incorrect market type or omitted the required Account; those errors are not evidence of a current lookup defect.

A real Dev draft with one preexisting source-linked Equipment, verified Account/Contact and three explicitly assigned packages was saved through the API, reopened in the published app and saved again through its button. Persisted row version advanced; calculation version is `2026.7`, currency CAD, and package hours/labor/material/estimated cost and total true cost exactly match independent decimal arithmetic using saved source snapshots and the live rate. Suggested selling price exists. No selling price was chosen, so final price/actual CMII are intentionally unavailable. Separate invalid saves proved missing Contact and wrong package currency are still rejected, with no partial header left behind. No Submit or email was attempted. This is admin Dev evidence, not non-admin acceptance, full-import completion or a live five-unit 4/3/5 test.

After sample verification, the unchanged-contract accelerated customer importer passed another 1,000-row pilot and resumed as one detached sequential writer with automatic checklist checkpoints. Its first resumed checkpoint independently confirmed 122,511 verified Accounts and three Contacts, with the exclusive staging lock owned by the active writer. These are dated progress counts, not full-import completion or a guarantee of continued process health.

### Package equipment assignments and preview (source and coordinated Dev deployment)

Affected table: `re_estimatepackage`. New optional Memo `re_equipmentnumbers`, max 32,700 characters, contains a Draft-API-owned JSON array of exact selected equipment snapshot numbers; null is legacy/all mode. Existing `re_quantity`, `re_totalhours`, `re_totalmaterial` are derived from package assignment count. No new equipment-master fields or relationship tables are required.

The frontend sends subsets with package snapshots, preserves them across load/full clone, includes them in dirty tracking and removes deleted equipment from explicit subsets. Copying packages without equipment resets subsets. Empty/foreign/duplicate subsets and stored quantity disagreement fail explicitly. Old-client edits cannot clear an existing subset without the explicit `allEquipment` reset flag.

Pricing uses each explicit subset's count for package contributions, KONE package selling price and stated-rate margin. Legacy/all mode keeps the existing global count; custom labor/material and header additions remain once-only. Saved pricing outputs therefore reflect assigned package quantities after coordinated deployment. Export freezes assignments and totals; external workbook rendering is not runtime-verified.

UI-only: open customization panels and calculated local-preview state. Local preview computes costs from fetched rates and package/entered costs, without customer prerequisites or Dataverse writes. It is labelled not saved/non-authoritative and hides stale amounts after input changes. Official pricing/Save/Submit still require valid customer selections. Missing rates/currency/invalid costs are errors, never invented zero costs.

Expected example: five units, Pit four, MR three, Door five. Local synthetic tests cover that example; the real Dev test above uses one source-linked unit and three explicit assignments. Schema, both assemblies and app are deployed and independently verified for this Dev run. [package-equipment-schema.json](../backend/package-equipment-schema.json) records the column contract. No master import fingerprints were modified.

Local evidence: 38 focused JavaScript package/clone/draft/documentation tests passed; 49 xUnit pricing/loader/export tests and the focused draft persistence selector passed. Twelve focused browser cases passed, including 4/3/5 unit assignments with exact synthetic 2,628.00 cost, CSTM additions, customer-free preview/no writes and dropped-assignment error instead of false success. These tests use synthetic/mocked services and do not prove tenant permissions, installed schema or published behavior. The legacy unfiltered DraftTests fixture failure for missing Account/Contact references remains documented in the plugin reference.

This is the shared reference for **which data the app reads, writes, calculates or does not save**, and what must be verified before deployment. Update it in the same change as any related implementation.

**Baseline:** branch `nihar_updates`, committed source `7bcb66d`, plus preceding pricing-feedback changes and the current local customer-master lookup source work. Documentation inspection: **2026-11-04 local / 2026-11-03 UTC**. This is not a continuous tenant monitor.

| Evidence label | Meaning |
|---|---|
| Source implemented | The checked-out code contains the behavior; deployment is a separate question. |
| Locally tested | Existing local validation passed; browser tests use mocked Dataverse responses. |
| Dev verified | A read-only metadata/configuration query confirmed the specific fact below. No customer records were read for this audit. |
| Unverified live | No end-to-end tenant test or deployed-code identity proves the behavior. |
| UI-only | React state only; not included in the draft API payload. |
| Gated / missing | Code exists but configuration, registration, approval or business implementation is incomplete. |

Do not confuse a generated SDK model, schema proposal, uploaded DLL or enabled step with successful production operation. A DLL version of `1.0.0.0` does not identify its pricing-engine version.

### Initial read-only Dev observations

The initial Dev inspection used Dataverse Web API metadata, Custom API registration, plugin registration and the non-sensitive export switch; it made no tenant changes. The later authorized additive schema deployment and its verification are recorded below.

| Check | Actual observation | Consequence |
|---|---|---|
| Draft Custom API | `re_DraftEstimate` exists | Parameter contract, assigned plugin and runtime execution still need end-to-end verification. |
| Export Custom API | **`re_EstimateExport` exists** | Earlier `re_re_EstimateExport` naming problem is no longer present in this snapshot; do not keep reporting it as current. |
| Assemblies | `RepairEstimator.Plugins` and `RepairEstimator.Drafts`, both `1.0.0.0` | Modified timestamps were 2026-11-02 and 2026-11-01 UTC respectively; exact deployed source/hash not verified. |
| Export configuration | One returned active `RepairEstimator` row; `re_enabled=false`, `re_outputmode=sample` | Current configuration selects legacy Submit, not workbook/email automation. |
| Export locks | Query for processing-step names containing `ExportLock` returned no rows | Required 21 lock registrations are not evidenced by that query. Confirm by plugin-type relationship before activation; steps could be renamed. |
| Existing pricing steps | Enabled synchronous Create/Update calculation, snapshot, child-change, child-lock and status-history step names returned | Filtering attributes, images, assembly identity and non-admin behavior were not fully audited. |
| Additive tables | Preset, spare part, part configuration, labor, material, cost and status-history tables exist | Existence alone does not prove valid data, privileges, keys or enabled features. |
| Package-priced columns | Package `re_packagepricedkone`, `re_materialbeforemarkup`; material `re_materialpricingmode` exist | The proposal still says design-only: source status text is stale for these columns' Dev existence. |
| Contract columns | Equipment `re_contractnumber`, `re_contractstatus` exist | Proposal status is likewise stale for column existence; app contract card remains removed. |
| Account display text columns | Neither `re_accountnumber` nor `re_accountname` returned | Account number/name are intended to be read from the linked Account, not stored as estimate text columns; current source deployment is unverified. |
| Estimate customer lookups | Initial read-only dry run found both `re_customeraccount` and `re_customercontact` missing on `re_repairestimate`; after authorization, both relationships were created and a separate dry run verified their targets, referenced attributes, and Restrict delete behavior with zero missing schema items | Schema is present in Dev. Plugin assembly/API and app bundle were not deployed or runtime-verified. |
| Customer source-ID row counts | Earlier read-only count returned 14 Accounts and 10 Contacts with non-null source IDs; the later collision scan reconfirmed 14 Accounts and 10 Contacts with relevant values. The earlier active-eligibility count was 14 under `CKE`, zero under `MKOF`/`CKQ`, and 10 Contacts | Active/eligibility counts have not been refreshed and do not prove source completeness or quality. No workbook master rows have been imported. |
| Destination key/collision preflight | A full read-only query scanned 14 Dev Accounts with AccountNumber/source ID and 10 Contacts with Email/source ID. All 14 Account and 10 Contact source IDs matched the workbook; no duplicate destination source keys, AccountNumber conflicts, native Contact-email collisions, AccountNumber mismatches, Contact email differences or Contact-parent mismatches were found | Comparisons used normalized values only in memory (case-insensitive, trimmed); no raw values were output or persisted and no rows were changed. This describes the current small destination population, not full-import batching or the quarantined source rows. |
| Import mapping metadata | Initial dry run found `re_sourceexportmetadata` missing from Account and Contact; both String columns (maximum length 2,000) were created/published and independently rechecked | Schema is present in Dev; no master rows were written. |
| Text limits | Customer name 100, phone 50, margin comments 2000, CTT notes 4000; equipment snapshot functional location 30 | These are narrower than some backend validators; see issue register. |

Production, flow connections, published frontend identity, security-role privileges and full source-data quality were **not** verified. The read-only collision scan compared hashed keys in memory; no raw customer values were output or persisted.

### Master-data mapping audit started 2026-11-04

The new four-workbook mapping request supersedes treating the preceding metadata
snapshot as current. A fresh **read-only** solution audit found 38 solution table
components; standard Account/Contact were additionally inspected, giving 40
table metadata inventories. No data import, schema write, deletion, relationship
change or feature activation has been performed by this audit.

| Area | Latest evidence | Import / relationship implication |
|---|---|---|
| Standard `account` and `contact` | Exist, but neither has `re_` integration columns or alternate keys; not among the 38 solution table components | Add approved source-ID contract/solution components before idempotent imports; do not match customer names |
| Contact -> Account | Native customer relationship exists | Resolve source `Account.Id` to account GUID; do not confuse text account numbers with lookup binding |
| Equipment integration key | Active `re_EquipmentNumber` unique key on **only `re_equipment`** | Must profile cross-market/branch duplicate numbers before adopting a composite key; cannot blindly insert duplicate numbers even if source composite differs |
| Equipment -> Account | No `re_account` lookup in latest equipment metadata | Existing account-name/number text fields do not establish relational integrity |
| Estimate -> Account/Contact | No corresponding custom lookups in the initial metadata inspection | Current local source now defines `re_customeraccount` and `re_customercontact`; Dev schema deployment remains unverified |
| Branch master | 241 active rows: MKO223, CKE15, CKQ3; no missing country/currency/SAP/SFDC code; no duplicate branch number | Code presence is not proof of correct source crosswalk |
| Mapped equipment branch | All 241 branch rows have no `re_mappedequipmentbranch` | Do not assume a servicing/plant mapping is already configured |
| Equipment schema drift | Many newer source columns exist, including `re_accountnumber/name`, `re_salesorganization`, plant/status/location/install/engineering/contract fields | Reuse compatible columns; do not recreate every proposed name |
| Market-source mapping table | `re_marketsourcemapping` not returned in exact table query | Source organization aliases must not be guessed from similar strings |
| Spare-part key | Active key on `re_sourcekey` | Preserve effective-price identity; material number alone is not unique pricing context |
| Existing transaction parents | Header/children and master lookups exist with mixed Restrict/RemoveLink/Cascade rules | Do not replace valid historical relationships or globally change cascade behavior |

#### Verified workbook structure, not record reconciliation

- Account: `Sheet2`, declared dimension A1:AB441210, 27 populated header columns
  through AA. `Id`, `AccountNumber`, source sales organization/country and billing
  columns exist.
- Contact: `Data`, A1:R386112; contact `Id`, `Account.Id`,
  `Account.AccountNumber`, active/primary/email/opt-out columns exist.
- Latest Equipment: `Equipment Master`, A1:BH428401; account ID is present,
  **Asset.Id and Location.Id are absent**. `Name` is equipment number,
  `Description` equipment name. Account roles, functional-location semantics,
  status eligibility and market-segment mapping require approved interpretation.
- Pricing: `Material`, A1:R37474. Four headers are all named
  `Condition currency`; positional mapping is mandatory: I for H priceUSD,
  M for L costUSD, P for O priceCAD, R for Q costCAD.
- Dimensions include headers and may include formatted/empty rows: **not exact
  record counts**. Full source duplicate/join/filter profiling is a separate step.
- Source Account/Contact identifiers and account-number storage require text-safe
  normalization; combined contact Name must not be guessed into first/last parts.
  Preserve email opt-out. No personal/customer rows belong in this document.

#### Required non-destructive mapping gates

1. Establish exact row counts, missing/duplicate immutable IDs and account joins.
2. Verify source organization -> market/country/plant/servicing branch crosswalk;
   distinguish import preservation from active dropdown eligibility.
3. Reconcile equipment global existing key against source cross-market identity;
   request Asset.Id/Location.Id before relying on unstable names.
4. Compare proposed field names to newer existing columns semantically (for example
   status/condition/postal/location/geographic fields), not just similar labels.
5. Validate date serials, four currencies, pricing units, precision and effective
   pricing key; keep catalog/export disabled independently.
6. Produce Create/Update/Unchanged/Rejected/Unmatched counts and verify repeat-run
   idempotency before applying approved batches. Do not silently drop rejects or
   delete/deactivate rows absent from the source.
7. Leave transaction/history/output tables and reference tables with no approved
   workbook mapping untouched. “All tables” is not permission to load the same
   worksheet into unrelated tables.
8. Wire frontend/Draft API/load/clone/preset/export contracts in a separate
   coordinated change before claiming autofill works end to end.

### Authorized live foundation applied, 2026-11-04

After explicit authorization to update live, the following additive changes were
applied and published **in the specified Dev solution**, not production:

| Component | Verified result |
|---|---|
| Account `re_salesforceaccountid` | Optional String18, source integration field created |
| Account alternate key | `account_re_salesforceaccountid_key`, Active |
| Contact `re_salesforcecontactid` | Optional String18, source integration field created |
| Contact alternate key | `contact_re_salesforcecontactid_key`, Active |
| Equipment account relationship | `re_customeraccount_re_equipment`, lookup `re_customeraccount` -> standard `account`, Delete Restrict |
| Solution components | Account/Contact root components and source-ID columns added; additive schema published |

**Necessary naming deviation:** creating proposed `re_account` lookup failed
because Dataverse's generated `re_accountName` conflicts with the existing
`re_accountname` text. That request failed; existing text was not renamed/deleted.
The successful replacement is **`re_customeraccount`**. Future queries, imports,
Draft API and frontend wiring must use the actual name, not the attachment's
proposal. Native Contact Account relationship remains unchanged.

[Foundation schema ledger](../backend/master-data-foundation-schema.json)
records deployed names and remaining gates. Earlier metadata sections are
historical snapshots and do not negate this newer live change.

Completed source profiling (not import):

- Accounts441209 actual records, no duplicate/missing source IDs.
- Contacts386111 actual records; all source Account.Id and account-number joins
  match Account Master exactly under the profiler's stored-value comparison.
- Equipment428400 actual records;411394 account-ID matches,17006 unmatched.
  Among matched IDs,122537 account-number disagreements and288857 agreements.
  A subsequent complete diagnostic established that **all 122537 disagreements
  are equivalent after leading-zero/integer-decimal formatting normalization**.
  None remains unexplained by that diagnostic; this is not evidence that the
  source Account.Id relationships are wrong. Preserve original number strings
  and resolve relationships by exact Account.Id, never by normalized numbers.
  All 17006 unmatched IDs are nonempty but absent from Account Master, not blank
  equipment Account.Id cells; those rows need separate source reconciliation.
- Equipment `(source organization,plant section,number)` has2 duplicate groups
  (4 records). A subsequent full number-only scan found 428398 distinct numbers
  across 428400 rows, 2 duplicate-number groups (4 records, largest group2), and
  no missing numbers/org/plant. Those duplicate records must be reconciled or
  explicitly quarantined before using the existing global unique key.
- Account numbers include191311 numeric-stored values; existing precision/leading
  zeros cannot be reconstructed by guessing. Source formulas require validation.
- Initial pricing profiling failed because the audit expected different header
  spellings. Corrected positional mapping completed all 37473 rows; see the
  newer pricing evidence below. The earlier combined report remains historical.

No business rows were imported/updated/deleted, no existing equipment lookups were
populated, no sharing changed, and no catalog/export feature enabled. Source
filters and unresolved joins remain import blockers, not silently skipped rows.
Adding these fields does not make Opportunity Account/Contact autofill work.

### Account/Contact import helper - local source only

[The importer](../automation/import-account-contact-masters.py) maps source
Account/Contact fields, retains the Salesforce export wrapper columns as JSON,
resolves Contact parent links through exact Account source IDs, rejects native
number/email collisions, and verifies writes when explicitly applied. Header
validation now fails before row reconciliation when a required, duplicate or
unmapped header is found; this prevents silently omitting source columns.

The importer defaults to a 10-row dry run and caps a run at 1,000 rows. Its
per-row API path is not a safe full-workbook batch method; resumable batching,
destination reconciliation, row-count reconciliation and batch verification
remain gates. The 15 focused Python tests and syntax check pass, but do not prove
full workbook or tenant behavior. No Account or Contact master rows were imported
or updated.

A full local source-only reconciliation of the configured workbook sheets was
completed on 2026-11-04. The Account `Sheet2` has 441,209 data rows with valid,
distinct 18-character source IDs and no duplicate groups. Four rows contain
Excel errors or uncached formulas and are quarantined: worksheet rows 5,248,
112,474, 164,627 and 305,303. The Contact `Data` sheet has 386,111 data rows
with valid, distinct source IDs and no duplicate groups or conflicts. All
Contact `Account.Id` values resolve to an Account source ID, and the source
account-number joins agree. Seven Contact rows contain Excel errors or uncached
formulas and are quarantined: worksheet rows 10,557, 92,161, 94,294, 181,719,
264,780, 274,959 and 314,867. The serialized Account and Contact export-wrapper
metadata maxima are 34 and 39 UTF-16 code units respectively, below the
proposed 2,000-character limit; no row exceeds it.

The importer’s exact XML/payload validation against current Dev field metadata
found 441,205 valid Accounts and 4 source-error/uncached-formula rows. For
Contacts it found 381,724 valid rows and 4,387 rows that must remain quarantined
unless an explicit, lossless mapping is approved: 7 source-error/formula rows;
4,317 rows with ambiguous numeric-to-text cells (4,304 Phone, 101 MobilePhone,
and 1 Title cell occurrences; a row may contain more than one); 37 source names
too long for native `lastname`; 25 titles too long for native `jobtitle`; and
one missing importable parent. That Contact is worksheet row 3,406, whose
parent is one of the four quarantined Account rows. Numeric phone/title cells
are not coerced, and overlength values are not truncated. The valid-plus-reject
counts reconcile to all 441,209 Account and 386,111 Contact source rows.

An earlier preliminary report mislabeled 42,497 as duplicate Contact IDs. The
complete XML and independent ID scans found 386,111 unique Contact IDs and no
duplicate IDs. The 42,497 figure is instead the number of additional Contact
rows in 30,325 repeated-email groups. Source-managed Contacts are identified by
Salesforce Contact ID and are retained even when Email repeats; Email is not an
identity key.

The source validation checks live field lengths and parent resolution. The
separate read-only Dev scan found no collision in the existing 14 Account /
10 Contact destination population; it did not test a bulk-write API or
destination state changes during a future import. Safe resumable batching,
verified row-count reconciliation, and explicit handling of the quarantined
source rows are still required before any record write.

### Additional live mapping columns and corrected pricing profile

After admin authorization, **13 additional optional columns were created and
published in Dev**, with existing native fields and business records preserved.
The [schema ledger](../backend/master-data-foundation-schema.json) records exact
source headers, types and maximum lengths. Source headers were read directly
from the two workbooks, without logging customer rows.

| Table | Published columns | Purpose |
|---|---|---|
| `account` | `re_salesorganizations` (20), `re_konecountry` (100), `re_ownersalesoffice` (50), `re_ownerbranchoffice` (100) | Preserve source organization/country/office codes independently of unapproved branch/market crosswalks |
| `account` | `re_activekonecustomer` (Boolean), `re_industrysegment` (100), `re_customertype` (100), `re_customergroup` (100), `re_customerlanguage` (10) | Preserve source classification and later explicit dropdown eligibility |
| `contact` | `re_salesforcename` (300), `re_primarycontact`, `re_sourceactive`, `re_linkedtoactivekonecustomer` (three Booleans) | Preserve combined source name and eligibility flags; no invented first/last split |

Booleans are optional with platform default false. On existing/unimported rows
this is **not evidence of a source false**: require populated source integration
ID and validated import completion before applying source-based eligibility.
Native `donotemail` remains the intended opt-out destination; it is not replaced
by the new active/primary flags. Lengths are schema capacities, not permission to
truncate source values: importer must reject/report overflow.

[Deployment tool](../automation/deploy-master-foundation.ps1) is **Dev-only**,
defaults to read-only dry run, verifies the exact solution and required active
source keys, rejects incompatible existing types/lengths/lookup targets before
creating anything, then creates missing supported String, Boolean, Integer,
Decimal and Lookup columns with explicit `-Apply`; lookup targets are explicit.
It does not create missing alternate keys, import records, change sharing or
enable features. Metadata changes are not transactional:
after a failure inspect partial changes and rerun. Missing optional columns
do not reset or overwrite existing columns.

Validation: the live dry run listed 13 missing columns; Apply created/published
all 13; a separate invocation re-read metadata and reported **0 missing columns**.
Existing identity keys were re-verified Active and Equipment Account lookup
remained compatible. All five documentation guard tests passed.

### Import metadata and estimate customer relationships

After separate authorization, two additional Account/Contact
`re_sourceexportmetadata` String columns (maximum 2,000) and two optional
`re_repairestimate` lookups were created and published in Dev:
`re_customeraccount` -> `account` and `re_customercontact` -> `contact`.
The relationships use `Delete=Restrict` and hidden associated menus. Lookup
creation uses `RelationshipDefinitions`, not direct LookupAttribute creation.
An independent read-only deployment dry run verified both targets, referenced
primary attributes, relationship attributes, and delete behavior and reported
**0 missing schema items**. The source schema ledger records the definitions.

This was a schema-only deployment. No Account/Contact business rows, plugin
assembly, or frontend bundle were deployed or updated; app/API behavior is not
live-verified. Full source rejects and destination collisions remain import
gates.

Corrected pricing audit (source-only, not imported or activated):

- 37473 nonempty records; all are organization `MKOM`, channel `01`, type `ZR00`.
- Currency columns I/M are USD and P/R CAD on every row; all pricing units are
  positive. Duplicate header names are resolved by position, never by a dictionary
  that would overwrite one currency with another.
- All three audited contextual key candidates are complete and unique within
  this workbook. Condition record numbers are text with leading zeros.
- 12 USD cost cells and 12 CAD cost cells contain Excel errors; do not convert
  these to zero or import them as valid costs.
- Both price columns contain 23809 zeros and 13664 positive values. Zero price
  is source data, not automatically a valid selling-price fallback.
- At audit date 2026-11-04, 17503 rows are effective, 19825 expired, 145 future.
  Preserve history; default dropdown activation requires valid cost and date
  eligibility plus approved market mapping, not merely presence in the sheet.
- 74946 formula cells were inspected using cached values, never executed.

No plugin DLL or frontend bundle was changed/deployed by this schema extension.
Account/Contact master import, equipment reconciliation and selected-lookup
deployment remain pending; this is not a claim that every table is now populated.

### Customer master lookup implementation - current local source only

The current source change adds two optional estimate lookup definitions in
[master-data-foundation-schema.json](../backend/master-data-foundation-schema.json)
and wires the UI through the existing `re_DraftEstimate` Custom API. Account
search uses the selected market's explicit source-organization alias; Contact
search is restricted to the selected Account. Save resolves both IDs again,
requires an active imported Account whose source organization matches the
estimate market, and requires an active imported Contact whose native
`parentcustomerid` is that Account. Customer name/email/phone are derived from
Contact fields by the plugin. Load returns the linked IDs and reads Account
number/name for display. Private Opportunity presets retain both lookup IDs and
Account labels, and preset Save revalidates the relationship.

The lookup schema was created and read-only rechecked in Dev, but the code
behavior remains **source-only**: the updated plugin assembly and frontend
bundle were not deployed or runtime-verified. No Account/Contact business
records were imported or updated. A non-admin Dev save/load test remains
necessary after API/app deployment and master import.

## 2. Architecture: where authoritative data lives

```text
Power Apps identity / Dataverse roles
  -> React UI
     -> generated SDK services: master/reference reads, master CRUD, user preferences
     -> re_DraftEstimate(InputJson -> ResultJson)
        -> DraftPlugin validation + transaction
           -> estimate header + equipment/package/labor/material snapshots
           -> selected Account/Contact lookup validation and reference persistence
           -> final header touch -> synchronous pricing plugin -> saved outputs
           -> legacy Submit OR gated re_EstimateExport queue
     -> saved-price query with matching row version -> Pricing / CMII display

Gated export:
  queue -> frozen payload/outbox -> authorized flow -> workbook -> email acceptance
        -> finalize -> Submitted header + status history
```

- The browser is **not** the authoritative pricing engine. Package previews are not proof of saved totals.
- Estimate children are historical snapshots, not live master rows. Editing a master does not intentionally reprice every existing snapshot.
- Normal estimate Save does not create equipment, branches, customer accounts or contacts.
- Current local draft source writes only lookups to already imported Account/Contact masters; it does not create those masters or prove they have been imported.
- Dataverse owns system fields, money base-currency companions, security and row versions.
- Main sources: [DraftPlugin](../backend/DraftPlugin.cs), [repository](../src/data/repairEstimatorRepository.ts), [pricing plugin](../backend-pricing/Plugins/EstimateCalculationPlugin.cs), [pricing writer](../backend-pricing/Plugins/CalculationWriter.cs), [export plugin](../backend-pricing/Automation/ExportRequestPlugin.cs).

## 3. Button/action-to-Dataverse matrix

| User action / surface | Reads | Writes / persisted result | Important boundary |
|---|---|---|---|
| Start application / sign in | Power Apps identity, roles, estimate privileges | May create/repair user's preference row | A UI role is not a replacement for Dataverse security. |
| Language / theme / locale settings | `re_appuserpreference` | Same user's language, locale, theme | Errors and unsaved preference state are shown; no browser-storage fallback. |
| Dashboard / estimate search / filters / paging | Estimates; `dashboard` API | None | Dashboard initiating-user scope; security still governs reads. |
| Sidebar New Request / return to workspace | References if needed | None | Reopens existing in-memory workspace, does not reset it. |
| Explicit New draft / dashboard start-new | Reference lists | None until Save | Confirmed reset discards unsaved workspace; Cancel preserves it. |
| Opportunity Name / customer / building / flags | References and live choices | Header only on Save/Calculate | Most edits are unsaved React state first. |
| Search/select Account | `accountsearch`, active imported Account masters in current market | `re_customeraccount` on draft Save | Server rechecks source ID and organization; deployed API/app search and admin sample Save/Load verified 2026-11-05. Full import/non-admin acceptance remain incomplete. |
| Search/select Contact | `contactsearch`, active imported Contacts under selected Account | `re_customercontact`; Contact details supply header customer name/email/phone | Server rechecks parent relationship and active/imported status; Contact must have valid name/email. |
| Select branch | Branch, country/currency/province references, labor-rate previews | Header branch/context on Save | Current province is branch-derived; no installation-address master lookup. |
| Customer name / email / phone | Selected Contact master fields | Header text is populated by the plugin from the validated Contact | The client cannot override the master values; phone is optional. |
| Equipment search | Active branch equipment, number/name prefix, top 20 | None until Save | Five-way account/sold-to search is not implemented. |
| Select/add matched equipment | Equipment master | Estimate-equipment lookup and server snapshots on Save | Validates active, branch and exact number. |
| Add manual/unmatched equipment | No new master lookup required | Estimate-equipment snapshot on Save | Does **not** create `re_equipment`. |
| Equipment workbook import | Local workbook plus master-number resolution | Estimate selections on later Save | Not a master-data upload to Dataverse. |
| Remove equipment / selected package / custom line | Workspace state | Reconciled child deletion on successful Save | Removing a master selection does not delete the master. |
| Select package / package cards | Active effective package in country/currency; preview rates | Package snapshot on Save | Quantity scales with selected equipment count. |
| Add/edit CSTM labor | Branch/role/time effective labor rate | Labor child, frozen hourly rate and total on Save | Each CSTM needs at least one labor and material line. |
| Add/edit manual material | Entered part, vendor, amount, flags | Material child and costs on Save | Current KONE/non-KONE and markup semantics still exist. |
| Catalog material search | `partcapabilities` / `partcatalog`, gated part configuration | No catalog master writes; estimate snapshot on Save | Disabled/invalid configuration prevents selection. |
| Package-priced KONE reference | Package material-before-markup | Package opt-in and material pricing-mode snapshots | Separate from spare-part catalog path. |
| Save draft | Live validations, previous header/children/row version | Header + child reconciliation; calculation trigger | Atomic Dataverse transaction; stale version rejected. |
| Calculate (Pricing / CMII) | Same Save path, then saved header pricing | **Saves the draft** and requests backend calculation | Not a browser-only calculation button. |
| Load/reload saved draft | `load`, header and children | None | Reload replaces workspace only after confirmation where dirty. |
| Review / summary navigation | Workspace + saved pricing | None by navigation alone | Displays selected Account and Contact details from workspace state. |
| Clone existing request | `clonesource`, current reference validation | New workspace; later Save creates new estimate | No original header/child mutation; no automatic master writes. |
| List/apply Opportunity preset | User-owned preset + current references | Applying only changes workspace | Does not create an estimate until Save. |
| Save/delete Opportunity preset | `presetsave` / `presetdelete` | Only own `re_opportunitypreset` row | Server exact-user ownership even for admins. |
| Submit with export disabled | Saved estimate/pricing | Submitted status and submitted timestamp | Full server validation; no workbook/email sent by legacy path. |
| Submit with export enabled | Config, header, children, pricing | Export outbox + header link/lock; later finalize submits | Currently disabled in Dev configuration. |
| Master-data search/view/paging | Approved master tables + live metadata | None | Not every Dataverse table has an admin page. |
| Master-data Create / Save / activate / deactivate | Form metadata / original row | Direct SDK Create/Update; statecode/statuscode for activation | Requires actual Dataverse privileges; no hard-delete surface in this repository path. |
| Removed contract-equipment card | No current UI calls | None | Backend `contractcapabilities`, `contractsearch`, `contractresolve` retained and read-only. |

Sources: [App](../src/App.tsx), [workspace](../src/EstimatorWorkspace.tsx), [PricingSummary](../src/PricingSummary.tsx), [master CRUD](../src/data/masterDataRepository.ts), [master inventory](../src/data/masterDataSchema.ts), [preferences](../src/data/userPreferences.ts), [presets](../backend/OpportunityPresets.cs), [catalog](../backend/PartCatalog.cs), [contracts](../backend/ContractEquipment.cs).

## 4. Transaction tables and relationships

| Logical table | Entity set | Who writes / purpose |
|---|---|---|
| `re_repairestimate` | `re_repairestimates` | Draft API header; optional Account/Contact master lookups in current local source; pricing outputs; submitted/export state |
| `re_estimateequipment` | `re_estimateequipments` | Draft API + snapshot plugins; links estimate to optional master equipment |
| `re_estimatepackage` | `re_estimatepackages` | Draft API + snapshot plugins; links estimate to master package |
| `re_estimatelaborline` | `re_estimatelaborlines` | Draft API + custom-line snapshot plugin; estimate/package and optional equipment/rate lookup |
| `re_estimatematerialline` | `re_estimatemateriallines` | Draft API + material snapshot logic; estimate/package and optional spare-part lookup |
| `re_estimatecostline` | `re_estimatecostlines` | Legacy/additional schema; **not written by current Draft Save reconciliation** |
| `re_estimatestatushistory` | `re_estimatestatushistories` | StatusHistoryPlugin on status Update; system service with initiating-user attribution |
| `re_appuserpreference` | `re_appuserpreferences` | Direct frontend preference SDK, bound to `systemuser` |
| `re_opportunitypreset` | `re_opportunitypresets` | Preset API, private user-owned payload |
| `re_estimateexport` | `re_estimateexports` | Export API only; immutable payload and delivery lifecycle |
| `re_exportconfiguration` | `re_exportconfigurations` | Administrator configuration, not ordinary estimator writes |

Draft children carry `re_repairestimate`; packages additionally carry `re_repairpackage`, labor/material `re_estimatepackage`. Owner and transaction currency are carried where applicable. Existing child IDs/snapshots are reused when identity/pricing context matches; removed rows are deleted in dependency-aware order.

**Security:** Main draft mutations use the plugin execution user service; read-only dashboard/contract/preset operations use initiating-user scope as implemented. Pricing can read configuration using system service. Status history is created by system service but records `re_changedby` as initiating user. Verify registration impersonation and role depth; do not assume all writes run with the browser's permissions or all run as system.

## 5. Opportunity fields: exact persistence mapping

| UI/input | Dataverse column | Current rule / limit |
|---|---|---|
| Opportunity Name (`title`) | `re_estimatename` | Required, backend 100 |
| Functional Location Description (`building`) | `re_buildingname` | Required, 300; label changed, logical column did not |
| Account ID (`accountId`) | `re_customeraccount` -> `account` | Optional Lookup deployed in Dev; local Save source requires an active source-imported Account matching `re_market` |
| Contact ID (`contactId`) | `re_customercontact` -> `contact` | Optional; when supplied must be active/source-active/imported under the selected Account; omission clears the lookup |
| Customer name (`customer`) | `re_customername` | Required, 100; master source name then fullname; manual snapshot only when no nonblank master value exists |
| Customer email (`email`) | `re_customeremail` | Required valid email, 100; nonblank master email preferred, otherwise manual snapshot |
| Customer phone (`phone`) | `re_customerphone` | Optional, 50; master telephone/mobile preferred, otherwise manual snapshot |
| Contact master detail (`contactMaster`) | No new column | Response/preset/clone metadata only; distinguishes manual snapshot fields from available shared master values |
| Account number / name | No separate estimate text columns; returned from linked Account | Read-only display values; server resolves linked Account on Load. Presets retain these display values with IDs. |
| Branch | `re_branch` | Active branch; country/currency resolved server-side |
| Market | `re_market` | Choice checked against branch/context |
| Country / currency | `re_country`, `transactioncurrencyid` | Derived from branch |
| Province/state | `re_buildingprovincestate` | Active, country-compatible; French-required enforced |
| Equipment type / job type | `re_equipmenttype`, `re_jobtype` | Active lookups; job type can be empty |
| Salesperson | `re_salesperson` | New request signed-in user; saved request retains snapshot |
| Supervisor | `re_supervisor` | Optional, 100 |
| Prospect account / Sold-to / Bill-to / Payer | `re_prospectaccount`, `re_soldto`, `re_billto`, `re_payer` | Optional strings, 50; **not** Account relationships |
| Additional scope | `re_additionalscope` | Memo; backend 10000 |
| Margin comments | `re_margincomments` | Backend 10000, **Dev 2000**; required for below-target submit |
| CTT notes | `re_notesforcttteam` | Backend 10000, **Dev 4000** |
| Number of technicians | `re_numberoftechs` | Server validated integer |
| Work-center request / approved / national account | `re_workcenterrequest`, `re_hasbeenapproved`, `re_nationalaccount` | Valid live choice values |
| Emergency / budgeted / paper / consultant / competing bids | `re_emergency`, `re_customerbudgeted`, `re_papertype`, `re_consultantinvolved`, `re_competingbids` | Valid live choices |
| Proposal language / time / billing plan | `re_proposallanguage`, `re_timecategory`, `re_billingplan` | Choices; time global set spelling is `re_timecateogry` |
| Extra labor hours / use tax / freight | `re_additionallaborhours`, `re_usetax`, `re_freight` | Decimal inputs, not precomputed amount fields |
| Subcontractor / stated labor / extra material / misc | `re_subcontractorcost`, `re_statedlaborrate`, `re_additionalmaterial`, `re_additionalmiscellaneous` | Money inputs |
| Selling price / KONE spares sales price | `re_sellprice`, `re_konesparessalespricevk13` | Money; KONE spares requires CSTM |

The accepted fields are explicit allowlists in [DraftPlugin](../backend/DraftPlugin.cs) and [draft contract](../src/data/draftContract.ts); arbitrary UI fields do not automatically persist.

### Customer master lookup lifecycle

Local navigation can proceed beyond Opportunity without Account/Contact/email
after the user-approved testing unblock. Branch, building and equipment type
remain required for that navigation; Save/Submit still require valid imported
customer selections and all existing full validation. No placeholder Account,
Contact or Estimate is created by Continue, and no data schema/API/permissions
were changed for this unblock. Five focused mocked EN/FR browser tests passed,
including navigation through Review and zero draft writes; build passed.
The source change has not been published to the shared app. This is not the
separately requested editable/manual master-writeback feature.

Account/Contact search is source-only through `re_DraftEstimate` and does not add direct Account/Contact SDK data sources. Account results are active imported records scoped to the current market (`MKOF` -> MKO, `CKE` -> CKE, `CKQ` -> CKQ); Contact results are active imported records under that Account and require email. On Save the plugin ignores client-supplied Contact text, resolves IDs again, validates Account market/Contact parent, writes the optional header lookups and derives Contact name/email/phone. On Load it returns those IDs/details and reads Account number/name from the linked record. Clones carry linked IDs; presets save them and server-revalidate them. Older estimates/presets without IDs remain parseable but must select an Account/Contact before a new linked save.

The four additive metadata/estimate relationship components are deployed and
their Dev metadata was rechecked read-only. The plugin/API assembly and
frontend bundle are **not deployed or runtime-verified**, and no master rows
have been imported. Building address/site data stays manual; no billing
address is inferred from Account.

### Columns existing in schema but not editable/persisted by normal Opportunity Save

Examples: `re_buildingaddress`, `re_buildingcity`, `re_workcenter`, `re_internalcomments`, `re_pricingjustification`, `re_scopeofwork`, `re_scopelibraryitem`, `re_parentestimate`, `re_finalsellprice`, `re_estimatelanguage`, `re_languagelocale`. Do not assume such columns are filled because they appear in a model. Some columns are plugin-owned or legacy; check the writer before adding a new mapping.

## 6. Save, snapshots, reload, clone and presets

1. Frontend validates required/HTML inputs, captures selections and sends the draft JSON.
2. API requires synchronous transaction context; payload budget is 200000 bytes and child-operation budget 1000.
3. Existing request status/version is checked. Update uses optimistic concurrency (`IfRowVersionMatches`), not last-writer-wins.
4. Header context/choices and selected Account/Contact are revalidated. Account must be an active imported source master matching market; Contact must be an active imported source master under that Account. New header is Draft `126110000`, revision 1, with salesperson.
5. Plugin writes `re_customeraccount` / `re_customercontact` and derives header customer name/email/phone from Contact. It does not trust UI-supplied Contact details.
6. Equipment snapshots copy number/name/location/sold-to/vertical/OEM/age from master. Unmatched equipment uses entered description/location/OEM/age and customer fallback; age 0..200.
7. Packages validate active status, country, currency, effective dates and nonnegative hours/costs. Snapshot quantity is equipment count; totals scale once per equipment.
8. CSTM rows validate package associations, labor/material presence, numeric ranges and server rate/catalog snapshots.
9. Reconcile child Create/Update/Delete using batch tags to avoid premature recalculation.
10. Final header `re_numberofequipment` touch triggers one calculation after children are present.
11. Load returns header inputs, Account/Contact references and master-derived details, child snapshots, row version, pricing state and export delivery state. Frontend reads saved pricing for that version.

Existing snapshots are preserved on unrelated edits. A changed rate role/time, changed package/material pricing context, or a new selected master can require fresh validation/snapshot. Snapshot preservation is deliberate historical behavior, not evidence that master changes were ignored incorrectly.

Labor hours: positive, <=100000, two decimals. Material quantity: whole 1..100000. Manual unit-cost validation: positive, <=1000000000, two decimals except server-priced package references. Package-priced references are descriptive; do not count their quantity as another package material charge.

Presets persist only a restricted Opportunity payload: branch/market/reference context, selected Account/Contact IDs and Account display labels, plus allowed defaults (supervisor, work-center request, tech count, national account, emergency, budgeted, paper, consultant, competing bids, language). They are not full estimate backups. Using a preset revalidates current references. Calculated results are not part of presets.

Cloning reads the source without mutating it, revalidates current selections, and produces a new unsaved workspace. Do not reuse original row IDs as newly saved child identity. Source: [clone logic](../src/data/requestClone.ts), [clone validation](../src/data/cloneValidation.ts), [presets](../backend/OpportunityPresets.cs).

## 7. Pricing / CMII: saved outputs and failure behavior

### Authoritative calculated columns

All columns below are on `re_repairestimate`, written by [CalculationWriter](../backend-pricing/Plugins/CalculationWriter.cs), not by the UI as authoritative totals:

| Group / type | Columns |
|---|---|
| Counts / decimal hours | `re_numberofequipment`, `re_packagelaborhours`, `re_redundancycount` |
| Cost money | `re_mechaniclaborrate`, `re_packagelaborcost`, `re_packagematerialcost`, `re_packageestimatedcost`, `re_additionallaborcost`, `re_usetaxamount`, `re_freightamount`, `re_totaladditionalcost`, `re_customlaborcost`, `re_custommaterialcost`, `re_konematerialcost`, `re_laborcost`, `re_materialcost`, `re_miscellaneouscost`, `re_totaltruecost` |
| Price / incentive money | `re_medianmarginsellprice`, `re_suggestedprice`, `re_suggestedsellprice`, `re_suggestedpricewithkonematerial`, `re_amincentive`, `re_bdincentive` |
| Margin / adjustment decimals | `re_basetargetcm2`, `re_basetargetcmii`, `re_situationaladjustment`, `re_totaladjustment`, `re_targetcm2`, `re_adjustedtargetcmii`, `re_statedratemargin`, `re_recommendedcmii`, `re_actualcmii`, `re_cmiivariance` |
| Choice/bands | `re_quotetype`, `re_oemband`, `re_equipmentageband`, `re_equipmentband`, `re_verticalband`, `re_redundancyband`, `re_customerbaseband`, `re_nationalaccountband`, `re_customerband`, `re_jobtyperating`, `re_jobtypeband`, `re_primaryequipmentfound`, `re_approvallevel` |
| Lookups | `re_jobsizeband`, `re_margingroup`, `re_marginrule` |
| Approval boolean / metadata | `re_requiresapproval`, `re_calculatedon`, `re_calculationversion` |
| Synchronized rate inputs | `re_usetax` / `re_usetaxpercentage`, `re_freight` / `re_freightpercentage` |

CMII fields are fractional decimals in backend calculations (e.g. 0.25 means 25%); do not compare UI percent display directly to stored fractions. Money `_base` companions are platform-owned base-currency amounts, not the estimate-currency source.

Current source pricing engine is `2026.8`; the read-only audited saved sample still records deployed calculation `2026.7`. CAD catalog cost **and price** apply FX and approved uplift. KONE material tax/freight use entered rates and applicability, with current markup semantics. Removing KONE/non-KONE/markup was requested earlier but **not implemented**.

### Why Calculate can save but show no calculated values

The pricing plugin catches **PricingException for Drafts**, traces the reason, clears outputs and stamps `re_calculationversion="unavailable"`. Therefore a successful Save does not always mean successful calculation. Non-Draft/Submit failures throw and block the transaction.

The UI requires matching saved row version, finite amounts and complete core outputs. It must not show stale results from an earlier save. The local feedback change shows save/validation errors next to PricingSummary and calculating status; it does not change formulas or prove the original live failure was solved.

### Troubleshooting sequence

1. Confirm the published frontend and both plugin assemblies correspond to the intended source.
2. Confirm Save actually reached `re_DraftEstimate`; inspect error response without exposing payload/customer details.
3. Check saved header `re_calculationversion`, `re_calculatedon`, current row version and core outputs.
4. If `unavailable`, inspect plugin trace for the pricing error key, not only the HTTP success.
5. Verify branch/country/currency, current package snapshots, CSTM lines, effective unique labor rate and configuration.
6. Verify margin group/rule, matrices, job-size/OEM/redundancy/vertical data and missing/overlapping rules.
7. Verify calculation Update filtering attributes include the final header touch and correct `pre` image.
8. If saved outputs are complete but UI blank, inspect version mismatch/read privileges/query/result parsing.
9. Test as an estimator, not only administrator. Verify zero versus null values explicitly.

## 8. Master/reference table and column inventory

These **21 approved admin master tables** come from [master inventory](../src/data/masterDataSchema.ts) and [projected schemas](../.power/schemas/dataverse). Normal estimator use reads them; admin master forms can Create/Update/activate/deactivate allowed fields via SDK. Live metadata is merged with local projected forms; an unprojected new column may not automatically appear.

Notation: all listed names are logical columns. `S(n)` = String maximum n; `D` = Decimal; `I` = Integer; `M` = Money; `L` = Lookup; `C` = Choice/Picklist; `B` = Boolean; `T` = DateTime; `Memo(n)` = multiline text maximum n. Each custom table's ID is its logical name + `id` except the explicit sales-office name below. Common system columns are described after the inventory. Types/lengths here are projected contracts, not a fresh complete live-schema certification.

| Logical table / entity set | Custom business columns and types |
|---|---|
| `re_country` / `re_countries` | `re_nameen`, `re_namefr` S(100); `re_isocode` S(2); `re_defaultcurrency` L; `re_defaultlanguage` C |
| `re_stateprovince` / `re_stateprovinces` | `re_nameen`, `re_namefr` S(100); `re_code` S(5); `re_country` L; `re_defaultfreight`, `re_defaultusetax` D; `re_defaultlanguage` C; `re_frenchrequired` B |
| `re_branch` / `re_branchs` | `re_branchname` S(850); `re_branchnumber`, `re_sapmainbranch` S(10); `re_sfdcbranch` S(100); `re_district` S(50); `re_country`, `re_currency`, `re_stateprovince`, `re_margingroup`, `re_mappedequipmentbranch` L; `re_market`, `re_defaultlanguage` C; `re_defaultfreight`, `re_defaultusetax` D |
| `re_salesoffices` / `re_salesofficeses` | ID `re_salesofficesid`; `re_code` S(10); `re_district` S(50); `re_branch` L |
| `re_margingroup` / `re_margingroups` | `re_name` S(100); `re_anchorbranch`, `re_country` L |
| `re_equipmenttype` / `re_equipmenttypes` | `re_equipmenttype` S(100); `re_nameen`, `re_namefr` S(300); `re_typecode` S(20); `re_fixedtargetcmii` D |
| `re_equipment` / `re_equipments` | `re_equipment` S(850); `re_equipmentname`, `re_soldtoname` S(300); `re_soldtonumber` S(20); `re_functionallocation`, `re_oem` S(100); `re_verticalcode`, `re_district` S(50); `re_equipmentage` I; `re_branch`, `re_customervertical`, `re_salesoffice` L; contract extensions below |
| `re_customervertical` / `re_customerverticals` | `re_nameen`, `re_namefr` S(300); `re_verticalcode` S(50); `re_verticalband` C |
| `re_jobtype` / `re_jobtypes` | `re_jobtype` S(850); `re_jobtypecode` S(50); `re_jobtypeen`, `re_jobtypefr` S(100); `re_rating` C |
| `re_packagecategory` / `re_packagecategories` | `re_name` S(20); `re_nameen`, `re_namefr` S(300); `re_sortorder` I |
| `re_repairpackage` / `re_repairpackages` | `re_packagenumber` S(20); `re_packagenameen`, `re_packagenamefr` S(500); `re_version` S(50); `re_proposalscopeen`, `re_proposalscopefr` Memo(10000); `re_internalscopeen`, `re_internalscopefr` Memo(4000); `re_mechanichours` D; `re_materialbeforemarkup`, `re_materialmisctaxcost` M; `re_country`, `re_currency`, `re_packagecategory` L; `re_iscustompackage`, `re_istimematerial` B; `re_effectivefrom`, `re_effectiveto` T |
| `re_scopelibrary` / `re_scopelibraries` | `re_name`, `re_namefr` S(300); `re_repairtype` S(100); `re_scopeen`, `re_scopefr` Memo(10000) |
| `re_laborrate` / `re_laborrates` | `re_name` S(200); `re_branch`, `re_currency` L; `re_laborrole`, `re_timecategory` C; `re_hourlycost` D; `re_effectivefrom`, `re_effectiveto` T |
| `re_jobsizeband` / `re_jobsizebands` | `re_name` S(50); `re_minimumamount`, `re_maximumamount` M; `re_complexityband`, `re_quotetype` C; `re_sortorder` I; `re_effectivefrom`, `re_effectiveto` T |
| `re_redundancyband` / `re_redundancybands` | `re_name` S(50); `re_minimumequipment`, `re_maximumequipment` I; `re_redundancyband` C; `re_effectivefrom`, `re_effectiveto` T |
| `re_oembandrule` / `re_oembandrules` | `re_name` S(100); `re_oemband` C; `re_effectivefrom`, `re_effectiveto` T |
| `re_bandmatrix` / `re_bandmatrixes` | `re_name` S(100); `re_input1band`, `re_input2band`, `re_matrixtype`, `re_resultband` C; `re_effectivefrom`, `re_effectiveto` T |
| `re_marginrule` / `re_marginrules` | `re_name` S(200); `re_margingroup` L; `re_customerband`, `re_equipmentband`, `re_jobtypeband`, `re_quotetype` C; `re_targetcm2` D; `re_effectivefrom`, `re_effectiveto` T |
| `re_situationaladjustment` / `re_situationaladjustments` | `re_name` S(200); `re_inputvalue` S(50); `re_adjustment` D; `re_adjustmenttype`, `re_requirespapertype` C; `re_isapplied` B; `re_effectivefrom`, `re_effectiveto` T |
| `re_incentiverate` / `re_incentiverates` | `re_name` S(50); `re_country` L; `re_incentiveyear` I; `re_ampayout`, `re_bdpayout`, `re_minimumcmii`, `re_spif` D; `re_effectivefrom`, `re_effectiveto` T |
| `re_pricingparameter` / `re_pricingparameters` | `re_name` S(50); `re_description` S(300); `re_textvalue` S(100); `re_decimalvalue` D; `re_country` L; `re_effectivefrom`, `re_effectiveto` T |

### Other standard/reference data

- `transactioncurrency` / `transactioncurrencies`: `transactioncurrencyid`, `isocurrencycode`, currency name/symbol/precision/exchange metadata as projected; selected currency context, not editable through the 21-master inventory.
- `role` / `roles`, Power Apps user context and privilege Custom APIs: access resolution; no security-role assignment UI is implemented here.
- `systemuser`: preference binding, salesperson, owners and history attribution; no user-account provisioning.
- Earlier metadata audit found no standard Account/Contact fetch in Opportunity. Current local source adds lookup/search behavior through the Draft API; workbook headers alone still do not prove implementation or deployment.

### System / derived columns

For full per-table fields, required flags, precision, min/max, navigation targets and generated formatted companions use the linked schema JSON and live metadata. `createdon`, `createdby`, `modifiedon`, `modifiedby`, delegate fields, `ownerid`, owning user/team/business unit, `statecode`, `statuscode`, `versionnumber`, import/timezone fields and transaction currency/exchange fields exist where supported. GUID primary IDs identify records. SDK lookup reads often use `_re_<lookup>_value`; writes use navigation `@odata.bind` or EntityReference.

Formatted lookup/choice labels (`...name`, `...yominame`), virtual choice columns and money `_base` columns are not additional user-entered business fields and must not be independently saved. Schema availability is table-specific.

## 9. Transaction-column dictionary

### Estimate header

Inputs are in section 5; calculation outputs are in section 7. Additional projected header columns:

- GUID: `re_repairestimateid`; name `re_name` S(850).
- Memo: `re_additionalequipmentnumbers` (2000), `re_buildingaddress` (2000), `re_internalcomments` (2000), `re_pricingjustification` (2000), `re_packagenames` (4000), `re_scopeofwork` (10000).
- String: `re_buildingcity`, `re_workcenter`, `re_languagelocale` (100).
- Choice: `re_estimatelanguage`, `re_estimatepath`, `re_estimatestatus`, `re_estimatetype`.
- Integer: `re_revisionnumber`, `re_totalequipmentinbuilding`.
- Lookup: `re_customervertical`, `re_parentestimate`, `re_scopelibraryitem`.
- Money: `re_finalsellprice`; Decimal: `re_cmiiwithkonematerial`; DateTime: `re_submittedon`.
- Export extensions: `re_exportrequest` L -> `re_estimateexport`; `re_exportlockversion` I >=0.

**Writer caveat:** `re_cmiiwithkonematerial` is included in output clearing, but the inspected CalculationWriter does not assign a successful value to it. Do not advertise it as a reliably populated output without finding/verifying another writer.

### Equipment snapshot (`re_estimateequipment`)

GUID `re_estimateequipmentid`; `re_name` S(100), `re_equipmentnumber` S(20), `re_equipmentnamesnapshot` S(300), `re_functionallocation` S(30), `re_soldtoname` S(300), `re_soldtonumber` S(20), `re_verticalcode` S(50), `re_oem` S(100); `re_equipmentage`, `re_sequence` I; `re_isprimary` B; `re_equipment`, `re_repairestimate` L. First selected equipment is primary.

### Package snapshot (`re_estimatepackage`)

GUID `re_estimatepackageid`; `re_name` S(200), `re_packagenumber` S(20), `re_packagenameen`, `re_packagenamefr` S(500); `re_proposalscopeen`, `re_proposalscopefr` Memo(10000); `re_mechanichoursperunit`, `re_totalhours` D; `re_materialcostperunit`, `re_totalmaterial` M; `re_quantity` I; `re_packagerole` C; `re_repairestimate`, `re_repairpackage` L.

Backend also uses `re_sequence`, `re_iscustompackage`, `re_istimematerial` snapshot attributes not in the inspected projected package inventory. Additive schema defines `re_packagepricedkone` B and `re_materialbeforemarkup` M. Verify/regenerate metadata rather than assuming generated projections include every server attribute.

### Labor lines (`re_estimatelaborline`, live custom-column metadata)

GUID `re_estimatelaborlineid`; `re_name` String; `re_repairestimate`, `re_estimatepackage`, `re_estimateequipment`, `re_laborrate` L; `re_laborrole`, `re_timecategory` C; `re_hours` D; `re_hourlycost`, `re_totalcost` M. Lookup label companions are derived.

### Material lines (`re_estimatematerialline`, live custom-column metadata)

| Type | Custom columns, excluding derived labels/base amounts |
|---|---|
| GUID | `re_estimatemateriallineid` |
| String | `re_name`, `re_estimatematerialline`, `re_partnumber`, `re_vendor`, `re_sourcekey`, `re_sourceversion`, `re_conversionversion`, `re_sourcecurrency`, `re_amountcurrency`, `re_uom` |
| Memo | `re_entereddescription`, `re_descriptionen`, `re_descriptionfr` |
| Lookup | `re_repairestimate`, `re_estimatepackage`, `re_sparepart` |
| Choice | `re_parttype`, `re_materialsource`, `re_materialscope`, `re_materialpricingmode` |
| Boolean | `re_taxapplicable`, `re_freightapplicable` |
| Decimal | `re_quantity`, `re_sourceusdcost`, `re_sourceusdprice`, `re_unitcostprecise`, `re_unitpriceprecise`, `re_pricingunit`, `re_usdtocadfactor`, `re_costonlyfactor`, `re_markuppct` |
| Money | `re_unitcost`, `re_extendedcost`, `re_taxamount`, `re_freightamount`, `re_totalcost` |
| DateTime | `re_refreshedon` |

Precision contract: source USD amounts/pricing unit 6; precise unit cost/price 10; factors/markup 2 in [catalog proposal](../backend/parts-catalog-schema.json). Proposal describes material description max2000, vendor/part max100, UOM20, source key200, version100, currency3. Verify live constraints before imports.

### Cost lines and status history (live metadata)

- Cost: `re_estimatecostlineid` GUID; `re_name`, `re_estimatecostline`, `re_vendor` String; `re_description` Memo; `re_costtype` C; `re_quantity` D; `re_unitcost`, `re_totalcost` M. No `re_repairestimate` lookup was returned in the inspected custom-column metadata; current Draft API does not reconcile this table. Do not promise parent-linked cost-line persistence from this UI.
- History: `re_estimatestatushistoryid` GUID; `re_name` String; `re_repairestimate`, `re_changedby` L; `re_changedon` T; `re_fromstatus`, `re_tostatus` C; `re_comments` Memo. Plugin writes transition/name/user/time; not comments from a user form.

### Preferences and presets

- Preference: `re_appuserpreferenceid` GUID, `re_name` S(200), `re_user` L -> systemuser, `re_preferredlanguage` C (126110000 EN / 126110001 FR), `re_preferredlocale` S(10), `re_preferredtheme` C (126110000 system / 126110001 dark / 126110002 light). Duplicate/inactive rows error explicitly; missing row creates defaults.
- Preset: `re_opportunitypresetid` GUID, `re_name` S(100) required, `re_market` C required, `re_payload` Memo(20000) required; user-owned. Proposal [here](../backend/opportunity-presets-schema.json) says design-only, but Dev table existence is now verified; private roles/end-to-end still unverified.

## 10. Optional catalog, contract and export schemas

### Spare-part catalog

`re_sparepart` / `re_spareparts` is organization-owned with proposed alternate key `re_sourcekey`. Columns from [parts schema](../backend/parts-catalog-schema.json):

- Required strings: `re_sourcekey`200, `re_partnumber`100, `re_name`200, `re_sourcecurrency`3 (USD), `re_uom`20, `re_sourceversion`100.
- Optional strings: `re_salesorganization`50, `re_distributionchannel`50, `re_conditionrecord`100.
- Memo `re_descriptionen`, `re_descriptionfr`2000; choice `re_parttype` KONE/Non-KONE.
- Decimal `re_usdcost`6 required, `re_usdprice`6 optional, `re_pricingunit`6 required; effective from/to dates and refreshed timestamp.
- Reader API never updates source costs. Import approval/ambiguity checks are separate from ordinary estimate Save.

`re_partpricingconfiguration` / `re_partpricingconfigurations`: organization-owned; proposed key `re_version` + `re_market`; `re_name`200, `re_version`100; `re_isenabled` B defaultfalse; `re_market` C; `re_currency` L; `re_usdtocadfactor`, `re_costonlyfactor`, `re_defaultmarkuppct` D precision2; effective dates.

Dev table existence is verified; enabled rows, precision/keys, source approval and production import are not. Proposal explicitly disallows production import. Manual non-KONE behavior and package-priced KONE are distinct from catalog availability.

### Contract mapping

[Contract proposal](../backend/contract-equipment-schema.json): extend Equipment with `re_contractnumber`, `re_contractstatus` S(100). Dev columns exist now. Approved mapping must match **market + branch + equipment number**, never equipment number alone. Preparation does not itself deploy/import data. Contract card was removed; retained API operations only read.

### Export outbox and switch

[Export schema](../backend/submission-export-schema.json) defines:

| Table | Columns / constraints |
|---|---|
| `re_estimateexport` (user-owned) | `re_name` String100; `re_estimate` lookup required; `re_submissionkey` String100 unique key; `re_revision` String30; `re_payload` Memo900000; `re_payloadhash` String64; `re_outputmode`, `re_deliverystate` String20; `re_flowrun` String100; `re_workbookurl` String2000; `re_sendreceipt` String200; `re_sendingon`, `re_acceptedon`, `re_completedon` DateTime |
| `re_exportconfiguration` (organization-owned) | Unique `re_name` String100; `re_enabled` Boolean defaultfalse; `re_flowuser` lookup systemuser; `re_outputmode` String20 |

Required snapshot fields: name, estimate, submission key, revision, payload/hash, mode/state. Outbox and header use optimistic concurrency. Proposed relationships restrict deletion and avoid cascading assign/share/reparent. Verify keys/relationships are active, not just columns present.

Custom API `re_EstimateExport`: global action; String `InputJson` and `ResultJson`; plugin `ExportRequestPlugin`. Operations:

| Operation | State change / persistence |
|---|---|
| `queue` | Validates/calculates; freezes payload/hash; links header and creates pending outbox |
| `claim` | pending/generating -> generating; records exclusive run ID; occupied request returns explicit no-claim |
| `generated` | generating/generated -> generated; validates approved workbook URL |
| `sending` | generated -> sending; stamps sending time before email call |
| `accepted` | sending/accepted -> accepted; requires send receipt, stamps acceptance |
| `finalize` | accepted/completed -> completed; accepted evidence required, sets estimate Submitted/timestamp |
| `fail` | pre-send pending/generating/generated/failed -> failed |
| `review` | sending/needs-review -> needs-review; ambiguous send must not auto-resend |

Queue remains Draft but export-locked. `accepted` means connector acceptance, **not guaranteed inbox delivery**. Flow handles Office Script/workbook/email; Dataverse plugin does not directly email the customer. Recovery must distinguish pre-send failure from ambiguous send.

Required ExportLockPlugin registration: synchronous PreOperation Create/Update/Delete for seven tables (header, export, equipment, package, labor, material, cost): **21 steps**, ahead of other locks/calculation. No matching step names were observed; automation must stay disabled until verified. Correct API name alone is not completion.

## 11. Expected versus actual: issue and gap register

Priority indicates business/technical impact, not an exploit-security finding.

| ID | Priority / classification | Expected | Actual evidence | Required follow-up |
|---|---|---|---|---|
| DV-01 | High - confirmed validation/schema mismatch | Reject overlength input before save with matching limits | Current source enforces Contact name100 and phone50; comments/notes remain backend10000 vs Dev2000/4000 | Align remaining UI/backend/schema limits deliberately; test boundary and boundary+1. No schema change made in this change. |
| DV-02 | High - confirmed location length mismatch | Valid equipment location snapshots save reliably | Master location100, snapshot30; backend optional location100/copies master | Decide approved length or truncation policy; do not silently truncate historical identifiers. |
| DV-03 | Medium - non-admin calculation acceptance pending | Calculate yields saved Pricing/CMII or actionable failure | Approved real admin Dev draft saved/recalculated with version2026.7 and exact cost reconciliation; the original reported symptom's cause is not established | Verify non-admin and other branch/configuration contexts; retain explicit unavailable errors. |
| DV-04 | High - gated deployment | Automated submit safely locks, generates, sends and finalizes | Export disabled; API name now correct; lock step names not observed; flows/end-to-end not verified | Complete activation checklist, keep disabled until approved. |
| DV-05 | Medium - stale schema status labels | Proposals accurately describe Dev existence vs approval | Contract/package/preset files still design-only but inspected Dev columns/tables exist | Update deployment ledgers after full verification; do not interpret stale labels as absence. |
| DV-06 | Medium - non-admin customer acceptance pending | Selected Account/Contact survives save/reload and validates the relationship | Lookup schema, signed assemblies and app deployed; exact three-Contact source sample, API search, real admin Save/Load and invalid-selection rejection verified | Continue gated full import and verify non-admin Save/Load; do not infer global permissions from admin success. |
| DV-07 | Medium - unimplemented business scope | Five equipment search approaches | Number/name prefix only; customer list uses sold-to names | Account/account-name/sold-to filters remain requested future work. |
| DV-08 | Medium - unimplemented UX scope | Material/labor grids and remove KONE/non-KONE/markup | Current implementation retains classification/markup; grid redesign not delivered | Obtain business-approved calculation migration before altering stored semantics. |
| DV-09 | Medium - partial autofill | Branch/account/site/contact reduce manual entry | Branch context and Account/Contact search deployed with verified sample; full customer import and site/building autofill remain incomplete | Continue reconciled imports; verify permissions and authoritative site relationships; billing address is not installation address. |
| DV-10 | Medium - schema/code drift risk | Generated forms reflect server-used fields | Package snapshot fields/extensions missing from inspected projections | Verify live metadata and regenerate through tooling; compare all writers. |
| DV-11 | Medium - unmapped/legacy outputs | Every advertised output has a writer | Successful writer does not assign `re_cmiiwithkonematerial`; cost table not current Save target | Clarify intended output/cost-line use before exposing or promising persistence. |
| DV-12 | Medium - limited source mapping evidence | Functional location and account roles are authoritative | Earlier limited workbook/import samples suggested Location_Code versus Functional_Location__c concern; full joins not profiled | Profile approved source mappings separately; do not claim universal corruption. |
| DV-13 | Closed locally - navigation regression | Cancel discard preserves original workspace | Sidebar uses navigation rather than destructive newDraft; regression tests passed | Verify published build; retain English/French/mobile coverage. |
| DV-14 | Historical resolved in latest snapshot | Exact API name `re_EstimateExport` | Correct name returned; old duplicate prefix no longer returned | Verify request/response parameters and assigned plugin; no need to repeat old rename advice. |

No tenant records were edited to fix these gaps. The current source change adds only Account/Contact search and relationship persistence; it does not alter business calculations or activate paused automation.

## 12. Deployment and verification checklist

### Before changing data behavior

1. Read this reference; identify logical table, column type/precision/length, lookup relationship and current writer.
2. Record migration compatibility for existing snapshots/drafts; do not default a new choice across historical rows without approval.
3. Confirm source master mapping, active/effective uniqueness, country/currency and exact account-partner meanings.
4. Update API allowlists, frontend mapping, load/clone/preset/export surfaces **only where intended**; the current local source adds Account/Contact mappings but they are not yet deployed.
5. Update generated SDK through existing tooling when needed; update schema proposal and this document in the same change.

### Core Dataverse deployment

1. Verify Custom API inputs/outputs, assigned DraftPlugin, transaction context and privileges.
2. Verify Create/Update calculation registration, filtering attributes and `pre` image; missing update image throws `RE-115|PREIMAGE_REQUIRED`.
3. Verify snapshot/child-change/lock steps and history image. History only logs changed statuses, not every form edit.
4. Verify all referenced tables/columns and schema limits, including `re_customeraccount` and `re_customercontact`, before deploying the Draft API. Missing export configuration table can break Submit even when feature is intended disabled; a deployed disabled row is safer than missing schema.
5. Test Account search by market alias and Contact search under the selected Account; verify non-admin read privileges and malformed/market-mismatched/wrong-parent selections fail.
6. Test Save/reload/Calculate with selected Account/Contact, matched/manual equipment, standard/CSTM, multiple packages, branch rates and currency.
7. Test stale version, invalid/duplicate references, removed-child dependencies, overlength fields and row-operation limits.
8. Test Submitted immutability, own/other-user access, preferences duplicate/inactive records and private presets with two estimator users.
9. Confirm source-to-assembly identity and published frontend. A passing local mocked test is not a production acceptance test.

### Export activation (currently held)

1. Validate additive tables, unique keys, concurrency and restrictive relationships.
2. Verify exact API/plugin parameter contract and all 21 lock steps by plugin type, not merely display name.
3. Verify flow identity restrictions and administrator-only switch; no direct outbox mutations.
4. Validate standard/custom templates, Office Script, approved library permissions and mutually exclusive flow designs.
5. Test queue/claim idempotency, generation failure, acceptance evidence, finalize retries and ambiguous-send review.
6. Verify recipients, attachments and application status without putting personal addresses in this document.
7. Enable only after non-admin and flow acceptance; disabled legacy behavior must remain tested.

### Existing local evidence and validation commands

Prior work: frontend build/lint and 122 unit tests passed; pricing/navigation focused browser tests passed; two EN/FR UI-only account tests passed; backend draft executable passed during safe pull. Current customer-master local build/unit/plugin results are recorded in the accompanying change log after validation. These results do not certify every flow or the live environment.

```powershell
npm run build
npm run lint
npm run test:unit
npx playwright test -g "relevant test name" --reporter=line --workers=1
dotnet test .\backend-pricing-tests\RepairEstimator.Tests.csproj -c Release
dotnet build .\backend-tests\DraftTests.csproj -c Release
.\backend-tests\bin\Release\net462\DraftTests.exe
node --test .\tests\dataverse-documentation.test.mjs
```

Run focused tests for the changed behavior first. The current task changes app/plugin source locally; no live schema, plugin assembly, app bundle or business record was changed.

## 13. Keeping this file current for every contributor

- [Repository Copilot instructions](../.github/copilot-instructions.md) require same-change updates for Dataverse-impacting work.
- [Documentation workflow](../.github/workflows/dataverse-documentation.yml) runs on pull requests and main pushes. [Guard](../automation/check-dataverse-doc.cjs) fails when watched files change without this document changing.
- The same guard also requires [app.md](app.md) for frontend/UI changes, including CSS, public assets and frontend configuration. A frontend data-wiring change can require both references. Empty/deleted references fail; meaningful accuracy still requires human review.
- Backend/plugin project and test changes also require [plugin.md](plugin.md), covering authoritative formulas, triggers, locks, errors and registration. Its registration matrix specifies **no Update filtering attributes** for the normal calculation step, with full `pre` image.
- Watched scope deliberately includes all frontend TS/TSX, backend/pricing/schema code, tests/e2e, automation, package manifest and maintenance-rule/workflow changes. Some UI-only changes will trigger it: explicitly record "no persistence impact" with affected behavior.
- The guard compares the whole change's base/head, includes deleted/renamed files as changes, and requires this document in that diff. It **does not** assess correctness, automatically discover business semantics or verify live deployments.
- After publishing the workflow, a repository administrator must make **Dataverse documentation / documentation** a required branch-protection check to enforce it before merges. Until then the check reports failures but cannot prevent all contributors from merging.
- Direct tenant modifications bypass Git/CI. Whoever changes Dataverse must manually update this document with metadata/deployment evidence; no automatic "real-time Dataverse synchronization" is installed.
- Human reviewers must check that updates are meaningful rather than whitespace-only. Preserve unresolved issue IDs and distinguish fixed-in-source, tested and deployed.
- Never record tokens, credentials, customer/contact rows, workbook extracts or private payloads.

### Required change-log entry format

`Change | affected tables/columns | persistence impact | expected/current behavior | tests/evidence | deployment status | unresolved follow-up`

### Change log

| Change | Tables / persistence impact | Evidence / deployment status |
|---|---|---|
| Contract card removal (existing work) | No current contract UI calls; retained read-only backend | Local regression passed; no deployment claim |
| Unsaved navigation fix (existing work) | Sidebar preserves workspace; no save/reset by navigation | Local regressions passed; published build unverified |
| Pricing feedback (existing uncommitted work) | No formula/schema change; inline Save/validation feedback | Focused local tests passed; original live root cause unresolved |
| Account inputs (existing UI-only work) | No Dataverse columns or payload mapping | EN/FR browser tests passed; full refresh intentionally loses preview |
| This audit, 2026-11-04 local / 2026-11-03 UTC | Documented readers/writers, business-column inventory and gaps; added maintenance check | Three guard tests passed (including real Git tree comparisons); 56 source links resolve; workflow YAML and script syntax validated. Read-only Dev evidence above; no tenant write, push or deployment |
| App reference maintenance, 2026-11-04 | Extended existing guard to require app.md for frontend changes; Dataverse requirement retained | Four guard tests passed, including both references and empty/deleted cases; no runtime or tenant changes |
| Plugin reference maintenance, 2026-11-04 | Added plugin.md and plugin-project guard; earlier reference requirements retained | Five guard tests passed including plugin missing/empty/deleted cases; no runtime or tenant changes |
| Customer master lookup and import safeguards, current local source | Adds optional estimate Account/Contact lookups and Draft API search/save/load/preset mapping; Contact details derive from validated master; importer rejects unmapped source headers | Frontend build/lint, unit tests, three targeted mocked Account/Contact browser tests, 15 importer tests and 5 documentation tests passed; Draft plugin build passed. Read-only Dev collision scan found no conflict among existing records. Two metadata columns and both estimate lookup relationships are deployed and read-only rechecked. No plugin/app deployment or master-row import performed. Source rejects and full-import batching remain unresolved |
| Customer source reconciliation, 2026-11-04 local | No table or column changes; reconciled workbook Account/Contact IDs, parent joins, source errors, exact importer validation and wrapper lengths | XML scans: 441,209 unique Account IDs and 386,111 unique Contact IDs, no duplicate IDs; 30,325 repeated-email groups affecting 42,497 additional Contact rows. Exact payload validation: 441,205 valid Accounts; 381,724 valid Contacts; 4 Account and 4,387 Contact rows quarantined. Destination collision and batch verification remain required; no business rows were written |

## 14. Source index

### 2026-11-05 full-import readiness check

The supplied v4.0 schema and eight source workbooks were inspected read-only.
The shared Power Apps solution page and Web API both show 40 solution table
components. This check made no schema, business-record, user-role, export-switch,
plugin-assembly or published-app changes.

Current caller-visible record counts:

| Table group | Live count |
|---|---|
| Account / Contact | 14 / 10 |
| Equipment / Spare Part | 180,962 / 10,635, counted by complete primary-ID/key paging |
| Country / State Province / Currency | 2 / 64 / 3 |
| Branch / Sales Offices / Margin Group | 241 / 203 / 82 |
| Equipment Type / Customer Vertical / Job Type | 6 / 17 / 20 |
| Package Category / Repair Package / Scope Library | 11 / 280 / 75 |
| Labor Rate / Margin Rule | 1,446 / 1,968 |
| Job Size Band / Redundancy Band / OEM Band Rule / Band Matrix | 12 / 3 / 2 / 28 |
| Situational Adjustment / Incentive Rate / Pricing Parameter | 11 / 14 / 14 |
| Part Pricing Configuration / Export Configuration | 3 / 1 |
| Repair Estimate / Estimate Equipment / Estimate Package | 18 / 64 / 44 |
| Estimate Labor Line / Estimate Material Line / Estimate Status History | 7 / 8 / 6 |
| App User Preference / Opportunity Preset | 7 / 3 |
| Estimate Approval / Estimate Document / Estimate Cost Line / Estimate Export | 0 / 0 / 0 / 0 |
| User | More than 5,000; the standard count limit was exceeded, not an exact count |

Equipment and Spare Part were scanned in 37 and 3 pages respectively. Their
existing business keys were nonblank and had no case-insensitive duplicates.
All 180,962 existing Equipment rows had no Account lookup populated. Active
alternate keys were rechecked for Account source ID, Contact source ID,
Equipment number, Spare Part source key, Branch number and Package number.
This is not a full field-by-field source/destination reconciliation and does not
prove a future upsert will be unchanged or safe. The scan is not a transactional
tenant snapshot; concurrent external changes remain possible.

The actual source header positions match v4.0 contracts for all 27 Account,
18 Contact and 60 Equipment columns. The Equipment mapping sheet includes
55 repeated column positions from different export layouts; contracts must be
selected using the actual sheet, position AND header, not the first mapping row.
After matching those headers, no ambiguous matching contract remained. The
v4.0 Source Mapping sheet does not contain pricing-workbook or pilot-calculator
import contracts. User Details Mapping describes proposed employee mapping,
not an approved organization or permission crosswalk.

Initial full-import gates and subsequent decisions:

- The user approved preserving all source fields and object markers, including
  fields v4.0 proposes excluding. The customer import retains them in raw export
  metadata; omitted projections must not clear existing stored values.
- The user approved importing validated rows only and quarantining the 4 Account
  and 4,387 Contact rejects. Preserve source IDs and exact values; do not truncate
  names, guess numeric phone formatting, or fabricate parents.
- The supplied v4.0 workbook references a company/branch/sub-branch crosswalk
  workbook that was not found in the supplied source folder, Downloads or the
  inspected Project tree or supplied Batch archives. Planner Group, Account
  Location, `re_functionallocationmaster` and `re_userorganizationmapping`
  tables were absent in exact live queries. Proposed master designs may not be
  assumed deployed from the workbook; a schema write alone cannot establish
  their missing organization/site/branch mappings.
- The workbook explicitly leaves site/account association, branch meaning,
  equipment eligibility, Account.Type precedence and employee organization
  mapping undecided. Existing billing addresses are not building locations.
- Existing references and transaction records are populated. Do not insert
  calculator examples into Estimate/history/approval/document tables, replace
  reference rows without identity/effectivity reconciliation, or provision/grant
  employee access based on job titles.
- The new resumable customer bulk path below supersedes the capped per-row
  importer for this load. Full completion, Contact live verification and
  field-by-field Equipment/reference reconciliation are not yet established.

Presentation status: master completeness, new sign-in/autofill mappings and
updated plugin/app publication are not verified. Existing local build/browser
tests do not certify the shared published app or production data.

### 2026-11-05 customer bulk implementation and live pilot evidence

Affected tables: `account` and `contact`; mapped native fields, source-ID
alternate keys and `re_sourceexportmetadata`. Contact parents use
`parentcustomerid_account` to bind the verified Account GUID. This change does
not create tables, change employee access, populate Equipment Account lookups,
alter estimate calculation, or publish a plugin/app.

[Bulk staging](../automation/import-customer-masters-bulk.py) prepared
441,205 Account and 381,724 Contact candidates, with 4/4,387 quarantines.
Private SQLite staging stores payloads, source/contract fingerprints, metadata
snapshots and pending/inflight/verified status. Reports contain counts and
worksheet row/reason manifests only. Exact-field read-back, Boolean/null
semantics and Contact parent GUID checks precede each committed checkpoint.
Source-managed identity is the source ID, not email or billing address.
Native natural-key collisions are quarantined; evidence of attempted rows is
not discarded. Source and mapping guards are retained on resume.

Live `UpsertMultiple` single-record update and create probes succeeded, but
500/499/50-record requests failed HTTP 400; a diagnostic response reported
`0x80040216`. Its underlying platform cause is not established. Failed rows
remained inflight rather than being marked imported. Both successful individual
writes were reconciled by later exact read-back.

[Prepared-state apply transport](../automation/apply-customer-masters.py) uses
the advertised `CreateMultiple` and `UpdateMultiple` actions separately, after
reading existing source keys. Existing records retain their GUIDs and unique
source keys protect new creates. Creates and updates are separate transactions:
an update failure after creates leaves the whole batch unverified, and resume
reads current rows before deciding whether any additional write is needed.
The unchanged staging script, helper and rules still satisfy the original
contract fingerprint; no guard was bypassed or staging payload rewritten.
Only explicit HTTP 429 is retried with bounded backoff; uncertain failures stop
the run. Diagnostics expose status/code/request ID, not server messages which
could contain customer values.

Live milestones: 10, 500 and 1,000-Account direct-action batches passed every
mapped-field verification. At the final pilot checkpoint, 1,511 Accounts were
verified, 439,694 remained pending, no rows were inflight, and no Contacts had
been written. These are checkpointed source-row counts, not total table counts.
The approved full Account-then-Contact run was subsequently started; completion
must be read from its sanitized report, not inferred from successful pilots.
Do not report all masters or all 40 tables imported.

Local validation: 33 importer tests and 5 documentation-guard tests passed.
Tests cover source preservation, collisions, GUID reuse, quarantine, lost or
corrupted writes, parent gating, separate create/update targeting, sanitized
HTTP error codes and bounded throttling. Mocked tests do not certify Contact
bulk writes or published-app behavior.

The read-only presentation probe of `re_DraftEstimate` `accountsearch` failed
HTTP 400/code `0x80040265`. Deployed Drafts and pricing assembly hashes differed
from local DLLs. This shows a failed deployed lookup operation and source/runtime
drift, not a proven cause. No assembly or frontend publication occurred.
The user defined Maintenance Planner Group as the sub-branch code and approved
proceeding only with unambiguous mappings; parent branch/company, employee
organization, site associations and related autofill remain blocked.

Subsequent run evidence: 7,511 Accounts checkpointed before a read-back GET
failed HTTP401. The next 1,000 rows remained inflight even though the write had
returned successfully. After authentication renewal, all 1,000 matched exactly
and were checkpointed with **zero writes**. Thus 8,511 Accounts were verified
with no inflight rows at reconciliation; Contacts remained pending. The apply
adapter now refreshes and retries an expired-token read once, never replays a
write for that recovery. All 35 importer regression tests passed.

The user subsequently approved a manual-completion target: fetch existing
values, keep genuinely absent data blank/editable, and persist entered values
to appropriate masters, including explicit branch/organisation mappings.
Updating populated shared values requires confirmation. This is **not yet
implemented/deployed**: current customer APIs require imported Account/Contact
selections and derive read-only text. Approval to leave absent relationships
blank does not make an ambiguous source relationship valid, permit placeholder
records, resolve source-error cells, or identify where building/site data belongs.
Quarantine and pending rows must be accounted for explicitly, not called
imported. Future manual edits must retain original source metadata, enforce
Dataverse privileges and concurrency, validate identities/parents and be
re-fetchable without silently overwriting newer shared values.

### Account total reconciliation and remaining sources, 2026-11-05

The user reported 441,211 Accounts. A fresh XML scan of the supplied `Sheet2`
found **441,210 nonempty worksheet rows including one header**, hence
**441,209 source Account records**. The validated candidate count remains
441,205 plus 4 quarantined source-error rows; these sum to the source records.
Do not manufacture two additional records to match a reported total. A
separate live Account primary-ID paging scan returned 14,511 records while
the import was running; that count is time-dependent, not a final completion
or source-match verification. The shared browser did not expose the claimed
441,211 total in the targeted read.

Remaining workbook inspection reconfirmed the following worksheet dimensions
(not proof every row is a valid import candidate):

| Source | Data sheet | Rows excluding first row | Columns | Outstanding gate |
|---|---|---|---|---|
| Latest Equipment Master | Equipment Master | 428,400 | 60 | Full typed field/relationship reconciliation; conflicting equipment identities and missing source Account references remain quarantined/gated |
| Refined MKOM pricing | Material | 37,473 | 18 | Positional duplicate-currency headers; source-key/effectivity contract and invalid costs must be reconciled before replacing existing Spare Part data |
| Employee source | Sheet1 | 341 | 13 | Employee/source identity persistence contract and explicit organisation/branch mapping; no job-title-to-app-role inference |
| KONE Spares for WebApp reference | Sheet1 | 13 | 5 | First worksheet row is entirely blank; not a normal headered part-catalog import and not evidence of 13 Spare Part records |

Existing Equipment/Spare Part/reference rows must be retained and compared,
not blindly recreated. The employee/planner/site contracts and calculator
pricing/reference extraction remain unfinished. Permission to leave missing
form inputs blank does not establish a typed import contract or resolve an
ambiguous existing identity. No additional dataset was written in this
remaining-source inspection. Contacts are queued behind Accounts; the
continuous approved customer import remains the only active writer.

### Requested remaining-data checklist and Equipment metadata preflight

[Checklist renderer](../automation/customer-import-checklist.py) now records
Account/Contact candidates and rejects separately, plus the remaining Equipment,
refined material pricing, employee, organisation/branch/planner/site,
calculator reference/configuration, publication and manual-writeback tasks.
The [apply command](../automation/apply-customer-masters.py) supports
`--checklist` and updates that sanitized file after each verified batch and
pause/completion/failure report. Only candidates whose full source accounting
and verification are complete get a checked box; quarantine is not completion.
The private staging database is not part of the checklist or its contents.
The continuous customer import was restarted with checklist updates and a
detached process so it can continue across chat turns; successful start is not
completion evidence. The last completed pilot checkpoint was 24,511 Accounts
verified and no Contacts written. Existing attempted rows are reconciled before
additional writes; no simultaneous customer importer was started.

[Equipment metadata preflight](../automation/preflight-remaining-masters.py)
accounted for all 60 exact source headers. Identical duplicate v4.0 mapping rows
were deduplicated; different targets for one exact header fail explicitly.
Metadata queries use encoded filters without unsupported `$top` on
`EntityDefinitions`. Live result:

- 46 source columns have destination attributes, but still require complete
  typed row/value/relationship validation.
- 5 raw object-marker columns require exact preservation storage.
- 2 destination columns are absent: `account.re_sourceaccountclassification`
  for Equipment `Account.Type` and `re_equipment.re_koltype` for `KOL_Type__c`.
- 7 source columns map to absent tables: 3 location columns on
  `re_functionallocationmaster`, 4 planner columns on `re_plannergroup`.

This metadata preflight wrote **no Equipment or Account values** and created
no schema. It is not field-level reconciliation of the 428,400 Equipment rows.
Source Account classification precedence, location association cardinality,
planner/branch mapping and raw-column preservation remain unresolved.
Leaving missing relationships blank does not justify assigning source
classification values to the wrong Account or creating guessed associations.
The remaining-data checklist therefore correctly keeps Equipment and other
unimported datasets unchecked.

Validation: 41 focused Python tests passed, including checklist completion
accounting, quarantine separation, conflicting metadata contracts and report
sanitization. The checklist hook was exercised by a live 1,000-Account pilot:
the report and checklist both updated after exact verification. This does not
prove all imports finished, non-customer data was added, or the app was deployed.

### Equipment implementation and continuing customer recovery

[Equipment importer](../automation/import-equipment-master.py) now has a
full-source private staging path and bounded existing-record update path.
It preserves all 60 source XML storage/value pairs, validates native types,
UTF-16 lengths, exact numeric precision and DateOnly contracts, and quarantines
all rows sharing a duplicate Equipment key. Account classification, proposed
location/planner mappings and raw markers are retained in export metadata,
not guessed into unrelated tables. New Equipment creation remains deferred
without authoritative branch/required-context mappings. Existing GUIDs,
branch and functional location remain unchanged; only verified source Account
parents may be bound, and conflicting existing relationships stop the run.
Mapped native fields and raw metadata must match on read-back before verification.
The implementation includes explicit schema publication/read-back for
`re_equipment.re_sourceexportmetadata` Memo(100000) and `re_equipment.re_koltype`
String(100). These are optional source-preservation fields, not pricing outputs
or UI writeback. Deployment evidence must be recorded after execution; source
implementation alone is not a deployment claim.

Initial staging exposed an INSERT placeholder defect before any Equipment
business writes; it was corrected and a focused real-SQL staging test added.
The incomplete private state was preserved and preparation restarted using a
fresh state. A subsequent live metadata GET timed out before preparation; the
read-only retry progressed into source streaming. No source/mapping fingerprint
was bypassed. SQLite readers are explicitly closed to prevent Windows file
locks. Tests verify no silent truncation, no inferred time zones/precision,
raw preservation, required-context deferral and exact existing-record GUID reuse.

The customer continuous run reached 30,511 verified Accounts, then its next
1,000-row read-back timed out. A separate reconciliation matched those 1,000
exactly and checkpointed them with **zero writes**, giving 31,511 verified
Accounts. Contacts remain pending. Customer continuation must not be inferred
from the old process or report status; failures remain visible and the checklist
uses verified state. The Equipment report is now included by the checklist
renderer when present, with preparation, schema and row import reported separately.
No frontend or plugin assembly is changed by these import tools.

Equipment execution evidence:

- Full preparation completed: **428,400 rows accounted for**, 320,030 valid
  pending candidates and 108,370 quarantines. Quarantines comprise 4 rows in
  duplicate Equipment-number groups and 108,366 rows exceeding numeric
  precision. Read-only field analysis found 108,203 latitude and 108,216
  longitude occurrences exceeding the live 8-decimal limit; rows overlap.
  Values were not rounded or truncated. Complete raw cells for rejected rows
  remain in private staging; the report contains row numbers/reasons/counts.
- Both optional Equipment columns were created and published in Dev:
  `re_sourceexportmetadata` Memo100000 and `re_koltype` String100. The initial
  post-publication collection read briefly omitted the new string's length,
  causing verification to stop. Independent direct attribute reads confirmed
  both lengths and create/update validity; a subsequent unchanged-script
  recheck succeeded and checkpointed schema deployment. No staging contract
  was bypassed. No Account schema/classification or planner/location table
  was changed.
- Existing-record pilot: **45 Equipment rows updated and verified** against
  mapped source fields/raw metadata/GUIDs, followed by a read-only repeat check
  of all45 with zero writes. Two further100-candidate batches verified50 and25
  additional rows. Total: **120 existing Equipment rows verified**, 319,730
  pending, 168 deferred for absent existing branch/functional-location context,
  12 deferred for unverified source Account parents, and 108,370 rejected.
  These states sum to428,400. Deferred rows are not imported or completed.
  Existing Equipment branch/functional-location context was retained, not
  guessed from source planner/plant fields; no new Equipment was created.
- The checklist now checks Equipment full-source preparation and deployed
  preservation schema separately, while Equipment import remains unchecked.
  Latitude/longitude precision correction, required contexts/parents, new
  Equipment creation, location/planner mappings, pricing and employee imports,
  frontend writeback and coordinated app/plugin publication remain outstanding.
- **53 Python importer/checklist/preflight tests passed.** The customer run
  was restarted in detached mode using500-row batches and the Equipment-aware
  checklist; its starting checkpoint was31,511 verified Accounts, Contacts
  pending. Progress must be read from subsequent verified reports.

### Accelerated customer verification adapter

[Fast customer adapter](../automation/apply-customer-masters-fast.py) now uses
four bounded parallel verification reads, each with its own copied headers and
refreshable API instance. The original chunk reader still selects every mapped
field and Contact parent GUID. Duplicate keys across chunks or any failed
chunk stop the read; partial results are never treated as success. Mutations
remain sequential, not concurrent, through the existing direct create/update
transport. Source validation, private-state exclusive lock, collision checks,
contract fingerprints and exact post-write checkpointing are unchanged.
No running importer shares that state with another importer.

Read-only live comparison:500 verified Accounts produced identical serial/
parallel records (apart from the non-business OData ETag);8.67s serial versus
3.54s parallel,2.45x for this read benchmark only. A subsequent1,000-Account
accelerated pilot verified all1,000 rows, writing500 differences and reusing
already exact rows. Total checkpoint:38,511 Accounts verified,402,694 pending,
no inflight rows, Contacts pending. Pilot wall time89s includes complete resume
preflight and is not the standalone verification benchmark. All57 Python tests
passed. No full-import completion, frontend publication, plugin update or
non-customer source import is implied.

Continuous execution follow-up: customer report reached41,511 verified Accounts
with399,694 pending. Ten additional existing-Equipment candidate batches all
returned successful exact verification, adding354 verified Equipment rows:
total474 verified,318,730 pending,782 missing-context deferrals,44 unverified
Account-parent deferrals and108,370 quarantines. States sum to428,400 source
rows. Equipment GUID/branch/location preservation and verified-parent rules
were retained; no new Equipment or guessed mapping was added. The automatic
customer checkpoint renderer incorporates the latest Equipment report on its
next checkpoint. All58 Python tests passed, including explicit Contact queued
status before its first batch; current running processes retain their loaded
renderer until restarted. Contacts have not yet been written. Pricing/employee/
planner/site and app/plugin/manual-writeback tasks remain incomplete.

- [App state and save/submit](../src/App.tsx), [Opportunity workspace](../src/EstimatorWorkspace.tsx), [PricingSummary](../src/PricingSummary.tsx).
- [Draft API and header/child mapping](../backend/DraftPlugin.cs), [draft contract](../src/data/draftContract.ts), [customer master search](../src/data/customerMasterRepository.ts), [reference queries](../src/data/repairEstimatorRepository.ts).
- [Master schema](../src/data/masterDataSchema.ts), [metadata/CRUD](../src/data/masterDataRepository.ts), [generated models](../src/generated/models), [projected schema JSON](../.power/schemas/dataverse).
- [Preferences](../src/data/userPreferences.ts), [preference lifecycle](../src/useUserPreferences.ts), [identity/privileges](../src/data/sessionRepository.ts).
- [Pricing logical names](../backend-pricing/Infrastructure/Names.cs), [calculation plugin](../backend-pricing/Plugins/EstimateCalculationPlugin.cs), [output writer](../backend-pricing/Plugins/CalculationWriter.cs), [status history](../backend-pricing/Plugins/StatusHistoryPlugin.cs).
- [Presets](../backend/OpportunityPresets.cs), [parts](../backend/PartCatalog.cs), [package pricing](../backend/PackageMaterialPricing.cs), [contracts](../backend/ContractEquipment.cs), [dashboard](../backend/DashboardReader.cs).
- [Export lifecycle](../backend-pricing/Automation/ExportRequestPlugin.cs), [state transitions](../backend-pricing/Automation/ExportState.cs), [frozen snapshot](../backend-pricing/Automation/ExportSnapshot.cs), [deployment README](../README.md).