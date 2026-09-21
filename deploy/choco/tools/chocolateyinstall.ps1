$ErrorActionPreference = "Stop"

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$installDir = Join-Path $env:ProgramFiles "TwodbNode"

$agentExe = Join-Path $toolsDir "twodb-node-windows-x64.exe"
if (-not (Test-Path $agentExe)) {
  $agentExe = Join-Path $toolsDir "twodb-node.exe"
}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

Copy-Item $agentExe (Join-Path $installDir "twodb-node.exe") -Force
Copy-Item (Join-Path $toolsDir "WinSW.exe") (Join-Path $installDir "twodb-node-service.exe") -Force

$nodeUrl = [Environment]::GetEnvironmentVariable("TWODB_NODE_URL", "Machine")
$nodeToken = [Environment]::GetEnvironmentVariable("TWODB_NODE_TOKEN", "Machine")
$nodeRoot = [Environment]::GetEnvironmentVariable("TWODB_ROOT", "Machine")

$serviceConfig = @"
<service>
  <id>twodb-node</id>
  <name>TwoDB Node Agent</name>
  <description>TwoDB node agent service</description>
  <executable>$(Join-Path $installDir "twodb-node.exe")</executable>
  <env name="TWODB_NODE_URL" value="$nodeUrl" />
  <env name="TWODB_NODE_TOKEN" value="$nodeToken" />
  <env name="TWODB_ROOT" value="$nodeRoot" />
  <log mode="roll-by-size">
    <sizeThreshold>10485760</sizeThreshold>
    <keepFiles>4</keepFiles>
  </log>
  <onfailure action="restart" delay="10 sec" />
</service>
"@

Set-Content -Path (Join-Path $installDir "twodb-node-service.xml") -Value $serviceConfig -Encoding Ascii

& (Join-Path $installDir "twodb-node-service.exe") install

Install-BinFile -Name "twodb-node" -Path (Join-Path $installDir "twodb-node.exe")
