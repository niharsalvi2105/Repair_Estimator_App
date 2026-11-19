# Authoritative pricing formulas

[Formula index](FORMULAS.md) | [Input sources](FORMULAS-inputs.md)

Source: [PricingEngine.Calculate and Validate](../backend-pricing/Pricing/PricingEngine.cs#L13-L177), [CalculateCost](../backend-pricing/Pricing/PricingEngine.cs#L179-L225), [rule helpers](../backend-pricing/Pricing/PricingEngine.cs#L228-L355), [models and constants](../backend-pricing/Pricing/PricingModels.cs).

## Cost construction

Notation: `R2` = decimal rounding to two places, midpoint away from zero; `r` = mechanic rate; `t`, `f` = resolved tax/freight fractions; `AH`, `AM`, `AX` = additional labor hours, material, miscellaneous. `N = max(1, active equipment line count + additional equipment count)`. For package `p`, `Qp = assigned equipment count ?? N`. A line's equipment assignment does **not** multiply its cost.

For material line `m`, `E = quantity * effective unit cost`; `mt = t` if tax flagged, else `0`; `mf = f` if freight flagged, else `0`; `Landed = E * (1 + mt + mf)`. Sum custom lines only on the custom path. KONE classification uses explicit type first, otherwise case-insensitive substring match: vendor contains `KONE` or `Spares`, or part contains `KM` or `US`. Package references carry zero cost and no tax/freight.

| Quantity or result | Formula |
|---|---|
| Package hours `PH` | `sum(package mechanic hours/unit * Qp)` |
| Package labor `PL` | `PH * r` |
| Standard package material `SM` | `sum(standard package material/unit * Qp)` |
| Ordinary CSTM package material `CM` | `sum(non-package-priced CSTM material/unit * Qp)` |
| Package-priced KONE true material `KM` | `sum(package material-before-markup/unit * Qp)` |
| Package material `PM` | `SM + CM + KM` |
| Package tax `PT` and freight `PF` | `PT = SM * .05 + CM * t`; `PF = SM * .14 + CM * f`; no tax/freight on `KM` |
| Package estimated cost `PE` | `PL + PM + PT + PF` |
| Additional labor `AL` | `AH * r` |
| Custom labor `CL` | `sum(hours * (line rate ?? r) * (line multiplier ?? 1))` on CSTM; otherwise zero. The live loader supplies saved rate and no multiplier. |
| Custom material base `MB`, landed `ML` | `sum(E)` and `sum(Landed)` |
| Total additional cost `TA` | `AL + CL + ML + (AM + AX) * (1 + t + f)` |
| Total true cost `T` | `R2(PE + TA)` |

Other persisted amounts: `PackageLaborCost = R2(PL)`, `PackageMaterialCost = R2(PM)`, `PackageEstimatedCost = R2(PE)`, `AdditionalLaborCost = R2(AL)`, `CustomLaborCost = R2(CL)`, `CustomMaterialCost = R2(MB)`, `KoneMaterialCost = R2(sum(KONE Landed) + KM)`, `LaborCost = R2(PL + AL + CL)`, `MaterialCost = R2(PM + AM + MB)`, `MiscellaneousCost = R2(AX)`, `UseTaxAmount = R2(PT + (AM + AX + sum(tax-eligible E)) * t)`, `FreightAmount = R2(PF + (AM + AX + sum(freight-eligible E)) * f)`, `TotalAdditionalCost = R2(TA)`. Hours and mechanic rate aren't passed through `R2` by the engine. `T` uses unrounded `PE` and `TA`, so adding individually rounded outputs can differ by a cent. Several outputs overlap: never add tax/freight again to `PE`, `TA`, or `T`.

## Quote, bands, and margin target

| Stage | Rule and dependencies |
|---|---|
| 11–12: median and quote | `median = T / (1 - MEDIAN_QR_MARGIN)`; saved median is `R2(median)`. QR if `T = 0` or **unrounded** `median >= QQ_THRESHOLD`; otherwise QQ. Median margin must be `[0,1)`. |
| 13: job size | QR size rows for **both** quote types: `min <= median < max`, null min = zero, null max = unbounded. No match: High plus warning; duplicates fail. |
| 14–16: equipment | OEM = first returned rule with a nonblank keyword contained in snapshot OEM (case-insensitive), else `OEM_DEFAULT_BAND` or Low. Age is High iff present and `>= AGE_THRESHOLD`, else Low. Equipment = High if no resolved primary master, else Equipment matrix `(OEM, Age)`. |
| 17–21: customer | Blank vertical = Low for the matrix. Redundancy band uses `min <= count <= max` (same null bounds as job size); missing warns, duplicates fail. Customer Base matrix `(vertical, redundancy)`. National Account = Low for Yes, High otherwise. Customer = Medium without primary master, else Customer Final matrix `(base, national-account)`. |
| 22–23: job type | Blank job-type rating = Medium. Job Type matrix `(rating, job-size complexity)`. |
| 24–26: target | Match branch margin-group rule on quote, equipment band and customer band, plus job-type band only for QR. Missing prerequisite/match yields no base; duplicates fail. `Target = base target CMII + sum(applicable situational adjustments)`; null if no base. |

Matrix match: type plus both inputs using trimmed case-insensitive text; duplicate match fails and missing match warns. Adjustment rows must be applied and match their mapped input (emergency, customer budgeted, competing bids, or paper type); competing bids count only on non-KONE paper. If a row requires a specific paper type, that gate also applies. KONE/KONE Paper normalize to `KONE_PAPER`; Non KONE, Non KONE Paper and Customer Paper normalize to `NON_KONE_PAPER`; unknown rule types warn.

## Recommended CMII, selling prices, and incentives

**27–28, stated rate:** Only runs for a positive stated labor rate and a non-null target. `SH = PH + AH + (sum CSTM line hours on the custom path)`. `SB = SM*(1+.05+.14) + CM*(1+t+f) + KM + ML + AM + AX`. `StatedLaborCost = (PH+AH)*r + sum(CSTM line hours * (saved line rate ?? r) * (multiplier ?? 1))`; `StatedCost = StatedLaborCost + SB`; `StatedSell = SH*stated hourly rate + SB/(1-max(MATERIAL_MARGIN_FLOOR, Target))`; `StatedMargin = (StatedSell-StatedCost)/StatedSell`, null for zero stated sell. Floor and target must be `[0,1)`. Recommended is stated margin when stated rate is positive (even if null), else equipment-type fixed target if present, else adjusted target. Non-null recommendation outside `[0,1)` fails.

Pricing 2026.13 uses each saved custom labor line rate in stated cost. Package labor and estimate-level additional labor still use the estimate mechanic rate. Stated cost includes additional material/misc without tax/freight on those two inputs, as shown by the workbook path; true cost taxes/freights those additions. This can therefore still differ from true cost independently of labor.

**29, suggested pricing:** Let `d = 1 - Recommended`. For all custom material lines classified Non-KONE, `NC = R2(sum(Landed))`; `NS = NC/(1-max(MATERIAL_MARGIN_FLOOR, Recommended))`; both are zero when there is no Non-KONE material. Classification uses the explicit part type, then legacy vendor/part heuristics. `MATERIAL_MARGIN_FLOOR` and the divisor must be valid only when `NC > 0`.

| Output | Formula |
|---|---|
| Suggested price | `R2((T - NC)/d + NS)` |
| Suggested with KONE | `R2((T - saved KoneMaterialCost - NC)/d + NS + KS)`, only on CSTM with one of the eligible KONE routes below. |
| `KS`: package-priced KONE | `sum(final package material/unit * Qp)`; price is not the material-before-markup amount. |
| `KS`: itemized KONE (catalog or explicit manual KONE) | `sum(quantity * effective unit selling price * (1 + mt + mf + markupPct/100))` |
| `KS`: legacy aggregate VK13 | `aggregate spares selling input * (1 + KONE_SPARES_TAX + KONE_SPARES_FREIGHT + KONE_SPARES_MARKUP)` |

The KONE routes are mutually exclusive where they would double-count. A manual Non-KONE line is cost-only, not a catalog Non-KONE selling substitution. No recommendation means no suggested price.

**30–34:** For entered `Sell > 0`, `Actual = Round((Sell - T)/Sell, 4, AwayFromZero)`; `Variance = Actual - Recommended` when both exist. Actual is **not floored at zero**. Incentives select the greatest minimum CMII `<= Actual` and round `Sell * AM_PAYOUT` and `Sell * BD_PAYOUT` independently to whole currency units, away from zero. For `500 <= Sell <= 5000`, each positive configured payout is raised to at least 75; zero-payout rows remain zero. This implements the documented minimum without inventing SPIF rows or rates. Duplicate thresholds fail. No matching payout defaults to zero and normally warns; a negative actual with a zero-threshold/zero-payout row is exempt from that warning. Approval is Regional if `Sell >= APPROVAL_REGIONAL`, else District if `Sell >= APPROVAL_DISTRICT`, else None; requires approval iff not None. Submission requires positive sell, available valid pricing, a margin comment if variance is negative, and a billing plan when `Sell > DOWN_PAYMENT_THRESHOLD` (strictly greater).

## Saved results and availability

[CalculationWriter](../backend-pricing/Plugins/CalculationWriter.cs#L12-L110) maps every output and alias to the logical names in [Names.Estimate](../backend-pricing/Infrastructure/Names.cs#L31-L130). The base target, adjustment, adjusted target and suggested price each have duplicate storage aliases, not separate calculations. `re_cmiiwithkonematerial` is on the clear list but isn't calculated by this engine. `re_subcontractorcost` and number of technicians are captured, not added/multiplied into these totals.

[EstimateCalculationPlugin](../backend-pricing/Plugins/EstimateCalculationPlugin.cs#L17-L77) runs synchronously on the estimate; it needs the Update pre-image, equipment and packages, and rejects unavailable suggested price or engine warnings. In a draft it clears output fields and marks `re_calculationversion = unavailable`; non-draft failures block the write. A completed calculation stores the engine version and UTC time. Tagged draft-child updates defer pricing until a coherent estimate update; direct relevant child changes have a [recalculation trigger](../backend-pricing/Plugins/ChildChangeTriggerPlugin.cs). Export has its own server validation and snapshot path.
