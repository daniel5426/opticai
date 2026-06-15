param(
    [string]$OutputDir = "",
    [string]$Dsn = "RRDB",
    [string]$DbFile = "",
    [string]$Uid = "dba",
    [string]$Pwd = "sql",
    [string]$Owner = "creator",
    [string]$SqlAnywhereBin = "",
    [string]$SourceCodepage = "1255"
)

$ErrorActionPreference = "Stop"

function Resolve-DbIsql {
    param([string]$BinDir, [string]$DsnName)

    if ($BinDir) {
        $candidate = Join-Path $BinDir "dbisql.exe"
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }

    $dsnKeys = @(
        "HKLM:\SOFTWARE\WOW6432Node\ODBC\ODBC.INI\$DsnName",
        "HKCU:\SOFTWARE\WOW6432Node\ODBC\ODBC.INI\$DsnName",
        "HKLM:\SOFTWARE\ODBC\ODBC.INI\$DsnName",
        "HKCU:\SOFTWARE\ODBC\ODBC.INI\$DsnName"
    )
    foreach ($key in $dsnKeys) {
        if (Test-Path $key) {
            $driver = (Get-ItemProperty $key).Driver
            if ($driver) {
                $candidate = Join-Path (Split-Path $driver -Parent) "dbisql.exe"
                if (Test-Path -LiteralPath $candidate) { return $candidate }
            }
        }
    }

    $fallbacks = @(
        "C:\Program Files (x86)\RRProg\ASA\Win32\dbisql.exe",
        "C:\Program Files (x86)\SQL Anywhere 8\win32\dbisql.exe",
        "C:\Program Files\SQL Anywhere 8\win32\dbisql.exe"
    )
    foreach ($candidate in $fallbacks) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }

    throw "Could not find SQL Anywhere dbisql.exe. Pass -SqlAnywhereBin with the folder containing dbisql.exe."
}

function Escape-SqlString {
    param([string]$Value)
    return $Value.Replace("'", "''")
}

function Quote-Identifier {
    param([string]$Name)
    return '"' + $Name.Replace('"', '""') + '"'
}

function Convert-CsvHeader {
    param([string[]]$Columns)
    $escaped = foreach ($column in $Columns) {
        if ($column -match '[,"\r\n]') {
            '"' + $column.Replace('"', '""') + '"'
        } else {
            $column
        }
    }
    return ($escaped -join ",")
}

function Run-Isql {
    param(
        [string]$DbIsql,
        [string]$Connection,
        [string]$SqlFile,
        [string]$Codepage
    )

    & $DbIsql -nogui -ODBC -q -codepage $Codepage -c $Connection $SqlFile
    if ($LASTEXITCODE -ne 0) {
        throw "dbisql failed with exit code $LASTEXITCODE while running $SqlFile"
    }
}

if (-not $OutputDir) {
    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $OutputDir = Join-Path (Get-Location) "opticsoft_csv_export_$stamp"
}

$dbisql = Resolve-DbIsql -BinDir $SqlAnywhereBin -DsnName $Dsn
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
$rawDir = Join-Path $OutputDir "_raw_cp$SourceCodepage"
New-Item -ItemType Directory -Force -Path $OutputDir, $rawDir | Out-Null

if ($DbFile) {
    $engineName = "opticsoft_extract_$PID"
    $databaseName = "opticsoft_data_$PID"
    $connection = "UID=$Uid;PWD=$Pwd;DBF=$DbFile;ENG=$engineName;DBN=$databaseName"
} else {
    $connection = "DSN=$Dsn;UID=$Uid;PWD=$Pwd"
}

$tablesPath = Join-Path $rawDir "__tables.csv"
$columnsPath = Join-Path $rawDir "__columns.csv"
$metadataSql = Join-Path $rawDir "__metadata.sql"

$tablesSqlPath = Escape-SqlString $tablesPath
$columnsSqlPath = Escape-SqlString $columnsPath
$ownerSql = Escape-SqlString $Owner

@"
select t.table_name
from sys.systable t
join sys.sysuserperm u on t.creator = u.user_id
where u.user_name = '$ownerSql'
  and t.table_type = 'BASE'
order by t.table_name;
output to '$tablesSqlPath'
delimited by ','
quote '"';

select t.table_name, c.column_id, c.column_name
from sys.systable t
join sys.sysuserperm u on t.creator = u.user_id
join sys.syscolumn c on t.table_id = c.table_id
where u.user_name = '$ownerSql'
  and t.table_type = 'BASE'
order by t.table_name, c.column_id;
output to '$columnsSqlPath'
delimited by ','
quote '"';
exit;
"@ | Set-Content -LiteralPath $metadataSql -Encoding ascii

Run-Isql -DbIsql $dbisql -Connection $connection -SqlFile $metadataSql -Codepage $SourceCodepage

$sourceEncoding = [System.Text.Encoding]::GetEncoding([int]$SourceCodepage)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$tables = [System.IO.File]::ReadAllLines($tablesPath, $sourceEncoding) |
    Where-Object { $_.Trim() } |
    ForEach-Object { ($_ -replace '^"|"$', '').Replace('""', '"') }

$columnsByTable = @{}
foreach ($line in [System.IO.File]::ReadAllLines($columnsPath, $sourceEncoding)) {
    if (-not $line.Trim()) { continue }
    $parts = $line.Split(",", 3)
    if ($parts.Count -lt 3) { continue }
    $table = ($parts[0] -replace '^"|"$', '').Replace('""', '"')
    $column = ($parts[2] -replace '^"|"$', '').Replace('""', '"')
    if (-not $columnsByTable.ContainsKey($table)) {
        $columnsByTable[$table] = New-Object System.Collections.Generic.List[string]
    }
    $columnsByTable[$table].Add($column)
}

$exportSql = Join-Path $rawDir "__export_all.sql"
$sqlLines = New-Object System.Collections.Generic.List[string]
foreach ($table in $tables) {
    $rawCsv = Join-Path $rawDir "$table.csv"
    $rawCsvSql = Escape-SqlString $rawCsv
    $qualified = "$(Quote-Identifier $Owner).$(Quote-Identifier $table)"
    $sqlLines.Add("select * from $qualified;")
    $sqlLines.Add("output to '$rawCsvSql'")
    $sqlLines.Add("delimited by ','")
    $sqlLines.Add("quote '""';")
    $sqlLines.Add("")
}
$sqlLines.Add("exit;")
[System.IO.File]::WriteAllLines($exportSql, $sqlLines, [System.Text.Encoding]::ASCII)

Run-Isql -DbIsql $dbisql -Connection $connection -SqlFile $exportSql -Codepage $SourceCodepage

$manifestRows = New-Object System.Collections.Generic.List[object]
foreach ($table in $tables) {
    $rawCsv = Join-Path $rawDir "$table.csv"
    $finalCsv = Join-Path $OutputDir "$table.csv"
    $columns = if ($columnsByTable.ContainsKey($table)) { [string[]]$columnsByTable[$table] } else { @() }
    $header = Convert-CsvHeader -Columns $columns
    $body = if (Test-Path -LiteralPath $rawCsv) { [System.IO.File]::ReadAllText($rawCsv, $sourceEncoding) } else { "" }
    [System.IO.File]::WriteAllText($finalCsv, $header + "`r`n" + $body, $utf8NoBom)

    $lineCount = 0
    if ($body.Length -gt 0) {
        $lineCount = ([regex]::Matches($body, "`n")).Count
    }
    $manifestRows.Add([PSCustomObject]@{
        table = $table
        csv = $finalCsv
        columns = $columns.Count
        data_lines = $lineCount
    })
}

$manifest = [PSCustomObject]@{
    exported_at = (Get-Date).ToString("o")
    dbisql = $dbisql
    dsn = if ($DbFile) { $null } else { $Dsn }
    db_file = if ($DbFile) { $DbFile } else { $null }
    owner = $Owner
    source_codepage = $SourceCodepage
    output_dir = $OutputDir
    table_count = $tables.Count
    tables = $manifestRows
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $OutputDir "manifest.json") -Encoding utf8

Write-Host "Export complete: $OutputDir"
Write-Host "Tables exported: $($tables.Count)"
