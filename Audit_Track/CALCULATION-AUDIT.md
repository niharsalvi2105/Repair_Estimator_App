# Repair Estimator calculation audit

## 1. Purpose and evidence boundary

This document is the consolidated, executable calculation inventory for the current
workspace source. It is intended for a calculation audit by Finance, engineering,
QA, or an external reviewer. It covers every monetary, margin, quantity, pricing,
classification, billing, display, dashboard, and export calculation that can
affect an estimate.

The authoritative pricing implementation is `PricingEngine` version **2026.14**.
This document describes source code and local tests; it does **not** prove that the
matching frontend or assemblies are deployed, that a tenant configuration contains
the expected rows, or that results match an unavailable original PST/XLSM.

Use this file as the audit index:

| Document | Audit role |
|---|---|
| This file | End-to-end dependency graph, exact formula catalogue, result-to-field map, and audit procedure |
| [FORMULAS-pricing.md](FORMULAS-pricing.md) | Detailed server formula narrative and business-rule behavior |
| [FORMULAS-inputs.md](FORMULAS-inputs.md) | Source-table lineage, precedence, snapshots, and material conversion |
| [FORMULAS-display-export.md](FORMULAS-display-export.md) | Browser previews, billing, dashboard, workbook, and email calculations |
| [FORMULAS-VALIDATION.md](FORMULAS-VALIDATION.md) | Workbook-reference comparison and exact rounding effects |

## 2. Calculation authority

Do not combine values from different layers as though they are interchangeable.

| Layer | Files | Authority and recomputation rule |
|---|---|---|
| Server pricing | `backend-pricing/Pricing/PricingEngine.cs` | Authoritative pricing for `re_calculationversion = 2026.14` |
| Loader/reference data | `backend-pricing/Data/EstimateInputLoader.cs`, `ReferenceData.cs` | Resolves exact inputs and effective configuration |
| Persistence | `backend-pricing/Plugins/CalculationWriter.cs` | Writes server results and aliases to the estimate |
| Draft snapshots | `backend/DraftPlugin.cs`, `PartCatalog.cs`, `PackageMaterialPricing.cs` | Creates child snapshots used as pricing inputs |
| Browser previews | `src/data/packageCosts.ts`, `customMaterialCosts.ts`, `laborGrid.ts` | Indicative only; not a second pricing engine |
| Saved pricing display | `src/PricingSummary.tsx`, `pricingPresentation.ts` | Displays saved Dataverse results; no recalculation of price |
| Billing display | `src/data/billingPayments.ts` | UI payment split only; not the engine selling price |
| Dashboard | `backend/DashboardReader.cs` | Reporting aggregation over saved calculations |
| Export | `backend-pricing/Automation/*`, Office Scripts | Freezes/renders saved values; does not recalculate the headline price |
| Email | `automation/build-estimate-email-flow.mjs` | Displays saved values and derives billing/package presentation rows |

For an audited estimate, first trust a coherent, saved `re_calculationversion`.
Then recompute the engine from the frozen child snapshots and effective reference
rows. Browser, email, and export rows are reconciled separately.

## 3. Notation, units, and rounding

### Notation

| Symbol | Meaning |
|---|---|
| `R2(x)` | `Math.Round(x, 2, MidpointRounding.AwayFromZero)` |
| `R4(x)` | `Math.Round(x, 4, MidpointRounding.AwayFromZero)` |
| `R0(x)` | `Math.Round(x, 0, MidpointRounding.AwayFromZero)` |
| `N` | `max(1, estimate equipment lines + parsed additional-equipment tokens)` |
| `Qp` | Saved assignment count for package `p`; otherwise `N` |
| `r` | Saved/resolved mechanic labor rate for estimate branch and time category |
| `t` | Estimate use-tax fraction, e.g. `0.05` for 5% |
| `f` | Estimate freight fraction, e.g. `0.14` for 14% |
| `S` | Entered selling price |
| `T` | Total true cost |
| `Rec` | Recommended CMII |

All server rates and margins are fractions. A UI draft input of `5` for tax is
divided by 100 before storage/use. Itemized KONE markup is different:
`re_markuppct = 10` means 10 percentage points and the engine divides it by 100.

### Exact rounding rules

1. Server package, total, tax, freight, cost, suggested price, median, and incentive
   output fields use the precision documented in the formula inventory below.
2. `R2` is nearest cent with midpoint away from zero, not `ROUNDUP`.
3. Actual CMII is `R4`; the rounded Actual CMII selects the incentive row.
4. Incentives are `R0` independently for AM and BD.
5. Target and Recommended CMII are not rounded.
6. The denominator `1 - Rec` uses the unrounded recommendation.
7. Adding independently rounded child/output fields can differ from an aggregate
   calculated from raw values and rounded once.

## 4. Input dependency graph

```text
Estimate header + Branch + Country + Province
  ├─ sell/stated rates/additional costs
  ├─ tax/freight precedence
  ├─ time category + branch mechanic rate
  ├─ equipment snapshots + master functional location
  ├─ package snapshots
  ├─ custom labor snapshots
  ├─ custom material snapshots
  └─ effective reference data (parameters, bands, matrices, rules, incentives)
       ↓
Package/line quantities and raw cost components
       ↓
Total true cost and median reference
       ↓
Quote/equipment/customer/job bands
       ↓
Base target + situational adjustments
       ↓
Stated-rate margin or fixed/adjusted target
       ↓
Recommended CMII
       ↓
Suggested price and KONE-specific suggested price
       ↓
Actual CMII, variance, incentives, approval and submission validation
```

### Input resolution

| Dependency | Exact resolution order or rule |
|---|---|
| Country | Estimate country; otherwise branch country |
| Province/state | Estimate building province/state; otherwise branch state/province |
| Use tax | Estimate `re_usetax` → estimate `re_usetaxpercentage` → `0` |
| Freight | Estimate `re_freight` → estimate `re_freightpercentage` → `0` |
| Mechanic rate | Exactly one active/effective branch + Mechanic + estimate-time-category rate row |
| Custom labor rate | Saved line `re_hourlycost`; at save, exactly one matching branch + line role + line time row |
| Parameters | All active/effective country-specific values for each code take precedence over global values; duplicate country/code is invalid |
| Incentives | All active/effective country rows if any country rows exist; otherwise all global rows. No per-threshold mixing |
| Margin rules | Exact estimate branch margin group, quote type, equipment band, customer band, and job-type band when quote type is QR |
| Primary equipment | Explicit primary line; otherwise lowest sequence, with null sequences last |
| OEM | First effective OEM rule whose keyword occurs in the primary saved OEM, case-insensitive; otherwise `OEM_DEFAULT_BAND`, then Low |
| Age | Saved primary `re_equipmentage`; not recomputed by the pricing plugin |
| Redundancy | `max(1, active equipment masters having the exact primary functional location)`; defaults to 1 when no primary master |
| Vertical | Estimate customer-vertical lookup; otherwise active customer-vertical row matching the primary snapshot vertical code |
| Reference date | UTC calendar day; effective rows require `effectiveFrom <= date` and blank `effectiveTo` or `effectiveTo >= date` |

## 5. Quantity and child snapshot formulas

### Equipment quantity

```text
AdditionalEquipmentCount
  = 0, if blank or left-trimmed value starts with "***"
  = count of nonblank comma-separated tokens, otherwise

N = max(1, EstimateEquipmentLineCount + AdditionalEquipmentCount)
```

The additional-equipment count does not deduplicate tokens.

### Package quantity

```text
Qp = count of validated saved assignment numbers
     when the package has an explicit subset

Qp = N
     when no subset snapshot is stored
```

Assignments must be an actual subset of the selected equipment. The assignment
does not independently multiply each custom child line.

### Draft package snapshots

```text
Saved package total hours
  = mechanic hours per unit * Qp

Saved package total material
  = Qp * (material-before-markup, if package-priced KONE)
  = Qp * material-cost-per-unit, otherwise
```

### Draft labor snapshot

```text
Saved hourly cost = R2(current resolved line rate)
Saved line total   = R2(hours * saved hourly cost)
```

The engine uses hours and the saved rate, not the saved rounded child total.

### Draft material snapshot

```text
E = quantity * effective precise unit cost

Saved unit cost     = R2(effective precise unit cost)
Saved extended cost = R2(E)
Saved tax amount    = R2(E * t)
Saved freight       = R2(E * f)
Saved total cost    = R2(E * (1 + t + f))
```

Package references use zero cost and have no tax/freight. The pricing loader uses
`re_unitcostprecise` when available, otherwise `re_unitcost`.

## 6. Authoritative server cost formulas

Let a material line `m` have quantity `qm`, effective unit cost `cm`, and flags
`tm` and `fm`.

```text
Em = qm * cm
Landedm = Em * (1 + (tm ? t : 0) + (fm ? f : 0))
```

| Result | Exact formula |
|---|---|
| Package labor hours `PH` | `sum(mechanicHoursPerUnit[p] * Qp)` |
| Package labor `PL` | `PH * r` |
| Standard package material `SM` | `sum(materialCostPerUnit[p] * Qp)` for non-custom packages |
| Ordinary CSTM package material `CM` | `sum(materialCostPerUnit[p] * Qp)` for custom, non-package-priced packages |
| Package-priced KONE material `KM` | `sum(materialBeforeMarkup[p] * Qp)` |
| Package material `PM` | `SM + CM + KM` |
| Standard package tax `PTs` | `SM * t` |
| CSTM package tax `PTc` | `CM * t` |
| Standard package freight `PFs` | `SM * f` |
| CSTM package freight `PFc` | `CM * f` |
| Package estimated cost `PE` raw | `PL + PM + PTs + PTc + PFs + PFc` |
| Additional labor `AL` | `additionalLaborHours * r` |
| Custom labor `CL` | `sum(customHours * (savedLineRate ?? r) * (multiplier ?? 1))`, custom path only |
| Material base `MB` | `sum(Em)` for custom-path material lines |
| Material landed `ML` | `sum(Landedm)` |
| Additional material + miscellaneous landed `AA` | `(additionalMaterial + additionalMisc) * (1 + t + f)` |
| Total additional `TA` raw | `AL + CL + ML + AA` |
| Total true cost `T` | `R2(PE + TA)` |

### Persisted cost outputs

| Result | Persisted value |
|---|---|
| Package labor hours | `PH` |
| Package labor cost | `R2(PL)` |
| Package material cost | `R2(PM)` |
| Package estimated cost | `R2(PE)` |
| Additional labor cost | `R2(AL)` |
| Custom labor cost | `R2(CL)` |
| Custom material cost | `R2(MB)` |
| KONE material cost | `R2(sum(KONE Landedm) + KM)` |
| Labor cost | `R2(PL + AL + CL)` |
| Material cost | `R2(PM + additionalMaterial + MB)` |
| Miscellaneous cost | `R2(additionalMisc)` |
| Use-tax amount | `R2(PTs + PTc + (additionalMaterial + additionalMisc + sum(tm ? Em : 0)) * t)` |
| Freight amount | `R2(PFs + PFc + (additionalMaterial + additionalMisc + sum(fm ? Em : 0)) * f)` |
| Total additional cost | `R2(TA)` |
| Total true cost | `R2(PE + TA)` |

KONE classification is explicit `IsKone` first. For legacy lines only, fallback is
case-insensitive vendor containing `KONE` or `Spares`, or part number containing
`KM` or `US`.

## 7. Median and classification calculations

### Median reference and quote type

```text
MedianRaw = T / (1 - MEDIAN_QR_MARGIN)
SavedMedian = R2(MedianRaw)

QuoteType = QR
  if T = 0 or MedianRaw >= QQ_THRESHOLD

QuoteType = QQ
  otherwise
```

Quote selection uses `MedianRaw`, not `SavedMedian`.

### Job-size complexity

A job-size row matches when:

```text
(minimum or 0) <= MedianRaw < maximum
```

A null maximum is unbounded. Only QR rows are used. Zero matches defaults the
complexity band to High with a warning. More than one match is invalid.

### Equipment band

```text
AgeBand = High if saved age exists and age >= AGE_THRESHOLD, else Low

EquipmentBand = High if no primary equipment master was found
EquipmentBand = Equipment matrix(OEMBand, AgeBand), otherwise
```

OEM selection is first matching active/effective keyword rule. Missing matrix rows
create warnings and can prevent a margin rule.

### Customer bands

```text
RedundancyBand:
  minimum <= RedundancyCount <= maximum

CustomerBaseBand
  = Customer Base matrix(VerticalBand or Low, RedundancyBand)

NationalAccountBand
  = Low if national account is "Yes"
  = High otherwise

CustomerBand = Medium if no primary equipment master was found
CustomerBand = Customer Final matrix(CustomerBaseBand, NationalAccountBand), otherwise
```

Unlike job size, redundancy uses inclusive maximum bounds.

### Job-type band

```text
JobTypeRating = Medium if blank
JobTypeBand   = Job Type matrix(JobTypeRating, JobSizeComplexityBand)
```

### Margin target

```text
QQ rule key = (QQ, EquipmentBand, CustomerBand)
QR rule key = (QR, EquipmentBand, CustomerBand, JobTypeBand)

BaseTarget = matched Margin Rule target

SituationalAdjustment = sum(adjustment of every applied rule where:
  type maps to an estimate input,
  normalized input matches,
  competing-bid paper gate is Non-KONE paper,
  and required paper type matches)

Target = BaseTarget + SituationalAdjustment, when BaseTarget exists
```

Paper input normalization maps:

```text
KONE / KONE PAPER -> KONE_PAPER
NON-KONE / NON-KONE PAPER / CUSTOMER PAPER -> NON_KONE_PAPER
```

## 8. Recommended margin and suggested-price formulas

### Stated-rate recommendation

When stated labor rate `s > 0` and a target exists:

```text
PackageMaterialStated =
  sum(
    package-priced KONE:
      materialBeforeMarkup[p]
    non-custom package:
      materialCostPerUnit[p] * (1 + t + f)
    custom ordinary package:
      materialCostPerUnit[p] * (1 + t + f)
    * Qp
  )

Custom or standard:
  StatedHours = packageHours + additionalLaborHours
  StatedLaborCost = StatedHours * r
  StatedMaterial = PackageMaterialStated + additionalMaterial + additionalMisc

Custom path adds:
  StatedHours += sum(custom labor hours)
  StatedLaborCost += sum(custom hours * (saved rate ?? r) * (multiplier ?? 1))
  StatedMaterial += sum(Landedm)

StatedCost = StatedLaborCost + StatedMaterial
StatedSell = StatedHours * s
             + StatedMaterial / (1 - max(MATERIAL_MARGIN_FLOOR, Target))

StatedRateMargin = (StatedSell - StatedCost) / StatedSell
```

If `StatedSell = 0`, StatedRateMargin is null.

### Recommended CMII precedence

```text
if stated labor rate > 0:
  Rec = StatedRateMargin
else if equipment type has FixedTargetCmii:
  Rec = FixedTargetCmii
else:
  Rec = Target
```

If stated labor rate is positive but its margin is null, no recommendation is
created. Any non-null `Rec` must satisfy `0 <= Rec < 1`.

### Non-KONE catalog/manual material repricing

For a custom-path estimate, let:

```text
NC = R2(sum(Landedm for every material classified Non-KONE))

NS = 0 when NC = 0
NS = NC / (1 - max(MATERIAL_MARGIN_FLOOR, Rec)) when NC > 0
```

The 2026.14 engine includes manual and catalog Non-KONE lines in this explicit
classification calculation. Their persisted catalog selling-price field does not
replace the calculation for suggested price.

### Base suggested price

```text
SuggestedPrice = R2((T - NC) / (1 - Rec) + NS)
```

### KONE selling contribution `KS`

Exactly one applicable route contributes `KS`:

| Route | `KS` |
|---|---|
| Package-priced KONE | `sum(materialCostPerUnit[p] * Qp)` using the final package material amount |
| Itemized catalog or manual KONE | `sum(qm * effectiveUnitSellingPrice[m] * (1 + (tm ? t : 0) + (fm ? f : 0) + markupPercent[m]/100))` |
| Legacy aggregate VK13 | `KoneSparesSalesPrice * (1 + KONE_SPARES_TAX + KONE_SPARES_FREIGHT + KONE_SPARES_MARKUP)` |

The KONE routes must not double-count. For a custom-path estimate with a KONE
route:

```text
SuggestedPriceWithKoneMaterial =
  R2(
    (T - KoneMaterialCost - NC) / (1 - Rec)
    + KS
    + NS
  )
```

This is null when there is no eligible KONE route.

## 9. Actual CMII, incentives, approval, and submission

### Actual and variance

For `S > 0`:

```text
ActualCMII = R4((S - T) / S)

Variance = ActualCMII - Rec, when Rec exists
```

Variance is a fraction. Multiply by 100 for display in percentage points. A
negative Actual CMII is valid and is not floored.

### Incentives

Select the greatest configured `MinimumCMII <= rounded ActualCMII`.

```text
AM raw = R0(S * selected AmPayout)
BD raw = R0(S * selected BdPayout)

if 500 <= S <= 5000:
  AM = max(75, AM raw) if AmPayout > 0, otherwise 0
  BD = max(75, BD raw) if BdPayout > 0, otherwise 0
else:
  AM = AM raw
  BD = BD raw
```

Duplicate incentive thresholds are invalid. Incentive rows are country-scoped
as a set.

### Approval

```text
Regional if S >= APPROVAL_REGIONAL
District if S >= APPROVAL_DISTRICT and S < APPROVAL_REGIONAL
None otherwise

RequiresApproval = ApprovalLevel != None
```

### Submission blockers

Submission fails when:

1. `S <= 0`;
2. Recommended CMII or Suggested Price is unavailable/invalid;
3. Variance is negative and Margin Comments is blank;
4. `S > DOWN_PAYMENT_THRESHOLD` and no billing plan is selected.

## 10. Catalog conversion and material routes

### Source validation

Catalog USD cost/price must be nonnegative for conversion, valid at at most six
source decimals, and bounded to `1,000,000,000`.

For MKO:

```text
fx = 1
uplift = 1
```

For non-MKO markets:

```text
fx = configured USD-to-CAD factor
uplift = configured cost-only factor
```

The current server implementation calculates:

```text
ConvertedUnitCost  = SourceCost  * fx * uplift
ConvertedUnitPrice = SourcePrice * fx * uplift
```

Both must be finite exact Dataverse decimals at no more than ten decimal places
and no greater than `1,000,000,000`. Invalid conversions are represented as
diagnostics, not rounded into validity.

### Effective cost and price precedence

```text
EffectiveUnitCost = re_unitcostprecise ?? re_unitcost
EffectiveUnitSellingPrice = re_sellingprice ?? re_unitpriceprecise
```

| Route | Cost | Selling contribution |
|---|---|---|
| Catalog KONE | Precise effective cost | Effective VK13/override with 10% markup |
| Catalog Non-KONE | Precise effective cost | Persisted diagnostic only for this pricing engine's recommended margin path |
| Unlisted/manual KONE | Positive entered cost | Positive entered selling price with 10% markup |
| Manual Non-KONE | Positive entered two-decimal cost | None; Non-KONE margin formula only |
| Package-priced KONE | Package `materialBeforeMarkup` as true cost | Final package `materialCostPerUnit` |
| Legacy aggregate VK13 | Not an itemized child cost | Header aggregate with configured KONE tax/freight/markup |

An explicit catalog `unitCostOverride` changes estimate `re_unitcostprecise`
without changing frozen source evidence in `re_catalogdetailsjson` or the Spare
Parts master.

## 11. Persistence map

`CalculationWriter` writes the following one-to-one mappings. Aliases store the
same value, not separate formulas.

| Engine result | Dataverse field(s) |
|---|---|
| Number of equipment | `re_numberofequipment` |
| Mechanic rate | `re_mechaniclaborrate` |
| Tax/freight | `re_usetax`, `re_usetaxpercentage`, `re_freight`, `re_freightpercentage` |
| Package labor hours/cost | `re_packagelaborhours`, `re_packagelaborcost` |
| Package material/estimated cost | `re_packagematerialcost`, `re_packageestimatedcost` |
| Additional/custom/labor/material/misc costs | `re_additionallaborcost`, `re_customlaborcost`, `re_custommaterialcost`, `re_konematerialcost`, `re_laborcost`, `re_materialcost`, `re_miscellaneouscost` |
| Tax/freight amounts | `re_usetaxamount`, `re_freightamount` |
| Additional/true totals | `re_totaladditionalcost`, `re_totaltruecost` |
| Median and bands | `re_medianmarginsellprice`, `re_quotetype`, `re_jobsizeband`, `re_oemband`, `re_equipmentageband`, `re_equipmentband`, `re_verticalband`, `re_redundancyband`, `re_redundancycount`, `re_customerbaseband`, `re_nationalaccountband`, `re_customerband`, `re_jobtyperating`, `re_jobtypeband`, `re_primaryequipmentfound` |
| Margin dependencies | `re_margingroup`, `re_marginrule` |
| Base target aliases | `re_basetargetcm2`, `re_basetargetcmii` |
| Adjustment aliases | `re_situationaladjustment`, `re_totaladjustment` |
| Target aliases | `re_targetcm2`, `re_adjustedtargetcmii` |
| Recommendation | `re_statedratemargin`, `re_recommendedcmii` |
| Suggested-price aliases | `re_suggestedprice`, `re_suggestedsellprice` |
| KONE suggested price | `re_suggestedpricewithkonematerial` |
| Actual/variance | `re_actualcmii`, `re_cmiivariance` |
| Incentives | `re_amincentive`, `re_bdincentive` |
| Approval | `re_approvallevel`, `re_requiresapproval` |
| Calculation evidence | `re_calculatedon`, `re_calculationversion` |

`re_cmiiwithkonematerial` is cleared but not calculated by this engine version.

## 12. Frontend and reporting calculations

These formulas are for presentation/audit only and must not replace server
pricing.

### Package preview

```text
Hours    = hoursPerUnit * Q
Labor    = Hours * mechanicRate
Material = materialPerUnit * Q
Total    = Labor + Material * (1 + taxPct/100 + freightPct/100)
```

Standard and ordinary custom package previews use the Page 4 request-level
rates. Blank means zero. Package-priced KONE preview uses true material before
markup and `0/0` tax/freight.

### CSTM combined preview

```text
Hours = predefined package hours + sum(custom labor hours)
Labor = predefined labor + sum(custom hours * rate)
Material = predefined material + sum(quantity * unit cost)
Total = predefined total
      + custom labor
      + custom material * (1 + t + f)
```

### Equipment-specific and average CSTM preview

For a custom line assigned to no equipment, its share on every equipment card is
`1/Q`. For a line assigned to a specific equipment number, its share is `1` for
that equipment and `0` for all others.

```text
Equipment unit hours =
  one-unit predefined hours + sum(custom line hours * line share)

Equipment unit labor =
  one-unit predefined labor + sum(custom hours * rate * line share)

Equipment unit raw material =
  one-unit predefined material
  + sum(custom quantity * unit cost * line share)

Equipment unit tax/freight =
  predefined unit tax/freight
  + shared material * entered tax/freight rate

Effective equipment labor rate =
  equipment labor / equipment hours, if hours > 0
  = package base rate, otherwise
```

The average CSTM unit divides combined hours, labor, material, and total by `Q`.
Its effective rate is `combined labor / combined hours`, or the base rate when
hours are zero.

### Additional-cost preview

```text
Additional =
  additional hours * mechanic rate
  + (additional material + miscellaneous)
    * (1 + taxPct/100 + freightPct/100)
```

### Labor-grid editor

Each displayed line is independently rounded:

```text
lineAmount = hours * rate
displayedLineTotal =
  Math.round((lineAmount + Number.EPSILON * max(1, lineAmount)) * 100) / 100
```

The grid sum can differ from the unrounded server custom-labor aggregate.

### Custom material editor

```text
VisibleMaterialTotal = sum(quantity * unitCost)
```

It excludes tax/freight and selling price.

### Billing split

```text
TotalCents = Math.round(Number(S.toFixed(2)) * 100)
DepositPercent = 50 or 60 from the selected plan
DepositCents = Math.round(TotalCents * DepositPercent / 100)
DownPayment = DepositCents / 100
FinalPayment = (TotalCents - DepositCents) / 100
```

The custom-notes plan displays no numeric split.

### Equipment age display

The browser derives an age only for display/defaulting:

```text
Browser age = current local year - construction year
```

It is usable only when the explicit age is invalid/absent and the construction
year is a positive integer no later than the current year. The server pricing
engine consumes the saved age snapshot and does not recalculate it from the year.

### Pricing chart

Values are first converted independently to integer cents:

```text
Packages  = round(packageEstimatedCost * 100)
Labor     = round(customLaborCost * 100)
Material  = round(customMaterialCost * 100)
Additional= round(totalAdditionalCost * 100)
Total     = round(totalTrueCost * 100)

Other = Additional - Labor - Material
```

The chart is invalid if `Other < 0` or `abs(Packages + Additional - Total) > 1`
cent. Share is `segmentCents / (Packages + Additional)`, or zero for a zero
denominator. The gauge clamps Actual CMII only for drawing:

```text
GaugeShare = max(0, min(1, ActualCMII))
```

Displayed Actual CMII remains unclamped.

### Dashboard

```text
Total = sum(status-group counts)
AverageCMII = sum(eligible saved ActualCMII) / eligible count
JobTypeShare = job-type count / total
StatusArc = status count / chart total
```

Eligible CMII rows require a non-null/non-`unavailable` calculation version,
calculated timestamp, positive sell price, and non-null Actual CMII. The average
is not selling-price weighted.

## 13. Import normalization and presentation calculations

### Custom-cost Excel decimal input

For an accepted two-decimal numeric import:

```text
scaled = enteredNumber * 100

accepted only if:
  abs(scaled - round(scaled))
  <= 2 * Number.EPSILON * max(1, abs(scaled))

normalized = round(scaled) / 100
```

This rejects excess precision rather than rounding arbitrary invalid input into
validity. KONE catalog cost/sell overrides are separately positive decimal
amounts at no more than ten places. Legacy seven-column material workbooks remain
accepted and use the catalog/default path for blank/zero KONE cost where
documented.

### Upstream master-data import

- MKO parts: selected USD amounts can be quantized to six decimals using
  `ROUND_HALF_UP`.
- MKO equipment: selected source coordinate/decimal fields can be quantized to
  eight decimals using `ROUND_HALF_UP`.
- Excel serial dates can be converted from `1899-12-30 + integer days`.

These transformations prepare master data. They are not estimate-pricing
calculations and must be audited separately before a downstream catalog snapshot.

## 14. Email and workbook calculations

Email and exports use saved/frozen values. They must be audited as presentation
derivations, not as pricing alternatives.

### Email billing

```text
cents = int(formatNumber(S * 100, "0", "en-US"))
depositCents = div(cents * depositPercent + 50, 100)
deposit = depositCents / 100
final = (cents - depositCents) / 100
```

### Email package row

```text
Package row hours =
  saved package re_totalhours + sum(custom labor child re_hours)

Package row labor =
  saved package re_totalhours * saved mechanic rate
  + sum(custom labor child re_totalcost)

Package row material =
  saved package re_totalmaterial
  + sum(material child re_extendedcost)

Package row total =
  saved package labor
  + saved package material * (1 + package tax + package freight)
  + sum(child labor totals)
  + sum(child material totals)
```

Package tax/freight are `0/0` for package-priced KONE and the saved request
fractions for every other package. These rows can differ from
engine totals because they use saved rounded child totals and exclude header-level
additions.

### Workbook output

Export freezes header/child values and maps them into a workbook. Variance is
written as:

```text
Workbook variance in percentage points = re_cmiivariance * 100
```

Fraction fields remain fractions and are formatted as percentages. Export does
not run a client-side PST calculator.

## 15. Complete audit procedure

For each estimate, record and retain:

1. Environment, estimate ID, revision, owner, status, currency, market, country,
   branch, calculation version, calculated timestamp, and exported snapshot ID.
2. Header inputs: entered sell, stated rate, additional labor/material/misc,
   aggregate VK13, tax/freight, job/customer situational values, billing plan,
   margin comments, and time category.
3. Effective reference date and every matched parameter, band, matrix, margin
   rule, adjustment, incentive row, labor rate, package, and catalog configuration.
4. Equipment snapshots and package assignments; compute `N` and every `Qp`.
5. Custom labor and material snapshots, including precise unit cost, selling
   price, classification, pricing mode, tax/freight flags, markup, catalog
   details, source currency, conversion factors, and package/equipment links.
6. Recompute raw package, labor, material, tax, freight, additions, `T`, and
   Median using unrounded intermediate values.
7. Reproduce every band and its exact matched reference-row ID. Treat missing or
   duplicate matches as audit failures/warnings, not defaults invented by the auditor.
8. Recompute target, stated margin, recommendation precedence, `NC`, `NS`, `KS`,
   base suggestion, and KONE suggestion.
9. Recompute Actual CMII from the rounded total true cost, then apply `R4` exactly.
10. Select incentive row, apply `R0`, then the inclusive `$500–$5,000` minimum.
11. Compare every persisted result and alias to the exact field map in section 11.
12. Reconcile totals with tolerance: exact raw decimal recomputation first, then
    cents/rounding; never expect separately rounded rows to equal an aggregate
    without an explicitly documented rounding difference.
13. Re-run the UI billing, email, dashboard, and workbook presentation separately.
14. Record expected result, actual saved result, absolute difference, cause,
    source rows, assembly/app deployment evidence, and pass/fail disposition.

## 16. Known audit gaps and non-formulas

1. Subcontractor cost and technician count are captured and reported, but are not
   added to or multiplied within the pricing engine formulas in this version.
2. `re_cmiiwithkonematerial` is cleared but not calculated.
3. SPIF and special over-$5,000 incentive expressions are not implemented because
   the approved source rows/formulas are not present.
4. The original PST/XLSM and stated 12-case sample batch are not in the repository;
   literal cell-by-cell PST parity cannot be proven from the available Word summary.
5. Dev-only `partMaterials.ts` is a prototype and not the production catalog engine.
6. A source/local test is not proof of tenant configuration, deployed plugin identity,
   live permissions, production export delivery, or mail-client rendering.
7. A tenant recalculation is required after a pricing-release change; historical
   estimates are not automatically recalculated.

## 17. Source and validation evidence

- Authoritative formulas: `backend-pricing/Pricing/PricingEngine.cs`
- Input resolution: `backend-pricing/Data/EstimateInputLoader.cs`,
  `backend-pricing/Data/ReferenceData.cs`
- Persistence: `backend-pricing/Plugins/CalculationWriter.cs`
- Snapshot/validation: `backend/DraftPlugin.cs`, `PartCatalog.cs`,
  `PackageMaterialPricing.cs`
- Browser calculations: `src/data/packageCosts.ts`, `customMaterialCosts.ts`,
  `laborGrid.ts`, `billingPayments.ts`, `pricingPresentation.ts`
- Reporting/export/email: `backend/DashboardReader.cs`,
  `backend-pricing/Automation/*`, Office Scripts, `automation/build-estimate-email-flow.mjs`
- Automated evidence: `backend-pricing-tests/PricingEngineTests.cs`,
  `PluginIntegrationTests.cs`, `backend-tests/DraftServiceTests.cs`, Node unit tests
  under `tests/`, and Playwright scenarios under `e2e/responsive.spec.mjs`

The document records source implementation and the local verification commands
used for the current merge. It does not record a production deployment or a
live-tenant calculation audit.

## 18. Team review guide: legacy workbook to application

### Executive explanation

The legacy Excel workbook was useful as a pricing aid, but some of its formulas
can hide a problem and still display a valid-looking number. The proposed
application rules make the source of every important number explicit, use the
configured business data instead of special-coded percentages, and stop a
recommendation when required configuration is missing or duplicated.

The goal is not to copy every Excel formula into the application. The goal is to
preserve the approved business calculation while removing Excel-only shortcuts
that can produce misleading results. The server remains the only authority for
Recommended CMII, Suggested Price, Actual CMII, incentives, and submission
validation.

### One-minute summary for the meeting

1. **Recommended CMII gets a clear order:** use a valid stated-rate margin
   first, otherwise an equipment-specific configured target, otherwise the
   adjusted target calculated from reference data.
2. **The application will not assume 65% for an equipment type.** A target comes
   from configuration; a separate `MATERIAL_MARGIN_FLOOR` can still be 65% when
   Finance has deliberately configured it there.
3. **Different material types can have different selling logic.** Standard cost,
   Non-KONE material, itemized/manual KONE, package-priced KONE, and legacy VK13
   must not be treated as one universal margin formula.
4. **Custom labor uses the saved rate for that labor line.** It is not silently
   priced at the estimate's mechanic rate.
5. **One optional Tax % and Freight % pair applies at the overall request
   level.** Blank means zero. This intentionally differs from the legacy
   workbook's multiple package/additional rates and fixed standard rates.
6. **Missing or conflicting configuration stops pricing.** The application must
   not replace a missing margin rule or rate with 0%, the first row, or another
   unexplained fallback.
7. **Calculations retain precision until their defined output point.**
   Recommended CMII is not rounded before Suggested Price, money is rounded to
   cents, Actual CMII to four decimals, and incentives to whole currency.
8. **Incentives do not change the price recommendation.** AM/BD payout comes
   after selling price and Actual CMII. SPIF and a special formula above $5,000
   remain out of scope until an approved formula and source data are supplied.

### Legacy Excel compared with the proposed application

| Topic | What the legacy workbook can do | What we are changing/retaining | Why it matters |
|---|---|---|---|
| Recommended CMII | Nest several `IF`/`IFERROR` decisions and may treat a failed result as `0%`, a blank, or a text `"65%"` | Use stated rate, configured equipment fixed target, then adjusted target. If the selected path cannot be calculated, return unavailable plus a reason | Prevents a false recommendation from looking valid and makes the priority testable |
| Equipment 65% rule | Can use a special hard-coded `"65%"` | Read the equipment target from the active configured record; keep 65% only when Finance configures it | A policy change becomes a data change with an audit trail, not a code release |
| Missing margin rule | `IFERROR(...,0)` can make no matched target appear to be 0% | No matched or invalid required rule means pricing unavailable and submission is blocked, unless a valid higher-priority stated-rate path applies | Avoids material underpricing caused by treating configuration failure as a real 0% margin |
| Standard Suggested Price | Divides all true cost by `1 - Recommended CMII` | Retain this route only when there are no special material routes | This remains the simple and expected standard estimate behavior |
| Non-KONE material | A universal formula can price landed material the same as other cost | Reprice eligible Non-KONE landed material using `max(MATERIAL_MARGIN_FLOOR, Recommended CMII)` | Protects the approved material margin without applying that floor to labor and unrelated cost |
| KONE material | Itemized, package, and aggregate KONE concepts can be mixed or fall into generic cost pricing | Keep itemized/manual, package-priced, and legacy VK13 routes separate; prevent the same material from contributing twice | KONE selling contribution can differ from true cost because catalog/package/markup data is authoritative |
| Stated rate with custom labor | Can use a common labor-rate assumption | Use package/additional hours at the mechanic rate and custom labor at each saved line rate | Prevents true-cost understatement when a specialized role rate is higher |
| Tax and freight | Can resolve from several workbook cells, defaults, and section-specific fields; standard package example is 5%/14% | Use one optional request-level pair on Page 4; blank = 0%; no province, branch or pricing-parameter fallback | Simpler user entry, one source of truth, and no double application. This is an approved business deviation from the workbook |
| Rounding | Excel rounding and display can be mixed across cells | Keep margin calculations at full precision; round money, Actual CMII, and incentives only at their defined outputs | Avoids large selling-price changes caused by rounding a margin before division |
| Duplicate configuration | `First`/lookup behavior or manual row order may choose one row | Reject more than one equally effective match | The same estimate cannot change price because of query or spreadsheet row order |
| Incentives | Formulas are downstream, but some workbook paths include incomplete SPIF or special large-job expressions | Calculate approved AM/BD payout only; do not calculate SPIF or an unspecified over-$5,000 amount | Keeps compensation calculations from silently affecting recommendation and avoids inventing policy |
| Browser/email/export | A workbook or display can recompute its own result | Server-saved values remain authoritative. Browser values are previews; email and export freeze or derive presentation from saved data | Users see one approved result rather than competing calculations |

### How Recommended CMII is selected

```text
IF StatedLaborRate > 0:
    calculate and use StatedRateMargin
    if its required selling calculation is invalid, stop pricing
ELSE IF EquipmentType.FixedTargetCmii has a configured value:
    use that configured value
ELSE:
    use AdjustedTargetCmii
```

Example:

| Stated rate margin | Equipment fixed target | Adjusted target | Recommended CMII |
|---:|---:|---:|---:|
| 52.84% | 65% | 45% | **52.84%** |
| Not provided | 60% | 45% | **60%** |
| Not provided | Not configured | 47% | **47%** |
| Required but cannot be calculated | 65% | 45% | **Unavailable; do not fall through** |

Why this order: an explicit stated selling-rate input is the most specific
pricing instruction. An equipment-specific configured target is next. The
general adjusted target is used only when neither specific route applies.

### Suggested Price routes in simple terms

#### Standard estimate

```text
Suggested Price = Total True Cost / (1 - Recommended CMII)
```

At `$10,000` true cost and `45%` recommendation, Suggested Price is
`$18,181.82`.

#### Non-KONE material

```text
Non-KONE Selling =
    Non-KONE Landed Cost
    / (1 - max(MATERIAL_MARGIN_FLOOR, Recommended CMII))

Suggested Price =
    (Total True Cost - Non-KONE Landed Cost) / (1 - Recommended CMII)
    + Non-KONE Selling
```

Using `$10,000` total true cost, `$2,000` Non-KONE landed cost, a `45%`
recommendation and a configured `65%` material floor:

```text
Ordinary contribution: 8,000 / 55%        = 14,545.45
Non-KONE contribution:  2,000 / 35%        =  5,714.29
Final Suggested Price                     = 20,259.74
```

The universal Excel-style result would be `$18,181.82`, an understatement of
`$2,077.92` in this example.

#### KONE material

The app keeps the following routes exclusive:

1. **Itemized/manual KONE:** quantity times effective selling price, then
   applicable request tax/freight and the approved line markup.
2. **Package-priced KONE:** saved final package material amount. Its package
   reference lines do not add a second cost or sale.
3. **Legacy aggregate VK13:** aggregate amount times configured KONE
   tax/freight/markup. This route is used only where the legacy input is the
   active source.

The server subtracts eligible KONE/Non-KONE true cost from the ordinary
recommendation-priced base, then adds each approved selling contribution once.
Only one applicable KONE route may supply the same material amount.

### Why a team may see a different result from Excel

A change can be correct even when the displayed number differs from the
workbook. The most important valid reasons are:

| Visible difference | Expected reason |
|---|---|
| Lower/higher Suggested Price near a 65% display | The old workbook used 65% as a special equipment assumption; the app uses a configured equipment value, while a separately configured material floor can remain 65% |
| Suggested Price higher on custom Non-KONE material | The app applies the approved material floor to that material contribution instead of applying the general recommendation to every dollar |
| Custom labor cost changes | The saved role/time-specific labor rate differs from the estimate mechanic rate |
| A few cents differ across display rows | The server rounds raw aggregates once, while saved/displayed child rows may each already be rounded |
| Suggested Price changes by hundreds of dollars after a tiny percentage adjustment | Recommended CMII is the denominator; it remains full precision and is not rounded before division |
| Pricing is blank/unavailable instead of showing 0% | A required reference rule, rate, or stated-rate selling calculation is missing or invalid |
| Tax/freight changes from the workbook | The approved app design uses the one optional Page 4 pair and does not use the workbook's fixed/section-level defaults |

### Simple impact of the rounding change

With `$10,000` true cost and exact recommendation `64.5%`:

```text
Use 64.5%: $10,000 / 35.5% = $28,169.01
Round first to 65%: $10,000 / 35% = $28,571.43
Difference caused by early rounding = $402.42
```

The difference is not a cent-rounding defect. It is caused by changing the
margin input before the division. The proposed application keeps `64.5%` until
the final Suggested Price is rounded to cents.

### Confirmed Tax/Freight policy for this application

This is the current approved business policy for team review:

- Add one Tax % field and one Freight % field on Page 4.
- Both fields are optional.
- Blank, null, and omitted values mean `0%`.
- Entering `5` in the UI means `0.05` in the server calculation.
- Do not use province, branch, or pricing-parameter tax/freight as fallback.
- Do not keep separate Tax/Freight percentage inputs in package or additional
  cost sections.
- Apply the pair to eligible standard/CSTM package material, itemized material,
  additional material, and miscellaneous material according to the route.
- Keep package-priced KONE exempt from another request-level markup.

This differs from the workbook's sample 5% tax, 14% standard-package freight,
section-specific rates, and multi-level fallback. It should be treated as an
approved product-policy change rather than hidden as a technical fix.

### Configuration failures and user experience

The current proposal does not silently select a value when configuration is
ambiguous.

| Configuration state | Application behavior |
|---|---|
| Exactly one valid effective match | Use it and retain its selected record ID for audit |
| No documented fallback and no row | Return a specific validation error; pricing unavailable |
| More than one equally valid row | Return a duplicate-configuration error; do not pick first/newest |
| Documented default exists | Use it only for the named input and show it in trace/audit information |
| Stated rate is positive but stated selling value is invalid | Block that path; do not continue to fixed or adjusted target |

Examples of support-friendly messages:

```text
No active margin rule matched the branch margin group, quote type,
equipment band, customer band, job-type band and calculation date.

More than one active labor rate matched the branch, labor role,
time category and calculation date.

A stated labor rate was provided, but the stated-rate selling value
could not be calculated.
```

### Potential business impact

| Change | Who may notice | Typical impact | Benefit |
|---|---|---|---|
| Strict missing/duplicate validation | Estimators, administrators, support | A request stops calculating instead of returning a number from bad data | Prevents false, support-hard-to-explain prices |
| Fixed-target configuration | Finance/configuration owners, estimators | Recommended target can change when the equipment record differs from the old assumed 65% | Correct target is controlled by approved data |
| Separate material routes | Estimators with custom material | Suggested Price may rise/fall compared with `Total Cost / (1 - Rec)` | Correct selling contribution for KONE and Non-KONE material |
| Saved custom labor rates | CSTM users | True cost and suggested price reflect specialist/role rates | Prevents using the wrong labor cost |
| One request-level Tax/Freight pair | All estimators | Less repeated entry and no section-specific percentage controls | Removes inconsistency and double counting |
| Full-precision margin | Cases near a percentage threshold | Small displayed-margin difference can cause material dollar impact | Preserves the exact business calculation |
| Incentives after pricing | Sales/BD/AM users | AM/BD payout does not alter Suggested Price; SPIF remains absent | Clear separation of compensation and price |
| Server authority | Reports, email, exports and users | Presentations reflect saved server outputs rather than their own pricing calculations | One reconciled result across channels |

### What is already present in local source versus what remains

This is source status, not deployment status.

| Status | Scope |
|---|---|
| Present in local source | Recommendation precedence; configured equipment fixed target; standard/Non-KONE/KONE price routes; saved custom labor rates; full-precision recommendation; exact server rounding; inclusive AM/BD $75 minimum; one Page 4 request-level Tax/Freight pair |
| Planned critical correction | Do not load a missing margin-rule target as `0m`; strengthen missing/duplicate checks for required values and selected records |
| Planned auditability | Persist/export selected configuration IDs, route, raw contributions, source, and clearer validation trace where current fields do not exist |
| Intentionally not implemented | SPIF and an unspecified special incentive formula above $5,000 |
| Requires tenant confirmation | Effective pricing parameters, margin rules, equipment targets, labor rates, incentive rows, permissions, and actual deployed assembly/app versions |

### Decisions the team must confirm before development/deployment

1. Confirm the Recommended CMII precedence:
   stated rate → equipment fixed target → adjusted target.
2. Confirm the Page 4 Tax/Freight policy supersedes workbook
   province/branch/parameter fallback and standard package-specific rates.
3. Confirm that package-priced KONE remains exempt from a second
   request-level Tax/Freight application.
4. Confirm the current `MATERIAL_MARGIN_FLOOR` and equipment fixed-target
   records by country/scope; do not infer that both should be 65%.
5. Confirm the applicability rules and markup source for itemized/manual KONE,
   Non-KONE material, and legacy VK13.
6. Confirm that missing/duplicate required configuration blocks submit and
   displays a specific error rather than a default.
7. Confirm that SPIF and a special over-$5,000 incentive remain excluded until
   Finance supplies an approved formula and source data.
8. Approve the representative test cases and dollar outcomes in section 18.

### Recommended team acceptance evidence

For each approved formula path, Finance should provide or approve at least one
complete case containing:

1. The original workbook inputs and cell references.
2. The effective date and every selected configuration/rate record.
3. Expected true cost, recommendation source, Recommended CMII, Suggested
   Price, Actual CMII, and incentives.
4. The expected result for a missing rule and a duplicate rule.
5. The expected Page 4 Tax/Freight behavior for blank, zero, and positive
   rates.
6. Saved Dataverse input/output values and the server calculation version.
7. The same result in the UI, email, dashboard, and export.

At minimum, test one standard case, one stated-rate case, one fixed-target case,
one adjusted-target case, one Non-KONE case, each KONE route, one saved custom
labor case, one missing configuration case, one duplicate configuration case,
and incentive boundaries just below/at/above each configured threshold.

### Rollout safeguards

1. Do not deploy frontend, Draft plugin, and Pricing plugin independently when
   the change depends on their shared input/output contract.
2. Keep the existing strong-name identities for the two plugin assemblies.
3. Compare old and new results for an approved sample set before enabling
   submissions.
4. Treat a difference as expected only when it maps to one of the documented
   rule or configuration changes above.
5. Preserve server error reasons in logs/support records; a generic “pricing
   unavailable” is not sufficient for reconciliation.
6. Recalculate representative existing Draft records under the new version;
   historical Submitted estimates must not be silently rewritten.
7. Verify the deployed calculation version, effective configuration records,
   permissions, email flow connection reference, export values, and UI behavior
   in Dev before production.
8. Record deployment evidence separately from local unit/integration tests.
   Passing local tests does not prove tenant data or deployment parity.

### Status caveat

The calculation audit and plan describe current workspace source and proposed
changes. They are not proof that the current tenant has the required
configuration, that a matching plugin/frontend build is deployed, or that the
original Excel sample set has passed comparison. Those are separate acceptance
gates.
