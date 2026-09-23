#pragma once
#include "core.hpp"
struct ValueModel{
 int K=0,idmap[31]={},types[31]={},values[31]={},freq[31]={};
 std::vector<float> v;
 size_t stride;
 ValueModel(){for(int id=1;id<=30;id++){int c=1;for(;c<=K;c++)if(types[c]==CTYPE[id]&&values[c]==CVAL[id])break;if(c>K){K=c;types[c]=CTYPE[id];values[c]=CVAL[id];}idmap[id]=c;freq[c]++;}stride=(N+1)*(K+1);v.resize(202*stride);}
 float* row(int r,int b,int p){return v.data()+(2*r+b)*stride+p*(K+1);}
 const float* row(int r,int b,int p)const{return v.data()+(2*r+b)*stride+p*(K+1);}
 double average(const float*q)const{double x=0;for(int c=1;c<=K;c++)x+=freq[c]*q[c];return x/30;}
 double afterBase(int r,int b,int code)const{auto q=row(r,b,code&4095);return q[0]+((code&4096)?average(q):0);}
 template<class F> double diceExpectation(int r,int b,F f)const{
  double sum=0;for(int d=2;d<=12;d++){int w=6-abs(7-d),doub=(d%2==0);if(b)sum+=w*f(r,0,d);else{if(w-doub)sum+=(w-doub)*f(r-1,0,d);if(doub)sum+=f(r-1,1,d);}}return sum/36;}
 void build(){
  for(int p=1;p<=N;p++)row(0,0,p)[0]=p;
  std::vector<double> wait((N+1)*(K+1)),draw(N+1);
  for(int r=0;r<=100;r++)for(int b=0;b<=1;b++){
   if(r==0&&b==0)continue;
   for(int p=1;p<=N;p++)row(r,b,p)[0]=diceExpectation(r,b,[&](int rr,int bb,int d){return afterBase(rr,bb,ROLL[p*11+d-2]);});
   for(int p=1;p<=N;p++)for(int c=1;c<=K;c++){
    double hold=diceExpectation(r,b,[&](int rr,int bb,int d){return double(row(rr,bb,ROLL[p*11+d-2]&4095)[c]);});
    double val=hold;
    if(types[c]==2){double use=diceExpectation(r,b,[&](int rr,int bb,int d){return afterBase(rr,bb,LAND[p+values[c]*d+3]);})-row(r,b,p)[0];val=std::max(val,use);}
    wait[p*(K+1)+c]=val;row(r,b,p)[c]=val;
   }
   // Fixed-point iteration handles deterministic cards that draw another card.
   for(int it=0;it<100;it++){
    for(int p=1;p<=N;p++)draw[p]=average(row(r,b,p));double err=0;
    for(int p=1;p<=N;p++)for(int c=1;c<=K;c++)if(types[c]!=2){int code=types[c]==3?NEXT[p]:LAND[p+values[c]+3],dest=code&4095;double use=row(r,b,dest)[0]+((code&4096)?draw[dest]:0)-row(r,b,p)[0];double val=std::max(wait[p*(K+1)+c],use);err=std::max(err,std::abs(val-row(r,b,p)[c]));row(r,b,p)[c]=val;}
    if(err<0.0005)break;
   }
  }
 }
 void save(const char*path){std::ofstream f(path,std::ios::binary);f.write((char*)v.data(),v.size()*4);}
 void load(const char*path){std::ifstream f(path,std::ios::binary);if(!f)throw std::runtime_error("model file missing");f.read((char*)v.data(),v.size()*4);if(!f)throw std::runtime_error("model size mismatch");}
};
struct ValuePolicy{
 const ValueModel &m;double weight,decay,drawScale;bool deckAware;double q[6]={};
 ValuePolicy(const ValueModel &vm,double w=1,double d=1,double ds=1,bool da=false):m(vm),weight(w),decay(d),drawScale(ds),deckAware(da){}
 double inventory(const float*row,const State&s,int skip,int extra=0)const{
  double a[6];int n=0;for(int i=0;i<s.n;i++)if(i!=skip)a[n++]=row[m.idmap[s.h[i]]];if(extra)a[n++]=row[m.idmap[extra]];
  if(decay!=1)std::sort(a,a+n,std::greater<double>());double v=0,w=weight;for(int i=0;i<n;i++){v+=w*a[i];w*=decay;}return v;
 }
 double after(const State&s,int skip,int r,int b,int code)const{
  auto row=m.row(r,b,code&4095);double value=row[0]+inventory(row,s,skip);int count=s.n-(skip>=0);
  if((code&4096)&&count<5){
   double gain=0;if(decay==1){if(deckAware){uint32_t bits=s.deck;while(bits){int id=__builtin_ctz(bits)+1;bits&=bits-1;gain+=row[m.idmap[id]];}gain/=__builtin_popcount(s.deck);}else gain=m.average(row);gain*=weight;}
   else{uint32_t bits=deckAware?s.deck:0x3fffffff;int count=__builtin_popcount(bits);double old=value-row[0];while(bits){int id=__builtin_ctz(bits)+1;bits&=bits-1;gain+=inventory(row,s,skip,id)-old;}gain/=count;}
   value+=drawScale*gain;
  }
  return value;
 }
 int act(const State&s){if(!s.n)return 0;int r=100-s.t,ans=0;double best=-1e100;for(int a=0;a<=s.n;a++){
  int id=a?s.h[a-1]:0,ty=CTYPE[id],skip=a-1;double v;
  if(a&&ty!=2){int code=ty==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3];v=after(s,skip,r,s.b,code);}
  else v=m.diceExpectation(r,s.b,[&](int rr,int bb,int d){int code=a?LAND[s.p+CVAL[id]*d+3]:ROLL[s.p*11+d-2];return after(s,skip,rr,bb,code);});
  q[a]=v;if(v>best){best=v;ans=a;}
 }return ans;}
};
