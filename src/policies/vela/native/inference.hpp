#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <vector>
#include <unordered_map>
#include <stdexcept>
#include "tables.hpp"
#include "deck-coefficients.hpp"
struct State {
 int p=1,t=0,b=0,n=0,h[5]={}; uint32_t deck=0x3fffffff;
 bool terminal()const{return t>=100&&!b;}
};
struct Classes {
 int K=0,idmap[31]={},types[31]={},values[31]={},freq[31]={};
 Classes(){for(int id=1;id<=30;id++){int c=1;for(;c<=K;c++)if(types[c]==CTYPE[id]&&values[c]==CVAL[id])break;if(c>K){K=c;types[c]=CTYPE[id];values[c]=CVAL[id];}idmap[id]=c;freq[c]++;}}
 template<class F> double diceExpectation(int r,int b,F f)const{
  double sum=0;for(int d=2;d<=12;d++){int w=6-abs(7-d),doub=(d%2==0);if(b)sum+=w*f(r,0,d);else{if(w-doub)sum+=(w-doub)*f(r-1,0,d);if(doub)sum+=f(r-1,1,d);}}return sum/36;}
};
struct PairModel {
 Classes classes; int M=276,R=24,pair[23][23]={}; const float* v;
 explicit PairModel(const char*data):v(reinterpret_cast<const float*>(data+4)){
  int horizon;std::memcpy(&horizon,data,4);if(horizon!=R)throw std::runtime_error("Invalid four-card model");
  int index=23;for(int c=1;c<=22;c++)for(int d=c;d<=22;d++)pair[c][d]=pair[d][c]=index++;
 }
 const float* row(int r,int b,int p)const{return v+((r*2+b)*(N+1)+p)*M;}
};
struct PairPolicy {
 double weight,pairScale;
 PairPolicy(PairModel&,double w,double ps,double,bool):weight(w),pairScale(ps){}
};
struct Codec {
 int idmap[31]={},representative[23]={},types[23]={},capacity[23]={},stride[23]={},K=0,comb[28][7]={};
 Codec(){for(int id=1;id<=30;id++){int c=1;for(;c<=K;c++)if(CTYPE[representative[c]]==CTYPE[id]&&CVAL[representative[c]]==CVAL[id])break;if(c>K){K=c;representative[c]=id;types[c]=CTYPE[id];}idmap[id]=c;capacity[c]++;}int x=1;for(int c=1;c<=K;c++){stride[c]=x;x*=capacity[c]+1;}if(K!=22||x!=107495424)throw std::runtime_error("unexpected card classes");for(int i=0;i<28;i++){comb[i][0]=1;for(int j=1;j<=6;j++)comb[i][j]=i?comb[i-1][j-1]+comb[i-1][j]:0;}}
 int rank(const int*c,int n)const{if(!n)return 0;int ans=comb[22+n-1][n-1],prev=1;for(int i=0;i<n;i++){int r=n-i;ans+=comb[22-prev+r][r]-comb[22-c[i]+r][r];prev=c[i];}return ans;}
 int hand(const State&s,int skip=-1)const{int c[5],n=0;for(int i=0;i<s.n;i++)if(i!=skip)c[n++]=idmap[s.h[i]];std::sort(c,c+n);return rank(c,n);}
 uint32_t deckCode(uint32_t deck)const{uint32_t d=0;while(deck){int bit=__builtin_ctz(deck);deck&=deck-1;d+=stride[idmap[bit+1]];}return d;}
 uint64_t key(const State&s)const{return uint64_t(s.p)|(uint64_t(100-s.t)<<12)|(uint64_t(s.b)<<19)|(uint64_t(hand(s))<<20)|(uint64_t(deckCode(s.deck))<<37);}
};
struct KeyHash{size_t operator()(uint64_t x)const{x=(x^(x>>30))*0xbf58476d1ce4e5b9ULL;x=(x^(x>>27))*0x94d049bb133111ebULL;return x^(x>>31);}};
struct StaticFive {
 static constexpr int H=80730;Codec codec;std::vector<std::array<int,23>>add;const char*map=nullptr;size_t bytes=24+size_t(2)*(N+1)*(4+2*H);
 explicit StaticFive(const char*data):map(data){
  int hdr[4];std::memcpy(hdr,data+8,16);
  if(std::memcmp(data,"AST5CP1",7)||hdr[0]!=24||hdr[1]!=N||hdr[2]!=H||hdr[3]!=32)throw std::runtime_error("Invalid five-card model");
  add.resize(14950);int c[5]={};int ix=0;auto gen=[&](auto&&self,int pos,int n,int low)->void{if(pos==n){if(codec.rank(c,n)!=ix)throw std::runtime_error("rank mismatch");for(int x=1;x<=22;x++){int cc[5];std::copy(c,c+n,cc);cc[n]=x;std::sort(cc,cc+n+1);add[ix][x]=codec.rank(cc,n+1);}ix++;return;}for(int x=low;x<=22;x++){c[pos]=x;self(self,pos+1,n,x);}};for(int n=0;n<=4;n++)gen(gen,0,n,1);
 }
 const char*row(int b,int p)const{return (const char*)map+24+(size_t(b)*(N+1)+p)*(4+H*2);}
 double base(int b,int p)const{return *(const float*)row(b,p);}
 double delta(int b,int p,int hand)const{return ((const int16_t*)(row(b,p)+4))[hand]/32.;}

};
struct ResidualPolicy {
 PairModel&m;StaticFive&f;PairPolicy pair;int window=48,depth=1;double taper=12,scale=1,deckBeta=.6,timeSlope=0;std::unordered_map<uint64_t,double,KeyHash>cache;double qvalues[6]={};
 ResidualPolicy(PairModel&pm,StaticFive&five):m(pm),f(five),pair(pm,.975,.75,1,true){cache.reserve(2048);}
 double alpha(int r,int b)const{return taper<=0?scale:scale*std::min(1.,double(r+b)/taper);}
 double dv(uint32_t deck,int r,int b,bool draw)const{if(!r&&!b)return 0;int n=__builtin_popcount(deck);double sum=0;while(deck){int id=__builtin_ctz(deck)+1;deck&=deck-1;sum+=DECK_COEFF[m.classes.idmap[id]];}if(draw){if(n==1)return 0;sum*=double(n-1)/n;n--;}return deckBeta*std::min(1.,.7*(r+b)/n)*sum;}

 struct Prepared {int n,h,c[5],np=0,pairs[10],count[23]={},nh[23]={},nn;uint32_t deck;};
 Prepared prepare(const State&s,int skip)const{Prepared z;z.n=0;z.deck=s.deck;for(int i=0;i<s.n;i++)if(i!=skip)z.c[z.n++]=m.classes.idmap[s.h[i]];std::sort(z.c,z.c+z.n);z.h=f.codec.rank(z.c,z.n);for(int i=0;i<z.n;i++)for(int j=i+1;j<z.n;j++)z.pairs[z.np++]=m.pair[z.c[i]][z.c[j]];uint32_t bits=s.deck;z.nn=__builtin_popcount(bits);while(bits){int id=__builtin_ctz(bits)+1;bits&=bits-1;z.count[m.classes.idmap[id]]++;}if(z.n<5)for(int c=1;c<=22;c++)if(z.count[c])z.nh[c]=f.add[z.h][c];return z;}
 double afterPrepared(const Prepared&z,int r,int b,int code)const{int p=code&4095;if(!r&&!b)return p;auto vr=m.row(r,b,p),v24=m.row(24,b,p);double a=alpha(r,b);bool draw=(code&4096)&&z.n<5;
  double zero=double(vr[0])-a*v24[0],inv=0;double u[23];bool ready[23]={};
  auto U=[&](int c){if(!ready[c]){u[c]=(double(vr[c])-vr[0])-a*(double(v24[c])-v24[0]);ready[c]=true;}return u[c];};
  auto I=[&](int c,int d){int h=m.pair[c][d];return (double(vr[h])-vr[c]-vr[d]+vr[0])-a*(double(v24[h])-v24[c]-v24[d]+v24[0]);};
  for(int i=0;i<z.n;i++)inv+=U(z.c[i]);for(int i=0;i<z.n;i++)for(int j=i+1;j<z.n;j++)inv+=pair.pairScale*I(z.c[i],z.c[j]);double d5=f.delta(b,p,z.h);
  if(draw){double gain=0,df=0;for(int c=1;c<=22;c++)if(z.count[c]){double g=U(c);for(int j=0;j<z.n;j++)g+=pair.pairScale*I(c,z.c[j]);gain+=z.count[c]*g;df+=z.count[c]*f.delta(b,p,z.nh[c]);}inv+=gain/z.nn;d5=df/z.nn;}
  return zero+pair.weight*inv+a*(f.base(b,p)+d5)+dv(z.deck,r,b,draw)+timeSlope*(r+.85*b);
 }
 double q1(const State&s,int a)const{int id=a?s.h[a-1]:0,r=100-s.t;auto z=prepare(s,a-1);if(id&&CTYPE[id]!=2)return afterPrepared(z,r,s.b,CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3]);return m.classes.diceExpectation(r,s.b,[&](int rr,int bb,int d){return afterPrepared(z,rr,bb,id?LAND[s.p+CVAL[id]*d+3]:ROLL[s.p*11+d-2]);});}
 double value(const State&s){if(s.terminal())return s.p;auto key=f.codec.key(s);auto it=cache.find(key);if(it!=cache.end())return it->second;double best=-1e100;uint32_t seen=0;for(int a=0;a<=s.n;a++){int c=a?m.classes.idmap[s.h[a-1]]:0;if(seen&(1u<<c))continue;seen|=1u<<c;best=std::max(best,q1(s,a));}cache.emplace(key,best);return best;}
 double landed(State&s,int code){s.p=code&4095;if(s.terminal())return s.p;if((code&4096)&&s.n<5){int count[23]={},bitFor[23]={};uint32_t deck=s.deck,bits=deck;while(bits){int bit=__builtin_ctz(bits);bits&=bits-1;int c=m.classes.idmap[bit+1];count[c]++;bitFor[c]=bit;}int n=s.n;double sum=0;for(int c=1;c<=22;c++)if(count[c]){int bit=bitFor[c];s.h[n]=bit+1;s.n=n+1;s.deck=deck&~(1u<<bit);if(!s.deck)s.deck=0x3fffffff;sum+=count[c]*value(s);}s.n=n;s.deck=deck;return sum/__builtin_popcount(deck);}return value(s);}
 double q2(const State&s,int a){State z=s;int id=0;if(a){id=z.h[a-1];for(int j=a;j<z.n;j++)z.h[j-1]=z.h[j];--z.n;}if(id&&CTYPE[id]!=2)return landed(z,CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3]);return m.classes.diceExpectation(100-s.t,s.b,[&](int r,int b,int d){z.t=100-r;z.b=b;return landed(z,id?LAND[s.p+CVAL[id]*d+3]:ROLL[s.p*11+d-2]);});}
 int act(const State&root){if(!root.n)return 0;State s=root;s.t=100-std::min(100-root.t,window);cache.clear();double best=-1e100;int ans=0;uint32_t seen=0;for(int a=0;a<=s.n;a++){int c=a?m.classes.idmap[s.h[a-1]]:0;if(seen&(1u<<c)){qvalues[a]=-1e100;continue;}seen|=1u<<c;double v=depth==1?q1(s,a):q2(s,a);qvalues[a]=v;if(v>best){best=v;ans=a;}}return ans;}
};
