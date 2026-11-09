# Repair Estimator - frontend UI, controls and calculation reference

## 1. Scope and evidence

### Teammate integration (2026-11-09, local merge)

The latest `feature/optimize-equipment-pricing` changes are integrated with the local source-exact Account-number import/repair and single/multiple/missing-location controls. Both change histories and documentation are retained. The combined UI keeps free-text Opportunity Name, click-time mandatory errors, linked-Contact fallback and responsive Change Contact spacing; it also includes equipment/customer-default/saved-pricing read reuse, explicit Retry/invalidation, privacy-safe timings, Billing Plan required indication and repeated-error/dropdown focus fixes. A single or incomplete sole location still uses an input, multiple pairs use a dropdown and missing names permit free text.

Integration evidence: production build/type-check, full lint, all 162 frontend unit tests and all 100 Python automation tests passed. Across the focused browser run and isolated recheck, all 102 distinct mocked browser cases passed, including 34 required-field variants and two new EN/FR regressions combining cached defaults with incomplete-single/multiple/missing locations and manual Contacts. One existing pricing regression was updated to assert cached navigation followed by explicit Reload version-mismatch detection and Retry recovery; the old expectation of a new read on every step return no longer matches the intended caching contract. The initial browser run also hit a local dev-server connection-refused failure loading the workspace; that case passed the single-worker recheck without a production-code change. Build retains the existing large ExcelJS chunk warning.

This merge is local only: no GitHub push, frontend/plugin deployment, tenant reads/writes or new production verification is part of the integration. Mocked cases do not certify live latency, user permissions or published behavior. Earlier tenant correction and deployment evidence below remains separately scoped.

### Exact Account numbers and location control selection (2026-11-09, local source)

Location Description now uses an input for one available source value or missing data, and a dropdown only for multiple verified number/name pairs. A complete sole value autofills a blank input; an incomplete response retains warnings and requires explicit use of the linked value rather than guessing a sole default. Missing data permits a free-text description (existing 300-character limit). Multiple choices retain SAP pair identity, custom-entry support and saved/manual text preservation. No account-number padding is performed in the frontend.

The Account/Contact Excel readers now preserve source-defined leading zeros in numeric AccountNumber / Account.AccountNumber cells using explicit all-zero Excel number formats. Text is preserved exactly; General-format numbers are not arbitrarily padded. Ambiguous formats, formulas and unsafe numeric precision are rejected. This fixes a reproduced synthetic reader defect, not proof that every reported tenant mismatch came from number formatting.

Local evidence: 100 Python automation tests and 10 focused mocked EN/FR browser cases passed; frontend build/type-check, changed-source lint and Pylance syntax checks passed. The user subsequently chose the Equipment export's Account.AccountNumber matched by Account.Id as the correction authority. A complete source scan found 428,400 Equipment rows, 101,841 Account IDs and no conflicting numbers per ID. Read-only comparison scanned 441,206 tenant Accounts: 64,447 covered Accounts were already exact, 36,215 had missing source-confirmed leading zeros, and 1,179 source Accounts were absent. All 36,215 approved number corrections were applied with identity/ETag guards and individual readback. A subsequent independent full source/tenant audit found 100,662 covered Accounts exactly matching and zero remaining eligible corrections. Accounts outside source coverage were not inferred or padded. Location UI remains local source only, not published. No source-file edits, app/plugin publication or production UI verification occurred; tenant data correction is distinct from app deployment.

### Equipment-cache invalidation and overlapping failures (local source only)

The equipment cache key now resets before checking for an empty selection.
Changing Branch A to B and back to A without selecting units in B therefore
requires fresh details in A. The active detail load retains selected cached
promises before awaiting new batches, plus all newly requested promises;
evicting a failed cached request cannot turn that failure into partial success.
The existing visible error and Retry action remain available.

Five mocked browser tests passed for Branch round-trip invalidation, an older
unit failing while a newer unit loads, retry recovery, incremental/reselection
reuse, Save/Reload refresh and batches exceeding 50 units. Build/type-check,
changed-source lint and diff checks passed. Sequential batches, obsolete-effect
guards and backend behavior are unchanged. No publication or tenant writes;
local mocks do not certify deployed behavior.

### Responsive Change Contact spacing (local source only)

The selected Contact email/phone and Change Contact button use a wrapping row
with a 16px horizontal and 8px vertical gap. The button follows the actual text
width when both fit and moves below when space is insufficient. Long contact
text wraps within the available width; the button retains its touch target.
English/French labels and contact-change behavior remain unchanged. No
publication or tenant changes are included. Six mocked browser tests passed at
320/768/1366px in English/French for short/long text, minimum gaps, no page
overflow, 44px-or-larger targets and unchanged contact switching. Build/
type-check, changed-source lint and diff checks passed.

### Performance timings and Account/location reuse (local source only)

**What changed**

- Returning to the customer step reuses the current Account/Branch/market
  defaults, including an in-flight request. This avoids repeating the backend
  equipment scan and source-location metadata parsing for the same context.
- Save/Calculate/Reload, changed Account/Branch/market and Retry fetch fresh
  defaults. Clearing Account/Branch or closing the workspace discards the cache.
  Only one defaults response is retained, in component memory. Failures are
  evicted; existing visible errors, retry and stale-response guards remain.
- Browser User Timing entries cover session startup, Account/Contact search,
  customer defaults, equipment search/details, saved pricing and draft
  Save/Submit/Load/clone-source operations. Calculate uses the existing Save
  operation, so its backend duration appears as `draft-save`.

**How to measure**

In browser developer tools, clear the `repair-estimator:` measures before a
representative workflow, then inspect them in the Performance panel or console:

```js
performance.getEntriesByType('measure')
  .filter(entry => entry.name.startsWith('repair-estimator:'))
  .forEach(entry => performance.clearMeasures(entry.name))
// Perform the workflow, then inspect only data-free metrics:
console.table(performance.getEntriesByType('measure')
  .filter(entry => entry.name.startsWith('repair-estimator:'))
  .map(entry => ({
    operation: entry.name, milliseconds: entry.duration,
    outcome: entry.detail.outcome
  })))
```

Entries contain static operation names, durations and completed/failed outcomes
only: no IDs, query text, customer/equipment data, pricing, payloads or error
messages. Nothing is transmitted or persisted. Retention resets per operation
after 100 recorded entries; counts are not lifetime totals. Nested
`power-apps-request` entries count timed SDK/context promises, not raw HTTP
requests; a fulfilled SDK error envelope is completed at that layer but failed
at the validated operation layer. Use the browser Network panel for actual HTTP
counts/throttling. Session startup measures identity/access loading, not total
page paint or dashboard readiness. Operation durations exclude debounce and UI
validation; existing SDK timeouts do not cancel underlying requests.

**Evidence and limits**

Local mocked checks verify one initial defaults request, zero additional
requests on repeated step returns, and one fresh request each after Save and
Reload, in English desktop/French mobile. In-flight sharing, failed-refresh
Retry, Account isolation, ambiguous/truncated defaults and manual edits during
pending reads remain covered. Real repository adapters with mocked services
verify timing entries, SDK-call counts, scoped/escaped equipment queries and
unchanged explicit errors. Unit checks cover bounded retention, data exclusion
and preserved timeout/error behavior.

Validation: 17 focused mocked browser cases, all 162 unit tests, production
build/type-check, changed-source lint and diff checks passed.

No backend query, scan/result limit, source parser, authorization, formula or
snapshot changed. Existing 2,000-row/20-location limits and source-data gaps
remain; this does not make the first location scan cheaper. Account-search
queries remain unchanged. Local evidence is not a live latency benchmark or
permissions certification. No tenant reads/writes or app/plugin deployment
were performed for this change.

### Billing Plan required marker (local source only)

Billing Plan now displays the existing red required star in English and French,
and its choice control exposes `aria-required`. It remains required only for
Submit; saving/calculating a draft without a Billing Plan remains allowed.
This corrects the missing visual indicator, not the validation rule.
Validation and deployment evidence is recorded after local checks; no
publication or tenant writes are part of this change.

### Equipment and saved-pricing read reuse (local source only)

**What changed**

- Equipment details are reused within the open estimator workspace. Adding a
  matched unit reads only missing numbers; removing/reselecting a cached unit
  does not reread it. In-flight requests are shared. Missing batches remain
  sequential, with at most 50 numbers per request. Obsolete effects cannot
  update the UI or issue subsequent batches after their current batch finishes.
- Pricing and Review share one saved-pricing request for the current estimate
  ID, saved version and draft-read revision. Changing steps no longer rereads
  the same saved results.

**Refresh and limits**

Equipment cache resets on Branch change, Retry or application of a saved/
reloaded draft. Saved-pricing cache refreshes after Save/Calculate/Reload and
explicit Retry. Failed requests are evicted and errors remain visible. Both
caches live only in component memory and disappear when the workspace closes
or a different estimate opens. Unsaved inputs still mark saved pricing stale;
this does not introduce browser-side pricing or change saved snapshots.

Bulk equipment matching and richer detail loading remain separate reads for
new units. No timed expiry, parallel batch loading, account-search optimization
or backend calculation changes are included.

**Evidence and deployment**

26 targeted mocked browser cases passed, including incremental detail reads,
removal/reselection, Save/Reload invalidation, equipment/pricing Retry, failed
pricing navigation recovery, in-flight pricing sharing, Save/Submit and stale
update regressions, bulk lists exceeding 50 numbers and English/French
equipment/pricing display at mobile/desktop widths. Request-count checks show
one added unit reads only that unit, reselection adds zero reads and Pricing/
Review navigation retains one saved-pricing read. Local build/type-check,
changed-source lint and 24 related unit/documentation tests passed.
No published-app latency measurements, tenant writes, schema/plugin
changes or publication were performed; these mocks do not certify live speed,
permissions or production behavior.

### Linked-location and repeated-error focus corrections (2026-11-09, source only)

Required-field focus resolves enabled input/select/textarea controls by their
ID or exact error token in `aria-describedby`. Multiple linked locations use
the location dropdown, not the absent manual-input ID; loading/disabled controls
retain the focusable-error fallback and do not steal focus after user navigation.
Each accepted Save/Calculate/Submit attempt advances a UI-only counter so an
identical synchronous error on the same step focuses the operation banner again.
Required-field checks and all persistence/submission rules remain unchanged.

Eight focused mocked browser cases passed, covering English desktop/French
mobile dropdown focus on repeated Save and Next, repeated stated-rate failures,
correction/save and existing hidden-step/Billing Plan/server-error regressions.
All 34 required-field-category browser cases passed again; build/type-check,
changed-source lint and 10 validation/documentation unit tests passed.
These close variants not covered by the earlier 34-field-category checks.
No Dataverse data/schema/plugin changes or frontend publication were performed;
published-client/non-admin behavior is not verified by these local tests.

### Submission validation focus and errors (2026-11-09, local source)

Submit still requires a positive selling price and Billing Plan; no submission
or pricing rule changed. Failed required-field validation now focuses the first
invalid control after changing steps instead of subsequently focusing the step
header. If a choice is still loading, its error receives focus until the control
becomes available; user-initiated focus changes are respected. Missing Billing
Plan has a specific English/French instruction. Save and Submit operation errors
appear and receive focus beside the workspace footer, including on mobile; submit
server details are not prefixed by an unrelated deployment/permission diagnosis.
The existing reload action and server error details remain available.

Required-field coverage was then checked individually with 34 mocked browser
cases: all 17 prerequisites in English desktop and French mobile. These cover
Opportunity Name, Branch, Account, Contact name/email, location description,
equipment type, province, currency, proposal language, equipment, packages,
time category, CSTM tax/freight, selling price and Billing Plan. Each case
verifies visible error text, invalid-control/error association, focus and no
Save/Submit API call. Disabled saved-Branch/province controls focus their error
instead. This does not certify field-level highlighting for conditional
server-only business rules; those continue to use the focused operation error.

Read-only inspection of the reported CKE draft confirmed that its saved Billing
Plan is blank and its selling price is positive. It remains a draft; unsaved
browser inputs, the exact published client bundle and any later server-side
blockers were not verified. Local mocked browser tests cover required focus,
English/French, submission confirmation/success and a server rejection. Build
and lint were run locally. This change is source-only, not published or verified
in the tenant; no business record, plug-in or schema was changed.

### Freestyle names, unobscured locations and click-time validation (2026-11-09, local source)

Opportunity Name is now an initially empty, free-text 100-character field. Clearing it stays empty rather than regenerating a `Repair - ...` title; Account changes do not replace entered names. New drafts, clones and preset-created requests require their own name, while reopening retains the saved name.

When a complete defaults response has no eligible Contacts, Contact name is a plain text input with no search dropdown or repeated no-match panel. Linked/ambiguous/truncated Contact lists retain search and selection; available selected master values remain read-only and missing details remain editable estimate-only snapshots. Contact results close when focus leaves the Contact field or on Escape (without the native search-input clear action reopening them). Customer result panels now occupy normal layout space instead of covering the following Functional Location Description label/input. Missing source Location.Name still requires manual entry; this fix does not manufacture source data.

Next, Save draft and Submit are clickable with missing fields. Clicking shows localized red required/invalid-email messages beside the relevant labels, marks controls with accessible errors and focuses the first editable invalid field. Save/Submit return to the earliest step with missing data and do not call the persistence API. Messages clear as values become valid; a new draft resets attempted-validation state. Existing busy/import, access, submitted/export locking and server validation remain in force. Next retains the existing customer-free local browsing policy: step 1 checks name, Branch, location description and equipment type; step 2 checks equipment, packages and assignments. Account/Contact/email, proposal language, province/currency and cost requirements remain mandatory for Save; Submit additionally checks positive selling price and billing plan. Local previews and authoritative pricing prerequisites are unchanged.

Local evidence: build/type-check, changed-source lint and frontend unit suite passed. Across focused mocked browser runs, 33 distinct cases passed, including English/French mobile/desktop inputs, no-match blur/Escape, required messages/reset, hidden-step Save/Submit errors, manual/partial Contact Save/reopen, linked location/Contact controls, stale location responses, local browsing, clones/presets, aggregate VK13 and CSTM guards. Initial failures required preventing native Escape clearing/reopening the search and explicitly focusing the formatted numeric input before clearing it in the test; both corrected cases passed. Two later mobile cases exceeded the 60-second timeout during a concurrent build/lint run, then passed in an isolated single-worker rerun without source changes. This is local source/mock evidence only: no publication, tenant write, schema/API/plugin change or live/non-admin verification was performed for this fix. Source gaps and prior tenant/deployment evidence below remain separately scoped.

### Single-column customer controls (2026-11-07)

Customer Contact and Location Description now appear vertically in one column instead of parallel source/manual columns. Contact name uses one combobox: a uniquely eligible fetched Contact is filled directly; multiple linked Contacts are available in its dropdown, with name/email search for larger lists. If no match exists, the same field accepts an estimate-only custom name. Selected nonblank master name/email/phone values remain authoritative; missing values are editable. The separate Dataverse Contact search/manual-name inputs are removed. Manual names entered during a pending lookup are not overwritten by automatic Contact selection.

Location Description uses only one control at a time: an editable input for a complete sole default, missing data or existing/custom descriptions; a dropdown for multiple or uncertain fetched location choices, with an explicit custom-entry option. SAP numbers are supplementary text, not a second input. Saved/custom descriptions are preserved, and users can switch back to linked locations. Same-name SAP pairs remain distinct. Contact email/phone also stack vertically. Required values, lengths, Account/Branch filtering, backend persistence and master-write restrictions remain unchanged.

Validation: 16 focused mocked browser cases passed across runs (15 initially, then the corrected layout selector plus two expanded unified-field cases passed). Coverage includes English/French desktop/mobile, one/multiple/missing Contacts and locations, manual/partial Contact Save/reopen, dropdown-to-custom switching, equal-name SAP pairs, keyboard access, stale responses and manual edits during lookup. Six contract and five documentation tests, final build/type-check and changed-source lint passed. This UI-only change needs no plugin/schema deployment; it does not fill missing source records or remove truncation/eligibility guards.

PAC published the frontend into Dev `RepairEstimatorApp`; the verification tab initially showed the previous bundle, then after refresh loaded `index-D58AHTms.js`. Read-only unsaved UI verification confirmed fetched Contact name and source Location.Name in one control each, one-column layout and no duplicate manual-name/location inputs. No business Save/Submit, master writes, new plugin deployment or teammate/non-admin acceptance occurred. Existing cached tabs must refresh to use this publication.

### Account-based source Location.Name selection (2026-11-07, source correction)

Deployment update (2026-11-07, approximately 07:01 +05:30): the latest workspace frontend was published to the existing Dev app in `RepairEstimatorApp`, together with the matching signed Drafts assembly. The npm `pa app push --solution-id` reported success, but the initial verification tab still loaded the older `index-e-uRi3hk.js`; a subsequent explicit PAC publication with environment and solution name was followed by fresh-tab verification of `index-eXQteb7d.js`. This records observed results, not a proven root cause for the earlier stale bundle. Read-only Dataverse verification confirms the app is a solution component (type 300).

The published UI fetched one SAP-number/source-name option from a live MKO Account/Branch and autofilled the blank description on step 1 before Equipment selection. The deployed API's pair matched independent native source-metadata reads. No Save/Submit or business/master writes occurred. Teammates must use the published app URL, not `/a/local`/localhost; their permissions and individual cached sessions were not tested. Eight focused mocked browser cases, six contract cases, changed-source lint, documentation checks and build/type-check passed; an additional missing-source-warning browser case and exact-2,000-row backend boundary check passed. The unrelated full legacy executable harness failed in `TestChoices` because its fixture omitted the now-required Account; focused customer defaults passed. Full-suite/non-admin acceptance remains outstanding.

Location is chosen on Opportunity details before Equipment selection. The Account-master number resolves an imported Account GUID; the defaults API reads active Equipment linked to that Account and the selected Branch to recover the exact source `Location.Functional_Location_SAP_Number__c` / `Location.Name` pairs from import metadata. Location Description now uses **Location.Name**, not Equipment Description or billing address. Repeated Equipment rows deduplicate by the exact number/name pair; different SAP numbers with the same name remain separate dropdown options labelled `number - name`.

A complete sole valid location autofills only a blank description. Multiple locations require dropdown selection, which copies the source name into the existing editable 300-character description field. Existing/manual descriptions are preserved. Missing names, inconsistent source-versus-typed numbers, overlong names or incomplete reads prevent inferred autofill and show an explicit warning; malformed metadata produces a retryable API error, never a fallback to Equipment Description. Leading zeros are preserved.

At most 20 location choices are returned after paged scans of at most 2,000 matching Equipment records. Missing imports and unresolved Equipment relationships can still omit locations; this is not a complete independent location directory. The dropdown pair identity is UI-only; only the existing description snapshot is persisted. Reopened descriptions cannot identify a unique SAP location when different locations share that name. Equipment selection remains Branch-scoped and is not filtered by the chosen location in this change.

Predeployment local evidence: six customer contract tests, signed Drafts/test build and focused backend defaults cases passed, plus frontend build/type-check, changed-source lint and five documentation checks. Eight mocked browser regressions passed across English/French desktop/mobile: sole-location autofill before Equipment selection, multiple/equal-name SAP choices, manual edits, stale Account responses, incomplete/overlong results and explicit read-error retry. A fresh read-only tenant sample found source Location.Name and matching raw/typed SAP numbers in all 25 MKO Equipment rows; 24 names differed from Equipment Description. This sample confirms source availability, not every-row accuracy. No import/master write, schema or permission changes. Subsequent coordinated deployment/UI evidence is recorded above.

### Account input and Contact mapping: fresh read-only audit (2026-11-06)

Current Account lookup expects the imported Account-master number/name prefix, then explicit Account-option selection; typing a number alone does not resolve a Contact relationship. Contact parent relationships use the source Account ID mapped to its Dataverse GUID, not email or a copied Equipment account-number string. A fresh 25-Account/25-Contact sample passed 1,175 mapped-field comparisons and all parent/number/market checks. Ten live app lookup/default API cases matched direct Dataverse queries: one allowed automatic Contact selection, nine required choosing linked Contacts under the existing sole/unique-primary policy. This is read-only sample/API evidence, not every-row certification, a UI Save/Submit test or non-admin acceptance.

The private full mapping audit covers 105 source columns and separates source/payload checks, prior import-time readbacks and fresh tenant samples. It found 12,737 Equipment account-number copies differing only by leading-zero formatting; three live prefix-search samples found the intended Account with its Account-master number but not the Equipment-source variant. Existing lookup does not normalize those identifiers. Eight MKOF Equipment rows with CKE Account parents are separately flagged as invalid MKO defaults context; no automatic correction was made.

At that audit's deployed version, Account + Branch defaults fetched linked functional-location numbers and Equipment Description, not Account billing address or source Location.Name. The subsequently deployed correction above replaces that description mapping. Account selection does not automatically select Equipment: the step-2 Equipment picker remains Branch-scoped by Equipment number/name, while the defaults query is separately Account-and-Branch-scoped.

### Imported equipment detail display (2026-11-06, source correction)

Read-only checks of the three equipment rows in the reported screenshot found blank legacy `re_equipmentname`, `re_oem` and `re_equipmentage`, but populated imported `re_description`, `re_manufacturer` and integer `re_constructionyear`. The UI had queried only the legacy columns; this was not evidence that imported source details were lost.

With user approval, equipment browse/search and selected cards now show imported Description, Manufacturer and Age alongside the existing functional location. Description remains explicitly labelled, not relabelled as equipment name. Manufacturer uses the imported value, falling back to legacy OEM. An existing nonnegative legacy age is retained; otherwise age is current calendar year minus a valid positive integer construction year, including zero years for current-year construction. Missing/future/invalid years show no invented age. Existing legacy equipment names remain visible.

Matched selected equipment details are loaded read-only in bounded Branch-scoped batches, including reopened/bulk selections. Errors are explicit with retry; stale responses are ignored. These are transient display details, not manual inputs or changes to pricing inputs, saved equipment snapshots, master records or persisted financial bands. Location retains the functional-location identifier; no address/name substitution is inferred.

Validation: three display-helper tests, four bulk-planning tests and five documentation checks passed, plus build/type-check and focused lint. Seven mocked browser cases passed: English/French at desktop/mobile verify dropdown/cards, Save/reopen and unchanged financial snapshots; existing bulk and typed-list click/keyboard cases passed. PAC publication to Dev succeeded; a separate verification tab loaded `index-e-uRi3hk.js` and showed Description, Manufacturer, calculated Age and Location in both a live Equipment option and its unsaved selected card. No business Save/Submit or master write occurred. Age reflects the stored source year, not certified installation history; missing/correctness of source data remains a master-data concern.

### Dev deployment and page-placement correction (2026-11-06)

The accumulated customer fallback, CSTM equipment previews, additional-cost summary and new material defaults were published to Dev. A separate verification tab loaded `index-BVY7Cdit.js`; read-only Contact search succeeded. Pricing and Drafts signed assemblies were updated in place with hash readback and existing type identities preserved. Earlier source-only statements below describe predeployment validation, not current deployment status. No real business Save/Submit, email, financial recalculation or non-admin acceptance was performed.

Correction: the additional-details card and combined estimated total belong **only on Pricing & Margin (step 4)**. Additional Details (step 3) retains package summaries and existing input controls; step 4 derives its card from those same inputs, including after back-navigation edits and Save/reopen. Review retains its existing package/pricing summaries without this extra card. No duplicate inputs, formula or persistence changes. Four focused mocked browser cases passed across successful runs (English/French edits, native negative-input navigation guard, Save/reopen and mobile/desktop mixed-package totals); 15 cost/documentation checks and build/type-check/lint passed. PAC published the correction to Dev; a separate verification tab loaded the new `index-Cpj6WZd4.js` bundle. This is published-bundle verification, not real tenant Save/Submit acceptance.

### New CSTM material defaults (current source)

New material lines start with quantity 1 and part type KONE in both languages. Selecting a catalog part preserves the entered quantity. Users can still explicitly choose Non-KONE/manual entry. Existing saved and cloned line quantities/types are not overwritten; no price, markup, validation or calculation formula changes. Regression coverage checks the defaults for successive new lines, catalog selection, manual override and saved non-default quantities in English/French at mobile/desktop widths. Deployment and validation evidence is recorded separately below when completed.

### Additional details cost card and combined total (current source)

Pricing & Margin shows selected package cards, a **Package subtotal**, an **Additional details cost** card, then **Total estimated cost**, using values entered on Additional Details. The additional card uses the same bordered-card styling and itemizes additional labor hours, branch mechanic role/time rate, labor cost, additional material, miscellaneous, tax/freight rates and amounts, and additional subtotal. The final total adds package subtotal and additions once. Package-specific CSTM lines remain in package costs and are not repeated as additions; these are cost previews, not selling prices or CMII.

The shared additional-cost helper is also used by the local Calculate cost preview action to prevent formula drift. Blank optional additions are zero; negative/nonfinite inputs, missing/ambiguous labor rates or invalid percentages make the additional/combined preview explicitly unavailable. Existing fields and Save/reopen persistence remain unchanged. Ten cost tests, five documentation checks, production build/type-check and changed-source lint passed. Five mocked browser cases passed: English/French card ordering, breakdown, invalid-input recovery, local-preview reconciliation and Save/reopen, plus mobile/desktop mixed-package carry-forward and CSTM validation. Saved mock package snapshots differ from unsaved catalog values; combined totals correctly use the returned saved values. No frontend publication, tenant write, backend formula change or production/non-admin acceptance is claimed.

### CSTM equipment cards include entered hours and costs (current source)

The zero-hour/zero-cost cards used only predefined CSTM master values, while entered custom lines were already included in package summaries. Equipment cards now use the same validated package-total calculation and divide entered package-specific hours/labor/material/tax/freight equally across that package's assigned Equipment count. Predefined costs remain per-unit; other packages' lines and estimate-level additions are excluded. Changing hours, rates, material, tax/freight or assigned Equipment count updates the displayed shares. Custom entries are still charged once: no multiplied charges or changes to saved financial formulas.

CSTM cards label their weighted hourly cost as a blended rate because role/time categories and saved line rates may differ. Package-priced KONE amounts remain once per unit, without extra tax/freight; separately entered manual materials retain applicable tax/freight. Missing/invalid CSTM entries or rates show an explicit unavailable error instead of a misleading zero. Display amounts use existing two-decimal formatting; rounded individual shares may differ from the unrounded package total by rounding cents.

Local evidence: nine package-cost tests, three material tests and five documentation checks passed, including three/many-unit reconciliation, subsets, package isolation, saved/mixed-role rates and mixed KONE/manual materials. Seven focused browser cases passed across targeted runs: English/French CSTM hour edits and assigned-equipment shares, mobile/desktop carry-forward totals, standard cards and missing-rate recovery. Production build/type-check and changed-source lint passed. Tests use synthetic/mocked data; this is source/local evidence only, not app publication or tenant/non-admin verification. No backend/schema, master values, saved estimates or import contracts changed.

### Missing customer details: estimate-only manual fallback (current source)

This supersedes earlier mandatory-Contact/read-only-only descriptions below. An imported Account is still required. Available Contact name/email/phone values are autofetched and read-only; missing values can be entered manually (name/email 100, phone 50 characters). When no eligible Contact exists, a separate manual Contact-name field is shown alongside the optional Dataverse search. Required name and valid email remain Save/Submit gates; local review navigation remains possible without completed customer details. English and French helper text distinguishes estimate-only entry from shared master writeback.

Account/Branch changes clear old Contact/manual values. Explicit Contact changes clear manual details; delayed automatic defaults preserve entered missing fields. Save/load, clone and preset payloads retain the Account, optional Contact and estimate snapshots. The additive `contactMaster` response distinguishes available master values from manually completed fields so missing values remain editable after reopening. No Account/Contact master is created or edited. Existing submitted/permission/busy locks still apply.

Validation evidence: production build/type-check, changed-source ESLint, 30 customer-contract/clone cases, five documentation checks and 11 browser cases passed. Browser coverage includes missing/partial Contacts in English/French, save/reopen/update, invalid email, Account-change clearing and existing autofetch/stale-response behavior. Thirteen focused backend cases passed, covering Save/reload/update/submission and master-validation gates. These are local/mocked tests, not tenant acceptance. This is local source only, not a published app or deployed API. Tenant/non-admin Save/Submit acceptance remains outstanding; both the Drafts assembly and frontend need coordinated deployment. No pricing formulas or import workers changed.

### MKO master-data priority (2026-11-06)

Email/template flow work is paused in favor of all MKO master imports. User approved making valid effective refined MKOM parts available through the existing catalog and correcting existing MKO package names/scopes from the supplied source, without changing financial values or GUIDs. Catalog search/effectivity, positive per-unit KONE pricing requirements and saved-line snapshot preservation remain unchanged; zero/non-unit source records stay inactive instead of causing catalog errors. Long/missing source fields and unresolved Equipment mappings are not guessed. No frontend publication or business Save/Submit is part of this import. Source/local tests, native Dataverse readback and browser/non-admin acceptance remain distinct; completion is recorded in [dataverse.md](dataverse.md).

All 280 MKO package source texts/provenance are now verified natively with unchanged financial fields/GUIDs and unchanged CAD masters. The parts continuation checkpoint reached 12,500 newly verified rows and is paused; this is not the final catalog total. User approved exact MKO Equipment plant-to-Branch-number mapping, source SAP functional-location numbers and eight-decimal coordinates with raw originals preserved; only verified source Account parents may be linked. The completed bounded Equipment pilot created and readback-verified 64 records while preserving 186 conflicting native records unchanged. Existing account/branch Equipment filtering remains unchanged, so new valid relationships can become eligible through existing reads. Cached catalogs/saved snapshots are not automatically refreshed; published-browser/non-admin behavior remains unverified.

Subsequent remaining-data continuation supersedes the paused checkpoints above: user approved safe API continuation; parts and Equipment writers resumed while the customer writer remained active. At a later checkpoint, parts reached 14,500 verified and Equipment reached 3,425 verified with 1,075 native conflicts preserved. The attempted dataflow source connection was blocked by a popup error and its unpublished wizard was cancelled before parts resumed; there is no parallel dataflow refresh. These are master-data readback results, not frontend publication, automatic snapshot refresh or complete source import. Exact Branch-name/SFDC labor comparison found 1,308 existing rate amounts agreeing at cent precision; no rates or UI pricing logic were changed. See [dataverse.md](dataverse.md) for unresolved contexts and evidence limits.

The generated import checklist now incorporates current MKO reports and full package completion evidence instead of fixed "not imported" parts text and an Equipment-only historical checkpoint. It explicitly separates source candidates, quarantines, native conflicts and incomplete runtime acceptance. A temporary private refresher keeps reporting current while cached import writers continue; brief stale intervals between refreshes are possible. This is reporting-only: no frontend controls, calculation/display behavior, access, saved snapshots or publication change. See [dataverse.md](dataverse.md) for report inputs and verification limits.

Account/Contact import scheduling now supports concurrent per-dataset batches under one exclusive orchestrator; Contact linkage still requires exact source parents already verified. This is master-data ingestion only: no changed Account/Contact selector behavior, auto-save, permission, formatting, pricing or frontend publication. Preflight/reconciliation and measured native readback remain separate from local tests; see [dataverse.md](dataverse.md).

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
| Save draft at top | Clickable with missing values; displays inline errors and returns to the earliest incomplete step before API calls; valid requests save/calculate, not submit |
| New draft | Explicit confirmed reset; disabled while busy or without create permission |
| Reload draft | Available for saved request; reloads server state with dirty warning |
| Back | Previous step; at first step returns to dashboard |
| Continue / Next equipment | Clickable with missing values; validates step-specific prerequisites with inline errors, advances locally, not a Save |
| Complete CSTM / return to equipment | Validates CSTM lines and package preview, returns to step2 |
| Submit on Review | Clickable with missing values; inline errors return to incomplete fields; valid requests submit after confirmation and lock when server confirms |
| Read-only submitted/export state | Inputs disabled through workspace/read-only surfaces; no ordinary draft edits |

First-step Continue checks opportunity name, branch, building text and equipment type, but does
not require Account/Contact selections or Contact email. This intentionally
allows local testing of later steps while customer imports/search are unavailable.
An EN/FR status message explains that customer selections are still required
before Save/Submit, and the button references that message accessibly.
Step1 navigation skips only customer-email HTML validity; other mounted input
validation remains. It is **less strict than full Save**: province/remaining
inputs are checked later. Step2 Continue still requires equipment and package
selections. Enabled Continue is not proof the request can be saved/submitted.

Full Save completion requires title, selected Account, customer name and valid email (master or manually completed), building, province, branch, equipment type, equipment, package, proposal language, time category, tax/freight text, currency/references and valid CSTM associations. Contact lookup is optional. Additional HTML controls enforce required/type/range/step constraints. Source: [App](../src/App.tsx), [workspace](../src/EstimatorWorkspace.tsx).

## 5. Step 1: Opportunity detail controls

| Field / control | UI purpose / origin | Save behavior |
|---|---|---|
| Opportunity Name | Initially blank free-text title, maximum 100 characters; clearing does not generate a replacement | Required header `re_estimatename`; saved title retained on reopen |
| Market | MKO/CKE/CKQ context | Saved header context; saved branch/market fixed |
| Branch search dropdown/toggle | Local name/number filtering of fetched market branches | Sets branch; clears equipment/packages/lines/customer when changed |
| Province/state | Branch-derived, disabled display | Saved province lookup; server country/French validation |
| Currency | Branch currency reference display | Server context; user does not manually enter FX here |
| Salesperson | Signed-in user or saved request salesperson | New request server assignment; not free text |
| Equipment type / Job type | Active reference dropdowns | Lookup IDs; job type can be empty |
| Functional Location Description | Manual text; renamed Building Name label | Same `re_buildingname` column; no authoritative building-master lookup |
| Account search | Searches active imported Accounts by number/name prefix, scoped to current market | `accountsearch`; selected GUID and displayed number/name enter draft and preset payload |
| Contact search | Searches active imported Contacts by name/email prefix under the selected Account, including missing-email Contacts | `contactsearch`; optional Contact ID is saved and available values are autofetched |
| Contact name / email / phone | Available selected Contact values read-only; missing values manually editable | Server validates required name/email, master relationship and field limits; manual values remain estimate-only |
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

Per-equipment cards show estimated cost, **not selling price**. Standard packages retain predefined one-unit costs. CSTM cards include predefined unit costs plus an equal display share of package-specific entered labor/material and applicable tax/freight across assigned Equipment. Estimate-level additions remain separate. Shares reconcile before display rounding to the package total without multiplying entered custom charges; this is not OEM-specific unit repricing.

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