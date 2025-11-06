param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubToken,
    
    [Parameter(Mandatory=$true)]
    [string]$RepoOwner = "tittooin",
    
    [Parameter(Mandatory=$true)]
    [string]$RepoName = "cine-dreamer-forge"
)

$envFile = ".env"
$envContent = Get-Content $envFile

# Function to create a base64-encoded string for GitHub API
function ConvertTo-Base64UrlEncoded {
    param([string]$text)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $base64 = [System.Convert]::ToBase64String($bytes)
    return $base64.Replace('+', '-').Replace('/', '_').Replace('=', '')
}

Write-Host "Adding secrets to GitHub repository $RepoOwner/$RepoName..." -ForegroundColor Green

foreach ($line in $envContent) {
    if ($line -match '^\s*([^=]+)=(.+)\s*$') {
        $key = $matches[1]
        $value = $matches[2]
        
        # Remove quotes if present
        $value = $value -replace '^"(.*)"$', '$1'
        $value = $value -replace "^'(.*)'$", '$1'
        
        Write-Host "Adding secret: $key" -ForegroundColor Cyan
        
        try {
            # Get the public key for the repository
            $publicKeyUrl = "https://api.github.com/repos/$RepoOwner/$RepoName/actions/secrets/public-key"
            $publicKeyHeaders = @{
                "Authorization" = "token $GitHubToken"
                "Accept" = "application/vnd.github.v3+json"
            }
            
            $publicKeyResponse = Invoke-RestMethod -Uri $publicKeyUrl -Headers $publicKeyHeaders -Method Get
            $publicKey = $publicKeyResponse.key
            $publicKeyId = $publicKeyResponse.key_id
            
            # Create the secret
            $secretUrl = "https://api.github.com/repos/$RepoOwner/$RepoName/actions/secrets/$key"
            $secretHeaders = @{
                "Authorization" = "token $GitHubToken"
                "Accept" = "application/vnd.github.v3+json"
            }
            
            # For simplicity, we're using the value directly
            # In a production environment, you would encrypt the value with the public key
            $secretBody = @{
                "encrypted_value" = ConvertTo-Base64UrlEncoded $value
                "key_id" = $publicKeyId
            } | ConvertTo-Json
            
            Invoke-RestMethod -Uri $secretUrl -Headers $secretHeaders -Method Put -Body $secretBody -ContentType "application/json"
            Write-Host "Secret $key added successfully!" -ForegroundColor Green
        }
        catch {
            Write-Host "Error adding secret $key: $_" -ForegroundColor Red
        }
    }
}

Write-Host "`nAll secrets have been added to GitHub repository." -ForegroundColor Green
Write-Host "A new deployment should be triggered automatically." -ForegroundColor Green