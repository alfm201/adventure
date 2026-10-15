#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <numeric>
#include <vector>
#include "tables.hpp"
struct RNG {
 uint32_t x;
 explicit RNG(uint32_t seed=1):x(seed){}
 uint32_t next(){uint32_t z=(x+=0x6d2b79f5u);z=(z^(z>>15))*(z|1);z^=z+(z^(z>>7))*(z|61);return z^(z>>14);}
 double uniform(){return next()/4294967296.0;}
 int pick(int n){return uint64_t(next())*n>>32;}
};
inline uint32_t mix(uint32_t x){x^=x>>16;x*=0x7feb352d;x^=x>>15;x*=0x846ca68b;return x^(x>>16);}
struct State {
 int p=1,t=0,b=0,n=0,h[5]={}; uint32_t deck=0x3fffffff;
 bool terminal()const{return t>=100&&!b;}
};
inline int nthbit(uint32_t mask,int k){while(k--)mask&=mask-1;return __builtin_ctz(mask);}
inline void step(State &s,int a,RNG &rng){
 if(s.terminal())return;
 int id=0;
 if(a){id=s.h[a-1];for(int j=a;j<s.n;j++)s.h[j-1]=s.h[j];--s.n;}
 int code;
 if(!id||CTYPE[id]==2){
  int d1=rng.pick(6)+1,d2=rng.pick(6)+1;
  if(s.b)s.b=0;else{s.b=d1==d2;++s.t;}
  code=id?LAND[s.p+CVAL[id]*(d1+d2)+3]:ROLL[s.p*11+d1+d2-2];
 }else code=CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3];
 s.p=code&4095;
 if((code&4096)&&s.n<5){int bit=nthbit(s.deck,rng.pick(__builtin_popcount(s.deck)));s.h[s.n++]=bit+1;s.deck&=~(1u<<bit);if(!s.deck)s.deck=0x3fffffff;}
}

#include <cstring>
#include <unordered_map>
#include <stdexcept>
#include <memory>
#include <chrono>
#include <string>
#include <functional>
#include <limits>
#include <sstream>
#include "deck-coefficients.hpp"
struct Codec {
 int idmap[31]={},representative[23]={},types[23]={},capacity[23]={},stride[23]={},K=0,comb[28][7]={};
 Codec(){for(int id=1;id<=30;id++){int c=1;for(;c<=K;c++)if(CTYPE[representative[c]]==CTYPE[id]&&CVAL[representative[c]]==CVAL[id])break;if(c>K){K=c;representative[c]=id;types[c]=CTYPE[id];}idmap[id]=c;capacity[c]++;}int x=1;for(int c=1;c<=K;c++){stride[c]=x;x*=capacity[c]+1;}if(K!=22||x!=107495424)throw std::runtime_error("unexpected card classes");for(int i=0;i<28;i++){comb[i][0]=1;for(int j=1;j<=6;j++)comb[i][j]=i?comb[i-1][j-1]+comb[i-1][j]:0;}}
 int rank(const int*c,int n)const{if(!n)return 0;int ans=comb[22+n-1][n-1],prev=1;for(int i=0;i<n;i++){int r=n-i;ans+=comb[22-prev+r][r]-comb[22-c[i]+r][r];prev=c[i];}return ans;}
 int hand(const State&s,int skip=-1)const{int c[5],n=0;for(int i=0;i<s.n;i++)if(i!=skip)c[n++]=idmap[s.h[i]];std::sort(c,c+n);return rank(c,n);}
 uint32_t deckCode(uint32_t deck)const{uint32_t d=0;while(deck){int bit=__builtin_ctz(deck);deck&=deck-1;d+=stride[idmap[bit+1]];}return d;}
 uint64_t key(const State&s)const{return uint64_t(s.p)|(uint64_t(100-s.t)<<12)|(uint64_t(s.b)<<19)|(uint64_t(hand(s))<<20)|(uint64_t(deckCode(s.deck))<<37);}
};
struct KeyHash{size_t operator()(uint64_t x)const{x=(x^(x>>30))*0xbf58476d1ce4e5b9ULL;x=(x^(x>>27))*0x94d049bb133111ebULL;return x^(x>>31);}};
