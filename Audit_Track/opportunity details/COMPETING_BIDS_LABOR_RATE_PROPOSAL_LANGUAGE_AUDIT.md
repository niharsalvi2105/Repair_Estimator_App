# Opportunity Details Audit: Competing Bids, Stated Labor Rate, and Proposal Language

**Audit date:** 2026-10-24  
**Terminology:** The field requested as proposed language is labelled **Proposal language** in the application.  
**Scope:** Current controls, data origins, generated Dataverse contracts, validation, dependencies, review, and persistence.  
**Method:** Direct source inspection and structured extraction of local schema metadata.  
**Changes:** Documentation only; no application code or live records changed.  
**Evidence boundary:** No authenticated live metadata/data queries, browser interaction tests, server calculation inspection, or document-generation tests performed.

## 1. Summary

| Detail | Competing bids | Stated labor billing rate | Proposal language |
| --- | --- | --- | --- |
| Control | Native select | Numeric input | Native select |
| Source | Bundled generated Choice | User entry | Bundled generated Choice |
| Options/unit | None/Known/Suspected/Unknown | Displayed dollars per hour | English/French |
| Initial value | Blank | Blank | Blank |
| State key | `re_competingbids` | `re_statedlaborrate` | `re_proposallanguage` |
| State representation | String choice code | Numeric-entry string | String choice code |
| Dataverse type | Optional Choice | Optional Money | Required Choice in local contract |
| Required by current UI? | No | No | No |
| Foreign key? | No | No | No |
| Saved to estimate now? | No | No | No |

**Primary finding:** Proposal language is required by the generated estimate-create contract, but the UI permits it to remain blank. Existing save blockers prevent an incomplete estimate write; a future save implementation must resolve this mismatch.

Sources: [RequestFields](../../src/RequestFields.tsx), [estimate model](../../src/generated/models/Re_repairestimatesModel.ts), [estimate schema](../../.power/schemas/dataverse/repairestimates.Schema.json).

## 2. Shared Data Path

```text
Generated estimate Choice definitions          User-entered rate
                 |                                   |
                 v                                   v
            Native selects                      Numeric input
                 |                                   |
                 +-------- event.target.value -------+
                                  |
                                  v
                   updateRequestInput(key, string)
                                  |
                                  v
                            requestInputs
                                  |
                                  v
                    Same state displayed at Review
                                  |
                                  v
                     No create/calculate/submit call
```

All three are members of the `requestFields` group on Opportunity details.

- They are not populated from an existing estimate detail.
- No reference-table join supplies their options/amount.
- No request runs when the user changes one.
- The update handler copies state without parsing or business validation.
- Untouched keys are absent from initial `{}` and render as `''`.
- A cleared value can remain as an explicit empty string.

Sources: [input representation and renderer](../../src/RequestFields.tsx), [state/update handler](../../src/App.tsx).

## 3. Competing Bids

### 3.1 Control and exact choices

| Property | Current implementation |
| --- | --- |
| English label | Competing bids |
| Input ID | `request-re_competingbids` |
| Control | Native HTML select, not a searchable combobox |
| Initial answer | Blank placeholder |
| Required | No |

| Code | Label | State string |
| --- | --- | --- |
| `126110000` | None | `"126110000"` |
| `126110001` | Known | `"126110001"` |
| `126110002` | Suspected | `"126110002"` |
| `126110003` | Unknown | `"126110003"` |
| No choice | Unanswered | `""` |

None, Unknown, and unanswered are three different states. The app does not default unanswered to either None or Unknown.

### 3.2 Source and organization

Options come from the generated `Re_repairestimatesre_competingbids` object imported into the app bundle.

- No competing-bid table is queried.
- No competitor master list is loaded.
- No customer/market/branch-specific filtering occurs.
- A global Choice definition is metadata, not a separate relational table.
- Live option changes require appropriate regeneration/release before they appear in this bundled list.

Sources: [generated choice map](../../src/generated/models/Re_repairestimatesModel.ts), [local schema](../../.power/schemas/dataverse/repairestimates.Schema.json).

### 3.3 Dataverse destination

| Property | Local contract |
| --- | --- |
| Logical table | `re_repairestimate` |
| Entity set | `re_repairestimates` |
| Column | `re_competingbids` |
| Schema name | `re_CompetingBids` |
| Dataverse type | `PicklistType` |
| Required | No |
| Global Choice display name | Competing Bids |
| Formatted read label | `re_competingbidsname` |

It is scalar classification, not a foreign-key lookup to a Bid or Competitor record.

### 3.4 What the answer does not establish

Selecting Known does not capture:

- Competitor identity.
- Number of bids.
- Bid amount, currency, or deadline.
- Supporting documents.
- Confirmed versus unverified evidence beyond the selected label.

No pricing, discount, target margin, approval, notification, or equipment/package filter consumes this answer.

The detailed business interpretation of Known versus Suspected is not defined by executable workflow in the repository.

## 4. Stated Labor Billing Rate

### 4.1 Control, source, and unit

The exact label is **Stated labor billing rate ($/hour)**.

| Property | Current implementation |
| --- | --- |
| Input ID | `request-re_statedlaborrate` |
| Type | `number` |
| Source | Manual entry |
| Default | Blank, not zero |
| Minimum | 0 |
| Maximum | Not set |
| Step | `any` |
| Required | No |

The unit comes from the UI label. This is an entered billing rate, not a retrieved wage, branch tariff, or validated customer-contract rate.

Source: [rate definition and numeric renderer](../../src/RequestFields.tsx).

### 4.2 Dataverse contract

| Property | Local value |
| --- | --- |
| Column | `re_statedlaborrate` |
| Schema name | `re_StatedLaborRate` |
| Display title | Stated Labor Rate |
| Dataverse type | `MoneyType` |
| Generated field | `re_statedlaborrate?: number` |
| Required | No |
| Read-only base-currency companion | `re_statedlaborrate_base` |

The state still contains a string. The Money TypeScript declaration does not automatically convert the DOM string.

The local schema does not expose money precision or numeric bounds for this field. The UI's nonnegative constraint is not proof of corresponding server enforcement.

Source: [estimate schema](../../.power/schemas/dataverse/repairestimates.Schema.json).

### 4.3 Distinct rate and margin columns

| Field | Local type | Current relationship to entered rate |
| --- | --- | --- |
| `re_statedlaborrate` | Money | Captured here |
| `re_mechaniclaborrate` | Money | Not fetched or derived by this field |
| `re_statedratemargin` | Decimal | Not calculated |
| `re_statedlaborrate_base` | Read-only Money | Not calculated/displayed by this UI |

Do not substitute stated billing rate for mechanic labor cost or infer a margin formula from these names.

### 4.4 No rate calculation or defaulting

The entered rate does not currently:

- Multiply package mechanic hours or additional labor hours.
- Multiply by technician/equipment count.
- Set labor cost or total true cost.
- Calculate stated-rate margin, CMII, or suggested price.
- Alter the entered sell price.
- Read contract terms or branch labor rates.
- Adjust for Straight Time/Double Time.
- Generate a billable quote.

No code consumes the field beyond generic state, dirty detection, and review rendering.

### 4.5 Currency and precision gaps

- `$` does not identify USD versus CAD.
- No ISO currency is stored alongside this individual input.
- Branch Currency is not loaded by the branch query.
- Market changes retain the amount without currency conversion.
- No exchange-rate logic or base-money calculation is connected.
- No two-decimal-place constraint or application rounding exists.
- Fractional positive amounts are allowed through `step=any`.
- There is no explicit UI maximum.

A future save/calculation mapper must confirm transaction currency, amount precision, valid bounds, finite-number conversion, and rate basis.

### 4.6 Validation timing

The wizard footer runs `reportValidity()` on rendered `input` elements before advancing steps 1-4.

Expected browser constraint semantics:

| Entry | Expected result |
| --- | --- |
| Blank | Allowed: not required |
| 0 | Allowed |
| Positive integer/fraction | Allowed under configured bounds/step |
| Negative value | Invalid under `min=0` |
| Invalid numeric text | Browser number-input/bad-input behavior applies |

This describes HTML attributes, not executed browser test results.

The Continue button's disabled condition does not examine the rate. An invalid numeric input may block its click-time validation even while the button looks enabled.

## 5. Proposal Language

### 5.1 Control and exact values

| Property | Implementation |
| --- | --- |
| Label | Proposal language |
| Input ID | `request-re_proposallanguage` |
| Control | Native HTML select |
| Options | English/French |
| Initial value | Blank |
| Visible required asterisk | None |
| HTML `required` | Not set |

| Code | Meaning | State |
| --- | --- | --- |
| `126110000` | English | `"126110000"` |
| `126110001` | French | `"126110001"` |
| No selection | Unanswered | `""` |

There is no automatic default from UI language, saved locale, branch default language, or selected market.

### 5.2 Dataverse contract and requiredness mismatch

| Property | Local value |
| --- | --- |
| Column | `re_proposallanguage` |
| Schema name | `re_ProposalLanguage` |
| Dataverse type | Picklist |
| Global Choice name | language choice |
| Local schema required flag | True |
| Generated base model | Nonoptional numeric-choice field |
| Formatted label | `re_proposallanguagename` |

The UI permits unanswered Proposal language because:

- Its select is not required.
- Step-one gating checks only Branch, Building name, and Equipment Type.
- The footer validity loop inspects inputs, not selects.

Thus, the wizard can reach review without the value required by the local estimate-create contract.

No write currently occurs, so this is a future-save readiness gap rather than a demonstrated failed server transaction.

Sources: [schema required flag](../../.power/schemas/dataverse/repairestimates.Schema.json), [generated estimate model](../../src/generated/models/Re_repairestimatesModel.ts), [wizard gating](../../src/App.tsx).

### 5.3 Separate language concepts

| Concept | Source/storage | Current behavior |
| --- | --- | --- |
| UI language | Saved user preference `en`/`fr` | Translates interface/option labels |
| Preference locale | Saved `en-US`/`fr-CA` or retained locale | Separate preference value |
| Proposal language | Unsaved `requestInputs.re_proposallanguage` | Manual choice |
| Estimate language | Generated optional `re_estimatelanguage` | Not set by this control |
| Estimate language locale | Generated optional `re_languagelocale`, text max 100 | Not set by this control |
| Branch default language | Branch schema field | Not fetched/applied by branch query |

The local schema shows Proposal language uses the global `language choice`, while Estimate language has a separate global Choice named `Estimate Language`. Both happen to use English/French codes; they remain separate fields.

### 5.4 Independence is deliberate in the current wiring

- Selecting French Proposal language does not switch the interface to French.
- Changing the interface to French does not choose French Proposal language.
- Selecting CKQ automatically saves French UI preferences but leaves Proposal language unchanged.
- Selecting MKO/CKE does not reset Proposal language.
- Branch changes do not apply branch default language.
- User-preference writes do not persist this request's proposal-language value.

Source: [language preference handlers and market changes](../../src/App.tsx).

### 5.5 No proposal-generation connection

The choice does not currently:

- Generate, translate, or select a proposal document.
- Select French/English scope text for a saved quote.
- Translate manually entered notes.
- Change package search to French.
- Create a document/template lookup.
- Submit or email a customer proposal.

Package names use UI language, not this field. Current package result scope preview remains English. Proposal language is captured intent for a future connected workflow.

## 6. Localization

Source: [French choice translations](../../src/RequestFields.tsx).

- Competing-bid labels are translated through the local dictionary.
- English/French options display as Anglais/Francais with the source's accents in French UI.
- The rate label is translated, but its entered numeric string is not converted or currency-formatted.
- Changing interface language changes labels, not selected codes or entered rate.
- Choices are bundled application metadata, not runtime-fetched localized records.

## 7. Foreign Keys and Data Organization

None of these controls creates a foreign-key relationship:

```text
Competing Bids -> scalar estimate Choice
Stated Labor Rate -> scalar estimate Money
Proposal Language -> scalar estimate Choice
```

There is no Bid, Labor Rate, or Language lookup table queried for these controls.

The option sets are global metadata, not joined tables. Each field is stored independently in `requestInputs`; a shared renderer does not merge their meanings.

Formatted read properties ending in `name` and money `_base` properties are not the editable input/write columns.

## 8. State Lifetime, Review, and Persistence

| Action | All three fields |
| --- | --- |
| Initial mount | Blank |
| Branch/market change | Retained |
| Equipment Type/Job Type change | Retained |
| Unit/package selections change | Retained |
| Back/Continue | Retained |
| Dashboard/Repair Requests navigation | Retained in mounted App |
| New Request clicked again | Retained; step resets to 1 |
| Review | Same current state, not a saved snapshot |
| Reload/unload | Lost |

Review renders them under expandable request details:

- Competing Bids and Proposal language selects are disabled.
- Stated Labor Rate input is read-only.
- Final action remains disabled.

Nonempty strings contribute to the unload warning, including None, English, or rate `"0"`. The warning is not persistence.

Existing estimate-summary queries do not fetch these fields, and current controls are not populated by an existing estimate-detail read.

## 9. Findings and Follow-up Verification

| ID | Finding | Consequence |
| --- | --- | --- |
| C01 | Competing-bid answer is classification only | No competitor/bid evidence, amounts, or pricing response |
| C02 | Labor billing rate is not labor cost | No safe inference of cost, hours scaling, or margin |
| C03 | Currency/precision/max bounds are unresolved | Financial writes require verified transaction semantics |
| C04 | Rate stays a string | Future mapper must parse and validate without silent coercion |
| C05 | Proposal language is required locally but optional in UI | Future save must resolve missing value/default policy |
| C06 | UI/Proposal/Estimate languages are separate | Interface language cannot be used as proof of proposal-language selection |
| C07 | No document/calculation pipeline consumes these values | Current workflow is input capture only |
| C08 | Values retained through market/branch changes | Rate currency/language context is not revalidated |
| C09 | No direct field-specific tests found | Source audit does not prove browser or server behavior |

Recommended business/live checks:

1. Define Known/Suspected/Unknown meanings and any required supporting details.
2. Confirm stated billing-rate basis, currency, precision, permitted bounds, and approved default source.
3. Define labor-rate relationships to time category, technician count, package hours, and server margin calculations.
4. Decide when Proposal language becomes mandatory and whether an explicit default is allowed.
5. Confirm whether Proposal language, Estimate language, and locale should synchronize or remain independent.
6. Verify live schema defaults/enforcement and document-template integration before enabling writes.

## 10. Verification and Related Audits

- Read definitions, generic rendering, state/reset/review and language-preference handlers.
- Searched application references to bid, rate, proposal/estimate language, related rate margin and mechanic rate.
- Extracted local schema types, choices, requiredness, global Choice identities and related base/locale fields.
- Searched existing tests; no direct references to these three input keys were found.
- No application code, dependencies, server records, or permissions changed.
- Documentation-only work did not require rerunning build/lint/tests.

Related audits:

- [Branch](BRANCH_AUDIT.md).
- [Equipment Type, Job Type, Building, and Salesperson](EQUIPMENT_TYPE_JOB_TYPE_BUILDING_SALESPERSON_AUDIT.md).
- [Supervisor, Work-centre Request, and Technicians](SUPERVISOR_WORK_CENTER_TECHNICIANS_AUDIT.md).
- [Approval, National Account, Emergency, and Subcontractor Cost](APPROVAL_NATIONAL_ACCOUNT_EMERGENCY_SUBCONTRACT_COST_AUDIT.md).
- [Customer Budget, Paper Type, and Consultant](CUSTOMER_BUDGET_PAPER_TYPE_CONSULTANT_AUDIT.md).
- [Master Application Audit](../../MASTER_APPLICATION_AUDIT.md).

**Conclusion:** Competing Bids is optional competitive-context classification, Stated Labor Rate is an optional nonnegative entered billing rate, and Proposal language is manual intent independent of UI language. None is a lookup or currently drives pricing/document output. All remain unsaved, and Proposal language has an explicit local-contract versus UI requiredness gap.
