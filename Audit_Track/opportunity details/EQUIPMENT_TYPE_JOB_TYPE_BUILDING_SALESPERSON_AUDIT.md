# Opportunity Details Audit: Equipment Type, Job Type, Building Name, and Salesperson

**Audit date:** 2026-10-24  
**Scope:** Current application source and local generated Dataverse models/schema exports.  
**Changes:** Documentation only; no application code or live records changed.  
**Evidence limit:** No authenticated live queries or browser interaction tests were performed. Local generated contracts do not certify all live relationships, defaults, permissions, or enforcement.

## 1. Four-field Summary

| Detail | Equipment Type | Job Type | Building name | Salesperson |
| --- | --- | --- | --- | --- |
| UI control | Native select dropdown | Native select dropdown | Editable text input | Read-only text input |
| Searchable custom combobox? | No | No | Not applicable | No |
| Source | Dataverse reference table | Separate Dataverse reference table | User entry | Authenticated Power Apps user context |
| Logical source table | `re_equipmenttype` | `re_jobtype` | None queried for input | No user-table query for display |
| Entity set | `re_equipmenttypes` | `re_jobtypes` | Not applicable | Linked user identity corresponds to Dataverse `systemuser`; display comes from host |
| Stored in current app | `equipmentTypeId` GUID | `jobTypeId` GUID | `buildingName` string | `session.displayName` and `session.userId` |
| Required by step-one button? | Yes | No | Nonblank after trim | Not separately checked |
| Related estimate field | `re_equipmenttype` lookup | `re_jobtype` lookup | `re_buildingname` text | `re_salesperson` lookup |
| Required in local estimate contract? | Yes | No | Yes | Yes |
| Saved to a new estimate now? | No | No | No | No |

Sources: [App controls/state](../../src/App.tsx), [reference repository](../../src/data/repairEstimatorRepository.ts), [session repository](../../src/data/sessionRepository.ts), [estimate contract](../../src/generated/models/Re_repairestimatesModel.ts).

## 2. Shared Reference Loading: Equipment Type and Job Type

### 2.1 One loader, two independent tables

`getRequestReferences()` starts two Dataverse queries using `Promise.all`:

```text
getRequestReferences()
  |
  +--> Re_equipmenttypesService.getAll(...)
  |      -> equipment-type records
  |
  +--> Re_jobtypesService.getAll(...)
         -> job-type records

Both complete successfully
  -> map each collection separately to { id, en, fr }
  -> { equipmentTypes: [...], jobTypes: [...] }
  -> App.references
  -> two separate native selects
```

The records are not merged into one option collection. No join connects the tables. Shared loading/error handling does not imply a relationship between Equipment Type and Job Type.

Source: [getRequestReferences](../../src/data/repairEstimatorRepository.ts).

### 2.2 Exact queries

| Query option | Equipment Type | Job Type |
| --- | --- | --- |
| Select | `re_equipmenttypeid`, `re_nameen`, `re_namefr` | `re_jobtypeid`, `re_jobtypeen`, `re_jobtypefr` |
| Filter | `statecode eq 0` | `statecode eq 0` |
| Order | `re_nameen asc` | `re_jobtypeen asc` |
| Page size requested | 500 | 500 |
| `top` | Not set | Not set |
| Continuation handling | Reject if token exists | Reject if token exists |

Only active records returned within the user's Dataverse access are available.

There is no branch, market, country, customer, salesperson, or selected-equipment filter. Changing one dropdown does not filter the other.

### 2.3 Loading and failure behavior

- Loading starts when the session permits New Request through effective estimate Read plus Create.
- It can start while the dashboard is visible, before the user opens Opportunity details.
- The same effect runs on explicit reference Retry.
- Each query has the existing 15-second timeout wrapper.
- Both queries must succeed; failure of either prevents displaying either dropdown.
- Both results are unwrapped, then continuation tokens are checked.
- If either table has another page, the loader throws an explicit unsupported-reference-paging error.
- It does not follow tokens like the Branch loader does.
- A 500 page-size request is not proof that exactly 500 rows are returned; continuation-token presence is the failure condition.
- No polling, automatic live refresh, or automatic background retry exists.
- Cleanup ignores late UI results; it does not cancel the underlying SDK request.
- The shared error UI shows the backend error and a Retry button; retry reloads both tables.
- A successful empty list is not given a specialized empty-reference warning: its select contains only the placeholder.

Sources: [reference effect and UI](../../src/App.tsx), [error/timeout helper](../../src/data/dataverseOperation.ts).

### 2.4 Localization and option identity

Each option contains a GUID and bilingual labels:

```text
English UI -> English label
French UI  -> French label if truthy, otherwise English

Selected value -> GUID, not translated label
```

English ordering remains even in French. Changing UI language changes labels without re-querying or changing selected IDs. Missing/duplicate labels are not explicitly validated or deduplicated.

The selects have a blank placeholder and no HTML `required` attribute. Equipment Type's required behavior comes from the wizard gate; Job Type remains optional.

## 3. Equipment Type: Detailed Audit

### 3.1 Control

Equipment Type is a standard single-value HTML `<select>`, not the custom Branch combobox.

- It has an Equipment type label with a visible asterisk.
- Initial value is an empty string.
- Initial option is Select an option.
- Choosing an option writes its GUID to `equipmentTypeId`.
- No free-text/custom type creation is supported.
- No explicit searchable popup, debounce, or remote typeahead is implemented.
- Browser-native select keyboard behavior is distinct from the custom Branch control.

Source: [Equipment Type rendering](../../src/App.tsx).

### 3.2 Table and keys

| Identifier | Value |
| --- | --- |
| Logical table | `re_equipmenttype` |
| Entity set | `re_equipmenttypes` |
| Configuration alias | `equipmenttypes` |
| Primary ID | `re_equipmenttypeid` |
| Dataverse primary-name column | `re_equipmenttype` |
| English UI-label column | `re_nameen` |
| French UI-label column | `re_namefr` |

**Important distinction:** The dropdown does not display the table's primary-name column. It displays the selected language's explicit label column.

Sources: [equipment-type schema](../../.power/schemas/dataverse/equipmenttypes.Schema.json), [configuration](../../power.config.json).

### 3.3 Mapping

```text
re_equipmenttypeid -> option.id -> option value -> equipmentTypeId
re_nameen          -> option.en -> English display/fallback
re_namefr          -> option.fr -> French display
```

Only those three columns are loaded.

### 3.4 Other fields in this master table

| Column | Local type/limit | Used by current reference loader? |
| --- | --- | --- |
| `re_equipmenttype` | Required text, 100 | No |
| `re_equipmenttypeid` | Required primary GUID | Yes |
| `re_nameen` | Required text, 300 | Yes |
| `re_namefr` | Optional text, 300 | Yes |
| `re_typecode` | Optional text, 20 | No |
| `re_fixedtargetcmii` | Optional decimal | No |
| `statecode` | Active/Inactive | Filtered but not projected |

The fixed target CMII is not fetched or used in pricing. The app does not derive any margin merely from selecting an Equipment Type.

Source: [equipment-type model](../../src/generated/models/Re_equipmenttypesModel.ts).

### 3.5 Foreign-key/lookup relationship

The local Repair Estimate contract has:

```text
Lookup column:  re_equipmenttype
Read GUID:      _re_equipmenttype_value
Write binding:  re_EquipmentType@odata.bind
Required:       Yes, in local generated contract
```

Conceptually:

```text
Equipment Type.re_equipmenttypeid
    ^
    |
Repair Estimate.re_equipmenttype
```

Multiple estimates can reference one equipment-type record. The GUID is the foreign-key-like value, not `re_typecode`, English label, or primary-name text.

Current app behavior stops at holding that GUID in React state. No lookup payload is sent.

The inspected Equipment master model does not expose an Equipment Type lookup. Do not assume selecting Equipment Type filters equipment records or validates their type. The Estimate Equipment child has a text type snapshot, not a demonstrated reference to this master table.

Sources: [estimate model](../../src/generated/models/Re_repairestimatesModel.ts), [equipment model](../../src/generated/models/Re_equipmentsModel.ts), [child model](../../src/generated/models/Re_estimateequipmentsModel.ts).

### 3.6 Actual downstream effect

- A nonempty `equipmentTypeId` is required to advance from step 1.
- The selection contributes to unsaved-change detection.
- It does not change equipment search, package search, Job Type options, pricing, or customer details.
- It is preserved when branch or market changes.
- It is not explicitly displayed in the final review summary.

The selection is outside `RequestInputs`, so the review's reusable request/cost/pricing field groups do not automatically include it.

## 4. Job Type: Detailed Audit

### 4.1 Control

Job Type is another standard single-value HTML `<select>`.

- No required asterisk.
- Starts empty with the same placeholder.
- Choosing a record stores `jobTypeId`.
- User can return to the blank option.
- No user-entered creation, remote typeahead, or dependent filtering exists.
- Selecting Job Type does not require an Equipment Type or branch selection first once the options are loaded.

Source: [Job Type rendering](../../src/App.tsx).

### 4.2 Table and keys

| Identifier | Value |
| --- | --- |
| Logical table | `re_jobtype` |
| Entity set | `re_jobtypes` |
| Configuration alias | `jobtypes` |
| Primary ID | `re_jobtypeid` |
| Dataverse primary-name column | `re_jobtype` |
| English UI-label column | `re_jobtypeen` |
| French UI-label column | `re_jobtypefr` |
| Business code | `re_jobtypecode` |

As with Equipment Type, dropdown display uses language-label fields, not the primary-name column or business code.

Sources: [job-type schema](../../.power/schemas/dataverse/jobtypes.Schema.json), [configuration](../../power.config.json).

### 4.3 Mapping and unused columns

```text
re_jobtypeid -> option.id -> jobTypeId
re_jobtypeen -> option.en
re_jobtypefr -> option.fr
```

| Column | Local type/limit | Loaded? |
| --- | --- | --- |
| `re_jobtype` | Required text, 850 | No |
| `re_jobtypeid` | Required primary GUID | Yes |
| `re_jobtypecode` | Required text, 50 | No |
| `re_jobtypeen` | Required text, 100 | Yes |
| `re_jobtypefr` | Optional text, 100 | Yes |
| `re_rating` | Required High/Medium/Low choice | No |
| `statecode` | Active/Inactive | Filtered but not projected |

Rating choices:

- `126110000`: High.
- `126110001`: Medium.
- `126110002`: Low.

The app does not fetch the rating, derive estimate job-type bands, or calculate margins from the selection.

Source: [job-type model](../../src/generated/models/Re_jobtypesModel.ts).

### 4.4 Foreign-key/lookup relationship

The Repair Estimate contract has:

```text
Lookup column:  re_jobtype
Read GUID:      _re_jobtype_value
Write binding:  re_JobType@odata.bind
Required:       No, in local generated contract
```

Conceptually:

```text
Job Type.re_jobtypeid
    ^
    |
Repair Estimate.re_jobtype
```

`re_jobtypeband` and `re_jobtyperating` on the estimate are separate choice fields. They are not the Job Type lookup and are not auto-populated by this UI.

Source: [estimate contract](../../src/generated/models/Re_repairestimatesModel.ts).

### 4.5 Actual downstream effect

- Optional; not part of the step-one disabled condition.
- Contributes to unsaved-change detection.
- Preserved across branch/market changes and in-app navigation.
- Does not filter equipment/packages or Equipment Type options.
- No automatic reset when Equipment Type changes.
- Not explicitly shown in final review summary or reusable `RequestInputs` review sections.
- Not saved to an estimate.

## 5. Building Name: Detailed Audit

### 5.1 Source and control

Building name is manual text input, not a dropdown, combobox, building lookup, equipment lookup, or queried master-data field.

```text
User types in Opportunity details
    -> setBuildingName(event.target.value)
    -> buildingName state
    -> same value appears in Review
```

Initial value is empty. The app does not derive it from:

- Selected branch.
- Equipment functional location.
- Equipment name.
- Customer name.
- Existing estimate.
- A building/address API.

Source: [building controls](../../src/App.tsx).

### 5.2 Two controls, one state variable

| Screen | Input ID | State | Constraints |
| --- | --- | --- | --- |
| Opportunity details | `opportunity-building` | `buildingName` | `maxLength=300`; visible required marker |
| Final review | `building-name` | Same `buildingName` | No `maxLength`; no HTML `required` |

Editing review changes the original opportunity value, not a separate confirmation copy.

### 5.3 Validation details

- Step 1 requires `buildingName.trim()` to be nonempty.
- Whitespace-only input cannot advance from step 1.
- Trimming is only used for this check; the actual stored string remains untrimmed.
- There is no uniqueness or duplicate-building check.
- There is no address resolution or format check.
- Neither input has an HTML `required` attribute.
- The footer calls `reportValidity()` on inputs before advancing steps 1-4, but the building requirement itself is also separately enforced by the button gate.
- Final review has no enabled submit action to validate the edited name.

**Observed validation gap:** Review can clear the value or enter more than 300 characters, although step 1 and the local estimate schema expect a nonblank/required name and the schema allows only 300 characters. Current writes are blocked, but a future save implementation must address this consistently.

### 5.4 Dataverse destination and relationship meaning

Related estimate column:

```text
Table:      re_repairestimate
Column:     re_buildingname
Type:       String
Required:   Yes, in local contract
Max length: 300
```

This is a scalar text column, not a foreign key. No Building table relationship is established by this input.

Other generated columns such as building city/address and Building Province/State are separate fields and are not populated from this name.

Sources: [estimate schema](../../.power/schemas/dataverse/repairestimates.Schema.json), [estimate model](../../src/generated/models/Re_repairestimatesModel.ts).

### 5.5 Existing estimate lists are a different data path

Existing record lists read `re_buildingname` from Dataverse, display it on request cards, and include it in server-side prefix search.

That does not connect the current typed building name to those records:

```text
New request:
  Manual input -> React buildingName -> unsaved review

Existing request list:
  Dataverse re_buildingname -> summary query -> request card
```

No existing estimate is updated by changing the opportunity input.

Sources: [query builder](../../src/data/estimateQuery.ts), [EstimateList](../../src/EstimateList.tsx).

## 6. Salesperson: Detailed Audit

### 6.1 Control and source

Salesperson is a read-only text input labelled Salesperson (signed-in user).

It is not:

- A dropdown of users.
- A custom user-picker combobox.
- A salesperson-directory query.
- A branch-assigned salesperson selector.
- An editable on-behalf-of field.

Its immediate source is:

```text
getContext()
  -> context.user.fullName
  -> loadSession(): displayName = fullName ?? ''
  -> session.displayName
  -> read-only salesperson input
```

Sources: [session repository](../../src/data/sessionRepository.ts), [salesperson rendering](../../src/App.tsx).

### 6.2 Identity fields must not be confused

| Context value | Application use |
| --- | --- |
| `fullName` | Visible salesperson/sidebar name; preference name on create/backfill |
| `systemUserId` | Dataverse identity, stored as `session.userId`; privilege queries and preference User binding |
| `objectId` | Entra directory identity used for role discovery |

The display name is not a foreign key and is not guaranteed unique.

The repository requires both identity IDs to be present. It does not require a nonempty `fullName`. A valid identity with missing name can therefore yield a blank salesperson field.

No user table is queried separately to recover a missing name or verify user status/branch assignment for this display.

### 6.3 Related estimate lookup

The generated Repair Estimate contract contains:

```text
Lookup column:  re_salesperson
Read GUID:      _re_salesperson_value
Write binding:  re_Salesperson@odata.bind
Required:       Yes, in local generated contract
```

The current UI intends the signed-in user to be the salesperson, but does not build or send that lookup binding.

The available `session.userId` is the linked Dataverse user ID, whereas the read-only name is only presentation. A future mapper must verify the live Salesperson lookup target/entity set and bind the proper ID, not the name or Entra object ID.

The app configuration registers `systemusers` for users. The local estimate column export exposes the Salesperson navigation name but does not by itself prove the lookup's target relationship metadata.

Sources: [estimate model](../../src/generated/models/Re_repairestimatesModel.ts), [estimate schema](../../.power/schemas/dataverse/repairestimates.Schema.json), [configuration](../../power.config.json).

### 6.4 Salesperson is not automatically the owner or creator

These are separate concepts:

- Salesperson: explicit business lookup on the estimate.
- Owner: Dataverse ownership/security field.
- Created by: platform audit identity.
- Signed-in user: current player identity.

The UI does not prove these would all be the same person on a future saved record. There is no current estimate-create request or ownership assignment.

An Admin role does not enable salesperson impersonation; the field remains read-only.

### 6.5 Other uses of the same identity data

- Sidebar shows `session.displayName`, using a workspace-label fallback if empty.
- Salesperson input uses an empty-string fallback instead.
- Preference initialization uses display name, otherwise user ID, truncated to 200 characters for preference `re_name`.
- Preference creation binds `re_User@odata.bind` to `/systemusers(<userId>)`.

That preference binding is an actual enabled write path. It is not a saved estimate Salesperson association.

Sources: [preference initialization](../../src/data/userPreferences.ts), [App sidebar and input](../../src/App.tsx).

### 6.6 Loading, access, and lifetime

- Session load obtains identity, resolves app role, and checks estimate capabilities.
- New Request is gated by effective estimate Read plus Create.
- Session failure shows an access error and Retry rather than exposing an editable salesperson fallback.
- Development Admin override changes role discovery, not the signed-in identity/name.
- No periodic identity refresh or on-behalf-of user switching is implemented.
- Branch/market changes do not replace salesperson.
- Salesperson itself does not mark the request dirty; it is derived session display.

## 7. Relationship and Dependency Map

```text
Equipment Type master -- GUID lookup --> Repair Estimate.Equipment Type
Job Type master       -- GUID lookup --> Repair Estimate.Job Type
User identity         -- intended lookup --> Repair Estimate.Salesperson
Manual building text  -- intended scalar --> Repair Estimate.Building Name

Current implementation:
  All four estimate destinations above remain unwritten.

Actual enabled identity write:
  User identity --> App User Preference.User
```

No current query merges Equipment Type with Job Type or Building/Salesperson data.

Among the inspected exports, Repair Estimate exposes the Equipment Type and Job Type lookup columns. A full inventory of other live referencing tables requires live relationship metadata.

The two master tables' generated models include standard owner, business-unit, creator/modifier, and audit references. They do not expose a direct business lookup from Equipment Type to Job Type or vice versa.

## 8. State, Reset, and Review Matrix

Source: [App state and handlers](../../src/App.tsx).

| Action | Equipment Type | Job Type | Building name | Salesperson |
| --- | --- | --- | --- | --- |
| Initial mount | Blank | Blank | Blank | Session-derived |
| Select another branch | Preserved | Preserved | Preserved | Unchanged |
| Select another market | Preserved | Preserved | Preserved | Unchanged |
| Change Equipment Type | New selected ID | Preserved | Preserved | Unchanged |
| Change Job Type | Preserved | New selected ID | Preserved | Unchanged |
| Change UI language | Label translated/fallback; ID preserved | Label translated/fallback; ID preserved | User text unchanged | Host name unchanged |
| In-app Dashboard/Requests navigation | Preserved | Preserved | Preserved | Session persists |
| Click New Request again | Retained; step resets to 1 | Retained | Retained | Same session |
| Edit Building at review | Preserved | Preserved | Same state updated | Unchanged |
| Reload app | Selection lost | Selection lost | Input lost | Obtained again from host |

Nonempty Equipment Type, Job Type, or Building name contributes to unload-warning detection. This warning is not draft persistence.

### Review visibility

- Building name appears as an editable review field.
- Equipment Type and Job Type do not have dedicated labels/values in the final summary.
- Salesperson does not have a dedicated review-summary entry.
- The reusable read-only `RequestFields` sections do not include these four top-level fields.

Consequently, the final review is not a complete visual restatement of all opportunity selections.

## 9. Findings and Open Questions

| ID | Finding | Consequence |
| --- | --- | --- |
| F01 | Both reference tables share an all-or-nothing load | One inaccessible/oversized list prevents use of both dropdowns |
| F02 | Continuation tokens are rejected, not followed | Large reference tables need paging support before complete display |
| F03 | No cross-field compatibility filtering | Equipment Type/Job Type can be selected independently of branch, market, units, and packages |
| F04 | Equipment Type changes do not clear selected units/packages | Existing selections can remain despite a changed requested type; no compatibility check runs |
| F05 | Equipment Type CMII and Job Type rating are not loaded | No pricing/rating derivation from these selections |
| F06 | Building validation differs between opportunity and review | Review can clear a required value or exceed 300 characters |
| F07 | Salesperson full name may be absent | Valid identity can yield a blank read-only field |
| F08 | Type/Job/Salesperson omitted from explicit final summary | Reviewer cannot confirm all opportunity values from that summary |
| F09 | No estimate payload or lookup mapper exists | Captured IDs/names are not persisted estimate relationships |
| F10 | IDs are retained through branch/market changes | Intended cross-market/type compatibility needs business confirmation |
| F11 | Live lookup targets and full incoming relationships unverified | Do not invent relationship target names or claim complete environment coverage |

### Live/business verification still needed

1. Confirm intended Equipment Type and Job Type catalogs, uniqueness, labels, active status, and permissions.
2. Confirm whether reference options should vary by market/branch/country.
3. Confirm whether Job Type should depend on Equipment Type.
4. Confirm whether selected Equipment Type must match selected units/packages.
5. Confirm target entities/navigation metadata for estimate lookups, especially Salesperson.
6. Confirm whether salesperson must always be the signed-in user or support authorized on-behalf-of creation.
7. Define building text normalization and consistent validation for every entry/review surface.
8. Decide how master-table rating/CMII configuration should participate in authoritative server calculations.
9. Define complete review and future save mapping, including required fields and lookup IDs.

## 10. Verification Notes and Related Audits

This audit was grounded in direct source reads and structured extraction of local schema identifiers, types, required flags, navigation names, and lengths.

Documentation-only work does not establish new runtime test coverage. Existing master-audit build/lint/test results are historical evidence, not live validation of these controls.

Related documents:

- [Branch Audit](BRANCH_AUDIT.md).
- [Master Application Audit](../../MASTER_APPLICATION_AUDIT.md).

**Conclusion:** Equipment Type and Job Type are two independent Dataverse-backed native dropdowns. Building name is manual shared opportunity/review text. Salesperson is the authenticated user's read-only display, not a user picker. None of the four is currently persisted to a newly created Repair Estimate.
