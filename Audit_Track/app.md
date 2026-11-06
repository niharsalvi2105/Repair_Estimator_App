# Repair Estimator - frontend UI, controls and calculation reference

## 1. Scope and evidence

### MKO master-data priority (2026-11-06)

Email/template flow work is paused in favor of all MKO master imports. User approved making valid effective refined MKOM parts available through the existing catalog and correcting existing MKO package names/scopes from the supplied source, without changing financial values or GUIDs. Catalog search/effectivity, positive per-unit KONE pricing requirements and saved-line snapshot preservation remain unchanged; zero/non-unit source records stay inactive instead of causing catalog errors. Long/missing source fields and unresolved Equipment mappings are not guessed. No frontend publication or business Save/Submit is part of this import. Source/local tests, native Dataverse readback and browser/non-admin acceptance remain distinct; completion is recorded in [dataverse.md](dataverse.md).

All 280 MKO package source texts/provenance are now verified natively with unchanged financial fields/GUIDs and unchanged CAD masters. The parts continuation checkpoint reached 12,500 newly verified rows and is paused; this is not the final catalog total. User approved exact MKO Equipment plant-to-Branch-number mapping, source SAP functional-location numbers and eight-decimal coordinates with raw originals preserved; only verified source Account parents may be linked. The completed bounded Equipment pilot created and readback-verified 64 records while preserving 186 conflicting native records unchanged. Existing account/branch Equipment filtering remains unchanged, so new valid relationships can become eligible through existing reads. Cached catalogs/saved snapshots are not automatically refreshed; published-browser/non-admin behavior remains unverified.

Subsequent remaining-data continuation supersedes the paused checkpoints above: user approved safe API continuation; parts and Equipment writers resumed while the customer writer remained active. At a later checkpoint, parts reached 14,500 verified and Equipment reached 3,425 verified with 1,075 native conflicts preserved. The attempted dataflow source connection was blocked by a popup error and its unpublished wizard was cancelled before parts resumed; there is no parallel dataflow refresh. These are master-data readback results, not frontend publication, automatic snapshot refresh or complete source import. Exact Branch-name/SFDC labor comparison found 1,308 existing rate amounts agreeing at cent precision; no rates or UI pricing logic were changed. See [dataverse.md](dataverse.md) for unresolved contexts and evidence limits.

The generated import checklist now incorporates current MKO reports and full package completion evidence instead of fixed "not imported" parts text and an Equipment-only historical checkpoint. It explicitly separates source candidates, quarantines, native conflicts and incomplete runtime acceptance. A temporary private refresher keeps reporting current while cached import writers continue; brief stale intervals between refreshes are possible. This is reporting-only: no frontend controls, calculation/display behavior, access, saved snapshots or publication change. See [dataverse.md](dataverse.md) for report inputs and verification limits.

### New internal-submission PDF template source (2026-11-06)

The separate [v2 workbook generator](../automation/build-submission-template.cjs) and [FillSubmission Office Script](../automation/office-scripts/FillSubmission.ts) implement a new Letter-portrait summary inspired by the supplied layout, not a modification of the legacy v1 templates. Summary includes customer/Account, opportunity, location, packages, scope, saved costs, selling/suggested prices, CMII, incentives, billing plan and CTT notes. A Details continuation preserves every supplied non-null payload field, equipment, package assignment, scope and custom labor/material/cost row. Long summary fields explicitly refer to Details instead of silently clipping; absent optional amounts remain blank. The artifact is an internal submission, not a customer proposal. It contains no sample business/contact records.

The script consumes saved values only, uses ISO currency supplied by the flow, formats fractional CMII as percent and variance as percentage points, and never calculates workbook prices. It refuses unavailable/missing pricing, duplicate rows/keys, missing anchors, previously filled templates and invalid payloads. Scope and notes continuation is UTF-16 safe; formula-like strings are escaped. Local new/legacy export and documentation tests and the standalone strict script type-check passed. Isolated desktop Excel PDF rendering of blank/synthetic workbooks is local evidence only; SharePoint upload, Office Scripts connector execution, cloud PDF conversion, flow mapping and email delivery are not deployed/verified. No frontend UI, Save/Submit or pricing behavior was changed by this template addition.

### Finance calculation audit and configuration errors (2026-11-06)

The source pricing engine now rejects ambiguous matrix/redundancy rules and duplicate incentive thresholds rather than choosing a row by retrieval order. Submission errors for the three new `RE-117` keys have English/French administrator-remediation messages while retaining original diagnostics. Draft pricing failures retain the existing unavailable state and cleared outputs; the UI must not substitute a local preview or stale saved totals. No frontend pricing formula, input default or automatic Save changed. Local engine version is `2026.8`; this change is not published/deployed by the audit.

The independent mixed-cost decimal fixture and mocked Draft recovery/submission tests are local evidence. Read-only Dev inspection separately found no current ambiguity in the three audited effective configuration tables and reconciled five cost/hour fields for one existing standard CAD sample on deployed `2026.7`. This is not all-request, CSTM, currency-conversion, workbook-parity or non-admin certification. The displayed captured-only subcontractor field remains excluded from authoritative totals pending any separately approved rule change.

### Multiple linked Contact availability (2026-11-05)

Read-only diagnosis confirmed that a reported single Account has two source Contacts, not two person-name Account records. One Contact was missing from the incomplete import. A scoped exact-source import corrected that missing record; native-table reads and the published defaults API now return two eligible Contacts with neither marked primary and no truncation. The existing Account selector therefore shows both Contact choices without guessing, and the selected person's details populate email/phone. Existing saved Contact choices are preserved; use Change Contact to select another linked person. No frontend or server behavior change, auto-save, contact merging or master writeback. Full Contact import remains incomplete; live UI rendering is not claimed by native/API verification alone.

### Pricing conflict resolution for itemized KONE / aggregate VK13 (2026-11-05)

The reported missing overview was a failed Save/Calculate: the server rejected simultaneous itemized KONE material and positive legacy aggregate VK13. Pricing cards require successful saved calculation and are not fabricated on rejection. Frontend now detects that same conflict before Save/Submit and shows an actionable Pricing warning with an explicit Clear aggregate VK13 price button. Clearing changes only the local aggregate field; it retains all material lines and does not auto-save, submit or choose a price silently. Users can instead remove itemized KONE references to retain aggregate pricing. Busy/submitted/export locks remain respected.

The shared guard covers catalog/itemized KONE and package-priced KONE references with positive aggregate amounts; manual non-KONE plus aggregate remains allowed by this guard. Backend double-counting validation and pricing formulas are unchanged. Saved-data validation and subsequent calculation remain authoritative.

Five focused validation unit tests, production build/type-check and changed-file ESLint passed. The focused mocked browser regression passed conflict visibility, disabled Save, explicit clearing without a service call and subsequent Save retaining itemized KONE while omitting a positive aggregate. The initial regression failed only because the mock call counter was undefined before the first Save; its assertion now correctly treats no calls as zero. Frontend Dev publication succeeded with built entry `index-s31LQpTJ.js`. Live user-request recalculation and served-browser version are not claimed; no real estimate Save/Submit or backend/schema deployment was performed.

### Full CAD package catalog availability (2026-11-05)

The package dropdown already pages through all eligible Dataverse results and exposes local matches beyond the first 50 with More results. Its active/country/currency/effective-date filters remain intact; USD prices are not exposed as CAD. Read-only diagnosis found only three CAD masters versus 280 USD masters, explaining the Canadian catalog gap rather than a UI paging cap. User approved importing the full 280-package CKE/CKQ CAD union, including CSTM/T&M, with declared two-decimal monetary rounding and raw source provenance.

Import completed with independent full-field/provenance readback of all 280 CAD masters and unchanged USD verification. A separate native query confirmed exactly 280 active effective CAD packages for either Canadian Branch context, no duplicate IDs/numbers, one CSTM and one T&M; the currency-filter unit contract passed. Search and More results cover the loaded catalog; imported CSTM uses the existing separate custom editor. Existing selected/saved snapshots are not silently refreshed or rewritten. A newly loaded request/app session fetches the expanded catalog; an already cached catalog may require a safe reopen/refresh after preserving work. No UI filter bypass or frontend publication was needed for these master changes. Published-browser rendering/non-admin evidence remains unverified; native eligibility does not prove a cached browser refreshed. See [dataverse.md](dataverse.md).

### Additional details independent of CSTM (2026-11-05)

The Additional details page now permits estimate-level additional labor hours, material, miscellaneous and scope for standard-only as well as CSTM requests. The former frontend-only CSTM gate on the three numeric additions and its misleading help/heading were removed. Package-specific labor/material still use the separate CSTM editor; entering the same work twice remains incorrect. Standard package tax/freight remain fixed at 5%/14%, custom-rate rules remain unchanged, and review/submitted/busy/export locks are retained. Existing persistence and server formulas already support these estimate-level additions independent of CSTM. This changes input availability, not pricing formulas or Dataverse mappings.

Local evidence: build/type-check and changed-file ESLint passed. Four focused desktop/mobile browser cases passed standard additions editability, exact cost preview (259.50 + 100 + 15 × 1.19 = 377.35 in synthetic fixtures), saved fields/reopen and the separate mixed-package CSTM editor. Submitted locking and French dark mobile full-form cases passed. French light mobile initially failed before reaching Additional details after an unexpected navigation; its isolated rerun passed without a source change. All browser services are mocked, not tenant financial acceptance. Frontend push to the existing Dev app/solution succeeded with built entry `index-BYC_bpNr.js`; published-browser served-version verification remains unclaimed. No backend/schema deployment or real business Save/Submit/email.

### Account required-marker alignment (2026-11-05)

Account number label text and its decorative required asterisk now share one inline wrapper within the field's grid label, instead of becoming separate grid rows. The input remains programmatically required and its label association is unchanged. This is presentation-only, with no Dataverse/backend or validation changes. Both desktop English and 320px French browser tests passed marker/label geometry assertions alongside customer autofetch checks; services were mocked. Production build/type-check and changed-file ESLint passed. Frontend publication to the existing Dev app/solution succeeded with built entry `index-DHYkxiiQ.js`; live browser served-version verification is not claimed. No business record writes or backend deployment.

### Account-linked location descriptions (2026-11-05)

This supersedes the earlier manual-only description limitation below. The user confirmed `re_equipment.re_description` as the authoritative description source. Selecting an Account number reads active Equipment under the exact selected Account and Branch. A complete list with one distinct nonblank description autofills the existing Functional Location Description only when it is blank. Multiple values appear in a labeled Dataverse dropdown for explicit selection; the input remains editable. Saved/manual values, including edits made while the request is in flight, are preserved. Changing an existing Account/Branch clears stale values through the existing handlers, and canceled responses cannot overwrite a new selection.

Description candidates use the existing 300-character `re_buildingname` limit without source truncation. The bounded read probes 21 described Equipment records and returns distinct usable descriptions from the first 20, with independent incomplete-list and overlength warnings. Neither condition permits a unique automatic default. Users can choose a shown description or enter/confirm a compliant missing value. Functional-location numbers remain separate read-only context; billing address, Account generic Description and Plant Section Description are not substitutes. No automatic Save, master writeback or pricing/submission-rule change.

Local validation: production build/type-check, changed-file ESLint, 27 customer/draft/clone unit tests, signed Drafts customer-defaults executable and seven focused browser scenarios passed. Browser coverage includes desktop/mobile EN/FR, automatic unique descriptions, explicit multiple-choice selection, 300-character contracts, incomplete/overlength warnings, account-switch and delayed-response protection, manual-value retention and saved Contact persistence. Browser services are mocked. Read-only Dev native queries found two distinct within-limit Equipment descriptions for the existing source-backed sample, so that sample requires dropdown selection, not automatic guessing. Five documentation-guard tests also passed.

Dev publication: the signed Drafts assembly was updated in place and its hash/identities independently verified; the live defaults API returned descriptions/flags exactly matching a native-table query. Frontend push to the existing Code App/solution succeeded with built entry `index-CL4ZeH40.js`. Published-browser verification is still pending; a push/build is not proof that a cached browser serves the new version. No business record Save/Submit/email or import restart was performed.

### Opportunity-page autofetch correction (2026-11-05)

The published external JPG URL was observed failing to load in the Power Apps runtime. The existing supplied logo is now bundled inline, without an external asset request. New unsaved opportunities receive an editable generated label (`Repair - market/account name - draft ID prefix`, at most 100 characters); this is not the authoritative Dataverse request number. Generating that label alone does not mark a pristine workspace dirty. Saved titles and user edits are retained.

Account selection appears directly after Branch, with explicit read-only Account number and Account name. A read-only Draft API request loads eligible Contacts under that Account and distinct functional-location numbers from active Equipment linked to both that Account and Branch. Only a sole eligible Contact or unique primary in a complete result is preselected. Its name/email/phone populate the existing read-only fields. Multiple choices are shown without a second search; manual name/email search remains available. Functional-location numbers are displayed separately as read-only context; they are not building descriptions and are never copied into the required description field. Authoritative site-description mapping remains missing, so that field must still be confirmed/entered. Billing addresses are never substituted for building names. A manually entered description before the first Account selection is retained; changing/clearing an existing Account or Branch clears stale customer/location values. Superseded responses cannot populate a newly selected Account.

Currency can display before Branch only when all accessible branches in the selected market agree on the same currency lookup; after selection it always uses the Branch's Dataverse currency. Province still comes from Branch and salesperson from the signed-in session. No user-to-organization/branch mapping is inferred. Accounts remain market-scoped (not restricted to the partially imported Equipment population); National Account classification is not inferred from free-text customer type. Missing Contact/Equipment imports or relationships cannot be fabricated. Missing/ambiguous values and truncation are explained; failed reads have an explicit Retry. Save/Submit/customer/currency/locking checks remain unchanged. No master writeback, schema change or automatic Save is introduced.

Validation: production build/type-check and changed-file ESLint passed (existing Vite chunk-size warning remains). Thirty-one focused customer/draft/clone/documentation contracts passed; the final customer/documentation selector passed all eight again. Nine final browser scenarios passed, including desktop/mobile EN/FR, logo loading, generated title, read-only Account name, eligible Contact defaults, separate location-number display, missing-description validation, superseded-response protection, manual-title retention, truncation/error/retry and persisted customer references. Four focused clone scenarios also passed before the final presentation-only separation of location numbers and description. These browser tests mock Dataverse and are not tenant acceptance.

Final Dev publication succeeded. After refreshing the host's cached version, the runtime loaded `index-BV0r7lbE.js`. The existing real-source draft was reopened without Save and its saved title retained. A fresh unsaved request was then prepared by selecting the same real Branch and searching/selecting its Account number: Account name, Contact email/phone matched the saved source-backed sample exactly; generated opportunity label, CAD, province, salesperson and the inline logo were present. The linked functional-location number appeared separately while the description remained blank rather than being fabricated. Save stayed disabled for incomplete required inputs, with no UI alert or horizontal overflow. No new draft Save, Calculate, Submit or email was performed. The signed Drafts read enhancement was deployed and independently reconciled against native-table reads; see [plugin.md](plugin.md). This is admin Dev evidence only; full imports, authoritative building-description mapping, signed-in organization/branch mapping and non-admin acceptance remain incomplete.

Follow-up user-approved demonstration used a separate browser tab to preserve the user's current workspace. Selecting the verified sample Account populated Account name, Contact name/email/phone and functional-location number without manual Contact searching. The saved validation draft was then opened read-only at Pricing: four cards, composition and gauge rendered with CAD 3,714.80 true cost and CAD 9,818.08 suggested price; Recalculate was enabled and there were no UI alerts. Missing entered price and actual CMII remained dashes. No Save/Calculate/Submit was clicked. The screenshot showing only the heading/Calculate button is the uncalculated state, not evidence that the new dashboard was absent; incomplete customer/location prerequisites still correctly disable Calculate. A different selected Account was independently found to lack Contact/Equipment data even in supplied source files; see [dataverse.md](dataverse.md).

### Pricing dashboard redesign (2026-11-05, source and Dev publication)

The Pricing & CMII summary on Pricing and Review now follows the supplied dashboard reference: four colored price cards, Price Composition with a cost breakdown, CMII semicircle with target/recommended/variance cards, and AM/BD incentive tiles. Existing shell/navigation and Calculate/Recalculate/Submit rules are unchanged. Values still come from the version-checked saved Dataverse pricing response; missing optional amounts show a dash, never invented zero.

The composition chart is explanatory UI only. It splits total cost into package estimated cost, custom labor, custom material and **other additional costs** (saved additional costs minus custom labor/material). The reference illustration's additional-cost figure already includes custom costs, so using it as a fourth additive slice would double count. The table retains the original saved additional total and all six cost rows. Incomplete, negative or inconsistent component data hides the chart with an explicit explanation; saved totals remain visible. Zero cost has zero shares. Gauge arc is clamped to 0–100% only for drawing; actual CMII text remains exact, including negative or over-100% values, with an explanatory note. Missing actual CMII is not drawn as zero.

EN/FR, light/dark and narrow layouts are supported. Review now uses the same full-width layout as Pricing, with its informational aside below rather than compressing the dashboard. Charts have text equivalents, decorative icons are hidden from assistive technology, and stale/loading/unavailable/error/retry/submitted states remain intact. No new Dataverse field, write, pricing formula or plugin change.

Validation: build/type-check and lint passed (existing Vite chunk-size warning remains). Four presentation unit tests and five documentation guard tests passed. Fifteen focused browser scenarios passed across runs, including the reference amounts, desktop four-card/two-panel geometry, 320px layout, French dark mode, correct non-overlapping cost composition, null/negative/over-100% CMII, stale values, save errors, retry, saved CAD/version isolation and mocked submitted locking. Screenshots were inspected at desktop/mobile sizes. These local tests use mocked services, not live financial acceptance.

Dev publication succeeded. After refreshing the Power Apps host's cached version, the runtime loaded matching entry asset `index-DkGDpMaF.js`. The existing real-source Dev draft was reopened read-only and the new summary rendered four cards, a reconciled composition, CMII gauge and two incentive values with saved CAD/version2026.7 and no alerts/overflow. Missing KONE price and actual CMII remained dashes; authoritative Recalculate was enabled. No Save, Submit, email, schema or assembly change was needed for this UI verification. Non-admin acceptance and other live contexts remain unverified.

Current real-data test changes: package catalogs and clone revalidation filter by branch currency as well as matching/global country. Currency is included in cache identity; incomplete context cannot issue a broad package query. No Save/Submit/customer or currency validation is removed. This is necessary for separately preserved USD/CAD records with the same Excel package number. Live sample/deployment evidence is tracked in [dataverse.md](dataverse.md).

Dev publication and admin browser verification (2026-11-05): production build/lint and 27 focused JavaScript contracts passed; the app push succeeded, and the running app loaded the matching `index-D6rakLHR.js` asset. A real source-linked draft was found by its generated request number, reopened and saved using the published Save button; the success status and independently advanced persisted version were verified. Three package customization disclosures retained their saved selections. The pricing screen displayed saved CAD costs, suggested price and version `2026.7`. Its enabled authoritative Recalculate button was clicked and completed with a saved status, refreshed calculation timestamp and no alert; it remains distinct from local preview. Full customer/currency checks remain enforced. The live sample uses one unit, not the synthetic five-unit 4/3/5 example. Final selling price/actual CMII remain blank because no selling price was selected. No Submit/email was attempted; non-admin acceptance and full master-import completion remain pending.

**Inspected:** 2026-11-04 local, including subsequent customer-master lookup source changes. This reference describes the checked-out application, **not a certified inventory of the currently published Power Apps build**.

Purpose: explain every functional control group, where it appears, what it does, what the frontend calculates, what comes from the server, and how to maintain this reference when app code changes.

| Label | Meaning |
|---|---|
| Source implemented | Behavior found in the checked-out code |
| Local validation | Tests/builds run locally; browser fixtures mock Dataverse |
| Server result | Value fetched from saved Dataverse/API response, not computed authoritatively by React |
| UI-only | In-memory display/input; not saved as an estimate field |
| Gated / missing | Depends on deployment/configuration, or requested feature not implemented |

The current change adds local Account/Contact lookup and persistence source behavior; it does not change pricing formulas or claim a published app/live record update. Related table/column/persistence details are in [dataverse.md](dataverse.md); deployment notes are in [README](../README.md).

## 2. Frontend structure and ownership

| Source | Responsibility |
|---|---|
| [main.tsx](../src/main.tsx) | React StrictMode entry, root styles, normal App or development-only material preview |
| [App.tsx](../src/App.tsx) | Shell/navigation, EN/FR copy, identity/access, market/branch context, draft state, dirty tracking, Save/Submit/load/clone, bulk equipment |
| [EstimatorWorkspace.tsx](../src/EstimatorWorkspace.tsx) | Five-step estimator journey, field placement, package previews, CSTM subflow, review |
| [LazyWorkspace.tsx](../src/LazyWorkspace.tsx) | Workspace loading boundary |
| [RequestFields.tsx](../src/RequestFields.tsx) | Shared request/cost/pricing/partner controls, live choices, numeric displays, payment split |
| [PricingSummary.tsx](../src/PricingSummary.tsx) | Saved pricing/CMII result loading, version matching, stale/unavailable/error states |
| [EstimateList.tsx](../src/EstimateList.tsx), [DashboardMetrics.tsx](../src/DashboardMetrics.tsx) | Request cards/filtering/paging and server-fed dashboard charts |
| [MasterDataWorkspace.tsx](../src/MasterDataWorkspace.tsx) | Read-only package catalog or admin master list/editor |
| [Settings.tsx](../src/Settings.tsx), [useUserPreferences.ts](../src/useUserPreferences.ts) | Language/theme and asynchronous user-preference persistence |
| [App.css](../src/App.css), [index.css](../src/index.css) | Layout, cards, focus/disabled states, responsive breakpoints, theme variables |
| [src/data](../src/data) | Query contracts, validation, browser preview arithmetic, formatting and transports |
| [generated SDK](../src/generated) | Dataverse service/model bindings; availability does not mean every service is used by a button |

App keeps one in-memory request workspace while switching views. Component-local state includes open dropdowns, active options, paging and loading/error results. API records are mapped back into App state after successful Save/load.

## 3. Shell and navigation: control inventory

| Location / control | What it does | Availability / data effect |
|---|---|---|
| Sidebar Dashboard | Switches to estimates dashboard | Reads metrics/recent estimates; no draft reset |
| Sidebar New Request | Opens/reopens current estimator workspace | Requires start permission; **not** the destructive New draft action |
| Sidebar Requests | Full request list | Reads/filter/paging; no Save |
| Sidebar Clone request | Opens private presets/clone workspace | Requires start permission; busy operations block it |
| Sidebar Packages | Package catalog | Read-only master workspace, not package selection into estimate |
| Sidebar Master Data | Admin master editor | Admin UI role only; Dataverse privileges remain authoritative |
| Sidebar Settings / header settings icon | Opens settings, remembers return view | Does not save/reset request |
| Header request search + Search submit | Sets request search and opens Requests | Preserves in-memory estimator; no discard prompt solely for search |
| Header market selector | Switches MKO/CKE/CKQ context | Can clear selections/reset request after applicable confirmation; fixed for saved workspace |
| Settings language control | Updates user language/locale preference | EN/FR labels; preference save can fail visibly |
| User avatar/role display | Shows signed-in initials/role | Display, not selectable demo identity |
| Dashboard Start new / explicit workspace New draft | Creates fresh in-memory draft ID and clears workspace | Confirms discard if dirty; does not create Dataverse header until Save |
| Session/reference Retry controls | Retry specific failed loader | No estimate mutation |
| Global saved-draft Reload | Loads current saved ID | Replaces unsaved state only after applicable discard confirmation |
| Preference Retry | Retries failed pending preference save or reload | Does not retry estimate Save |

Source: [App](../src/App.tsx). Busy flags for draft, bulk equipment, cloning and master writes prevent conflicting actions where wired. Never assume a disabled button has the same rule as another button.

### Dirty tracking and navigation

- Request dirty comparison serializes branch/province/title/building/customer/type/market, selected Account/Contact IDs, request inputs, equipment/packages/labor/material against the last saved snapshot.
- Account/Contact selection is included in the draft payload and saved snapshot; changing either selection marks a saved draft dirty.
- Browser-leave warning considers draft changes, preferences, master changes and in-flight operations.
- Ordinary sidebar navigation preserves the workspace. Destructive New draft, loading another draft, cloning over current state and context changes have separate confirmation rules.
- Cancel on discard must preserve original data and allow returning to New Request. This was locally fixed/tested; published build still needs verification.
- Leaving a dirty admin editor has its own master-data discard confirmation; master writes block leaving while busy.

## 4. Five-step estimator and shared buttons

The stepper shows **Opportunity -> Equipment & packages -> Costs & scope -> Pricing & margin -> Review**. Its items are focusable programmatically for announcing the current step, **not clickable navigation buttons**.

| Shared control | Behavior |
|---|---|
| Save draft at top | Validates full request and mounted HTML inputs, saves via draft API, requests server calculation; does not submit |
| New draft | Explicit confirmed reset; disabled while busy or without create permission |
| Reload draft | Available for saved request; reloads server state with dirty warning |
| Back | Previous step; at first step returns to dashboard |
| Continue / Next equipment | Advances locally, not a Save; gates differ from full draft completion |
| Complete CSTM / return to equipment | Validates CSTM lines and package preview, returns to step2 |
| Submit on Review | Validates/saves/submits through API after confirmation; locks editing when server confirms |
| Read-only submitted/export state | Inputs disabled through workspace/read-only surfaces; no ordinary draft edits |

First-step Continue checks branch, building text and equipment type, but does
not require Account/Contact selections or Contact email. This intentionally
allows local testing of later steps while customer imports/search are unavailable.
An EN/FR status message explains that customer selections are still required
before Save/Submit, and the button references that message accessibly.
Step1 navigation skips only customer-email HTML validity; other mounted input
validation remains. It is **less strict than full Save**: title/province/remaining
inputs are checked later. Step2 Continue still requires equipment and package
selections. Enabled Continue is not proof the request can be saved/submitted.

Full Save completion requires title, selected Account and Contact, Contact email, building, province, branch, equipment type, equipment, package, proposal language, time category, tax/freight text, currency/references and valid CSTM associations. Additional HTML controls enforce required/type/range/step constraints. Source: [App](../src/App.tsx), [workspace](../src/EstimatorWorkspace.tsx).

## 5. Step 1: Opportunity detail controls

| Field / control | UI purpose / origin | Save behavior |
|---|---|---|
| Opportunity Name | Manual request title | Header `re_estimatename` |
| Market | MKO/CKE/CKQ context | Saved header context; saved branch/market fixed |
| Branch search dropdown/toggle | Local name/number filtering of fetched market branches | Sets branch; clears equipment/packages/lines/customer when changed |
| Province/state | Branch-derived, disabled display | Saved province lookup; server country/French validation |
| Currency | Branch currency reference display | Server context; user does not manually enter FX here |
| Salesperson | Signed-in user or saved request salesperson | New request server assignment; not free text |
| Equipment type / Job type | Active reference dropdowns | Lookup IDs; job type can be empty |
| Functional Location Description | Manual text; renamed Building Name label | Same `re_buildingname` column; no authoritative building-master lookup |
| Account search | Searches active imported Accounts by number/name prefix, scoped to current market | `accountsearch`; selected GUID and displayed number/name enter draft and preset payload |
| Contact search | Searches active imported Contacts by name/email prefix under the selected Account; Contacts without email are excluded | `contactsearch`; Contact ID is saved, and name/email/phone are populated from Dataverse |
| Contact name / email / phone | Read-only selected Contact details | Save payload is server-validated against the selected Account/Contact; no manual override |
| Supervisor | Optional text | Saved request field |
| Work-centre request / technicians / approved | Live choice / numeric technician count max3 / live choice | Saved inputs |
| National account / Emergency / Customer budgeted | Live choices | Saved inputs |
| Paper / Consultant / Competing bids | Live choices | Saved inputs used by server rules where applicable |
| Stated labor billing rate | Optional negotiated selling-rate input | Not the branch mechanic cost rate; zero or more |
| Subcontractor cost | Labeled **captured only** | Saved input; do not imply it is included in authoritative cost totals |
| Proposal language | Live choice; French requirement can constrain it | Saved choice |
| Save Opportunity details action | Opens preset/reuse surface for current details | Preset save is separate from draft save |
| Loader Retry | References/branches/location-choice failure recovery | Only retries reads |

Branch defaults convert fractional `re_defaultusetax`/`re_defaultfreight` to UI percent by multiplying100. Time category defaults to regular choice. Province requiring French forces French proposal language. First addition of a CSTM package on a new request initializes shared tax5/freight10 once. This can override earlier branch rate defaults.

Account/Contact IDs and Contact details persist through the draft API; Account number/name are returned on load. The picker only exposes source-imported records; server validation checks that the Contact is active and belongs to the selected Account and that the Account matches the estimate market. Account and Contact search controls share a desktop row and stack on narrow mobile screens; read-only contact details remain aligned in their own row. Customer selection does not populate building/site information, which remains manual.

Reusable dropdown controls: [BranchSelect](../src/BranchSelect.tsx), [CustomerMasterSelect](../src/CustomerMasterSelect.tsx), [ChoiceSelect](../src/ChoiceSelect.tsx), [RequestFields](../src/RequestFields.tsx).

## 6. Step 2: equipment, packages and detailed cards

### Equipment controls

| Control | Behavior / limits |
|---|---|
| Equipment search input/toggle | Active branch server prefix search by number/name; max20 results; keyboard select |
| Result selection | Adds matched equipment once; captures display fields, server revalidates on Save |
| Manual/unlisted option | Adds unmatched number with available entered details; no master creation |
| Paste multiple equipment numbers | Comma/semicolon/whitespace split; detects lists without treating ordinary multiword names as lists |
| Bulk add / result feedback | Resolves exact numbers in batches of50; distinguishes added, not found, already selected and over budget |
| Download equipment template | Browser generates `.xlsx` with five standard headers |
| Import Excel | Reads file locally, validates, resolves master matches and adds workspace equipment |
| Selected equipment Remove | Removes workspace row, later reconciled on Save; linked custom rows may need removal |
| Equipment Retry | Repeats failed search/reference load |

Excel template headers: **Equipment Number, Equipment Name, Age, Location, Manufacturer**. Max5MiB; first worksheet only with no additional populated sheets. Identifier max20, age whole0..200, optional name/location/manufacturer max100. Formulas/dates/links/errors rejected; conflicting duplicate details rejected. Plain text preserves IDs; safe numeric values with zero format retain padding. This is not the business Equipment Master upload format and not a Dataverse master import.

Sources: [EquipmentSelect](../src/EquipmentSelect.tsx), [upload UI](../src/EquipmentExcelUpload.tsx), [Excel parser/template](../src/data/equipmentExcel.ts), [paste planner](../src/data/equipmentPaste.ts), [App bulk handlers](../src/App.tsx).

### Package controls and card placement

| Control / card | Behavior |
|---|---|
| Package search/toggle | Filters loaded catalog by package identity/localized fields; selects/unselects |
| More results | Expands displayed local matches; not a new estimate row or Save |
| Package Retry | Reloads catalog failure |
| Select standard package | Adds workspace package and preview |
| Select CSTM package | Adds package and automatically enters its custom-cost editor in step3 |
| Selected package Remove | Removes selection; custom rows are not silently discarded |
| Edit CSTM costs | Opens corresponding package editor |
| Selected package cost card | Shows equipment count, hours, rate, labor, material, rates and total preview |
| Package per-equipment details | Grouped **under each selected package**, one card per equipment, highlighted estimated cost plus formula breakdown |
| Previous / Next detailed-card paging |20 equipment per page; package summaries also page20 |

Per-equipment cards show the package's predefined one-unit cost, **not selling price**. CSTM labor/material and additional estimate costs are not allocated across equipment. All selected equipment receive the same predefined package unit preview for a given package/rate, not OEM-specific unit recalculation.

Contract equipment card was removed. Retained contract helpers/API do not mean an active frontend button exists.

Sources: [PackageSelect](../src/PackageSelect.tsx), [PackageCostDetails](../src/PackageCostDetails.tsx), [EquipmentPackageCosts](../src/EquipmentPackageCosts.tsx), [workspace](../src/EstimatorWorkspace.tsx).

## 7. Step 3: Costs & scope / CSTM controls

| Control | Purpose / behavior |
|---|---|
| Time category | Live choice for branch labor-rate preview/server input |
| Additional labor hours / material / miscellaneous | Estimate-level numeric additions, not multiplied per equipment |
| Use tax / Freight | UI percentage0..100; exact entered3 means3%, not0.03% |
| Additional scope | Saved multiline text |
| Add labor | New local row with ID, role/time/hours/package association |
| Labor role / time / hours / package | Role/time selects; positive hours <=100000, step0.01; CSTM package required |
| Remove labor | Local removal; server reconciles after Save |
| Add material | Local row; current route supports manual non-KONE and package-priced KONE references |
| Material package / pricing source | Associates CSTM; source determines editable unit-cost/catalog behavior |
| Part number / description / vendor | Required part max100, required description, optional vendor |
| Quantity | Whole1..100000; duplicate quantities do not mean extra equipment |
| Unit cost / unit price | Manual entered cost or server-provided catalog amount; unit price is read-only |
| Tax/freight applicability | Material flags where supported; authoritative effect is server-owned |
| Material read-only total | Browser sum of visible material unit costs × quantities, before tax/freight |
| Remove material | Local removal; does not delete spare-part master |
| Labor/material Previous / Next |10 rows per page; active CSTM filtering applies |
| Complete CSTM | Requires every selected CSTM to have valid labor and material; returns to package selection |
| Selected package costs / combined total | Browser previews; sums selected package preview totals |
| Branch rate / catalog Retry | Specific failed read retry, not a Save |

The current custom UI uses fieldset/card rows, **not the requested new grid-table redesign**. Additions count once per estimate. Removing CSTM with remaining custom rows/VK13 blocks Save until explicitly resolved.

### Catalog-specific controls retained for existing/catalog rows

Part classification KONE/Non-KONE, catalog search/toggle/results/Retry, selected catalog unit-price/UOM display, manual non-KONE conversion action and KONE markup input0..100 step0.01 exist in [MaterialPartSelect](../src/MaterialPartSelect.tsx). Catalog lookup depends on valid enabled server configuration. Switching to manual clears catalog snapshot hints as wired; Save revalidates server data.

Package-priced KONE reference has zero unit cost and no extra per-part markup: amounts come from package. Legacy/catalog KONE requires a selected catalog part and markup. These paths are not interchangeable.

Source: [CustomCostLines](../src/CustomCostLines.tsx), [MaterialPartSelect](../src/MaterialPartSelect.tsx), [request validation](../src/data/requestValidation.ts).

## 8. Step 4: Pricing & margin

| Control / value | Origin / behavior |
|---|---|
| Entered selling price | User proposal price, saved input; not automatically copied from suggested price |
| KONE spares sales price VK13 | Custom-estimate input; constrained by CSTM selection |
| Billing plan | Live choice; local payment split display |
| Margin comments | User justification; server requires for below-target submit |
| Calculate / Recalculate | Calls **Save draft**, then reads matching saved pricing; does not submit |
| Calculate help / disabled state | Full request required; busy label/status; submitted summary hides action |
| Save/validation failure alert | Inline next to summary in current local change |
| Saved-price Retry | Requeries saved-price read; does not recalculate/save |
| Stale notice | Dirty saved request: displayed server results are not current inputs |
| Unknown currency/unavailable/no saved calculation | Explicit state; do not manufacture zero/success |
| Cost / suggested price / margins / incentives | Saved Dataverse outputs, formatted locally |

Summary includes total true cost, entered/suggested selling price, optional suggested price with KONE material, package/custom/additional cost breakdown, base/recommended/actual CMII, variance and AM/BD incentives. A below-cost selling price displays warning. Reporting timestamp and calculation version explain result provenance.

Source: [PricingSummary](../src/PricingSummary.tsx), [pricing repository](../src/data/pricingRepository.ts), [pricing contract](../src/data/pricingContract.ts).

## 9. Step 5: Review and submission

- Read-only current Opportunity/partner/equipment/package/request/cost/pricing summaries; expandable detail sections are display toggles, not save operations.
- Saved-price summary remains separate from unsaved input summaries. Unsaved badge must not be interpreted as server verification.
- Account UI previews are not part of persisted Review/export contract.
- Submit requires positive selling price, complete request, valid CSTM and mounted control validity; confirmation warns about locking.
- Server decides acceptance and required billing/margin rules. Frontend checks server status/export response, not just transport success.
- Submitted estimate opens Review; queued export is Draft but edit-locked. Export delivery status is shown and periodically refreshed from server.
- In current source pending delivery polling schedules5-second refreshes, up to60 pending attempts. It does not continuously monitor forever.
- Legacy Submit sends no email. Enabled automation can queue workbook/email delivery; current verified switch was disabled in the preceding Dataverse audit. Do not change held activation based on this document.

Source: [App](../src/App.tsx), [submission display](../src/data/submissionDelivery.ts), [workspace Review](../src/EstimatorWorkspace.tsx).

## 10. Other pages and controls

### Dashboard / Requests

- Refresh metrics re-fetches dashboard data; scoped to selected market and owner/access.
- Cards show total estimates(all statuses), Draft, Submitted and average actual CMII.
- Status donut uses Draft+Submitted only, excluding Pending. Job-type bars use total record count.
- Request list status filter, search and refresh reset/reload relevant pages.
- Open draft versus View locked/submitted record loads server request; Clone opens section-selection dialog.
- Previous/Next uses server page tokens; dashboard recent list and full list are different surfaces.
- Empty/error/loading are explicit. Counts and average are API data, not arbitrary React sample data.

### Clone request / Opportunity presets

- Preset list Retry/refresh, Use saved details, Delete with confirmation.
- Current Opportunity preset name(max100) and Save details; separate from estimate Save.
- Find existing request opens Requests.
- Clone dialog section checkboxes choose reusable sections; Cancel closes; Open new copy disabled if no section chosen or busy.
- Clone validates current references and creates new unsaved workspace; existing source is unchanged.

### Packages / Master Data

- Packages is read-only catalog with search/status/paging/Details/Back/refresh.
- Admin Master Data has approved table selector, search, active/inactive filter, New record, Edit, field inputs, lookup search/select/Clear, Save, activate/deactivate and paging.
- Dynamic field types/ranges/required flags come from approved projection merged with live metadata.
- Save only when dirty. Activation disabled while dirty. Failed/uncertain write state requires reload before blindly repeating.
- No generic hard-delete button or tenant security-role editor.

### Settings

- Language EN/FR updates locale preference; theme System/Light/Dark follows OS when System.
- Return to workspace returns to remembered view.
- Preference busy/error/Retry states are in shell. Preferences persist through Dataverse, request fields do not autosave with them.

Sources: [list](../src/EstimateList.tsx), [metrics](../src/DashboardMetrics.tsx), [clone dialog](../src/CloneRequestDialog.tsx), [clone workspace](../src/CloneRequestWorkspace.tsx), [master editor](../src/MasterDataWorkspace.tsx), [settings](../src/Settings.tsx).

## 11. Frontend calculation dictionary: exact formulas and origin

### A. Predefined package preview (`packageCosts.ts`)

Inputs: `H` mechanic hours per unit, `N` package-assigned equipment count (all selected by default), `R` unique active branch mechanic cost rate for selected time, `M` material amount per unit, `T` tax UI percent, `F` freight UI percent.

```text
total hours = H × N
labor = H × N × R
material = M × N
tax amount = material × T / 100
freight amount = material × F / 100
estimated cost = labor + material × (1 + T/100 + F/100)
```

Standard package preview applies **tax5/freight14** regardless of entered custom rates. CSTM uses entered rates, except package-priced KONE predefined material uses material-before-markup with zero extra tax/freight. Invalid/missing/ambiguous rate, invalid percent or non-finite input throws and displays unavailable; no silent zero fallback.

Per-equipment cards call the same unit helper with `N=1`. UI rounds for presentation to two decimals, not authoritative currency accounting. Source: [package costs](../src/data/packageCosts.ts).

### B. CSTM package preview

```text
custom labor = sum(line hours × (saved line rate or unique branch role/time rate))
custom material = sum(line quantity × line unit cost)
hours = predefined hours + sum(custom line hours)
labor = predefined labor + custom labor
material = predefined material + custom material
preview total = predefined total + custom labor
              + custom material × (1 + entered T/100 + entered F/100)
combined package preview = sum(selected package preview totals)
```

Custom lines are added once, not multiplied by equipment count. Package-priced references contribute zero unit-cost subtotal, while package material amount scales by package-assigned equipment count; separate `koneFinal` preview is final package material amount×package-assigned equipment count.

### Package equipment customization and local cost preview

- Each selected package has an EN/FR **Customize equipment** disclosure with actual equipment-number checkboxes and assigned/total count. Default/all mode includes subsequently added units. Explicit subsets exclude subsequently added units. Removing a unit prunes explicit subsets; readding it does not silently reassign it. All equipment resets the package to default mode.
- An empty assignment disables step-2 Continue, full Save and authoritative Calculate/Submit, with an explicit error. Per-unit cards show only assigned units; every aggregate package view and CSTM completion uses that package's count. Custom labor/material entries and estimate-level additions retain their existing once-only semantics.
- Pricing and Review have a separate **Calculate cost preview** action. It uses fetched branch cost rates, package snapshots, actual subsets, CSTM entries and entered additional labor/material/miscellaneous, including applicable tax/freight. It does not require Account/Contact and never saves or requests Dataverse pricing. Missing/ambiguous rates, currency or invalid costs show errors instead of invented amounts.
- Local preview is visibly **not saved**, not selling price, CMII or an approved quote. Input/rate/currency/equipment changes hide stale amounts until recalculated. Official Calculate still saves a valid customer-linked draft; Save/Submit validation is unchanged apart from assignment validation.
- Assignments participate in existing dirty tracking, load/save and clone. Copying packages without equipment resets their assignments; copying both preserves subsets and revalidates master snapshots.
- Save verifies that the response preserves package subsets. An outdated server dropping them shows a deployment error, preserves on-screen selections and does not show a success notice; saved pricing is explicitly identified as not matching those selections.
- Deployment: published in Dev on 2026-11-05 after the assignment column and both signed assemblies. The running asset, real draft reopen/Save, persisted subset and authoritative Recalculate were verified; see section 1. This is admin sample acceptance, not full-production certification.
- Local validation: 12 focused Playwright cases passed (EN/FR 4/3/5 selection and exact 2,628.00 synthetic cost, empty-subset gating, removal/readdition, no customer/no writes, stale preview, default card paging/rate errors, CSTM additions counted once, save roundtrip and outdated-server rejection). Build/type-check and lint passed, with the existing Vite large-chunk warning. These mocked cases remain distinct from the smaller live sample.

**Important known limitation:** this browser preview aggregates custom unit costs uniformly with shared rates and does not fully reproduce server catalog unit-price/markup/applicability logic. It can show cost-basis package-priced preview separately from final KONE amount. Treat it as an explanatory preview, not the definitive CMII/cost/quote.

[PackageCostDetails](../src/PackageCostDetails.tsx) initially computes zero-rate CSTM cost to show base details even before valid tax/freight; total calls actual-rate helper and can be unavailable. [EquipmentPackageCosts](../src/EquipmentPackageCosts.tsx) does not allocate custom lines between equipment.

### C. Read-only material sum

`sum(unitCost × whole-number quantity)` for visible/active-package rows; no tax/freight. [customMaterialCosts](../src/data/customMaterialCosts.ts) requires part/description/positive finite unit cost. It intentionally refuses package-priced references because their cost is package-owned. Display can say unavailable even when a valid saved package-priced path exists.

### D. Billing payments

Choice values:126110000 ->50% down,126110001 ->60%,126110002 ->0%;126110003 Custom shows notes, not guessed amounts.

```text
total cents = round(selling price rounded to 2 decimals × 100)
down cents = round(total cents × down percent / 100)
final cents = total cents - down cents
display amounts = cents / 100
```

Invalid/nonnegative-range/safe-integer checks prevent incorrect amounts. Final payment is the remainder so rounded payments sum to rounded selling price. Payment amounts are **UI-derived**, not separately saved columns. Source: [billing helper](../src/data/billingPayments.ts).

### E. Dashboard charts / formatting

Server supplies counts/average; frontend derives donut share `count/(Draft+Submitted)×100`, cumulative segment offsets and job-type percentage `job count/total×100`. It sorts bars descending. Empty denominator handled in display. CMII averages are not recomputed from only visible request cards.

Money/percent use locale EN `en-US` or FR `fr-CA` per component. Saved CMII0.25 formats25%, while tax input25 already means25%. Decimal input formatting is display only. Timestamp formatting uses [reportingTime](../src/data/reportingTime.ts); number display uses [numberDisplay](../src/data/numberDisplay.ts).

### F. Authoritative Pricing / CMII is NOT a frontend formula

`getSavedPricing(id, version)` reads header results. Parser validates version, finite/core result shape. React displays saved cost, suggested price, CMII, variance and incentives. It does not independently calculate target margins, rule bands, approval or incentives. Calculate is a saving API operation. Backend Drafts can successfully save with cleared pricing and version `unavailable`; frontend must explain that.

### G. Development-only material preview

`?materialPreview=1` in **DEV only** selects isolated [MaterialCatalogPreview](../src/dev/MaterialCatalogPreview.tsx) with fixture data, not normal Power Apps workflow.

[partMaterials](../src/data/partMaterials.ts) preview calculates CAD unit cost as USD cost×FX×cost factor, but unit price as USD price×FX/pricing unit; its KONE contribution uses unit price, quantity, configured tax/freight/markup. The current server source applies approved uplift to CAD catalog price too. **This helper is not authoritative and not used by normal PricingSummary.** Do not present dev fixtures as customer/live results.

## 12. Errors, permissions, accessibility and responsive UX

- Identity requires linked Power Apps/Dataverse user; role and estimate read/create privileges gate screens. Development admin override is not a production permission mechanism.
- References/queries can fail from permissions, timeout, inactive/missing schema or ambiguity; explicit loader error/Retry is not a successful empty list.
- Save guards against overlapping operations; checks serializer budget and server response. Missing unmatched equipment detail preservation raises an explicit warning while retaining on-screen input.
- Invalid mounted control reports labeled browser validation message; some earlier wizard gates only check presence. Server validation is final.
- Dropdowns use combobox/listbox state, arrow navigation, Enter selection, Escape/blur close where implemented; do not assume a complete formal accessibility audit.
- Current-step focus, labeled fields, role=status/alert, aria-busy, descriptive Remove labels and disabled/read-only states are used.
- Responsive CSS includes desktop/tablet/mobile/short-height rules at1250/1100/1050/1000/820/640/430px and height thresholds. These are component-specific, not one universal layout breakpoint.
- Card/form layout, highlighted per-equipment amounts and paging avoid rendering all rows at once. Style-only changes still require this document.
- English/French copy is spread across App/components/helpers. Update both languages when UI behavior or error semantics change.

## 13. Expected versus actual / UX gaps

| ID | Expected | Current source / evidence | Follow-up |
|---|---|---|---|
| APP-01 | Cancel discard returns original workspace | Locally fixed navigation preserves in-memory request | Verify published build, retain EN/FR/mobile regression |
| APP-02 | Calculate shows values or actionable failure | Local inline feedback added; server unavailable state can still occur | Diagnose live backend cause; do not claim formula fixed |
| APP-03 | Account/Contact selection persists after save/reload | Local frontend/plugin source sends, validates and returns lookup references. The four additive metadata/estimate lookup schema components are now deployed and read-only rechecked in Dev. No master rows, updated plugin assembly or app bundle are deployed; the earlier 14 Account / 10 Contact eligibility counts are historical and have not been refreshed | Resolve source rejects and destination collisions, establish safe resumable import, then deploy API/app and verify non-admin save/load in Dev |
| APP-04 | Five equipment filter approaches | Number/name only; no account number/name/sold-to equipment filter | Business feature not implemented |
| APP-05 | New material/labor grid and removed classification/markup | Current fieldset/card UI and legacy/catalog controls remain | Separate approved redesign/calculation migration |
| APP-06 | Branch/account/site autofill reduces manual input | Account/Contact master search is wired in source; site/building remains manual and bulk master import is not verified | Do not infer installation location from customer billing data; complete import and deployment gates |
| APP-07 | Preview equals final pricing | Browser preview omits full server semantics; dev helper price conversion differs | Label previews; use saved versioned results for decisions |
| APP-08 | All length-valid UI inputs save | Backend/UI limits can exceed live name/phone/comment/location limits | Confirmed Dataverse mismatch; see DV-01/DV-02 |
| APP-09 | Continue means request fully valid | Wizard gates less strict than Save/HTML/server checks | Keep validation expectations explicit |
| APP-10 | All displayed text reflects new pricing sources | Some CSTM catalog/help and legacy no-email notes can be context-dependent | Review copy during next approved UI/export change |
| APP-11 | Documentation automatically reflects published UI | Source snapshot and CI presence guard only | Deployment verification/manual change log still required |

## 14. Validation and same-change maintenance

### Existing local evidence

Customer-master implementation local evidence is tracked in the current change log below. Browser tests use mocked data and do not prove tenant behavior. This document is source-derived, not a full acceptance test of the shared published browser.

Relevant focused test families: [tests](../tests) package-costs/custom-material/billing/payments/validation/Excel/clone/query contracts, [responsive browser suite](../e2e/responsive.spec.mjs).

```powershell
node --test .\tests\dataverse-documentation.test.mjs
npm run test:unit
npm run build
npm run lint
npx playwright test -g "affected behavior" --reporter=line --workers=1
```

### Maintenance rule for every contributor

1. Read this file before changing frontend controls/state/calculations.
2. Update affected control inventory, formula/origin, validation/error/locking behavior, localization and persistence boundary in the **same change**.
3. Record tests and source/local/live status; keep unresolved IDs until verified.
4. If data/API/backend mapping changes too, also update [dataverse.md](dataverse.md).
   Backend/plugin changes additionally require [plugin.md](plugin.md); use it for authoritative formulas and registration rather than browser preview equations.
5. [Shared instructions](../.github/copilot-instructions.md) guide agents; [existing documentation guard](../automation/check-dataverse-doc.cjs) now checks both references.
6. App watch scope: all `src`(including CSS/generated/dev), public assets, e2e/tests, `.power`, package/lock manifests, entry HTML, Vite/TS/Playwright configs and guard/workflow/instructions. Broad scope is intentional; write "no behavior/persistence impact" with evidence when applicable.
7. [Workflow](../.github/workflows/dataverse-documentation.yml) runs on PRs/main pushes. The repository admin must require **Dataverse documentation / documentation** in branch protection to block merging a failed check. No GitHub setting was changed here.
8. Guard checks changed-document presence and rejects empty/deleted references; it cannot verify completeness or truth. Cosmetic edits alone are insufficient human-review evidence.
9. Published app changes outside Git are not monitored. Manual deployment entry is required; no automatic real-time rewriting is installed.
10. No credentials, personal/customer records or sensitive payloads in audit documents.

### Change log

| Change | UI / calculation / persistence impact | Evidence / deployment |
|---|---|---|
| Existing navigation fix | Sidebar New Request returns existing workspace; explicit New draft still resets | Local browser regressions passed; published identity unverified |
| Existing pricing feedback | Inline Save/HTML error and calculating states; no pricing formula change | Focused local tests passed; exact user's live pricing cause unresolved |
| Existing account inputs | Opportunity Account number/name preview; no API/persistence mapping | EN/FR regressions passed; UI-only by request |
| Customer master selection, current local source | Market-scoped Account search and Account-scoped Contact search; desktop pickers share a row and stack on phones; selected lookup IDs persist in draft and preset payloads; Contact details are read-only and server-derived | `npm run build`, `npm run lint`, `npm run test:unit`, and the three targeted Account/Contact Playwright regressions passed. Two metadata columns and both estimate lookup relationships are deployed and read-only rechecked in Dev; no plugin/API deployment, master-row import or app publication performed. Exact live values and runtime remain unverified |
| This reference,2026-11-04 | Added control/formula/source/gap inventory; extended same-change guard to app.md | Four guard tests passed, including real Git diff failure/success and empty/deleted documents;64 app links resolve; YAML/script syntax validated. No frontend/backend formula or live data changed |
| Plugin reference integration,2026-11-04 | Shared guard now checks plugin project changes separately; app requirement unchanged | Five guard tests passed; no UI/runtime behavior changed |
| Full-import presentation preflight,2026-11-05 | No frontend behavior or publication change; Option 1 remains a requested target, not live implementation | Read-only Dev/source audit found existing master data, 180,962 Equipment rows without Account lookups, unresolved employee/planner/site mappings and a missing referenced company/branch crosswalk. See [Dataverse readiness check](dataverse.md). No import, autofill implementation or published-app acceptance claim |
| Customer bulk pilots and runtime check,2026-11-05 | No UI controls, formulas, localization or frontend wiring changed by the importer; customer masters feed the already implemented local Account/Contact lookup source | Direct 10/500/1,000-Account batches passed exact read-back, yielding 1,511 verified Account source rows before the full Account/Contact run started. Full import and Contact live verification are not yet complete. Published `accountsearch` probe failed HTTP400/code `0x80040265`; deployed Drafts/pricing DLL hashes differ from local builds. No app/assembly publication. 33 importer and 5 documentation tests passed; these do not prove the live UI works. Sign-in organisation/currency/salesperson, organisation-filtered branch, planner/site and branch-to-Account/Equipment Option 1 autofill remains blocked pending authoritative mappings and coordinated rollout |
| Manual-completion target and import recovery,2026-11-05 | User approved autofetch plus editable missing values for all form/master fields, including explicit branch/organisation mappings; updates of existing shared values require confirmation | Requirement only, not implemented or published. Current customer fields remain read-only/imported-selection gated; do not claim the requested fallback works. Import reached 7,511 verified Accounts, then read-back failed HTTP401; renewing authentication verified the next 1,000 with zero additional writes (8,511 total). 35 importer tests passed, including read-only token recovery. Invalid source rows remain quarantined rather than guessed; source metadata must stay unchanged by future manual master edits |
| Import checklist and remaining Equipment preflight,2026-11-05 | No UI/data-wiring change; checklist is an external sanitized progress deliverable, not a new app control | Checklist updates after verified customer batches; 24,511 Accounts checkpointed at the live hook pilot, Contacts pending. All 60 Equipment source headers accounted for in read-only metadata preflight: 46 require typed validation, 5 raw preservation, 2 missing columns, 7 mappings to absent location/planner tables. No Equipment writes or app publication. 41 Python tests passed; full-source imports and approved editable writeback remain unfinished |
| Equipment staging and customer timeout recovery,2026-11-05 | No frontend control, formatting, validation or autofetch behavior changed | Full-source Equipment staging and bounded existing-record update source added; raw preservation does not make planner/site data available in the UI. New Equipment without an authoritative branch is deferred; existing branch/location preserved. Customer timeout reconciled 1,000 exact rows with zero writes, giving 31,511 verified Accounts; Contacts pending. Equipment preparation/schema/import outcomes must be recorded after execution, not inferred from implementation. Published app/manual master-writeback still outstanding |
| Equipment live preparation/schema/update evidence,2026-11-05 | No UI change or app publication; source metadata is not a new frontend data source | All428,400 Equipment source rows staged;320,030 passed and108,370 quarantined (numeric precision108,366; duplicate key4). Optional Equipment export-metadata Memo100000 and KOL String100 published and independently verified. Three existing-record batches verified45+50+25=120 rows with GUID/branch/location retained;45-row repeat read passed with zero writes.319,730 pending,168 missing-context and12 unverified-parent deferrals remain.53 Python tests passed. No claim that missing UI values, all Equipment, pricing/employees or manual writeback are now complete |
| Accelerated customer verification,2026-11-05 | No app control/data-wiring or publication change | Four bounded parallel read-only verification requests return the same source-mapped values; serial writes, identity/source guards and full read-back remain. Live500-Account read comparison8.67s versus3.54s is not a full-import ETA. Accelerated1,000-row pilot checkpointed38,511 total Accounts; Contacts pending.57 Python tests passed. Editable master fallback and updated lookup app/API publication remain unfinished |
| Further verified import batches,2026-11-05 | No frontend publication or UI change | Account report reached41,511 verified; ten further Equipment batches added354 verified existing rows (474 total), with branch/location/GUID retained and782 context/44 parent deferrals,318,730 pending and108,370 quarantines.58 Python tests passed. Contacts have no verified rows yet and are queued; checklist renderer now labels that explicitly when reloaded. All-data completion and published autofetch/edit/writeback remain unverified |
| Customer-independent local navigation,2026-11-05 | User approved Continue without Account/Contact while retaining Save/Submit requirements; branch/building/equipment type and step2 equipment/package gates unchanged | Five focused EN/FR Playwright tests passed, including reaching Review with blank customer email, retained inputs on Back, no draft writes, disabled Save/Submit and existing Account/Contact selection/read-only behavior. TypeScript/Vite build passed with existing chunk-size warning. Tests mock Dataverse; source change not published and no live-app acceptance claim. Importer contracts/master records unchanged; saved server pricing still requires a valid save |