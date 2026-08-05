(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if ((params.get('model') || '').toUpperCase() !== 'FQ1') return;

  const nativeAppendChild = document.head.appendChild.bind(document.head);
  document.head.appendChild = function (node) {
    if (
      node instanceof HTMLScriptElement &&
      /\/js\/fq1_webgpu\.js(?:\?|$)/.test(node.src)
    ) {
      const request = new XMLHttpRequest();
      request.open('GET', node.src, false);
      request.send();
      if (request.status >= 200 && request.status < 300) {
        const source = request.responseText.replace(
          /this\.options\.laneCapacity \?\?[\s\S]*?16,\s*256,\s*\);/,
          match => match.replace(/16,\s*256,/, '16,\n        8192,')
        );
        const blobUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        node.src = blobUrl;
        node.addEventListener('load', () => URL.revokeObjectURL(blobUrl), { once: true });
        node.addEventListener('error', () => URL.revokeObjectURL(blobUrl), { once: true });
      }
    }
    return nativeAppendChild(node);
  };
})();
