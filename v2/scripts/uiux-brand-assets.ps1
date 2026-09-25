# Deterministic rectangular crops only. No redraw, resampling or color changes.
param([Parameter(Mandatory=$true)][string]$Source)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$destination = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../apps/web/public/brand'))
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$sourceImage = [System.Drawing.Bitmap]::FromFile([IO.Path]::GetFullPath($Source))
try {
  if ($sourceImage.Width -ne 1672 -or $sourceImage.Height -ne 941) { throw 'Unexpected official reference dimensions' }
  Copy-Item -LiteralPath $Source -Destination (Join-Path $destination 'balsim-official-reference.png')
  $crops = @(
    @{Name='balsim-bright.png'; X=432; Y=32; W=808; H=430},
    @{Name='balsim-dark.png'; X=465; Y=524; W=744; H=381},
    @{Name='balsim-mark-bright.png'; X=728; Y=40; W=224; H=246},
    @{Name='balsim-mark-dark.png'; X=735; Y=528; W=210; H=225},
    @{Name='balsim-wordmark-bright.png'; X=485; Y=284; W=701; H=130},
    @{Name='balsim-wordmark-dark.png'; X=522; Y=748; W=630; H=110}
  )
  foreach ($crop in $crops) {
    $rect = [System.Drawing.Rectangle]::new($crop.X,$crop.Y,$crop.W,$crop.H)
    $image = $sourceImage.Clone($rect, $sourceImage.PixelFormat)
    try { $image.Save((Join-Path $destination $crop.Name), [System.Drawing.Imaging.ImageFormat]::Png) }
    finally { $image.Dispose() }
  }
} finally { $sourceImage.Dispose() }
Write-Output 'Official raster packaged: original plus six lossless crops; geometry unchanged.'
