import { spawn } from 'child_process';

export interface DesktopCapabilities {
  platform: NodeJS.Platform;
  supported: boolean;
  supportsScreenshot: boolean;
  supportsMouse: boolean;
  supportsKeyboard: boolean;
  supportsAppLaunch: boolean;
  supportsClipboard: boolean;
  supportsWindowListing: boolean;
  supportsSystemInfo: boolean;
  reason?: string;
}

export interface DesktopScreenshot {
  mimeType: string;
  base64: string;
  width: number;
  height: number;
}

export interface DesktopOperationResult {
  ok: boolean;
  message: string;
}

export interface DesktopDisplayInfo {
  left: number;
  top: number;
  width: number;
  height: number;
  primary: boolean;
  deviceName?: string;
}

export interface DesktopSystemInfo {
  hostname: string;
  username: string;
  platform: NodeJS.Platform;
  release: string;
  arch: string;
  cpuModel: string;
  displayCount: number;
  displays: DesktopDisplayInfo[];
}

export interface DesktopWindowInfo {
  processName: string;
  title: string;
  pid: number;
}

type MouseButton = 'left' | 'right' | 'middle';

const WINDOWS_MOUSE_FLAGS: Record<MouseButton, { down: string; up: string }> = {
  left: { down: '0x0002', up: '0x0004' },
  right: { down: '0x0008', up: '0x0010' },
  middle: { down: '0x0020', up: '0x0040' },
};

function unsupportedCapabilities(reason: string): DesktopCapabilities {
  return {
    platform: process.platform,
    supported: false,
    supportsScreenshot: false,
    supportsMouse: false,
    supportsKeyboard: false,
    supportsAppLaunch: false,
    supportsClipboard: false,
    supportsWindowListing: false,
    supportsSystemInfo: false,
    reason,
  };
}

export function getDesktopCapabilities(): DesktopCapabilities {
  if (process.platform !== 'win32') {
    return unsupportedCapabilities(
      'Desktop control currently supports Windows only',
    );
  }
  return {
    platform: process.platform,
    supported: true,
    supportsScreenshot: true,
    supportsMouse: true,
    supportsKeyboard: true,
    supportsAppLaunch: true,
    supportsClipboard: true,
    supportsWindowListing: true,
    supportsSystemInfo: true,
  };
}

async function runPowerShell(script: string): Promise<string> {
  if (process.platform !== 'win32') {
    throw new Error('Desktop control currently supports Windows only');
  }
  const wrappedScript = `
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
${script}
`.trim();

  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', wrappedScript],
      { windowsHide: true },
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(
        new Error(
          stderr.trim() || `PowerShell exited with code ${code ?? 'unknown'}`,
        ),
      );
    });
  });
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function textToBase64(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64');
}

export async function captureDesktopScreenshot(): Promise<DesktopScreenshot> {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bitmap.Size)
$stream = New-Object System.IO.MemoryStream
$bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
$payload = @{
  width = $bounds.Width
  height = $bounds.Height
  base64 = [Convert]::ToBase64String($stream.ToArray())
} | ConvertTo-Json -Compress
$graphics.Dispose()
$bitmap.Dispose()
$stream.Dispose()
Write-Output $payload
`.trim();

  const output = await runPowerShell(script);
  const parsed = JSON.parse(output) as {
    width: number;
    height: number;
    base64: string;
  };

  return {
    mimeType: 'image/png',
    base64: parsed.base64,
    width: parsed.width,
    height: parsed.height,
  };
}

export async function moveMouse(
  x: number,
  y: number,
): Promise<DesktopOperationResult> {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DesktopMouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
}
"@
[DesktopMouse]::SetCursorPos(${Math.round(x)}, ${Math.round(y)}) | Out-Null
Write-Output '{"ok":true,"message":"Mouse moved"}'
`.trim();
  await runPowerShell(script);
  return { ok: true, message: 'Mouse moved' };
}

export async function moveMouseRelative(
  deltaX: number,
  deltaY: number,
): Promise<DesktopOperationResult> {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DesktopMouse {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT point);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
}
"@
$point = New-Object DesktopMouse+POINT
[DesktopMouse]::GetCursorPos([ref]$point) | Out-Null
$targetX = $point.X + ${Math.round(deltaX)}
$targetY = $point.Y + ${Math.round(deltaY)}
[DesktopMouse]::SetCursorPos($targetX, $targetY) | Out-Null
Write-Output '{"ok":true,"message":"Mouse moved relatively"}'
`.trim();
  await runPowerShell(script);
  return {
    ok: true,
    message: `Mouse moved relatively (${Math.round(deltaX)}, ${Math.round(deltaY)})`,
  };
}

export async function clickMouse(
  x: number,
  y: number,
  button: MouseButton = 'left',
): Promise<DesktopOperationResult> {
  const flags = WINDOWS_MOUSE_FLAGS[button];
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DesktopMouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
}
"@
[DesktopMouse]::SetCursorPos(${Math.round(x)}, ${Math.round(y)}) | Out-Null
[DesktopMouse]::mouse_event(${flags.down}, 0, 0, 0, [UIntPtr]::Zero)
[DesktopMouse]::mouse_event(${flags.up}, 0, 0, 0, [UIntPtr]::Zero)
Write-Output '{"ok":true,"message":"Mouse clicked"}'
`.trim();
  await runPowerShell(script);
  return { ok: true, message: `Mouse ${button} clicked` };
}

export async function clickMouseCurrent(
  button: MouseButton = 'left',
): Promise<DesktopOperationResult> {
  const flags = WINDOWS_MOUSE_FLAGS[button];
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DesktopMouse {
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
}
"@
[DesktopMouse]::mouse_event(${flags.down}, 0, 0, 0, [UIntPtr]::Zero)
[DesktopMouse]::mouse_event(${flags.up}, 0, 0, 0, [UIntPtr]::Zero)
Write-Output '{"ok":true,"message":"Mouse clicked at current position"}'
`.trim();
  await runPowerShell(script);
  return { ok: true, message: `Mouse ${button} clicked at current position` };
}

export async function dragMouse(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  button: MouseButton = 'left',
  steps = 12,
): Promise<DesktopOperationResult> {
  const flags = WINDOWS_MOUSE_FLAGS[button];
  const totalSteps = Math.max(2, Math.min(60, Math.round(steps)));
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DesktopMouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
}
"@
$fromX = ${Math.round(fromX)}
$fromY = ${Math.round(fromY)}
$toX = ${Math.round(toX)}
$toY = ${Math.round(toY)}
$steps = ${totalSteps}
[DesktopMouse]::SetCursorPos($fromX, $fromY) | Out-Null
[DesktopMouse]::mouse_event(${flags.down}, 0, 0, 0, [UIntPtr]::Zero)
for ($i = 1; $i -le $steps; $i++) {
  $x = [int]($fromX + (($toX - $fromX) * $i / $steps))
  $y = [int]($fromY + (($toY - $fromY) * $i / $steps))
  [DesktopMouse]::SetCursorPos($x, $y) | Out-Null
  Start-Sleep -Milliseconds 12
}
[DesktopMouse]::mouse_event(${flags.up}, 0, 0, 0, [UIntPtr]::Zero)
Write-Output '{"ok":true,"message":"Mouse dragged"}'
`.trim();
  await runPowerShell(script);
  return { ok: true, message: `Mouse ${button} dragged` };
}

export async function scrollMouse(
  delta: number,
): Promise<DesktopOperationResult> {
  const amount = Math.round(delta);
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DesktopMouse {
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, int data, UIntPtr extraInfo);
}
"@
[DesktopMouse]::mouse_event(0x0800, 0, 0, ${amount}, [UIntPtr]::Zero)
Write-Output '{"ok":true,"message":"Mouse scrolled"}'
`.trim();
  await runPowerShell(script);
  return { ok: true, message: `Mouse scrolled: ${amount}` };
}

export async function sendText(text: string): Promise<DesktopOperationResult> {
  const encoded = textToBase64(text);
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$raw = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))
$escaped = $raw.Replace('{','{{}').Replace('}','{}}').Replace('+','{+}').Replace('^','{^}').Replace('%','{%}').Replace('~','{~}').Replace('(','{(}').Replace(')','{)}')
[System.Windows.Forms.SendKeys]::SendWait($escaped)
Write-Output '{"ok":true,"message":"Text sent"}'
`.trim();
  await runPowerShell(script);
  return { ok: true, message: 'Text sent' };
}

export async function pressKey(key: string): Promise<DesktopOperationResult> {
  const normalized = key.trim().toUpperCase();
  const sendKeysMap: Record<string, string> = {
    ENTER: '{ENTER}',
    TAB: '{TAB}',
    ESC: '{ESC}',
    ESCAPE: '{ESC}',
    BACKSPACE: '{BACKSPACE}',
    DELETE: '{DELETE}',
    UP: '{UP}',
    DOWN: '{DOWN}',
    LEFT: '{LEFT}',
    RIGHT: '{RIGHT}',
    HOME: '{HOME}',
    END: '{END}',
    PGUP: '{PGUP}',
    PGDN: '{PGDN}',
    SPACE: ' ',
  };
  const mapped = sendKeysMap[normalized] || key;
  const encoded = textToBase64(mapped);
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$sequence = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))
[System.Windows.Forms.SendKeys]::SendWait($sequence)
Write-Output '{"ok":true,"message":"Key pressed"}'
`.trim();
  await runPowerShell(script);
  return { ok: true, message: `Key pressed: ${key}` };
}

export async function pressHotkey(
  keys: string[],
): Promise<DesktopOperationResult> {
  const normalized = keys
    .map((key) => key.trim().toUpperCase())
    .filter((key) => key.length > 0);
  if (normalized.length === 0) {
    return { ok: false, message: 'No keys provided' };
  }

  const modifierMap: Record<string, string> = {
    CTRL: '^',
    CONTROL: '^',
    SHIFT: '+',
    ALT: '%',
  };
  const keyMap: Record<string, string> = {
    ENTER: '{ENTER}',
    TAB: '{TAB}',
    ESC: '{ESC}',
    ESCAPE: '{ESC}',
    DELETE: '{DELETE}',
    BACKSPACE: '{BACKSPACE}',
    UP: '{UP}',
    DOWN: '{DOWN}',
    LEFT: '{LEFT}',
    RIGHT: '{RIGHT}',
    HOME: '{HOME}',
    END: '{END}',
    SPACE: ' ',
  };

  const modifiers = normalized
    .slice(0, -1)
    .map((key) => modifierMap[key] || '')
    .join('');
  const lastKey = normalized[normalized.length - 1];
  const sendKeysSequence = `${modifiers}${keyMap[lastKey] || lastKey}`;
  const encoded = textToBase64(sendKeysSequence);
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$sequence = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))
[System.Windows.Forms.SendKeys]::SendWait($sequence)
Write-Output '{"ok":true,"message":"Hotkey pressed"}'
`.trim();
  await runPowerShell(script);
  return { ok: true, message: `Hotkey pressed: ${normalized.join('+')}` };
}

export async function launchApp(
  command: string,
  args: string[] = [],
): Promise<DesktopOperationResult> {
  const escapedCommand = escapePowerShellSingleQuoted(command);
  const escapedArgs = args.map(
    (arg) => `'${escapePowerShellSingleQuoted(arg)}'`,
  );
  const argList =
    escapedArgs.length > 0 ? `-ArgumentList @(${escapedArgs.join(', ')})` : '';
  const script = `
Start-Process -FilePath '${escapedCommand}' ${argList}
Write-Output '{"ok":true,"message":"App launched"}'
`.trim();
  await runPowerShell(script);
  return { ok: true, message: `App launched: ${command}` };
}

export async function getClipboardText(): Promise<{ text: string }> {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$text = [System.Windows.Forms.Clipboard]::GetText()
$payload = @{ text = $text } | ConvertTo-Json -Compress
Write-Output $payload
`.trim();
  const output = await runPowerShell(script);
  return JSON.parse(output) as { text: string };
}

export async function setClipboardText(
  text: string,
): Promise<DesktopOperationResult> {
  const encoded = textToBase64(text);
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$value = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))
[System.Windows.Forms.Clipboard]::SetText($value)
Write-Output '{"ok":true,"message":"Clipboard updated"}'
`.trim();
  await runPowerShell(script);
  return { ok: true, message: 'Clipboard updated' };
}

export async function getDesktopSystemInfo(): Promise<DesktopSystemInfo> {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$screens = @([System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
  @{
    left = $_.Bounds.Left
    top = $_.Bounds.Top
    width = $_.Bounds.Width
    height = $_.Bounds.Height
    primary = $_.Primary
    deviceName = $_.DeviceName
  }
})
$cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name)
$payload = @{
  hostname = $env:COMPUTERNAME
  username = $env:USERNAME
  release = [System.Environment]::OSVersion.Version.ToString()
  arch = $env:PROCESSOR_ARCHITECTURE
  cpuModel = $cpu
  displayCount = $screens.Count
  displays = $screens
} | ConvertTo-Json -Compress -Depth 4
Write-Output $payload
`.trim();
  const output = await runPowerShell(script);
  const parsed = JSON.parse(output) as Omit<DesktopSystemInfo, 'platform'> & {
    displays: DesktopDisplayInfo | DesktopDisplayInfo[];
  };
  return {
    ...parsed,
    platform: process.platform,
    displays: Array.isArray(parsed.displays)
      ? parsed.displays
      : [parsed.displays],
  };
}

export async function listDesktopWindows(): Promise<DesktopWindowInfo[]> {
  const script = `
$windows = Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Trim().Length -gt 0 } | Select-Object ProcessName, MainWindowTitle, Id
$payload = $windows | ForEach-Object {
  @{
    processName = $_.ProcessName
    title = $_.MainWindowTitle
    pid = $_.Id
  }
} | ConvertTo-Json -Compress
Write-Output $payload
`.trim();
  const output = await runPowerShell(script);
  if (!output) {
    return [];
  }
  const parsed = JSON.parse(output) as DesktopWindowInfo | DesktopWindowInfo[];
  return Array.isArray(parsed) ? parsed : [parsed];
}
