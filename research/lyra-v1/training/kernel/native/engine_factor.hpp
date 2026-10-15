#pragma once
#include "compact_factor.hpp"
struct Compact100: Compact {
  std::vector<double> hdIID;
  using Compact::Compact;
  inline double deckv(uint32_t deck,int r,int b)const{
    if(!r&&!b)return 0; int n=__builtin_popcount(deck); double sum=0; uint32_t bits=deck;
    while(bits){int id=__builtin_ctz(bits)+1;bits&=bits-1;sum+=DECK_COEFF[codec.idmap[id]];}
    return .6*std::min(1.,.7*(r+b)/n)*sum;
  }
  inline double leaf(const State&s)const{
    if(s.terminal())return s.p;int r=100-s.t;
    return val(r,s.b,s.p,codec.hand(s),s.n)+deckv(s.deck,r,s.b);
  }
};
struct Meta {
 struct SmallRemove{uint32_t mask=0;int values[5]={};int&operator[](int c){return values[__builtin_popcount(mask&((1u<<c)-1))];}int operator[](int c)const{return values[__builtin_popcount(mask&((1u<<c)-1))];}}; struct Hand{int n=0;SmallRemove remove;int*add=nullptr;};
 Compact100&M; std::vector<Hand> hands;std::vector<std::array<int,23>> adds;
 explicit Meta(Compact100&m):M(m),hands(80730),adds(14950){
  int c[5]={}; size_t visited=0;
  auto gen=[&](auto&&self,int at,int n,int lo)->void{
   if(at<n){for(int x=lo;x<=22;x++){c[at]=x;self(self,at+1,n,x);}return;}
   int h=M.codec.rank(c,n); if(h<0||h>=80730)throw std::runtime_error("hand rank"); auto&z=hands[h]; z.n=n; ++visited;for(int i=0;i<n;i++)z.remove.mask|=1u<<c[i];if(n<5)z.add=adds[h].data();
   for(int i=0;i<n;i++){int a[5],k=0;for(int j=0;j<n;j++)if(j!=i)a[k++]=c[j];z.remove[c[i]]=M.codec.rank(a,n-1);}
   if(n<5)for(int x=1;x<=22;x++){int a[5];std::copy(c,c+n,a);a[n]=x;std::sort(a,a+n+1);z.add[x]=M.codec.rank(a,n+1);}
  }; for(int n=0;n<=5;n++)gen(gen,0,n,1); if(visited!=80730)throw std::runtime_error("hand metadata");
 }
};
struct Counters {uint64_t calls=0,triggers=0,q3=0,v1=0,hits=0,misses=0,deck_builds=0,deck_hits=0;};
struct DeckCtx {uint32_t code=0;int n=0,k=0,c[22]={},count[22]={},nextn=0;double sum=0,after[22]={};};
#include "hd_tail.hpp"
struct SearchLimit{};
// HD_PATCHED
template<bool Flat> struct FastPlanner {
 Compact100&M;Meta&T; bool reuse,deckcache;std::string policy; Counters stat; struct DeckSlot {uint32_t key=0;DeckCtx value;}; std::vector<DeckSlot> decks; DeckCtx scratch;
 std::unordered_map<uint64_t,double,KeyHash> maps[3];
 struct Entry {uint64_t key=0;double value=0;uint32_t gen=0;};
 std::vector<Entry> tt[3]; uint32_t epoch=1;
 FastPlanner(Compact100&m,Meta&t,std::string p,bool r,bool dc=false):M(m),T(t),reuse(r),deckcache(dc),policy(std::move(p)){if(dc)decks.resize(4096);if constexpr(Flat){tt[1].resize(1<<16);tt[2].resize(1<<14);}else{maps[1].reserve(8192);maps[2].reserve(1024);}}
 void clear(){if constexpr(Flat){if(++epoch==0){for(int d=1;d<=2;d++)for(auto&e:tt[d])e.gen=0;epoch=1;}}else{maps[1].clear();maps[2].clear();}}
 bool get(uint64_t key,int d,double&v){if constexpr(Flat){auto&e=tt[d][KeyHash{}(key)&(tt[d].size()-1)];if(e.gen!=epoch||e.key!=key)return false;v=e.value;return true;}else{auto it=maps[d].find(key);if(it==maps[d].end())return false;v=it->second;return true;}}
 void put(uint64_t key,int d,double v){if constexpr(Flat){auto&e=tt[d][KeyHash{}(key)&(tt[d].size()-1)];e={key,v,epoch};}else maps[d].emplace(key,v);}
 double deckSum(uint32_t bits)const{double sum=0;while(bits){int id=__builtin_ctz(bits)+1;bits&=bits-1;sum+=DECK_COEFF[M.codec.idmap[id]];}return sum;}
 DeckCtx makeContext(uint32_t deck)const{
  DeckCtx z; int cnt[23]={},rep[23]={};uint32_t bits=deck; z.n=__builtin_popcount(deck);z.sum=deckSum(deck);z.nextn=z.n==1?30:z.n-1;
  while(bits){int bit=__builtin_ctz(bits);bits&=bits-1;int c=M.codec.idmap[bit+1];cnt[c]++;rep[c]=bit;z.code+=M.codec.stride[c];}
  for(int c=1;c<=22;c++)if(cnt[c]){int k=z.k++;z.c[k]=c;z.count[k]=cnt[c];uint32_t after=deck&~(1u<<rep[c]);if(!after)after=0x3fffffff;z.after[k]=deckSum(after);}return z;
 }
 const DeckCtx& context(uint32_t deck){if(deckcache){auto&z=decks[KeyHash{}(deck)&(decks.size()-1)];if(z.key==deck){stat.deck_hits++;return z.value;}stat.deck_builds++;z.value=makeContext(deck);z.key=deck;return z.value;}stat.deck_builds++;scratch=makeContext(deck);return scratch;}
 inline double potential(double sum,int n,int r,int b)const{if(!r&&!b)return 0;return .6*std::min(1.,.7*(r+b)/n)*sum;}
 inline double after1(int h,int r,int b,int code,const DeckCtx&z)const{
  int p=code&4095;if(!r&&!b)return p;const auto&hm=T.hands[h];
  if(!(code&4096)||hm.n==5)return M.val(r,b,p,h,hm.n)+potential(z.sum,z.n,r,b);
  long double sum=0;for(int j=0;j<z.k;j++){int hn=hm.add[z.c[j]];double leaf=M.val(r,b,p,hn,hm.n+1)+potential(z.after[j],z.nextn,r,b);sum+=(long double)z.count[j]*leaf;}return (double)(sum/z.n);
 }
 double q1(const State&s,int a,int h,const DeckCtx&z)const{
  int id=a?s.h[a-1]:0;int hand=id?T.hands[h].remove[M.codec.idmap[id]]:h;int r=100-s.t;
  if(id&&CTYPE[id]!=2)return after1(hand,r,s.b,CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3],z);
  long double sum=0;for(int sm=2;sm<=12;sm++){int ways=6-abs(7-sm),dbl=!s.b&&(sm%2==0),code=id?LAND[s.p+CVAL[id]*sm+3]:ROLL[s.p*11+sm-2];if(ways-dbl)sum+=(ways-dbl)*after1(hand,r-!s.b,0,code,z);if(dbl)sum+=after1(hand,r-1,1,code,z);}return (double)(sum/36.0L);
 }
 double V(const State&s,int dep,int hand=-1){
  if(s.terminal())return s.p;if(dep==0)return M.leaf(s);int h=hand>=0?hand:M.codec.hand(s);const DeckCtx&dctx=context(s.deck);
  uint64_t key=uint64_t(s.p)|(uint64_t(100-s.t)<<12)|(uint64_t(s.b)<<19)|(uint64_t(h)<<20)|(uint64_t(dctx.code)<<37);double best;
  if(get(key,dep,best)){stat.hits++;return best;}stat.misses++;best=-1e300;uint32_t seen=0;
  if(dep==1){stat.v1++;const DeckCtx&z=dctx;for(int a=0;a<=s.n;a++){int c=a?M.codec.idmap[s.h[a-1]]:0;if(seen&(1u<<c))continue;seen|=1u<<c;best=std::max(best,q1(s,a,h,z));}}
  else for(int a=0;a<=s.n;a++){int c=a?M.codec.idmap[s.h[a-1]]:0;if(seen&(1u<<c))continue;seen|=1u<<c;best=std::max(best,Q(s,a,dep,h));}
  put(key,dep,best);return best;
 }
 double landed(State z,int code,int dep,int hand){
  z.p=code&4095;if(z.terminal())return z.p;if(!(code&4096)||z.n==5)return V(z,dep,hand);
  int count[23]={},rep[23]={};uint32_t bits=z.deck;while(bits){int bit=__builtin_ctz(bits);bits&=bits-1;int c=M.codec.idmap[bit+1];count[c]++;rep[c]=bit;}
  int nn=__builtin_popcount(z.deck);long double sum=0;for(int c=1;c<=22;c++)if(count[c]){State y=z;int bit=rep[c];y.h[y.n++]=bit+1;y.deck&=~(1u<<bit);if(!y.deck)y.deck=0x3fffffff;sum+=(long double)count[c]*V(y,dep,T.hands[hand].add[c]);}return (double)(sum/nn);
 }
 double Q(const State&s,int a,int dep,int hand=-1){
  if(hand<0)hand=M.codec.hand(s);
  if(dep==1){const DeckCtx&z=context(s.deck);return q1(s,a,hand,z);}
  State z=s;int id=0;if(a){id=z.h[a-1];for(int j=a;j<z.n;j++)z.h[j-1]=z.h[j];--z.n;}
  int nextHand=id?T.hands[hand].remove[M.codec.idmap[id]]:hand;
  if(id&&CTYPE[id]!=2)return landed(z,CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3],dep-1,nextHand);
  long double sum=0;for(int sm=2;sm<=12;sm++){int ways=6-abs(7-sm),dbl=!s.b&&(sm%2==0),code=id?LAND[s.p+CVAL[id]*sm+3]:ROLL[s.p*11+sm-2];if(ways-dbl){State y=z;y.t=s.t+!s.b;y.b=0;sum+=(ways-dbl)*landed(y,code,dep-1,nextHand);}if(dbl){State y=z;y.t=s.t+1;y.b=1;sum+=landed(y,code,dep-1,nextHand);}}return (double)(sum/36.0L);
 }
 int act(const State&s){
  stat.calls++;if(!s.n)return 0;clear();int hand=M.codec.hand(s);struct A{int a;double q;};std::vector<A>v;v.reserve(6);double best=-1e300,second=-1e300;int ans=0;uint32_t seen=0;
  for(int a=0;a<=s.n;a++){int c=a?M.codec.idmap[s.h[a-1]]:0;if(seen&(1u<<c))continue;seen|=1u<<c;double q=Q(s,a,2,hand);v.push_back({a,q});if(q>best){second=best;best=q;ans=a;}else if(q>second)second=q;}
  double threshold=(policy=="full05")?.5:(policy=="full2"||policy=="top2_2")?2.:1.;
  if(policy=="base"||best-second>threshold)return ans;stat.triggers++;if(!reuse)clear();
  best=-1e300;if(policy=="top2_1"||policy=="top2_2"){std::sort(v.begin(),v.end(),[](const A&x,const A&y){return x.q>y.q;});for(int i=0;i<std::min<int>(2,v.size());i++){double q=Q(s,v[i].a,3,hand);stat.q3++;if(q>best){best=q;ans=v[i].a;}}}
  else for(const auto&x:v){double q=Q(s,x.a,3,hand);stat.q3++;if(q>best){best=q;ans=x.a;}}
  return ans;
 }
};


template<bool Flat> struct OptPlanner {
 Compact100&M;Meta&T; HDTail hd;double gamma=0;
 uint64_t budget=0,used=0;void setBudget(uint64_t n){budget=n;used=0;}
 void spend(){if(budget&&used++>=budget)throw SearchLimit{};}
 bool rawMode=false;bool reuse,deckcache;std::string policy; Counters stat; struct DeckSlot {uint32_t key=0;DeckCtx value;}; std::vector<DeckSlot> decks; DeckCtx scratch;
 std::unordered_map<uint64_t,double,KeyHash> maps[4];
 struct Entry {uint64_t key=0;double value=0;uint32_t gen=0;};
 std::vector<Entry> tt[4]; uint32_t epoch=1;
 OptPlanner(Compact100&m,Meta&t,std::string p,bool r,bool dc=false):M(m),T(t),hd(m,t),reuse(r),deckcache(dc),policy(std::move(p)){if(dc)decks.resize(4096);if constexpr(Flat){tt[1].resize(1<<16);tt[2].resize(1<<14);tt[3].resize(1<<12);}else{maps[1].reserve(8192);maps[2].reserve(1024);}}
 void clear(){if(OPT&1)return;if constexpr(Flat){if(++epoch==0){for(int d=1;d<=3;d++)for(auto&e:tt[d])e.gen=0;epoch=1;}}else{maps[1].clear();maps[2].clear();}}
 bool get(uint64_t key,int d,double&v){if constexpr(Flat){auto&e=tt[d][KeyHash{}(key)&(tt[d].size()-1)];if(e.gen!=epoch||e.key!=key)return false;v=e.value;return true;}else{auto it=maps[d].find(key);if(it==maps[d].end())return false;v=it->second;return true;}}
 void put(uint64_t key,int d,double v){if constexpr(Flat){auto&e=tt[d][KeyHash{}(key)&(tt[d].size()-1)];e={key,v,epoch};}else maps[d].emplace(key,v);}
 double deckSum(uint32_t bits)const{double sum=0;while(bits){int id=__builtin_ctz(bits)+1;bits&=bits-1;sum+=DECK_COEFF[M.codec.idmap[id]];}return sum;}
 DeckCtx makeContext(uint32_t deck)const{
  DeckCtx z; int cnt[23]={},rep[23]={};uint32_t bits=deck; z.n=__builtin_popcount(deck);z.sum=deckSum(deck);z.nextn=z.n==1?30:z.n-1;
  while(bits){int bit=__builtin_ctz(bits);bits&=bits-1;int c=M.codec.idmap[bit+1];cnt[c]++;rep[c]=bit;z.code+=M.codec.stride[c];}
  for(int c=1;c<=22;c++)if(cnt[c]){int k=z.k++;z.c[k]=c;z.count[k]=cnt[c];uint32_t after=deck&~(1u<<rep[c]);if(!after)after=0x3fffffff;z.after[k]=deckSum(after);}return z;
 }
 const DeckCtx& context(uint32_t deck){if(deckcache){auto&z=decks[KeyHash{}(deck)&(decks.size()-1)];if(z.key==deck){stat.deck_hits++;return z.value;}stat.deck_builds++;z.value=makeContext(deck);z.key=deck;return z.value;}stat.deck_builds++;scratch=makeContext(deck);return scratch;}
 inline double potential(double sum,int n,int r,int b)const{if(!r&&!b)return 0;return .6*std::min(1.,.7*(r+b)/n)*sum;}
 struct DrawEntry{uint64_t key=~0ULL;double value=0;}; mutable std::vector<DrawEntry> drawcache;
 inline double after1(int h,int r,int b,int code,const DeckCtx&z)const{
  int p=code&4095;if(!r&&!b)return p;const auto&hm=T.hands[h];
  if(!(code&4096)||hm.n==5)return M.val(r,b,p,h,hm.n)+potential(z.sum,z.n,r,b)+(gamma?gamma*hd.value(r,b,p,h,z):0);
  uint64_t key=uint64_t(p)|(uint64_t(r)<<12)|(uint64_t(b)<<19)|(uint64_t(h)<<20)|(uint64_t(z.code)<<37); if((OPT&4)&&!rawMode){if(drawcache.empty())drawcache.resize(32768);auto&e=drawcache[KeyHash{}(key)&32767];if(e.key==key)return e.value;}
  if((OPT&4096)&&!rawMode){long double pot=0;for(int j=0;j<z.k;j++)pot+=(long double)z.count[j]*potential(z.after[j],z.nextn,r,b);double result=M.expectedDraw(r,b,p,h,hm,z)+double(pot/z.n)+(gamma?gamma*hd.value(r,b,p,h,z,true):0);if((OPT&4)&&!rawMode)drawcache[KeyHash{}(key)&32767]={key,result};return result;}
  long double sum=0;for(int j=0;j<z.k;j++){int hn=hm.add[z.c[j]];double leaf=M.val(r,b,p,hn,hm.n+1)+potential(z.after[j],z.nextn,r,b);if(gamma){const auto next=HDTail::nextDeck(z,z.c[j],M);leaf+=gamma*hd.value(r,b,p,hn,next);}sum+=(long double)z.count[j]*leaf;}double result=(double)(sum/z.n);if((OPT&4)&&!rawMode)drawcache[KeyHash{}(key)&32767]={key,result};return result;
 }
 double q1(const State&s,int a,int h,const DeckCtx&z)const{
  int id=a?s.h[a-1]:0;int hand=id?T.hands[h].remove[M.codec.idmap[id]]:h;int r=100-s.t;
  if(id&&CTYPE[id]!=2)return after1(hand,r,s.b,CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3],z);
  long double sum=0;for(int sm=2;sm<=12;sm++){int ways=6-abs(7-sm),dbl=!s.b&&(sm%2==0),code=id?LAND[s.p+CVAL[id]*sm+3]:ROLL[s.p*11+sm-2];if(ways-dbl)sum+=(ways-dbl)*after1(hand,r-!s.b,0,code,z);if(dbl)sum+=after1(hand,r-1,1,code,z);}return (double)(sum/36.0L);
 }
 double V(const State&s,int dep,int hand=-1){
  if(s.terminal())return s.p;if(dep==0){const auto dc=context(s.deck);return M.leaf(s)+(gamma?gamma*hd.value(100-s.t,s.b,s.p,M.codec.hand(s),dc):0);}int h=hand>=0?hand:M.codec.hand(s);const DeckCtx&dctx=context(s.deck);
  uint64_t key=uint64_t(s.p)|(uint64_t(100-s.t)<<12)|(uint64_t(s.b)<<19)|(uint64_t(h)<<20)|(uint64_t(dctx.code)<<37);double best;
  if(get(key,dep,best)){stat.hits++;return best;}stat.misses++;spend();best=-1e300;uint32_t seen=0;
  if(dep==1){stat.v1++;const DeckCtx&z=dctx;for(int a=0;a<=s.n;a++){int c=a?M.codec.idmap[s.h[a-1]]:0;if(seen&(1u<<c))continue;seen|=1u<<c;best=std::max(best,q1(s,a,h,z));}}
  else for(int a=0;a<=s.n;a++){int c=a?M.codec.idmap[s.h[a-1]]:0;if(seen&(1u<<c))continue;seen|=1u<<c;best=std::max(best,Q(s,a,dep,h));}
  put(key,dep,best);return best;
 }
 double landed(State z,int code,int dep,int hand){
  z.p=code&4095;if(z.terminal())return z.p;if(!(code&4096)||z.n==5)return V(z,dep,hand);
  int count[23]={},rep[23]={};uint32_t bits=z.deck;while(bits){int bit=__builtin_ctz(bits);bits&=bits-1;int c=M.codec.idmap[bit+1];count[c]++;rep[c]=bit;}
  int nn=__builtin_popcount(z.deck);long double sum=0;for(int c=1;c<=22;c++)if(count[c]){State y=z;int bit=rep[c];y.h[y.n++]=bit+1;y.deck&=~(1u<<bit);if(!y.deck)y.deck=0x3fffffff;sum+=(long double)count[c]*V(y,dep,T.hands[hand].add[c]);}return (double)(sum/nn);
 }
 double Q(const State&s,int a,int dep,int hand=-1){
  if(hand<0)hand=M.codec.hand(s);
  if(dep==1){const DeckCtx&z=context(s.deck);return q1(s,a,hand,z);}
  State z=s;int id=0;if(a){id=z.h[a-1];for(int j=a;j<z.n;j++)z.h[j-1]=z.h[j];--z.n;}
  int nextHand=id?T.hands[hand].remove[M.codec.idmap[id]]:hand;
  if(id&&CTYPE[id]!=2)return landed(z,CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3],dep-1,nextHand);
  long double sum=0;for(int sm=2;sm<=12;sm++){int ways=6-abs(7-sm),dbl=!s.b&&(sm%2==0),code=id?LAND[s.p+CVAL[id]*sm+3]:ROLL[s.p*11+sm-2];if(ways-dbl){State y=z;y.t=s.t+!s.b;y.b=0;sum+=(ways-dbl)*landed(y,code,dep-1,nextHand);}if(dbl){State y=z;y.t=s.t+1;y.b=1;sum+=landed(y,code,dep-1,nextHand);}}return (double)(sum/36.0L);
 }
 int act(const State&s){
  stat.calls++;if(!s.n)return 0;clear();int hand=M.codec.hand(s);struct A{int a;double q;};std::vector<A>v;v.reserve(6);double best=-1e300,second=-1e300;int ans=0;uint32_t seen=0;
  for(int a=0;a<=s.n;a++){int c=a?M.codec.idmap[s.h[a-1]]:0;if(seen&(1u<<c))continue;seen|=1u<<c;double q=Q(s,a,2,hand);v.push_back({a,q});if(q>best){second=best;best=q;ans=a;}else if(q>second)second=q;}
  double threshold=(policy=="full05")?.5:(policy=="full2"||policy=="top2_2")?2.:1.;
  if(policy=="base"||best-second>threshold)return ans;stat.triggers++;if(!reuse)clear();
  best=-1e300;if(policy=="top2_1"||policy=="top2_2"){std::sort(v.begin(),v.end(),[](const A&x,const A&y){return x.q>y.q;});for(int i=0;i<std::min<int>(2,v.size());i++){double q=Q(s,v[i].a,3,hand);stat.q3++;if(q>best){best=q;ans=v[i].a;}}}
  else for(const auto&x:v){double q=Q(s,x.a,3,hand);stat.q3++;if(q>best){best=q;ans=x.a;}}
  return ans;
 }
};
