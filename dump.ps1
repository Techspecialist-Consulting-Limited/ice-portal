$lines = Get-Content 'C:\Users\Tofee\Desktop\ice-portal-in-house\src\app\incidents\incident-status.tsx'
for($i=46; $i -lt $lines.Length; $i++){ if($i -ge 46 -and $i -le 65){ Write-Output ($i+1).ToString() + ': ' + $lines[$i] } }
