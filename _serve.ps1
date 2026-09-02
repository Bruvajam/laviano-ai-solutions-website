param([int]$Port = 8765)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Serving $root on http://127.0.0.1:$Port/"
$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.js'='application/javascript; charset=utf-8';
  '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg';
  '.gif'='image/gif'; '.ico'='image/x-icon'; '.woff'='font/woff'; '.woff2'='font/woff2';
  '.json'='application/json'
}
try {
  while ($listener.IsListening) {
    try { $ctx = $listener.GetContext() } catch { continue }
    try {
      $req = $ctx.Request; $res = $ctx.Response
      $rel = [uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
      if ([string]::IsNullOrEmpty($rel)) { $rel = 'Laviano AI Solutions.html' }
      $path = Join-Path $root $rel
      if (Test-Path $path -PathType Container) { $path = Join-Path $path 'index.html' }
      if (-not (Test-Path $path -PathType Leaf)) {
        $res.StatusCode = 404
        $b = [Text.Encoding]::UTF8.GetBytes("404: $rel"); $res.OutputStream.Write($b,0,$b.Length)
      } else {
        $ext = [IO.Path]::GetExtension($path).ToLower()
        $ct = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $res.ContentType = $ct; $res.Headers.Add("Cache-Control", "no-store")
        $b = [IO.File]::ReadAllBytes($path); $res.OutputStream.Write($b,0,$b.Length)
      }
    } catch { Write-Host "Req err: $_" }
    finally { try { $res.OutputStream.Close() } catch {} }
  }
} finally { $listener.Stop(); $listener.Close() }
