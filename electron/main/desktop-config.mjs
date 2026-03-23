import fs from 'node:fs';
import path from 'node:path';

export function defaultDesktopConfig(projectRoot) {
  return {
    host: '0.0.0.0',
    port: '3210',
    token: '',
    pairPassword: '',
    autoApprove: false,
    agentProvider: 'codex',
    agentExecutable: '',
    agentArgs: '',
    agentCwd: projectRoot,
  };
}

export function getEnvFilePath(runtimeRoot) {
  return path.join(runtimeRoot, '.env');
}

export function getDesktopServerPath(appPath) {
  const appDistPath = path.join(appPath, 'dist', 'desktop', 'server.js');
  if (fs.existsSync(appDistPath)) {
    return appDistPath;
  }

  const projectDistPath = path.resolve(appPath, '..', 'dist', 'desktop', 'server.js');
  if (fs.existsSync(projectDistPath)) {
    return projectDistPath;
  }

  return appDistPath;
}

export function displayEndpointFor(config) {
  return `http://${config.host || '0.0.0.0'}:${config.port || '3210'}`;
}

export function requestEndpointFor(config) {
  const host = !config.host || config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  return `http://${host}:${config.port || '3210'}`;
}

export function resolveNodeExecutable() {
  const candidates = [
    process.env.METAAGENT_PC_NODE_PATH,
    'D:\\NodeJs\\node.exe',
    process.env.NODE_PATH,
    process.env.NODE,
    process.env.NVM_SYMLINK ? path.join(process.env.NVM_SYMLINK, 'node.exe') : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'nodejs', 'node.exe') : null,
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'nodejs', 'node.exe') : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to locate node.exe for the desktop service. Set METAAGENT_PC_NODE_PATH to a valid Node runtime.');
}

export function readDesktopConfig(runtimeRoot, projectRoot) {
  const defaults = defaultDesktopConfig(projectRoot);
  const envFilePath = getEnvFilePath(runtimeRoot);
  if (!fs.existsSync(envFilePath)) {
    return defaults;
  }

  const lines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const splitIndex = trimmed.indexOf('=');
    if (splitIndex === -1) continue;
    const key = trimmed.slice(0, splitIndex).trim();
    const value = trimmed.slice(splitIndex + 1).trim();
    env[key] = value;
  }

  return {
    host: env.DESKTOP_REMOTE_API_HOST || defaults.host,
    port: env.DESKTOP_REMOTE_API_PORT || defaults.port,
    token: env.DESKTOP_REMOTE_API_TOKEN || defaults.token,
    pairPassword: env.DESKTOP_REMOTE_PAIR_PASSWORD || defaults.pairPassword,
    autoApprove: (env.DESKTOP_REMOTE_AUTO_APPROVE || 'false') === 'true',
    agentProvider: env.DESKTOP_AGENT_PROVIDER || defaults.agentProvider,
    agentExecutable: env.DESKTOP_AGENT_EXECUTABLE || defaults.agentExecutable,
    agentArgs: env.DESKTOP_AGENT_ARGS || defaults.agentArgs,
    agentCwd: env.DESKTOP_AGENT_CWD || defaults.agentCwd,
  };
}

export function writeDesktopConfig(runtimeRoot, config) {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const envFilePath = getEnvFilePath(runtimeRoot);
  const existing = fs.existsSync(envFilePath)
    ? fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/)
    : [];

  const values = {
    DESKTOP_REMOTE_API_HOST: config.host,
    DESKTOP_REMOTE_API_PORT: config.port,
    DESKTOP_REMOTE_API_TOKEN: config.token,
    DESKTOP_REMOTE_PAIR_PASSWORD: config.pairPassword,
    DESKTOP_REMOTE_AUTO_APPROVE: String(config.autoApprove),
    DESKTOP_AGENT_PROVIDER: config.agentProvider,
    DESKTOP_AGENT_EXECUTABLE: config.agentExecutable,
    DESKTOP_AGENT_ARGS: config.agentArgs,
    DESKTOP_AGENT_CWD: config.agentCwd,
  };

  const seen = new Set();
  const rewritten = existing.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      return line;
    }
    const [key] = trimmed.split('=', 1);
    if (Object.hasOwn(values, key)) {
      seen.add(key);
      return `${key}=${values[key]}`;
    }
    return line;
  });

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) {
      rewritten.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(envFilePath, rewritten.filter(Boolean).join('\n') + '\n', 'utf8');
}
