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
$form.Size = New-Object System.Drawing.Size(760, 620)
$form.StartPosition = 'CenterScreen'
$form.MinimumSize = New-Object System.Drawing.Size(760, 620)

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

$openFolderButton = New-Object System.Windows.Forms.Button
$openFolderButton.Text = 'Open Folder'
$openFolderButton.Location = New-Object System.Drawing.Point(502, 220)
$openFolderButton.Size = New-Object System.Drawing.Size(120, 34)
$form.Controls.Add($openFolderButton)

$infoBox = New-Object System.Windows.Forms.TextBox
$infoBox.Location = New-Object System.Drawing.Point(22, 274)
$infoBox.Size = New-Object System.Drawing.Size(700, 80)
$infoBox.Multiline = $true
$infoBox.ReadOnly = $true
$infoBox.ScrollBars = 'Vertical'
$infoBox.Text = "Click Start to launch the desktop service, then connect from your phone using the endpoint shown here.`r`nIf dist is missing, the GUI will run npm run build automatically."
$form.Controls.Add($infoBox)

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Location = New-Object System.Drawing.Point(22, 372)
$logBox.Size = New-Object System.Drawing.Size(700, 190)
$logBox.Multiline = $true
$logBox.ReadOnly = $true
$logBox.ScrollBars = 'Vertical'
$logBox.Font = New-Object -TypeName System.Drawing.Font -ArgumentList 'Consolas', 9
$form.Controls.Add($logBox)

$serverProcess = $null

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

  if ($running) {
    $statusLabel.Text = 'Status: running'
    $endpointLabel.Text = "Endpoint: $(Get-BaseUrl)"
  } else {
    $statusLabel.Text = 'Status: stopped'
    $endpointLabel.Text = 'Endpoint: -'
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
    $baseUrl = Get-BaseUrl
    $headers = @{}
    if ($tokenInput.Text) {
      $headers['Authorization'] = "Bearer $($tokenInput.Text)"
    }
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/desktop/health" -Headers $headers -TimeoutSec 5
    Append-Log -TextBox $logBox -Message "Health check OK: $($response.Content)"
  } catch {
    Append-Log -TextBox $logBox -Message "Health check failed: $($_.Exception.Message)"
  }
})

$copyButton.Add_Click({
  [System.Windows.Forms.Clipboard]::SetText((Get-BaseUrl))
  Append-Log -TextBox $logBox -Message 'Endpoint copied to clipboard'
})

$openFolderButton.Add_Click({
  Start-Process explorer.exe $projectRoot | Out-Null
})

$form.Add_FormClosing({
  Stop-ServerProcess
})

Update-UiState
[void]$form.ShowDialog()
