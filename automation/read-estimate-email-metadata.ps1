param(
    [Parameter(Mandatory = $true)][string]$DataverseUrl,
    [Parameter(Mandatory = $true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
$base = $DataverseUrl.TrimEnd('/')
if (-not [Uri]::IsWellFormedUriString($base, [UriKind]::Absolute) -or
    ([Uri]$base).Scheme -ne 'https') {
    throw 'DataverseUrl must be an absolute HTTPS organization URL.'
}
$token = az account get-access-token --resource $base --query accessToken -o tsv
if ($LASTEXITCODE -ne 0 -or -not $token) { throw 'Azure CLI Dataverse authentication failed.' }
$headers = @{ Authorization = "Bearer $token" }
$choices = @{}
$schema = @{}
foreach ($table in @('re_repairestimate', 're_estimatelaborline', 're_estimatematerialline')) {
    $url = $base + "/api/data/v9.2/EntityDefinitions(LogicalName='$table')/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?" + '$select=LogicalName&$expand=OptionSet'
    foreach ($attribute in (Invoke-RestMethod -Uri $url -Headers $headers).value) {
        $choices["$table.$($attribute.LogicalName)"] = @($attribute.OptionSet.Options | ForEach-Object {
            $en = ($_.Label.LocalizedLabels | Where-Object LanguageCode -eq 1033).Label
            $fr = ($_.Label.LocalizedLabels | Where-Object LanguageCode -eq 1036).Label
            if (-not $en) { throw "Missing English choice label on $table.$($attribute.LogicalName)." }
            @{ value = $_.Value; en = $en; fr = $(if ($fr) { $fr } else { $en }) }
        })
    }
}
foreach ($table in @('re_repairestimate', 're_estimateequipment', 're_estimatepackage',
    're_estimatelaborline', 're_estimatematerialline', 're_branch',
    're_stateprovince', 're_equipmenttype', 're_jobtype')) {
    $url = $base + "/api/data/v9.2/EntityDefinitions(LogicalName='$table')/Attributes?" + '$select=LogicalName'
    $schema[$table] = @((Invoke-RestMethod -Uri $url -Headers $headers).value | ForEach-Object { $_.LogicalName })
}
@{ choices = $choices; schema = $schema } | ConvertTo-Json -Depth 20 |
    Set-Content -Encoding utf8 -LiteralPath $OutputPath
Write-Output "Saved metadata only: $($choices.Count) choices, $($schema.Count) tables. No business records read."
