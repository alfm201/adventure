const PATCHES = { position: ['score', 74, 55, 51, 21], diceUsed: ['dice', 131, 662, 28, 21] };
const OFFSETS = [[0, 0], [-.25, 0], [.25, 0], [0, -.25], [0, .25], [-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]];
const NEAR_OFFSETS = [...OFFSETS, [0,-.75], [0,-.5], [0,.5], [0,.75],
  [-.125,0], [.125,0], [-.125,.25], [.125,.25], [-.125,-.75], [.125,-.75]];

// A recognized history panel is beside both number ROIs. Require an entire
// contiguous, unambiguous visible range before admitting numeric recovery.
export function readableDeck(deck) {
  const { start, end } = deck?.range || {};
  return deck?.open === true && Number.isInteger(start) && Number.isInteger(end) &&
    start >= 0 && end < 30 && end - start + 1 >= 12 &&
    Array.isArray(deck.rows) && deck.rows.length === end - start + 1 &&
    deck.rows.every((row, offset) => row?.index === start + offset &&
      row.identified === true && typeof row.obtained === 'boolean');
}

// Supplemental sampling only. Keep GameRecognizer.number and its templates,
// confidence/margin thresholds and original successful readings untouched.
export class NumberRecovery {
  constructor(recognizer, { tiles = false } = {}) {
    this.recognizer = recognizer;
    this.tiles = tiles;
    this.gain = 1;
    this.reset();
  }
  reset() { this.key = null; this.count = 0; this.frame = null; }
  prepare(source, rect, illumination) {
    // Exact pixels, not a hash: changing either number or its interpolation
    // neighbourhood invalidates cached parsing immediately. No retry timer.
    if (!source.getContext) return;
    const key = JSON.stringify([source.width, source.height, rect, illumination]);
    const context = source.getContext('2d'), snapshots = [];
    let same = this.pixelKey === key;
    for (const [field, [, left, top, width, height]] of Object.entries(PATCHES)) {
      const x = Math.max(0, Math.floor(rect.x + (left - 10) * rect.scale));
      const y = Math.max(0, Math.floor(rect.y + (top - 10) * rect.scale));
      const right = Math.min(source.width, Math.ceil(rect.x + (left + width + 10) * rect.scale));
      const bottom = Math.min(source.height, Math.ceil(rect.y + (top + height + 10) * rect.scale));
      const pixels = context.getImageData(x, y, right-x, bottom-y).data;
      const previous = this.pixelCache?.get(field);
      if (!previous || previous.length !== pixels.length) same = false;
      else if (same) for (let i = 0; i < pixels.length; i++) if (pixels[i] !== previous[i]) { same = false; break; }
      snapshots.push({ field, pixels, x, y, width:right-x, height:bottom-y });
    }
    if (!same) {
      this.pixelKey = key; this.pixelCache = new Map(snapshots.map(row => [row.field, row.pixels])); this.sampleCache = new Map();
      if (this.tiles) {
        this.sampleSources ||= new Map();
        for (const row of snapshots) {
          let tile = this.sampleSources.get(row.field);
          if (!tile) {
            const canvas = new OffscreenCanvas(row.width, row.height);
            tile = { canvas, context:canvas.getContext('2d', {willReadFrequently:true}) };
            this.sampleSources.set(row.field, tile);
          }
          if (tile.canvas.width !== row.width || tile.canvas.height !== row.height) {
            tile.canvas.width = row.width; tile.canvas.height = row.height;
          }
          tile.context.putImageData(new ImageData(row.pixels, row.width, row.height), 0, 0);
          tile.x = row.x; tile.y = row.y;
        }
      }
    }
  }
  sample(source, rect, field, dx, dy) {
    const [kind, left, top, width, height] = PATCHES[field];
    const x = rect.x + (left + dx) * rect.scale, y = rect.y + (top + dy) * rect.scale;
    if (x < 0 || y < 0 || x + width * rect.scale > source.width || y + height * rect.scale > source.height) return null;
    const cacheKey = [field, dx, dy, this.gain, this.smoothing, this.quality].join(':');
    if (this.sampleCache?.has(cacheKey)) return this.sampleCache.get(cacheKey);
    if (!this.reader) {
      // Only number() is used on this reader. Optional probes/deck state are
      // neither read nor modified by the supplemental path.
      this.reader = { templates:this.recognizer.templates, number:this.recognizer.number, textMask:this.recognizer.textMask };
      this.reader.pixel = function(x, y) {
        const patch = this.patch, xx = Math.round(x) - patch.left, yy = Math.round(y) - patch.top;
        if (xx < 0 || yy < 0 || xx >= patch.width || yy >= patch.height) return [0, 0, 0];
        const at = (yy * patch.width + xx) * 4;
        return patch.pixels.subarray(at, at + 3);
      };
      this.patches = new Map();
    }
    let patch = this.patches.get(field);
    if (!patch) {
      const canvas = new OffscreenCanvas(width, height);
      patch = { canvas, context: canvas.getContext('2d', { willReadFrequently: true }) };
      this.patches.set(field, patch);
    }
    patch.context.imageSmoothingEnabled = this.smoothing !== false;
    patch.context.imageSmoothingQuality = this.quality || 'high';
    const tile = this.tiles ? this.sampleSources?.get(field) : null;
    patch.context.drawImage(tile?.canvas || source, x-(tile?.x || 0), y-(tile?.y || 0), width * rect.scale, height * rect.scale, 0, 0, width, height);
    const pixels = patch.context.getImageData(0, 0, width, height).data;
    if (this.gain !== 1) for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] *= this.gain; pixels[i + 1] *= this.gain; pixels[i + 2] *= this.gain;
    }
    this.reader.patch = { left, top, width, height, pixels };
    const result = this.reader.number(kind);
    this.sampleCache?.set(cacheKey, result);
    return result;
  }
  update(source, rect, observation, sourceFrame, { allowDeck = false, allowRaw = false } = {}) {
    const missing = observation && Object.keys(PATCHES).filter(field => observation[field] == null);
    if (!rect || !observation?.visible || !['score', 'dice'].includes(observation.issue) ||
        !missing?.length || !Array.isArray(observation.hand) || typeof observation.bonusRoll !== 'boolean' ||
        observation.deck?.open && !allowDeck || (observation.dimmed && !(observation.illumination >= 1.06 && observation.illumination <= 1.2)) ||
        observation.overlay || !Number.isFinite(observation.anchorScore) || observation.anchorScore <= .90 ||
        !Number.isFinite(rect.scale) || rect.scale < 1.005 ||
        Math.abs(rect.scale - Math.round(rect.scale)) < (rect.scale < 1.06 ? .002 : .02)) {
      this.reset(); return observation;
    }
    // These identities come from TrackProcessor sequence numbers or video
    // presentedFrames, never the Worker's processing request ID. If neither
    // source can identify a frame, preserve the original abstention.
    const type = typeof sourceFrame === 'string' && /^capture:\d+$/.test(sourceFrame) ? 'capture' : 'video';
    const sequence = type === 'capture' ? Number(sourceFrame.slice(8)) : sourceFrame;
    if (!Number.isSafeInteger(sequence) || sequence < 0) { this.reset(); return observation; }
    if (this.frame?.type === type && sequence <= this.frame.sequence) {
      if (sequence < this.frame.sequence) this.reset();
      return observation;
    }
    // Fractional resampling can trigger a small illumination correction. Only
    // admit it if the uncorrected image still passes the original normal-screen
    // test; a genuinely dark/covered screen remains outside this fallback.
    if (observation.dimmed && !this.recognizer.visible()) { this.reset(); return observation; }
    this.gain = observation.dimmed ? observation.illumination : 1;
    try { this.prepare(source, rect, this.gain); }
    catch { this.sampleCache = this.pixelCache = this.sampleSources = null; this.pixelKey = null; }
    this.smoothing = true;
    this.quality = observation.dimmed ? 'high' : 'low';
    let consensus = null, votes = 0, conflict = false, contrast = false;
    const seen = {}, support = {}, offsets = new Set();
    const sampleVotes = (known = false, positions = OFFSETS) => {
      consensus = null; votes = 0;
      for (const [dx, dy] of positions) {
        const offset = dx + ':' + dy, values = {};
        for (const field of Object.keys(PATCHES)) {
          const value = this.sample(source, rect, field, dx, dy);
          // A confident conflict with any original reading or another sampling
          // invalidates recovery, even if most other samplings agree.
          if (value != null && (observation[field] != null && value !== observation[field] || seen[field] != null && value !== seen[field])) {
            conflict = true; return;
          }
          if (value != null) seen[field] = value;
          if (known && value != null) {
            support[field] ||= new Set(); support[field].add(offset);
          }
          values[field] = known ? observation[field] ?? value : value;
        }
        if (Object.values(values).some(value => value == null)) continue;
        consensus ||= values; votes++;
        if (known) offsets.add(offset);
      }
    };
    sampleVotes();
    if (conflict) { this.reset(); return observation; }
    // A few high-quality matches can be corroborated by the legacy linear
    // sampler, but every confident value must still agree across both kernels.
    if (this.quality === 'high' && votes > 0 && votes < 3) {
      this.quality = 'low'; sampleVotes(); this.quality = 'high';
      if (conflict) { this.reset(); return observation; }
    }
    if (rect.scale < 1.06 && votes < 3) {
      this.gain = 1; this.quality = 'high'; sampleVotes(true, NEAR_OFFSETS);
      if (conflict) { this.reset(); return observation; }
      // Small scale errors shift distant number ROIs by different fractions.
      // Each field must have three matching positions; every partial sample
      // still supplies a conflict veto, and original values remain unchanged.
      if (Object.keys(PATCHES).every(field => support[field]?.size >= 3)) {
        votes = Math.min(...Object.values(support).map(set => set.size)); consensus = seen;
      } else votes = 0;
    }
    // Fractional sampling of a normal white frame can suggest a mild gain.
    // If that gain leaves the number unknown, test original pixels with the
    // same confidence gates. Preserve conflicts from BOTH sets of samples.
    if (allowRaw && votes < 3 && this.gain !== 1) { this.gain = 1; sampleVotes(); }
    if (conflict) { this.reset(); return observation; }
    // Window/DPI resampling may thin a light glyph while a white-frame gain
    // thickens it too far. Bracket the existing mild gain at three evenly
    // spaced levels using nearest-neighbour pixels, with unchanged templates
    // and confidence gates. Original pixels also supply conflict vetoes.
    if (votes < 3 && observation.dimmed) {
      if (!allowRaw) { this.gain = 1; sampleVotes(); }
      if (conflict) { this.reset(); return observation; }
      let strong = 0;
      this.smoothing = false;
      for (const fraction of [.25, .5, .75]) {
        this.gain = 1 + (observation.illumination - 1) * fraction;
        sampleVotes(true);
        if (conflict) { this.smoothing = true; this.reset(); return observation; }
        if (votes >= 3) strong++;
      }
      this.smoothing = true;
      // Known fields need independent matching samples too, but a null sample
      // cannot erase an already confident original reading.
      const corroborated = Object.keys(PATCHES).every(field => observation[field] == null || support[field]?.size >= 3);
      votes = strong >= 2 && corroborated ? offsets.size : 0;
      consensus = seen;
      contrast = votes >= 3;
    }
    if (votes < 3) { this.reset(); return observation; }
    const key = JSON.stringify([rect, observation.position, observation.diceUsed, observation.hand, observation.bonusRoll,
      consensus, type, ...(contrast ? ['contrast'] : allowRaw ? [this.gain] : []),
      ...(allowDeck ? [observation.deck?.range, observation.deck?.rows] : [])]);
    if (key !== this.key) { this.key = key; this.count = 0; this.frame = null; }
    this.count++; this.frame = { type, sequence };
    if (this.count < 2) return observation;
    return { ...observation, ...Object.fromEntries(missing.map(field => [field, consensus[field]])), issue: null,
      numberRecovery: { fields: missing, samples: votes, pixels: contrast ? 'contrast' : this.gain===1 && observation.dimmed ? 'original' : 'normalized' } };
  }
}
