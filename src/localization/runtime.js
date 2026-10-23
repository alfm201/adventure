(function (scope) {
  'use strict';
  const catalog = scope.adventureMessages || {};
  const codes = ['ko', 'en', 'ja', 'zh'];
  const storageKey = 'adventure.page-language';
  const normalize = value => String(value).replace(/\s+/g, ' ').trim();
  const korean = /[가-힣]/;
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let language = 'ko';
  let persistent = true;
  try { const saved = localStorage.getItem(storageKey); if (codes.includes(saved)) language = saved; } catch { persistent = false; }
  if (!Object.keys(catalog).length) language = 'ko';
  const patterns = Object.entries(catalog).filter(([key]) => /\{\d+\}/.test(key)).map(([key, values]) => {
    const slots = [];
    const source = key.split(/(\{\d+\})/).map(part => {
      if (/^\{\d+\}$/.test(part)) { slots.push(part.slice(1, -1)); return '(.*?)'; }
      return escape(part);
    }).join('');
    return { key, values, slots, regex: new RegExp('^' + source + '$'), weight: key.replace(/\{\d+\}/g, '').length };
  }).sort((a,b) => b.weight - a.weight);
  const literals = Object.keys(catalog).filter(key => !/\{\d+\}/.test(key)).sort((a,b) => b.length - a.length);
  const fragments = literals.length ? new RegExp(literals.map(escape).join('|'), 'g') : null;
  const cache = new Map();
  function translate(value, locale = language, depth = 0) {
    const original = String(value ?? '');
    if (locale === 'ko' || !codes.includes(locale) || !korean.test(original)) return original;
    const index = codes.indexOf(locale) - 1, key = normalize(original);
    if (catalog[key]) return original.replace(/\S[\s\S]*\S|\S/, () => catalog[key][index]);
    if (depth < 8) for (const pattern of patterns) {
      const match = pattern.regex.exec(key);
      if (!match) continue;
      const args = Object.fromEntries(pattern.slots.map((slot,i) => [slot, translate(match[i+1],locale,depth+1)]));
      return pattern.values[index].replace(/\{(\d+)\}/g, (_, slot) => args[slot]);
    }
    // Composed labels (stage number + name, check mark + card name, status +
    // action) reuse the same catalog. Only display text is processed; never
    // command values, IDs, recognition input, HTML markup or voice utterances.
    return fragments ? original.replace(fragments, source => catalog[source][index]) : original;
  }
  function t(value, locale = language) {
    const key = locale + '\0' + value;
    if (cache.has(key)) return cache.get(key);
    const result = translate(value, locale);
    if (cache.size >= 2048) cache.clear();
    cache.set(key, result); return result;
  }
  // Explicit messages use an exact catalog key. Parameters are opaque data;
  // only nested {key, values} messages are translated, never guessed fragments.
  function format(key, values = [], locale = language, depth = 0) {
    const original = String(key), index = codes.indexOf(locale) - 1;
    const translations = catalog[original] ?? (korean.test(original) ? catalog[normalize(original)] : null);
    const template = index >= 0 ? translations?.[index] ?? original : original;
    if (!values.length) return template;
    return template.replace(/\{(\d+)\}/g, (slot, i) => {
      if (!(i in values)) return slot;
      const value = values[i];
      return value && typeof value.key === 'string' && Array.isArray(value.values) && depth < 8
        ? format(value.key, value.values, locale, depth + 1) : String(value ?? '');
    });
  }
  function markup(value) {
    // Only application-authored rich text is accepted here. Translate complete
    // rich messages when present, otherwise each text segment, never tag syntax.
    if (catalog[normalize(value)] || patterns.some(p => p.key.includes('<') && p.regex.test(normalize(value)))) return t(value);
    return value.split(/(<[^>]*>)/).map(part => part.startsWith('<') ? part : t(part)).join('');
  }
  const textSources = new WeakMap(), attributeSources = new WeakMap();
  const attributes = ['aria-label', 'aria-description', 'title', 'placeholder', 'alt', 'data-label'];
  const excluded = 'script,style,textarea,[contenteditable],[translate="no"]';
  function setText(node, key, values = []) {
    let child = node.firstChild;
    if (!child || child.nodeType !== 3 || child.nextSibling) {
      child = document.createTextNode(''); node.replaceChildren(child);
    }
    const rendered = format(key, values);
    textSources.set(child, { message: { key, values }, rendered, locale: language });
    if (child.data !== rendered) child.data = rendered;
  }
  function setAttribute(node, name, key, values = []) {
    let records = attributeSources.get(node);
    if (!records) { records = {}; attributeSources.set(node, records); }
    const rendered = format(key, values);
    records[name] = { message: { key, values }, rendered, locale: language };
    if (node.getAttribute(name) !== rendered) node.setAttribute(name, rendered);
  }
  function text(node) {
    if (!node.parentElement || node.parentElement.closest(excluded)) return;
    const old = textSources.get(node), current = node.data;
    if (old?.message && current === old.rendered) {
      if (old.locale !== language) {
        old.rendered = format(old.message.key, old.message.values); old.locale = language;
        if (current !== old.rendered) node.data = old.rendered;
      }
      return;
    }
    const source = old && current === old.rendered ? old.source : current;
    if (!korean.test(source) && !old) return;
    const rendered = t(source);
    textSources.set(node, {source, rendered});
    if (current !== rendered) node.data = rendered;
  }
  function attrs(node) {
    if (node.closest(excluded)) return;
    let records = attributeSources.get(node);
    if (!records) { records = {}; attributeSources.set(node, records); }
    for (const name of attributes) {
      const current = node.getAttribute(name);
      if (current === null) { delete records[name]; continue; }
      const old = records[name], source = old && current === old.rendered ? old.source : current;
      if (old?.message && current === old.rendered) {
        if (old.locale !== language) {
          old.rendered = format(old.message.key, old.message.values); old.locale = language;
          if (current !== old.rendered) node.setAttribute(name, old.rendered);
        }
        continue;
      }
      const rendered = t(source); records[name] = {source, rendered};
      if (current !== rendered) node.setAttribute(name, rendered);
    }
  }
  function localize(root) {
    if (root.nodeType === 3) { text(root); return; }
    if (root.nodeType !== 1 || root.closest(excluded)) return;
    attrs(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return node.nodeType === 1 && node.matches(excluded) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeType === 3) text(node); else attrs(node); }
  }
  const observer = new MutationObserver(records => {
    if (language === 'ko') return;
    const roots = new Set();
    for (const record of records) {
      if (record.type === 'characterData') text(record.target);
      else if (record.type === 'attributes') attrs(record.target);
      else for (const node of record.addedNodes) roots.add(node);
    }
    for (const root of roots) if (root.isConnected) localize(root);
  });
  function refresh() {
    document.documentElement.lang = language === 'zh' ? 'zh-Hans' : language;
    localize(document.body);
    document.querySelector('.portrait')?.setAttribute('data-fallback-label', t('모험가'));
  }
  function setLanguage(value) {
    if (!codes.includes(value) || value !== 'ko' && !Object.keys(catalog).length) return false;
    language = value; cache.clear();
    try { localStorage.setItem(storageKey, value); persistent = true; } catch { persistent = false; }
    refresh();
    scope.dispatchEvent(new CustomEvent('adventurelanguagechange', { detail: {language} }));
    return true;
  }
  scope.adventureI18n = {t, format, setText, setAttribute, markup, setLanguage, localize, refresh, get language() { return language; },
    get persistent() { return persistent; },
    locales: Object.freeze(codes.slice()), numberLocale: () => ({ko:'ko-KR', en:'en-US', ja:'ja-JP', zh:'zh-CN'})[language]};
  refresh();
  observer.observe(document.body, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
})(globalThis);
