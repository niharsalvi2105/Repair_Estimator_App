# Opportunity Details Audit: Customer Budget, Paper Type, and Consultant Involvement

**Audit date:** 2026-10-24  
**Scope:** Customer budgeted for repair, KONE paper/customer paper, and Consultant involved.  
**Method:** Direct source inspection and extraction of local Dataverse schema metadata.  
**Changes:** Documentation only. No application code or live data changed.  
**Evidence boundary:** No authenticated live record/metadata queries, browser interaction tests, or server workflow inspection were performed.

## 1. Summary

| Question | Customer budgeted for repair? | KONE paper / customer paper | Consultant involved? |
| --- | --- | --- | --- |
| UI type | Native select dropdown | Native select dropdown | Native select dropdown |
| Searchable combobox? | No | No | No |
| Source | Generated Choice definition | Generated Choice definition | Generated Choice definition |
| Choices | Yes / No | Customer Paper / Kone Paper / NA | Yes / No |
| Initial answer | Blank | Blank | Blank |
| Required by UI? | No | No | No |
| Related estimate column | `re_customerbudgeted` | `re_papertype` | `re_consultantinvolved` |
| Local Dataverse type | Optional Picklist | Optional Picklist | Optional Picklist |
| Foreign key? | No | No | No |
| Saved now? | No | No | No |

All three are scalar Choice attributes on Repair Estimate, not lookups to a budget, contract, or consultant record.

Sources: [field definitions and renderer](../../src/RequestFields.tsx), [estimate model](../../src/generated/models/Re_repairestimatesModel.ts), [estimate schema](../../.power/schemas/dataverse/repairestimates.Schema.json).

## 2. Shared Source and Data Flow

The controls belong to the reusable `requestFields` group rendered during Opportunity details.

```text
Local generated estimate model
    -> imported numeric-to-label Choice objects
    -> native select options
    -> user chooses an option
    -> event.target.value string
    -> updateRequestInput(fieldKey, value)
    -> App.requestInputs
    -> same values shown disabled in Review
    -> no estimate-save operation
```

### What data is fetched?

No runtime reference-table query populates these options.

- The options ship in the application bundle as generated metadata.
- No budget/account/contract/consultant records are joined.
- No live Choice-metadata request runs when a dropdown opens.
- A live Choice change does not automatically update an already-deployed bundle.

### How the answers are stored

`RequestInputs` is a partial map of input keys to strings:

```text
requestInputs.re_customerbudgeted
requestInputs.re_papertype
requestInputs.re_consultantinvolved
```

The state starts as `{}`. Untouched values render as empty strings. Selecting a numeric code stores its string representation, not a number or boolean.

The generic update handler only copies the previous state and replaces the selected key. It does not validate business rules, parse codes, fetch related data, or calculate prices.

Sources: [RequestInputs](../../src/RequestFields.tsx), [App state and update handler](../../src/App.tsx).

## 3. Customer Budgeted for Repair?

### 3.1 Control

| Property | Current implementation |
| --- | --- |
| English label | Customer budgeted for repair? |
| Input ID | `request-re_customerbudgeted` |
| Type | Standard HTML select |
| Placeholder | Select an option, translated for French |
| Initial answer | Blank |
| Required attribute | Not set |
| Unknown option | Not present |

The input asks whether the customer has budgeted for the repair. It does not capture a monetary budget.

### 3.2 Exact options

| Answer | Choice code | Stored state string |
| --- | --- | --- |
| Yes | `126110000` | `"126110000"` |
| No | `126110001` | `"126110001"` |
| Unanswered | No code | `""` |

Blank does not mean No. No default is initialized from customer data or the live column's possible default.

### 3.3 Dataverse contract

| Identifier | Local contract |
| --- | --- |
| Logical table | `re_repairestimate` |
| Entity set | `re_repairestimates` |
| Column | `re_customerbudgeted` |
| Schema name | `re_CustomerBudgeted` |
| Display title | Customer Budgeted |
| Dataverse type | `PicklistType` |
| Generated declaration | Optional numeric-choice union |
| Formatted read label | `re_customerbudgetedname` |
| Global Choice name | `yesno` |

This is not a Boolean column in the inspected schema, even though its answers are Yes/No.

Source: [local estimate schema](../../.power/schemas/dataverse/repairestimates.Schema.json).

### 3.4 What is not connected

Selecting Yes/No does not:

- Query or validate a customer's budget.
- Identify a customer/account.
- Record a budget amount, fiscal year, currency, or funding approval.
- Compare budget to entered sell price.
- Restrict packages, labor, or equipment.
- Change approval requirements, priority, or margins.
- Prove that funding is available.

The answer is a user-declared indication only.

## 4. KONE Paper / Customer Paper

### 4.1 Correct field interpretation

The user-facing label refers to one **Paper Type** Choice field, not a KONE-paper boolean and not two independent controls.

| Property | Current implementation |
| --- | --- |
| UI label | KONE paper / customer paper |
| Input ID | `request-re_papertype` |
| Type | Native select |
| Initial answer | Blank |
| Required | No |
| File-upload input | None |

### 4.2 Exact choices and order

| Choice code | Generated English label | French display meaning |
| --- | --- | --- |
| `126110000` | Customer Paper | Customer contract |
| `126110001` | Kone Paper | KONE contract |
| `126110002` | NA | Not applicable |

The placeholder comes first, followed by Customer Paper, Kone Paper, and NA. The label mentions KONE first, but the numeric option ordering places Customer Paper first.

**NA is a selected answer, not an empty value.** The French dictionary renders it as not applicable. The code contains no fuller business definition or conditions for choosing it.

Sources: [generated Paper Type map](../../src/generated/models/Re_repairestimatesModel.ts), [translation map](../../src/RequestFields.tsx).

### 4.3 Dataverse contract

| Identifier | Local contract |
| --- | --- |
| Column | `re_papertype` |
| Schema name | `re_PaperType` |
| Type | Optional Picklist |
| Global Choice display name | Paper Type |
| Formatted read label | `re_papertypename` |

This is not a lookup to a document/template/contract table.

### 4.4 No document or legal workflow

Selecting an option does not:

- Upload, retrieve, attach, generate, or sign a document.
- Select a contract-template record.
- Display terms and conditions.
- Verify whether a signed agreement exists.
- Trigger legal review or approval.
- Change proposal language or billing plan.
- Apply a margin adjustment.
- Produce a quote.

The wording and French labels suggest contract-paper classification. They do not establish an implemented legal document workflow.

### 4.5 Organization

- All markets see the same choices.
- No branch, customer, national-account, job-type, or consultant filter exists.
- No conditional explanation is requested for Customer Paper or NA.
- Choice codes remain unchanged when UI language changes.
- The app does not enforce a documented prerequisite between Paper Type and Has it been approved.

## 5. Consultant Involved?

### 5.1 Control and options

| Property | Current implementation |
| --- | --- |
| English label | Consultant involved? |
| Input ID | `request-re_consultantinvolved` |
| Type | Native select |
| Choices | Yes / No |
| Initial answer | Blank |
| Required | No |
| Unknown option | Not present |

Codes:

- `126110000`: Yes.
- `126110001`: No.

The selected code is held as a string.

### 5.2 Dataverse contract

| Identifier | Local contract |
| --- | --- |
| Column | `re_consultantinvolved` |
| Schema name | `re_ConsultantInvolved` |
| Display title | Consultant Involved |
| Type | Optional Picklist |
| Global Choice name | `yesno` |
| Formatted read label | `re_consultantinvolvedname` |

The local metadata shows this and Customer Budgeted share the same global Yes/No Choice definition. They are still independent columns and answers.

### 5.3 Not a consultant relationship

This field does not select or verify:

- A consultant person/company.
- A contact or account.
- Consultant email/phone.
- A contract, fee, or scope.
- An assigned reviewer or approver.

There is no Consultant lookup binding for this control.

Selecting Yes does not send notifications, create access, require a consultant name, adjust pricing, change paper type, or create an approval task.

The code records only request-level declared involvement, not the identity or role of any consultant.

## 6. Choice Codes, Booleans, and Formatted Labels

Important distinctions for any future implementation:

1. Yes/No columns here are Picklists, not booleans.
2. Both Yes and No strings are nonempty/truthy; `Boolean(value)` would not interpret the answer correctly.
3. Code meanings depend on the field. `126110001` means No in the Yes/No fields, but Kone Paper in Paper Type.
4. Blank is distinct from No and from NA.
5. Generated `...name` properties are formatted read-side labels, not the input/write columns.
6. A global Choice is reusable metadata, not a foreign-key relationship or merged data table.
7. Matching a state key to a Dataverse column name does not automatically persist it.

A future save mapper must explicitly validate/convert string codes and define blank/null behavior.

## 7. Validation, Dependencies, and Review

Source: [App wizard and review](../../src/App.tsx).

### Current validation

- None has a visible required asterisk.
- None has an HTML `required` attribute.
- None is included in the step-one Continue disabled condition.
- The footer's validity loop checks `input` elements, not these selects.
- No cross-field business validation exists.
- Blank selections do not block progression.

Step-one required gating remains Branch, nonblank Building name, and Equipment Type.

### Current dependencies

None of these answers:

- Filters reference data, equipment, or packages.
- Changes another answer.
- Sets a default elsewhere.
- Calculates margins/incentives or price.
- Alters navigation permissions.
- Triggers server workflow.

These values are not selected by the existing estimate-summary query or loaded from an existing estimate-detail record into the workspace.

### Review

All three appear in the expandable request-details section at review through the same `RequestFields` component.

The selects are disabled in review. Their values are the same state, not a saved snapshot.

## 8. State Lifetime and Reset Behavior

| Action | Behavior for all three |
| --- | --- |
| Initial mount | Unanswered |
| Branch change | Retained |
| Market change | Retained |
| Equipment Type/Job Type change | Retained |
| Equipment/package selection change | Retained |
| UI language change | Labels translated; answer codes retained |
| Wizard Back/Continue | Retained |
| In-app dashboard/request navigation | Retained |
| Click New Request again | Retained; step resets to 1 |
| Actual reload/unload | Lost |

Nonempty answer strings, including No and NA, contribute to unsaved-change detection. The browser warning is not persistence or recovery.

No estimate-create/update request currently sends these answers to Dataverse.

## 9. Findings and Live/Business Verification Gaps

| ID | Finding | Consequence |
| --- | --- | --- |
| B01 | Budget is declared, not verified | Cannot conclude funding exists or an amount is sufficient |
| B02 | Paper Type is classification only | Cannot conclude a document is present, approved, or signed |
| B03 | Consultant involvement has no identity | Cannot identify, notify, or authorize a consultant |
| B04 | All three allow blank | Mandatory business rules, if intended, are not implemented |
| B05 | Picklist strings may look boolean-like | Future consumers must compare explicit field-specific codes |
| B06 | No cross-field or pricing logic | These answers currently have no operational effect beyond review |
| B07 | Values retained across context changes | No compatibility revalidation after branch/market changes |
| B08 | Choices are bundled generated metadata | Live metadata changes need supported regeneration/release |
| B09 | No direct field-specific tests found | Existing policy tests do not verify these controls |
| B10 | Estimate saving is unconnected | Answers are not persisted business records |

Recommended follow-up requirements/live checks:

1. Confirm whether each answer must be mandatory before saving/submission.
2. Define blank versus No versus NA semantics.
3. Decide whether customer budget requires an amount, currency, or evidence.
4. Define the exact business meaning and permitted use of each Paper Type option.
5. Confirm whether Customer Paper requires legal/document review.
6. Decide whether consultant identity/contact should be captured separately.
7. Define any server-authoritative price/approval effects rather than inferring them from labels.
8. Verify live option values, defaults, requiredness, permissions, and workflow rules.

## 10. Verification and Related Documentation

- Read exact definitions and generic select rendering.
- Searched all application TypeScript/TSX references to these keys.
- Extracted local schema type, option codes, global Choice identity, and optionality.
- Searched existing tests; no direct references to these three fields were found.
- No runtime write, workflow execution, dependency installation, or source change performed.
- Documentation-only creation did not require rerunning build/lint/tests.

Related documents:

- [Branch Audit](BRANCH_AUDIT.md).
- [Equipment Type, Job Type, Building, and Salesperson](EQUIPMENT_TYPE_JOB_TYPE_BUILDING_SALESPERSON_AUDIT.md).
- [Supervisor, Work-centre Request, and Technicians](SUPERVISOR_WORK_CENTER_TECHNICIANS_AUDIT.md).
- [Approval, National Account, Emergency, and Subcontractor Cost](APPROVAL_NATIONAL_ACCOUNT_EMERGENCY_SUBCONTRACT_COST_AUDIT.md).
- [Master Application Audit](../../MASTER_APPLICATION_AUDIT.md).

**Conclusion:** These are three optional native dropdowns populated from generated Dataverse Choice definitions. They capture budget indication, paper classification, and consultant involvement only; they do not resolve related records, verify evidence, trigger workflow, calculate pricing, or save an estimate.
