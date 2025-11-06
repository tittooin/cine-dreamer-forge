$envFile = ".env"
$envContent = Get-Content $envFile

Write-Host "GitHub Secrets to Add:" -ForegroundColor Green
Write-Host "----------------------" -ForegroundColor Green

foreach ($line in $envContent) {
    if ($line -match '^\s*([^=]+)=(.+)\s*$') {
        $key = $matches[1]
        $value = $matches[2]
        
        # Remove quotes if present
        $value = $value -replace '^"(.*)"$', '$1'
        $value = $value -replace "^'(.*)'$", '$1'
        
        Write-Host "Secret Name: $key" -ForegroundColor Cyan
        Write-Host "Secret Value: $value" -ForegroundColor Yellow
        Write-Host "----------------------" -ForegroundColor Green
    }
}

Write-Host "Instructions:" -ForegroundColor Magenta
Write-Host "1. Go to your GitHub repository: https://github.com/tittooin/cine-dreamer-forge" -ForegroundColor White
Write-Host "2. Click on 'Settings' tab" -ForegroundColor White
Write-Host "3. In the left sidebar, click on 'Secrets and variables' > 'Actions'" -ForegroundColor White
Write-Host "4. Click on 'New repository secret'" -ForegroundColor White
Write-Host "5. Add each secret with the name and value shown above" -ForegroundColor White
Write-Host "6. After adding all secrets, a new deployment will be triggered automatically" -ForegroundColor White

Write-Host "`nPress any key to continue..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")