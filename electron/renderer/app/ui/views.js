import { viewMeta } from '../dom.js';

export function setView(el, nextView) {
  el.navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.view === nextView);
  });
  el.views.forEach((view) => {
    view.classList.toggle('active', view.dataset.view === nextView);
  });

  const meta = viewMeta[nextView];
  if (meta) {
    el.pageTitle.textContent = meta.title;
    el.pageDescription.textContent = meta.description;
  }
}

export function setControlView(el, nextView) {
  el.controlTabs.forEach((item) => {
    item.classList.toggle('active', item.dataset.controlView === nextView);
  });
  el.controlPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.controlPanel === nextView);
  });
}
