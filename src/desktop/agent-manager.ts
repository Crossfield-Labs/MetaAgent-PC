import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

import {
  DESKTOP_AGENT_ARGS,
  DESKTOP_AGENT_CWD,
  DESKTOP_AGENT_EXECUTABLE,
  DESKTOP_AGENT_PROVIDER,
} from '../config.js';
import { logger } from '../logger.js';

export type DesktopAgentProvider = 'codex' | 'claude';
export type DesktopAgentStatus = 'idle' | 'running' | 'success' | 'error';
export type DesktopAgentMessageRole = 'user' | 'assistant' | 'system';

export interface DesktopAgentSettings {
  provider: DesktopAgentProvider;
  executable: string;
  args: string;
  cwd: string;
}

export interface DesktopAgentRunRequest {
  prompt: string;
  provider?: DesktopAgentProvider;
  cwd?: string;
}

export interface DesktopAgentMessageRequest {
  message: string;
  provider?: DesktopAgentProvider;
  cwd?: string;
}

export interface DesktopAgentLogEntry {
  at: string;
  stream: 'stdout' | 'stderr' | 'system';
  line: string;
}

export interface DesktopAgentMessage {
  id: string;
  role: DesktopAgentMessageRole;
  text: string;
  at: string;
  turn: number;
  state: 'queued' | 'processing' | 'completed' | 'error';
}

interface ParsedCodexEvent {
  threadId?: string;
  agentMessage?: string;
  commandStarted?: string;
  commandCompleted?: string;
}

export interface DesktopAgentSession {
  id: string;
  provider: DesktopAgentProvider;
  nativeThreadId: string | null;
  cwd: string;
  executable: string;
  args: string;
  startedAt: string;
  updatedAt: string;
  lastTurnAt: string | null;
  pendingMessageCount: number;
  messageCount: number;
}

export interface DesktopAgentState {
  status: DesktopAgentStatus;
  provider: DesktopAgentProvider;
  prompt: string | null;
  pid: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  cwd: string;
  executable: string;
  args: string;
  lastError: string | null;
  lastOutput: string | null;
  sessionId: string | null;
  pendingMessageCount: number;
  messageCount: number;
}

export interface DesktopAgentSnapshot {
  settings: DesktopAgentSettings;
  state: DesktopAgentState;
  session: DesktopAgentSession | null;
  messages: DesktopAgentMessage[];
  logs: DesktopAgentLogEntry[];
}

const MAX_LOG_ENTRIES = 300;
const MAX_MESSAGE_ENTRIES = 120;
const MAX_TRANSCRIPT_CHARS = 20000;
const defaultExecutables: Record<DesktopAgentProvider, string> = {
  codex: process.platform === 'win32' ? 'codex.cmd' : 'codex',
  claude: process.platform === 'win32' ? 'claude.cmd' : 'claude',
};

let settings: DesktopAgentSettings = normalizeSettings({
  provider: normalizeProvider(DESKTOP_AGENT_PROVIDER),
  executable: DESKTOP_AGENT_EXECUTABLE,
  args: DESKTOP_AGENT_ARGS,
  cwd: DESKTOP_AGENT_CWD,
});

let state: DesktopAgentState = {
  status: 'idle',
  provider: settings.provider,
  prompt: null,
  pid: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  cwd: settings.cwd,
  executable: settings.executable,
  args: settings.args,
  lastError: null,
  lastOutput: null,
  sessionId: null,
  pendingMessageCount: 0,
  messageCount: 0,
};

let activeProcess: ReturnType<typeof spawn> | null = null;
let session: DesktopAgentSession | null = null;
const logs: DesktopAgentLogEntry[] = [];
const messages: DesktopAgentMessage[] = [];
const queuedMessageIds: string[] = [];
let turnCounter = 0;
const agentEvents = new EventEmitter();

function emitAgentSnapshot(): void {
  agentEvents.emit('snapshot', getDesktopAgentSnapshot());
}

function normalizeProvider(value?: string): DesktopAgentProvider {
  return value?.toLowerCase() === 'claude' ? 'claude' : 'codex';
}

function normalizeSettings(
  input: Partial<DesktopAgentSettings>,
): DesktopAgentSettings {
  const provider = normalizeProvider(input.provider);
  const executable =
    (input.executable || '').trim() || defaultExecutables[provider];
  const requestedCwd = path.resolve(input.cwd || process.cwd());
  const cwd = fs.existsSync(requestedCwd) ? requestedCwd : process.cwd();

  return {
    provider,
    executable,
    args: (input.args || '').trim(),
    cwd,
  };
}

function appendLog(stream: DesktopAgentLogEntry['stream'], line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;
  logs.push({ at: new Date().toISOString(), stream, line: trimmed });
  while (logs.length > MAX_LOG_ENTRIES) {
    logs.shift();
  }
  state.lastOutput = trimmed;
  emitAgentSnapshot();
}

function splitArgs(value: string): string[] {
  const matches = value.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map((part) =>
    part.startsWith('"') || part.startsWith("'") ? part.slice(1, -1) : part,
  );
}

function resolveExecutableForWindows(executable: string): string {
  if (
    path.isAbsolute(executable) ||
    executable.includes('\\') ||
    executable.includes('/')
  ) {
    return executable;
  }

  const lookup = spawnSync('where.exe', [executable], {
    windowsHide: true,
    encoding: 'utf8',
  });
  if (lookup.status === 0) {
    const first = lookup.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (first) {
      return first;
    }
  }

  return executable;
}

function resolveNodeBackedCodexCommand(command: {
  executable: string;
  args: string[];
}): { executable: string; args: string[] } {
  if (process.platform !== 'win32') {
    return command;
  }

  const resolvedExecutable = resolveExecutableForWindows(command.executable);
  const executableName = path.basename(resolvedExecutable).toLowerCase();
  if (!['codex', 'codex.cmd', 'codex.ps1'].includes(executableName)) {
    return command;
  }

  const basedir = path.dirname(resolvedExecutable);
  const codexJsPath = path.join(
    basedir,
    'node_modules',
    '@openai',
    'codex',
    'bin',
    'codex.js',
  );
  if (!fs.existsSync(codexJsPath)) {
    return command;
  }

  return {
    executable: process.execPath,
    args: [codexJsPath, ...command.args],
  };
}

function ensureSession(provider: DesktopAgentProvider): DesktopAgentSession {
  const now = new Date().toISOString();
  if (!session) {
    session = {
      id: randomUUID(),
      provider,
      nativeThreadId: null,
      cwd: settings.cwd,
      executable: settings.executable,
      args: settings.args,
      startedAt: now,
      updatedAt: now,
      lastTurnAt: null,
      pendingMessageCount: 0,
      messageCount: 0,
    };
  } else {
    session = {
      ...session,
      provider,
      cwd: settings.cwd,
      executable: settings.executable,
      args: settings.args,
      updatedAt: now,
    };
  }
  syncDerivedState();
  return session;
}

function syncDerivedState(): void {
  state = {
    ...state,
    provider: settings.provider,
    cwd: settings.cwd,
    executable: settings.executable,
    args: settings.args,
    sessionId: session?.id ?? null,
    pendingMessageCount: queuedMessageIds.length,
    messageCount: messages.length,
  };
  if (session) {
    session.pendingMessageCount = queuedMessageIds.length;
    session.messageCount = messages.length;
    session.updatedAt = new Date().toISOString();
  }
}

function pushMessage(
  role: DesktopAgentMessageRole,
  text: string,
  stateValue: DesktopAgentMessage['state'],
): DesktopAgentMessage {
  const message: DesktopAgentMessage = {
    id: randomUUID(),
    role,
    text: text.trim(),
    at: new Date().toISOString(),
    turn: ++turnCounter,
    state: stateValue,
  };
  messages.push(message);
  while (messages.length > MAX_MESSAGE_ENTRIES) {
    messages.shift();
  }
  syncDerivedState();
  emitAgentSnapshot();
  return message;
}

function updateMessage(
  id: string,
  nextState: DesktopAgentMessage['state'],
): void {
  const target = messages.find((message) => message.id === id);
  if (!target) return;
  target.state = nextState;
  syncDerivedState();
  emitAgentSnapshot();
}

function findLastMessage(
  role: DesktopAgentMessageRole,
): DesktopAgentMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === role) {
      return messages[index];
    }
  }
  return undefined;
}

function buildPromptFromMessages(triggerMessage: DesktopAgentMessage): string {
  const transcript = messages
    .slice(-24)
    .map((message) => `[${message.role}] ${message.text}`)
    .join('\n\n')
    .slice(-MAX_TRANSCRIPT_CHARS);

  return [
    "You are MetaAgent-PC, a desktop coding agent running on the user's computer.",
    'Continue the existing conversation and perform work in the current working directory when needed.',
    'If the latest user message is a follow-up question while prior work is running or has just completed, answer it in context.',
    'Be concise but specific about what you did or what the user asked.',
    '',
    'Conversation transcript:',
    transcript,
    '',
    'Latest user message to answer now:',
    triggerMessage.text,
  ].join('\n');
}

function buildCommand(triggerMessage: DesktopAgentMessage): {
  executable: string;
  args: string[];
} {
  const prompt =
    settings.provider === 'codex'
      ? triggerMessage.text
      : buildPromptFromMessages(triggerMessage);
  const baseArgs = splitArgs(settings.args);
  if (baseArgs.length > 0) {
    return {
      executable: settings.executable,
      args: baseArgs.map((arg) => arg.replaceAll('{prompt}', prompt)),
    };
  }

  if (settings.provider === 'codex') {
    const resumeThreadId = session?.nativeThreadId?.trim();
    return {
      executable: settings.executable,
      args: resumeThreadId
        ? ['exec', 'resume', '--json', resumeThreadId, prompt]
        : ['exec', '--json', prompt],
    };
  }

  return {
    executable: settings.executable,
    args: ['-p', prompt],
  };
}

function parseCodexJsonOutput(stdout: string): string | null {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let lastAgentMessage: string | null = null;
  for (const line of lines) {
    try {
      const payload = JSON.parse(line);
      if (
        payload?.type === 'item.completed' &&
        payload.item?.type === 'agent_message'
      ) {
        const text = payload.item?.text;
        if (typeof text === 'string' && text.trim()) {
          lastAgentMessage = text.trim();
        }
      }
    } catch {
      // ignore non-JSON lines
    }
  }

  return lastAgentMessage;
}

function parseCodexJsonLine(line: string): ParsedCodexEvent {
  try {
    const payload = JSON.parse(line);
    if (
      payload?.type === 'thread.started' &&
      typeof payload.thread_id === 'string'
    ) {
      return { threadId: payload.thread_id };
    }
    if (
      payload?.type === 'item.started' &&
      payload.item?.type === 'command_execution'
    ) {
      const command = payload.item?.command;
      if (typeof command === 'string' && command.trim()) {
        return { commandStarted: command.trim() };
      }
    }
    if (
      payload?.type === 'item.completed' &&
      payload.item?.type === 'command_execution'
    ) {
      const command = payload.item?.command;
      const exitCode = payload.item?.exit_code;
      if (typeof command === 'string' && command.trim()) {
        return {
          commandCompleted: `${command.trim()}${typeof exitCode === 'number' ? ` · exit ${exitCode}` : ''}`,
        };
      }
    }
    if (
      payload?.type === 'item.completed' &&
      payload.item?.type === 'agent_message'
    ) {
      const text = payload.item?.text;
      if (typeof text === 'string' && text.trim()) {
        return { agentMessage: text.trim() };
      }
    }
  } catch {
    // ignore non-JSON lines
  }

  return {};
}

function settle(
  status: DesktopAgentStatus,
  exitCode: number | null,
  message?: string,
) {
  state = {
    ...state,
    status,
    finishedAt: new Date().toISOString(),
    exitCode,
    pid: null,
    lastError: status === 'error' ? message || state.lastError : null,
  };
  activeProcess = null;
  syncDerivedState();
  emitAgentSnapshot();
}

function processNextMessage(): void {
  if (activeProcess || queuedMessageIds.length === 0) {
    syncDerivedState();
    return;
  }

  const nextMessageId = queuedMessageIds.shift();
  const nextMessage = messages.find((message) => message.id === nextMessageId);
  if (!nextMessage) {
    syncDerivedState();
    processNextMessage();
    return;
  }

  updateMessage(nextMessage.id, 'processing');
  const command = resolveNodeBackedCodexCommand(buildCommand(nextMessage));
  let stdoutBuffer = '';
  let stderrBuffer = '';
  let latestCodexMessage: string | null = null;
  let emittedAssistantForTurn = false;

  appendLog(
    'system',
    `Starting ${settings.provider} agent turn ${nextMessage.turn}`,
  );

  try {
    const useCmdWrapper =
      process.platform === 'win32' &&
      /\.(cmd|bat)$/i.test(command.executable) &&
      path.basename(command.executable).toLowerCase() !== 'codex.cmd';
    if (useCmdWrapper) {
      const resolvedExecutable = resolveExecutableForWindows(
        command.executable,
      );
      activeProcess = spawn(resolvedExecutable, command.args, {
        cwd: settings.cwd,
        shell: true,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
    } else {
      activeProcess = spawn(command.executable, command.args, {
        cwd: settings.cwd,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.message} (cwd: ${settings.cwd}, executable: ${command.executable})`
        : 'Failed to start desktop agent';
    appendLog('stderr', message);
    updateMessage(nextMessage.id, 'error');
    pushMessage('system', message, 'error');
    settle('error', -1, message);
    return;
  }

  state = {
    ...state,
    status: 'running',
    prompt: nextMessage.text,
    pid: activeProcess.pid ?? null,
    startedAt: state.startedAt ?? new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    lastError: null,
    executable: command.executable,
    args: command.args.join(' '),
  };
  syncDerivedState();

  activeProcess.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    stdoutBuffer += text;
    text
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line: string) => {
        appendLog('stdout', line);
        if (settings.provider === 'codex') {
          const parsed = parseCodexJsonLine(line);
          if (parsed.threadId && session) {
            session.nativeThreadId = parsed.threadId;
            session.updatedAt = new Date().toISOString();
            emitAgentSnapshot();
          }
          if (parsed.commandStarted) {
            pushMessage(
              'system',
              `正在执行：${parsed.commandStarted}`,
              'processing',
            );
          }
          if (parsed.commandCompleted) {
            pushMessage(
              'system',
              `命令完成：${parsed.commandCompleted}`,
              'completed',
            );
          }
          if (parsed.agentMessage) {
            latestCodexMessage = parsed.agentMessage;
            emittedAssistantForTurn = true;
            const lastAssistant = findLastMessage('assistant');
            if (lastAssistant && lastAssistant.state === 'processing') {
              lastAssistant.text = parsed.agentMessage;
              lastAssistant.state = 'completed';
              lastAssistant.at = new Date().toISOString();
              syncDerivedState();
            } else {
              pushMessage('assistant', parsed.agentMessage, 'completed');
            }
          }
        }
      });
  });

  activeProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    stderrBuffer += text;
    text
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line: string) => appendLog('stderr', line));
  });

  activeProcess.on('error', (error) => {
    const message =
      error instanceof Error ? error.message : 'Desktop agent failed';
    appendLog('stderr', message);
    updateMessage(nextMessage.id, 'error');
    pushMessage('system', message, 'error');
    settle('error', -1, message);
    logger.error({ err: error }, 'Desktop agent process failed');
    processNextMessage();
  });

  activeProcess.on('exit', (code) => {
    const codexJsonOutput =
      settings.provider === 'codex'
        ? latestCodexMessage || parseCodexJsonOutput(stdoutBuffer)
        : null;
    const output =
      codexJsonOutput || stdoutBuffer.trim() || stderrBuffer.trim();
    if (code === 0) {
      updateMessage(nextMessage.id, 'completed');
      if (output && !emittedAssistantForTurn) {
        pushMessage('assistant', output, 'completed');
      } else {
        if (!emittedAssistantForTurn) {
          pushMessage(
            'assistant',
            `${settings.provider} completed without textual output.`,
            'completed',
          );
        }
      }
      appendLog('system', `${settings.provider} agent finished`);
      if (session) {
        session.lastTurnAt = new Date().toISOString();
      }
      settle('success', 0);
    } else {
      const message =
        output ||
        `${settings.provider} agent exited with code ${code ?? 'unknown'}`;
      updateMessage(nextMessage.id, 'error');
      pushMessage('system', message, 'error');
      appendLog(
        'system',
        `${settings.provider} agent exited with code ${code ?? 'unknown'}`,
      );
      settle('error', code ?? -1, message);
    }
    processNextMessage();
  });
}

export function getDesktopAgentSettings(): DesktopAgentSettings {
  return { ...settings };
}

export function updateDesktopAgentSettings(
  next: Partial<DesktopAgentSettings>,
): DesktopAgentSettings {
  settings = normalizeSettings({
    ...settings,
    ...next,
  });
  syncDerivedState();
  return getDesktopAgentSettings();
}

export function getDesktopAgentState(): DesktopAgentState {
  syncDerivedState();
  return { ...state };
}

export function getDesktopAgentSession(): DesktopAgentSession | null {
  syncDerivedState();
  return session ? { ...session } : null;
}

export function getDesktopAgentSnapshot(): DesktopAgentSnapshot {
  syncDerivedState();
  return {
    settings: getDesktopAgentSettings(),
    state: getDesktopAgentState(),
    session: getDesktopAgentSession(),
    messages: listDesktopAgentMessages(120),
    logs: listDesktopAgentLogs(120),
  };
}

export function listDesktopAgentMessages(limit = 120): DesktopAgentMessage[] {
  return messages.slice(-Math.max(1, limit)).map((message) => ({ ...message }));
}

export function listDesktopAgentLogs(limit = 120): DesktopAgentLogEntry[] {
  return logs.slice(-Math.max(1, limit));
}

export function resetDesktopAgentSession(): { ok: true } {
  if (activeProcess) {
    activeProcess.kill('SIGTERM');
    activeProcess = null;
  }
  session = null;
  queuedMessageIds.length = 0;
  messages.length = 0;
  logs.length = 0;
  turnCounter = 0;
  state = {
    status: 'idle',
    provider: settings.provider,
    prompt: null,
    pid: null,
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    cwd: settings.cwd,
    executable: settings.executable,
    args: settings.args,
    lastError: null,
    lastOutput: null,
    sessionId: null,
    pendingMessageCount: 0,
    messageCount: 0,
  };
  emitAgentSnapshot();
  return { ok: true };
}

export function stopDesktopAgent(): { ok: boolean; message: string } {
  if (!activeProcess) {
    return { ok: false, message: 'No desktop agent is running' };
  }

  appendLog('system', 'Stopping desktop agent process');
  activeProcess.kill('SIGTERM');
  return { ok: true, message: 'Stop signal sent' };
}

export function subscribeDesktopAgentSnapshots(
  listener: (snapshot: DesktopAgentSnapshot) => void,
): () => void {
  agentEvents.on('snapshot', listener);
  return () => {
    agentEvents.off('snapshot', listener);
  };
}

export function sendDesktopAgentMessage(request: DesktopAgentMessageRequest):
  | {
      ok: true;
      state: DesktopAgentState;
      session: DesktopAgentSession | null;
      message: DesktopAgentMessage;
    }
  | { ok: false; error: string } {
  const text = request.message.trim();
  if (!text) {
    return { ok: false, error: 'Message is required' };
  }

  const provider = normalizeProvider(request.provider || settings.provider);
  updateDesktopAgentSettings({
    provider,
    cwd: request.cwd ? path.resolve(request.cwd) : settings.cwd,
  });
  ensureSession(provider);

  const message = pushMessage('user', text, 'queued');
  queuedMessageIds.push(message.id);
  appendLog('system', `Queued user message for ${provider}`);
  syncDerivedState();
  processNextMessage();

  return {
    ok: true,
    state: getDesktopAgentState(),
    session: getDesktopAgentSession(),
    message,
  };
}

export function runDesktopAgent(
  request: DesktopAgentRunRequest,
): { ok: true; state: DesktopAgentState } | { ok: false; error: string } {
  const result = sendDesktopAgentMessage({
    message: request.prompt,
    provider: request.provider,
    cwd: request.cwd,
  });
  if (!result.ok) {
    return result;
  }
  return { ok: true, state: result.state };
}
