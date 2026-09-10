export function createPredictor(model) {
  const trees=model.trees.map(t=>({f:Int16Array.from(t.feature),threshold:Float64Array.from(t.threshold),left:Uint16Array.from(t.left),right:Uint16Array.from(t.right),value:Float64Array.from(t.value)}));
  return function predictFinalScore(q,features) {
    let correction=model.baseline;
    for(const t of trees){let n=0;while(t.f[n]>=0)n=features[t.f[n]]<=t.threshold[n]?t.left[n]:t.right[n];correction+=t.value[n];}
    return q+correction;
  };
}
