// Optional in non-browser tests and workers; localization never changes state.
export const translate = (message, language) => globalThis.adventureI18n?.t(message, language) ?? message;
export const translateMarkup = message => globalThis.adventureI18n?.markup(message) ?? message;
export const pageLanguage = () => globalThis.adventureI18n?.language ?? 'ko';
export const numberLocale = () => globalThis.adventureI18n?.numberLocale() ?? 'ko-KR';

// A nested message is explicit; ordinary strings/numbers remain untouched.
export const message = (key, ...values) => ({ key, values });
const fallbackFormat = (key, values) => String(key).replace(/\{(\d+)\}/g, (slot, i) => {
  if (!(i in values)) return slot;
  const value = values[i];
  return value && typeof value.key === 'string' && Array.isArray(value.values)
    ? fallbackFormat(value.key, value.values) : String(value ?? '');
});
export const formatMessage = (key, ...values) => globalThis.adventureI18n?.format(key, values) ?? fallbackFormat(key, values);
export function setLocalizedText(node, key, ...values) {
  if (globalThis.adventureI18n) globalThis.adventureI18n.setText(node, key, values);
  else node.textContent = fallbackFormat(key, values);
}
export function setLocalizedAttribute(node, name, key, ...values) {
  if (globalThis.adventureI18n) globalThis.adventureI18n.setAttribute(node, name, key, values);
  else node.setAttribute(name, fallbackFormat(key, values));
}
