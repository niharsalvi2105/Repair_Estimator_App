# Repair Estimator - Dataverse implementation and persistence reference

## 1. Purpose, evidence and reading guide

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
| Contact ID (`contactId`) | `re_customercontact` -> `contact` | Optional Lookup deployed in Dev; local Save source requires an active imported Contact under the selected Account |
| Customer name (`customer`) | `re_customername` | Required; server derives from `contact.re_salesforcename` then `fullname`; Dataverse Dev limit 100 |
| Customer email (`email`) | `re_customeremail` | Required; server derives from `contact.emailaddress1`; Dataverse Dev limit 100 |
| Customer phone (`phone`) | `re_customerphone` | Optional; server derives from Contact telephone/mobile; backend/Dataverse limit 50 |
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

Current source pricing engine is `2026.6`. CAD catalog cost **and price** apply FX and approved uplift. KONE material tax/freight use entered rates and applicability, with current markup semantics. Removing KONE/non-KONE/markup was requested earlier but **not implemented**.

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