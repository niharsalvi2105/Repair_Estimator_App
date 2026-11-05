# Dataverse documentation maintenance

Before changing backend/plugin behavior, read [the plugin reference](../Audit_Track/plugin.md).
Update it in the same change for API dispatch, formulas, loaders, snapshots,
locking, error contracts, registration/images, permissions, schema prerequisites
or export lifecycle changes. Update the Dataverse reference too when impacted.

Before changing frontend behavior, read [the app reference](../Audit_Track/app.md).
Update it in the same change for UI controls, navigation, validation, calculations,
display formatting, access/locking, styling, localization or frontend data wiring.
Record expected behavior, known gaps, tests and deployment evidence.

Before changing Dataverse behavior, read [the Dataverse reference](../Audit_Track/dataverse.md).
Update that document in the same change whenever tables, columns, API operations,
plugin registration, persistence, permissions, calculation outputs, automation,
or frontend-to-Dataverse mappings change. Include UI-only fields and their limits.

Record what changed, affected tables/columns, expected versus actual behavior,
validation evidence, unresolved issues, and deployment status. Distinguish source
implementation, local tests and read-only tenant verification; never claim that
source changes were deployed or that mocked tests prove production behavior.

Do not put business records, personal contact details, credentials or tokens in
documentation. Preserve existing work. The documentation check requires the
corresponding app/Dataverse/plugin reference updates when watched files change; it does
not verify factual accuracy or monitor published apps.
