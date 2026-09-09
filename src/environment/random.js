export function seededRandom(seed = 1) {
  let state = seed >>> 0;
  const random = () => {
    let t = (state = (state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  random.state = () => state;
  return random;
}
export function streamSeed(seed, action, index) {
  let x =
    (seed +
      Math.imul(action + 1, 0x9e3779b9) +
      Math.imul(index + 1, 0x85ebca6b)) >>>
    0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  return (x ^ (x >>> 15)) >>> 0;
}
export function freshSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
