#pragma once
struct Limit{};
struct DKey{uint64_t key;int budget;bool operator==(const DKey&o)const{return key==o.key&&budget==o.budget;}};
struct DHash{size_t operator()(const DKey&x)const{return KeyHash{}(x.key^(uint64_t(x.budget+1)*0x9e3779b97f4a7c15ULL));}};
enum class Stop {Decision,Draw,Terminal};
struct ExactDP{
 Compact100&M;Stop stop;bool potential=true,ungrouped=false,iid=false;size_t cap=200000,nodes=0,hits=0;int maxdepth=0;bool verifyRank=false;
 std::unordered_map<DKey,double,DHash> memo;
 ExactDP(Compact100&m,Stop st,size_t lim=200000,bool pot=true):M(m),stop(st),potential(pot),cap(lim){memo.reserve(std::min<size_t>(lim,65536));}
 void clear(){memo.clear();nodes=hits=0;maxdepth=0;}
 static long long rank(const State&s){int k=0;for(int j=0;j<s.n;j++)k+=CTYPE[s.h[j]]==2;for(uint32_t b=s.deck;b;b&=b-1)k+=CTYPE[__builtin_ctz(b)+1]==2;return 10LL*(100-s.t)+5*s.b+s.n+__builtin_popcount(s.deck)-5*k+44;}
 double tail(const State&s)const{if(s.terminal())return s.p;return M.val(100-s.t,s.b,s.p,M.codec.hand(s),s.n)+(potential?M.deckv(s.deck,100-s.t,s.b):0);}
 double V(const State&s,int budget,int level=0){
  if(s.terminal())return s.p;if(stop!=Stop::Terminal&&budget==0)return tail(s);
  auto key=DKey{M.codec.key(s),budget};auto it=memo.find(key);if(it!=memo.end()){hits++;return it->second;}
  if(nodes++>=cap)throw Limit{};maxdepth=std::max(maxdepth,level);if(level>1100)throw std::runtime_error("recursion rank bound");
  double v=-1e300;uint32_t seen=0;for(int a=0;a<=s.n;a++){int c=a?M.codec.idmap[s.h[a-1]]:0;if(seen&(1u<<c))continue;seen|=1u<<c;v=std::max(v,Q(s,a,budget,level));}
  memo.emplace(key,v);return v;
 }
 double land(State z,int code,int budget,int level,long long parentRank){
  z.p=code&4095;if(z.terminal())return z.p;
  auto descend=[&](const State&y,int b){if(verifyRank&&!iid&&rank(y)>=parentRank)throw std::runtime_error("nondecreasing rank");return V(y,b,level+1);};
  if(!(code&4096)||z.n==5)return descend(z,budget);
  int next=budget-(stop==Stop::Draw?1:0);if(iid){long double sum=0;for(int c=1;c<=22;c++){State y=z;y.h[y.n++]=M.codec.representative[c];sum+=M.codec.capacity[c]*descend(y,next);}return double(sum/30.L);}
  int counts[23]={},rep[23]={};uint32_t bits=z.deck;
  if(ungrouped){long double sum=0;int nn=__builtin_popcount(bits);while(bits){int bit=__builtin_ctz(bits);bits&=bits-1;State y=z;y.h[y.n++]=bit+1;y.deck&=~(1u<<bit);if(!y.deck)y.deck=0x3fffffff;sum+=descend(y,next);}return double(sum/nn);}
  while(bits){int bit=__builtin_ctz(bits);bits&=bits-1;int c=M.codec.idmap[bit+1];counts[c]++;rep[c]=bit;}
  long double sum=0;int nn=__builtin_popcount(z.deck);for(int c=1;c<=22;c++)if(counts[c]){State y=z;y.h[y.n++]=rep[c]+1;y.deck&=~(1u<<rep[c]);if(!y.deck)y.deck=0x3fffffff;sum+=(long double)counts[c]*descend(y,next);}return double(sum/nn);
 }
 double Q(const State&s,int a,int budget,int level=0){
  State z=s;int id=0;if(a){id=z.h[a-1];for(int j=a;j<z.n;j++)z.h[j-1]=z.h[j];--z.n;}
  int next=budget-(stop==Stop::Decision?1:0);auto rr=rank(s);
  if(id&&CTYPE[id]!=2)return land(z,CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3],next,level,rr);
  long double sum=0;if(ungrouped){for(int d1=1;d1<=6;d1++)for(int d2=1;d2<=6;d2++){State y=z;if(y.b)y.b=0;else{y.t++;y.b=d1==d2;}sum+=land(y,id?LAND[s.p+CVAL[id]*(d1+d2)+3]:ROLL[s.p*11+d1+d2-2],next,level,rr);}return double(sum/36.L);}
  for(int d=2;d<=12;d++){int ways=6-abs(7-d),dbl=!s.b&&(d%2==0);int code=id?LAND[s.p+CVAL[id]*d+3]:ROLL[s.p*11+d-2];if(ways-dbl){State y=z;y.t=s.t+!s.b;y.b=0;sum+=(ways-dbl)*land(y,code,next,level,rr);}if(dbl){State y=z;y.t=s.t+1;y.b=1;sum+=land(y,code,next,level,rr);}}return double(sum/36.L);
 }
 int inspect(const State&s,int budget,double&q,std::array<double,6>&qs){clear();q=-1e300;int ans=0;uint32_t seen=0;qs.fill(-1e300);for(int a=0;a<=s.n;a++){int c=a?M.codec.idmap[s.h[a-1]]:0;if(seen&(1u<<c))continue;seen|=1u<<c;qs[a]=Q(s,a,budget);if(qs[a]>q){q=qs[a];ans=a;}}return ans;}
};
