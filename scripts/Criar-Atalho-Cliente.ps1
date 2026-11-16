$ErrorActionPreference = 'Stop'
$servidor = (Read-Host 'Digite o IP ou nome do computador servidor (ex.: 192.168.1.17)').Trim()
if ($servidor -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]{0,251}$') {
    Write-Host 'Endereco invalido. Digite somente o IP ou nome do servidor, sem http:// ou porta.' -ForegroundColor Red
    exit 1
}
if ($servidor -match '^\d{1,3}(\.\d{1,3}){3}$') {
    if (@($servidor.Split('.') | Where-Object { [int]$_ -gt 255 }).Count -gt 0) {
        Write-Host 'Endereco IPv4 invalido.' -ForegroundColor Red
        exit 1
    }
}
$atalho = Join-Path ([Environment]::GetFolderPath('Desktop')) 'FrotaGesta.url'
$endereco = "http://${servidor}:5000/"
Set-Content -LiteralPath $atalho -Value "[InternetShortcut]`r`nURL=$endereco`r`n" -Encoding ASCII
Write-Host "Atalho criado em $atalho" -ForegroundColor Green
Write-Host "O icone vai abrir: $endereco"
