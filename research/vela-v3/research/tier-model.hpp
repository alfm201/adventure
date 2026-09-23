#pragma once
#include "value-model.hpp"
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <cstring>
#include <functional>
#include <stdexcept>
#include <string>
struct TierModel {
  static constexpr int first[7]={0,1,23,276,2300,14950,80730};
  ValueModel classes;int R,cap=5,scale=32;void*maps[6]={};size_t bytes[6]={};int fd[6]={-1,-1,-1,-1,-1,-1};
  int comb[28][7]={};std::vector<std::array<int,23>> add;
  static constexpr int F=11;
  struct Subsets {unsigned char c[5]={};int pairs[10]={},triples[10]={};};
  std::vector<Subsets> subsets;
  int maxTier=5,exactFrom=25;std::vector<double> coefficients;
  void loadCoefficients(const std::string&path){
    std::ifstream in(path,std::ios::binary);int hdr[4];in.read((char*)hdr,16);
    if(!in||hdr[0]!=0x334d4f43||hdr[1]!=1||hdr[2]!=24||hdr[3]!=F)throw std::runtime_error("compact coefficient header");
    coefficients.resize(50*2*F);in.read((char*)coefficients.data(),coefficients.size()*8);
    if(!in)throw std::runtime_error("compact coefficients truncated");maxTier=3;
  }
  TierModel(){classes.v.clear();classes.v.shrink_to_fit();
    for(int i=0;i<28;i++){comb[i][0]=1;for(int j=1;j<=6;j++)comb[i][j]=i?comb[i-1][j-1]+comb[i-1][j]:0;}
    add.resize(14950);int idx=0;
    for(int n=0;n<=4;n++) {int c[5]={};std::function<void(int,int)> f=[&](int pos,int low){
      if(pos==n){if(handIndex(c,n)!=idx)throw std::runtime_error("rank validation");
        for(int x=1;x<=22;x++){int a[5];std::copy(c,c+n,a);a[n]=x;std::sort(a,a+n+1);add[idx][x]=handIndex(a,n+1);}idx++;return;}
      for(int x=low;x<=22;x++){c[pos]=x;f(pos+1,x);}
    };f(0,1);}
    subsets.resize(80730);idx=0;
    for(int n=0;n<=5;n++){int c[5]={};std::function<void(int,int)> f=[&](int pos,int low){
      if(pos==n){auto&z=subsets[idx++];for(int j=0;j<n;j++)z.c[j]=c[j];int k=0;
        for(int i=0;i<n;i++)for(int j=i+1;j<n;j++){int a[2]={c[i],c[j]};z.pairs[k++]=handIndex(a,2);}k=0;
        for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)for(int l=j+1;l<n;l++){int a[3]={c[i],c[j],c[l]};z.triples[k++]=handIndex(a,3);}return;}
      for(int x=low;x<=22;x++){c[pos]=x;f(pos+1,x);}
    };f(0,1);}
    if(idx!=80730)throw std::runtime_error("subset count");
  }
  int handIndex(const int*c,int n)const{if(!n)return 0;int ans=comb[22+n-1][n-1],prev=1;
    for(int i=0;i<n;i++){int r=n-i;ans+=comb[22-prev+r][r]-comb[22-c[i]+r][r];prev=c[i];}return ans;}
  int index(const State&s,int skip=-1)const{int c[5],n=0;for(int i=0;i<s.n;i++)if(i!=skip)c[n++]=classes.idmap[s.h[i]];std::sort(c,c+n);return handIndex(c,n);}
  void load(const std::string&dir,int window){R=window;if(!coefficients.empty()&&exactFrom<=R)maxTier=5;
    for(int n=0;n<=maxTier;n++){
      auto path=dir+"/tier"+std::to_string(n)+(n?".i16":".f32");fd[n]=open(path.c_str(),O_RDONLY);if(fd[n]<0)throw std::runtime_error("cannot open "+path);
      int hdr[8];if(pread(fd[n],hdr,32,0)!=32||hdr[0]!=0x33545341||hdr[1]!=1||hdr[3]!=N||hdr[4]!=5||hdr[5]!=n||hdr[6]!=first[n+1]-first[n]||hdr[7]!=32||R>hdr[2])throw std::runtime_error("tier header mismatch");
      bytes[n]=32+size_t(2*(R+1))*(N+1)*(first[n+1]-first[n])*(n?2:4);
      struct stat st;if(fstat(fd[n],&st)||size_t(st.st_size)<bytes[n])throw std::runtime_error("requested tier prefix incomplete");
      maps[n]=mmap(nullptr,bytes[n],PROT_READ,MAP_SHARED,fd[n],0);if(maps[n]==MAP_FAILED)throw std::runtime_error("tier mapping failed");
      madvise(maps[n],bytes[n],MADV_RANDOM);
    }
  }
  double base(int r,int b,int p)const{return ((const float*)((const char*)maps[0]+32))[(size_t(r*2+b)*(N+1)+p)];}
  double rawDelta(int r,int b,int p,int h,int n)const{if(n==0)return 0;int width=first[n+1]-first[n];
    size_t ix=(size_t(r*2+b)*(N+1)+p)*width+h-first[n];
    return ((const int16_t*)((const char*)maps[n]+32))[ix]/32.0;
  }
  void features(int r,int b,int p,int h,int n,double* x)const {
    const auto& info=subsets[h];double u[5],pairs[5][5]={};
    double U=0,P=0,T=0,plusP=0,plusT=0,minU=1e100,maxU=-1e100,msum=0,mmax=0,nm=0;
    for(int i=0;i<n;i++){int c=info.c[i];u[i]=rawDelta(r,b,p,c,1);U+=u[i];minU=std::min(minU,u[i]);maxU=std::max(maxU,u[i]);
      if(classes.types[c]==2){msum+=u[i];mmax=std::max(mmax,u[i]);nm++;}}
    int k=0;for(int i=0;i<n;i++)for(int j=i+1;j<n;j++){
      double d=rawDelta(r,b,p,info.pairs[k++],2);pairs[i][j]=d;
      double delta=d-u[i]-u[j];P+=delta;plusP+=std::max(0.0,delta);}
    k=0;for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)for(int l=j+1;l<n;l++){
      double d=rawDelta(r,b,p,info.triples[k++],3)-pairs[i][j]-pairs[i][l]-pairs[j][l]+u[i]+u[j]+u[l];T+=d;plusT+=std::max(0.0,d);}
    double values[F]={1,U,P,T,plusP,plusT,minU,maxU,msum,mmax,nm};std::copy(values,values+F,x);
  }
  double delta(int r,int b,int p,int h,int n)const {
    if(n<=3||coefficients.empty()||r>=exactFrom)return rawDelta(r,b,p,h,n);
    double f[F];features(r,b,p,h,n,f);const double* c=coefficients.data()+((r*2+b)*2+n-4)*F;
    double ans=f[1]+f[2]+f[3];for(int k=0;k<F;k++)ans+=c[k]*f[k];return ans;
  }
  ~TierModel(){for(int n=0;n<=5;n++){if(maps[n]&&maps[n]!=MAP_FAILED)munmap(maps[n],bytes[n]);if(fd[n]>=0)close(fd[n]);}}
};
