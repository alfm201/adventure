#pragma once
#include <map>
#include <set>
#include <atomic>
#include <thread>
#include <mutex>
#include <iomanip>
#include <windows.h>
#include "native/hinge.hpp"
struct Branch{State s;double prob;};
std::vector<Branch> branches(const State&s,int a,const Codec&c,bool literal=false){
 std::vector<Branch>v;if(s.terminal()){v.push_back({s,1});return v;}State z=s;int id=0;if(a){id=z.h[a-1];for(int j=a;j<z.n;j++)z.h[j-1]=z.h[j];--z.n;}
 auto landed=[&](State y,int code,double prob){y.p=code&4095;if(!(code&4096)||y.n==5){v.push_back({y,prob});return;}int counts[23]={},rep[23]={};int n=__builtin_popcount(y.deck);for(int j=1;j<=30;j++)if(y.deck&(1u<<(j-1))){if(literal){State w=y;w.h[w.n++]=j;w.deck&=~(1u<<(j-1));if(!w.deck)w.deck=0x3fffffff;v.push_back({w,prob/n});}else{int cl=c.idmap[j];counts[cl]++;rep[cl]=j;}}if(!literal)for(int cl=1;cl<=22;cl++)if(counts[cl]){State w=y;w.h[w.n++]=rep[cl];w.deck&=~(1u<<(rep[cl]-1));if(!w.deck)w.deck=0x3fffffff;v.push_back({w,prob*counts[cl]/n});}};
 if(id&&CTYPE[id]!=2)landed(z,CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3],1);
 else if(literal){for(int d1=1;d1<=6;d1++)for(int d2=1;d2<=6;d2++){State y=z;if(s.b)y.b=0;else{y.b=d1==d2;++y.t;}landed(y,id?LAND[s.p+CVAL[id]*(d1+d2)+3]:ROLL[s.p*11+d1+d2-2],1./36);}}
 else for(int sm=2;sm<=12;sm++){int ways=6-abs(7-sm),dbl=!s.b&&(sm%2==0),code=id?LAND[s.p+CVAL[id]*sm+3]:ROLL[s.p*11+sm-2];if(ways-dbl){State y=z;y.t=s.t+!s.b;y.b=0;landed(y,code,double(ways-dbl)/36);}if(dbl){State y=z;y.t=s.t+1;y.b=1;landed(y,code,1./36);}}
 return v;
}
// Preserve core.hpp's physical transitions, including the harmless final draw.
template<class R> void sample_step(State&s,int a,R&r){
 if(s.terminal())return;
 if(a<0||a>s.n)throw std::runtime_error("illegal action");
 int id=0;if(a){id=s.h[a-1];for(int j=a;j<s.n;j++)s.h[j-1]=s.h[j];--s.n;}
 int code;
 if(!id||CTYPE[id]==2){int d1=r.dice()+1,d2=r.dice()+1;
  if(s.b)s.b=0;else{s.b=d1==d2;++s.t;}
  code=id?LAND[s.p+CVAL[id]*(d1+d2)+3]:ROLL[s.p*11+d1+d2-2];
 }else code=CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3];
 s.p=code&4095;
 if((code&4096)&&s.n<5){int bit=nthbit(s.deck,r.card(__builtin_popcount(s.deck)));s.h[s.n++]=bit+1;s.deck&=~(1u<<bit);if(!s.deck)s.deck=0x3fffffff;}
}
uint64_t split64(uint64_t x){x+=0x9e3779b97f4a7c15ULL;x=(x^(x>>30))*0xbf58476d1ce4e5b9ULL;x=(x^(x>>27))*0x94d049bb133111ebULL;return x^(x>>31);}
struct Tape{
 RNG joint;uint64_t key,di=0,ci=0;int mode;
 Tape(uint32_t seed,int md,int policy=0):joint(seed),key(seed),mode(md){if(mode==2)key=split64(key^(uint64_t(policy+1)*0xa0761d6478bd642fULL));}
 uint32_t word(uint64_t domain,uint64_t index){return uint32_t(split64(key^domain^(index*0x9e3779b97f4a7c15ULL))>>32);}
 int dice(){return mode?int(uint64_t(word(0x243f6a8885a308d3ULL,di++))*6>>32):joint.pick(6);}
 int card(int n){return mode?int(uint64_t(word(0x13198a2e03707344ULL,ci++))*n>>32):joint.pick(n);}
};
double leaf_expect(const State&s,int a,Compact100&M,bool physical=false){long double z=0;for(auto&b:branches(s,a,M.codec,physical))z+=(long double)b.prob*M.leaf(b.s);return double(z);}
