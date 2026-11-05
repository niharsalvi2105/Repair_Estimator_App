param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$base = 'https://org79f23007.api.crm.dynamics.com/api/data/v9.2/'
$manifestPath = Join-Path $PSScriptRoot '..\backend\master-data-foundation-schema.json'
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
if ($manifest.solutionUniqueName -ne 'RepairEstimatorApp') { throw 'Unexpected manifest solution.' }
$token = & 'C:\Program Files\Microsoft SDKs\Azure\CLI2\python.exe' -IBm azure.cli account get-access-token --resource https://org79f23007.api.crm.dynamics.com --query accessToken -o tsv
if ($LASTEXITCODE -ne 0 -or !$token) { throw 'Dataverse authentication failed.' }
$headers = @{ Authorization = "Bearer $token"; Accept = 'application/json'; 'MSCRM.SolutionUniqueName' = $manifest.solutionUniqueName }
function Request([string]$method, [string]$endpoint, $body = $null) {
    $args = @{ Uri = $base + $endpoint; Method = $method; Headers = $headers; TimeoutSec = 120 }
    if ($null -ne $body) {
        $args.Body = $body | ConvertTo-Json -Depth 15 -Compress
        $args.ContentType = 'application/json'
    }
    Invoke-RestMethod @args
}
function Label([string]$text) { @{ LocalizedLabels = @(@{ Label = $text; LanguageCode = 1033 }) } }
function RelationshipLabel([string]$text) {
    $localized = @{
        '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'
        Label = $text
        LanguageCode = 1033
    }
    @{
        '@odata.type' = 'Microsoft.Dynamics.CRM.Label'
        LocalizedLabels = @($localized)
        UserLocalizedLabel = $localized
    }
}
$solution = Request GET "solutions?`$select=solutionid&`$filter=uniquename eq 'RepairEstimatorApp'"
if ($solution.value.Count -ne 1 -or $solution.value[0].solutionid -ne '05dd7469-373e-46ad-acd4-856e50ac3777') {
    throw 'Unexpected target solution.'
}
$planned = @()
foreach ($table in $manifest.extendTables) {
    $endpoint = "EntityDefinitions(LogicalName='$($table.logicalName)')"
    if ($table.alternateKey) {
        $keys = @( (Request GET "$endpoint/Keys?`$select=KeyAttributes,EntityKeyIndexStatus").value )
        $expected = @($table.alternateKey | Sort-Object) -join ','
        $active = @($keys | Where-Object {
            ((@($_.KeyAttributes | Sort-Object) -join ',') -eq $expected) -and $_.EntityKeyIndexStatus -eq 'Active'
        })
        if ($active.Count -ne 1) { throw "Required active source key not verified: $($table.logicalName)" }
    }
    $attributes = @( (Request GET "$endpoint/Attributes?`$select=LogicalName,AttributeType").value )
    $strings = @( (Request GET "$endpoint/Attributes/Microsoft.Dynamics.CRM.StringAttributeMetadata?`$select=LogicalName,MaxLength").value )
    $lookupSpecs = @($table.columns.PSObject.Properties | Where-Object { $_.Value.type -eq 'Lookup' })
    $relationships = @()
    if ($lookupSpecs.Count) {
        $relationships = @( (Request GET "$endpoint/ManyToOneRelationships?`$select=SchemaName,ReferencedEntity,ReferencedAttribute,ReferencingEntity,ReferencingAttribute,CascadeConfiguration").value )
    }
    foreach ($column in $table.columns.PSObject.Properties) {
        $name = $column.Name
        $spec = $column.Value
        $existing = @($attributes | Where-Object LogicalName -eq $name)
        if ($existing.Count) {
            if ($existing.Count -ne 1 -or $existing[0].AttributeType -ne $spec.type) { throw "Incompatible type: $($table.logicalName).$name" }
            if ($spec.type -eq 'String') {
                $length = @($strings | Where-Object LogicalName -eq $name)
                if ($length.Count -ne 1 -or $length[0].MaxLength -lt $spec.maxLength) { throw "Insufficient length: $($table.logicalName).$name" }
            }
            if ($spec.type -eq 'Lookup') {
                $lookup = Request GET "$endpoint/Attributes(LogicalName='$name')/Microsoft.Dynamics.CRM.LookupAttributeMetadata?`$select=Targets"
                if ($lookup.Targets.Count -ne 1 -or $lookup.Targets[0] -ne $spec.target) { throw "Incompatible lookup: $name" }
                $relationship = @($relationships | Where-Object SchemaName -eq $spec.relationship)
                if ($relationship.Count -ne 1) { throw "Missing or ambiguous lookup relationship: $($spec.relationship)" }
                $relationship = $relationship[0]
                if ($relationship.ReferencedEntity -ne $spec.target -or
                    $relationship.ReferencedAttribute -ne $spec.referencedAttribute -or
                    $relationship.ReferencingEntity -ne $table.logicalName -or
                    $relationship.ReferencingAttribute -ne $name -or
                    $relationship.CascadeConfiguration.Delete -ne $spec.deleteBehavior) {
                    throw "Incompatible lookup relationship: $($spec.relationship)"
                }
            }
            if ($spec.type -in @('Integer','Decimal')) {
                $select = 'MinValue,MaxValue'
                if ($spec.type -eq 'Decimal') { $select += ',Precision' }
                $numeric = Request GET "$endpoint/Attributes(LogicalName='$name')/Microsoft.Dynamics.CRM.$($spec.type)AttributeMetadata?`$select=$select"
                if ($numeric.MinValue -gt $spec.minValue -or $numeric.MaxValue -lt $spec.maxValue) { throw "Insufficient numeric range: $name" }
                if ($spec.type -eq 'Decimal' -and $numeric.Precision -lt $spec.precision) { throw "Insufficient numeric precision: $name" }
            }
            continue
        }
        if ($spec.type -notin @('String','Boolean','Integer','Decimal','Lookup')) { throw "Unsupported schema type: $($spec.type)" }
        if ($spec.type -eq 'Lookup') {
            if (!$spec.relationship -or !$spec.referencedAttribute -or !$spec.deleteBehavior) {
                throw "Lookup relationship details are required: $($table.logicalName).$name"
            }
            if (@($relationships | Where-Object SchemaName -eq $spec.relationship).Count) {
                throw "Lookup relationship exists without its attribute: $($spec.relationship)"
            }
        }
        $planned += @{ table = $table.logicalName; name = $name; spec = $spec }
    }
}
foreach ($change in $planned) {
    Write-Output "Missing $($change.table).$($change.name) ($($change.spec.type))"
}
if (!$Apply) {
    Write-Output "Dry run: $($planned.Count) additive columns; no writes. Use -Apply to create and publish."
    return
}
foreach ($change in $planned) {
    $spec = $change.spec
    if ($spec.type -eq 'Lookup') {
        $relationship = @{
            '@odata.type' = 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata'
            SchemaName = $spec.relationship
            ReferencedEntity = $spec.target
            ReferencedAttribute = $spec.referencedAttribute
            ReferencingEntity = $change.table
            AssociatedMenuConfiguration = @{
                Behavior = 'DoNotDisplay'
                Group = 'Details'
                Label = (RelationshipLabel 'Repair Estimates')
                Order = 10000
            }
            CascadeConfiguration = @{
                Assign = 'NoCascade'
                Delete = $spec.deleteBehavior
                Merge = 'Cascade'
                Reparent = 'NoCascade'
                Share = 'NoCascade'
                Unshare = 'NoCascade'
            }
            Lookup = @{
                '@odata.type' = 'Microsoft.Dynamics.CRM.LookupAttributeMetadata'
                SchemaName = $change.name
                DisplayName = (RelationshipLabel $spec.displayName)
                RequiredLevel = @{ Value = 'None' }
            }
        }
        Request POST 'RelationshipDefinitions' $relationship | Out-Null
        Write-Output "Created lookup relationship $($spec.relationship)"
        continue
    }
    $attributeType = if ($spec.type -eq 'Lookup') { 'LookupAttributeMetadata' } else { "$($spec.type)AttributeMetadata" }
    $attribute = @{
        '@odata.type' = "Microsoft.Dynamics.CRM.$attributeType"
        SchemaName = $change.name
        DisplayName = (Label $change.name.Substring(3))
        RequiredLevel = @{ Value = 'None' }
    }
    if ($spec.type -eq 'Lookup') {
        $attribute.Targets = @($spec.target)
    } elseif ($spec.type -eq 'String') {
        $attribute.MaxLength = $spec.maxLength
        $attribute.FormatName = @{ Value = 'Text' }
    } elseif ($spec.type -eq 'Boolean') {
        $attribute.DefaultValue = $false
        $attribute.OptionSet = @{
            '@odata.type' = 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata'
            TrueOption = @{ Value = 1; Label = (Label 'Yes') }
            FalseOption = @{ Value = 0; Label = (Label 'No') }
        }
    } else {
        $attribute.MinValue = $spec.minValue
        $attribute.MaxValue = $spec.maxValue
        if ($spec.type -eq 'Decimal') { $attribute.Precision = $spec.precision }
    }
    Request POST "EntityDefinitions(LogicalName='$($change.table)')/Attributes" $attribute | Out-Null
    Write-Output "Created $($change.table).$($change.name)"
}
if ($planned.Count) {
    $entities = ($manifest.extendTables | ForEach-Object { "<entity>$($_.logicalName)</entity>" }) -join ''
    Request POST 'PublishXml' @{ ParameterXml = "<importexportxml><entities>$entities</entities></importexportxml>" } | Out-Null
}
Write-Output "Published $($planned.Count) additive columns. No business records imported or updated. Rerun without -Apply to verify."
