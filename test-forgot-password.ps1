$body = @{
    email = "franciscoclassname@gmail.com"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/forgot-password" -Method POST -Headers @{"Content-Type"="application/json"} -Body $body

Write-Host "Response:"
$response | ConvertTo-Json
