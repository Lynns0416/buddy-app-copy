# Azure Automation runbook: start or stop the staging Postgres server.
# Runs as aa-peace-buddy-stg's managed identity, which holds only read/start/stop
# on this one server. Scheduled by #208 through 2026-10-31.
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('start', 'stop')]
    [string] $Action
)

$ErrorActionPreference = 'Stop'

$Server = '/subscriptions/6723d363-6d1e-4251-b0b1-6c269ca3e64c/resourceGroups/rg-peace-buddy/providers/Microsoft.DBforPostgreSQL/flexibleServers/psql-peace-buddy-stg'
$Api    = 'api-version=2024-08-01'

Connect-AzAccount -Identity | Out-Null

# Stopping a stopped server is an error, so check first and treat
# "already there" as success.
$Get = Invoke-AzRestMethod -Method GET -Path "$($Server)?$Api"
if ($Get.StatusCode -ne 200) { throw "GET server failed: $($Get.StatusCode) $($Get.Content)" }
$State = ($Get.Content | ConvertFrom-Json).properties.state
Write-Output "Server state: $State"

if ($Action -eq 'stop' -and $State -eq 'Stopped') { Write-Output 'Already stopped.'; return }
if ($Action -eq 'start' -and $State -eq 'Ready')  { Write-Output 'Already running.'; return }

$Post = Invoke-AzRestMethod -Method POST -Path "$($Server)/$($Action)?$Api"
if ($Post.StatusCode -notin 200, 202) { throw "$Action failed: $($Post.StatusCode) $($Post.Content)" }
Write-Output "$Action accepted ($($Post.StatusCode))."
