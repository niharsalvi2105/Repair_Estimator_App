# Opportunity Details Audit: Supervisor, Work-centre Request, and Number of Technicians

**Audit date:** 2026-10-24  
**Method:** Direct source inspection and local generated-schema inspection.  
**Scope:** Current UI, input lineage, validation, relationship meaning, downstream behavior, and persistence.  
**Changes:** Documentation only. No application code or live Dataverse records changed.

## 1. Summary

| Detail | Supervisor | Work-centre request | Number of technicians |
| --- | --- | --- | --- |
| Control | Editable text input | Native select dropdown | Numeric input |
| Source | User entry | Locally generated Dataverse choice values | User entry |
| Initial value | Blank | Blank | Blank |
| Request state key | `re_supervisor` | `re_workcenterrequest` | `re_numberoftechs` |
| Current state type | String | String containing choice code | String containing numeric input |
| Related Dataverse table | Repair Estimate, `re_repairestimate` | Same | Same |
| Dataverse column type | Text | Choice/Picklist | Integer |
| Required in local estimate contract? | No | No | No |
| Required by current wizard? | No | No | No |
| Foreign key/lookup? | No | No | No |
| Main constraint | Maximum 100 characters | Blank, Route, or Repair through normal UI | Blank or whole number 1-3 through browser validation |
| Saved/calculated/routed? | No | No | No |

Sources: [RequestFields](../../src/RequestFields.tsx), [application state and wizard](../../src/App.tsx), [estimate model](../../src/generated/models/Re_repairestimatesModel.ts), [estimate schema](../../.power/schemas/dataverse/repairestimates.Schema.json).

**Key distinction:** All three are estimate attributes, not lookups to supervisor, work-center, or technician master records.

## 2. Shared Data Flow

All three fields belong to the `requestFields` group rendered with `stage="request"` during Opportunity details.

```text
RequestFields field definition
    |
    v
Input/select rendered with current requestInputs[key] or ''
    |
    v
User changes the control
    |
    v
onChange(key, event.target.value)
    |
    v
App.updateRequestInput(key, value)
    |
    v
setRequestInputs(previous => ({ ...previous, [key]: value }))
    |
    v
Same state shown read-only in Review
    |
    v
No estimate-save connection
```

`RequestInputs` is a partial record of defined input keys to strings. Initially it is `{}`.

- Untouched keys are absent and rendered as blank using `?? ''`.
- Clearing a previously edited field can leave the key present with `''`.
- Numeric controls do not convert values to numbers.
- Choice controls do not convert option values to numeric choice codes.
- The generic change handler performs no trimming, parsing, schema validation, lookup resolution, or calculation.
- No standalone network request runs when any of these three values changes.

Sources: [RequestInputs and rendering](../../src/RequestFields.tsx), [updateRequestInput](../../src/App.tsx).

## 3. Supervisor

### 3.1 Control and labels

Supervisor is an editable text input.

| Item | Value |
| --- | --- |
| English label | Supervisor (optional) |
| French label | Superviseur (facultatif) |
| Input ID | `request-re_supervisor` |
| Input type | `text` |
| Maximum length | 100 characters |
| Required attribute | Not set |
| Default | Blank |

The 100-character limit comes from the shared renderer's default for fields without an explicit type or custom maximum length. It matches the local column length.

Source: [Supervisor definition and input renderer](../../src/RequestFields.tsx).

### 3.2 Where the value comes from

The user types the value manually.

It is not:

- Loaded from the signed-in user's manager profile.
- Inherited from the selected branch.
- Retrieved from a Dataverse user table.
- Selected from a supervisor dropdown.
- Checked against an employee directory.
- Auto-filled from the Salesperson field.

The local Dataverse display title is **Supervisor's Name / ID**. The UI does not distinguish a name from an ID or enforce either format.

### 3.3 Dataverse column and relationship

| Property | Local contract |
| --- | --- |
| Logical table | `re_repairestimate` |
| Entity set | `re_repairestimates` |
| Column | `re_supervisor` |
| Schema name | `re_Supervisor` |
| Dataverse type | `StringType` |
| TypeScript declaration | `re_supervisor?: string` |
| Length | 100 |

This is scalar text, not a lookup. There is no Supervisor GUID, `@odata.bind`, or incoming supervisor-master relationship established by this field.

Sources: [estimate model](../../src/generated/models/Re_repairestimatesModel.ts), [schema](../../.power/schemas/dataverse/repairestimates.Schema.json).

### 3.4 Validation and downstream behavior

- Blank is allowed.
- Whitespace-only text is also allowed; the handler does not trim it.
- No name/ID format, existence, uniqueness, active-user, or branch-assignment check runs.
- Entering a name does not assign work, grant access, designate an approver, or send a notification.
- It does not affect pricing, equipment/package queries, or technician count.
- It appears in the review's expandable request-details section as read-only text.
- No request record is currently saved.

**Consequence:** Do not treat this value as a verified supervisor identity or authorization decision.

## 4. Work-centre Request

### 4.1 Control

This is a standard HTML `<select>`, not the custom Branch combobox.

| Item | Value |
| --- | --- |
| English label | Work-centre request |
| French label | Centre de travail demande, rendered with the source's French accents |
| Input ID | `request-re_workcenterrequest` |
| Initial placeholder | Select an option / Choisir une option |
| Required attribute | Not set |
| Free-text entry | Not supported |
| Blank selection | Allowed |

Exact accented labels are maintained in the [source component](../../src/RequestFields.tsx); this document uses ASCII descriptions.

### 4.2 Where options come from

The component imports the generated `Re_repairestimatesre_workcenterrequest` choice object.

| Stored choice code | English label | French display |
| --- | --- | --- |
| `126110000` | Route | Tournee, rendered with the source accent |
| `126110001` | Repair | Reparation, rendered with the source accent |
| Empty string | Placeholder | Placeholder |

The browser receives the selected option as a string such as `"126110001"`.

These options are not fetched from a work-center table at runtime. They are generated metadata values shipped with the application bundle.

The local schema identifies a **global Choice** with display name `workcenter request choice`. Global Choice does not mean a separate relational table or a foreign-key lookup.

Sources: [generated choice](../../src/generated/models/Re_repairestimatesModel.ts), [local picklist metadata](../../.power/schemas/dataverse/repairestimates.Schema.json), [French choice map](../../src/RequestFields.tsx).

### 4.3 Dataverse contract

| Property | Local contract |
| --- | --- |
| Column | `re_workcenterrequest` |
| Schema name | `re_WorkCenterRequest` |
| Type | Picklist/Choice |
| Generated type | Optional union of the two numeric codes |
| Formatted read label | `re_workcenterrequestname` |

`re_workcenterrequestname` is a generated read-only formatted label, not the input field or a write target.

### 4.4 Work Center Request is not Work Center

The estimate model contains a separate field:

```text
re_workcenter
  Dataverse type: String
  Local display title: Work Center
  Maximum length: 100
  Optional
```

The current control edits `re_workcenterrequest`, not `re_workcenter`.

There is no implemented rule that converts Route/Repair into an actual work-center code, fills `re_workcenter`, or selects an operational team.

### 4.5 Organization and downstream effect

- There are two fixed choices, not separate per-market lists.
- No branch, country, market, job-type, equipment-type, or salesperson filter is applied.
- Choosing Route/Repair does not filter equipment/packages.
- It does not change supervisor or technician count.
- It does not allocate work, trigger approval, or send a request to another system.
- Changing UI language changes labels, not the selected code.
- Review displays the same select disabled.
- A future save mapper must validate and convert the string to the supported numeric choice value, with explicit empty-value semantics.

The operational meaning of Route versus Repair beyond their labels is not defined by executable workflow in this repository.

## 5. Number of Technicians

### 5.1 Control and constraints

| Item | Value |
| --- | --- |
| English label | Number of technicians |
| French label | Nombre de techniciens |
| Input ID | `request-re_numberoftechs` |
| Type | `number` |
| Minimum | 1 |
| Maximum | 3 |
| Step | 1 |
| Required attribute | Not set |
| Initial/default value | Blank; not automatically 1 |

The field definition supplies `integer: true` and `max: 3`. The shared renderer translates those into `min=1`, `max=3`, and `step=1`.

Source: [numeric field definition and renderer](../../src/RequestFields.tsx).

### 5.2 Source and meaning

The user enters a count. It is not:

- A list of named technicians.
- A lookup to technician records.
- A staffing-availability query.
- Derived from equipment quantity or package count.
- Defaulted from branch, job type, or work-centre request.

Entering 3 means only that the unsaved field contains a technician count. It does not assign three users.

### 5.3 Dataverse contract

| Property | Local contract |
| --- | --- |
| Column | `re_numberoftechs` |
| Schema name | `re_NumberofTechs` |
| Display title | Number of Techs |
| Dataverse type | `IntegerType` |
| TypeScript declaration | `re_numberoftechs?: number` |
| Required | No |

The local exported column metadata does not expose numeric min/max bounds. Therefore, **1-3 is confirmed as a browser/UI rule, not a verified live Dataverse constraint**.

Sources: [estimate schema](../../.power/schemas/dataverse/repairestimates.Schema.json), [model](../../src/generated/models/Re_repairestimatesModel.ts).

### 5.4 What validation actually does

When advancing from wizard steps 1-4, the footer finds `input` elements in the request section and calls `reportValidity()`.

Expected browser constraint behavior for this control:

| Input | Expected validity under current attributes |
| --- | --- |
| Blank | Valid because not required |
| 1, 2, 3 | Valid |
| 0 or negative | Invalid: below minimum |
| 4 or greater | Invalid: above maximum |
| 1.5 | Invalid: step mismatch |
| Invalid numeric text | Subject to native number-input behavior and bad-input validation |

These are HTML constraint semantics established from source, not a browser test executed for this audit.

Important nuances:

- The input attributes do not necessarily prevent every temporarily invalid edit; validity is checked on Continue.
- The handler stores strings and does not parse, clamp, round, or reject changes.
- A visually enabled Continue button can still fail its click-time `reportValidity()` check.
- Empty count does not disable Continue.
- Inapp navigation/Back is not a save or complete validation boundary.
- There is no server-side numeric enforcement implemented in this repository's browser code.

Source: [wizard footer validation](../../src/App.tsx).

### 5.5 No labor calculation

Technician count currently does not:

- Multiply package mechanic hours.
- Determine labor hours or labor cost.
- Calculate duration.
- Allocate named staff.
- Change pricing, margins, incentives, tax, or freight.
- Restrict package choices.

The value is captured and shown in read-only review. Authoritative calculation is not connected.

## 6. Persistence, Review, and Reset Behavior

Sources: [App state/reset/review](../../src/App.tsx), [read-only rendering](../../src/RequestFields.tsx).

| Action | Behavior for all three fields |
| --- | --- |
| Initial app mount | Blank because `requestInputs={}` |
| Branch change | Values retained |
| Market change | Values retained |
| Equipment Type or Job Type change | Values retained |
| Equipment/package add/remove | Values retained |
| Change UI language | Labels translated; entered supervisor/count and selected code retained |
| Back/forward wizard navigation | Values retained |
| Dashboard/Repair Requests navigation | Values retained in mounted App |
| New Request clicked again | Step resets to 1; prior values retained |
| Review | Same state, not a copied snapshot |
| Reload/actual page unload | Request inputs lost |
| Final action | Disabled; no estimate write |

Review places these fields in an expandable request-details section:

- Supervisor and technician input receive `readOnly`.
- Work-centre select receives `disabled`.
- They are not editable through those review controls.

Any truthy `requestInputs` value contributes to the browser unload warning. Supervisor whitespace and numeric string values are truthy; an empty string is not. The warning does not persist or recover data.

## 7. Relationships and Source-of-truth Distinctions

```text
Supervisor:
  Typed text -> requestInputs.re_supervisor
  -> intended Repair Estimate text column
  -> no supervisor-master lookup

Work-centre request:
  Generated choice metadata -> Route/Repair selection
  -> requestInputs.re_workcenterrequest
  -> intended Repair Estimate choice column
  -> no work-center-table lookup

Number of technicians:
  Typed number -> string in requestInputs.re_numberoftechs
  -> intended Repair Estimate integer column
  -> no technician-record relationship
```

There is no multi-table merge, reference query, or foreign-key assignment for these controls. Their keys align with estimate columns, but this does not create automatic Dataverse binding.

No existing-estimate detail record is loaded into these controls. Existing summary lists do not select these three fields.

## 8. Findings and Follow-up Questions

| ID | Finding | Consequence |
| --- | --- | --- |
| T01 | Supervisor is unverified free text | Cannot be used as proof of manager identity or approval authority |
| T02 | Work-centre request is a static generated Choice | Live choice changes require appropriate regeneration/deployment to reach this UI |
| T03 | Request and actual Work Center are separate columns | Selecting Route/Repair does not establish a real work-center assignment |
| T04 | Technician count remains a string | Future writes need explicit integer parsing/validation and empty semantics |
| T05 | Count maximum 3 is only verified in UI | Live schema/business rules must confirm matching limits |
| T06 | All three allow blank | If the business expects mandatory staffing/routing data, current form does not enforce it |
| T07 | Values retained across branch/market changes | Supervisor/routing/count compatibility is not revalidated |
| T08 | No calculation or routing consumes these fields | Capturing them does not perform work allocation or pricing |
| T09 | No direct existing tests for these controls were found | Build/policy tests do not establish field-specific UI behavior |
| T10 | No estimate persistence | Review is an unsaved preview, not a submitted work request |

### Live/business decisions still needed

1. Should Supervisor remain free text, or identify a verified user/employee?
2. Should Work-centre request depend on branch/market or map to an actual work-center identifier?
3. Is technician count optional, or must operational requests require it?
4. Is 1-3 the authoritative rule across every market/work type?
5. Should technician count affect hours, elapsed duration, or labor cost, and where is that server rule defined?
6. Should changing branch clear/revalidate supervisor or requested work-center values?
7. What are the approved blank/null/default semantics when saving?

These are follow-up questions for requirements/live verification, not assumptions implemented by this audit.

## 9. Verification and Related Documents

- Verified field declarations, generic renderer, generated choice values, local schema attributes, application state, reset handlers, and review/Continue behavior.
- Searched existing test files; no direct references/tests for Supervisor, Work-centre request, or technician count were found.
- No live metadata refresh, backend writes, browser validity tests, or pricing verification performed.
- Documentation-only work did not require rerunning the application build/test suite.

Related documents:

- [Branch Audit](BRANCH_AUDIT.md).
- [Equipment Type, Job Type, Building, and Salesperson Audit](EQUIPMENT_TYPE_JOB_TYPE_BUILDING_SALESPERSON_AUDIT.md).
- [Master Application Audit](../../MASTER_APPLICATION_AUDIT.md).

**Conclusion:** Supervisor is optional unverified text, Work-centre request is an optional generated Route/Repair choice, and Number of technicians is an optional numeric input constrained to whole values 1-3 by the browser. None currently performs a lookup assignment, staffing action, routing operation, labor calculation, or saved estimate update.
