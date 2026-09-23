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
struct Params {
 // dice shadow price, draw value, fixed intercept/slope, negative reserve,
 // multiplier intercept/slope, stage reserve, full-hand discount, potential scale, horizon
 std::vector<double> x={16,24,16,0.4,10,-3,6,27,3,0.8,8};
 void read(const char*path){std::ifstream f(path);for(auto &v:x)f>>v;}
 void write(const char*path)const{std::ofstream f(path);for(auto v:x)f<<v<<' ';f<<'\n';}
};
struct Policy {
 Params par;
 double bias[N+1]={};
 double q[6];
 Policy(Params p={}):par(p){
  std::vector<double> v(N+1),w(N+1);
  for(int i=1;i<=N;i++)v[i]=i;
  for(int k=0;k<int(par.x[10]);k++){
   for(int i=1;i<=N;i++){w[i]=0;for(int d=2;d<=12;d++)w[i]+=(6-abs(7-d))*v[ROLL[i*11+d-2]&4095]/36.0;}
   v.swap(w);
  }
  for(int i=1;i<=N;i++)bias[i]=par.x[9]*(v[i]-i);
 }
 double reserve(int id,int n,int t)const{
  const auto &x=par.x;int val=CVAL[id],ty=CTYPE[id];
  double r=ty==1?(val>0?x[2]+x[3]*val:x[4]):ty==2?x[5]+x[6]*val:x[7];
  r-=x[8]*std::max(0,n-2);
  return r*std::min(1.0,(100-t)/5.0);
 }
 int act(const State&s){
  if(s.n==0)return 0;
  double base=s.p+bias[s.p],best=-1e100;int ans=0;
  for(int a=0;a<=s.n;a++){
   int id=a?s.h[a-1]:0,ty=CTYPE[id];
   double val=0,pr=a?reserve(id,s.n,s.t):0;
   if(a&&ty!=2){int code=ty==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3];int p=code&4095;val=p+bias[p]+((code&4096)?par.x[1]:0)-base-pr;}
   else{
    for(int d=2;d<=12;d++){
     int code=a?LAND[s.p+CVAL[id]*d+3]:ROLL[s.p*11+d-2],p=code&4095;
     val+=(6-abs(7-d))*(p+bias[p]+((code&4096)&&(s.n<5||a)?par.x[1]:0))/36.0;
    }
    val-=base+pr+par.x[0];
   }
   // No usable inventory after the terminal transition. Endgame placeholder.
   q[a]=val;
   if(val>best){best=val;ans=a;}
  }
  return ans;
 }
};
struct Stats{int n=0;double sum=0,sq=0;std::vector<int>scores;void add(int x){n++;sum+=x;sq+=double(x)*x;scores.push_back(x);}double mean()const{return sum/n;}double sd()const{return sqrt((sq-sum*sum/n)/(n-1));}void print(){std::sort(scores.begin(),scores.end());std::cout<<"{\"n\":"<<n<<",\"mean\":"<<mean()<<",\"sd\":"<<sd()<<",\"se\":"<<sd()/sqrt(n)<<",\"ci95_low\":"<<mean()-1.96*sd()/sqrt(n)<<",\"ci95_high\":"<<mean()+1.96*sd()/sqrt(n)<<",\"p10\":"<<scores[n/10]<<",\"median\":"<<scores[n/2]<<",\"p90\":"<<scores[n*9/10]<<"}\n";}};
