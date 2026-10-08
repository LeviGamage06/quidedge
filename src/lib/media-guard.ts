// Convenience deterrents only: public media remains retrievable and recordable.
function protect(el: Element) {
  if (el instanceof HTMLImageElement) el.draggable = false;
  if (el instanceof HTMLVideoElement) {
    const tokens = new Set((el.getAttribute('controlslist') || '').split(/\s+/).filter(Boolean));
    tokens.add('nodownload');
    el.setAttribute('controlslist', [...tokens].join(' '));
  }
}
function protectTree(root: Element) {
  if (root.matches('img, video')) protect(root);
  root.querySelectorAll('img, video').forEach(protect);
}
const main = document.querySelector('main');
if (main) {
  protectTree(main);
  // Process only newly inserted elements; counter text updates cost no scans.
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node instanceof Element) protectTree(node);
    }
  });
  observer.observe(main, {childList:true, subtree:true});
}
