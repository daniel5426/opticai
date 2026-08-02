param(
    [Parameter(Mandatory=$true)][string]$DbFile,
    [Parameter(Mandatory=$true)][string]$OutputDir,
    [string]$ScansDir = "",
    [switch]$IncludeDocuments
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
        } catch {
            $errors += "$provider`: $($_.Exception.Message)"
        }
    }
    throw "Could not open OptiTech database. Close OptiTech and verify that a 32-bit Jet/ACE provider is installed. $($errors -join ' | ')"
}

if (-not (Test-Path -LiteralPath $DbFile)) { throw "OptiTech database was not found: $DbFile" }
$OutputDir = [IO.Path]::GetFullPath($OutputDir)
$tablesDir = Join-Path $OutputDir "tables"
$documentsDir = Join-Path $OutputDir "documents"
New-Item -ItemType Directory -Force -Path $tablesDir | Out-Null

$connection = Open-OptiTechConnection $DbFile
try {
    $schema = $connection.GetSchema("Tables")
    $tableNames = @(
        $schema.Rows |
            Where-Object { $_.TABLE_TYPE -eq "TABLE" -and -not ([string]$_.TABLE_NAME).StartsWith("MSys") } |
            ForEach-Object { [string]$_.TABLE_NAME } |
            Sort-Object
    )
    $required = @("tblPerData", "tblUsers", "tblCrdGlassChecks", "tblCrdClensChecks")
    $missing = @($required | Where-Object { $_ -notin $tableNames })
    if ($missing.Count -gt 0) { throw "Selected database is not a supported OptiTech database. Missing: $($missing -join ', ')" }

    $manifestTables = @()
    foreach ($table in $tableNames) {
        $safeName = $table.Replace("]", "]]")
        $command = $connection.CreateCommand()
        $command.CommandText = "SELECT * FROM [$safeName]"
        $reader = $command.ExecuteReader()
        $target = Join-Path $tablesDir "$table.csv"
        $writer = [IO.StreamWriter]::new($target, $false, $utf8)
        $rows = 0
        try {
            $columns = @()
            for ($index = 0; $index -lt $reader.FieldCount; $index++) { $columns += $reader.GetName($index) }
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
} finally {
    $connection.Dispose()
}

$documentCount = 0
if ($IncludeDocuments -and $ScansDir -and (Test-Path -LiteralPath $ScansDir)) {
    New-Item -ItemType Directory -Force -Path $documentsDir | Out-Null
    Get-ChildItem -LiteralPath $ScansDir -File | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $documentsDir $_.Name) -Force
        $documentCount++
    }
}

$dbInfo = Get-Item -LiteralPath $DbFile
$manifest = [PSCustomObject]@{
    source_system = "optitech"
    format_version = 1
    exported_at = (Get-Date).ToString("o")
    source = [PSCustomObject]@{
        database_size = $dbInfo.Length
        database_modified_at = $dbInfo.LastWriteTimeUtc.ToString("o")
    }
    source_fingerprint = (Get-FileHash -Algorithm SHA256 -LiteralPath $DbFile).Hash.ToLowerInvariant()
    tables = $manifestTables
    documents = [PSCustomObject]@{
        included = [bool]$IncludeDocuments
        root = "documents"
        file_count = $documentCount
    }
}
[IO.File]::WriteAllText((Join-Path $OutputDir "manifest.json"), ($manifest | ConvertTo-Json -Depth 8), $utf8)
Write-Host "Export complete: $OutputDir"
