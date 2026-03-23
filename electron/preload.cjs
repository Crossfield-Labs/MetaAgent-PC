const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('metaAgentDesktop', {
  getState: () => ipcRenderer.invoke('desktop:get-state'),
  getDefaults: () => ipcRenderer.invoke('desktop:get-defaults'),
  start: (config) => ipcRenderer.invoke('desktop:start', config),
  stop: () => ipcRenderer.invoke('desktop:stop'),
  request: (payload) => ipcRenderer.invoke('desktop:api', payload),
  adminRequest: (payload) => ipcRenderer.invoke('desktop:admin-api', payload),
  openProject: () => ipcRenderer.invoke('desktop:open-project'),
  onState: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('desktop-state', handler);
    return () => ipcRenderer.removeListener('desktop-state', handler);
  },
  onLog: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('desktop-log', handler);
    return () => ipcRenderer.removeListener('desktop-log', handler);
  },
  onGhostState: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('ghost-state', handler);
    return () => ipcRenderer.removeListener('ghost-state', handler);
  },
  onVideoSession: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('video-session', handler);
    return () => ipcRenderer.removeListener('video-session', handler);
  },
});
