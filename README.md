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
- Repair Requests and the dashboard request panel: read-only, server-filtered
  active estimates, 25 records per page using SDK continuation tokens. The
  server enforces which records are accessible; the UI does not fetch the entire
  estimate table or calculate organization-wide metrics from a page.
- Request fields: live branches, equipment types and job types; bounded,
  debounced equipment and standard-package searches. French reference labels
  fall back to English. Values in the request workspace remain unsaved.
- Dataverse errors and access-check failures are surfaced. Unknown users,
  missing app roles and failed permission checks do not enable request creation
  or administration. Permission checks are cached for the current app session;
  reload the app after role changes.

Generated files under `src/generated` and `.power` must be regenerated with the
CLI, not edited by hand.

## New request workflow (unsaved input capture)

Desktop navigation uses a compact 240px sidebar, reduced branding, 44px action
targets and consistent outline SVG icons. Narrow screens retain bottom navigation.
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
Other entered fields are retained for review. Market selection is a workspace
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
first enabled write surface; estimate transaction writes remain disabled.

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
   Suggested price and actual CMII remain unavailable, not fabricated.
5. **Review**: customer/contact and building confirmation, partner identifiers
   and CTT notes, selected equipment/package summary. Save/submit remain disabled.

This sequence uses the production MKO `KTOC PSR Estimator` header/cost/pricing
sections and generated live `re_` fields/choices, not a new start-estimator form.
The transcript adjusts the workbook: supervisor is optional and customer contact
is confirmed at review. Proposal language is independent of the UI language.
Equipment quantity is derived from selections, not a second conflicting input.
Inputs survive in-app navigation; leaving/reloading warns about unsaved changes.
Changing branch requires confirmation before clearing selected equipment/packages.

This is **not workbook pricing parity or a complete operational workflow**.
Custom/T&M line entry, tax/freight defaults, authoritative pricing,
snapshots, required create-field defaults, save and submit remain unconnected.
The displayed salesperson is the authenticated user; creating on behalf of another
salesperson is not implemented.

The draft percentage strings are displayed as percent units (5 = 5%), matching
Excel, not Dataverse fractions. A future save mapper must convert to the v3.2
0–1 rate representation for `re_usetax` / `re_freight`, and validate live bounds.
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
Admin actions require trusted server enforcement. The app currently performs
no transaction writes.

## Deliberate write blockers

Refreshing Estimate Equipment and Estimate Package from the live environment
did not expose the expected equipment/parent lookup bindings or package
snapshot columns respectively. This is not proof that relationships do not
exist. Inspect live relationship/navigation metadata and column visibility,
then reconcile with the v3.2 design before enabling child writes. Do not create
duplicate relationships based on generated models or the columns-only export.

Draft saving also requires verified required fields/defaults (including state/
province, salesperson, currency and choices), an agreed concurrency strategy,
and server-side snapshot/calculation enforcement. Pricing, submission,
approvals, documents and dashboard aggregates remain unavailable. Country/
state-province form integration and customer-filtered equipment lookup remain
follow-up work; the existing equipment query is branch-scoped.

## Validation and rollout

Run `npm run validate` after each change: it builds, lints and runs both test
suites. `npm test` also runs both suites:

- `npm run test:unit`: Node's built-in test runner (Node 24+) checks role
  resolution, privilege-response validation, query selection/filtering/paging,
  user preferences, errors and timeouts.
- `npm run test:responsive`: Playwright Chromium checks ten viewports from
  320px phones through 1440px desktops, including the 640/641px breakpoint and
  short landscape windows, in English/French and light/dark mode. Journeys cover
  the dashboard, paged request list, searchable branches, equipment/package
  results and selections, all five form stages, expanded review and retained
  inputs. Additional cases cover empty/error request lists. Assertions check
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
