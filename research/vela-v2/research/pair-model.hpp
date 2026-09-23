#pragma once
#include "value-model.hpp"
struct PairModel{
 ValueModel classes;int K=22,M=276,R;int pair[23][23]={};std::vector<std::array<int,2>> hands;
 std::vector<float> v,draw;
 PairModel(int horizon=24):R(horizon){classes.v.clear();classes.v.shrink_to_fit();hands.push_back({0,0});for(int c=1;c<=K;c++)hands.push_back({c,0});for(int c=1;c<=K;c++)for(int d=c;d<=K;d++){pair[c][d]=pair[d][c]=hands.size();hands.push_back({c,d});}M=hands.size();v.resize((R+1)*2*(N+1)*M);draw.resize((R+1)*2*(N+1)*(K+1));}
 float* row(int r,int b,int p){return v.data()+((r*2+b)*(N+1)+p)*M;}
 const float* row(int r,int b,int p)const{return v.data()+((r*2+b)*(N+1)+p)*M;}
 float* drow(int r,int b,int p){return draw.data()+((r*2+b)*(N+1)+p)*(K+1);}
 const float* drow(int r,int b,int p)const{return draw.data()+((r*2+b)*(N+1)+p)*(K+1);}
 void updateDraw(int r,int b){for(int p=1;p<=N;p++){auto val=row(r,b,p),dr=drow(r,b,p);double z=0;for(int c=1;c<=K;c++)z+=classes.freq[c]*val[c];dr[0]=z/30;for(int c=1;c<=K;c++){double x=0;for(int d=1;d<=K;d++)x+=classes.freq[d]*val[pair[c][d]];dr[c]=x/30;}}}
 double land(int r,int b,int code,int h)const{int p=code&4095;if(code&4096){if(h<=K)return drow(r,b,p)[h];auto val=row(r,b,p),dr=drow(r,b,p);int a=hands[h][0],c=hands[h][1];return std::max(double(val[h]),double(val[h]+dr[a]+dr[c]-val[a]-val[c]-dr[0]+val[0]));}return row(r,b,p)[h];}
 void build(){for(int p=1;p<=N;p++)for(int h=0;h<M;h++)row(0,0,p)[h]=p;updateDraw(0,0);std::vector<float>wait((N+1)*M);
 for(int r=0;r<=R;r++)for(int b=0;b<=1;b++){if(r==0&&b==0)continue;
  for(int p=1;p<=N;p++)for(int h=0;h<M;h++){
   auto hand=hands[h];double best=classes.diceExpectation(r,b,[&](int rr,int bb,int d){return land(rr,bb,ROLL[p*11+d-2],h);});
   for(int j=0;j<2;j++){int c=hand[j],rem=hand[1-j];if(c&&classes.types[c]==2){double val=classes.diceExpectation(r,b,[&](int rr,int bb,int d){return land(rr,bb,LAND[p+classes.values[c]*d+3],rem);});best=std::max(best,val);}}
   wait[p*M+h]=row(r,b,p)[h]=best;
  }
  int it;double err=0;
  for(it=0;it<200;it++){updateDraw(r,b);err=0;
   for(int p=1;p<=N;p++)for(int h=1;h<M;h++){auto hand=hands[h];double val=wait[p*M+h];for(int j=0;j<2;j++){int c=hand[j],rem=hand[1-j];if(c&&classes.types[c]!=2){int code=classes.types[c]==3?NEXT[p]:LAND[p+classes.values[c]+3];val=std::max(val,land(r,b,code,rem));}}err=std::max(err,std::abs(val-row(r,b,p)[h]));row(r,b,p)[h]=val;}
   if(err<0.001)break;
  }
  updateDraw(r,b);if(r%10==0&&b==1)std::cerr<<"layer "<<r<<" iter "<<it<<" residual "<<err<<'\n';
 }
 }
 void save(const char*path){std::ofstream f(path,std::ios::binary);f.write((char*)&R,4);f.write((char*)v.data(),v.size()*4);}
 void load(const char*path){std::ifstream f(path,std::ios::binary);int r;f.read((char*)&r,4);if(!f||r!=R)throw std::runtime_error("pair model horizon mismatch");f.read((char*)v.data(),v.size()*4);if(!f)throw std::runtime_error("pair model size mismatch");}
};
struct PairPolicy{
 PairModel &m;double weight,pairScale,drawScale;bool deckAware;double q[6]={};double cw[23];int window;
 PairPolicy(PairModel&vm,double w=1,double ps=0.5,double ds=1,bool da=false):m(vm),weight(w),pairScale(ps),drawScale(ds),deckAware(da),window(vm.R){std::fill(cw,cw+23,1.0);}
 double inv(const float*val,const State&s,int skip,int extra=0)const{
  int c[6],n=0;for(int i=0;i<s.n;i++)if(i!=skip)c[n++]=m.classes.idmap[s.h[i]];if(extra)c[n++]=m.classes.idmap[extra];double v=0;for(int i=0;i<n;i++)v+=cw[c[i]]*(double(val[c[i]])-val[0]);
  for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)v+=pairScale*(double(val[m.pair[c[i]][c[j]]])-val[c[i]]-val[c[j]]+val[0]);return weight*v;
 }
 double after(const State&s,int skip,int r,int b,int code)const{
  auto val=m.row(r,b,code&4095);double old=inv(val,s,skip),ans=val[0]+old;int n=s.n-(skip>=0);
  if((code&4096)&&n<5){uint32_t bits=deckAware?s.deck:0x3fffffff;int nn=__builtin_popcount(bits);double x=0;while(bits){int id=__builtin_ctz(bits)+1;bits&=bits-1;int c=m.classes.idmap[id];double gain=cw[c]*(double(val[c])-val[0]);for(int j=0;j<s.n;j++)if(j!=skip){int d=m.classes.idmap[s.h[j]];gain+=pairScale*(double(val[m.pair[c][d]])-val[c]-val[d]+val[0]);}x+=weight*gain;}ans+=drawScale*x/nn;}
  return ans;
 }
 int act(const State&s){if(!s.n)return 0;int r=std::min(100-s.t,window),ans=0;double best=-1e100;for(int a=0;a<=s.n;a++){int id=a?s.h[a-1]:0;double x;
  if(a&&CTYPE[id]!=2){int code=CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3];x=after(s,a-1,r,s.b,code);}
  else x=m.classes.diceExpectation(r,s.b,[&](int rr,int bb,int d){return after(s,a-1,rr,bb,a?LAND[s.p+CVAL[id]*d+3]:ROLL[s.p*11+d-2]);});q[a]=x;if(x>best){best=x;ans=a;}}
 return ans;}
};
