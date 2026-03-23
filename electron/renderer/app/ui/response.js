export function setResponse(target, payload) {
  target.textContent =
    typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
}
