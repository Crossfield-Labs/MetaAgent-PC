export function renderScreenshot(el, response) {
  const screenshot = response?.data?.data;
  if (!response?.ok || !screenshot?.base64) {
    el.screenshotImage.classList.remove('visible');
    el.screenshotImage.removeAttribute('src');
    el.screenshotMeta.textContent = '还没有抓取到桌面截图';
    return;
  }

  el.screenshotImage.src = `data:${screenshot.mimeType};base64,${screenshot.base64}`;
  el.screenshotImage.classList.add('visible');
  el.screenshotMeta.textContent = `${screenshot.width} x ${screenshot.height} · ${screenshot.mimeType}`;
}
