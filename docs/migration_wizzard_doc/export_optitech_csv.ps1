param(
    [Parameter(Mandatory=$true)][string]$DbFile,
    [Parameter(Mandatory=$true)][string]$OutputDir,
    [string]$ScansDir = "",
    [switch]$IncludeDocuments,
    [int]$ClientLimit = 0
)

$ErrorActionPreference = "Stop"
$utf8 = [System.Text.UTF8Encoding]::new($false)

function Escape-Csv([object]$Value) {
    if ($null -eq $Value -or $Value -is [DBNull]) { return "" }
    $text = [Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture)
    if ($text -match '[,"\r\n]') { return '"' + $text.Replace('"', '""') + '"' }
    return $text
}

function Open-OptiTechConnection([string]$Path) {
    $providers = @("Microsoft.Jet.OLEDB.4.0", "Microsoft.ACE.OLEDB.16.0", "Microsoft.ACE.OLEDB.12.0")
    $errors = @()
    foreach ($provider in $providers) {
        try {
            $connection = New-Object System.Data.OleDb.OleDbConnection(
                "Provider=$provider;Data Source=$Path;Mode=Share Deny None;Persist Security Info=False;"
            )
            $connection.Open()
            return $connection
        } catch { $errors += "$provider`: $($_.Exception.Message)" }
    }
    throw "Could not open OptiTech database. Close OptiTech and verify that a 32-bit Jet/ACE provider is installed. $($errors -join ' | ')"
}

if (-not (Test-Path -LiteralPath $DbFile)) { throw "OptiTech database was not found: $DbFile" }
$OutputDir = [IO.Path]::GetFullPath($OutputDir)
$tablesDir = Join-Path $OutputDir "tables"
$documentsDir = Join-Path $OutputDir "documents"
New-Item -ItemType Directory -Force -Path $tablesDir | Out-Null
New-Item -ItemType Directory -Force -Path $documentsDir | Out-Null

$allowedTables = @(
    "tblPerData", "tblUsers", "tblCrdGlassChecks", "tblCrdGlassChecksPrevs",
    "tblCrdClensChecks", "tblCrdBuysWorks", "tblPerPicture", "tblCrdDiags",
    "tblClndrApt", "tblClndrWrk", "tblCitys", "tblRefs", "tblRefsSub1", "tblRefsSub2",
    "tblCrdGlassBrand", "tblCrdGlassCoat", "tblCrdGlassColor", "tblCrdGlassMater",
    "tblCrdGlassModel", "tblCrdGlassRole", "tblCrdClensBrands", "tblCrdClensManuf",
    "tblCrdClensTypes", "tblCrdClensSolClean", "tblCrdClensSolDisinfect",
    "tblCrdClensSolRinse", "tblCrdBuysWorkTypes", "tblCrdBuysWorkStats",
    "tblCrdBuysWorkSupply", "tblCrdBuysWorkLabs", "tblCrdBuysWorkSapaks",
    "tblCrdBuysWorkLabels", "tblCrdClensChecksMater", "tblCrdClensChecksTint",
    "tblCrdClensChecksPr"
)
$allowedColumns = @{
    tblPerData = "PerId LastName FirstName TzId BirthDate Sex HomePhone WorkPhone CellPhone Fax Email Address CityId ZipCode DiscountId GroupId RefId UserId Comment RefsSub1Id RefsSub2Id WantsLaser LaserDate FamId MailList Ocup HidCom".Split(" ")
    tblUsers = "UserId LastName FirstName HomePhone CellPhone Fax Address ZipCode Diag Emp CityId BirthDate LevelId Comment UserTz PrivType".Split(" ")
    tblCrdGlassChecks = "PerId CheckDate UserId ReCheckDate FVR FVL SphR SphL CylR CylL AxR AxL PrisR PrisL BaseR BaseL VAR VAL VA PHR PHL ReadR ReadL AddBaseR AddBaseL AddPrisR AddPrisL IntR IntL BifR BifL MulR MulL HighR HighL PDDistR PDDistL PDReadR PDReadL DominEye IOPL IOPR ObjSphR ObjSphL ObjCylR ObjCylL ObjAxR ObjAxL ObjSphEsR ObjSphEsL ObjPD JR JL Comments ObjComm PDDistA PDReadA PFVR PFVL PSphR PSphL PCylR PCylL PAxR PAxL PPrisR PPrisL PBaseR PBaseL PVAR PVAL PVA PPHR PPHL PReadR PReadL PAddBaseR PAddBaseL PAddPrisR PAddPrisL PIntR PIntL PBifR PBifL PMulR PMulL PHighR PHighL PPDDistR PPDDistL PPDReadR PPDReadL PPDDistA PPDReadA PJR PJL CSR CSL ObjVAR ObjVAL ObjVA ObjAddR ObjAddL ObjJR ObjJL ExtPrisR ExtPrisL ExtBaseR ExtBaseL AddExtPrisR AddExtPrisL AddExtBaseR AddExtBaseL".Split(" ")
    tblCrdClensChecks = "PerId CheckDate UserId ReCheckDate PupDiam CornDiam EyeLidKey BUT ShirR ShirL Ecolor rHR rHL rVR rVL AxHR AxHL rTR rTL rNR rNL rIR rIL rSR rSL DiamR DiamL BC1R BC1L BC2R BC2L OZR OZL PrR PrL SphR SphL CylR CylL AxR AxL MaterR MaterL TintR TintL VAR VAL VA PHR PHL ClensTypeIdR ClensTypeIdL ClensManufIdR ClensManufIdL ClensBrandIdR ClensBrandIdL ClensSolCleanId ClensSolDisinfectId ClensSolRinseId Comments AddR AddL BUTL".Split(" ")
    tblCrdBuysWorks = "WorkId WorkDate PerId UserId WorkTypeId CheckDate WorkStatId WorkSupplyId LabId SapakId BagNum PromiseDate DeliverDate Comment FSapakId FLabelId FModel FColor FSize RoleId MaterId BrandId CoatId ModelId ColorId Diam Segment FrameSold".Split(" ")
    tblPerPicture = "PerPicId PerId PicFileName Description ScanDate Notes".Split(" ")
    tblCrdDiags = "PerId CheckDate UserId Complaints illnesses OptDiag DocRef Summary".Split(" ")
    tblClndrApt = "UserID AptDate AptNum StarTime EndTime AptDesc PerID TookPlace Reminder".Split(" ")
    tblClndrWrk = "WrkId UserID WrkDate StartTime EndTime WrkTime".Split(" ")
    tblCitys = "CityId CityName".Split(" ")
    tblRefs = "RefId RefName".Split(" ")
    tblRefsSub1 = "RefsSub1Id RefsSub1Name RefId".Split(" ")
    tblRefsSub2 = "RefsSub2Id RefsSub2Name RefsSub1Id".Split(" ")
    tblCrdGlassBrand = "GlassBrandId GlassBrandName".Split(" ")
    tblCrdGlassCoat = "GlassCoatId GlassCoatName".Split(" ")
    tblCrdGlassColor = "GlassColorId GlassColorName".Split(" ")
    tblCrdGlassMater = "GlassMaterId GlassMaterName".Split(" ")
    tblCrdGlassModel = "GlassModelId GlassModelName".Split(" ")
    tblCrdGlassRole = "GlassRoleId GlassRoleName".Split(" ")
    tblCrdClensBrands = "ClensBrandId ClensBrandName".Split(" ")
    tblCrdClensManuf = "ClensManufId ClensManufName".Split(" ")
    tblCrdClensTypes = "ClensTypeId ClensTypeName".Split(" ")
    tblCrdClensSolClean = "ClensSolCleanId ClensSolCleanName".Split(" ")
    tblCrdClensSolDisinfect = "ClensSolDisinfectId ClensSolDisinfectName".Split(" ")
    tblCrdClensSolRinse = "ClensSolRinseId ClensSolRinseName".Split(" ")
    tblCrdBuysWorkTypes = "WorkTypeId WorkTypeName".Split(" ")
    tblCrdBuysWorkStats = "WorkStatId WorkStatName".Split(" ")
    tblCrdBuysWorkSupply = "WorkSupplyId WorkSupplyName".Split(" ")
    tblCrdBuysWorkLabs = "LabID LabName".Split(" ")
    tblCrdBuysWorkSapaks = "SapakID SapakName".Split(" ")
    tblCrdBuysWorkLabels = "LabelId LabelName".Split(" ")
    tblCrdClensChecksMater = "MaterId MaterName".Split(" ")
    tblCrdClensChecksTint = "TintId TintName".Split(" ")
    tblCrdClensChecksPr = "PrId PrName".Split(" ")
}
$previousColumns = @("PerId", "CheckDate", "PrevId")
foreach ($slot in 1..4) {
    foreach ($prefix in @("SphR", "SphL", "CylR", "CylL", "AxR", "AxL", "PrisR", "PrisL", "BaseR", "BaseL", "VAR", "VAL", "VA", "AddR", "AddL", "PDDistR", "PDDistL", "PDDistA", "ExtPrisR", "ExtPrisL", "ExtBaseR", "ExtBaseL", "Comments")) {
        $previousColumns += "$prefix$slot"
    }
}
$allowedColumns.tblCrdGlassChecksPrevs = $previousColumns
$clientDependentColumns = @{
    tblPerData = "PerId"; tblCrdGlassChecks = "PerId"; tblCrdGlassChecksPrevs = "PerId";
    tblCrdClensChecks = "PerId"; tblCrdBuysWorks = "PerId"; tblPerPicture = "PerId";
    tblCrdDiags = "PerId"; tblClndrApt = "PerID"
}

$connection = Open-OptiTechConnection $DbFile
try {
    $schema = $connection.GetSchema("Tables")
    $tableNames = @(
        $schema.Rows |
            Where-Object { $_.TABLE_TYPE -eq "TABLE" -and -not ([string]$_.TABLE_NAME).StartsWith("MSys") } |
            ForEach-Object { [string]$_.TABLE_NAME }
    )
    $required = @("tblPerData", "tblUsers", "tblCrdGlassChecks", "tblCrdClensChecks")
    $missing = @($required | Where-Object { $_ -notin $tableNames })
    if ($missing.Count -gt 0) { throw "Selected database is not a supported OptiTech database. Missing: $($missing -join ', ')" }

    $selectedClientIds = @()
    $clientCommand = $connection.CreateCommand()
    $clientCommand.CommandText = if ($ClientLimit -gt 0) {
        "SELECT TOP $ClientLimit [PerId] FROM [tblPerData] ORDER BY [PerId] ASC"
    } else { "SELECT [PerId] FROM [tblPerData] ORDER BY [PerId] ASC" }
    $clientReader = $clientCommand.ExecuteReader()
    try { while ($clientReader.Read()) { $selectedClientIds += [int]$clientReader.GetValue(0) } }
    finally { $clientReader.Dispose() }
    $clientIdSql = if ($selectedClientIds.Count) { $selectedClientIds -join "," } else { "NULL" }

    $manifestTables = @()
    foreach ($table in $allowedTables) {
        if ($table -notin $tableNames) { continue }
        $safeName = $table.Replace("]", "]]" )

        # Intersect the explicit migration allowlist with columns that exist in
        # this OptiTech version. Unknown catalog and sensitive columns never leave
        # the source machine.
        $columnSchema = $connection.GetOleDbSchemaTable(
            [System.Data.OleDb.OleDbSchemaGuid]::Columns,
            @($null, $null, $table, $null)
        )
        $actualColumns = @{}
        foreach ($row in $columnSchema.Rows) {
            $name = [string]$row.COLUMN_NAME
            $actualColumns[$name] = $name
        }
        $columns = @(
            $allowedColumns[$table] |
                Where-Object { $actualColumns.ContainsKey($_) } |
                ForEach-Object { $actualColumns[$_] }
        )
        if (-not $columns.Count) { continue }

        $selectColumns = ($columns | ForEach-Object { "[" + $_.Replace("]", "]]" ) + "]" }) -join ","
        $where = ""
        if ($clientDependentColumns.ContainsKey($table)) {
            $where = " WHERE [$($clientDependentColumns[$table])] IN ($clientIdSql)"
        }
        $orderBy = if ($table -eq "tblPerData") { " ORDER BY [PerId] ASC" } else { "" }
        $command = $connection.CreateCommand()
        $command.CommandText = "SELECT $selectColumns FROM [$safeName]$where$orderBy"
        $reader = $command.ExecuteReader()
        $target = Join-Path $tablesDir "$table.csv"
        $writer = [IO.StreamWriter]::new($target, $false, $utf8)
        $rows = 0
        try {
            $writer.WriteLine(($columns | ForEach-Object { Escape-Csv $_ }) -join ",")
            while ($reader.Read()) {
                $values = for ($index = 0; $index -lt $reader.FieldCount; $index++) { Escape-Csv $reader.GetValue($index) }
                $writer.WriteLine($values -join ",")
                $rows++
            }
        } finally {
            $writer.Dispose()
            $reader.Dispose()
        }
        $manifestTables += [PSCustomObject]@{
            name = $table
            file = "tables/$table.csv"
            row_count = $rows
            columns = $columns
            sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash.ToLowerInvariant()
        }
    }
} finally { $connection.Dispose() }

$documentCount = 0
$manifestDocuments = @()
$missingReferencedDocumentCount = 0
$sourceDocumentCount = 0
$unreferencedDocumentCount = 0
$referencedDocumentNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
if ($IncludeDocuments -and $ScansDir -and (Test-Path -LiteralPath $ScansDir)) {
    $pictureCsv = Join-Path $tablesDir "tblPerPicture.csv"
    if (Test-Path -LiteralPath $pictureCsv) {
        Import-Csv -LiteralPath $pictureCsv | ForEach-Object {
            $name = [string]$_.PicFileName
            if (-not $name) { return }
            [void]$referencedDocumentNames.Add([IO.Path]::GetFileName($name))
            $source = Join-Path $ScansDir $name
            if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
                $missingReferencedDocumentCount++
                return
            }
            $fileName = [IO.Path]::GetFileName($name)
            $destination = Join-Path $documentsDir $fileName
            Copy-Item -LiteralPath $source -Destination $destination -Force
            $manifestDocuments += [PSCustomObject]@{
                file = "documents/$fileName"
                sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash.ToLowerInvariant()
                size = (Get-Item -LiteralPath $destination).Length
            }
            $documentCount++
        }
    }
    $sourceFiles = @(Get-ChildItem -LiteralPath $ScansDir -File -Recurse)
    $sourceDocumentCount = $sourceFiles.Count
    $unreferencedDocumentCount = @(
        $sourceFiles | Where-Object { -not $referencedDocumentNames.Contains($_.Name) }
    ).Count
}

$dbInfo = Get-Item -LiteralPath $DbFile
$manifest = [PSCustomObject]@{
    source_system = "optitech"
    format_version = 2
    mapping_version = 2
    exported_at = (Get-Date).ToString("o")
    source = [PSCustomObject]@{
        database_size = $dbInfo.Length
        database_modified_at = $dbInfo.LastWriteTimeUtc.ToString("o")
    }
    source_fingerprint = (Get-FileHash -Algorithm SHA256 -LiteralPath $DbFile).Hash.ToLowerInvariant()
    client_limit = if ($ClientLimit -gt 0) { $ClientLimit } else { $null }
    selected_client_ids = $selectedClientIds
    tables = $manifestTables
    documents = [PSCustomObject]@{
        included = [bool]$IncludeDocuments
        root = "documents"
        file_count = $documentCount
        source_file_count = $sourceDocumentCount
        missing_referenced_count = $missingReferencedDocumentCount
        unreferenced_file_count = $unreferencedDocumentCount
        files = $manifestDocuments
    }
}
[IO.File]::WriteAllText((Join-Path $OutputDir "manifest.json"), ($manifest | ConvertTo-Json -Depth 10), $utf8)
Write-Host "Export complete: $OutputDir"
