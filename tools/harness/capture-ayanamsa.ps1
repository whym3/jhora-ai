# Capture JHora 8.0's Key Info longitudes under every ayanamsa choice (dialog 155)
# for tests/ayanamsaGolden.test.ts. Runs JHora: only on the capture desktop.
#
#   powershell -File tools/harness/capture-ayanamsa.ps1 [-Jhora <copy-root>]
#
# Every run passes all ayanamsa keys, so a leftover value from an earlier run
# cannot leak in; the last step writes JHora's defaults back into the copy's ini.
param([string]$Jhora = "$HOME\.local\share\jhweb\jhora-harness")
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\..')

$charts = @('Swami Vivekananda', 'India', 'Author of this software', 'Ramakrishna Paramahansa') |
  ForEach-Object { "golden/charts/$_.jhd" }
$defaults = [ordered]@{
  UserSelectedAyanamsa = '17'; DeltaFromUserSelectedAyanamsa = '0.000000'; SiderealNaksharasInTropical = '0'
  CustomStarCode = ',alVir'; CustomStarLongitude = '180.000000'; FixedPlaneInCustomStarAyanamsa = '0'
}
# output folder -> overrides on top of $defaults
$runs = [ordered]@{
  '00-lahiri' = @{ UserSelectedAyanamsa = '0' }
  '01-jagannatha' = @{ UserSelectedAyanamsa = '1' }
  '02-raman' = @{ UserSelectedAyanamsa = '2' }
  '03-deva-datta' = @{ UserSelectedAyanamsa = '3' }
  '04-kp' = @{ UserSelectedAyanamsa = '4' }
  '05-usha-shashi' = @{ UserSelectedAyanamsa = '5' }
  '06-yukteshwar' = @{ UserSelectedAyanamsa = '6' }
  '07-jn-bhasin' = @{ UserSelectedAyanamsa = '7' }
  '08-chandra-hari' = @{ UserSelectedAyanamsa = '8' }
  '09-fagan' = @{ UserSelectedAyanamsa = '9' }
  '10-deluce' = @{ UserSelectedAyanamsa = '10' }
  '11-djwhal-khul' = @{ UserSelectedAyanamsa = '11' }
  '12-aldebaran-15ta' = @{ UserSelectedAyanamsa = '12' }
  '13-galactic-center' = @{ UserSelectedAyanamsa = '13' }
  '14-hipparchos' = @{ UserSelectedAyanamsa = '14' }
  '15-sassanian' = @{ UserSelectedAyanamsa = '15' }
  '16-tropical' = @{ UserSelectedAyanamsa = '16' }
  '16-tropical-sidereal-nakshatras' = @{ UserSelectedAyanamsa = '16'; SiderealNaksharasInTropical = '1' }
  '17-delta-minus-0.25' = @{ UserSelectedAyanamsa = '17'; DeltaFromUserSelectedAyanamsa = '-0.250000' }
  '18-sss' = @{ UserSelectedAyanamsa = '18' }
  '19-custom-alVir' = @{ UserSelectedAyanamsa = '19' }
  '19-custom-alTau-46.5-plane' = @{ UserSelectedAyanamsa = '19'; CustomStarCode = ',alTau'; CustomStarLongitude = '46.500000'; FixedPlaneInCustomStarAyanamsa = '1' }
  '20-rohini-paksha' = @{ UserSelectedAyanamsa = '20' }
  '21-pushya-paksha' = @{ UserSelectedAyanamsa = '21' }
}

foreach ($run in $runs.GetEnumerator()) {
  $ini = [ordered]@{}
  foreach ($k in $defaults.Keys) { $ini[$k] = $defaults[$k] }
  foreach ($k in $run.Value.Keys) { $ini[$k] = $run.Value[$k] }
  $iniArgs = $ini.GetEnumerator() | ForEach-Object { '--ini'; "$($_.Key)=$($_.Value)" }
  python tools/harness/capture.py --jhora $Jhora --views tools/harness/views-ayanamsa.json `
    --out "golden/jhora-ayanamsa/$($run.Key)" @iniArgs @charts
  if ($LASTEXITCODE) { throw "capture failed for $($run.Key)" }
}

# restore JHora's defaults in the copy
$restore = ($defaults.GetEnumerator() | ForEach-Object { "'$($_.Key)': '$($_.Value)'" }) -join ', '
python -c "import sys; sys.path.insert(0, 'tools/harness'); from capture import write_ini_overrides; write_ini_overrides(sys.argv[1], {$restore})" $Jhora
