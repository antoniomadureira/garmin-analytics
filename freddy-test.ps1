$APP = "https://freddy.coach"

$client = Invoke-RestMethod -Method Post -Uri "$APP/oauth/register" -ContentType "application/json" -Body (@{ client_name = "Teste Manual"; redirect_uris = @("http://localhost") } | ConvertTo-Json)
$clientId = $client.client_id
$clientSecret = $client.client_secret
Write-Host "client_id: $clientId"

$da = Invoke-RestMethod -Method Post -Uri "$APP/oauth/device_authorization" -ContentType "application/x-www-form-urlencoded" -Body @{ client_id = $clientId; scope = "mcp account:read connections:write" }
$deviceCode = $da.device_code
Write-Host ""
Write-Host "Abra este URL e aprove:" $da.verification_uri_complete
Write-Host "A aguardar aprovacao..."

$token = $null
while ($true) {
    Start-Sleep -Seconds $da.interval
    try {
        $token = Invoke-RestMethod -Method Post -Uri "$APP/oauth/token" -ContentType "application/x-www-form-urlencoded" -Body @{ grant_type = "urn:ietf:params:oauth:grant-type:device_code"; client_id = $clientId; client_secret = $clientSecret; device_code = $deviceCode }
        break
    } catch {
        Write-Host "A aguardar... ($($_.ErrorDetails.Message))"
    }
}

Write-Host ""
Write-Host "--- RESULTADO ---"
$token | ConvertTo-Json
