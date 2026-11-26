# Formula-sheet validation against the current app

[Formula index](FORMULAS.md) | [Current server formulas](FORMULAS-pricing.md) | [Current inputs](FORMULAS-inputs.md)

## Validation result

The supplied `KTOC_PSR_Estimator_Complete_Calculation_Formula_Reference.docx` is **not formula-equivalent to the current app**. It is an audit summary, not a literal inventory: it explicitly says the source workbook has 5,041 formula cells while the audit records only the main paths. The original XLSM and the stated 12-case sample batch are not in this repository, so this comparison cannot prove PST parity or reconcile a user-entered case.

The table below distinguishes agreement, deliberate/structural differences, and open workbook-policy questions. “App” below means the current workspace source (`PricingEngine` version `2026.14`), not proof of the currently deployed Dev assembly.

## Current-app versus sheet

| Topic | Sheet formula/behavior | Current app behavior | Effect and status |
|---|---|---|---|
| Standard package labor | `package hours/unit * equipment count * mechanic rate` | `sum(package hours/unit * package assigned equipment quantity * estimate mechanic rate)`; quantity falls back to header equipment count when no subset is saved | Agree for one package assigned to all equipment. Independent package subsets can differ. |
| Standard material, tax, freight | Quote amount/unit times equipment, then the workbook tax/freight rates | `sum(material/unit * package quantity)` times the one optional request-level rate pair; omitted/blank rates are zero | Structurally aligned with a single overall material-rate pair. The app treats the master package material field as the taxable base and does not use separate fixed 5%/14% package rates. |
| Additional cost | labor at branch rate + material/misc, with tax and freight on material/misc | Same: `additional hours * mechanic rate + (additional material + additional misc)*(1+t+f)` | Agree, except source UI percentage is divided by 100 before server storage/use. |
| Total true cost | package estimated + total additional | Same | Agree, but app rounds total from the unrounded aggregate; do not add separately rounded output components and expect identical cents in every case. |
| Actual CMII | `(sell - true cost)/sell` | Same numerator, then **rounds to 4 decimal places** | Difference only after the fifth decimal. The rounded value is then used for incentive-band selection and displayed/stored actual CMII. |
| Suggested price | `true cost/(1-recommended CMII)` | Same for standard lines. On custom catalog-priced Non-KONE/KONE lines, the app first removes/replaces specific cost and selling components. Final price rounds to two places. | Standard agrees; custom material routes do not use a universal `total/(1-margin)` formula. |
| QR/QQ | positive median below 5,000 is QQ; otherwise QR | QR if cost is zero or median is `>= QQ_THRESHOLD`; otherwise QQ | Agree only when tenant `QQ_THRESHOLD = 5000`. The app uses an effective-date Pricing Parameter, not a hard-coded 5,000. |
| Job-size band | QR ranges from `<5k` through `>1m` | Active Dataverse band rows; inclusive lower bound, exclusive upper bound | Agree in structure, but tenant rows supply the values. |
| OEM band | KONE or MONTGOMERY = High, otherwise Low | Active OEM keyword rows, first repository order; tenant default text or Low if no rule matches | Baseline tests use KONE and MONTGOMERY, but current production values can only be proven from tenant rows. |
| Age | `>=15 High` and `<15 Low` | `age >= AGE_THRESHOLD`; otherwise Low | Agree when the tenant threshold is 15. Age itself is a saved snapshot. |
| Customer bands | workbook matrix and situational rules | Dataverse matrix/rule rows | Agree structurally; exact values depend on effective tenant data and the selected branch margin group. |
| Situational adders | +5% emergency, +7% budget, +3% KONE paper, -3% competing bids on Non-KONE | Sum of active tenant adjustment rows whose type/input/paper gates match | The recorded 5/7/3/-3 percentages are test/document values, not hard-coded app values. Current test baseline only demonstrates selected rules, not all production rows. |
| Escalator/fixed target | sheet says a 65% Escalator fallback can affect target | The approved app behavior remains unchanged: no `65% Escalator` branch fallback. Recommended margin is stated-rate margin, else equipment fixed target, else target CMII. 65% is valid only as configured `MATERIAL_MARGIN_FLOOR`. | **Deferred workbook ambiguity resolved by keeping current policy.** 65% remains tenant data, not a hard-coded target. |
| Stated rate | hours = package hours + additional labor; base branch cost; all material is repriced at `max(65%, base target)` | Version 2026.13 uses package/additional hours at the mechanic rate and CSTM line hours at each saved line rate. Material includes landed custom lines/package plus plain additional material/misc. `max(MATERIAL_MARGIN_FLOOR, target)` is applied to the combined material cost. | Custom labor basis now follows the approved saved-rate rule. Additional material/misc remain untaxed in stated-cost material, unlike true cost; this is the retained workbook-path behavior. 65% is data-dependent, not hard-coded. |
| CSTM labor | role/time hours times branch rate | Saved or resolved branch role/time rate per line; optional model multiplier exists but current Dataverse loader supplies `1` | Agree for current loaded records. |
| CSTM material cost | line quantity times unit cost | Same. Precise unit cost is used by the engine; saved draft child totals are cents. | Agree, subject to snapshot precision described below. |
| CSTM total cost | labor + material/misc + material/misc tax/freight | Same, with independent tax/freight applicability per material line and estimate-level additions | Formula agrees structurally; the sheet’s non-KONE/KONE attribution is not necessarily the same as the app's explicit catalog/manual/package classification. |
| CSTM Non-KONE price | `non-KONE cost/(1-max(65%, target))` | Version 2026.13 removes all explicit/legacy-classified CSTM Non-KONE landed cost from the recommendation-priced base and replaces it with `cost/(1-max(MATERIAL_MARGIN_FLOOR, recommended CMII))`. Catalog and manual Non-KONE follow the same margin formula. | **Aligned to the approved workbook rule.** The catalog selling-price field remains persisted source/diagnostic data but is not substituted into suggested price for Non-KONE. |
| KONE materials | separate KONE selling contribution with 5% tax + 10% freight + 10% markup; package and aggregate routes | Current itemized/manual KONE uses `quantity * selling price*(1 + line tax + line freight + 10%)`. Package uses final package material. Legacy aggregate uses tenant KONE tax/freight/markup parameters. | Itemized line tax/freight are estimate-level; only the legacy aggregate’s 5/10/10 split is tenant parameters. These paths are intentionally isolated. |
| Incentives/IC | band-specific AM/BD/SPIF, possible $75 minimum for $500–$5,000 and special >$5,000 expression | Selects one configured row by rounded actual CMII. For $500 through $5,000 inclusive, each positive AM/BD percentage payout is rounded to whole currency and raised to $75. Outside that range, it remains percentage-only. Zero payouts stay zero. | **$75 policy now aligned for AM/BD.** SPIF and any >$5,000 special expression remain deferred because their exact rows/rates were not supplied. |
| Down payment | workbook text says jobs > $5,000 require a down payment, separate from price formula | Submission requires any billing-plan choice only when `Sell > DOWN_PAYMENT_THRESHOLD`; UI splits 50% or 60% plans and the final payment is the cent remainder | Workflow agrees only if threshold is configured as $5,000. Billing formula and threshold validation are separate behaviors. |
| Redundancy | sheet flags possible comparison of functional location to customer ID | App counts equipment masters with the same saved primary-equipment functional location | The app uses the corrected key described by the audit note; this intentionally avoids the sheet's flagged mismatch. |
| Rounding | sheet prose mentions money 2 dp and IC whole amount, but one part says “IC ROUND(...,0)” and does not give a universal rule | Exact points are listed below | App is not consistent with any generic “round every intermediate” or `ROUNDUP`. |

## Exact rounding points in the app

| Stage/value | Actual implementation | How much it can move a value |
|---|---|---|
| Draft custom labor rate | `R2(master hourly rate)`; material `unitCost` is `R2(effective cost)` for the ordinary snapshot | Half-cent ties move away from zero. A 10-decimal catalog amount is retained separately where precise source fields are supported, while standard child Money is cents. |
| Draft child cost | `R2(hours*hourlyCost)`, `R2(quantity*unitCost)`, `R2(extended*tax)`, `R2(extended*freight)`, `R2(extended*(1+t+f))` | Each child can move by at most half a cent from exact value, but summing many lines can accumulate cents. |
| Pricing aggregate cost fields | Package labor/material/estimated, custom labor/material, KONE material, total additions and total true cost are independently `R2(...)` | The engine calculates `R2(raw aggregates)`, not `sum(R2(display rows))`; headline fields can differ from a manual sum by one cent or more across rows. `TotalTrueCost = R2(raw package estimated + raw additions)`. |
| Median selling reference | Saved as `R2(T/(1-medianMargin))`, but quote-type selection uses the **unrounded** median | Display/reference cents don't control the band threshold; a boundary can be selected from digits not displayed. |
| Target/base/recommended/stated CMII | No rounding in the engine | Full decimal is used as the denominator. Do not substitute a whole percentage or a displayed percentage unless the business expressly approves that change. |
| Suggested/final selling price | `R2(...)` after division by `1-recommended`; KONE and catalog substitutions occur before this final rounding | Only the final currency result is rounded; intermediate target changes can produce large dollar changes. |
| Actual CMII | `ROUND((sell-T)/sell, 4, AwayFromZero)` | Up to 0.00005 fraction, i.e. 0.005 percentage point. Because the rounded actual selects the incentive band, a value immediately below a threshold can cross it. |
| CMII variance | `actual(4dp) - recommended(full precision)`; no final rounding | Stored/displayed decimal may continue past four places because recommendation is not rounded. |
| AM IC / BD IC | `ROUND(sell * selected payout, 0, AwayFromZero)` | Each incentive is whole currency, not cents and not always upward. The two outputs round independently. |
| Billing plan split | UI converts sell to cents with `toFixed(2)` then `Math.round`; down payment is rounded to cents and final is the remainder | Payments sum exactly to the UI's cent-rounded price. For positive amounts, midpoint behavior is half-up. |
| Excel/custom import | Rejects precision beyond two accepted scaled decimals rather than rounding an arbitrary value into validity | An import such as an invalid 1.005 is rejected when it fails the two-decimal tolerance; this is separate from pricing/output rounding. |

`R2` means .NET decimal rounding to two digits with `MidpointRounding.AwayFromZero`. For positive values, `.005` becomes `.01`; unlike `ROUNDUP`, `.004` becomes `.00`. IC is a nearest-whole-money calculation: `64.49 -> 64`, `64.50 -> 65`, `64.51 -> 65`; `ROUNDUP(64.01,0)` would be 65, but the app does not call `ROUNDUP`.

## Example answering the reported value difference

With true cost `$10,000` and unrounded recommended CMII `0.645`:

```text
10,000 / (1 - 0.645) = 28,169.014... -> 28,169.01
```

If 64.5% is prematurely rounded to 65%:

```text
10,000 / (1 - 0.65) = 28,571.428... -> 28,571.43
```

That `$402.42` gap is not a server currency-rounding defect. It is a change to the **margin input** before division. The current app uses `0.645` at full precision and rounds the final suggested price.

For an incentive:

```text
Sell 4,000.00
AM rate 2.8%  -> 112.00 -> 112
BD rate 1.81% -> 72.40  -> 72
```

This `IC ROUND(...,0)` is implemented and tested by [PricingEngineTests](../backend-pricing-tests/PricingEngineTests.cs#L546-L557). It does not implement the sheet's missing SPIF or minimum-payout branches.

## Required actions for a true answer-by-answer proof

1. Obtain the original `.xlsm` or a literal cell formula export; the Word document itself says that 5,041 formulas were not reproduced.
2. For every Finance sample, capture inputs and source rows with effective dates, expected workbook cells/results, actual `re_repairestimate` and child snapshots, and the app `re_calculationversion`.
3. Obtain the exact remaining workbook rows for KONE package double-tax/markup policy and incentive SPIF/over-$5,000 formulas. Escalator, Non-KONE, $75 minimum and custom stated labor policy are now implemented from the approved choices.
4. Test rounding boundaries one cent and one ten-thousandth CMII below/at/above each threshold, with multi-line aggregation. The existing tests prove implemented arithmetic, not workbook parity.

Pricing 2026.13 changes were implemented from the approved choices in this validation. Release verification passed 163 backend pricing tests plus the Drafts harness. This is local source/test evidence, not a deployed-assembly, live-Dataverse or original-XLSM acceptance result.
