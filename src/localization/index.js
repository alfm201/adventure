// Optional in non-browser tests and workers; localization never changes state.
export const translate = (message, language) => globalThis.adventureI18n?.t(message, language) ?? message;
export const translateMarkup = message => globalThis.adventureI18n?.markup(message) ?? message;
export const pageLanguage = () => globalThis.adventureI18n?.language ?? 'ko';
export const numberLocale = () => globalThis.adventureI18n?.numberLocale() ?? 'ko-KR';
