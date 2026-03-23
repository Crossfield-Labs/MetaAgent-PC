import { createDom } from './dom.js';
import { hidePairingModal, renderAgentSession, renderState, setControlView, setView } from './render.js';
import { createPollingController } from './polling.js';
import { createPairingController } from './pairing.js';
import { createDesktopActions } from './actions.js';

export async function bootstrap() {
  const el = createDom();
  const pollingController = createPollingController();
  const pairingController = createPairingController(el);
  const actions = createDesktopActions(el, pairingController, pollingController);

  actions.bind();

  const defaults = await window.metaAgentDesktop.getDefaults();
  el.hostInput.value = defaults.config.host;
  el.portInput.value = defaults.config.port;
  el.tokenInput.value = defaults.config.token ?? '';
  el.agentProviderInput.value = defaults.config.agentProvider ?? 'codex';
  el.agentExecutableInput.value = defaults.config.agentExecutable ?? '';
  el.agentArgsInput.value = defaults.config.agentArgs ?? '';
  el.agentCwdInput.value = defaults.config.agentCwd ?? '';
  el.pairPasswordInput.value = defaults.config.pairPassword ?? '';
  el.autoApproveInput.checked = Boolean(defaults.config.autoApprove);

  const initialState = await window.metaAgentDesktop.getState();
  renderState(el, initialState);
  setView(el, 'overview');
  setControlView(el, 'agent');
  hidePairingModal(el);
  renderAgentSession(el, null);

  if (initialState.running) {
    await pairingController.refreshPairingState();
    await actions.refreshAgentState();
    actions.startPollingLoops();
  }
}
