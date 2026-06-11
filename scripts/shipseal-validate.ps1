Write-Host "== ShipSeal validation =="

Write-Host "1/5 Running tests..."
npm run test
if ($LASTEXITCODE -ne 0) {
  Write-Host "FAILED: npm run test"
  exit $LASTEXITCODE
}

Write-Host "2/5 Running build..."
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "FAILED: npm run build"
  exit $LASTEXITCODE
}

Write-Host "3/5 Checking required source files..."

$requiredFiles = @(
  "src/lib/deliveryPack/types.ts",
  "src/lib/deliveryPack/manifest.ts",
  "src/lib/deliveryPack/index.ts"
)

foreach ($file in $requiredFiles) {
  if (-not (Test-Path $file)) {
    Write-Host "FAILED: missing $file"
    exit 1
  }
}

Write-Host "4/5 Checking required test files..."

$expectedTests = @(
  "src/test/deliveryPackManifest.test.ts",
  "src/test/aiActReadiness.test.ts",
  "src/test/testingPack.test.ts",
  "src/test/skillsPack.test.ts",
  "src/test/clientHandoffReport.test.ts"
)

foreach ($file in $expectedTests) {
  if (-not (Test-Path $file)) {
    Write-Host "WARNING: missing optional sprint test $file"
  }
}

Write-Host "5/5 Checking ShipSeal naming..."

$badMarketingRefs = Select-String -Path "src/**/*.tsx","src/**/*.ts","README.md" -Pattern "AgentReady" -ErrorAction SilentlyContinue

if ($badMarketingRefs) {
  Write-Host "WARNING: AgentReady references still found. Review if they are only internal legacy references:"
  $badMarketingRefs | Select-Object -First 20 | ForEach-Object {
    Write-Host "$($_.Path):$($_.LineNumber) $($_.Line)"
  }
}

Write-Host "OK: ShipSeal validation completed."