#pragma once
#include "hinge.hpp"
struct Branch{State s;double prob;};
std::vector<Branch> branches(const State&s,int a,const Codec&c,bool literal=false){
 std::vector<Branch>v;if(s.terminal()){v.push_back({s,1});return v;}State z=s;int id=0;if(a){id=z.h[a-1];for(int j=a;j<z.n;j++)z.h[j-1]=z.h[j];--z.n;}
 auto landed=[&](State y,int code,double prob){y.p=code&4095;if(!(code&4096)||y.n==5){v.push_back({y,prob});return;}int counts[23]={},rep[23]={};int n=__builtin_popcount(y.deck);for(int j=1;j<=30;j++)if(y.deck&(1u<<(j-1))){if(literal){State w=y;w.h[w.n++]=j;w.deck&=~(1u<<(j-1));if(!w.deck)w.deck=0x3fffffff;v.push_back({w,prob/n});}else{int cl=c.idmap[j];counts[cl]++;rep[cl]=j;}}if(!literal)for(int cl=1;cl<=22;cl++)if(counts[cl]){State w=y;w.h[w.n++]=rep[cl];w.deck&=~(1u<<(rep[cl]-1));if(!w.deck)w.deck=0x3fffffff;v.push_back({w,prob*counts[cl]/n});}};
 if(id&&CTYPE[id]!=2)landed(z,CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3],1);
 else if(literal){for(int d1=1;d1<=6;d1++)for(int d2=1;d2<=6;d2++){State y=z;if(s.b)y.b=0;else{y.b=d1==d2;++y.t;}landed(y,id?LAND[s.p+CVAL[id]*(d1+d2)+3]:ROLL[s.p*11+d1+d2-2],1./36);}}
 else for(int sm=2;sm<=12;sm++){int ways=6-abs(7-sm),dbl=!s.b&&(sm%2==0),code=id?LAND[s.p+CVAL[id]*sm+3]:ROLL[s.p*11+sm-2];if(ways-dbl){State y=z;y.t=s.t+!s.b;y.b=0;landed(y,code,double(ways-dbl)/36);}if(dbl){State y=z;y.t=s.t+1;y.b=1;landed(y,code,1./36);}}
 return v;
}
