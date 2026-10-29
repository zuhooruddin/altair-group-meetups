# Rasterize the existing Ionicons people mark for the native splash config.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$fontPath = Join-Path $projectRoot 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'
$glyphPath = Join-Path $projectRoot 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'
$glyphs = Get-Content -LiteralPath $glyphPath -Raw | ConvertFrom-Json
$fonts = New-Object System.Drawing.Text.PrivateFontCollection
$fonts.AddFontFile($fontPath)
$bitmap = New-Object System.Drawing.Bitmap 512, 512
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$shape = New-Object System.Drawing.Drawing2D.GraphicsPath
$shape.AddArc(64, 64, 144, 144, 180, 90)
$shape.AddArc(304, 64, 144, 144, 270, 90)
$shape.AddArc(304, 304, 144, 144, 0, 90)
$shape.AddArc(64, 304, 144, 144, 90, 90)
$shape.CloseFigure()
$green = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#005B43'))
$graphics.FillPath($green, $shape)
$font = New-Object System.Drawing.Font ($fonts.Families[0], 210, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$bounds = New-Object System.Drawing.RectangleF 64, 64, 384, 384
$graphics.DrawString([string][char]$glyphs.people, $font, [System.Drawing.Brushes]::White, $bounds, $format)
$destination = Join-Path $projectRoot 'mobile/assets/splash-logo.png'
$bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
$format.Dispose()
$font.Dispose()
$green.Dispose()
$shape.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
$fonts.Dispose()
Write-Output "Generated $destination"
