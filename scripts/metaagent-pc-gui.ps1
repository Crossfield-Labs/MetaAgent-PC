param(
  [switch]$SelfTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($SelfTest) {
  Write-Output 'MetaAgent-PC GUI script loaded'
  exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$desktopServerPath = Join-Path $projectRoot 'dist\desktop-server.js'
$envFilePath = Join-Path $projectRoot '.env'

function Read-DotEnv {
  param([string]$Path)

  $result = @{}
  if (-not (Test-Path $Path)) {
    return $result
  }

  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }
    $pair = $trimmed -split '=', 2
    if ($pair.Count -eq 2) {
      $result[$pair[0].Trim()] = $pair[1].Trim()
    }
  }
  return $result
}

function Append-Log {
  param(
    [System.Windows.Forms.TextBox]$TextBox,
    [string]$Message
  )

  $TextBox.AppendText(("[$([DateTime]::Now.ToString('HH:mm:ss'))] $Message" + [Environment]::NewLine))
}

$envMap = Read-DotEnv -Path $envFilePath
$defaultHost = if ($envMap.ContainsKey('DESKTOP_REMOTE_API_HOST')) { $envMap['DESKTOP_REMOTE_API_HOST'] } else { '127.0.0.1' }
$defaultPort = if ($envMap.ContainsKey('DESKTOP_REMOTE_API_PORT')) { $envMap['DESKTOP_REMOTE_API_PORT'] } else { '3210' }
$defaultToken = if ($envMap.ContainsKey('DESKTOP_REMOTE_API_TOKEN')) { $envMap['DESKTOP_REMOTE_API_TOKEN'] } else { '' }

$form = New-Object System.Windows.Forms.Form
$form.Text = 'MetaAgent-PC'
$form.Size = New-Object System.Drawing.Size(960, 760)
$form.StartPosition = 'CenterScreen'
$form.MinimumSize = New-Object System.Drawing.Size(960, 760)

$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = 'MetaAgent-PC Launcher'
$titleLabel.Font = New-Object -TypeName System.Drawing.Font -ArgumentList 'Segoe UI', 16, ([System.Drawing.FontStyle]::Bold)
$titleLabel.Location = New-Object System.Drawing.Point(18, 16)
$titleLabel.Size = New-Object System.Drawing.Size(320, 34)
$form.Controls.Add($titleLabel)

$subtitleLabel = New-Object System.Windows.Forms.Label
$subtitleLabel.Text = 'Start the desktop control service for MetaAgent phone clients.'
$subtitleLabel.Location = New-Object System.Drawing.Point(20, 52)
$subtitleLabel.Size = New-Object System.Drawing.Size(420, 20)
$form.Controls.Add($subtitleLabel)

$hostLabel = New-Object System.Windows.Forms.Label
$hostLabel.Text = 'Host'
$hostLabel.Location = New-Object System.Drawing.Point(22, 92)
$hostLabel.Size = New-Object System.Drawing.Size(80, 20)
$form.Controls.Add($hostLabel)

$hostInput = New-Object System.Windows.Forms.TextBox
$hostInput.Location = New-Object System.Drawing.Point(22, 114)
$hostInput.Size = New-Object System.Drawing.Size(180, 27)
$hostInput.Text = $defaultHost
$form.Controls.Add($hostInput)

$portLabel = New-Object System.Windows.Forms.Label
$portLabel.Text = 'Port'
$portLabel.Location = New-Object System.Drawing.Point(220, 92)
$portLabel.Size = New-Object System.Drawing.Size(80, 20)
$form.Controls.Add($portLabel)

$portInput = New-Object System.Windows.Forms.TextBox
$portInput.Location = New-Object System.Drawing.Point(220, 114)
$portInput.Size = New-Object System.Drawing.Size(100, 27)
$portInput.Text = $defaultPort
$form.Controls.Add($portInput)

$tokenLabel = New-Object System.Windows.Forms.Label
$tokenLabel.Text = 'Token'
$tokenLabel.Location = New-Object System.Drawing.Point(340, 92)
$tokenLabel.Size = New-Object System.Drawing.Size(80, 20)
$form.Controls.Add($tokenLabel)

$tokenInput = New-Object System.Windows.Forms.TextBox
$tokenInput.Location = New-Object System.Drawing.Point(340, 114)
$tokenInput.Size = New-Object System.Drawing.Size(250, 27)
$tokenInput.Text = $defaultToken
$form.Controls.Add($tokenInput)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = 'Status: stopped'
$statusLabel.Location = New-Object System.Drawing.Point(22, 156)
$statusLabel.Size = New-Object System.Drawing.Size(360, 24)
$statusLabel.Font = New-Object -TypeName System.Drawing.Font -ArgumentList 'Segoe UI', 10, ([System.Drawing.FontStyle]::Bold)
$form.Controls.Add($statusLabel)

$endpointLabel = New-Object System.Windows.Forms.Label
$endpointLabel.Text = 'Endpoint: -'
$endpointLabel.Location = New-Object System.Drawing.Point(22, 184)
$endpointLabel.Size = New-Object System.Drawing.Size(520, 22)
$form.Controls.Add($endpointLabel)

$startButton = New-Object System.Windows.Forms.Button
$startButton.Text = 'Start'
$startButton.Location = New-Object System.Drawing.Point(22, 220)
$startButton.Size = New-Object System.Drawing.Size(110, 34)
$form.Controls.Add($startButton)

$stopButton = New-Object System.Windows.Forms.Button
$stopButton.Text = 'Stop'
$stopButton.Location = New-Object System.Drawing.Point(142, 220)
$stopButton.Size = New-Object System.Drawing.Size(110, 34)
$stopButton.Enabled = $false
$form.Controls.Add($stopButton)

$healthButton = New-Object System.Windows.Forms.Button
$healthButton.Text = 'Health'
$healthButton.Location = New-Object System.Drawing.Point(262, 220)
$healthButton.Size = New-Object System.Drawing.Size(110, 34)
$healthButton.Enabled = $false
$form.Controls.Add($healthButton)

$copyButton = New-Object System.Windows.Forms.Button
$copyButton.Text = 'Copy URL'
$copyButton.Location = New-Object System.Drawing.Point(382, 220)
$copyButton.Size = New-Object System.Drawing.Size(110, 34)
$copyButton.Enabled = $false
$form.Controls.Add($copyButton)

$openSessionButton = New-Object System.Windows.Forms.Button
$openSessionButton.Text = 'Open Session'
$openSessionButton.Location = New-Object System.Drawing.Point(502, 220)
$openSessionButton.Size = New-Object System.Drawing.Size(110, 34)
$openSessionButton.Enabled = $false
$form.Controls.Add($openSessionButton)

$refreshButton = New-Object System.Windows.Forms.Button
$refreshButton.Text = 'Refresh'
$refreshButton.Location = New-Object System.Drawing.Point(622, 220)
$refreshButton.Size = New-Object System.Drawing.Size(100, 34)
$refreshButton.Enabled = $false
$form.Controls.Add($refreshButton)

$openFolderButton = New-Object System.Windows.Forms.Button
$openFolderButton.Text = 'Open Folder'
$openFolderButton.Location = New-Object System.Drawing.Point(732, 220)
$openFolderButton.Size = New-Object System.Drawing.Size(150, 34)
$form.Controls.Add($openFolderButton)

$infoBox = New-Object System.Windows.Forms.TextBox
$infoBox.Location = New-Object System.Drawing.Point(22, 274)
$infoBox.Size = New-Object System.Drawing.Size(900, 56)
$infoBox.Multiline = $true
$infoBox.ReadOnly = $true
$infoBox.ScrollBars = 'Vertical'
$infoBox.Text = "Click Start to launch the desktop service, then connect from your phone using the endpoint shown here.`r`nIf dist is missing, the GUI will run npm run build automatically."
$form.Controls.Add($infoBox)

$sessionGroup = New-Object System.Windows.Forms.GroupBox
$sessionGroup.Text = 'Desktop Session'
$sessionGroup.Location = New-Object System.Drawing.Point(22, 346)
$sessionGroup.Size = New-Object System.Drawing.Size(430, 150)
$form.Controls.Add($sessionGroup)

$sessionStatusLabel = New-Object System.Windows.Forms.Label
$sessionStatusLabel.Text = 'Session: none'
$sessionStatusLabel.Location = New-Object System.Drawing.Point(16, 28)
$sessionStatusLabel.Size = New-Object System.Drawing.Size(390, 20)
$sessionGroup.Controls.Add($sessionStatusLabel)

$sessionIdLabel = New-Object System.Windows.Forms.Label
$sessionIdLabel.Text = 'Session ID: -'
$sessionIdLabel.Location = New-Object System.Drawing.Point(16, 56)
$sessionIdLabel.Size = New-Object System.Drawing.Size(390, 20)
$sessionGroup.Controls.Add($sessionIdLabel)

$sessionExpiryLabel = New-Object System.Windows.Forms.Label
$sessionExpiryLabel.Text = 'Expires: -'
$sessionExpiryLabel.Location = New-Object System.Drawing.Point(16, 84)
$sessionExpiryLabel.Size = New-Object System.Drawing.Size(390, 20)
$sessionGroup.Controls.Add($sessionExpiryLabel)

$heartbeatButton = New-Object System.Windows.Forms.Button
$heartbeatButton.Text = 'Heartbeat'
$heartbeatButton.Location = New-Object System.Drawing.Point(16, 108)
$heartbeatButton.Size = New-Object System.Drawing.Size(110, 28)
$heartbeatButton.Enabled = $false
$sessionGroup.Controls.Add($heartbeatButton)

$closeSessionButton = New-Object System.Windows.Forms.Button
$closeSessionButton.Text = 'Close Session'
$closeSessionButton.Location = New-Object System.Drawing.Point(136, 108)
$closeSessionButton.Size = New-Object System.Drawing.Size(110, 28)
$closeSessionButton.Enabled = $false
$sessionGroup.Controls.Add($closeSessionButton)

$desktopGroup = New-Object System.Windows.Forms.GroupBox
$desktopGroup.Text = 'Desktop Tests'
$desktopGroup.Location = New-Object System.Drawing.Point(470, 346)
$desktopGroup.Size = New-Object System.Drawing.Size(452, 190)
$form.Controls.Add($desktopGroup)

$testHealthButton = New-Object System.Windows.Forms.Button
$testHealthButton.Text = 'Fetch Health'
$testHealthButton.Location = New-Object System.Drawing.Point(16, 28)
$testHealthButton.Size = New-Object System.Drawing.Size(120, 30)
$testHealthButton.Enabled = $false
$desktopGroup.Controls.Add($testHealthButton)

$testInfoButton = New-Object System.Windows.Forms.Button
$testInfoButton.Text = 'System Info'
$testInfoButton.Location = New-Object System.Drawing.Point(146, 28)
$testInfoButton.Size = New-Object System.Drawing.Size(120, 30)
$testInfoButton.Enabled = $false
$desktopGroup.Controls.Add($testInfoButton)

$testWindowsButton = New-Object System.Windows.Forms.Button
$testWindowsButton.Text = 'List Windows'
$testWindowsButton.Location = New-Object System.Drawing.Point(276, 28)
$testWindowsButton.Size = New-Object System.Drawing.Size(120, 30)
$testWindowsButton.Enabled = $false
$desktopGroup.Controls.Add($testWindowsButton)

$testClipboardButton = New-Object System.Windows.Forms.Button
$testClipboardButton.Text = 'Get Clipboard'
$testClipboardButton.Location = New-Object System.Drawing.Point(16, 70)
$testClipboardButton.Size = New-Object System.Drawing.Size(120, 30)
$testClipboardButton.Enabled = $false
$desktopGroup.Controls.Add($testClipboardButton)

$testLaunchButton = New-Object System.Windows.Forms.Button
$testLaunchButton.Text = 'Launch Notepad'
$testLaunchButton.Location = New-Object System.Drawing.Point(146, 70)
$testLaunchButton.Size = New-Object System.Drawing.Size(120, 30)
$testLaunchButton.Enabled = $false
$desktopGroup.Controls.Add($testLaunchButton)

$testEventButton = New-Object System.Windows.Forms.Button
$testEventButton.Text = 'Fetch Events'
$testEventButton.Location = New-Object System.Drawing.Point(276, 70)
$testEventButton.Size = New-Object System.Drawing.Size(120, 30)
$testEventButton.Enabled = $false
$desktopGroup.Controls.Add($testEventButton)

$summaryBox = New-Object System.Windows.Forms.TextBox
$summaryBox.Location = New-Object System.Drawing.Point(16, 108)
$summaryBox.Size = New-Object System.Drawing.Size(420, 28)
$summaryBox.ReadOnly = $true
$summaryBox.Text = 'Latest response: -'
$desktopGroup.Controls.Add($summaryBox)

$manualGroup = New-Object System.Windows.Forms.GroupBox
$manualGroup.Text = 'Manual Control'
$manualGroup.Location = New-Object System.Drawing.Point(22, 512)
$manualGroup.Size = New-Object System.Drawing.Size(430, 170)
$form.Controls.Add($manualGroup)

$mouseXLabel = New-Object System.Windows.Forms.Label
$mouseXLabel.Text = 'X'
$mouseXLabel.Location = New-Object System.Drawing.Point(16, 30)
$mouseXLabel.Size = New-Object System.Drawing.Size(20, 20)
$manualGroup.Controls.Add($mouseXLabel)

$mouseXInput = New-Object System.Windows.Forms.TextBox
$mouseXInput.Location = New-Object System.Drawing.Point(40, 28)
$mouseXInput.Size = New-Object System.Drawing.Size(70, 24)
$mouseXInput.Text = '400'
$manualGroup.Controls.Add($mouseXInput)

$mouseYLabel = New-Object System.Windows.Forms.Label
$mouseYLabel.Text = 'Y'
$mouseYLabel.Location = New-Object System.Drawing.Point(126, 30)
$mouseYLabel.Size = New-Object System.Drawing.Size(20, 20)
$manualGroup.Controls.Add($mouseYLabel)

$mouseYInput = New-Object System.Windows.Forms.TextBox
$mouseYInput.Location = New-Object System.Drawing.Point(150, 28)
$mouseYInput.Size = New-Object System.Drawing.Size(70, 24)
$mouseYInput.Text = '300'
$manualGroup.Controls.Add($mouseYInput)

$moveMouseButton = New-Object System.Windows.Forms.Button
$moveMouseButton.Text = 'Move'
$moveMouseButton.Location = New-Object System.Drawing.Point(240, 26)
$moveMouseButton.Size = New-Object System.Drawing.Size(75, 28)
$moveMouseButton.Enabled = $false
$manualGroup.Controls.Add($moveMouseButton)

$clickMouseButton = New-Object System.Windows.Forms.Button
$clickMouseButton.Text = 'Click'
$clickMouseButton.Location = New-Object System.Drawing.Point(325, 26)
$clickMouseButton.Size = New-Object System.Drawing.Size(75, 28)
$clickMouseButton.Enabled = $false
$manualGroup.Controls.Add($clickMouseButton)

$textInputLabel = New-Object System.Windows.Forms.Label
$textInputLabel.Text = 'Text'
$textInputLabel.Location = New-Object System.Drawing.Point(16, 70)
$textInputLabel.Size = New-Object System.Drawing.Size(30, 20)
$manualGroup.Controls.Add($textInputLabel)

$textInputBox = New-Object System.Windows.Forms.TextBox
$textInputBox.Location = New-Object System.Drawing.Point(52, 68)
$textInputBox.Size = New-Object System.Drawing.Size(250, 24)
$textInputBox.Text = 'hello from MetaAgent-PC'
$manualGroup.Controls.Add($textInputBox)

$sendTextButton = New-Object System.Windows.Forms.Button
$sendTextButton.Text = 'Type'
$sendTextButton.Location = New-Object System.Drawing.Point(315, 66)
$sendTextButton.Size = New-Object System.Drawing.Size(85, 28)
$sendTextButton.Enabled = $false
$manualGroup.Controls.Add($sendTextButton)

$keyInputLabel = New-Object System.Windows.Forms.Label
$keyInputLabel.Text = 'Key'
$keyInputLabel.Location = New-Object System.Drawing.Point(16, 110)
$keyInputLabel.Size = New-Object System.Drawing.Size(30, 20)
$manualGroup.Controls.Add($keyInputLabel)

$keyInputBox = New-Object System.Windows.Forms.TextBox
$keyInputBox.Location = New-Object System.Drawing.Point(52, 108)
$keyInputBox.Size = New-Object System.Drawing.Size(120, 24)
$keyInputBox.Text = 'ENTER'
$manualGroup.Controls.Add($keyInputBox)

$sendKeyButton = New-Object System.Windows.Forms.Button
$sendKeyButton.Text = 'Send Key'
$sendKeyButton.Location = New-Object System.Drawing.Point(184, 106)
$sendKeyButton.Size = New-Object System.Drawing.Size(90, 28)
$sendKeyButton.Enabled = $false
$manualGroup.Controls.Add($sendKeyButton)

$refreshScreenshotButton = New-Object System.Windows.Forms.Button
$refreshScreenshotButton.Text = 'Screenshot'
$refreshScreenshotButton.Location = New-Object System.Drawing.Point(286, 106)
$refreshScreenshotButton.Size = New-Object System.Drawing.Size(114, 28)
$refreshScreenshotButton.Enabled = $false
$manualGroup.Controls.Add($refreshScreenshotButton)

$previewGroup = New-Object System.Windows.Forms.GroupBox
$previewGroup.Text = 'Screenshot Preview'
$previewGroup.Location = New-Object System.Drawing.Point(470, 548)
$previewGroup.Size = New-Object System.Drawing.Size(452, 162)
$form.Controls.Add($previewGroup)

$previewBox = New-Object System.Windows.Forms.PictureBox
$previewBox.Location = New-Object System.Drawing.Point(16, 26)
$previewBox.Size = New-Object System.Drawing.Size(300, 120)
$previewBox.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$previewBox.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::Zoom
$previewGroup.Controls.Add($previewBox)

$previewMetaBox = New-Object System.Windows.Forms.TextBox
$previewMetaBox.Location = New-Object System.Drawing.Point(328, 26)
$previewMetaBox.Size = New-Object System.Drawing.Size(108, 120)
$previewMetaBox.Multiline = $true
$previewMetaBox.ReadOnly = $true
$previewMetaBox.Text = 'No screenshot loaded'
$previewGroup.Controls.Add($previewMetaBox)

$eventLabel = New-Object System.Windows.Forms.Label
$eventLabel.Text = 'Recent Events'
$eventLabel.Location = New-Object System.Drawing.Point(470, 512)
$eventLabel.Size = New-Object System.Drawing.Size(180, 20)
$form.Controls.Add($eventLabel)

$eventBox = New-Object System.Windows.Forms.TextBox
$eventBox.Location = New-Object System.Drawing.Point(470, 536)
$eventBox.Size = New-Object System.Drawing.Size(452, 90)
$eventBox.Multiline = $true
$eventBox.ReadOnly = $true
$eventBox.ScrollBars = 'Vertical'
$eventBox.Font = New-Object -TypeName System.Drawing.Font -ArgumentList 'Consolas', 9
$form.Controls.Add($eventBox)

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Location = New-Object System.Drawing.Point(22, 688)
$logBox.Size = New-Object System.Drawing.Size(430, 70)
$logBox.Multiline = $true
$logBox.ReadOnly = $true
$logBox.ScrollBars = 'Vertical'
$logBox.Font = New-Object -TypeName System.Drawing.Font -ArgumentList 'Consolas', 9
$form.Controls.Add($logBox)

$serverProcess = $null
$desktopSessionId = $null

function Invoke-DesktopApi {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )

  $headers = @{}
  if ($tokenInput.Text) {
    $headers['Authorization'] = "Bearer $($tokenInput.Text)"
  }

  $params = @{
    UseBasicParsing = $true
    Uri = ('{0}{1}' -f (Get-BaseUrl), $Path)
    Method = $Method
    Headers = $headers
    TimeoutSec = 8
  }

  if ($null -ne $Body) {
    $params['ContentType'] = 'application/json'
    $params['Body'] = ($Body | ConvertTo-Json -Depth 6 -Compress)
  }

  $response = Invoke-WebRequest @params
  return ($response.Content | ConvertFrom-Json)
}

function Set-Summary {
  param([string]$Text)
  $summaryBox.Text = ('Latest response: {0}' -f $Text)
}

function Set-PreviewImage {
  param(
    [string]$Base64,
    [int]$Width,
    [int]$Height
  )

  if (-not $Base64) {
    $previewBox.Image = $null
    $previewMetaBox.Text = 'No screenshot loaded'
    return
  }

  $bytes = [Convert]::FromBase64String($Base64)
  $memoryStream = New-Object System.IO.MemoryStream(,$bytes)
  $image = [System.Drawing.Image]::FromStream($memoryStream)
  $oldImage = $previewBox.Image
  $previewBox.Image = $image
  if ($null -ne $oldImage) {
    $oldImage.Dispose()
  }
  $memoryStream.Dispose()
  $previewMetaBox.Text = ('Size: {0}x{1}' -f $Width, $Height)
}

function Refresh-Events {
  try {
    $payload = Invoke-DesktopApi -Method 'GET' -Path '/api/desktop/events?limit=8'
    if ($payload.ok -and $payload.data.events) {
      $lines = @()
      foreach ($event in $payload.data.events) {
        $lines += ('[{0}] {1}' -f $event.createdAt, $event.type)
      }
      $eventBox.Text = ($lines -join [Environment]::NewLine)
    } else {
      $eventBox.Text = 'No events'
    }
  } catch {
    $eventBox.Text = ('Failed to load events: {0}' -f $_.Exception.Message)
  }
}

function Refresh-DesktopState {
  $running = $null -ne $serverProcess -and -not $serverProcess.HasExited
  if (-not $running) {
    $desktopSessionId = $null
    $sessionStatusLabel.Text = 'Session: none'
    $sessionIdLabel.Text = 'Session ID: -'
    $sessionExpiryLabel.Text = 'Expires: -'
    $eventBox.Text = ''
    return
  }

  try {
    $payload = Invoke-DesktopApi -Method 'GET' -Path '/api/desktop/session'
    if ($payload.ok -and $payload.data.session) {
      $session = $payload.data.session
      $desktopSessionId = $session.id
      $sessionStatusLabel.Text = ('Session: active ({0})' -f $session.clientName)
      $sessionIdLabel.Text = ('Session ID: {0}' -f $session.id)
      $sessionExpiryLabel.Text = ('Expires: {0}' -f $session.expiresAt)
    } else {
      $desktopSessionId = $null
      $sessionStatusLabel.Text = 'Session: none'
      $sessionIdLabel.Text = 'Session ID: -'
      $sessionExpiryLabel.Text = 'Expires: -'
    }
  } catch {
    $sessionStatusLabel.Text = ('Session load failed: {0}' -f $_.Exception.Message)
  }

  $heartbeatButton.Enabled = $null -ne $desktopSessionId
  $closeSessionButton.Enabled = $null -ne $desktopSessionId
  Refresh-Events
}

function Get-BaseUrl {
  $host = $hostInput.Text.Trim()
  $port = $portInput.Text.Trim()
  if (-not $host) { $host = '127.0.0.1' }
  if (-not $port) { $port = '3210' }
  return ('http://{0}:{1}' -f $host, $port)
}

function Update-UiState {
  $running = $null -ne $serverProcess -and -not $serverProcess.HasExited
  $startButton.Enabled = -not $running
  $stopButton.Enabled = $running
  $healthButton.Enabled = $running
  $copyButton.Enabled = $running
  $openSessionButton.Enabled = $running
  $refreshButton.Enabled = $running
  $testHealthButton.Enabled = $running
  $testInfoButton.Enabled = $running
  $testWindowsButton.Enabled = $running
  $testClipboardButton.Enabled = $running
  $testLaunchButton.Enabled = $running
  $testEventButton.Enabled = $running
  $moveMouseButton.Enabled = $running
  $clickMouseButton.Enabled = $running
  $sendTextButton.Enabled = $running
  $sendKeyButton.Enabled = $running
  $refreshScreenshotButton.Enabled = $running

  if ($running) {
    $statusLabel.Text = 'Status: running'
    $endpointLabel.Text = "Endpoint: $(Get-BaseUrl)"
  } else {
    $statusLabel.Text = 'Status: stopped'
    $endpointLabel.Text = 'Endpoint: -'
  }

  if (-not $running) {
    $heartbeatButton.Enabled = $false
    $closeSessionButton.Enabled = $false
    Set-PreviewImage -Base64 '' -Width 0 -Height 0
  }
}

function Stop-ServerProcess {
  if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
    try {
      $serverProcess.Kill()
      $serverProcess.WaitForExit(2000) | Out-Null
    } catch {
      Append-Log -TextBox $logBox -Message "Stop failed: $($_.Exception.Message)"
    }
  }
  $serverProcess = $null
  Update-UiState
}

$startButton.Add_Click({
  try {
    if (-not (Test-Path $desktopServerPath)) {
      Append-Log -TextBox $logBox -Message 'dist is missing, running npm run build first'
      $buildProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'build' -WorkingDirectory $projectRoot -PassThru -Wait -NoNewWindow
      if ($buildProcess.ExitCode -ne 0) {
        throw "npm run build failed with exit code $($buildProcess.ExitCode)"
      }
      Append-Log -TextBox $logBox -Message 'Build completed'
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'node'
    $psi.Arguments = 'dist/desktop-server.js'
    $psi.WorkingDirectory = $projectRoot
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.Environment['DESKTOP_REMOTE_API_HOST'] = $hostInput.Text.Trim()
    $psi.Environment['DESKTOP_REMOTE_API_PORT'] = $portInput.Text.Trim()
    $psi.Environment['DESKTOP_REMOTE_API_TOKEN'] = $tokenInput.Text

    $serverProcess = New-Object System.Diagnostics.Process
    $serverProcess.StartInfo = $psi
    $serverProcess.EnableRaisingEvents = $true

    $serverProcess.add_OutputDataReceived({
      param($sender, $args)
      if ($args.Data) {
        $form.BeginInvoke([Action]{
          Append-Log -TextBox $logBox -Message $args.Data
        }) | Out-Null
      }
    })
    $serverProcess.add_ErrorDataReceived({
      param($sender, $args)
      if ($args.Data) {
        $form.BeginInvoke([Action]{
          Append-Log -TextBox $logBox -Message "ERR $($args.Data)"
        }) | Out-Null
      }
    })
    $serverProcess.add_Exited({
      $form.BeginInvoke([Action]{
        Append-Log -TextBox $logBox -Message 'Desktop service exited'
        $script:serverProcess = $null
        Update-UiState
      }) | Out-Null
    })

    if (-not $serverProcess.Start()) {
      throw 'Failed to start node process'
    }
    $serverProcess.BeginOutputReadLine()
    $serverProcess.BeginErrorReadLine()
    Append-Log -TextBox $logBox -Message "Desktop service started PID=$($serverProcess.Id)"
    Update-UiState
    Start-Sleep -Milliseconds 600
    Refresh-DesktopState
  } catch {
    Append-Log -TextBox $logBox -Message "Start failed: $($_.Exception.Message)"
    [System.Windows.Forms.MessageBox]::Show("Start failed: $($_.Exception.Message)", 'MetaAgent-PC', 'OK', 'Error') | Out-Null
    $serverProcess = $null
    Update-UiState
  }
})

$stopButton.Add_Click({
  Stop-ServerProcess
  Append-Log -TextBox $logBox -Message 'Desktop service stopped'
})

$healthButton.Add_Click({
  try {
    $payload = Invoke-DesktopApi -Method 'GET' -Path '/api/desktop/health'
    Append-Log -TextBox $logBox -Message "Health check OK"
    Set-Summary -Text ($payload | ConvertTo-Json -Compress -Depth 6)
    Refresh-DesktopState
  } catch {
    Append-Log -TextBox $logBox -Message "Health check failed: $($_.Exception.Message)"
  }
})

$copyButton.Add_Click({
  [System.Windows.Forms.Clipboard]::SetText((Get-BaseUrl))
  Append-Log -TextBox $logBox -Message 'Endpoint copied to clipboard'
})

$openSessionButton.Add_Click({
  try {
    $payload = Invoke-DesktopApi -Method 'POST' -Path '/api/desktop/session/open' -Body @{ clientName = 'metaagent-pc-gui' }
    Append-Log -TextBox $logBox -Message 'Desktop session opened'
    Set-Summary -Text ($payload.data.session.id)
    Refresh-DesktopState
  } catch {
    Append-Log -TextBox $logBox -Message "Open session failed: $($_.Exception.Message)"
  }
})

$refreshButton.Add_Click({
  Refresh-DesktopState
  Set-Summary -Text 'State refreshed'
})

$heartbeatButton.Add_Click({
  try {
    if ($null -eq $desktopSessionId) {
      throw 'No active session'
    }
    $payload = Invoke-DesktopApi -Method 'POST' -Path '/api/desktop/session/heartbeat' -Body @{ sessionId = $desktopSessionId }
    Append-Log -TextBox $logBox -Message 'Heartbeat sent'
    Set-Summary -Text ($payload.data.session.expiresAt)
    Refresh-DesktopState
  } catch {
    Append-Log -TextBox $logBox -Message "Heartbeat failed: $($_.Exception.Message)"
  }
})

$closeSessionButton.Add_Click({
  try {
    if ($null -eq $desktopSessionId) {
      throw 'No active session'
    }
    Invoke-DesktopApi -Method 'POST' -Path '/api/desktop/session/close' -Body @{ sessionId = $desktopSessionId } | Out-Null
    Append-Log -TextBox $logBox -Message 'Desktop session closed'
    Set-Summary -Text 'Session closed'
    Refresh-DesktopState
  } catch {
    Append-Log -TextBox $logBox -Message "Close session failed: $($_.Exception.Message)"
  }
})

$testHealthButton.Add_Click({
  try {
    $payload = Invoke-DesktopApi -Method 'GET' -Path '/api/desktop/health'
    Set-Summary -Text ($payload | ConvertTo-Json -Compress -Depth 5)
    Append-Log -TextBox $logBox -Message 'Fetched health payload'
  } catch {
    Append-Log -TextBox $logBox -Message "Fetch health failed: $($_.Exception.Message)"
  }
})

$testInfoButton.Add_Click({
  try {
    $payload = Invoke-DesktopApi -Method 'GET' -Path '/api/desktop/system/info'
    Set-Summary -Text ('Host {0}, displays {1}' -f $payload.data.hostname, $payload.data.displayCount)
    Append-Log -TextBox $logBox -Message 'Fetched system info'
  } catch {
    Append-Log -TextBox $logBox -Message "System info failed: $($_.Exception.Message)"
  }
})

$testWindowsButton.Add_Click({
  try {
    $payload = Invoke-DesktopApi -Method 'GET' -Path '/api/desktop/windows'
    $count = @($payload.data.windows).Count
    Set-Summary -Text ('Windows listed: {0}' -f $count)
    Append-Log -TextBox $logBox -Message 'Fetched windows list'
  } catch {
    Append-Log -TextBox $logBox -Message "List windows failed: $($_.Exception.Message)"
  }
})

$testClipboardButton.Add_Click({
  try {
    $payload = Invoke-DesktopApi -Method 'GET' -Path '/api/desktop/clipboard'
    Set-Summary -Text ('Clipboard: {0}' -f $payload.data.text)
    Append-Log -TextBox $logBox -Message 'Fetched clipboard text'
  } catch {
    Append-Log -TextBox $logBox -Message "Clipboard fetch failed: $($_.Exception.Message)"
  }
})

$testLaunchButton.Add_Click({
  try {
    Invoke-DesktopApi -Method 'POST' -Path '/api/desktop/app/launch' -Body @{ command = 'notepad.exe'; args = @() } | Out-Null
    Set-Summary -Text 'Launched notepad.exe'
    Append-Log -TextBox $logBox -Message 'Launch request sent'
    Refresh-DesktopState
  } catch {
    Append-Log -TextBox $logBox -Message "Launch test failed: $($_.Exception.Message)"
  }
})

$testEventButton.Add_Click({
  Refresh-Events
  Set-Summary -Text 'Events refreshed'
})

$moveMouseButton.Add_Click({
  try {
    $x = [int]$mouseXInput.Text
    $y = [int]$mouseYInput.Text
    Invoke-DesktopApi -Method 'POST' -Path '/api/desktop/input/move' -Body @{ x = $x; y = $y } | Out-Null
    Set-Summary -Text ('Moved mouse to {0},{1}' -f $x, $y)
    Append-Log -TextBox $logBox -Message 'Move request sent'
    Refresh-DesktopState
  } catch {
    Append-Log -TextBox $logBox -Message "Move failed: $($_.Exception.Message)"
  }
})

$clickMouseButton.Add_Click({
  try {
    $x = [int]$mouseXInput.Text
    $y = [int]$mouseYInput.Text
    Invoke-DesktopApi -Method 'POST' -Path '/api/desktop/input/click' -Body @{ x = $x; y = $y; button = 'left' } | Out-Null
    Set-Summary -Text ('Clicked at {0},{1}' -f $x, $y)
    Append-Log -TextBox $logBox -Message 'Click request sent'
    Refresh-DesktopState
  } catch {
    Append-Log -TextBox $logBox -Message "Click failed: $($_.Exception.Message)"
  }
})

$sendTextButton.Add_Click({
  try {
    $text = $textInputBox.Text
    Invoke-DesktopApi -Method 'POST' -Path '/api/desktop/input/type' -Body @{ text = $text } | Out-Null
    Set-Summary -Text ('Typed {0} chars' -f $text.Length)
    Append-Log -TextBox $logBox -Message 'Type request sent'
    Refresh-DesktopState
  } catch {
    Append-Log -TextBox $logBox -Message "Type failed: $($_.Exception.Message)"
  }
})

$sendKeyButton.Add_Click({
  try {
    $key = $keyInputBox.Text
    Invoke-DesktopApi -Method 'POST' -Path '/api/desktop/input/key' -Body @{ key = $key } | Out-Null
    Set-Summary -Text ('Sent key {0}' -f $key)
    Append-Log -TextBox $logBox -Message 'Key request sent'
    Refresh-DesktopState
  } catch {
    Append-Log -TextBox $logBox -Message "Key failed: $($_.Exception.Message)"
  }
})

$refreshScreenshotButton.Add_Click({
  try {
    $payload = Invoke-DesktopApi -Method 'GET' -Path '/api/desktop/screenshot'
    Set-PreviewImage -Base64 $payload.data.base64 -Width $payload.data.width -Height $payload.data.height
    Set-Summary -Text ('Screenshot {0}x{1}' -f $payload.data.width, $payload.data.height)
    Append-Log -TextBox $logBox -Message 'Screenshot fetched'
    Refresh-DesktopState
  } catch {
    Append-Log -TextBox $logBox -Message "Screenshot failed: $($_.Exception.Message)"
  }
})

$openFolderButton.Add_Click({
  Start-Process explorer.exe $projectRoot | Out-Null
})

$form.Add_FormClosing({
  Stop-ServerProcess
})

Update-UiState
Refresh-DesktopState
[void]$form.ShowDialog()
