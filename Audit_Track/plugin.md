# Repair Estimator - backend plugins, calculations and registration reference

## 1. Scope and evidence

### Dev deployment evidence (2026-11-06)

Signed Pricing (`RepairEstimator.Plugins`, 1.0.0.0) and Drafts (`RepairEstimator.Drafts`, 1.0.0.0) were updated in place in Dev using guarded ETag writes, backups and full assembly hash readback. Pricing SHA-256: `fecb723e78ddb1ebf4b89180e5905290063110b77e3fefde61fab78a91b400b0`; Drafts: `c5b8907fbcd456fe00db73ae6ee8b97ebba5b04e8a547c832a37882e1cde57b1`. All 10 Pricing and 1 Drafts type identities, signing/version identities and registrations were preserved. Current Pricing 2026.8 safeguards and customer fallback are deployed; 71 focused Release tests and signed builds passed locally. A read-only Contact search succeeded after coordinated frontend publication. No real business Save/Submit, email, pricing recalculation or non-admin certification was performed. Earlier source-only deployment statements below describe the prior stage.

The follow-up frontend-only placement correction restricts the additional card/combined preview to Pricing & Margin, reading Additional Details inputs. It changes no plugin formulas, API contracts, columns, snapshots, registration, permissions or export lifecycle and requires no further assembly deployment. Four focused mocked browser cases passed across successful runs, plus 15 cost/documentation checks and build/type-check/lint. The corrected frontend was published to Dev and its new `index-Cpj6WZd4.js` bundle observed in a separate tab; no tenant business-write acceptance was performed.

### Additional-details card and combined cost (frontend only)

Frontend package summaries now itemize estimate-level additional labor/material/miscellaneous, tax and freight between package subtotal and combined estimated cost. The local preview action shares that helper. This preserves existing pricing-engine semantics: additional labor uses branch mechanic rate; material/miscellaneous receive additive tax/freight; package-specific CSTM charges are counted only in package subtotal. No backend code, financial formulas, saved outputs, snapshots, API contract, registration, permissions, locks or export lifecycle changed. Ten cost tests, five documentation checks, build/type-check/lint and five mocked browser cases passed. No plugin/app deployment or tenant write occurred.

### CSTM zero equipment-card preview correction (frontend only)

Equipment-card presentation now shares entered package-specific CSTM hours/costs across assigned Equipment instead of reading only predefined master values. `PricingEngine` already counts custom labor/material once at estimate level and predefined package costs per assigned Equipment; those formulas, snapshots, API operations, exports, locks, registration and permissions remain unchanged. The frontend reuses its existing package-total helper and preserves KONE/material tax exceptions. No new persisted per-equipment allocation is introduced. Nine local cost tests, three material tests, five documentation checks, seven focused mocked browser cases across targeted runs and build/type-check/lint passed. No plugin/app deployment or tenant write occurred.

### Missing customer details: validated manual snapshot fallback (current source)

`DraftPlugin.ResolveCustomerSelection` now requires the existing active imported market-matching Account but accepts an omitted Contact GUID. A supplied Contact must still be active, source-active/imported and parented to that exact Account; invalid IDs/relationships never trigger manual fallback. Nonblank Contact values remain authoritative, with source name/fullname and telephone/mobile precedence; only absent/whitespace values use entered details. Required name/email limits remain 100 characters, phone 50, with an explicit invalid-email error. No Contact master writes occur.

Save and Submit share this resolver. Save clears `re_customercontact` when omitted, preserves `re_customeraccount`, and writes validated estimate text snapshots. Read retains manual snapshots when master values are blank and returns additive `contactMaster` data for correct editable-field behavior. Opportunity preset normalization uses the same policy and nullable Contact reference; clone retains this distinction. Contact/default search no longer excludes records solely for missing email. Account-market checks, privileges, pricing, snapshot rules outside customer details and export locking are unchanged.

Local evidence: 13 focused xUnit pipeline cases passed, covering manual/partial/complete Contacts, reload/update/submission, partial Contact search, clearing a prior Contact lookup, master-value precedence, missing/invalid required details and invalid relationships/market/IDs. Thirty frontend contract/clone cases, five documentation checks and 11 mocked browser regressions passed, including English/French manual Save/reopen/update and existing autofetch guards. No plugin deployment, registration/image changes, permissions changes or real business Save/Submit performed. Existing optional lookup/text columns suffice; coordinated frontend and Drafts deployment plus tenant/non-admin acceptance remain outstanding.

### MKO source-master import policy (2026-11-06)

User approved refined MKOM six-decimal USD rounding with complete original USD/CAD positional provenance in an additive Spare Part Memo, and exact MKO package name/scope corrections without financial rewrites. The importer preserves source identities, dates and GUIDs and verifies writes. Existing `PartCatalog` continues to use typed USD values, current configuration/FX, positive KONE cost/VK13 and per-unit eligibility; zero/non-unit records are imported inactive. CAD raw-source cells are not substituted for the existing approved conversion formula. No plugin code, snapshot-refresh semantics, registration, permissions, calculation rules, submitted requests or export state are changed by this master import. Source preparation/tests are separate from tenant import completion and published-browser acceptance; see [dataverse.md](dataverse.md) for verified execution evidence.

The approved MKO Equipment import maps exact plant section to a unique active MKO Branch number, copies the source SAP functional-location number, and links only already verified source Accounts. Coordinate rounding is limited to eight-decimal typed latitude/longitude with exact original source preservation; no pricing numeric rule changes. Missing/ambiguous contexts and source duplicates stay gated; native conflicts are explicitly deferred without overwrite while safe new records may proceed. The completed bounded pilot created/readback-verified 64 Equipment records and preserved 186 native conflicts unchanged. This adds master persistence, not new loader/defaulting logic, automatic equipment-age computation, planner/site associations or plugin deployment. All 280 MKO package text/provenance updates passed native readback with financial fields and GUIDs unchanged.

User subsequently approved remaining safe API continuation. Equipment and parts resumed from their fingerprint-checked states; the unpublished dataflow wizard was cancelled after source authentication hit a popup-blocker error, with no target refresh or ownership switch. A later Equipment checkpoint verified 3,425 rows and preserved 1,075 native conflicts. Read-only NewRates reconciliation uses independent ST/DT sections and exact Branch-name plus SFDC context, not SFDC alone: 1,308 existing current role/time amounts agree at cent precision, with 30 source contexts still unresolved and currency/provenance parity not certified. No labor rates, formulas, registration, permissions, saved calculation outputs or plugin deployment changed. Diagnostic cent rounding is comparison evidence only, not a new write policy.

Checklist reporting now consumes current MKO import and package evidence, checks source accounting and preserves incomplete gates. The private refresh process does not modify import contracts or persistence and is separate from cached live writers. Completed package rows do not certify all calculator references or non-admin/export acceptance. No plugin API, formulas, snapshots, locking, registration, permissions or deployment changed; see [dataverse.md](dataverse.md) for report contracts and local-test evidence.

Customer import scheduling now has a two-worker coordinator (one Account batch and one Contact batch), not competing same-dataset writers. Contacts still require exact already-verified parent IDs; inflight/source/metadata/collision guards and full readback remain. Both workers settle before reporting failure; restart reconciles uncertain writes. This changes import orchestration only, not plugin dispatch, calculation, lookup policy, registration, privileges, saved estimates or deployment. Local concurrency tests are distinct from tenant speed/readback evidence in [dataverse.md](dataverse.md).

### Workbook-v2 PDF presentation contract only (2026-11-06)

The new [FillSubmission script](../automation/office-scripts/FillSubmission.ts) consumes the existing `ExportSnapshot` typed payload (schema/template payload version 1) into a separately marked workbook-v2. No plugin dispatch, snapshot capture, formulas, registration/images, permissions, locking or persisted outputs changed. Saved costs/margins remain authoritative; unavailable pricing blocks the script rather than triggering a workbook fallback calculation. No enabled export lifecycle or email-success semantics are introduced. The disabled outbox and missing registration prerequisites remain unresolved; the separate existing Submitted-trigger flow has not been updated. Local template tests and desktop Excel rendering are not deployed plugin/Office Scripts/cloud-flow acceptance.

### Financial calculation safeguards audit (2026-11-06)

Confirmed by six failing regression cases: matching duplicate band-matrix rows, overlapping redundancy bands and duplicate incentive thresholds previously selected the first retrieved row. Conflicting configuration could therefore change a band, margin or payout based on retrieval order. Source engine `2026.8` now raises `RE-117|BAND_MATRIX_AMBIGUOUS`, `RE-117|REDUNDANCY_BAND_AMBIGUOUS` or `RE-117|INCENTIVE_RATE_AMBIGUOUS` instead. Matrix/redundancy checks apply to the currently matched keys/count; incentive duplicate thresholds are checked within the resolved country/global incentive set when actual CMII is available. Even identical duplicate rows are rejected rather than hiding a configuration error. Missing-rule behavior and valid unique rules/formulas remain unchanged.

Existing Draft recovery logs the pricing exception and clears saved calculation outputs; non-Draft/Submit throws. New mocked integration cases verify stale cost, suggested price, actual margin and incentive outputs are cleared and submission is blocked for each ambiguity. Pure-engine tests exercise both retrieval orders. An independently computed decimal mixed-case fixture verifies package subsets, standard versus custom rates, custom labor multipliers, tax/freight exemptions, additions, cent rounding, suggested price and four-decimal actual CMII. No approved cost/margin/tax/FX/payout formula, registration/image, permissions, schema or existing snapshot is changed. Subcontractor cost remains captured-only; changing its financial treatment requires a separately approved business rule.

Read-only Dev audit found 28 effective matrix rows without duplicate keys, three redundancy bands without overlaps and 14 effective incentive rows without duplicate country/threshold keys. The existing three-package CAD standard Draft independently matched persisted hours, labor, material, package estimated cost and total true cost using saved quantities/rate and decimal arithmetic. It remained Draft without export; no Save/recalculation/Submit/email was performed. That sample still records deployed engine `2026.7`. It is not proof of all existing estimates, all currencies/CSTM cases or complete workbook/configuration parity. Source safeguards are not deployed by this audit.

Local validation: 59 focused backend tests passed in both Debug and Release (55 pure-engine cases plus three ambiguity integration cases and the package-subset snapshot/export case). Twenty-seven focused frontend cost/display/validation/documentation tests passed, including English/French diagnostic handling; production TypeScript/Vite build, installed ESLint and `git diff --check` passed. The existing ExcelJS chunk-size warning remains. No full backend-suite green result is claimed; the broader preexisting customer-fixture failures are outside this focused validation.

### CAD master expansion and approved monetary precision (2026-11-05)

The full CAD package import uses source Quote hours, total material/misc/tax and old material-before-markup. User approved two-decimal `ROUND_HALF_UP` for Money values with full raw source provenance; hours are not rounded. CKE/CKQ shared rows resolve to the same package-number/CAD master, retaining CSTM and T&M flags. Both material columns feed existing package/snapshot behavior; no engine formula, API, registration, schema, assembly or locking change. Saved estimate snapshots are not rewritten by the master import. Existing CAD sample GUIDs are retained and their before-markup mappings completed; old USD masters are protected by full readback comparison.

Preflight verified all 280 distinct CAD source candidates and published two-decimal metadata. Dev import completed: independent full-record readback reconciled all 280 CAD mappings/provenance, retained all three sample GUIDs and proved all 280 USD masters unchanged. A separate read returned 280 eligible CAD packages, including one CSTM and one T&M, without duplicate IDs/numbers. This is approved master-data activation, not proof of a live calculated/submitted request. New master effective-from is the Dev activation date, explicitly separate from source data. Saved estimate costs were not recomputed. See [dataverse.md](dataverse.md) for rounding counts, affected columns, mappings and completion evidence.

### Equipment description defaults (2026-11-05)

Empty `contactsearch` with Branch context now also returns `locationDescriptions`, `locationDescriptionsTruncated` and `locationDescriptionsTooLong`. The user confirmed the source as active `re_equipment.re_description`, filtered by exact `re_customeraccount` and `re_branch` after existing Account/Branch/market eligibility validation. Contact and functional-location-number queries remain unchanged.

Because the source is Memo, a distinct server query cannot safely prove uniqueness. A separate non-distinct query orders by Equipment GUID, probes 21 non-null descriptions and uses the first 20. Nonblank values at most 300 UTF-16 characters are deduplicated with ordinal equality; longer source values are omitted with an explicit flag, never shortened. More than 20 described records sets the independent truncation flag even if the visible values are identical. The frontend only autofills from a complete, within-limit single candidate; otherwise selection/confirmation is explicit. This bounded policy intentionally does not promise a complete list for large Accounts.

No new schema, privileges, registration/images, writes, formula, snapshot or lock changes. Initiating-user read security remains authoritative. The existing `re_repairestimate.re_buildingname` captures the chosen/confirmed description on explicit Save. Signed Release build and the focused executable passed description deduplication, Account/Branch/inactive isolation, exact 300/301-character thresholds, truncation and unchanged prefix/contact behavior. Live read-only source inspection found two distinct usable descriptions in the existing sample.

Dev deployment succeeded: existing Drafts signing/version/type identities were preserved, the content update was concurrency guarded and uploaded SHA-256 verified as `cd5f4607c736ecf726a474f84b1e9c32ceba957cb550a20032a82db2012eedc2`. The published API's two descriptions and truncation/overlength flags matched an independent native-table read exactly. This read-only sample acceptance is not non-admin certification. No business Save/Submit/email, schema change, pricing assembly update or registration change was performed.

### Customer defaults read enhancement (2026-11-05)

`contactsearch` now accepts empty search to list eligible Contacts for an imported active Account without additional typing. Nonempty search still requires 2-100 characters and retains name/email prefix matching. The existing initiating-user service and parent/active/source/email filters remain. Response includes `primary` from the exact source flag and a `contactsTruncated` flag; TopCount 21 probes truncation before returning at most 20. Missing phone serializes as an empty string, consistent with the frontend's optional-phone contract.

For empty search with Branch context, the operation validates active Branch, Branch market and Account sales organization, then returns distinct active Equipment functional locations using exact Account and Branch lookups. The 20-result limit and `locationsTruncated` prevent false unique-location defaults. No writes, formula/snapshot/locking changes, registration steps/images, new privileges or schema additions. The frontend keeps the user responsible for ambiguous/missing data and the server's existing Save/Submit customer/currency validation is unchanged.

Focused executable customer-defaults tests cover eligibility, parent/Branch/market isolation, distinct locations, truncation, legacy prefix matching, optional phone and no record mutation. Signed Release build and focused tests passed locally. The Drafts assembly was updated in place in Dev; signing/version and plugin-type identities were preserved and uploaded content SHA-256 independently verified as `6390f88ae84cb8cd01ceaf4a4730170eada12536c203149499e6156da4d85f48`. An immediate probe encountered a stale runtime after the assembly update; a later independent probe on the same verified content succeeded. The real sample returned one eligible Contact and one distinct functional-location number, each reconciled against native-table reads. No business record Save/Submit/email was performed. Pricing assembly, schema and registrations were not changed by this correction. This is admin Dev evidence, not non-admin or production certification.

Real-source Dev test preparation (2026-11-05): user approved currency-aware package master identity and coordinated Dev publication if needed. Drafts already resolve packages by GUID and validate currency, not number; these guards remain unchanged. The new composite package master key must be active before removing the globally unique number-only key. Existing snapshots/GUIDs/prices remain intact; no submission or email is authorized for this test. Source and live deployment outcomes are distinct.

Dev execution (2026-11-05): both signed Release assemblies were updated on their existing records and content hashes independently read back; signing identities and all 10 pricing / one Draft plugin types were preserved. No new registration step or export/email activation was performed. The required assignment Memo and active composite package key were verified before assembly publication. A real source-linked draft Save, published-UI reopen and Save returned pricing version `2026.7`; persisted package quantities/cost outputs matched independent decimal reconciliation. Missing Contact and mismatched package currency were rejected in real API tests without partial headers. No Submit/email was attempted. Non-admin permissions, all registration images and external workbook rendering remain outside this acceptance result.

### Package-specific equipment assignments

Draft packages accept an optional `equipmentNumbers` list of exact selected equipment numbers; null/omission means all selected equipment for legacy/new packages. Before writes, the server rejects empty, duplicate, foreign or malformed subsets and serializations over 32,700 characters. A new client sends `allEquipment=true` to intentionally clear a previously stored subset; an older client omitting assignments cannot silently broaden an assigned package and is told to reload.

The optional Memo `re_estimatepackage.re_equipmentnumbers` stores the array. Save derives `re_quantity`, `re_totalhours`, and `re_totalmaterial` from its count; clients cannot provide a trusted quantity. Load and pricing validate stored subsets against equipment snapshots and reject quantity mismatches (`RE-142`). Existing snapshot guards still require the atomic Draft API and existing locks/images/registration remain unchanged.

Pricing loader supplies nullable package quantity to the engine. Package labor, all package material paths, package-priced KONE selling contribution and stated-rate margin use `Qp`. Default/legacy packages retain global `N`, including historical additional-equipment semantics. Estimate header equipment count, primary-equipment bands, custom lines and estimate-level additions retain existing behavior. Export captures all package attributes, assignments and derived totals; the external workbook renderer must honor package quantity.

Deployment order is the additive schema in [package-equipment-schema.json](../backend/package-equipment-schema.json), then both assemblies, then the app. That order was followed in the Dev run above. Local validation and remaining gaps are recorded separately below.

Local evidence: 49 focused xUnit pricing/loader/export cases passed, including package subsets, legacy defaults with additional equipment, KONE selling contribution and stated-rate margin. The standalone `--package-equipment` draft test passed persistence, derived quantities/costs, explicit reset, invalid-subset rejection and mismatched snapshot errors. The unfiltered legacy DraftTests executable still fails at its earlier `TestChoices` fixture because it omits the now-required Account/Contact masters. A broader xUnit run returned 84 passed / 29 failed; legacy Draft-API integration fixtures likewise lack customer selections or expect obsolete pre-customer-validation errors. The focused 49-case selector and standalone persistence test passed again afterward. Full-suite success and live export behavior are not claimed.

Inspected **2026-11-04 local**, including customer-master lookup and estimate-relationship source changes. This document explains API operations, plugin triggers, server arithmetic, snapshots, locks, error handling and deployment requirements.

This is a **source reference**, not blanket production certification. The original read-only Dev audit confirmed assembly/API/selected step/schema existence without comparing deployed hashes. The later approved Dev deployment above independently verified uploaded assembly content and exercised the real draft path; it did not certify every operation, registration image or permission.

- [app.md](app.md): buttons/UI/browser previews and state.
- [dataverse.md](dataverse.md): full table/column/read/write inventory and dated Dev evidence.
- [README](../README.md): deployment instructions and historical implementation notes.
- **Source implemented**, **locally tested**, **Dev metadata verified** and **live unverified** are separate claims.

## 2. Assemblies and server entry points

| Project / type | Responsibility | Invoked by |
|---|---|---|
| [RepairEstimator.Drafts](../backend/RepairEstimator.Drafts.csproj), [DraftPlugin](../backend/DraftPlugin.cs) | JSON API dispatch, atomic draft save/load/submit, authoritative child snapshots | `re_DraftEstimate`, String `InputJson` -> String `ResultJson` |
| [RepairEstimator.Plugins](../backend-pricing/RepairEstimator.Plugins.csproj) | Calculation, locks, snapshot guards, child triggers, history, export | Registered Dataverse table steps and export Custom API |
| [PricingEngine](../backend-pricing/Pricing/PricingEngine.cs) | Pure decimal business engine, no Dataverse dependency | Calculation/export plugins after loader |
| [EstimateInputLoader](../backend-pricing/Data/EstimateInputLoader.cs) | Reads header/snapshots/master context/effective rules into engine model | Server calculation |
| [ReferenceData](../backend-pricing/Data/ReferenceData.cs) | Active/effective pricing configuration, country fallback | Loader through configuration service |
| [CalculationWriter](../backend-pricing/Plugins/CalculationWriter.cs) | Copies results onto header Target or clears stale outputs | Calculation/export |
| [ExportRequestPlugin / ExportLockPlugin](../backend-pricing/Automation/ExportRequestPlugin.cs) | Frozen outbox lifecycle and direct-write/queue locks | `re_EstimateExport` and required lock steps |

Pricing engine source version is **2026.7**. Assembly version `1.0.0.0` does not prove that engine version is deployed. Preserve existing signing identity when updating registered assemblies; never commit or regenerate private signing keys casually.

## 3. App action -> plugin execution

| App action | Server entry | Persistence / effect |
|---|---|---|
| Save draft / Calculate / Recalculate | Draft API `save` | Validated header/children, final calculation, versioned response |
| Open / reload | `load` | Reads stored header/child snapshots; no write |
| Clone existing request | `clonesource` | Initiating-user read; frontend produces new unsaved copy |
| Search imported Account / Contact | `accountsearch`, `contactsearch` | Initiating-user read; market-scoped Accounts and Contacts under the selected Account |
| Submit, disabled export | `submit` -> Save -> calculation -> legacy Submit | Submitted header/time and history after validation; no email |
| Submit, enabled export | `submit` -> Save -> calculation -> export `queue` | Frozen outbox/header lock; finalization later submits |
| Dashboard metrics | `dashboard` | Initiating-user aggregate read, no pricing calculation |
| Live choices | `choices` | Choice metadata read |
| Preset list/save/delete | `presetlist`, `presetsave`, `presetdelete` | Own preset rows only; not a draft save |
| Material catalog | `partcapabilities`, `partcatalog` | Read-only gated catalog/config; Save snapshots selected data |
| Contract selection API | `contractcapabilities`, `contractsearch`, `contractresolve` | Retained read-only operations; contract UI card removed |
| Admin master edit / preferences | Direct frontend SDK | Not a Draft API operation; normal table steps may run if table matches |

DraftPlugin requires `IsInTransaction` before dispatch, including its read modes. Ordinary estimate mutations use context UserId service; contract/dashboard/preset/clonesource explicitly use initiating-user scope. Catalog/choices use execution-user service. Registration impersonation therefore matters.

Helpers: [DashboardReader](../backend/DashboardReader.cs), [OpportunityPresets](../backend/OpportunityPresets.cs), [PartCatalog](../backend/PartCatalog.cs), [ContractEquipment](../backend/ContractEquipment.cs), [PackageMaterialPricing](../backend/PackageMaterialPricing.cs).

## 4. Exact registration matrix (source requirement)

These requirements come from current code plus the registration table in [README](../README.md). **All normal table steps synchronous, calling user, Sandbox/Database assembly registration.** Each table/message pair needs its own step; do not duplicate legacy steps.

| Plugin | Table(s) | Messages | Stage | Filter / pre-image |
|---|---|---|---|---|
| EstimateCalculationPlugin | `re_repairestimate` | Create, Update | PreOperation20 | **No Update filtering attributes**; Update `pre` all columns |
| EstimateLockPlugin | `re_repairestimate` | Update, Delete | PreValidation10 | No filter/image |
| ChildLockPlugin | estimate equipment/package/labor/material | Create, Update, Delete | PreValidation10 | No filter/image; retrieves previous parent when needed |
| EstimateEquipmentSnapshotPlugin | `re_estimateequipment` | Create, Update | PreOperation20 | No filter/image |
| EstimatePackageSnapshotPlugin | `re_estimatepackage` | Create, Update | PreOperation20 | No filter/image |
| EstimateCustomLineSnapshotPlugin | `re_estimatelaborline`, `re_estimatematerialline` | Create, Update | PreOperation20 | No filter/image; parent schema must exist |
| ChildChangeTriggerPlugin | estimate equipment/package/labor/material | Create, Update, Delete | PostOperation40 | No filters; Update/Delete `pre` with `re_repairestimate` |
| StatusHistoryPlugin | `re_repairestimate` | Update | PostOperation40 | Filter `re_estimatestatus`; `pre` with status |
| ExportRequestPlugin | Global `re_EstimateExport` action | Custom API execution | API plugin association | String `InputJson` / `ResultJson`; transaction required |
| ExportLockPlugin | header/export/equipment/package/labor/material/cost | Create, Update, Delete | PreOperation20 |21 steps, synchronous, before other locks/calculation; no filtering |

Normal calculation intentionally has no Update filter so overwriting calculated fields invokes recomputation. Missing Update image throws `RE-115|PREIMAGE_REQUIRED`. Do not replace this requirement with a narrow filtering list without a coordinated reviewed change.

The ordinary matrix totals **37 table steps**:2 calculation+2 header lock+12 child lock+8 snapshot guard+12 child trigger+1 history. Export adds21, not replacement steps. Custom API associations are separate from those counts. Display-name queries alone cannot prove exact registration; inspect plugin types, messages/entities, enabled status, images, filters and ordering.

## 5. Atomic Save and snapshot ownership

```text
Draft API transaction
  -> validate request/status/row version/context
  -> tagged header Create/Update
  -> reconcile equipment/package/labor/material snapshots
  -> one untagged header equipment-count update
  -> calculation reads complete children and writes Target outputs
  -> optional submit/queue
  -> response serialization within transaction
```

- New header: Draft126110000, revision1, salesperson; branch/country/currency/province/reference choices validated.
- Update uses `IfRowVersionMatches`; stale callers cannot silently overwrite.
- Save requires an active imported Account matching the estimate market alias (`MKOF`, `CKE`, `CKQ`). Contact is optional; when supplied it must be active, source-imported/source-active and under that Account. Available master details override client values; missing values use validated estimate-only input.
- Load returns Account ID/number/name, optional Contact ID/master details and customer snapshots. Contact/default search includes incomplete Contacts, including missing-email records, while retaining source/active/parent filters.
- Opportunity presets retain the required Account, optional Contact and completed customer details. Preset save revalidates master references and required values through the same resolver.
- Equipment master must be active and branch/number match. Unlisted equipment creates **estimate snapshot only**, never equipment master.
- Existing unchanged equipment/package/rate/material identities reuse snapshots; master changes are not silently reapplied on unrelated edit.
- Packages validate currency/country/effective dates and nonnegative source hours/cost. Quantity scales with equipment.
- Each CSTM needs labor/material association. Labor rate is exactly one active effective branch/role/time combination.
- Material routes are distinct: legacy, approved catalog, manual non-KONE, package-priced KONE reference. Server resolves catalog conversion/snapshot, not client claimed values.
- Reconciles removed children and desired Create/Update rows; dependency checks prevent orphaned retained custom lines.
- Input200000 UTF-8 bytes; response1000000 bytes; child mutation budget1000 includes deletes and retained writes. Child/pricing read budgets also apply. No silent truncation; large replacement can exceed budget despite smaller final count.

### Snapshot plugins are guards, not copy engines

[SnapshotPlugins](../backend-pricing/Plugins/SnapshotPlugins.cs) now require validated draft-batch ancestry. Their names do **not** mean they recopy current master data on every write. DraftPlugin is sole snapshot writer.

[DraftBatch](../backend-pricing/Infrastructure/DraftBatch.cs) checks request `tag="RepairEstimator.DraftBatch:<estimate GUID>"` and `re_DraftEstimate` ancestry. A caller tag alone is insufficient. Historical live debugging found mutable Custom API SharedVariables did not propagate as assumed; request tag transport was implemented. Deploy Drafts and pricing together.

[ChildChangeTriggerPlugin](../backend-pricing/Plugins/ChildChangeTriggerPlugin.cs) touches `re_calculatedon` on old/new parent outside a tagged batch; skips estimate-delete cascade and tagged intermediate writes. It needs previous-parent image for deletes/moves. Final Draft API touch ensures one complete calculation.

## 6. Calculation execution and configuration origins

[EstimateCalculationPlugin](../backend-pricing/Plugins/EstimateCalculationPlugin.cs):

1. Apply defaults on Create.
2. Skip trusted export writes/child-lock touch or valid draft-batch intermediate write.
3. Merge Update Target with full `pre`; require image.
4. Load current header/snapshots/configuration.
5. Require equipment and packages.
6. Run pure engine.
7. Trace warnings; no suggested price or **any warning** becomes pricing unavailable.
8. Write calculated outputs directly into Target (no extra recursive update).
9. On Submitted transition run engine submission validation and timestamp handling.

Draft `PricingException` is handled by clearing outputs and marking `re_calculationversion=unavailable`. Other failures are not converted into valid pricing. Non-Draft pricing exception blocks operation. **Save success and calculation success are different outcomes.**

### Data sources

| Input | Source / rule |
|---|---|
| Country/currency/market/province | Header/branch context; default helper fills absent values |
| Primary equipment OEM/age/location | Saved first/primary equipment snapshot; master lookup establishes matched equipment |
| Redundancy count | Active caller-visible master equipment at saved primary functional location, not sold-to |
| Vertical | Header customer-vertical or saved primary vertical mapping |
| Package hours/material | Estimate-package snapshots, not live master prices |
| Mechanic rate | Unique active effective branch/mechanic/time labor-rate configuration |
| Custom labor/material | Saved child rate/cost/classification/applicability snapshots |
| Parameters | Country-specific over global; duplicate country/code invalid |
| Incentives | Country rows if available, else global |
| Bands/matrices/adjustments/margin rules | Active/effective reference rows and selected context |
| Choices | Live metadata mapped through [OptionMap](../backend-pricing/Infrastructure/OptionMap.cs) |

Configuration is loaded per calculation; no cross-environment stale configuration cache. Missing/overlapping rows can block pricing. Redundancy visibility can vary by user; do not grant broad access merely to force a number.

## 7. Authoritative server cost formulas

Source: [PricingEngine.CalculateCost](../backend-pricing/Pricing/PricingEngine.cs).
Percent inputs in engine are fractions:0.05 means5%. Markup field itself is percent and divides100. Standard rates are5% tax/14% freight; custom path uses entered fractions.

Notation: `N=max(1,equipment child count+additional equipment count)`, `Qp=explicit package equipment subset count, otherwise N`, `R=mechanic cost rate`, `t/f=applicable estimate tax/freight`, `round2=decimal rounding away from zero`.

```text
package hours = sum(package mechanic hours per unit × Qp)
package labor = package hours × R
standard material = sum(noncustom package material per unit × Qp)
custom material = sum(custom, not package-priced material per unit × Qp)
package KONE = sum(package-priced material-before-markup × Qp)
package material = standard material + custom material + package KONE
package tax = standard material × .05 + custom material × t
package freight = standard material × .14 + custom material × f
package estimated = package labor + package material + package tax + package freight

additional labor = entered extra hours × R
custom labor = sum(hours × (saved rate or R) × (multiplier or 1))
line extended = quantity × saved unit cost
line marked = extended × (1 + applicable tax + applicable freight)
custom material base = sum(line extended)
custom material marked = sum(line marked)
total additional = additional labor + custom labor + custom material marked
                 + (entered extra material + entered misc) × (1+t+f)
total true cost = round2(package estimated + total additional)
```

Custom lines only participate on custom path and count once per estimate. Standard package tax/freight remain fixed even in a mixed request. Package-priced KONE receives no extra tax/freight in this cost route. Tax/freight apply to material/misc, not labor.

Outputs include rounded labor/material/misc/total costs and tax/freight. `KoneMaterialCost` is taxed/freighted classified KONE line cost plus package KONE base. Subcontractor captured input is not included by this engine cost method. Money `_base` fields are platform-generated, not source amounts.

Catalog snapshots: CAD USD cost and price apply approved conversion/uplift in current server implementation; precise source-unit snapshots are retained. Browser dev preview is not authority; see [app formulas](app.md).

## 8. CMII, suggested price, bands, incentives and approval

### Rule sequence

1. `median = total true cost/(1-MEDIAN_QR_MARGIN)`; margin must0..less than1.
2. Quote type QR if cost zero or median >=QQ_THRESHOLD; otherwise QQ.
3. QR job-size band matches lower-inclusive/upper-exclusive median range; ambiguous error. Missing band generates warning.
4. OEM keyword band; age threshold band; equipment matrix. Unmatched primary equipment ->High equipment band.
5. Vertical/redundancy customer-base matrix; national account Yes ->Low elseHigh; final customer matrix. Unmatched primary ->Medium customer band.
6. Job rating(defaultMedium) and job complexity matrix.
7. Margin rule matches quote/equipment/customer and, for QR, job band; ambiguous rule errors.
8. Applied situational rules sum matching emergency/budget/paper/competing input; competing adjustment requires non-KONE paper, plus explicit required-paper condition.
9. `target CM2 = base target + situational adjustment`.
10. Recommended CMII precedence: positive stated labor rate derived margin; else equipment type fixed target; else target CM2.

### Price and booked margin

```text
suggested price = round2(total true cost / (1-recommended CMII))
actual CMII = round4((entered sell price-total true cost)/entered sell price)
CMII variance = actual CMII-recommended CMII
```

Actual only calculated if sell>0. Recommended must0..less than1. Negative actual CMII can be valid but requires below-target justification to submit.

For custom KONE alternative suggested price:

```text
round2((total true cost-KONE material cost)/(1-recommended CMII)
       + KONE selling contribution)
```

Contribution differs by mutually constrained route:

- Package-priced: final package material cost-per-unit×N, once.
- Itemized catalog: sum(quantity×saved unit selling price×(1+applicable entered tax+applicable entered freight+markup/100)).
- Legacy VK13: entered spares sales price×(1+configured KONE tax+freight+markup).

Mixed incompatible KONE routes, invalid classifications/zero package-reference charges or missing catalog markup/selling price error rather than double-counting.

### Positive stated labor billing rate

The engine derives a selling rate margin, not substitutes that rate as mechanic cost:

```text
cost basis = combined hours × mechanic cost rate + stated-rate material basis
selling basis = combined hours × entered stated labor billing rate
              + material basis/(1-max(material margin floor,target CM2))
stated-rate margin = (selling basis-cost basis)/selling basis
```

Material/hour basis follows standard/custom branches in `StatedRateMargin`, including package, applicable custom lines and extras. It is not simply actual CMII on entered proposal price. Invalid floor/target margin or absent needed target blocks availability.

### Incentives and approval

- Choose highest incentive minimum<=actual CMII; AM/BD amounts=sell×payout, rounded whole units away from zero.
- Below0% can retain zero incentive only when applicable configuration has explicit zero minimum/zero payout band; missing incentive config is still warning/unavailable.
- Approval Regional if sell>=regional threshold, else District if >=district, elseNone. `requiresapproval` derives from that output; **no approval/reopen workflow is implemented by this level calculation**.
- All warnings make pricing unavailable in the calculation plugin even where engine internally has provisional fallback bands.

## 9. Output writer, defaults, history and locking

### CalculationWriter

Writes cost/price/margin/band/lookup/incentive/approval outputs plus UTC calculation time and engine version. Full logical-column list is in [dataverse.md](dataverse.md). Mirrors tax/freight percentage and CM2/CMII alias columns.

`Clear` nulls outputs/time and marks version `unavailable`, preventing stale success-shaped data. `re_cmiiwithkonematerial` is cleared but not assigned on success by this writer; do not claim it is populated without another verified writer.

### Defaults

[EstimateDefaults](../backend-pricing/Plugins/EstimateDefaults.cs) fills absent revision/salesperson/branch-derived country/currency/market/province/language on Create. French precedence: province requirement or Quebec market, otherwise province then branch then user preference. Draft API also explicitly validates/fills context. This helper is not a separate registered plugin type.

### Locks

[EstimateLockPlugin / ChildLockPlugin](../backend-pricing/Plugins/EstimateLockPlugin.cs) reject non-Draft header/child edits, including Pending/Submitted; no admin or depth-based reopen bypass. Child moves validate both previous/proposed parents; missing parent explicit error.

Export lock is distinct: queued export can remain Draft yet be immutable. Existing ordinary status locks alone do not implement outbox safety.

### Status history

[StatusHistoryPlugin](../backend-pricing/Plugins/StatusHistoryPlugin.cs) PostOperation status change writes name/from/to/header/UTC/user with estimate owner. Uses system Create; initiating user retained in `re_changedby`. Not all edits or initial Create produce history, and it does not write user comments.

## 10. Export plugins and held automation

Current preceding Dev observation: exact API `re_EstimateExport` exists; export switchfalse/sample; no processing-step names containing ExportLock returned. A name query is limited evidence; inspect actual plugin-type association before declaring registrations absent. Correct API naming no longer needs old duplicate-prefix fix.

[ExportRequestPlugin](../backend-pricing/Automation/ExportRequestPlugin.cs):

- Requires transaction, valid unique configuration, optimistic concurrency and authorized configured flow identity for state operations.
- `queue`: verifies editable header, recalculates/validates, freezes hashed JSON snapshot, creates outbox and links/locks header.
- `claim`: exclusive run ID; occupied request explicit no-claim, not permission to send.
- `generated`: approved workbook URL; `sending`: records time before sending.
- `accepted`: requires send receipt/time; `finalize`: submitted header/time and completed outbox.
- `fail`: pre-send failure; `review`: ambiguous sending, do not auto-resend.
- Repeated allowed transitions support controlled idempotency with run/file/receipt checks.

[ExportState](../backend-pricing/Automation/ExportState.cs) governs transitions; [ExportSnapshot](../backend-pricing/Automation/ExportSnapshot.cs) captures immutable payload/hash. Plugin does not generate Office Script workbook or email by itself; external flow performs those. Acceptance is connector evidence, not guaranteed inbox delivery.

ExportLock rejects direct outbox/reserved-header mutations; queued parent/children lock and child touches serialize concurrent changes. Required21 registrations, keys/concurrency/permissions/flow recovery must be verified before enabling. Automation remains held; this document does not enable it.

## 11. Error contracts and diagnostics

Codes are domain-specific: **same numeric code can have different keys** (notablyRE-141 in snapshot versus export).

| Code/key | Meaning / next check |
|---|---|
| RE-100 SELL_PRICE_REQUIRED | Positive sell required for submit |
| RE-101 MARGIN_COMMENT_REQUIRED | Below recommended margin justification |
| RE-102 PRICING_NOT_AVAILABLE | Missing recommendation/suggested result/warnings |
| RE-103 BILLING_PLAN_REQUIRED | Billing required above configured threshold |
| RE-110 PARAMETER_MISSING | Missing required pricing parameter |
| RE-111 PRICING_INPUT_INVALID / PARAMETER_INVALID / MARGIN_INVALID | Invalid cost/material route/rate/margin |
| RE-112 LABOR_RATE_MISSING[_OR_AMBIGUOUS] | Branch/role/time active effective rate |
| RE-113 EQUIPMENT_LOCATION_REQUIRED | Matched primary snapshot location absent |
| RE-114 *_SNAPSHOT_MISSING / INVALID / CLASSIFICATION_INVALID | Child snapshot prerequisites |
| RE-115 PREIMAGE_REQUIRED | Calculation Update registration lacks `pre` |
| RE-116 SELECTIONS_REQUIRED | Equipment/packages absent |
| RE-117 *_AMBIGUOUS | Configuration or rule overlaps |
| RE-130 ESTIMATE_LOCKED / RE-131 ESTIMATE_PARENT_REQUIRED | Status/parent locks |
| RE-141 USE_DRAFT_API_FOR_SNAPSHOTS | Direct snapshot write or broken tag/ancestry |
| RE-140 EXPORT_TRANSITION_INVALID | Illegal delivery lifecycle transition |
| RE-141 EXPORT_CLAIM_CONFLICT / RE-142 EXPORT_FILE_INVALID | Run ownership/file validation |
| RE-146 EXPORT_CONFIGURATION_INVALID | Switch/config uniqueness/mode prerequisites |
| RE-147 EXPORT_CONCURRENCY_REQUIRED / RE-148 EXPORT_TRANSACTION_REQUIRED | Export platform registration/schema context |
| RE-149 EXPORT_COMMAND_REQUIRED / RE-150 EXPORT_FLOW_USER_REQUIRED | Command/flow identity |
| RE-151 EXPORT_PARENT_INVALID / RE-152 EXPORT_HASH_INVALID | Parent linkage/frozen payload integrity |
| RE-153 EXPORT_SEND_EVIDENCE_REQUIRED / RE-154 EXPORT_IMMUTABLE | Receipt/immutable writes |
| RE-500 UNEXPECTED_ERROR | PluginBase traces unexpected exception and throws |

Draft API validation also returns descriptive errors without RE prefix, including invalid/missing Account/Contact selection, market mismatch, inactive/unimported records and a Contact-parent mismatch; do not build diagnostics on code number alone.

[PluginBase](../backend-pricing/Infrastructure/PluginBase.cs) preserves explicit plugin errors, translates PricingException and traces unexpected failures. User service=context.UserId; system service=null. Configuration reads/status history and export system operations differ from caller-owned mutation paths; verify actual role/depth/Append privileges.

**Calculate blank troubleshooting:** confirm published UI/DLL identity -> Save response -> saved row version/calculation version -> plugin trace -> unique effective rates/snapshots/rules -> registration/images -> non-admin read/output-lookup privileges. Draft `unavailable` may be successful save, not silent frontend failure. Original user's live root cause is still not conclusively identified.

## 12. Known gaps and expected versus current

| ID | Expected | Current evidence / required work |
|---|---|---|
| PL-01 | Deployed engine matches source2026.7 | Dev assembly version1.0.0.0 only; hash/version mapping and live golden cases unverified |
| PL-02 | Every valid UI string saves | Backend/live text length mismatches confirmed in Dataverse reference; no fix authorized in audit |
| PL-03 | Full calculation results after Calculate | Draft pricing exception clears outputs; local UI feedback improved, live cause unresolved |
| PL-04 | Complete export locking/delivery | Disabled switch; full registration/flow/security acceptance unverified |
| PL-05 | Schema ledgers current | Some design-only status labels stale for Dev table/column existence; approval still distinct |
| PL-06 | Every advertised output has writer | cmiiwithkonematerial not assigned on writer success; current Draft Save not cost-line writer |
| PL-07 | Snapshot plugin names mean copy | They guard API-owned snapshots; preserve this intended behavior |
| PL-08 | Authoritative pricing parity certified | Synthetic/simulated tests do not prove approved workbook parity or real transaction behavior |
| PL-09 | Business removes KONE/non-KONE/markup | Existing server semantics retained; requested redesign/migration not implemented |
| PL-10 | Approval band means approval workflow | Classification only; no approve/reject/reopen path |
| PL-11 | Customer master search/lookup works in Dev | Source now implements it, but schema/API/app deployment and non-admin tenant verification have not been performed |

## 13. Build, tests and deployment acceptance

Current local verification is recorded in the customer-master change-log entry below. Do not infer live capacity/rollback/security from a successful local build or simulated pipeline.

```powershell
dotnet test .\backend-pricing-tests\RepairEstimator.Tests.csproj -c Release
dotnet build .\backend-tests\DraftTests.csproj -c Release
.\backend-tests\bin\Release\net462\DraftTests.exe
node --test .\tests\dataverse-documentation.test.mjs
```

Before rollout:

1. Confirm approved schema/types/precision/length/relationships, snapshots and active unique effective rules.
2. Build both signed assemblies, preserve deployed identities, update together in approved maintenance.
3. Verify Custom API String contracts, transaction and type association; exact names, not publisher-prefix assumptions.
4. Inspect37 ordinary steps, images, filters, ordering/enabled status; export21 separately.
5. Non-admin Save/load/recalculate, mixed standard/CSTM, catalog/package/legacy paths, duplicate references, boundary lengths and large drafts.
6. Stale writers, real transaction rollback, direct snapshot tampering, unchanged snapshot retention, status/parent locks and history ownership.
7. Missing/ambiguous config -> unavailable -> correction/recalculate recovery.
8. Reconcile approved workbook golden cases, amounts/rounding and margins, not merely successful build.
9. Export disabled fallback first; enable only after queue/claim/failure/ambiguous send/receipt/finalize acceptance with flow user.
10. Record solution/environment/source-to-DLL evidence and frontend publish identity without personal records/secrets.

## 14. Same-change maintenance and change log

- [Instructions](../.github/copilot-instructions.md) require plugin reference updates with API/formula/loader/snapshot/lock/registration/schema/permission/export changes.
- [Guard](../automation/check-dataverse-doc.cjs) requires this file when `backend`, `backend-pricing`, their test projects or maintenance guard/workflow/instructions change. Broad project-folder scope includes schema/project files.
- Update [dataverse.md](dataverse.md) too for table/persistence/output/API changes, and [app.md](app.md) for affected UI/button/preview/error contracts.
- [Workflow](../.github/workflows/dataverse-documentation.yml) checks changed reference presence and rejects empty/deleted files. Human review must verify meaningful accuracy.
- After publishing, admin must require **Dataverse documentation / documentation** branch check to enforce merges. No branch-protection settings changed here.
- No automatic tenant monitoring or DLL reflection-to-document rewriting; manual deployments outside Git still require dated evidence.
- Log: change, plugin/API, table/column/formula/registration impact, expected/current, tests, source/deployment status, unresolved IDs. Never log credentials/customer payloads.

| Change | Plugin impact | Evidence / deployment |
|---|---|---|
| Existing coordinated batch transport | API request tag+ancestry; single final calculation | Prior local tests; deployed exact source unverified |
| Existing pricing2026.6 | Catalog CAD price uplift, current mixed/package-priced behavior | Source inspected; live workbook parity unverified |
| This reference2026-11-04 | Plugin inventory/formulas/registration/errors and same-change guard | Five guard tests passed, including real Git diff and missing/empty/deleted plugin reference;37 plugin source links resolved; YAML/script syntax checked. Documentation/tooling only; no runtime or tenant changes |
| Live master identity foundation2026-11-04 | Account/Contact source-ID keys and Equipment `re_customeraccount` relationship published in Dev | See [schema ledger](../backend/master-data-foundation-schema.json) and [Dataverse evidence](dataverse.md). Estimate lookup/API changes are a separate local source change below; no assembly deployment or record import |
| Additional master mapping columns | Nine Account and four Contact optional source fields published; no plugin field allowlist changes | [Dev-only deployer](../automation/deploy-master-foundation.ps1) created 13 columns; independent metadata dry run found zero missing. Active source keys verified. New Boolean defaults are not imported source truth. Pricing workbook profile now complete, including 12 invalid USD/CAD cost cells per column. No import, catalog activation or DLL deployment; see [Dataverse evidence](dataverse.md) |
| Customer master lookup source, current change | Draft API `accountsearch` / `contactsearch`, required market-matching Account + child Contact on Save, server-derived Contact details, lookup load response and preset relationship mapping; schema ledger includes optional estimate lookups | `dotnet build backend\\RepairEstimator.Drafts.csproj --no-restore` passed with 0 warnings/errors. Schema-only Dev deployment created both estimate lookup relationships and both raw metadata columns; a separate read-only dry run verified zero missing schema items. Plugin assembly registration/update, app publish and master-record import were not performed. Tenant runtime behavior remains unverified |
| Full-import preflight,2026-11-05 | No API, formula, registration, permissions or export behavior changed | Read-only live counts, existing keys and v4.0 source mapping prerequisites checked; reference tables already contain records. Source projection, employee/planner/site mapping and bulk-import gates remain unresolved. No assembly deployment, master-record write or published-app verification; see [Dataverse readiness check](dataverse.md) |
| Customer bulk transport and presentation probe,2026-11-05 | No plugin/API source, registration, formulas, locks or export changes; direct Account/Contact master writes use existing keys and metadata | Two individual Account `UpsertMultiple` writes succeeded; larger batches failed HTTP400 (`0x80040216` in diagnostic response), with attempted rows retained. Separate `CreateMultiple`/`UpdateMultiple` 10/500/1,000-Account pilots passed exact read-back; 1,511 Account source rows checkpointed before continuous Account/Contact import started. 33 importer and 5 documentation tests passed; Contact live acceptance and full completion still pending. The read-only `accountsearch` probe failed HTTP400/code `0x80040265`. Drafts deployed version1.0.0.0 modified2026-11-01T19:38:52Z and pricing version1.0.0.0 modified2026-11-02T03:17:05Z both differ in hash from local DLLs. No new plugin or app deployment; runtime failure cause remains unproven. See [current Dataverse evidence](dataverse.md) |
| Import token recovery and manual-master requirement,2026-11-05 | No plugin behavior change; customer-master writeback after explicit confirmation is a newly approved target, not an API currently implemented | Read-back GET expired with HTTP401 after 7,511 Accounts checkpointed; renewal reconciled the next 1,000 exactly with zero writes (8,511 verified). Apply adapter retries an expired-auth read once and never replays writes for auth recovery. 35 importer tests passed. Future manual master writes must use caller privileges, verified identities/parents and concurrency, preserve original export metadata and leave genuinely absent mappings blank. Current API still requires imported selections and derives Contact text; coordinated source/schema/runtime rollout remains necessary |
| Customer checklist and Equipment schema-gap preflight,2026-11-05 | No API/formula/registration/permissions/export change | Customer apply supports sanitized per-checkpoint checklist updates and was verified by a live 1,000-Account pilot (24,511 total checkpointed); detached continuation was started, not declared complete. Read-only metadata preflight covered 60 Equipment headers, identifying missing Account classification/Equipment KOL columns and location/planner tables; no schema or Equipment row writes. 41 Python tests passed. Full Equipment/source reconciliation, shared manual-master API and coordinated plugin/app deployment remain outstanding |
| Equipment preparation/update source and customer reconciliation,2026-11-05 | No plugin/API/formula/registration/permissions/export changes; optional Equipment source-preservation schema handled by explicit importer flag | Equipment staging preserves 60 raw columns and typed source fields; existing-only updates retain GUID/branch/location, defer missing contexts/parents and do not overwrite Account classification. Explicit deployment would add optional Equipment export-metadata Memo100000 and KOL String100, with publication/read-back verification. Source is not deployment evidence. Customer GET timeout batch reconciled with zero writes, reaching 31,511 verified Accounts; Contacts pending. Assembly/app deployment and manual-master API remain outstanding |
| Equipment live preservation-schema and existing-record updates,2026-11-05 | No assembly/API/formula/registration/permissions/export changes; optional Equipment metadata Memo100000 and KOL String100 published | Independent direct attributes and subsequent collection read confirmed deployed types/lengths/write validity after transient post-publish metadata inconsistency. All428,400 source rows staged (320,030 valid;108,370 rejected, including108,366 precision rows and4 duplicate-key rows). Three existing-row batches verified120 Equipment values/GUIDs/unchanged branch/location;45-row repeat read passed with zero writes. Missing contexts168, unverified parents12 and pending319,730 remain; no new Equipment creation or guessed planner/site/Account classification.53 Python tests passed. No updated DLL or app publication |
| Customer verification acceleration,2026-11-05 | No plugin/API/registration/formula/permission/export change | Four parallel read-only requests use independent API/header state; original exact fields/parent checks and sequential writes retained.500-Account serial/parallel live records matched (8.67s/3.54s read benchmark);1,000-row live accelerated pilot verified38,511 total Accounts with402,694 pending, no inflight rows, Contacts pending.57 Python tests passed; no prepared-contract bypass. No DLL or app publication and no full-import certification |
| Continuing master verification,2026-11-05 | No plugin/API/registration/permission/export change |41,511 Accounts verified at inspected checkpoint. Ten further Equipment batches verified354 additional existing records (474 total), retaining GUID/branch/location and verified-parent checks.318,730 pending,782 context/44 parent deferrals and108,370 quarantines remain; no Equipment creates or guessed mappings.58 Python tests passed. Contacts, remaining imports and DLL/app/manual-writeback deployment unfinished |