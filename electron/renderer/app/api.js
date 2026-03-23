export function currentConfig(el) {
  return {
    host: el.hostInput.value.trim(),
    port: el.portInput.value.trim(),
    token: el.tokenInput.value.trim(),
    agentProvider: el.agentProviderInput.value,
    agentExecutable: el.agentExecutableInput.value.trim(),
    agentArgs: el.agentArgsInput.value.trim(),
    agentCwd: el.agentCwdInput.value.trim(),
    pairPassword: el.pairPasswordInput.value,
    autoApprove: el.autoApproveInput.checked,
  };
}

export async function invokeApi(el, method, path, body) {
  return window.metaAgentDesktop.request({
    method,
    path,
    body,
    token: currentConfig(el).token,
  });
}

export async function invokeAdmin(method, path, body) {
  return window.metaAgentDesktop.adminRequest({
    method,
    path,
    body,
  });
}
