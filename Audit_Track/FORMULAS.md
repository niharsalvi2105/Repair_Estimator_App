# Repair Estimator formula reference

This reference describes the **current workspace source**, including pricing engine **2026.14** and local manual KONE changes. It is not proof that those assemblies or the matching frontend are deployed. It covers business calculations and their inputs, financial displays, and export calculations; incidental arithmetic for paging, layout, and file limits is intentionally outside scope. The original PST workbook/macros and original sample batch are not available here. Tenant-only formulas, rollups, flow revisions, data values, and original PST parity are not verified by this reference.

| File | What it covers |
|---|---|
| [Consolidated calculation audit](CALCULATION-AUDIT.md) | Complete formula inventory, dependency graph, Dataverse result map, authority layers, rounding, and repeatable Finance audit procedure |
| [Server pricing](FORMULAS-pricing.md) | Engine rules, costs, selling prices, all CMII paths, bands, incentives, approval, validation, and persisted outputs |
| [Dataverse inputs and draft formulas](FORMULAS-inputs.md) | Tables and columns, lookup precedence, equipment/package quantities, snapshots, conversion, custom material routes and rounding |
| [Browser, reports, and export](FORMULAS-display-export.md) | Package and equipment previews, billing, dashboard, charts, Excel input/output, and email calculations |
| [PST/source-sheet validation](FORMULAS-VALIDATION.md) | Formula-by-formula comparison with the supplied calculation reference and the exact rounding points |

## What number should Finance use?

The estimate fields written by [CalculationWriter](../backend-pricing/Plugins/CalculationWriter.cs#L12-L78) are authoritative for that calculation version. Draft child amounts are snapshots; the pricing engine recomputes headline values from their inputs. Browser previews are indicative. Export uses frozen values; the email generator also derives per-package rows and billing splits. Do not mix these layers in a reconciliation, or add informational subtotals to the total a second time.

`0.05` means 5% on the server for tax, freight and margin. Draft form/exported draft payload controls use `5`; itemized `re_markuppct` also uses `10` for 10%. CMII variance is a **difference in margins**, displayed in percentage points.

**Finance checks:** Record environment, request ID, `re_calculationversion`, `re_calculatedon`, reference rows and effective date, raw inputs/units, exact expected values and actual saved values, and export snapshot if applicable. Compare current and original PST only when the original data and calculation rules are available. Relevant evidence sources: [pricing formula tests](../backend-pricing-tests/PricingEngineTests.cs), [Dataverse pipeline tests](../backend-pricing-tests/PluginIntegrationTests.cs), [draft harness](../backend-tests/Program.cs), [pricing UI tests](../tests/pricing-presentation.test.mjs), and [browser scenarios](../e2e/responsive.spec.mjs). A source test is not a Finance or live UAT sign-off.

## Rounding in one minute

There is no application-wide `ROUNDUP`. Server monetary outputs use decimal `ROUND(...,2)` with midpoint values rounded away from zero, actual CMII uses `ROUND(...,4)`, and AM/BD incentive compensation uses `ROUND(...,0)`. Recommended CMII, stated-rate margin, target CMII and their downstream denominators retain full decimal precision. Final suggested prices round to cents. Rounding the margin itself to 65%, when the actual computed value is 64.5%, is not the app behavior and produces a substantially different price. See the exact comparison and boundary effects in [PST/source-sheet validation](FORMULAS-VALIDATION.md).
