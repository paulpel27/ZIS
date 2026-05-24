# MedCore ZIS - Lichtgewicht Web Server
# Dit script start een lokale webserver op http://localhost:8000/ zonder extra installaties (geen Node.js of Python nodig).

$Port = 8000
$BaseDir = "d:\ZIS"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
    Clear-Host
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "     MedCore ZIS PWA - Lokale Web Server" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "Server succesvol gestart!" -ForegroundColor Green
    Write-Host "Ga in uw browser naar: http://localhost:$Port/" -ForegroundColor Yellow
    Write-Host "Druk op [Ctrl + C] in dit venster om te stoppen." -ForegroundColor Red
    Write-Host "==================================================" -ForegroundColor Cyan
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") { $urlPath = "/index.html" }
        
        # Normaliseer pad voor Windows
        $relPath = $urlPath.Substring(1).Replace('/', '\')
        $filePath = Join-Path $BaseDir $relPath
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = "application/octet-stream"
            switch ($ext) {
                ".html" { $mime = "text/html; charset=utf-8" }
                ".css"  { $mime = "text/css; charset=utf-8" }
                ".js"   { $mime = "text/javascript; charset=utf-8" }
                ".png"  { $mime = "image/png" }
                ".json" { $mime = "application/json; charset=utf-8" }
                ".ico"  { $mime = "image/x-icon" }
            }
            
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Niet Gevonden")
            $response.ContentType = "text/plain"
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.OutputStream.Close()
    }
} catch {
    Write-Error $_
} finally {
    $listener.Close()
}
