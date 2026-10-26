# KONE Repair Estimator Code App

React/TypeScript Power Apps Code App using generated Dataverse services. No
browser SQL connection, separate authentication flow, local operational record
store, or selectable demo roles.

## Local development

```powershell
npx playwright install chromium
npm run validate
pa app run
```

Use the **Local Play** URL printed by the Power Apps Vite plugin and sign in.
Opening the Vite URL alone is useful for visual development, but does not supply
authenticated player context. Requests time out explicitly rather than remain
in an indefinite loading state. A CLI sign-in is not a browser sign-in.

## Current integration

- Header avatar: initials from the signed-in user's name, in a fixed 44px
  circle with the full name as its accessible label and tooltip. No profile
  photos are requested or stored; the app has no Office 365 Users connector
  dependency. Missing names use a neutral `?` marker.

- Signed-in identity: `getContext()` from the Power Apps SDK. A linked Dataverse
  user ID and Entra object ID are required.
- Role discovery: generated `RetrieveAadUserRoles`, including direct and
  team-inherited assignments. The repository accepts the OData collection
  envelope (`{ value: [...] }`) passed through by the SDK as well as a raw role
  array. Missing or malformed responses remain errors, not empty role lists.
- Capability checks: generated `RetrieveUserPrivilegeByPrivilegeName`, including
  team Basic privileges. Estimate Read and Create are checked separately using
  exact privilege names retrieved from the estimate table's `Privileges`
  metadata, never names constructed from its logical name.
- Repair Requests and the dashboard request panel: server-filtered
  active estimates, 25 records per page using SDK continuation tokens. The
  server enforces which records are accessible; the UI does not fetch the entire
  estimate table or calculate organization-wide metrics from a page. Drafts have
  an Open action; reopening requires the draft API described below.
- Request fields: live branches, equipment types and job types; bounded,
  debounced equipment and standard-package searches. French reference labels
  fall back to English. Province/state, branch currency and explicit estimate
  title are included in draft capture.
- Dataverse errors and access-check failures are surfaced. Unknown users,
  missing app roles and failed permission checks do not enable request creation
  or administration. Permission checks are cached for the current app session;
  reload the app after role changes.

Generated files under `src/generated` and `.power` must be regenerated with the
CLI, not edited by hand.

## New request workflow

Desktop navigation uses a compact 240px sidebar, reduced branding, 44px action
targets and consistent outline SVG icons. Narrow screens retain bottom navigation.
The supplied JPEG logo is imported from application assets and embedded by Vite
as a data URL, rather than requested from a root-relative public URL. This keeps
it available under the published Power Apps hosting path as well as locally.
Navigation has no independent scroll container. Only widths up to 640px use
compact bottom navigation for the three available workspaces. Wider windows
keep left navigation with icons and labels horizontally aligned, including on
short laptops and landscape tablets. At heights up to 800px, branding and spacing
compact; at heights up to 640px, already-disabled future sections are hidden to
keep available workspaces accessible. Disabled sections are also hidden on mobile.
Bottom safe-area padding keeps navigation and page content clear of device
gesture areas.

Opportunity details use two labelled field groups, a bounded reading width and
compact 44px controls. Signed-in salesperson is visually read-only, distinct
from editable fields. Fields stack on narrow/tablet screens, with 16px mobile
input text for legibility and to avoid focus zoom in mobile Safari.

The header includes an MKO / CKE / CKQ market selector (initially MKO).
Branches are limited to that market and request lists apply the corresponding
`re_market` filter server-side. Changing market resets request-list paging.
The Branch combobox filters accessible, loaded branches by name or number as
the user types (case-insensitive substring search). Arrow keys and Enter select,
Escape dismisses without changing the branch, and Tab leaves the control without
committing typed text. Unmatched text cannot become a branch lookup.
If a draft has a branch, switching market asks for confirmation before clearing
its branch/equipment/package selections and returning to opportunity details.
This applies before the first save; saved drafts lock the market and branch,
and New draft starts a separate record. Other entered fields are retained for
review when changing an unsaved draft's market. Market selection is a workspace
filter, never an authorization boundary. Selecting CKQ automatically switches
the UI language to French and saves French / `fr-CA` in user preferences,
preserving the theme. Cancelling a market switch changes neither preference nor
market. MKO and CKE preserve the current UI language; users can still change it
manually. Proposal language remains independent. Market selection is disabled
while preferences are loading or saving so the automatic change is not lost.

The header theme selector supports System, Light and Dark across the entire
workspace. System follows device theme changes.
The supplied KONE asset is JPEG, not vector artwork. An inline SVG color filter
turns its blue background and letter cutouts transparent while retaining the
white logo tiles, allowing the sidebar color to show through in either theme.
The source image and logo proportions are unchanged; this does not convert the
JPEG into a vector logo.

After authentication the app reads `re_appuserpreference` by the signed-in
Dataverse User lookup. If no record exists it creates one with Name, User,
Preferred Language (English initially), Preferred Locale (`en-US` initially),
Preferred Theme (System) and active state. Existing saved preferences are loaded,
not overwritten; missing theme/locale/name on older records are populated.
Theme and UI-language changes save to the same record. Changing UI language also
sets its locale (`en-US` or `fr-CA`), never proposal language. Market is not saved:
the preference table has no market column.

Controls are disabled during initial loading and writes to serialize changes.
Save failures show an explicit unsaved notice and Retry; no localStorage fallback
or false success. A missing/inactive/duplicate preference record is an explicit
error. The User alternate key prevents duplicate users, including concurrent
browser sessions; if a concurrent create fails, retry reloads the existing record.
The generated live theme values are System `126110000`, Dark `126110001`,
Light `126110002`. No generated source was edited by hand.

Grant own-record Read/Create/Write on App User Preference and appropriate
Append/Append To on its User lookup. Dataverse must prevent users from modifying
another user's preferences; filtering in React is not authorization. This is the
first enabled write surface. Estimate transaction writes require the separately
deployed draft API below.

The original equipment-first three-step skeleton has been replaced with:

1. **Opportunity details**: signed-in salesperson, branch, building, equipment
   type, optional job type and supervisor, work-centre request, technician count,
   approval indication, National Account, emergency, subcontractor cost, budget,
   paper type, consultant, competing bids, stated billing rate and proposal language.
2. **Equipment & packages**: existing branch-scoped equipment search, explicitly
   unbound equipment entry and up to three standard packages.
3. **Cost inputs**: time category, additional labor hours/material/miscellaneous,
   use-tax/freight percentages and additional scope. No client cost calculation.
4. **Pricing & margin**: entered sell price, billing plan and margin comments.
   Saved server pricing summary, also shown prominently in the final Review stage.
5. **Review**: customer/contact and building confirmation, partner identifiers
   and CTT notes, selected equipment/package summary. Save draft is enabled when
   the required inputs are complete; submission remains unavailable.

This sequence uses the production MKO `KTOC PSR Estimator` header/cost/pricing
sections and generated live `re_` fields/choices, not a new start-estimator form.
The transcript adjusts the workbook: supervisor is optional and customer contact
is confirmed at review. Proposal language is independent of the UI language.
Equipment quantity is derived from selections, not a second conflicting input.
Inputs survive in-app navigation; leaving/reloading warns about unsaved changes.
Changing branch requires confirmation before clearing selected equipment/packages.

This is **not workbook pricing parity or a complete operational workflow**.
Custom/T&M line entry and submission remain unconnected.
Draft save, snapshots and required-field capture are prepared locally but need
the administrator rollout below. The displayed salesperson is the authenticated
user on create and the saved salesperson on reopen; creating on behalf of another
salesperson is not implemented. The coordinated pricing plug-ins below calculate
server outputs when installed together; the app reads those saved outputs through
the existing generated Estimate service using the signed-in user's permissions.
This is not a replacement for a legacy pricing editor.

The Pricing & Margin and Review summary shows total true cost, saved selling
price, suggested price, base/recommended/actual CMII, variance in percentage
points and AM/BD incentives, with calculation time and version. Percent values
are Dataverse fractions, displayed as percentages; money uses the saved estimate's
currency lookup, resolved against loaded currencies, never a hardcoded USD.
UI language selects English/French labels and locale independently of proposal
language. Summary cards stack on phones and wrap large negative margins.

Pricing is fetched after save/reopen when the user views either summary stage.
The retrieved row version must match the editor's saved version; concurrent
updates require a draft reload. Unsaved edits leave the previous saved results
visible with a prominent out-of-date notice. New drafts show a save prompt,
unavailable/uncomputed calculations show no monetary results, and read errors
have an independent Retry action without claiming that a successful draft save
failed. No pricing is calculated or persisted in the browser. No new plug-in
deployment or schema change is required for this display; frontend publication
remains a separate administrator-approved action.

The draft percentage strings are displayed as percent units (5 = 5%), matching
Excel, not Dataverse fractions. The server mapper converts to the v3.2 0–1 rate
representation for `re_usetax` / `re_freight` and rejects values outside 0–100%.
The similarly named `re_usetaxpercentage` / `re_freightpercentage` fields are
not substituted for the required workbook-mapped fields.

Branch queries select the raw `re_market` choice, not `re_marketname`. The latter
appears in generated types as a formatted label but is not an OData-selectable
column in this environment. Branch records are loaded using continuation tokens.

## Two-role setup (administrator action still required)

### Temporary local Admin testing

`.env.development` currently sets `VITE_DEV_ADMIN_OVERRIDE=true` at the user's
request. In development only, this skips app-role discovery and selects the
Admin UI role after verifying the signed-in Power Apps/Dataverse identity.
Read/Create privilege checks and all Dataverse backend enforcement remain
active. A visible banner identifies this mode. It does not enable unavailable
write operations or provide a standalone localhost identity.

Production builds ignore the override even if the flag is supplied. To restore
real role discovery locally, set the flag to `false` (or remove it) and restart
the development server. Remove this temporary setting before role-based UAT.

The app recognizes exactly two dedicated Dataverse security-role names:

| Dataverse role name | UI label |
| --- | --- |
| `Repair Estimator - Estimator` | Estimator |
| `Repair Estimator - Admin` | Admin |

These names are defined in `src/data/accessPolicy.ts`. Neither role has been
created or assigned by this code change. An unrelated `Admin`, `Estimator` or
`System Administrator` role does not implicitly become the app's Admin.
If both app roles are assigned, Admin is the displayed role. Users can receive
the roles through Dataverse teams linked to Entra security groups.

Create the roles in the intended environment and solution. Proposed least-
privilege starting point, to validate with representative accounts:

| Area | Estimator | Admin |
| --- | --- | --- |
| Repair Estimate | Create; own-record Read/Write | Create; organization Read/Write |
| Estimate equipment/packages/labor/materials | Own-record access needed for drafts | Organization access needed for administration |
| Branch/equipment/package/type/job/location reference data | Read appropriate reference records | Read; maintenance privileges only where required |
| Role discovery and user privilege APIs | Minimum privileges required to inspect own effective access | Same, plus required administration privileges |
| Pricing configuration | No direct access solely to display calculated outputs | Explicit configuration maintenance privileges only if required |
| Approvals, documents and history | Permissions determined by server workflow | Permissions determined by server workflow |

Include Append/Append To for lookup associations where required. Do not grant
Assign, Share, Delete, organization-wide customer/equipment visibility, or broad
system customization simply to fix a UI error. Decide branch/region ownership
and team scopes in Dataverse. Sharing the Code App is separate from table/row
access. Security-role privileges from all assigned roles are cumulative.

React role checks are **UX gates, not authorization**. Dataverse privileges and
row access must reject prohibited API calls independently. Submitted-record
locking, approved transitions, protected calculated fields, pricing and future
Admin actions require trusted server enforcement.

## Draft persistence: prepared locally, administrator deployment required

The recreated Estimate Equipment and Estimate Package tables have been
re-registered and their contracts regenerated. Live metadata confirmed the
parent cascades, master-delete behavior and snapshot columns. Auditing is
intentionally deferred to an administrator; it is not a draft prerequisite.

`backend/DraftPlugin.cs` implements unbound action `re_DraftEstimate` with
string `InputJson` / `ResultJson` parameters. The synchronous handler requires a
Dataverse transaction and uses the calling user's organization service, never
SYSTEM. Header and selected equipment/package rows are written together.
Existing drafts use `IfRowVersionMatches`; stale writers must reload rather
than overwrite. Numbering and salesperson are server assigned. The server
captures master snapshots and preserves them for unchanged selections, ignoring
client-supplied master costs. Package mechanic hours (`Decimal`) and
material/misc/tax cost (`Money`) types were verified in live metadata. Stored
package totals are quantity extensions only, **not authoritative pricing**.

The UI supports create, update, reopen and explicit New/Reload actions, saved/
dirty state, busy controls, failures that retain inputs, and EN/FR labels.
Branch and currency are fixed once saved. Proposal language is independent of
UI language; French-required provinces are validated server-side. Tax/freight
are entered as percentages (5 means 0.05 stored). Missing branch defaults remain
blank and must be supplied explicitly; zero is valid. No operational data is
stored in browser localStorage.

The client retains the same new-record GUID after failure. A timeout can mean
the transaction committed: use **Reload draft** to reconcile that ID before
retrying. A repeated create cannot create a second estimate with that ID.
Reload/New prompts before discarding edits. Successful reload replaces local
edits; it does not merge concurrent changes. Records with existing labor lines
are explicitly rejected for editing until a line-preserving workflow exists.
Snapshot child replacement currently requires own-record Delete/Create/Read as
well as header Write and lookup Append/Append To; do not grant broad Delete.
Read on Estimate Labor Line is needed for the dependency guard.
Recreated children retain the estimate's owner; cross-owner administrative edits
may require scoped Assign privileges rather than transferring children to the
administrator.

**Manual registration completed; live draft verification is pending.**
The initial automated deployment was blocked by HTTP 403 /
`prvCreatePluginAssembly`. An administrator subsequently registered the assembly
and API manually. Server metadata now exposes `InputJson` and `ResultJson`, and
the CLI-generated action service is wired into the draft adapter. The
draft-enabled frontend has not been published, and live saves have not yet been
verified.
Do not fall back to independent browser creates/updates: that loses atomicity.

Administrator rollout:

1. Use an authorized account and verify the target environment and solution in
   `backend/deploy.py` (`RepairEstimatorApp`, the `re` publisher).
2. Preserve the ignored `backend/drafts.snk` signing key securely for future
   assembly updates. For a fresh checkout only, generate a key once:

   ```powershell
   $rsa = [System.Security.Cryptography.RSACryptoServiceProvider]::new(2048)
   [IO.File]::WriteAllBytes((Join-Path $PWD 'backend\drafts.snk'), $rsa.ExportCspBlob($true))
   $rsa.Dispose()
   ```

   Do not overwrite an existing deployment's signing identity or commit the key.
3. Build and run local backend tests:

   ```powershell
   dotnet build .\backend-tests\DraftTests.csproj --configuration Release
   .\backend-tests\bin\Release\net462\DraftTests.exe
   ```

   Update the existing assembly manually in Plugin Registration Tool using
   `backend/bin/Release/net462/RepairEstimator.Drafts.dll`; preserve its Custom
   API association. The user has chosen manual deployment. Do not run the
   deployment helper as part of validation. Regenerate the action service with
   `pa app add dataverse-api --api-name re_DraftEstimate --non-interactive` only
   if its Dataverse request/response property definitions change.
4. The draft adapter now calls the CLI-generated `Re_DraftEstimateService`.
   Generated files must only be changed by the CLI. Verify SDK request/response
   shape through authenticated Local Play.
5. Verify live create/reopen/update, generated number, snapshot retention,
   invalid-child transaction rollback, simultaneous stale writers, uncertain
   response recovery, and own/other-user denials using representative accounts.
   Local fake-service tests do **not** establish Dataverse transaction rollback,
   runtime privileges or Power Apps action transport.
6. Run `npm run validate`, then publish the frontend only after approval.

Saved pricing and dashboard displays are wired locally. Submission, approvals
and documents remain unconnected in the app. The equipment query is
branch-scoped, not customer-filtered.

## Personal live dashboard

Dashboard presentation follows the user-supplied RE_App mockup: blue KPI values,
cyan/yellow/mint icon tiles, white rounded panels, a three-status doughnut with
exact-count legend, and blue job-type bars with percentages and counts. The
mockup's fabricated trends, quote-sent/completed labels and sample repair
categories are not adopted. The recent-record panel shows the first five records
from the existing bounded request query as aligned desktop rows or stacked phone
details, without filters or paging. View requests opens the full filtered,
paged list; the accessible-record scope remains unchanged. Refresh is a compact
icon-and-label toolbar action; the initials badge uses the royal-blue brand
palette. Charts include
text counts and accessible meters, adapt to stacked phone layouts, and use
theme-specific colors in dark mode. No mockup demo data or runtime code is
imported into the production app.

Request search is in the top header, matching the mockup. Enter or the Search
button opens Repair Requests, preserving the selected market and applying the
existing server-side starts-with match on request number, customer or building.
Submitting a blank query clears search. Equipment search is not advertised or
implemented in this header. Status remains a list-local filter and is preserved
when a query changes within Repair Requests; paging resets to page one.
Dashboard metrics and the dashboard's recent-record panel are not filtered by
this query. Leaving an unsaved draft through search requires confirmation, and
search is unavailable during draft operations or without estimate Read access.
On narrower windows search wraps to its own header row. Labels and actions are
localized; this change requires no backend update.

The approved dashboard reports **only active estimates owned directly by the
initiating user**, filtered by selected market and `createdon` in the current
Lisle/Central Time calendar year (`America/Chicago`, January 1 local midnight
inclusive to the next January 1 exclusive; these boundaries are 06:00Z under
current rules). The net462 plug-in uses Windows `Central Standard Time` rules,
not a fixed UTC offset. Dashboard refresh and pricing calculation timestamps
are displayed in Central Time with a zone abbreviation, including daylight
saving time, independently of browser location and UI language. Stored times
remain UTC. Update the Draft assembly for this reporting-boundary change;
pricing assembly and registration steps do not change.
It does not include team-owned records or all records accessible to Admin.
Cards are labelled literally Draft, Pending and Submitted; these are not claims
that quotes were sent or that an approval action is waiting.

Average actual CMII is a simple (not revenue-weighted) average of saved actual
CMII values where sell price is positive, calculation version is populated and
not `unavailable`, and calculated time/actual CMII are populated. Negative margins
are included. A lack of eligible calculations displays a dash, distinct from a
valid zero average; the denominator is shown. Status and job-type distributions
use the same owner/market/year/active scope; missing job types have a separate
Not specified category, and French labels fall back to English.

`backend/DashboardReader.cs` performs server-side FetchXML aggregates using the
caller service, invoked through the existing `re_DraftEstimate` action with
`InputJson = {"mode":"dashboard","market":126110000}`. The server derives owner
and year; clients cannot select another owner or year. This mode does not write
records and never uses SYSTEM for reads. It returns a separate dashboard-shaped
`ResultJson`; save/load contracts and Custom API parameter metadata are unchanged.
No new connector, API registration, pricing steps or schema changes are needed.

**Manual rollout:** update the existing **RepairEstimator.Drafts** assembly with
`backend/bin/Release/net462/RepairEstimator.Drafts.dll`, preserving the existing
Custom API handler association and signing key. This dashboard change does not
require a pricing assembly update. Refresh authenticated Local Play afterward;
publish the frontend separately only after approval. An old handler will not
support dashboard mode and the app displays an explicit load error, not zeros.

Dashboard results reload on entry, market changes and manual Refresh. Old-scope
numbers are hidden during loading/errors; failed queries have a Refresh action.
The source is not the recent-request list. Its bounded query retains the existing
accessible-record, all-time scope; the dashboard displays five entries and the
full request page retains 25-row paging. Neither is the dashboard denominator.
Dataverse aggregate scan limits (normally 50,000 input rows) fail explicitly,
as do truncated results or inconsistent group totals; no partial totals or
browser-side whole-table fallback are used. Three aggregate queries are issued,
not a guaranteed single instant snapshot under concurrent changes.

Read-only verification of the live personal/current-year margin query returned
one eligible estimate with average actual CMII `-650.2816` (displayed as
`-65,028.16%` in English). This is the existing below-cost test estimate, not a
dashboard bug. Local tests validate the new action path; end-to-end deployed
action transport and non-admin role checks still require rollout verification.

## Adapted pricing plug-ins: local only, manual rollout required

`backend-pricing` adapts the developer-supplied plug-in source to the app's live
`re_` schema and v3.2 calculation design. `backend-pricing-tests` references both
real assemblies and tests the engine plus a simulated Dataverse pipeline.
Neither the new pricing assembly nor the coordinated draft update has been
deployed by this change.

- Package costs come from saved Estimate Package snapshots, not current master
  costs. The draft API is the sole equipment/package snapshot writer. Direct
  creates or updates to those child rows are rejected by snapshot guards.
- Draft save suppresses intermediate recalculations and performs one final
  header update after all children exist. Batch writes use the documented
  Dataverse request `tag` parameter plus verified `re_DraftEstimate` ancestry
  and matching estimate ID. A caller-supplied tag alone cannot pass the guard.
  Live diagnostics showed that mutable SharedVariables set inside the Custom
  API handler were absent from child ParentContext snapshots; those variables
  must not be used for this coordination. Update **both** Draft and pricing
  assemblies together during maintenance before retrying a save; no step or
  image changes are required for this transport correction.
- Missing or ambiguous pricing, missing snapshots, unsupported Custom/T&M input,
  invalid margins or incomplete configuration never become an apparently valid
  zero price. Drafts retain their inputs, clear calculated outputs and expose
  `re_calculationversion = unavailable`. The draft response's optional
  `pricingState` passes this state to an explicit EN/FR UI warning.
  Unexpected Dataverse/service failures still fail the operation.
- Submission is blocked when pricing is unavailable. Existing non-Draft records
  (including Pending and Submitted) are locked for both Estimator and Admin,
  without a reviewer-role or plug-in-depth bypass. Child moves check both the
  previous and proposed parent. No reopen/approval transition is implemented.
- Negative actual CMII retains valid costs, suggested pricing and the negative
  margin instead of clearing all outputs for an unmatched incentive band.
  Both production workbooks' F46/H46 formulas return zero on an unmatched
  incentive lookup. The engine permits zero incentive below 0% only when the
  applicable configuration explicitly contains a 0% band with zero AM/BD payout.
  Missing incentive configuration still makes pricing unavailable; below-target
  margin comments and other submission validation remain enforced.
- Per the user's v3.2 decision, redundancy counts active, caller-visible equipment
  at the primary equipment's saved functional location, not sold-to customer.
  Verify representative users can read all location equipment required for this
  calculation; narrower visibility can change the count. Do not grant broad
  customer/equipment access merely to make pricing work.
- Customer, branch, equipment and transaction reads use the caller service.
  Only pricing configuration/choice metadata reads and status-history creation
  use SYSTEM. History records retain the estimate owner and initiating user.
  Runtime roles still need applicable Append/Append To for output lookups such
  as Margin Group, Margin Rule and Job Size Band; verify scopes with real users.
- There is no dashboard aggregation API in this assembly. Custom/T&M remains
  disabled: the live Material Line table lacks parent lookups. Do not add duplicate
  relationships based on a columns-only export or register material-line hooks.

Build and validate both assemblies:

```powershell
dotnet test .\backend-pricing-tests\RepairEstimator.Tests.csproj --configuration Release
dotnet build .\backend-tests\DraftTests.csproj --configuration Release
.\backend-tests\bin\Release\net462\DraftTests.exe
npm run validate
```

Preserve both ignored signing keys securely: `backend/drafts.snk` and
`backend-pricing/RepairEstimator.snk`. Never regenerate a deployed assembly's
key or commit private keys. After updating the existing Draft assembly, manually
register `backend-pricing/bin/Release/net462/RepairEstimator.Plugins.dll` in the
correct environment/solution, Sandbox isolation, Database storage.
All steps below are **synchronous**, running as the **calling user**. Type names
are under `RepairEstimator.Plugins.Plugins`. Do not register duplicate steps from
the original ZIP; replace/disable conflicting legacy calculation/snapshot/lock
steps as part of an administrator-controlled maintenance window.

| Plug-in type | Table | Messages | Stage | Filtering attributes / images |
| --- | --- | --- | --- | --- |
| EstimateCalculationPlugin | re_repairestimate | Create, Update | PreOperation (20) | No filtering attributes; Update image `pre`, all columns |
| EstimateLockPlugin | re_repairestimate | Update, Delete | PreValidation (10) | No filters or images |
| ChildLockPlugin | re_estimateequipment, re_estimatepackage | Create, Update, Delete | PreValidation (10) | No filters or images |
| EstimateEquipmentSnapshotPlugin | re_estimateequipment | Create, Update | PreOperation (20) | No filters or images |
| EstimatePackageSnapshotPlugin | re_estimatepackage | Create, Update | PreOperation (20) | No filters or images |
| ChildChangeTriggerPlugin | re_estimateequipment, re_estimatepackage | Create, Update, Delete | PostOperation (40) | No filters; Update/Delete image `pre` containing `re_repairestimate` |
| StatusHistoryPlugin | re_repairestimate | Update | PostOperation (40) | Filter `re_estimatestatus`; image `pre` containing `re_estimatestatus` |

Each table/message combination requires its own step. Header calculation has
no Update filters deliberately, so direct attempts to overwrite calculated fields
are recalculated instead. The snapshot-named types now **guard** the API-owned
snapshots rather than recopying master data.

Before enabling operational use, verify in a non-production environment:
create/update/reopen through authenticated Local Play; exactly one final
calculation; unchanged snapshot retention after master changes; unavailable
pricing and recovery after configuration correction; stale writers and real
transaction rollback; direct snapshot tampering; submitted header/child locks
for both roles; and status-history ownership. Use accounts without System
Administrator to verify permissions. The simulated pipeline does not establish
live SharedVariables propagation, Dataverse rollback, authorization or transport.
Pricing formulas still need approved workbook golden-case reconciliation before
production use. Publish the frontend only after separate approval.

## Validation and rollout

Run `npm run validate` after each change: it builds, lints and runs both test
suites. `npm test` also runs both suites:

- `npm run test:unit`: Node's built-in test runner (Node 24+) checks role
  resolution, privilege-response validation, query selection/filtering/paging,
  user preferences, draft response contracts, errors and timeouts.
- `npm run test:responsive`: Playwright Chromium checks ten viewports from
  320px phones through 1440px desktops, including the 640/641px breakpoint and
  short landscape windows, in English/French and light/dark mode. Journeys cover
  the dashboard, paged request list, searchable branches, equipment/package
  results and selections, all five form stages, expanded review and retained
  inputs. Additional cases cover empty/error request lists and draft create,
  update/reopen, blocked writes, stale versions and uncertain-result recovery.
  Assertions check
  horizontal overflow, sidebar fit without independent scrolling, navigation
  placement, unclipped navigation labels and minimum navigation/header targets.

Install Chromium once with `npx playwright install chromium` after installing
dependencies. The suite starts and stops its own Vite server on port 5186; keep
that port free. Failure screenshots and traces are written to ignored
`test-results`. Browser tests use synthetic identity and Dataverse fixtures at
service boundaries, not live tenant data; they do not verify live authorization,
Dataverse writes, submission or pricing.

Before operational use, sign in through Local Play with separate accounts:

1. No app role: access message, no request queries or creation.
2. Estimator: permitted records only; no Admin navigation.
3. Admin: permitted organization scope; no implicit bypass of Dataverse.
4. Remove Read/Create or reference privileges and check explicit denied states.
5. Verify team-inherited roles, paging, search/status resets, mobile layout and
   EN/FR labels against live data.
6. Test backend denials directly, not only hidden UI buttons.

Live browser data access and role assignments have not yet been verified.

Microsoft documentation:

- [Dataverse integration](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse)
- [User context](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/retrieve-context)
- [Dataverse actions/functions](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/add-dataverse-action-function)
- [Role discovery](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/retrieveaaduserroles)
- [Dataverse security roles](https://learn.microsoft.com/en-us/power-platform/admin/security-roles-privileges)
