#pragma once
#include "core.hpp"
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>
#include <fcntl.h>
#include <fstream>
#include <stdexcept>

namespace warm {
constexpr int width=56, hidden=24;
struct Weights {
  bool active=false; std::vector<float> positional;
  float w[hidden][width]{}, offset[hidden]{}, out[hidden]{}, bias=0;
  explicit Weights(const std::string& path="") {
    if(path.empty() || path=="-")return;
    std::ifstream f(path,std::ios::binary);
    f.read((char*)w,sizeof(w));f.read((char*)offset,sizeof(offset));
    f.read((char*)out,sizeof(out)); f.read((char*)&bias,sizeof(bias));
    if(!f)throw std::runtime_error("invalid boundary residual model");
    if(f.peek()!=std::char_traits<char>::eof()){
      positional.resize((N+1)*hidden);f.read((char*)positional.data(),positional.size()*sizeof(float));
      if(!f || f.peek()!=std::char_traits<char>::eof())throw std::runtime_error("residual position table");
    }
    active=true;
  }
};
inline void features(const State& s, const Codec& codec, float*x) {
  std::fill(x,x+width,0.f);
  int r=100-s.t, n=__builtin_popcount(s.deck);
  for(int j=0;j<s.n;j++)++x[codec.idmap[s.h[j]]-1];
  for(unsigned bits=s.deck;bits;bits&=bits-1)++x[22+codec.idmap[__builtin_ctz(bits)+1]-1];
  for(int j=0;j<22;j++)x[22+j]=float(x[22+j]/n-codec.capacity[j+1]/30.)*5;
  x[44]=s.n*.25f; x[45]=n/30.f; x[46]=1.f/n;
  x[47]=s.b; x[48]=r/100.f; x[49]=r/(r+4.f); x[50]=r/(r+20.f);
  x[51]=s.p/2898.f; x[52]=std::min(1.f,(2898-s.p)/(20.f*r+1.f));
  x[53]=std::min(1.f,r/10.f);x[54]=std::min(1.f,r/2.f);
  x[55]=std::min(1.f,(r+s.b)/float(n));
}
class Model {
  int fd=-1;void* map=MAP_FAILED;size_t size=0;
public:
  int k=0;const float *base=nullptr,*hand=nullptr,*geo=nullptr;
  Codec codec; std::vector<std::array<int,23>> add;
  Model(const std::string& path):add(14950) {
    fd=open(path.c_str(),O_RDONLY);if(fd<0)throw std::runtime_error("reading "+path);
    struct stat st{}; fstat(fd,&st);size=st.st_size;
    map=mmap(nullptr,size,PROT_READ,MAP_SHARED,fd,0);if(map==MAP_FAILED)throw std::bad_alloc();
    k=*(int*)map; if(k<1||k>256)throw std::runtime_error("rank");
    base=(const float*)map+1;hand=base+202*(N+1);geo=hand+80730*k;
    if(size!=4*(1ULL+202*(N+1)+80730*k+size_t(k)*202*(N+1)))throw std::runtime_error("size");
    const auto fill=[&](auto self,int at,int n,int low,int* c)->void {
       if(at<n){for(int j=low;j<=22;j++){c[at]=j;self(self,at+1,n,j,c);}return;}
       int h=codec.rank(c,n);
       for(int j=1;j<=22;j++){int d[5];std::copy(c,c+n,d);d[n]=j;std::sort(d,d+n+1);add[h][j]=codec.rank(d,n+1);}
    };int c[5];for(int n=0;n<5;n++) fill(fill,0,n,1,c);
  }
  Model(const Model&)=delete;
  ~Model(){if(map!=MAP_FAILED)munmap(map,size);if(fd>=0)close(fd);}
};

struct Ctx {
  uint64_t key=~0ULL; int rank=0, n=0; float sum=0,sumAfter=0;
  float draw[256]{},hnet[hidden]{};
};
class Value {
  const Model& m;const Weights& net;
  std::vector<Ctx> maps;
  struct Shell { uint64_t key=~0ULL;float a[hidden]{}; };
  mutable std::vector<Shell> shells;
  Ctx& context(const State&s) {
    uint64_t handcode=0;
    for(int j=0;j<s.n;j++)handcode=handcode*32+s.h[j];
    const auto key=(uint64_t(s.deck)<<25)|handcode;
    auto& z=maps[KeyHash{}(key)&(maps.size()-1)];
    if(z.key==key)return z;
    z.key=key; z.rank=m.codec.hand(s); z.n=__builtin_popcount(s.deck);
    z.sum=0; std::fill(z.draw,z.draw+m.k,0.f);
    for(unsigned bits=s.deck;bits;bits&=bits-1) {
      int c=m.codec.idmap[__builtin_ctz(bits)+1];z.sum+=DECK_COEFF[c];
      if(s.n<5) {
        const float* y=m.hand+size_t(m.add[z.rank][c])*m.k;
        #pragma omp simd
        for(int j=0;j<m.k;j++)z.draw[j]+=y[j];
      }
    }
    for(int j=0;j<m.k;j++)z.draw[j]/=z.n;
    z.sumAfter=z.n==1?0.f:z.sum*(1.f-1.f/z.n);
    if(net.active) {
      float x[width];features(s,m.codec,x);
      for(int h=0;h<hidden;h++) {
        float sum=net.offset[h];
        for(int j=0;j<47;j++)sum+=net.w[h][j]*x[j];
        z.hnet[h]=sum;
      }
    }
    return z;
  }
  float delta(const State&s,const Ctx&z)const{
    if(!net.active || s.terminal())return 0;
    int r=100-s.t; uint64_t key=(z.key<<8)|(2*r+s.b);
    auto& v=shells[KeyHash{}(key)&(shells.size()-1)];
    if(v.key!=key){
      v.key=key;
      const float x[9]={float(s.b),r*.01f,r/(r+4.f),r/(r+20.f),0.f,0.f,
        std::min(1.f,r*.1f),std::min(1.f,r*.5f),std::min(1.f,float(r+s.b)/z.n)};
      for(int h=0;h<hidden;h++){float t=z.hnet[h];for(int i=0;i<9;i++)t+=x[i]*net.w[h][47+i];v.a[h]=t;}
    }
    const float pos=s.p/2898.f, cap=std::min(1.f,(2898-s.p)/(20.f*r+1.f));
    const float* emb=net.positional.empty()?nullptr:&net.positional[s.p*hidden];
    float ret=net.bias;
    for(int h=0;h<hidden;h++){
      float t=v.a[h]+pos*net.w[h][51]+cap*net.w[h][52]+(emb?emb[h]:0.f);
      ret+=net.out[h]*std::max(t,0.f);
    }return ret;
  }
public:
  Value(const Model&m,const Weights& net):m(m),net(net),maps(2048),shells(net.active?4096:0){}
  const Model& model() const{return m;}
  float at(const State&s,bool draw=false,bool corrected=false) {
    if(s.terminal())return s.p;
    auto& z=context(s);const int row=((100-s.t)*2+s.b)*(N+1)+s.p;
    const float* v=draw?z.draw:m.hand+size_t(z.rank)*m.k;
    const float* g=m.geo+size_t(row)*m.k;float sum=0;
    #pragma omp simd reduction(+:sum)
    for(int j=0;j<m.k;j++)sum+=g[j]*v[j];
    const float deck=0.6f*std::min(1.f,.7f*(100-s.t+s.b)/(draw?(z.n==1?30:z.n-1):z.n))*(draw?z.sumAfter:z.sum);
    return m.base[row]+sum+deck+(corrected?delta(s,z):0.f);
  }
  double q(const State&s,int a,bool corrected=false){
    State y=s; int id=0;
    if(a){id=y.h[a-1];for(int j=a;j<y.n;j++)y.h[j-1]=y.h[j];--y.n;}
    const auto land=[&](int code){
      y.p=code&4095; const bool draw=(code&4096)&&y.n<5;
      float v=at(y,draw,corrected&&!draw);
      if(draw && corrected && net.active && !y.terminal()){
        int size=__builtin_popcount(y.deck);float ds=0;
        for(unsigned bits=y.deck;bits;bits&=bits-1){
          int bit=__builtin_ctz(bits); State post=y;post.h[post.n++]=bit+1;
          post.deck^=1u<<bit;if(!post.deck)post.deck=0x3fffffff;
          ds+=delta(post,context(post));
        }
        v+=ds/size;
      }
      return v;
    };
    if(id&&CTYPE[id]!=2)return land(CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3]);
    double val=0;
    for(int d=2;d<=12;d++){
      int code=id?LAND[s.p+CVAL[id]*d+3]:ROLL[s.p*11+d-2];
      int dbl=!s.b && d%2==0;
      y.t=s.t+!s.b; y.b=0; val+=(6-std::abs(7-d)-dbl)*land(code);
      if(dbl){y.b=1;val+=land(code);}
    }return val/36.;
  }
  int act(const State&s,bool corrected=false){if(!s.n)return 0;int a=0; double best=q(s,0,corrected);
    for(int i=1;i<=s.n;i++){auto v=q(s,i,corrected);if(v>best){best=v;a=i;}}return a;}
};
}
