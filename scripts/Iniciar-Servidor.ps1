$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $raiz 'backend'
$envPath = Join-Path $backend '.env'
$site = Join-Path $raiz 'frontend\build\index.html'

if (!(Test-Path $envPath)) {
    Write-Host 'Configuracao ausente: backend\.env. Copie .env.example e preencha os dados do PostgreSQL.' -ForegroundColor Red
    exit 1
}
if (!(Test-Path (Join-Path $backend 'node_modules\express'))) {
    Write-Host 'Dependencias do backend ausentes. Abra PowerShell em backend e execute npm ci.' -ForegroundColor Red
    exit 1
}
if (!(Test-Path $site)) {
    Write-Host 'Frontend compilado nao encontrado. Execute npm run build na pasta frontend.' -ForegroundColor Red
    exit 1
}
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (!$node) {
    Write-Host 'Node.js nao encontrado. Instale Node.js 22 ou superior no computador servidor.' -ForegroundColor Red
    exit 1
}
$versaoNode = (& $node.Source --version) -replace '^v', ''
if ([int]($versaoNode -split '\.')[0] -lt 22) {
    Write-Host 'O servidor precisa de Node.js 22 ou superior.' -ForegroundColor Red
    exit 1
}
$porta = 5000
foreach ($linha in (Get-Content $envPath)) {
    if ($linha -match '^\s*PORT\s*=\s*["'']?(\d+)') { $porta = [int]$Matches[1] }
}
if ($porta -lt 1 -or $porta -gt 65535) {
    Write-Host 'PORT invalida no arquivo .env.' -ForegroundColor Red
    exit 1
}
$url = "http://localhost:${porta}/"
function SiteDisponivel {
    try {
        $resposta = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        return $resposta.StatusCode -eq 200 -and $resposta.Content.Contains('FrotaGesta')
    } catch { return $false }
}
$servidorJaRodando = SiteDisponivel
if (!$servidorJaRodando) {
    $ocupada = $false
    try {
        $socket = New-Object System.Net.Sockets.TcpClient
        $socket.Connect('127.0.0.1', $porta)
        $ocupada = $true
    } catch {} finally { if ($socket) { $socket.Close() } }
    if ($ocupada) {
        Write-Host "A porta $porta ja esta em uso por outro programa. Verifique o servidor antes de continuar." -ForegroundColor Red
        exit 1
    }
    Write-Host 'Iniciando FrotaGesta no computador servidor...'
    $processo = Start-Process -FilePath $node.Source -ArgumentList '--env-file-if-exists=.env','server.js' -WorkingDirectory $backend -WindowStyle Minimized -PassThru
    for ($i = 0; $i -lt 30; $i++) {
        if (SiteDisponivel) { break }
        if ($processo.HasExited) { break }
        Start-Sleep -Seconds 1
    }
    if (!(SiteDisponivel)) {
        Write-Host 'Servidor nao respondeu. Verifique PostgreSQL, .env e a janela do Node.js.' -ForegroundColor Red
        exit 1
    }
}
Write-Host "Servidor pronto em $url" -ForegroundColor Green
Write-Host 'Mantenha o processo do Node.js em execucao para os outros computadores acessarem.'
Start-Process $url
