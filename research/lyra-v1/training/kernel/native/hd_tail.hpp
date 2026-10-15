#pragma once
// Fixed-capacity features for the centered contrast of a FUTURE unexpanded draw.
// This is a heuristic leaf value, not a correction to an already-expanded draw.
struct HDTail {
 Compact100&M;Meta&T;
 struct Feature {uint64_t key=~0ULL;double v[275+Compact100::MaxK]={};};
 mutable std::vector<Feature> cache;
 mutable uint64_t builds=0,hits=0;
 HDTail(Compact100&m,Meta&t):M(m),T(t){}
 static void prepare(Compact100&m,Meta&t){
  if(m.L)throw std::runtime_error("HD unsupported for local residual models");
  // Shared bases may have nonzero singleton values; feature() centers them explicitly.
  m.hdIID.resize(14950*m.K);
  for(int h=0;h<14950;h++)for(int c=1;c<=22;c++)for(int k=0;k<m.K;k++)m.hdIID[size_t(h)*m.K+k]+=double(m.codec.capacity[c])/30*m.phiValue(t.hands[h].add[c],k);
 }
 static DeckCtx nextDeck(const DeckCtx&dc,int drawn,Compact100&M){
  DeckCtx z;z.n=dc.n==1?30:dc.n-1;z.nextn=z.n==1?30:z.n-1;
  int cnt[23]={};if(dc.n==1){for(int c=1;c<=22;c++)cnt[c]=M.codec.capacity[c];}
  else{for(int j=0;j<dc.k;j++)cnt[dc.c[j]]=dc.count[j];--cnt[drawn];}
  for(int c=1;c<=22;c++)if(cnt[c]){int j=z.k++;z.c[j]=c;z.count[j]=cnt[c];z.code+=cnt[c]*M.codec.stride[c];}
  return z;
 }
 const Feature&feature(int h,const DeckCtx&dc,bool afterDraw=false)const{
  if(cache.empty())cache.resize(1024);
  uint64_t key=uint64_t(h)|(uint64_t(dc.code)<<17)|(uint64_t(afterDraw)<<63);
  size_t idx=KeyHash{}(key)&1023;
  if(cache[idx].key==key){++hits;return cache[idx];}
  ++builds;Feature out;out.key=key;int n=T.hands[h].n;
  if(afterDraw){
   if(n<4)for(int j=0;j<dc.k;j++){
    DeckCtx next=nextDeck(dc,dc.c[j],M);
    const auto&sub=feature(T.hands[h].add[dc.c[j]],next,false);
    double w=double(dc.count[j])/dc.n;
    for(int i=22;i<275+M.K;i++)out.v[i]+=w*sub.v[i];
   }
  }else if(n>0&&n<5&&dc.n<30){
   double w[23]={};for(int c=1;c<=22;c++)w[c]=-double(M.codec.capacity[c])/30;
   for(int j=0;j<dc.k;j++)w[dc.c[j]]+=double(dc.count[j])/dc.n;
   for(int c=1;c<=22;c++)if(w[c]!=0){
    for(int i=0;i<n;i++)out.v[M.pairIndex[M.sub[h][i]+1][c]]+=w[c];
   }
   for(int k=0;k<M.K;k++)out.v[275+k]=-M.hdIID[size_t(h)*M.K+k];
   for(int j=0;j<dc.k;j++){int hn=T.hands[h].add[dc.c[j]];double prob=double(dc.count[j])/dc.n;for(int k=0;k<M.K;k++)out.v[275+k]+=prob*M.phiValue(hn,k);}
   // Subtract the empty-hand contrast; old residual models have exact zero singleton phi.
   for(int k=0;k<M.K;k++){
    double center=0;for(int c=1;c<=22;c++)center+=w[c]*M.phiValue(T.hands[0].add[c],k);
    if(center!=0)out.v[275+k]-=center;
   }
}
  cache[idx]=out;return cache[idx];
 }
 double value(int r,int b,int p,int h,const DeckCtx&dc,bool afterDraw=false)const{
  int n=T.hands[h].n;if((!r&&!b)||(!afterDraw&&(!n||n==5))||(afterDraw&&n>=4))return 0;
  const auto&f=feature(h,dc,afterDraw);const auto&row=M.getRow(r,b,p);
  double v=0;for(int j=22;j<275+M.K;j++)v+=f.v[j]*row.v[j];
  int nd=afterDraw?dc.nextn:dc.n;
  return std::min(1.,.7*(r+b)/nd)*v;
 }
 double direct(int r,int b,int p,int h,const DeckCtx&dc)const{
  int n=T.hands[h].n;if((!r&&!b)||!n||n==5)return 0;
  double w[23]={};for(int c=1;c<=22;c++)w[c]=-double(M.codec.capacity[c])/30;
  for(int j=0;j<dc.k;j++)w[dc.c[j]]+=double(dc.count[j])/dc.n;
  double fh=M.val(r,b,p,h,n),f0=M.val(r,b,p,0,0);long double v=0;
  for(int c=1;c<=22;c++)v+=w[c]*(M.val(r,b,p,T.hands[h].add[c],n+1)-fh-M.val(r,b,p,T.hands[0].add[c],1)+f0);
  return std::min(1.,.7*(r+b)/dc.n)*double(v);
 }
};
