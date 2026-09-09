export function accumulator(histogram = false) {
  return {
    count: 0,
    sum: 0,
    sumSq: 0,
    min: Infinity,
    max: -Infinity,
    truncated: 0,
    histogram: histogram ? new Uint32Array(2899) : null,
  };
}
export function merge(a, b) {
  if (
    !Number.isInteger(b.count) ||
    b.count < 0 ||
    !Number.isFinite(b.sum) ||
    !Number.isFinite(b.sumSq)
  )
    throw Error("Invalid batch statistics");
  if (!b.count) return a;
  a.count += b.count;
  a.sum += b.sum;
  a.sumSq += b.sumSq;
  a.min = Math.min(a.min, b.min);
  a.max = Math.max(a.max, b.max);
  a.truncated += b.truncated || 0;
  if (a.histogram && b.histogram)
    for (let i = 0; i < a.histogram.length; i++)
      a.histogram[i] += b.histogram[i];
  return a;
}
export function median(histogram, count) {
  let seen = 0,
    left = null;
  const l = Math.floor((count + 1) / 2),
    r = Math.floor((count + 2) / 2);
  for (let i = 0; i < histogram.length; i++) {
    seen += histogram[i];
    if (left === null && seen >= l) left = i;
    if (seen >= r) return (left + i) / 2;
  }
  throw Error("Histogram count mismatch");
}
export function summarize(a) {
  if (!a.count)
    return {
      count: 0,
      mean: null,
      std: null,
      se: Infinity,
      min: null,
      max: null,
      median: null,
      truncated: 0,
    };
  const mean = a.sum / a.count,
    variance = Math.max(0, a.sumSq / a.count - mean * mean),
    se = Math.sqrt(variance / a.count);
  return {
    count: a.count,
    mean,
    std: Math.sqrt(variance),
    se,
    min: a.min,
    max: a.max,
    median: a.histogram ? median(a.histogram, a.count) : null,
    ci: [mean - 1.96 * se, mean + 1.96 * se],
    truncated: a.truncated,
  };
}
export function decide(stats, active) {
  const summaries = stats.map(summarize),
    candidates = active
      .filter((a) => stats[a].count > 0)
      .sort((a, b) => summaries[b].mean - summaries[a].mean || a - b),
    best = candidates[0];
  const stop =
    candidates.length === 1 ||
    (candidates.length > 1 &&
      summaries[best].mean - 1.8 * summaries[best].se >
        Math.max(
          ...candidates
            .slice(1)
            .map((a) => summaries[a].mean + 1.8 * summaries[a].se),
        ));
  return { summaries, best, stop };
}
export function prune(stats, active) {
  if (active.length <= 2) return active;
  const { summaries: s, best } = decide(stats, active);
  if (best === undefined) return active;
  const lower = s[best].mean - 1.8 * s[best].se;
  return active.filter(
    (a) => a === best || !stats[a].count || s[a].mean + 1.8 * s[a].se >= lower,
  );
}
export function sampleActions(stats, active, max) {
  const { summaries: s } = decide(stats, active);
  const ranked = active
    .filter((a) => stats[a].count < max)
    .sort((a, b) => s[b].mean - s[a].mean || a - b);
  if (ranked.length <= 1) return ranked;
  const best = ranked[0],
    lower = s[best].mean - 1.8 * s[best].se;
  const next = ranked
    .filter((a) => a === best || s[a].mean + 1.8 * s[a].se >= lower)
    .sort((a, b) => stats[a].count - stats[b].count || a - b)
    .slice(0, 2);
  if (!next.includes(best)) next.push(best);
  return next;
}
