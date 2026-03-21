import { spawn } from 'child_process';

export interface DesktopCapabilities {
  platform: NodeJS.Platform;
  supported: boolean;
  supportsScreenshot: boolean;
  supportsMouse: boolean;
  supportsKeyboard: boolean;
  supportsAppLaunch: boolean;
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

type MouseButton = 'left' | 'right' | 'middle';

const WINDOWS_MOUSE_FLAGS: Record<
  MouseButton,
  { down: string; up: string }
> = {
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
    reason,
  };
}

export function getDesktopCapabilities(): DesktopCapabilities {
  if (process.platform !== 'win32') {
    return unsupportedCapabilities('Desktop control currently supports Windows only');
  }
  return {
    platform: process.platform,
    supported: true,
    supportsScreenshot: true,
    supportsMouse: true,
    supportsKeyboard: true,
    supportsAppLaunch: true,
  };
}

async function runPowerShell(script: string): Promise<string> {
  if (process.platform !== 'win32') {
    throw new Error('Desktop control currently supports Windows only');
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
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

export async function moveMouse(x: number, y: number): Promise<DesktopOperationResult> {
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

export async function launchApp(
  command: string,
  args: string[] = [],
): Promise<DesktopOperationResult> {
  const escapedCommand = escapePowerShellSingleQuoted(command);
  const escapedArgs = args.map((arg) => `'${escapePowerShellSingleQuoted(arg)}'`);
  const argList =
    escapedArgs.length > 0 ? `-ArgumentList @(${escapedArgs.join(', ')})` : '';
  const script = `
Start-Process -FilePath '${escapedCommand}' ${argList}
Write-Output '{"ok":true,"message":"App launched"}'
`.trim();
  await runPowerShell(script);
  return { ok: true, message: `App launched: ${command}` };
}
