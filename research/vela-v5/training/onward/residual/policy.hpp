#pragma once
#include "../../finalrun/warm/value.hpp"
#include "branches.hpp"
namespace res {
constexpr int D=20,H=48,I=76;
using Vec=std::array<float,D>;using Hidden=std::array<float,H>;
struct Model {
  const warm::Model& hinge;float a[H][I]{},b[H]{},c[D][H]{},d[D]{};
  std::vector<Vec> geometry;
  std::vector<Hidden> hands;
  std::vector<std::array<int,23>> remove;
  std::vector<uint8_t> sizes;
  Model(const warm::Model& shared,const std::string& file):hinge(shared),geometry(202*(N+1)),hands(80730),remove(80730),sizes(80730){
    std::ifstream f(file,std::ios::binary);int dims[4];f.read((char*)dims,sizeof(dims));
    if((dims[0]!=I&&dims[0]!=94)||dims[1]!=H||dims[2]!=D||dims[3]!=202*(N+1))throw std::runtime_error("correction dimensions");
    f.read((char*)a,sizeof(a));f.read((char*)b,sizeof(b));f.read((char*)c,sizeof(c));f.read((char*)d,sizeof(d));
    if(dims[0]==94)f.read((char*)hands.data(),hands.size()*sizeof(Hidden));
    f.read((char*)geometry.data(),geometry.size()*sizeof(Vec));if(!f||f.peek()!=EOF)throw std::runtime_error("correction length");
    int cc[5]={};
    auto gen=[&](auto&&self,int j,int n,int low)->void{
      if(j<n){for(int k=low;k<=22;k++){cc[j]=k;self(self,j+1,n,k);}return;}
      int rk=hinge.codec.rank(cc,n);sizes[rk]=n;
      for(int t=0;t<H;t++){float x=b[t]+a[t][66+n];for(int jj=0;jj<n;jj++)x+=a[t][cc[jj]-1];hands[rk][t]+=x;}
      for(int jj=0;jj<n;jj++){int kept[5],nn=0;for(int l=0;l<n;l++)if(l!=jj)kept[nn++]=cc[l];remove[rk][cc[jj]]=hinge.codec.rank(kept,nn);}
    };
    for(int n=0;n<=5;n++)gen(gen,0,n,1);
  }
};
struct Planner{
 const Model&m;float scale;std::array<float,6> lastQs{};
 struct Deck { unsigned key=0;int count=0;float sum=0,afterSum=0;Hidden x{};};
 std::vector<Deck> decks;
 struct Ctx {uint64_t key=~0ULL; bool hasDraw=false;Vec actual{},draw{}; float phi[256]{};};
 std::vector<Ctx> cache;
 struct VSlot{uint64_t key=~0ULL;float value=0;uint32_t epoch=0;};
 struct Geo{uint32_t key=~0u;float base=0,phi[2][256]{},mass[2][2]{};Vec g[2]{};};
 std::vector<Geo> geos;
 std::vector<VSlot> v1;
 std::array<std::vector<VSlot>,6> upper;int used=0,limit=0;uint32_t epoch=1;struct Limit{};
 Planner(const Model&m,float scale):m(m),scale(scale),decks(8192),cache(8192),geos(8192),v1(65536){for(int k=2;k<6;k++)upper[k].resize(16384);}
 Deck& deck(unsigned deck){
  auto& z=decks[KeyHash{}(deck)&(decks.size()-1)];if(z.key==deck)return z;
  z.key=deck;z.count=__builtin_popcount(deck);int count[22]={};z.sum=0;
  for(unsigned bits=deck;bits;bits&=bits-1){int c=m.hinge.codec.idmap[__builtin_ctz(bits)+1]-1;++count[c];z.sum+=DECK_COEFF[c+1];}
  z.afterSum=z.count==1?0:z.sum*(1-1.f/z.count);
  if(!scale)return z;
  for(int h=0;h<H;h++){
   float x=m.a[h][72]*(z.count/30.f)+m.a[h][73]/(1+.2f*z.count)+m.a[h][74]*std::max(0.f,1-z.count/10.f)+m.a[h][75]*std::sqrt(float(z.count))/5.5f;
   #pragma omp simd reduction(+:x)
   for(int j=0;j<22;j++){float de=count[j]-z.count*m.hinge.codec.capacity[j+1]/30.f;x+=de*(5.f/(z.count+1)*m.a[h][22+j]+m.a[h][44+j]);}
   z.x[h]=x;
  }return z;
 }
 Vec embedding(int rank,unsigned mask){
  auto& z=deck(mask);Hidden y;
  for(int h=0;h<H;h++)y[h]=std::max(0.f,m.hands[rank][h]+z.x[h]);
  Vec out;
  for(int j=0;j<D;j++){float x=0;
   #pragma omp simd reduction(+:x)
   for(int h=0;h<H;h++)x+=y[h]*m.c[j][h];out[j]=m.d[j]+x;
  }return out;
 }
 Ctx& setup(int rank,unsigned mask,bool draw){
  auto key=(uint64_t(mask)<<17)|rank;auto& z=cache[KeyHash{}(key)&(cache.size()-1)];
  if(z.key!=key){z.key=key;z.hasDraw=false;if(scale)z.actual=embedding(rank,mask);}
  if(draw&&!z.hasDraw){
   int k=m.hinge.k;z.draw.fill(0);std::fill(z.phi,z.phi+k,0.f);float norm=1.f/__builtin_popcount(mask);
   for(auto bits=mask;bits;bits&=bits-1){
    int bit=__builtin_ctz(bits),c=m.hinge.codec.idmap[bit+1],rh=m.hinge.add[rank][c];unsigned next=mask^(1u<<bit);
    if(scale){Vec vec=embedding(rh,next?next:0x3fffffffu);for(int l=0;l<D;l++)z.draw[l]+=vec[l];}
    const float *ph=m.hinge.hand+size_t(rh)*k;
    #pragma omp simd
    for(int l=0;l<k;l++)z.phi[l]+=ph[l];
   }
   for(auto&x:z.draw)x*=norm;
   for(int l=0;l<k;l++)z.phi[l]*=norm;
   z.hasDraw=true;
  }return z;
 }
 struct Val {float base=0,fix=0;};
 Val after(int rank,unsigned mask,int r,int b,int code){
  int p=code&4095;if(!r&&!b)return {(float)p,0};
  int k=m.hinge.k, row=(r*2+b)*(N+1)+p;
  bool draw=bool(code&4096)&&m.sizes[rank]<5;
  const auto& c=setup(rank,mask,draw);const auto& z=deck(mask);
  const float* h=draw?c.phi:m.hinge.hand+size_t(rank)*k;
  const float* g=m.hinge.geo+size_t(row)*k;
  float delta=0,hval=0;
  #pragma omp simd reduction(+:hval)
  for(int i=0;i<k;i++)hval+=g[i]*h[i];
  const auto& v=draw?c.draw:c.actual;const auto& gv=m.geometry[row];
  #pragma omp simd reduction(+:delta)
  for(int i=0;i<D;i++)delta+=gv[i]*v[i];
  const float deckv=.6f*std::min(1.f,.7f*(r+b)/(draw?(z.count==1?30:z.count-1):z.count))*(draw?z.afterSum:z.sum);
  return {m.hinge.base[row]+hval+deckv,delta*scale};
 }
 template<class F> Val integrate(const State&s,int id,F land){
  if(id&&CTYPE[id]!=2)return land(100-s.t,s.b,CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3]);
  double v=0,c=0;
  for(int d=2;d<=12;d++){
   int code=id?LAND[s.p+CVAL[id]*d+3]:ROLL[s.p*11+d-2];int dbl=!s.b&&d%2==0,ways=6-std::abs(7-d)-dbl;
   if(ways){auto y=land(100-s.t-!s.b,0,code);v+=ways*y.base;c+=ways*y.fix;}
   if(dbl){auto y=land(99-s.t,1,code);v+=y.base;c+=y.fix;}
  }return {float(v/36),float(c/36)};
 }
 Val q1(const State&s,int a,int rank){
  int id=a?s.h[a-1]:0,hr=id?m.remove[rank][m.hinge.codec.idmap[id]]:rank;
  return integrate(s,id,[&](int r,int b,int code){return after(hr,s.deck,r,b,code);});
 }
 Geo& stochasticGeometry(const State&s,int id){
  const int k=(100-s.t)*2+s.b;uint32_t key=((k*(N+1)+s.p)*32+id);auto& g=geos[(key*2654435761u)>>(32-13)];
  if(g.key==key)return g;g.key=key;g.base=0;
  for(int draw=0;draw<2;draw++){g.g[draw].fill(0);std::fill_n(g.phi[draw],m.hinge.k,0.f);g.mass[0][draw]=g.mass[1][draw]=0;}
  for(int sm=2;sm<=12;sm++){
   int land=id?LAND[s.p+CVAL[id]*sm+3]:ROLL[s.p*11+sm-2],pos=land&4095,draw=bool(land&4096),dbl=!s.b&&sm%2==0;
   for(int b=0;b<=dbl;b++){
    int count=b?1:6-std::abs(7-sm)-dbl;if(!count)continue;float w=count/36.f;
    int rem=k-(s.b?1:2)+b;
    if(!rem){g.base+=w*pos;continue;}
    int row=rem*(N+1)+pos;g.mass[b][draw]+=w;g.base+=w*m.hinge.base[row];
    const float* ptr=m.hinge.geo+size_t(row)*m.hinge.k;
    #pragma omp simd
    for(int i=0;i<m.hinge.k;i++)g.phi[draw][i]+=w*ptr[i];
    for(int j=0;j<D;j++)g.g[draw][j]+=w*m.geometry[row][j];
   }
  }return g;
 }
 float fastQ(const State&s,int a,int rank){
  int id=a?s.h[a-1]:0,hr=id?m.remove[rank][m.hinge.codec.idmap[id]]:rank;
  if(id&&CTYPE[id]!=2){auto y=after(hr,s.deck,100-s.t,s.b,CTYPE[id]==3?NEXT[s.p]:LAND[s.p+CVAL[id]+3]);return y.base+y.fix;}
  Geo& g=stochasticGeometry(s,id);bool can=m.sizes[hr]<5;
  bool draw=can&&(g.mass[0][1]+g.mass[1][1]>0);
  const auto& h=setup(hr,s.deck,draw);const auto& dc=deck(s.deck);
  const float* ph=m.hinge.hand+size_t(hr)*m.hinge.k;const float* pd=draw?h.phi:ph;
  float q=0,adj=0;
  #pragma omp simd reduction(+:q)
  for(int i=0;i<m.hinge.k;i++)q+=g.phi[0][i]*ph[i]+g.phi[1][i]*pd[i];
  const auto& v=draw?h.draw:h.actual;
  #pragma omp simd reduction(+:adj)
  for(int i=0;i<D;i++)adj+=g.g[0][i]*h.actual[i]+g.g[1][i]*v[i];
  q+=g.base+adj*scale;
  for(int b=0;b<=!s.b;b++){
   int r=100-s.t-!s.b+b;
   q+=.6f*std::min(1.f,.7f*r/dc.count)*dc.sum*(g.mass[b][0]+(!can)*g.mass[b][1]);
   if(can)q+=.6f*std::min(1.f,.7f*r/(dc.count==1?30:dc.count-1))*dc.afterSum*g.mass[b][1];
  }
  return q;
 }
 int one(const State&s,int rank,float& best){
  best=-1e10f;int a=0;for(int j=0;j<=s.n;j++){float v=fastQ(s,j,rank);if(v>best){best=v;a=j;}}return a;
 }
 float max1(const State&s,int rank){
  if(s.terminal())return s.p;
  // Physical-card masks require 30 bits and hand 17 bits. Board/horizon need 20 more.
  // Canonical deck codes need 27 bits, so the full key fits in 64 bits.
  const auto key=uint64_t(s.p)|(uint64_t(100-s.t)<<12)|(uint64_t(s.b)<<19)|(uint64_t(rank)<<20)|(uint64_t(m.hinge.codec.deckCode(s.deck))<<37);
  auto& v=v1[KeyHash{}(key)&(v1.size()-1)];if(v.key==key&&v.epoch==epoch)return v.value;
  if(limit&&++used>limit)throw Limit{};
  float result;one(s,rank,result);v={key,result,epoch};return result;
 }
 float deep(const State&s,int rank,int depth){
  if(depth==1)return max1(s,rank);
  const auto key=uint64_t(s.p)|(uint64_t(100-s.t)<<12)|(uint64_t(s.b)<<19)|(uint64_t(rank)<<20)|(uint64_t(m.hinge.codec.deckCode(s.deck))<<37);
  auto& z=upper[depth][KeyHash{}(key)&16383];if(z.key==key&&z.epoch==epoch)return z.value;
  if(limit&&++used>limit)throw Limit{};
  float best=-1e10f;for(int a=0;a<=s.n;a++)best=std::max(best,q2(s,a,rank,depth));z={key,best,epoch};return best;
 }
 float q2(const State&s,int a,int rank,int depth=2){
  State z=s;int id=a?z.h[a-1]:0,h=id?m.remove[rank][m.hinge.codec.idmap[id]]:rank;
  if(id){for(int j=a;j<z.n;j++)z.h[j-1]=z.h[j];--z.n;}
  return integrate(s,id,[&](int r,int b,int code)->Val{
   z.p=code&4095;z.t=100-r;z.b=b;if(z.terminal())return {(float)z.p,0};
   if(!(code&4096)||z.n==5)return {deep(z,h,depth-1),0};
   float v=0;auto mask=z.deck;++z.n;
   for(auto bits=mask;bits;bits&=bits-1){int bit=__builtin_ctz(bits);z.h[z.n-1]=bit+1;z.deck=mask^(1u<<bit);if(!z.deck)z.deck=0x3fffffff;
    v+=deep(z,m.hinge.add[h][m.hinge.codec.idmap[bit+1]],depth-1);
   }--z.n;z.deck=mask;return {v/__builtin_popcount(mask),0};
  }).base;
 }
 int choose(const State&s,int dep){
  if(!s.n)return 0;int rank=m.hinge.codec.hand(s);float best=-1e10f;
  if(dep==1)return one(s,rank,best);int a=0;
  std::array<float,6> q{};limit=0;used=0;if(dep>2)++epoch;
  for(int j=0;j<=s.n;j++){q[j]=q2(s,j,rank);if(q[j]>best){best=q[j];a=j;}}
  if(dep==2){lastQs=q;return a;}
  struct Child{int action;float prob;State state;int rank;bool done;};
  limit=dep;
  int acts[6],ac=0;uint32_t seen=0;
  for(int j=0;j<=s.n;j++){int c=j?m.hinge.codec.idmap[s.h[j-1]]:0;if(seen&(1u<<c))continue;seen|=1u<<c;acts[ac++]=j;}
  auto updateBest=[&](){a=acts[0];for(int k=1;k<ac;k++)if(q[acts[k]]>q[a])a=acts[k];};
  try{
   for(int depth=3;depth<=6;depth++){
    std::vector<Child> children;float second=-1e10f;for(int k=0;k<ac;k++)if(acts[k]!=a)second=std::max(second,q[acts[k]]);
    if(depth>3&&q[a]-second>1.5f)break;
    for(int k=0;k<ac;k++){
     int j=acts[k];if(depth>3&&q[a]-q[j]>1.5f)continue;
     for(const auto&b:branches(s,j,m.hinge.codec,false))if(!b.s.terminal())children.push_back({j,(float)b.prob,b.s,m.hinge.codec.hand(b.s),false});
    }
    for(size_t k=0;k<children.size();k++){
     int sel=-1;float bestPriority=-1;for(size_t i=0;i<children.size();i++){
      const auto&b=children[i];if(b.done)continue;float priority=b.prob/(1+2*(q[a]-q[b.action]));if(priority>bestPriority){sel=i;bestPriority=priority;}
     }
     auto&b=children[sel];float hi=deep(b.state,b.rank,depth-1),lo=deep(b.state,b.rank,depth-2);q[b.action]+=b.prob*(hi-lo);b.done=true;updateBest();
    }
   }
  }catch(const Limit&){}
  limit=0;
  for(int j=1;j<=s.n;j++)for(int k=0;k<ac;k++)
   if(acts[k]&&m.hinge.codec.idmap[s.h[acts[k]-1]]==m.hinge.codec.idmap[s.h[j-1]]){q[j]=q[acts[k]];break;}
  lastQs=q;return a;
 }
};
}
