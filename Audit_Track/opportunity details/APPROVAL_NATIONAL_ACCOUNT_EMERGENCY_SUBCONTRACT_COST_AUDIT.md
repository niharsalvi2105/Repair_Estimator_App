# Opportunity Details Audit: Approval Indication, National Account, Emergency, and Subcontractor Cost

**Audit date:** 2026-10-24  
**Scope:** Current controls, sources, generated Dataverse contracts, state, validation, dependencies, review, and persistence.  
**Method:** Direct application-source reads, local schema extraction, and targeted searches.  
**Changes:** Documentation only. No application code or live data changed.  
**Evidence limit:** No authenticated Dataverse queries, server workflow inspection, or browser interaction tests performed.

## 1. Summary

| Field | Control | Source | Related estimate column | Required now? |
| --- | --- | --- | --- | --- |
| Has it been approved? | Native select | Generated Yes/No/Unknown Choice | `re_hasbeenapproved` | No |
| National Account | Native select | Generated Yes/No/Unknown Choice | `re_nationalaccount` | No |
| Emergency / unit shutdown | Native select | Generated Yes/No Choice | `re_emergency` | No |
| Subcontractor cost ($, captured only) | Numeric input | User entry | `re_subcontractorcost` | No |

All four:

- Belong to Opportunity details' reusable `request` field group.
- Start blank, not automatically No, Unknown, or zero.
- Are scalar estimate attributes, not foreign-key lookups.
- Store DOM strings in `requestInputs`.
- Are retained through branch/market changes.
- Appear read-only in the review's expandable request-details section.
- Are not currently saved, calculated, or submitted.

Sources: [RequestFields](../../src/RequestFields.tsx), [App](../../src/App.tsx), [estimate model](../../src/generated/models/Re_repairestimatesModel.ts).

## 2. Shared Data Flow and Organization

```text
Generated Choice maps                  Manual cost entry
    |                                       |
    v                                       v
Native selects                         Numeric input
    |                                       |
    +---------- event.target.value ---------+
                        |
                        v
          updateRequestInput(key, string)
                        |
                        v
                 requestInputs
                        |
                        v
         Same values displayed at Review
                        |
                        v
          Disabled final action; no save
```

The three dropdowns use generated numeric-to-label objects imported into the bundle. They do not query choice metadata or a reference table at runtime.

There is no query joining approval, account, emergency, supplier, or cost tables for these controls.

`RequestInputs` is a partial map of field keys to strings. An untouched field is absent and rendered as `''`; clearing a changed field can leave a present key containing `''`.

The update handler does not:

- Parse numeric choice codes or currency amounts.
- Convert choices to booleans.
- Check business-rule combinations.
- Resolve account or supplier identities.
- Trigger approval or dispatch.
- Calculate or save anything.

Sources: [input representation/renderer](../../src/RequestFields.tsx), [state update](../../src/App.tsx).

## 3. Has It Been Approved?

### 3.1 Control and exact values

| Property | Implementation |
| --- | --- |
| UI label | Has it been approved? |
| Input ID | `request-re_hasbeenapproved` |
| Control | Native HTML select |
| Initial state | Blank placeholder |
| Options | Yes, No, Unknown |
| Required attribute | Not set |

| Choice value | Meaning | State string |
| --- | --- | --- |
| `126110000` | Yes | `"126110000"` |
| `126110001` | No | `"126110001"` |
| `126110002` | Unknown | `"126110002"` |
| No choice | Unanswered | `""` |

Unknown is an explicit selected answer; it is not the same state as blank/unanswered.

Source: [generated approval-indication choices](../../src/generated/models/Re_repairestimatesModel.ts).

### 3.2 Dataverse contract

| Property | Local value |
| --- | --- |
| Table | `re_repairestimate` |
| Entity set | `re_repairestimates` |
| Column | `re_hasbeenapproved` |
| Schema name | `re_HasBeenApproved` |
| Type | Picklist/Choice |
| Generated declaration | Optional numeric-choice union |
| Formatted read label | `re_hasbeenapprovedname` |

The local export identifies this as a global Choice named `yesnounknow`. That is choice metadata, not a relational approval table.

Source: [estimate schema](../../.power/schemas/dataverse/repairestimates.Schema.json).

### 3.3 Approval indication is not approval authority

Selecting Yes is a user-entered assertion. It does not:

- Execute an approval operation.
- Verify who approved or when.
- Check approval evidence.
- Record approver identity or approval history.
- Lock the estimate.
- Bypass approval requirements.
- Change estimate business status.
- Enable submission or otherwise-disabled actions.

Every user who can enter the request workspace sees the same editable field. There is no field-specific Admin/approver gate in the component.

### 3.4 Separate generated fields

| Field | Meaning/type in local contract | Relationship to this control |
| --- | --- | --- |
| `re_hasbeenapproved` | Yes/No/Unknown indication | Edited by this control |
| `re_requiresapproval` | Optional Boolean | Not automatically changed |
| `re_approvallevel` | Optional None/District/Regional Choice | Not automatically changed |
| `re_estimatestatus` | Draft/Pending/Submitted Choice | Not changed by this answer |

The UI does not reconcile combinations such as Yes while another future rule requires approval. Server-authoritative workflow would have to define and enforce the meaning.

**Audit conclusion:** This is input capture, not an operational approval mechanism.

## 4. National Account

### 4.1 Control and source

| Property | Implementation |
| --- | --- |
| Input ID | `request-re_nationalaccount` |
| Control | Native HTML select |
| Initial value | Blank |
| Options | Yes / No / Unknown |
| Source | Generated Choice map |
| Required attribute | Not set |

Exact values are the same as approval indication:

- Yes: `126110000`.
- No: `126110001`.
- Unknown: `126110002`.

The local schema shows both fields use the same global Choice metadata ID and `yesnounknow` option-set name. They remain two independent columns and state entries.

Sharing a Choice definition does not merge their answers or mean one controls the other.

### 4.2 Dataverse contract

| Property | Local value |
| --- | --- |
| Column | `re_nationalaccount` |
| Schema name | `re_NationalAccount` |
| Type | Optional Picklist/Choice |
| Formatted read label | `re_nationalaccountname` |

Sources: [generated model](../../src/generated/models/Re_repairestimatesModel.ts), [schema](../../.power/schemas/dataverse/repairestimates.Schema.json).

### 4.3 Not an Account relationship

Despite its label, this is not an Account lookup.

It does not:

- Select a customer/account record.
- Verify national-account classification against CRM.
- Read a national-account contract.
- Populate customer name, sold-to, bill-to, payer, or prospect account.
- Filter equipment by customer.
- Apply a price schedule, discount, or approval route.

The user manually declares Yes, No, or Unknown.

### 4.4 Distinct from National Account Band

The estimate contract also contains `re_nationalaccountband`, a separate optional Choice:

| Value | Band |
| --- | --- |
| `126110000` | High |
| `126110001` | Medium |
| `126110002` | Low |

The same numeric values have different meanings in different Choice columns. A National Account Yes code must not be copied into a pricing-band field merely because the numbers align.

No code currently derives National Account Band, margin, incentive, or price from this answer.

## 5. Emergency / Unit Shutdown

### 5.1 Control and choices

| Property | Implementation |
| --- | --- |
| Input ID | `request-re_emergency` |
| Control | Native HTML select |
| Source | Generated global Yes/No Choice |
| Initial value | Blank |
| Required attribute | Not set |

| Choice | Stored code |
| --- | --- |
| Yes | `126110000` |
| No | `126110001` |
| Unanswered | Empty string in UI state |

There is no Unknown option for Emergency.

The schema reports `PicklistType`, not `BooleanType`. The app must not treat the code as a JavaScript boolean: both numeric-choice strings are nonempty/truthy.

### 5.2 Dataverse contract

| Property | Local value |
| --- | --- |
| Column | `re_emergency` |
| Schema name | `re_Emergency` |
| Type | Optional Choice |
| Formatted read label | `re_emergencyname` |
| Global option set | `yesno` |

Source: [estimate schema](../../.power/schemas/dataverse/repairestimates.Schema.json).

### 5.3 Meaning and limits

The visible label combines Emergency and unit shutdown in one question. The data model exposed here stores one answer, not two independent flags.

The code does not establish:

- Whether all shutdowns qualify as emergencies.
- A severity, dispatch priority, or SLA.
- Which selected unit is shut down.
- Start time, duration, outage reason, or safety condition.
- Evidence from an equipment monitoring system.

The value is request-level, not a per-equipment flag.

Selecting Yes does not dispatch anyone, notify a team, select overtime/double time, raise a surcharge, change technician count, or alter approval state.

There is no conditional UI requiring an explanation when Yes is selected.

## 6. Subcontractor Cost

### 6.1 Control and current input rules

| Property | Implementation |
| --- | --- |
| Exact English label | Subcontractor cost ($, captured only) |
| Input ID | `request-re_subcontractorcost` |
| Input type | `number` |
| Minimum | `0` |
| Maximum | Not set |
| Step | `any` |
| Required | No |
| Default | Blank, not zero |

The generic renderer provides `min=0` for noninteger numeric fields and `step=any`.

Consequences:

- Blank is allowed.
- Zero is allowed and is distinct from unanswered.
- Positive fractional amounts are allowed by the configured step.
- Negative values fail the current browser minimum constraint when checked.
- There is no UI maximum amount.
- There is no explicit two-decimal-place precision restriction.
- Values are not currency-formatted or rounded by application code.

Source: [cost definition and numeric renderer](../../src/RequestFields.tsx).

### 6.2 Dataverse contract and unused base amount

| Property | Local value |
| --- | --- |
| Table | Repair Estimate |
| Column | `re_subcontractorcost` |
| Schema name | `re_SubcontractorCost` |
| Dataverse type | `MoneyType` |
| TypeScript field | `re_subcontractorcost?: number` |
| Required | No |
| Companion read-only amount | `re_subcontractorcost_base` |

The local export does not specify numeric bounds or money precision for this column. The nonnegative rule is verified in UI code, not independently verified as backend enforcement.

The base amount is not edited, calculated, read into this request, or populated by the current component. Its existence does not establish a functioning currency-conversion flow here.

Source: [estimate schema/model](../../src/generated/models/Re_repairestimatesModel.ts), [schema metadata](../../.power/schemas/dataverse/repairestimates.Schema.json).

### 6.3 Currency ambiguity

The label uses `$`, but the input does not carry an explicit ISO currency.

- No currency selector is attached to this field.
- Branch Currency is not loaded by the branch query.
- Changing market does not convert the entered cost.
- No exchange rate or base-currency conversion runs.
- The generated estimate model has a transaction-currency binding, but no estimate-create mapper supplies it.

Therefore the code does not prove whether an entered amount should be interpreted as USD, CAD, or another configured transaction currency. That requires business/live metadata confirmation.

### 6.4 Not a subcontractor/supplier lookup

This is a single request-level money input.

It does not identify:

- A subcontractor/vendor record.
- A purchase order.
- An invoice.
- Multiple subcontract lines.
- Tax inclusion or exclusion.
- Markup basis.
- Whether the cost is per equipment, per package, or an overall total.

No quantity-based scaling is implemented. The label and column alone are insufficient to certify the intended business basis.

### 6.5 No effect on pricing yet

The entered amount is not added to:

- Package estimated cost.
- Additional material/miscellaneous cost.
- Total true cost.
- Suggested sell price.
- Entered sell price.
- CMII, margin, tax, freight, or incentives.

No frontend formula consumes this state key. Authoritative calculation is explicitly unconnected.

### 6.6 Validation timing and future conversion

The footer runs `reportValidity()` on `input` elements before advancing steps 1-4. The cost input is included when rendered during Opportunity details.

The Continue button's disabled condition does not inspect this amount. A populated invalid negative amount can leave the button visually enabled but block progression at click time.

The handler does not parse, clamp, normalize, or reject the event string. A future save mapper must define:

- Blank/null semantics.
- Numeric conversion and finite-value validation.
- Currency and precision.
- Approved business bounds.
- Whether the amount is aggregated or per-unit.
- Server-authoritative calculation behavior.

These are future requirements, not code changes performed here.

## 7. Validation Across All Four Fields

Source: [wizard progression](../../src/App.tsx).

Step-one button gating requires only:

```text
branchId is nonempty
AND buildingName.trim() is nonempty
AND equipmentTypeId is nonempty
```

None of these four fields is included in that required gate.

The click handler validates `input` elements, not selects. The three Choice selects also lack HTML `required`, so blank answers are permitted.

The code does not validate combinations such as:

- Approval Yes with Emergency Yes.
- National Account Unknown with entered customer identifiers.
- Nonzero subcontractor cost without a vendor or scope.
- An emergency answer that conflicts with another entered work category.

This absence is not automatically a defect; the intended business rules need confirmation.

## 8. Localization, State Lifetime, and Review

### Localization

- Field labels have English/French versions.
- Choice labels use the local French dictionary: Yes/Oui, No/Non, Unknown/Inconnu.
- Changing UI language preserves choice codes and entered cost text.
- No data translation or currency conversion occurs.
- The displayed labels are bundled application copy, not runtime-fetched localized metadata.

### Lifetime

| Action | Current behavior |
| --- | --- |
| Branch/market change | All four values retained |
| Equipment Type/Job Type change | Retained |
| Select/remove equipment or packages | Retained |
| Wizard Back/Continue | Retained |
| Dashboard/Repair Requests navigation | Retained in mounted App |
| New Request clicked again | Values retained; step resets |
| Review | Same state, not an immutable saved snapshot |
| Reload/actual unload | Values lost |

All three review selects are disabled; the cost input is read-only. All appear under expandable request details.

Nonempty strings contribute to unsaved-change detection, including No codes and the amount string `"0"`. A false-like business answer is still a nonempty input string. The warning does not persist data.

## 9. Relationships and Persistence

```text
re_hasbeenapproved   -> scalar Choice on Repair Estimate
re_nationalaccount   -> scalar Choice on Repair Estimate
re_emergency         -> scalar Choice on Repair Estimate
re_subcontractorcost -> scalar Money on Repair Estimate
```

No field is a foreign key or lookup binding. Choice metadata is not a record relationship.

The repository does not fetch existing estimate detail values into these controls. Summary-list queries do not select these four columns.

No frontend save sends their state to Dataverse, despite field keys matching column names. There is no automatic binding.

## 10. Findings and Verification Gaps

| ID | Finding | Consequence |
| --- | --- | --- |
| A01 | Approval is editable indication, not verified workflow state | Selecting Yes must not be treated as authorization or completed approval |
| A02 | National Account is declared rather than resolved | Customer contract/classification is not verified |
| A03 | Emergency combines emergency/shutdown into one request-level answer | Cannot distinguish separate conditions or affected units |
| A04 | Yes/No fields are Choice codes, not booleans | Future logic must compare explicit codes |
| A05 | Blank differs from Unknown/No/zero | Save defaults must not silently erase unanswered semantics |
| A06 | Subcontract cost has no currency/precision/basis resolution | Financial writes/calculation need explicit business rules |
| A07 | No max or decimal precision in numeric UI | Broad positive numeric input is possible; live bounds remain unknown |
| A08 | No downstream calculations, approval, or dispatch | These controls currently capture intent only |
| A09 | Values survive branch/market changes without revalidation | Currency/routing/account context can change while answers remain |
| A10 | No direct existing field-specific tests found | Current source inspection is not browser behavior or server-enforcement proof |
| A11 | No estimate writes | Review is not a persisted/approved repair request |

### Follow-up business/live checks

1. Define what Has it been approved refers to and what evidence is required.
2. Keep user-entered approval indication separate from trusted approval history/status.
3. Confirm National Account source-of-truth and any server pricing-band derivation.
4. Decide whether emergency and unit shutdown need separate/per-unit fields.
5. Confirm dispatch/priority/time-category rules rather than inferring them from labels.
6. Confirm subcontractor amount basis, transaction currency, precision, bounds, and tax/markup treatment.
7. Define blank/null/default semantics and permitted combinations.
8. Verify live schema choices, requiredness, and server enforcement before implementing saves.

## 11. Verification and Related Documentation

- Read field definitions, generic rendering, generated model fields/choices, review and footer validation.
- Extracted local schema metadata for all four columns and related approval/band/base-money fields.
- Local metadata confirms approval indication and National Account share the same global Yes/No/Unknown Choice.
- Searched existing tests; no direct references to these four fields were found.
- No application changes, dependency installation, live requests, or workflow execution performed.
- Documentation-only work did not require rerunning build/lint/tests.

Related audits:

- [Branch](BRANCH_AUDIT.md).
- [Equipment Type, Job Type, Building, and Salesperson](EQUIPMENT_TYPE_JOB_TYPE_BUILDING_SALESPERSON_AUDIT.md).
- [Supervisor, Work-centre Request, and Technicians](SUPERVISOR_WORK_CENTER_TECHNICIANS_AUDIT.md).
- [Master Application Audit](../../MASTER_APPLICATION_AUDIT.md).

**Conclusion:** These are four optional estimate inputs: three declared Choice answers and one nonnegative money-entry control. They do not currently verify approval, resolve national-account status, trigger emergency response, or calculate subcontract costs into pricing. All remain unsaved browser state.
