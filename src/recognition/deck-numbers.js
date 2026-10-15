// Physical list order. null means no language-invariant numeral: translated
// stage descriptions may include an ordinal digit, so they supply no evidence.
export const DECK_NUMBERS = Object.freeze([1,2,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,12,1,2,3,2,3,5,7,8,10,null,null]);

function runs(bits) {
  const out = [];
  for (let i = 0; i < bits.length;) {
    if (!bits[i]) { i++; continue; }
    const start = i; while (bits[i]) i++;
    out.push([start, i]);
  }
  return out;
}
function feature(mask, stride, left, top, right, bottom) {
  const result = new Float32Array(216), w = right - left, h = bottom - top;
  for (let y = 0; y < 18; y++) for (let x = 0; x < 12; x++) {
    const x0 = x*w/12, x1 = (x+1)*w/12, y0 = y*h/18, y1 = (y+1)*h/18;
    let sum = 0;
    for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++)
      for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++)
        sum += mask[(top+yy)*stride+left+xx] * (Math.min(x1,xx+1)-Math.max(x0,xx)) * (Math.min(y1,yy+1)-Math.max(y0,yy));
    result[y*12+x] = sum / ((x1-x0)*(y1-y0));
  }
  return result;
}
export class DeckNumbers {
  constructor(glyphs = []) {
    this.glyphs = glyphs.map(g => {
      const mask = new Uint8Array(g.width*g.height); for (const i of g.ink) mask[i] = 1;
      return { ...g, feature: feature(mask,g.width,0,0,g.width,g.height) };
    });
  }
  numbers(mask, width, top, bottom) {
    const columns = Array.from({ length: width }, (_, x) => {
      for (let y = top; y < bottom; y++) if (mask[y*width+x]) return true;
      return false;
    });
    const parts = runs(columns), digits = [];
    const classify = (left,right, weak=false) => {
      let t = bottom, b = top;
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) if (mask[y*width+x]) { t=Math.min(t,y);b=Math.max(b,y+1); }
      if (b-t < 7 || b-t > 14 || right-left > 8) return null;
      const f = feature(mask,width,left,t,right,b), scores = new Map();
      for (const g of this.glyphs) {
        // Preserve shape/aspect evidence; do not turn arbitrary narrow strokes
        // into a digit simply by stretching them to the normalized rectangle.
        let error = Math.abs((right-left)/(b-t)-g.width/g.height)*.3;
        for (let i = 0; i < f.length; i++) error += Math.abs(f[i]-g.feature[i])/f.length;
        scores.set(g.value,Math.min(scores.get(g.value) ?? Infinity,error));
      }
      const ranked = [...scores].sort((a,b) => a[1]-b[1]);
      if (ranked[0]?.[1] <= .16 && ranked[1][1]-ranked[0][1] >= .025)
        return { value: ranked[0][0], error: ranked[0][1], left, right, top:t, bottom:b };
      // Weak shape evidence can veto a truncated number, never supply its value.
      // Accepted digits still require the original .16/.025 confidence gates.
      return weak && ranked[0]?.[1]<=.23 ? { value:null, numeric:true, left, right, top:t, bottom:b } : null;
    };
    for (let i=0; i<parts.length; i++) {
      const [left,right]=parts[i], next=parts[i+1];
      const single=classify(left,right,true);
      // Downsampling can erase a thin digit's connecting pixels. Join only
      // a one-column interior gap when the complete glyph itself validates.
      const joined=next && next[0]-right<=1 ? classify(left,next[1]) : null;
      if (joined && (!single || single.value===null || joined.error<single.error)) {digits.push(joined);i++;}
      // Retain rejected component bounds: a failed second digit must not turn
      // 12 into 1, or a failed first digit turn it into 2.
      else digits.push(single || { value:null, left, right });
    }
    const values = new Set();
    for (let i = 0; i < digits.length; i++) {
      const d = digits[i]; if (d.value===null) continue;
      const next = digits[i+1], previous = digits[i-1];
      if (previous && previous.value!==null && d.left-previous.right <= 4) continue;
      // Only narrow neighbours can be an unread numeral; full-width language
      // glyphs beside a number are not part of that number.
      const suspect = part => part?.numeric && Math.abs(part.top-d.top)<=1 && part.bottom===d.bottom;
      if (previous?.value===null && suspect(previous) && d.left-previous.right<=4) continue;
      if (next && next.left-d.right <= 4 && (next.value!==null || suspect(next))) {
        const number = d.value*10+next.value;
        const third=digits[i+2];
        if (next.value!==null && d.value===1 && number<=12 && !(third && third.left-next.right<=4 && (third.value!==null || suspect(third)))) values.add(number);
      } else if (d.value>=1 && d.value<=9) values.add(d.value);
    }
    return [...values];
  }
  locate(mask, width, height) { return this.analyze(mask,width,height).identified || null; }
  analyze(mask, width, height) {
    const lines = Array.from({ length: height }, (_, y) => {
      let count = 0; for (let x = 0; x < width; x++) count += mask[y*width+x];
      return count > 4;
    });
    const bands = runs(lines).filter(([a,b]) => b-a>=7 && b-a<=16 && b<height && (a>0 || b-a>=10));
    if (bands.length<4) return { reason:'row-grid', seek:'adjust', bands:bands.length };
    // Rows remain physical slots even when their numerals cannot be read.
    // No alignment or scroll offset from the previous frame is reused.
    const phaseCounts = Array.from({length:30},(_,phase) => bands.filter(([y]) => {
      const d = Math.abs(y%30-phase); return Math.min(d,30-d)<=1;
    }).length);
    const phase = phaseCounts.indexOf(Math.max(...phaseCounts));
    const grid = bands.filter(([y]) => {const d=Math.abs(y%30-phase);return Math.min(d,30-d)<=1;});
    if (grid.length<4 || grid.length<bands.length*.8) return { reason:'row-grid', seek:'adjust', bands:bands.length, aligned:grid.length };
    const origin = grid[0][0], last = Math.round((grid.at(-1)[0]-origin)/30);
    if (last>=30) return { reason:'row-grid', seek:'adjust' };
    const observed = grid.map(([top,bottom]) => ({
      slot:Math.round((top-origin)/30), y:top, values:this.numbers(mask,width,top,bottom),
    }));
    const ranked = [];
    for (let start=0; start+last<30; start++) {
      let matches=0, conflicts=0;
      for (const row of observed) if (row.values.length) {
        const number=DECK_NUMBERS[start+row.slot];
        if (number===null) continue;
        if (row.values.includes(number)) matches++; else conflicts++;
      }
      ranked.push({start,matches,conflicts});
    }
    ranked.sort((a,b)=>a.conflicts-b.conflicts || b.matches-a.matches);
    const best=ranked[0];
    const candidates=ranked.filter(candidate=>candidate.conflicts===0);
    if (!best || best.conflicts || best.matches<4 || ranked[1] && ranked[1].conflicts<2) {
      // Seek fresh evidence outside this viewport. Candidate starts are only
      // guidance: no flags or row IDs are committed until the normal strict
      // full-window test succeeds on a new frame.
      const possible=ranked.filter(candidate=>candidate.conflicts<=1);
      return { reason:candidates.length?'ambiguous-numbers':'number-conflict',
        matches:best?.matches || 0, conflicts:best?.conflicts || 0,
        candidateStarts:possible.map(candidate=>candidate.start),
        seek:candidates.length?extensionDirection(possible,last):'adjust' };
    }
    return { reason:'identified', matches:best.matches, conflicts:0,
      identified:{ range:{start:best.start,end:best.start+last},
        rows:observed.map(row=>({index:best.start+row.slot,y:row.y})) } };
  }
}

function extensionDirection(candidates,last) {
  if (!candidates.length) return 'adjust';
  const choices=[];
  for (const direction of ['down','up']) {
    const room=candidates.map(({start})=>direction==='up'?start:29-start-last);
    const steps=Math.min(4,...room);
    if (steps<1) continue;
    const traces=candidates.map(({start})=>Array.from({length:steps},(_,i)=>
      DECK_NUMBERS[direction==='up'?start-i-1:start+last+i+1]));
    choices.push({ direction, diversity:new Set(traces.map(trace=>JSON.stringify(trace))).size,
      evidence:Math.min(...traces.map(trace=>trace.filter(value=>value!==null).length)) });
  }
  choices.sort((a,b)=>b.diversity-a.diversity || b.evidence-a.evidence);
  return choices[0]?.direction || 'adjust';
}
