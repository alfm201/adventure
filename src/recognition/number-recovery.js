const WIDTH = 1234;
const PATCHES = { position: ['score', 74, 55, 51, 21], diceUsed: ['dice', 131, 662, 28, 21] };
const OFFSETS = [[0, 0], [-.25, 0], [.25, 0], [0, -.25], [0, .25], [-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]];

// Supplemental sampling only. Keep GameRecognizer.number and its templates,
// confidence/margin thresholds and original successful readings untouched.
export class NumberRecovery {
  constructor(recognizer) {
    this.recognizer = recognizer;
    this.gain = 1;
    this.reset();
  }
  reset() { this.key = null; this.count = 0; this.frame = null; }
  sample(source, rect, field, dx, dy) {
    const [kind, left, top, width, height] = PATCHES[field];
    const x = rect.x + (left + dx) * rect.scale, y = rect.y + (top + dy) * rect.scale;
    if (x < 0 || y < 0 || x + width * rect.scale > source.width || y + height * rect.scale > source.height) return null;
    if (!this.reader) {
      // Only number() is used on this reader. Optional probes/deck state are
      // neither read nor modified by the supplemental path.
      this.reader = Object.create(this.recognizer);
      this.reader.data = new Uint8ClampedArray(WIDTH * 694 * 4);
      this.patches = new Map();
    }
    let patch = this.patches.get(field);
    if (!patch) {
      const canvas = new OffscreenCanvas(width, height);
      patch = { canvas, context: canvas.getContext('2d', { willReadFrequently: true }) };
      this.patches.set(field, patch);
    }
    patch.context.drawImage(source, x, y, width * rect.scale, height * rect.scale, 0, 0, width, height);
    const pixels = patch.context.getImageData(0, 0, width, height).data;
    if (this.gain !== 1) for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] *= this.gain; pixels[i + 1] *= this.gain; pixels[i + 2] *= this.gain;
    }
    for (let row = 0; row < height; row++) this.reader.data.set(pixels.subarray(row * width * 4, (row + 1) * width * 4), ((top + row) * WIDTH + left) * 4);
    return this.reader.number(kind);
  }
  update(source, rect, observation, sourceFrame) {
    const missing = observation && Object.keys(PATCHES).filter(field => observation[field] == null);
    if (!rect || !observation?.visible || !['score', 'dice'].includes(observation.issue) ||
        !missing?.length || !Array.isArray(observation.hand) || typeof observation.bonusRoll !== 'boolean' ||
        observation.deck?.open || (observation.dimmed && !(observation.illumination >= 1.06 && observation.illumination <= 1.2)) ||
        observation.overlay || !Number.isFinite(observation.anchorScore) || observation.anchorScore <= .90 ||
        !Number.isFinite(rect.scale) || rect.scale < 1.05 || Math.abs(rect.scale - Math.round(rect.scale)) < .02) {
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
    let consensus = null, votes = 0;
    const seen = {};
    for (const [dx, dy] of OFFSETS) {
      const values = {};
      for (const field of Object.keys(PATCHES)) {
        const value = this.sample(source, rect, field, dx, dy);
        // A confident conflict with any original reading or another sampling
        // invalidates recovery, even if most other samplings agree.
        if (value != null && (observation[field] != null && value !== observation[field] || seen[field] != null && value !== seen[field])) {
          this.reset(); return observation;
        }
        if (value != null) seen[field] = value;
        values[field] = value;
      }
      if (Object.values(values).some(value => value == null)) continue;
      consensus ||= values; votes++;
    }
    if (votes < 3) { this.reset(); return observation; }
    const key = JSON.stringify([rect, observation.position, observation.diceUsed, observation.hand, observation.bonusRoll, consensus, type]);
    if (key !== this.key) { this.key = key; this.count = 0; this.frame = null; }
    this.count++; this.frame = { type, sequence };
    if (this.count < 2) return observation;
    return { ...observation, ...Object.fromEntries(missing.map(field => [field, consensus[field]])), issue: null,
      numberRecovery: { fields: missing, samples: votes } };
  }
}
