// Text-free profile-frame edges sampled from the existing Korean reference UI.
// Four separated sides constrain scale and origin independently of the lower
// charge-panel structure. This is only used after the normal reader fails.
const EDGES = [[[50,5,0],[50,6,0],[50,7,234],[50,8,250],[50,9,250],[50,10,219],[50,11,0],[50,12,0],[80,5,0],[80,6,0],[80,7,176],[80,8,250],[80,9,250],[80,10,204],[80,11,0],[80,12,0],[110,5,0],[110,6,0],[110,7,162],[110,8,234],[110,9,234],[110,10,185],[110,11,0],[110,12,0],[140,5,0],[140,6,0],[140,7,234],[140,8,250],[140,9,250],[140,10,199],[140,11,0],[140,12,0],[170,5,0],[170,6,0],[170,7,219],[170,8,250],[170,9,250],[170,10,204],[170,11,0],[170,12,0]],[[6,50,0],[7,50,0],[8,50,250],[9,50,250],[10,50,229],[11,50,229],[12,50,0],[13,50,0],[6,100,0],[7,100,0],[8,100,227],[9,100,227],[10,100,219],[11,100,219],[12,100,0],[13,100,0],[6,150,0],[7,150,0],[8,150,244],[9,150,244],[10,150,244],[11,150,244],[12,150,0],[13,150,0],[6,200,0],[7,200,0],[8,200,234],[9,200,234],[10,200,234],[11,200,234],[12,200,0],[13,200,0]],[[198,50,227],[199,50,227],[200,50,209],[201,50,0],[202,50,0],[203,50,0],[204,50,0],[205,50,0],[198,100,239],[199,100,234],[200,100,244],[201,100,0],[202,100,0],[203,100,0],[204,100,0],[205,100,0],[198,150,244],[199,150,255],[200,150,255],[201,150,0],[202,150,0],[203,150,0],[204,150,0],[205,150,0],[198,200,219],[199,200,212],[200,200,229],[201,200,0],[202,200,0],[203,200,0],[204,200,0],[205,200,0]],[[50,275,189],[50,276,209],[50,277,214],[50,278,194],[50,279,0],[50,280,0],[50,281,0],[50,282,0],[80,275,185],[80,276,219],[80,277,224],[80,278,185],[80,279,0],[80,280,0],[80,281,0],[80,282,0],[110,275,194],[110,276,224],[110,277,239],[110,278,244],[110,279,0],[110,280,0],[110,281,0],[110,282,0],[140,275,194],[140,276,239],[140,277,244],[140,278,238],[140,279,0],[140,280,0],[140,281,0],[140,282,0],[170,275,194],[170,276,234],[170,277,229],[170,278,250],[170,279,0],[170,280,0],[170,281,0],[170,282,0]]];
const SHIFTS = [0, -.5, .5, -1, 1];

export function refineRegion(image, rect, recognizer) {
  if (!rect || !Number.isFinite(rect.scale) || rect.scale < .9) return null;
  const { data, width, height } = image, rgb = [0, 0, 0];
  let x, y, scale;
  const sample = (px, py) => {
    const sx = x + (px + .5) * scale - .5, sy = y + (py + .5) * scale - .5;
    const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
    if (ix < 0 || iy < 0 || ix + 1 >= width || iy + 1 >= height) return null;
    const at = (iy * width + ix) * 4;
    for (let c = 0; c < 3; c++) rgb[c] =
      (data[at+c]*(1-fx)+data[at+4+c]*fx)*(1-fy) +
      (data[at+width*4+c]*(1-fx)+data[at+width*4+4+c]*fx)*fy;
    return rgb;
  };
  let best = null;
  // At most three source pixels of panel-width uncertainty. Move the origin
  // around the measured profile center, rather than fixing a wrong scale.
  for (let step = -3; step <= 3; step += .5) {
    scale = rect.scale + step / 193;
    if (scale < .9) continue;
    for (const dy of SHIFTS) for (const dx of SHIFTS) {
      x = rect.x + (rect.scale-scale)*104.5 + dx*scale;
      y = rect.y + (rect.scale-scale)*143 + dy*scale;
      if (x < 0 || y < 0 || x + 1234*scale > width || y + 694*scale > height) continue;
      let profileScore = 1;
      for (const group of EDGES) {
        let error = 0;
        for (const [px, py, reference] of group) {
          const pixel = sample(px, py);
          if (!pixel) { error = Infinity; break; }
          const low = Math.min(...pixel), high = Math.max(...pixel);
          const level = Math.max(0, Math.min(1, (low-140)/115)) * Math.max(0, 1-(high-low)/80);
          error += Math.abs(level-reference/255);
        }
        profileScore = Math.min(profileScore, 1-error/group.length);
        if (profileScore <= .90) break;
      }
      if (profileScore <= .90) continue;
      const anchor = recognizer.anchor;
      const structureScore = recognizer.structureScore((px, py) => sample(anchor.x+px, anchor.y+py));
      const score = Math.min(profileScore, structureScore);
      if (score <= .90 || best && score <= best.score) continue;
      best = { x, y, width: 1234*scale, height: 694*scale, scale, score, profileScore, structureScore };
    }
  }
  return best;
}

export function compatibleRefinement(before, after) {
  if (!after?.visible || after.overlay || after.dimmed &&
      !(after.illumination >= 1.06 && after.illumination <= 1.2)) return false;
  const fields = ['position', 'diceUsed', 'hand', 'bonusRoll'];
  if (before?.visible) for (const field of fields) {
    if (before[field] != null && JSON.stringify(before[field]) !== JSON.stringify(after[field])) return false;
  }
  // Preserve every readable flag already established in the old geometry.
  if (before?.deck?.open && !after.deck?.open) return false;
  for (const row of before?.deck?.rows || []) {
    if (!after.deck?.rows?.some(r => r.index === row.index && r.obtained === row.obtained)) return false;
  }
  return !before?.visible || fields.some(field => before[field] == null && after[field] != null) ||
    (after.deck?.rows?.length || 0) > (before.deck?.rows?.length || 0);
}

export function advancingFrame(previous, current) {
  const identity = value => {
    const capture = typeof value === 'string' && /^capture:\d+$/.test(value);
    const sequence = capture ? Number(value.slice(8)) : value;
    return Number.isSafeInteger(sequence) && sequence >= 0 ? { capture, sequence } : null;
  };
  const a = identity(previous), b = identity(current);
  return !!(a && b && a.capture === b.capture && b.sequence > a.sequence);
}

// The fixed card-history panel has a 260 x 600 white connected outline at
// (229,14) in the 1234 x 694 game UI. Its long vertical baseline resolves
// subpixel scale errors that the smaller profile frame cannot distinguish.
// Geometry only: no card names, digit values or previously seen scroll offset.
export function refineDeckRegion(image, rect, recognizer) {
  if (!rect || !Number.isFinite(rect.scale) || rect.scale < .9) return null;
  const { data, width, height } = image, scale = rect.scale;
  const left = Math.max(0, Math.floor(rect.x + 217 * scale));
  const top = Math.max(0, Math.floor(rect.y + 2 * scale));
  const right = Math.min(width, Math.ceil(rect.x + 501 * scale));
  const bottom = Math.min(height, Math.ceil(rect.y + 626 * scale));
  const w = right-left, h = bottom-top;
  if (w <= 0 || h <= 0 || w*h > 1600000) return null;
  const mask = new Uint8Array(w*h), queue = new Int32Array(w*h);
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
    const at = ((top+y)*width+left+x)*4;
    const low = Math.min(data[at],data[at+1],data[at+2]);
    const high = Math.max(data[at],data[at+1],data[at+2]);
    mask[y*w+x] = +(low>205 && high-low<48);
  }
  const choices = [];
  for (let i=0; i<mask.length; i++) {
    if (!mask[i]) continue;
    let head=0, tail=1, l=w, r=0, t=h, b=0;
    queue[0]=i; mask[i]=0;
    while (head<tail) {
      const p=queue[head++], x=p%w, y=(p/w)|0;
      l=Math.min(l,x); r=Math.max(r,x); t=Math.min(t,y); b=Math.max(b,y);
      for (const next of [x?p-1:-1,x<w-1?p+1:-1,p-w,p+w]) {
        if (next>=0 && next<mask.length && mask[next]) {mask[next]=0;queue[tail++]=next;}
      }
    }
    if (l===0 || r===w-1 || t===0 || b===h-1) continue; // Cropped/connected outside panel.
    const pw=r-l+1, ph=b-t+1, fitted=ph/600, fill=tail/(pw*ph);
    if (Math.abs(ph-600*scale)>3 || Math.abs(pw-260*fitted)>1.5 || fill<.80 || fill>.96) continue;
    const x=left+l+(pw-260*fitted)/2-229*fitted, y=top+t-14*fitted;
    if (Math.abs(x-rect.x)>3*scale || Math.abs(y-rect.y)>3*scale ||
        x<0 || y<0 || x+1234*fitted>width || y+694*fitted>height) continue;
    const a=recognizer.anchor;
    const structureScore=recognizer.structureScore((px,py)=>{
      const sx=x+(a.x+px+.5)*fitted-.5, sy=y+(a.y+py+.5)*fitted-.5;
      const ix=Math.floor(sx), iy=Math.floor(sy), fx=sx-ix, fy=sy-iy;
      if (ix<0 || iy<0 || ix+1>=width || iy+1>=height) return [0,0,0];
      const at=(iy*width+ix)*4, rgb=[];
      for(let c=0;c<3;c++)rgb.push((data[at+c]*(1-fx)+data[at+4+c]*fx)*(1-fy)+
        (data[at+width*4+c]*(1-fx)+data[at+width*4+4+c]*fx)*fy);
      return rgb;
    });
    if (structureScore<=.90) continue;
    choices.push({x,y,width:1234*fitted,height:694*fitted,scale:fitted,
      structureScore,panel:{x:left+l,y:top+t,width:pw,height:ph}});
  }
  // Do not rank ambiguous panels by which one happens to yield readable digits.
  return choices.length===1 ? choices[0] : null;
}
