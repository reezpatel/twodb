$ErrorActionPreference = "Continue"

$installDir = Join-Path $env:ProgramFiles "TwodbNode"
$serviceExe = Join-Path $installDir "twodb-node-service.exe"

if (Test-Path $serviceExe) {
  & $serviceExe stop
  & $serviceExe uninstall
}

Remove-BinFile -Name "twodb-node"

if (Test-Path $installDir) {
  Remove-Item $installDir -Recurse -Force
}
