# Opportunity Details: Branch Audit

**Audit date:** 2026-10-24  
**Scope:** Current application code and locally generated Dataverse contracts.  
**Method:** Read-only source inspection. No application code, schema, permissions, or live records were changed.

## 1. Summary

| Question | Verified answer |
| --- | --- |
| Dropdown or combobox? | Custom searchable combobox, not a native HTML select |
| Source | Dataverse logical table `re_branch`, entity set `re_branchs` |
| Data organization | One branch table with a `re_market` choice; not separate market tables |
| Joined data? | No multi-table join or relationship expansion builds the options |
| Selected value | Branch GUID, `re_branchid`, held in React state |
| Confirmed incoming business lookups | Equipment and Repair Estimate reference Branch |
| Branch's outgoing business lookups | Country, Currency, Margin Group, State/Province, optional Mapped Equipment Branch |
| Active downstream behavior | Equipment branch filtering, package country context, wizard validation, review |
| Defaults applied? | No branch tax, freight, language, currency, province, or margin defaults are applied |
| Persisted to a new estimate? | No; estimate saving remains unconnected |

**Evidence boundary:** This describes what the current code attempts and what the local schema exports expose. It is not a live Dataverse relationship, data-quality, or authorization certification.

## 2. Control Type and Interaction

Source: [BranchSelect.tsx](../../src/BranchSelect.tsx).

Branch uses a custom text-input combobox with:

- `role="combobox"` on the input.
- A dropdown-arrow button.
- A popup `role="listbox"`.
- Selectable options with `role="option"`.
- Expanded, selected, and active-option accessibility state.

It is not a native `<select>` dropdown. The user can search, but cannot create a branch or commit arbitrary typed text.

### Interaction rules

| Action | Behavior |
| --- | --- |
| Click input or arrow | Opens the options |
| Type | Filters already-loaded branches |
| Arrow Up/Down | Moves the active option within bounds |
| Enter while open | Commits the active option |
| Escape | Closes without committing typed text |
| Tab | Closes without committing typed text |
| Blur outside the control | Closes the popup |
| Select a branch | Returns its ID, closes the list, clears search, restores input focus |
| Select Choose a branch | Returns an empty ID and clears the selection, subject to change confirmation |

Opening resets search and active index to zero. The first option is always Choose a branch, not the first matching real branch. Typing and immediately pressing Enter therefore does not necessarily choose the first matching branch.

When closed, the control displays:

```text
Branch Name (Branch Number)
```

When open, its input displays the current search text.

### Search behavior

- Uses trimmed text.
- Uses locale-aware lowercase conversion based on UI language.
- Performs case-insensitive substring matching across the combined name/number label.
- Has no minimum character threshold or network debounce.
- Does not send a new Dataverse request for each keystroke.
- Searches neither district nor country nor SAP/SFDC identifiers.
- Unmatched typed text is not a valid branch lookup.

## 3. Exact Dataverse Source

Sources: [Power Apps configuration](../../power.config.json), [branch schema](../../.power/schemas/dataverse/branches.Schema.json), [generated branch service](../../src/generated/services/Re_branchsService.ts).

| Identifier | Value | Meaning |
| --- | --- | --- |
| Logical table | `re_branch` | Dataverse table identity |
| Entity set | `re_branchs` | Collection used by generated service |
| Configuration alias | `branches` | Power Apps registration alias |
| Primary key | `re_branchid` | GUID identifying one branch |
| Primary name | `re_branchname` | Human-readable branch name |
| Business number | `re_branchnumber` | Separate branch-number string |
| Service class | `Re_branchsService` | Generated SDK wrapper |

The primary key, name, and number are different concepts. The selected relationship uses the GUID, not a text name or number.

The inspected schema does not establish `re_branchnumber` as an alternate unique key.

### Data lineage

```text
Authenticated Power Apps host
    |
    v
Power Apps SDK data client
    |
    v
Dataverse: re_branch / re_branchs
    |
    v
Re_branchsService.getAll(query)
    |
    v
getBranches(): follow and accumulate pages
    |
    v
App.branches
    |
    v
Filter by selected market
    |
    v
BranchSelect: local name/number search
    |
    v
User selects an option
    |
    v
App.branchId = re_branchid
```

The generated service uses `getClient(dataSourcesInfo)` and SDK `retrieveMultipleRecordsAsync`.

The code does not establish who originally populates the branch table. Manual entry, import, SAP synchronization, or other integrations cannot be inferred from the presence of SAP/SFDC column names.

## 4. Fields Actually Loaded

Sources: [query builder](../../src/data/estimateQuery.ts), [repository Branch type](../../src/data/repairEstimatorRepository.ts).

Only these five columns are projected:

| Column | Data meaning | Consumer |
| --- | --- | --- |
| `re_branchid` | Branch GUID | Option ID, selected state, equipment filter |
| `re_branchname` | Branch name | Display, local search, ordering, review |
| `re_branchnumber` | Branch number | Display and local search |
| `re_market` | Numeric market choice | Local market restriction |
| `_re_country_value` | Country lookup GUID | Package query context |

The query does not retrieve full Country records. It retrieves the Country lookup's GUID only.

The generated formatted label `re_marketname` is not selected. Generated label properties must not be assumed to be ordinary selectable columns.

## 5. Query, Pagination, and Loading

Sources: [buildBranchQuery](../../src/data/estimateQuery.ts), [getBranches](../../src/data/repairEstimatorRepository.ts), [branch loading in App](../../src/App.tsx).

### Query contract

```text
Collection: re_branchs

Select:
  re_branchid
  re_branchname
  re_branchnumber
  re_market
  _re_country_value

Filter:
  statecode eq 0

Order:
  re_branchname asc
  re_branchid asc

maxPageSize:
  500

skipToken:
  continuation token from previous page
```

- Only active records are requested.
- There is no `top` limiting the full collection to 500.
- All accessible returned pages are accumulated before assigning the result to application state.
- Any page failure rejects the load; the UI is not given partial results.
- Repeated nonempty paging tokens cause an explicit error.
- Each page request has a 15-second timeout; this is not one timeout for the entire multi-page load.
- Rows are appended without explicit GUID or branch-number deduplication.

### When loading happens

Branch loading starts when the session permits request creation, meaning effective estimate Read plus Create have resolved positively. It can start while the dashboard is visible.

The component receives branch records from its parent; it does not call Dataverse itself.

There is no automatic polling, live subscription, or branch refresh on every combobox opening. An error exposes a Retry button that runs the full branch loader.

## 6. Organization by Market: Not Separate Tables

Sources: [market choices](../../src/generated/models/Re_branchsModel.ts), [market filtering](../../src/App.tsx).

MKO, CKE, and CKQ branch records use the same source table:

| Market | Choice value |
| --- | ---: |
| MKO - United States | `126110000` |
| CKE - Canada English | `126110001` |
| CKQ - Quebec | `126110002` |

The branch query loads accessible active records across markets. The application then filters them:

```ts
branches.filter((branch) => branch.re_market === market)
```

### What is combined?

| Interpretation | Answer |
| --- | --- |
| Branch records joined with Country/Currency/Margin Group | No |
| MKO/CKE/CKQ in separate branch tables | No, not in this application's contract |
| Pages from the same branch query appended together | Yes |
| All markets displayed simultaneously | No; the combobox receives only the selected market |
| District/province grouping in the popup | No |
| Server authorization replaced by market filtering | No |

The current market starts as MKO. Market is a Choice column here, not a foreign key to a separate market table.

### Effective option pipeline

```text
Dataverse row access
  -> active records only
  -> server order by name and GUID
  -> accumulate pages
  -> local selected-market filter
  -> local typed name/number filter
  -> visible options
```

The combobox does not apply its own salesperson-to-branch assignment rule.

## 7. Incoming Relationships: Which Tables Reference Branch?

Sources: [Equipment model](../../src/generated/models/Re_equipmentsModel.ts), [Equipment schema](../../.power/schemas/dataverse/equipment.Schema.json), [Repair Estimate model](../../src/generated/models/Re_repairestimatesModel.ts), [Repair Estimate schema](../../.power/schemas/dataverse/repairestimates.Schema.json).

In Dataverse these are Lookup columns, serving a foreign-key-like role.

| Referencing table | Logical lookup column | Read GUID property | Write binding | Local contract |
| --- | --- | --- | --- | --- |
| Equipment: `re_equipment` | `re_branch` | `_re_branch_value` | `re_Branch@odata.bind` | Required |
| Repair Estimate: `re_repairestimate` | `re_branch` | `_re_branch_value` | `re_Branch@odata.bind` | Required |

Conceptually:

```text
Branch.re_branchid
    ^
    |
    +-- Equipment.re_branch
    |
    +-- Repair Estimate.re_branch
```

Each lookup holds one branch reference; multiple equipment or estimate records can reference the same branch.

### Primary key versus foreign key

```text
Branch's primary key:
  re_branchid

Equipment's Branch lookup:
  re_branch

Repair Estimate's Branch lookup:
  re_branch
```

The relationship does not use `re_branchname` or `re_branchnumber` as the stored reference.

### Current persistence status

The opportunity screen stores the chosen GUID in `branchId`. It does not emit an estimate-create payload or write `re_Branch@odata.bind`.

The generated estimate binding is available, but saving is unconnected.

**Completeness limit:** Equipment and Repair Estimate are the incoming Branch business lookups visible in the exported tables inspected for this repository. Other live Dataverse tables may also reference Branch. Full incoming relationships, cascade behavior, and relationship schema names require live metadata.

## 8. Outgoing Relationships: What Does Branch Reference?

Sources: [Branch model](../../src/generated/models/Re_branchsModel.ts), [Branch schema](../../.power/schemas/dataverse/branches.Schema.json).

| Branch column | Generated write binding | Required locally? | Loaded here? | Active use |
| --- | --- | --- | --- | --- |
| `re_country` | `re_Country@odata.bind` | Yes | GUID only | Package-country restriction |
| `re_currency` | `re_Currency@odata.bind` | Yes | No | None |
| `re_margingroup` | `re_MarginGroup@odata.bind` | Yes | No | None |
| `re_stateprovince` | `re_StateProvince@odata.bind` | Yes | No | None |
| `re_mappedequipmentbranch` | `re_MappedEquipmentBranch@odata.bind` | No | No | None |

Read properties are:

- `_re_country_value`
- `_re_currency_value`
- `_re_margingroup_value`
- `_re_stateprovince_value`
- `_re_mappedequipmentbranch_value`

The local contracts expose these lookup and navigation names, but do not certify all target-table logical names or relationship rules. In particular, the name Mapped Equipment Branch alone is not sufficient proof of its live target or mapping semantics.

### Platform relationships

The generated read model also includes owner/audit context:

- `ownerid`.
- Owning business unit, owning team, and owning user.
- Created by, modified by, and delegate identities.

These describe platform ownership/audit relationships. They are not joined into the combobox's display data.

## 9. Downstream Effects of Selecting a Branch

### 9.1 Equipment

Source: [searchEquipment](../../src/data/repairEstimatorRepository.ts).

Equipment queries include:

```text
statecode eq 0
and _re_branch_value eq <selected branch GUID>
and equipment-number/name prefix search
```

This directly uses the selected branch ID.

**Important:** The optional Mapped Equipment Branch lookup is not fetched or consulted. If business requirements expect that mapping to redirect equipment search, the current implementation does not do so.

### 9.2 Packages

Sources: [package search effect](../../src/App.tsx), [searchStandardPackages](../../src/data/repairEstimatorRepository.ts).

```text
Selected branch
  -> _re_country_value
  -> package country equals branch country OR package country is null
```

Packages are not directly filtered by a Branch lookup.

Additional package rules apply separately: active, noncustom, non-T&M, text prefix, bounded search results, and effective-date eligibility.

If the selected branch lacks a country GUID, package search is disabled and an explicit missing-country message is displayed. Although Country is required in the local branch contract, the UI still handles missing read-side data.

### 9.3 Opportunity step validation

Step 1 cannot continue unless:

```text
branchId is nonempty
AND buildingName.trim() is nonempty
AND equipmentTypeId is nonempty
```

The combobox declares `aria-required`, but it does not use an HTML `required` attribute. The branch requirement is enforced by the wizard button's disabled condition, not solely by browser validation.

### 9.4 Review and unload warning

- Review displays the selected branch name.
- A nonempty branch contributes to unsaved-change detection.
- The browser may warn before leaving/reloading.
- The warning does not save or restore request state.

### 9.5 What selecting Branch does not do

It does not automatically:

- Populate customer, building, or contact details.
- Set equipment type, job type, or salesperson.
- Load/apply branch tax or freight defaults.
- Select currency or State/Province.
- Apply Margin Group pricing.
- Set UI or proposal language.
- Create a Branch, Equipment, Package, or Estimate record.
- Restrict the existing estimate list to that branch.

The estimate list is market-filtered; the unsaved request's `branchId` is not part of its query.

## 10. Branch and Market Change Behavior

Source: [resetBranch, changeBranch, and changeMarket](../../src/App.tsx).

### Branch change

If the next branch equals the current one, nothing changes.

If any equipment or package is selected, the app asks for confirmation. Cancelling leaves the current branch and selections unchanged.

After an accepted change:

| Cleared/reset | Preserved |
| --- | --- |
| Equipment query/results | Building name |
| Selected equipment | Customer/contact values |
| Package query/results | Equipment type |
| Selected packages | Job type |
| Equipment/package errors | Request questions |
| Equipment/package loading flags | Cost and pricing inputs |
| Branch ID replaced with next ID | Partner identifiers and CTT notes |

The branch-change handler does not reset the wizard step. The control is normally shown at step 1.

**Audit observation:** Preserved values are not checked for compatibility with the newly selected branch.

### Market change

- Confirmation is requested when a branch is selected.
- Accepted changes clear branch, equipment/package selections, and related search state.
- Wizard returns to step 1.
- Other entered request details remain.
- Loaded branch records are reused and locally filtered to the next market.
- The combobox remounts using the new market as its React key.
- CKQ changes UI preferences to French/`fr-CA`; that is market behavior, not application of the branch's default-language field.

## 11. Branch Schema Fields Not Connected to This Screen

Source: [Branch contract](../../src/generated/models/Re_branchsModel.ts).

| Field | Local type/limit | Present in current branch projection? |
| --- | --- | --- |
| `re_defaultfreight` | Decimal | No |
| `re_defaultusetax` | Decimal | No |
| `re_defaultlanguage` | English/French choice | No |
| `re_district` | Text, max 50 | No |
| `re_sapmainbranch` | Text, max 10 | No |
| `re_sfdcbranch` | Text, max 100 | No |
| Currency lookup | Required locally | No |
| Margin Group lookup | Required locally | No |
| State/Province lookup | Required locally | No |
| Mapped Equipment Branch lookup | Optional locally | No |

Other important local limits:

- `re_branchname`: required text, max 850.
- `re_branchnumber`: required text, max 10.
- `re_market`: required choice.
- `re_branchid`: required primary GUID.
- `statecode`: required Active/Inactive state.

Required in a generated contract does not independently establish live defaults, business enforcement, or completeness of existing records.

## 12. Permissions, Errors, and Data-Quality Considerations

Sources: [session repository](../../src/data/sessionRepository.ts), [branch repository](../../src/data/repairEstimatorRepository.ts), [timeout/error helper](../../src/data/dataverseOperation.ts).

| Area | Current behavior or limitation |
| --- | --- |
| Access to options | Dataverse determines which rows the user can read |
| UI access gate | Branch load starts after estimate Read/Create capability allows New Request |
| Explicit salesperson restriction | None in the branch query |
| Market restriction | UI organization, not an authorization boundary |
| Failed load | Error shown with Retry |
| Empty market list | Explicit no-active-accessible-branches message |
| Partial page failure | Entire load rejects rather than showing partial data |
| Timeout | 15 seconds per request; underlying SDK request is not aborted |
| Duplicate labels/numbers | Not deduplicated; GUID remains the option identity |
| Malformed market | Will not match a supported market filter |
| Missing country | Branch can be selected, but package search cannot run |
| Master-data changes | Not automatically pushed to the loaded list |
| Branch management | No create/edit/delete interface in this control |
| Reload | Selected branch is not restored from an estimate or preference record |

Branch loading does not use the same post-request cancellation guard as the search effects. This is a source-level lifecycle observation, not a reproduced live failure.

## 13. Follow-up Checks Needed for a Complete Live Relationship Audit

No live checks below were performed as part of this document.

1. Confirm exact target logical tables for Country, Currency, Margin Group, State/Province, and Mapped Equipment Branch.
2. Enumerate all live one-to-many/many-to-one relationships involving `re_branch`.
3. Verify cascade rules, deletion behavior, and relationship requiredness.
4. Verify any alternate key or uniqueness constraint on branch number.
5. Identify the authoritative upstream source and synchronization process for branch master data.
6. Verify intended salesperson/team/market access with representative accounts.
7. Check active branches for missing Country or unsupported market values.
8. Confirm whether Mapped Equipment Branch should drive equipment search.
9. Confirm whether branch defaults should populate tax, freight, currency, language, province, and margin context.
10. Confirm cross-branch input retention is intended before estimate saving is introduced.

## 14. Verification and Related Documentation

This file records the detailed Branch source audit. Documentation-only creation did not require rerunning application tests.

The earlier master audit recorded:

- 22 existing automated tests passed.
- Production build passed.
- ESLint passed.
- No authenticated live Dataverse or browser interaction validation.

Those results do not prove live branch records, permissions, or relationships.

Related documentation: [Master Application Audit](../../MASTER_APPLICATION_AUDIT.md).

**Conclusion:** Branch is a searchable, market-filtered selection from one Dataverse master table. Its GUID directly scopes equipment and its Country lookup scopes packages. Most richer branch configuration is not loaded, and the selected branch is not yet persisted to a new Repair Estimate.
