export const VELA_SEARCH = Object.freeze([
  { key: 'fast', label: '빠름', labels: { en: 'Fast', ja: '高速', zh: '快速', 'zh-TW': '快速' }, nodeBudget: 0, score: 1877.2, time: '즉시', hint: '기존 VELA v4.2와 같은 추천입니다.' },
  { key: 'normal', label: '보통', labels: { en: 'Normal', ja: '標準', zh: '标准', 'zh-TW': '標準' }, nodeBudget: 2400, score: 1878.6, time: '대부분 즉시' },
  { key: 'high', label: '높음', labels: { en: 'High', ja: '高', zh: '高', 'zh-TW': '高' }, nodeBudget: 47400, score: 1879.3, time: '접전 시 최대 약 1초' },
  { key: 'max', label: '최고', labels: { en: 'Max', ja: '最高', zh: '最高', 'zh-TW': '最高' }, nodeBudget: 383400, score: 1879.8, time: '접전 시 최대 수 초', hint: '일부 판단이 수 초 이상 걸릴 수 있습니다. 높음 대비 점수 차이는 작습니다.' },
].map(value => Object.freeze({ ...value, policyId: `vela-v4.3-${value.key}`, predictorFile: `predictor-${value.key}.json` })));
export function velaSearch(key = 'normal') {
  const option = VELA_SEARCH.find(value => value.key === key);
  if (!option) throw new RangeError('Invalid VELA search strength');
  return option;
}
