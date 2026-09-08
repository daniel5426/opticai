param(
    [Parameter(Mandatory=$true)][string]$DbFile,
    [Parameter(Mandatory=$true)][string]$OutputDir,
    [string]$ScansDir = "",
    [switch]$IncludeDocuments,
    [int]$ClientLimit = 0,
    [string]$ExportPlanPath = ""
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
    "tblBases", "tblCrdDisDiags", "tblCrdOverViews", "tblCrdOrthoks", "tblCrdClinicChecks", "tblCrdClensFits", "tblCrdLVChecks", "tblCrdGlassChecksGlasses", "tblCrdGlassChecksFrm", "tblCrdGlassChecksGlassesP", "tblCrdFrps", "tblCrdFrpsLines",
    "tblPerData", "tblUsers", "tblCrdGlassChecks", "tblCrdGlassChecksPrevs",
    "tblCrdClensChecks", "tblCrdBuysWorks", "tblPerPicture", "tblCrdDiags",
    "tblClndrApt", "tblClndrWrk", "tblCitys", "tblRefs", "tblRefsSub1", "tblRefsSub2",
    "tblCrdGlassBrand", "tblCrdGlassCoat", "tblCrdGlassColor", "tblCrdGlassMater",
    "tblCrdGlassModel", "tblCrdGlassRole", "tblCrdClensBrands", "tblCrdClensManuf",
    "tblCrdClensTypes", "tblCrdClensSolClean", "tblCrdClensSolDisinfect",
    "tblCrdClensSolRinse", "tblCrdBuysWorkTypes", "tblCrdBuysWorkStats",
    "tblCrdBuysWorkSupply", "tblCrdBuysWorkLabs", "tblCrdBuysWorkSapaks",
    "tblCrdBuysWorkLabels", "tblCrdClensChecksMater", "tblCrdClensChecksTint",
    "tblCrdClensChecksPr", "tblCrdGlassRetTypes", "tblCrdGlassRetDists", "tblCrdGlassIOPInsts",
    "tblCrdClinicChars", "tblCrdClinicFlds", "tblCrdLVArea", "tblCrdLVFrame", "tblCrdLVManuf", "tblCrdLVCap",
    "tblCrdGlassUses", "tblEyes", "tblLnsChars", "tblLnsMaterials", "tblLnsTreatChars", "tblLnsTypes", "tblSapaks"
)
$clinicalTables = @("tblCrdGlassChecks", "tblCrdGlassChecksPrevs", "tblCrdClensChecks", "tblCrdDisDiags", "tblCrdOverViews", "tblCrdOrthoks", "tblCrdClinicChecks", "tblCrdClensFits", "tblCrdLVChecks", "tblCrdGlassChecksGlasses", "tblCrdGlassChecksFrm", "tblCrdGlassChecksGlassesP", "tblCrdFrps", "tblCrdFrpsLines")
$allowedColumns = @{
    tblBases = "BaseId BaseName".Split(" ")
    tblCrdDisDiags = "PerId CheckDate PushUp MinusLens MonAccFac6 MonAccFac7 MonAccFac8 MonAccFac13 BinAccFac6 BinAccFac7 BinAccFac8 BinAccFac13 MEMRet FusedXCyl NRA PRA CoverDist CoverNear DistLatFor NearLatFor ACARatio SmverBo6M SmverBi6M SmverBo40CM SmverBi40CM StverBo7 StverBi7 StverBo6M StverBi6M StverBo40CM StverBi40CM JmpVer5 JmpVer8 AccTarget Penlight PenLightRG Summary UserId".Split(" ")
    tblCrdOverViews = "PerId CheckDate Comments VAR VAL UserId Pic".Split(" ")
    tblCrdOrthoks = "OrthokId PerId CheckDate ReCheckDate UserId rHR rHL rVR rVL AxHR AxHL rTR rTL rNR rNL rIR rIL rSR rSL DiamR DiamL BC1R BC1L OZR OZL SphR SphL FCR FCL ACR ACL AC2R AC2L SBR SBL EGR EGL FCRCT FCLCT ACRCT ACLCT AC2RCT AC2LCT MaterR MaterL TintR TintL VAR VAL ClensTypeIdR ClensTypeIdL ClensManufIdR ClensManufIdL ClensBrandIdR ClensBrandIdL ComR ComL PICL PICR OZRCT OZLCT OrderId CustId PupDiam CornDiam EyeLidKey CheckType".Split(" ")
    tblCrdClinicChecks = "ClinicCheckId PerId CheckDate".Split(" ")
    tblCrdClensFits = "PerId CheckDate FitId".Split(" ")
    tblCrdLVChecks = "PerId CheckDate LVId".Split(" ")
    tblCrdGlassChecksGlasses = "PerId CheckDate GlassId RoleId MaterId BrandId CoatId ModelId ColorId Diam Segment Com".Split(" ")
    tblCrdGlassChecksFrm = "PerId CheckDate GlassId FSapakId FLabelId FModel FColor FSize Comments".Split(" ")
    tblCrdGlassChecksGlassesP = "PerId CheckDate GlassPId".Split(" ")
    tblCrdFrps = "FrpId PerId ClensBrandId FrpDate TotalFrp ExchangeNum DayInterval Supply Comments SaleAdd".Split(" ")
    tblCrdFrpsLines = "FrpLineId FrpId LineDate Quantity".Split(" ")

    tblPerData = "PerId LastName FirstName TzId BirthDate Sex HomePhone WorkPhone CellPhone Fax Email Address CityId ZipCode DiscountId GroupId RefId UserId Comment RefsSub1Id RefsSub2Id WantsLaser LaserDate FamId MailList Ocup HidCom".Split(" ")
    tblUsers = "UserId LastName FirstName HomePhone CellPhone Fax Address ZipCode Diag Emp CityId BirthDate LevelId Comment UserTz PrivType".Split(" ")
    tblCrdGlassChecks = "PerId CheckDate UserId ReCheckDate FVR FVL SphR SphL CylR CylL AxR AxL PrisR PrisL BaseR BaseL VAR VAL VA PHR PHL ReadR ReadL AddBaseR AddBaseL AddPrisR AddPrisL IntR IntL BifR BifL MulR MulL HighR HighL PDDistR PDDistL PDReadR PDReadL DominEye IOPL IOPR ObjSphR ObjSphL ObjCylR ObjCylL ObjAxR ObjAxL ObjSphEsR ObjSphEsL ObjPD JR JL Comments ObjComm PDDistA PDReadA PFVR PFVL PSphR PSphL PCylR PCylL PAxR PAxL PPrisR PPrisL PBaseR PBaseL PVAR PVAL PVA PPHR PPHL PReadR PReadL PAddBaseR PAddBaseL PAddPrisR PAddPrisL PIntR PIntL PBifR PBifL PMulR PMulL PHighR PHighL PPDDistR PPDDistL PPDReadR PPDReadL PPDDistA PPDReadA PJR PJL CSR CSL ObjVAR ObjVAL ObjVA ObjAddR ObjAddL ObjJR ObjJL ExtPrisR ExtPrisL ExtBaseR ExtBaseL AddExtPrisR AddExtPrisL AddExtBaseR AddExtBaseL".Split(" ")
    tblCrdClensChecks = "PerId CheckDate UserId ReCheckDate PupDiam CornDiam EyeLidKey BUT ShirR ShirL Ecolor rHR rHL rVR rVL AxHR AxHL rTR rTL rNR rNL rIR rIL rSR rSL DiamR DiamL BC1R BC1L BC2R BC2L OZR OZL PrR PrL SphR SphL CylR CylL AxR AxL MaterR MaterL TintR TintL VAR VAL VA PHR PHL ClensTypeIdR ClensTypeIdL ClensManufIdR ClensManufIdL ClensBrandIdR ClensBrandIdL ClensSolCleanId ClensSolDisinfectId ClensSolRinseId Comments AddR AddL BUTL".Split(" ")
    tblCrdBuysWorks = "WorkId WorkDate PerId UserId WorkTypeId CheckDate WorkStatId WorkSupplyId LabId SapakId BagNum PromiseDate DeliverDate Comment FSapakId FLabelId FModel FColor FSize RoleId MaterId BrandId CoatId ModelId ColorId Diam Segment FrameSold Canceled".Split(" ")
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
    tblCrdGlassRetTypes = "RetTypeId RetTypeName".Split(" ")
    tblCrdGlassRetDists = "RetDistId RetDistName".Split(" ")
    tblCrdGlassIOPInsts = "IOPInstId IOPInstName".Split(" ")
    tblCrdClinicChars = "EyeCheckCharId EyeCheckCharName EyeCheckCharType".Split(" ")
    tblCrdClinicFlds = "FldId FldName".Split(" ")
    tblCrdLVArea = "LVAreaId LVAreaName".Split(" ")
    tblCrdLVFrame = "LVFrameId LVFrameName".Split(" ")
    tblCrdLVManuf = "LVManufId LVManufName".Split(" ")
    tblCrdLVCap = "LVCapId LVCapName".Split(" ")
    tblCrdGlassUses = "GlassUseId GlassUseName".Split(" ")
    tblEyes = "EyeId EyeName".Split(" ")
    tblLnsChars = "LensCharId LensCharName Fav".Split(" ")
    tblLnsMaterials = "LensMaterId LensMaterName".Split(" ")
    tblLnsTreatChars = "TreatCharId TreatCharName".Split(" ")
    tblLnsTypes = "LensTypeId LensTypeName".Split(" ")
    tblSapaks = "SapakID SapakName".Split(" ")
}
$previousColumns = @("PerId", "CheckDate", "PrevId")
foreach ($slot in 1..4) {
    foreach ($prefix in @("SphR", "SphL", "CylR", "CylL", "AxR", "AxL", "PrisR", "PrisL", "BaseR", "BaseL", "VAR", "VAL", "VA", "AddR", "AddL", "PDDistR", "PDDistL", "PDDistA", "ExtPrisR", "ExtPrisL", "ExtBaseR", "ExtBaseL", "Comments")) {
        $previousColumns += "$prefix$slot"
    }
}
$allowedColumns.tblCrdGlassChecksPrevs = $previousColumns
$clientDependentColumns = @{
    tblCrdDisDiags = "PerId";
    tblCrdOverViews = "PerId";
    tblCrdOrthoks = "PerId";
    tblCrdClinicChecks = "PerId";
    tblCrdClensFits = "PerId";
    tblCrdLVChecks = "PerId";
    tblCrdGlassChecksGlasses = "PerId";
    tblCrdGlassChecksFrm = "PerId";
    tblCrdGlassChecksGlassesP = "PerId";
    tblCrdFrps = "PerId";
    tblPerData = "PerId"; tblCrdGlassChecks = "PerId"; tblCrdGlassChecksPrevs = "PerId";
    tblCrdClensChecks = "PerId"; tblCrdBuysWorks = "PerId"; tblPerPicture = "PerId";
    tblCrdDiags = "PerId"; tblClndrApt = "PerID"
}

# The native reader header is the authoritative export specification. The
# PowerShell compatibility exporter parses the same plan so the two exporters
# cannot silently drift.
if (-not $ExportPlanPath) {
    $ExportPlanPath = Join-Path $PSScriptRoot "..\..\native\optitech-mdb-exporter\export-plan.h"
}
if (-not (Test-Path -LiteralPath $ExportPlanPath)) {
    throw "Shared OptiTech export specification was not found: $ExportPlanPath"
}
$planSource = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $ExportPlanPath))
$planMatches = [regex]::Matches($planSource, '\{"([^"]+)",\s*"([^"]*)",\s*(NULL|"([^"]*)")\}')
$allowedTables = @()
$allowedColumns = @{}
$clientDependentColumns = @{}
foreach ($match in $planMatches) {
    $table = $match.Groups[1].Value
    $allowedTables += $table
    $allowedColumns[$table] = @($match.Groups[2].Value.Split(" ", [StringSplitOptions]::RemoveEmptyEntries))
    if ($match.Groups[4].Success -and -not $match.Groups[4].Value.StartsWith("@")) {
        $clientDependentColumns[$table] = $match.Groups[4].Value
    }
}
$clinicalMatch = [regex]::Match($planSource, 'static const char \*CLINICAL_TABLES\[\] = \{([^;]+)\};')
$clinicalTables = @([regex]::Matches($clinicalMatch.Groups[1].Value, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value })

$connection = Open-OptiTechConnection $DbFile
try {
    $schema = $connection.GetSchema("Tables")
    $tableNames = @(
        $schema.Rows |
            Where-Object { $_.TABLE_TYPE -eq "TABLE" -and -not ([string]$_.TABLE_NAME).StartsWith("MSys") } |
            ForEach-Object { [string]$_.TABLE_NAME }
    )
    $inventoryPath = Join-Path $OutputDir "source-schema.csv"
    $inventoryWriter = [IO.StreamWriter]::new($inventoryPath, $false, $utf8)
    try {
        $inventoryWriter.WriteLine("table,column,disposition")
        foreach ($inventoryTable in $tableNames) {
            $columnSchema = $connection.GetOleDbSchemaTable(
                [System.Data.OleDb.OleDbSchemaGuid]::Columns,
                @($null, $null, $inventoryTable, $null)
            )
            foreach ($columnRow in $columnSchema.Rows) {
                $columnName = [string]$columnRow.COLUMN_NAME
                $isExported = $inventoryTable -in $allowedTables -and (
                    $inventoryTable -in $clinicalTables -or $columnName -in $allowedColumns[$inventoryTable]
                )
                $disposition = if ($isExported) {
                    if ($inventoryTable -in $clinicalTables) { "preserved" } else { "mapped" }
                } else { "intentionally_excluded" }
                $inventoryWriter.WriteLine("$(Escape-Csv $inventoryTable),$(Escape-Csv $columnName),$disposition")
            }
        }
    } finally { $inventoryWriter.Dispose() }
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

        # Preserve all columns of explicitly approved clinical tables across versions.
        # Identity/user/catalog tables keep their restricted column allowlists.
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
        if ($table -in $clinicalTables) { $columns = @($actualColumns.Keys | Sort-Object) }
        if (-not $columns.Count) { continue }

        $selectColumns = ($columns | ForEach-Object { "[" + $_.Replace("]", "]]" ) + "]" }) -join ","
        $where = ""
        if ($clientDependentColumns.ContainsKey($table)) {
            $where = " WHERE [$($clientDependentColumns[$table])] IN ($clientIdSql)"
        } elseif ($table -eq "tblCrdFrpsLines") {
            $where = " WHERE [FrpId] IN (SELECT [FrpId] FROM [tblCrdFrps] WHERE [PerId] IN ($clientIdSql))"
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
$documentReferences = @()
$missingReferencedDocumentCount = 0
$ambiguousReferencedDocumentCount = 0
$sourceDocumentCount = 0
$unreferencedDocumentCount = 0
$referencedDocumentNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$referenceSpecs = @{
    tblPerPicture = @("PicFileName"); tblCrdOverViews = @("Pic");
    tblCrdOrthoks = @("PICR", "PICL"); tblCrdClinicChecks = @("Pic3", "Pic4")
}
$pendingReferences = @()
foreach ($table in $referenceSpecs.Keys) {
    $sourceCsv = Join-Path $tablesDir "$table.csv"
    if (-not (Test-Path -LiteralPath $sourceCsv)) { continue }
    $rowIndex = 0
    foreach ($row in Import-Csv -LiteralPath $sourceCsv) {
        $rowIndex++
        foreach ($field in $referenceSpecs[$table]) {
            $name = [string]$row.$field
            if (-not $name) { continue }
            [void]$referencedDocumentNames.Add([IO.Path]::GetFileName($name))
            $pendingReferences += [PSCustomObject]@{
                source_table = $table; source_field = $field; source_ref = "$($table):row=$rowIndex"
                source_per_id = [string]$row.PerId; source_check_date = [string]$row.CheckDate; value = $name
            }
        }
    }
}
if ($IncludeDocuments -and $ScansDir -and (Test-Path -LiteralPath $ScansDir)) {
    $sourceFiles = @(Get-ChildItem -LiteralPath $ScansDir -File -Recurse)
    $sourceDocumentCount = $sourceFiles.Count
    $filesByName = @{}
    foreach ($file in $sourceFiles) {
        $key = $file.Name.ToLowerInvariant()
        if (-not $filesByName.ContainsKey($key)) { $filesByName[$key] = @() }
        $filesByName[$key] += $file
    }
    $copied = @{}
    foreach ($reference in $pendingReferences) {
        $exactPath = Join-Path $ScansDir $reference.value
        $matches = if (Test-Path -LiteralPath $exactPath -PathType Leaf) { @(Get-Item -LiteralPath $exactPath) } else { @($filesByName[[IO.Path]::GetFileName($reference.value).ToLowerInvariant()]) }
        if ($matches.Count -eq 0) {
            $missingReferencedDocumentCount++
            $documentReferences += [PSCustomObject]@{ source_table=$reference.source_table; source_field=$reference.source_field; source_ref=$reference.source_ref; source_per_id=$reference.source_per_id; source_check_date=$reference.source_check_date; value=$reference.value; status="missing" }
            continue
        }
        if ($matches.Count -gt 1) {
            $ambiguousReferencedDocumentCount++
            $documentReferences += [PSCustomObject]@{ source_table=$reference.source_table; source_field=$reference.source_field; source_ref=$reference.source_ref; source_per_id=$reference.source_per_id; source_check_date=$reference.source_check_date; value=$reference.value; status="ambiguous" }
            continue
        }
        $source = $matches[0]
        $sourceKey = $source.FullName.ToLowerInvariant()
        if ($copied.ContainsKey($sourceKey)) {
            $manifestFile = $copied[$sourceKey]
        } else {
            $contentHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $source.FullName).Hash.ToLowerInvariant()
            $destinationName = $contentHash.Substring(0,16) + "-" + $source.Name
            $destination = Join-Path $documentsDir $destinationName
            Copy-Item -LiteralPath $source.FullName -Destination $destination -Force
            $manifestFile = "documents/$destinationName"
            $copied[$sourceKey] = $manifestFile
            $manifestDocuments += [PSCustomObject]@{ file=$manifestFile; sha256=$contentHash; size=(Get-Item -LiteralPath $destination).Length }
            $documentCount++
        }
        $documentReferences += [PSCustomObject]@{ source_table=$reference.source_table; source_field=$reference.source_field; source_ref=$reference.source_ref; source_per_id=$reference.source_per_id; source_check_date=$reference.source_check_date; value=$reference.value; status="included"; file=$manifestFile }
    }
    $unreferencedDocumentCount = @(
        $sourceFiles | Where-Object { -not $referencedDocumentNames.Contains($_.Name) }
    ).Count
} else {
    $missingReferencedDocumentCount = $pendingReferences.Count
    $documentReferences = @($pendingReferences | ForEach-Object {
        [PSCustomObject]@{ source_table=$_.source_table; source_field=$_.source_field; source_ref=$_.source_ref; source_per_id=$_.source_per_id; source_check_date=$_.source_check_date; value=$_.value; status="not_requested" }
    })
}

$dbInfo = Get-Item -LiteralPath $DbFile
$sourceDir = Join-Path $OutputDir "source"
$sourceArchivePath = Join-Path $sourceDir "optData.xns"
New-Item -ItemType Directory -Force -Path $sourceDir | Out-Null
Copy-Item -LiteralPath $DbFile -Destination $sourceArchivePath -Force
$sourceArchiveFingerprint = (Get-FileHash -Algorithm SHA256 -LiteralPath $sourceArchivePath).Hash.ToLowerInvariant()
$sourceFingerprint = $sourceArchiveFingerprint
$manifest = [PSCustomObject]@{
    source_system = "optitech"
    format_version = 2
    mapping_version = 3
    exported_at = (Get-Date).ToString("o")
    source = [PSCustomObject]@{
        database_size = $dbInfo.Length
        database_modified_at = $dbInfo.LastWriteTimeUtc.ToString("o")
    }
    source_fingerprint = $sourceFingerprint
    source_archive = [PSCustomObject]@{
        file = "source/optData.xns"
        kind = "original_database"
        original_name = $dbInfo.Name
        complete = $true
        size = (Get-Item -LiteralPath $sourceArchivePath).Length
        sha256 = $sourceArchiveFingerprint
    }
    client_limit = if ($ClientLimit -gt 0) { $ClientLimit } else { $null }
    selected_client_ids = $selectedClientIds
    source_schema_inventory = [PSCustomObject]@{
        file = "source-schema.csv"
        complete = $true
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $OutputDir "source-schema.csv")).Hash.ToLowerInvariant()
    }
    tables = $manifestTables
    documents = [PSCustomObject]@{
        included = [bool]$IncludeDocuments
        root = "documents"
        file_count = $documentCount
        source_file_count = $sourceDocumentCount
        missing_referenced_count = $missingReferencedDocumentCount
        ambiguous_referenced_count = $ambiguousReferencedDocumentCount
        unreferenced_file_count = $unreferencedDocumentCount
        files = $manifestDocuments
        references = $documentReferences
    }
}
[IO.File]::WriteAllText((Join-Path $OutputDir "manifest.json"), ($manifest | ConvertTo-Json -Depth 10), $utf8)
Write-Host "Export complete: $OutputDir"
