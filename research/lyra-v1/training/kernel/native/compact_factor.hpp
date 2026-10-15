#include "core.hpp"
#pragma once
#include <memory>
#include <sstream>
inline int OPT=0;
inline thread_local uint64_t LC=0,LH=0,RB=0;
struct Compact {
 Codec codec;std::vector<std::array<int,23>> add;std::vector<std::array<int16_t,16>> sub;
 int R=48,Q=0,K=0,TG=0,J=0;std::vector<float>B,T,A,PHI,GT,GA,LP;
 static constexpr int MaxK=256,MaxLocal=32,LocalOffset=275+MaxK;
 bool hasLocal=false;int L=0,Llo=0,Lhi=-1;float lps=1,lcs=1;std::vector<int16_t>LPQ,LCQ;
 bool quant=false,exactSingleton=false;std::vector<int16_t>AQ,PQ,GQ,SQ;float as=1,ps=1,gs=1;
 int horizon()const{return R;}
 std::vector<uint64_t> sk;std::vector<float> sv;
 static void read(std::istream&f,std::vector<float>&v,size_t n){v.resize(n);if(n)f.read((char*)v.data(),n*4);if(!f)throw std::runtime_error("compact truncated");}
 Compact(const char*data,unsigned int bytes){if(bytes!=91179876)throw std::runtime_error("Hinge model size");std::istringstream f(std::string(data,bytes),std::ios::binary);int h[8];f.read((char*)h,32);const int expected[8]={0x56435332,100,N+1,0,256,16,0,0};if(std::memcmp(h,expected,32))throw std::runtime_error("Hinge model header");if(!f||(h[0]!=0x56435331&&h[0]!=0x56435332&&h[0]!=0x56435333&&h[0]!=0x56435334)||h[2]!=N+1)throw std::runtime_error("compact header");hasLocal=h[0]==0x56435334;exactSingleton=h[0]==0x56435333;quant=h[0]!=0x56435331;R=h[1];Q=h[3];K=h[4];TG=h[5];J=exactSingleton?0:h[6];int ns=h[7];
  if(R!=100||Q<0||Q>101||K<1||K>MaxK||TG<1||TG>101||J<0||J>64||ns<0||ns>10000000)throw std::runtime_error("compact dimensions");
  if(exactSingleton&&(Q!=0||h[6]!=1||ns!=0))throw std::runtime_error("singleton format");
  if(hasLocal&&(Q!=0||h[6]!=0||ns!=0))throw std::runtime_error("local format");
  if(quant&&J)throw std::runtime_error("quantized low projection unsupported");
  auto rq=[&](std::vector<int16_t>&v,size_t n,float&scale){f.read((char*)&scale,4);v.resize(n);if(n)f.read((char*)v.data(),n*2);if(!f||!std::isfinite(scale)||scale<=0)throw std::runtime_error("quant truncated or invalid scale");};
  read(f,B,(R+1)*2*(N+1));
  if(exactSingleton){SQ.resize(size_t(R+1)*2*(N+1)*22);f.read((char*)SQ.data(),SQ.size()*2);if(!f)throw std::runtime_error("singleton truncated");}
  read(f,T,(R+1)*Q);if(quant)rq(AQ,size_t(2)*(N+1)*275*Q,as);else read(f,A,size_t(2)*(N+1)*(J?J:275)*Q);read(f,LP,275*J);if(quant)rq(PQ,80730*K,ps);else read(f,PHI,80730*K);read(f,GT,(R+1)*TG);if(quant)rq(GQ,size_t(2)*(N+1)*K*TG,gs);else read(f,GA,size_t(2)*(N+1)*K*TG);
  sk.resize(ns);sv.resize(ns);if(ns){f.read((char*)sk.data(),ns*8);f.read((char*)sv.data(),ns*4);}if(!f)throw std::runtime_error("sparse truncated");
  if(hasLocal){
   int lh[4];f.read((char*)lh,16);if(!f||lh[0]!=0x4c4f434c||lh[1]<0||lh[2]<lh[1]||lh[2]>100||lh[3]<1||lh[3]>MaxLocal)throw std::runtime_error("local descriptor");
   Llo=lh[1];Lhi=lh[2];L=lh[3];rq(LPQ,size_t(80730)*L,lps);rq(LCQ,size_t(Lhi-Llo+1)*2*(N+1)*L,lcs);
   for(int k=0;k<L;k++)if(LPQ[k]!=0)throw std::runtime_error("local empty-hand basis must be zero");
  }
  if(f.peek()!=std::char_traits<char>::eof())throw std::runtime_error("model trailing bytes");
  for(const auto*v:{&B,&T,&A,&PHI,&GT,&GA,&LP,&sv})for(float a:*v)if(!std::isfinite(a))throw std::runtime_error("nonfinite model parameter");
  if(exactSingleton)for(int h=0;h<23;h++)for(int k=0;k<K;k++)if(PQ[size_t(h)*K+k]!=0)throw std::runtime_error("singleton residual must be zero");
  if((OPT&128)&&quant){std::vector<int16_t>tmp(AQ.size());for(int x=0;x<2*(N+1);x++)for(int j=0;j<Q;j++)for(int k=0;k<275;k++)tmp[(size_t(x)*Q+j)*275+k]=AQ[(size_t(x)*275+k)*Q+j];AQ.swap(tmp);}
  if((OPT&512)&&quant){PHI.resize(PQ.size());for(size_t i=0;i<PQ.size();i++)PHI[i]=PQ[i]*ps;std::vector<int16_t>().swap(PQ);}
  if((OPT&1024)&&quant){GA.resize(GQ.size());for(size_t i=0;i<GQ.size();i++)GA[i]=GQ[i]*gs;std::vector<int16_t>().swap(GQ);}
  if(OPT&4096)initFactor();
  add.resize(14950);sub.resize(80730);int c[5]={},ix=0;
  auto gen=[&](auto&&self,int pos,int n,int low)->void{if(pos==n){sub[ix].fill(-1);int z=0;for(int j=0;j<n;j++)sub[ix][z++]=c[j]-1;for(int j=0;j<n;j++)for(int k=j+1;k<n;k++){int p[2]={c[j],c[k]};sub[ix][z++]=codec.rank(p,2)-1;}if(n<5)for(int x=1;x<=22;x++){int d[5];std::copy(c,c+n,d);d[n]=x;std::sort(d,d+n+1);add[ix][x]=codec.rank(d,n+1);}ix++;return;}for(int x=low;x<=22;x++){c[pos]=x;self(self,pos+1,n,x);}};for(int n=0;n<=5;n++)gen(gen,0,n,1);
 }
  struct Row {int tag=-1;float v[LocalOffset+MaxLocal];uint64_t valid[5]={};};
 Row& getRow(int r,int b,int p)const{int x=b*(N+1)+p,row=r*2*(N+1)+x;
  static thread_local std::vector<Row> cache((OPT&16)?8192:2048);static thread_local const Compact*owner=nullptr;
  if(owner!=this){for(auto&z:cache)z.tag=-1;owner=this;}
  size_t idx=(OPT&8)?KeyHash{}(row):uint32_t(row)*2654435761u; Row&z=cache[idx&(cache.size()-1)];
  if(z.tag!=row){++RB;z.tag=row;const float*t=Q?&T[r*Q]:nullptr;
   if(Q==0){std::fill(z.v,z.v+275,0.f);if(exactSingleton)for(int c=0;c<22;c++)z.v[c]=SQ[size_t(row)*22+c]/32.f;for(auto&m:z.valid)m=~0ULL;}
   else if(!(OPT&(32|256))){
   if(quant&&(OPT&128)){double acc[275]={};for(int j=0;j<Q;j++){const int16_t*a=&AQ[(size_t(x)*Q+j)*275];for(int c=0;c<275;c++)acc[c]+=t[j]*(a[c]*as);}for(int c=0;c<275;c++)z.v[c]=acc[c];}
   else if(quant){for(int c=0;c<275;c++){double v=0;const int16_t*a=&AQ[(size_t(x)*275+c)*Q];for(int j=0;j<Q;j++)v+=t[j]*(a[j]*as);z.v[c]=v;}}
   else if(!J){for(int c=0;c<275;c++){double v=0;const float*a=&A[(size_t(x)*275+c)*Q];for(int j=0;j<Q;j++)v+=t[j]*a[j];z.v[c]=v;}}
   else{float d[64];for(int k=0;k<J;k++){double v=0;const float*a=&A[(size_t(x)*J+k)*Q];for(int j=0;j<Q;j++)v+=t[j]*a[j];d[k]=v;}for(int c=0;c<275;c++){double v=0;for(int k=0;k<J;k++)v+=d[k]*LP[c*J+k];z.v[c]=v;}}
   }else{for(auto&m:z.valid)m=0;}
   for(int k=0;k<K;k++){double v=0;for(int j=0;j<TG;j++)v+=GT[r*TG+j]*(quant&&!(OPT&1024)?GQ[(size_t(x)*K+k)*TG+j]*gs:GA[(size_t(x)*K+k)*TG+j]);z.v[275+k]=v;}
   if(L)for(int k=0;k<L;k++)z.v[LocalOffset+k]=(r>=Llo&&r<=Lhi)?LCQ[((size_t(r-Llo)*2*(N+1)+x)*L)+k]*lcs:0.f;
  }
  return z;
 }
 struct FactorEntry{uint64_t key=~0ULL;double phi[MaxK]={},local[MaxLocal]={};};
 float phiValue(int h,int k)const{return quant&&!(OPT&512)?PQ[size_t(h)*K+k]*ps:PHI[size_t(h)*K+k];}
 float localPhi(int h,int k)const{return LPQ[size_t(h)*L+k]*lps;}
 double factorBound=.01;double factorNorm=0;int pairIndex[23][23]={};
 void initFactor(){if(!quant||J||!sk.empty()||K>MaxK||R!=100)throw std::runtime_error("factorization requires native finite model");
  for(int i=1;i<=22;i++)for(int j=1;j<=22;j++){int a[2]={std::min(i,j),std::max(i,j)};pairIndex[i][j]=codec.rank(a,2)-1;}
  std::vector<double> pm(K),gm(K*TG),gb(K);double cb=0,bmax=0;
  for(int h=0;h<80730;h++)for(int k=0;k<K;k++)pm[k]=std::max(pm[k],std::abs(double(phiValue(h,k))));
  for(int x=0;x<2*(N+1);x++)for(int k=0;k<K;k++)for(int j=0;j<TG;j++){size_t i=(size_t(x)*K+k)*TG+j;double v=(OPT&1024)?GA[i]:GQ[i]*gs;gm[k*TG+j]=std::max(gm[k*TG+j],std::abs(v));}
  for(int r=0;r<=R;r++)for(int k=0;k<K;k++){double v=0;for(int j=0;j<TG;j++)v+=std::abs(double(GT[r*TG+j]))*gm[k*TG+j];gb[k]=std::max(gb[k],v*1.000001);}
  for(int k=0;k<K;k++)factorNorm+=pm[k]*gb[k];for(float v:B)bmax=std::max(bmax,std::abs(double(v)));
  if(L){std::vector<double> lm(L),cm(L);for(int h=0;h<80730;h++)for(int k=0;k<L;k++)lm[k]=std::max(lm[k],std::abs(double(localPhi(h,k))));for(size_t i=0;i<LCQ.size();i++)cm[i%L]=std::max(cm[i%L],std::abs(double(LCQ[i]*lcs)));for(int k=0;k<L;k++)factorNorm+=lm[k]*cm[k]*1.000001;}
  double aqmax=0,tmax=0;for(int16_t v:AQ)aqmax=std::max(aqmax,std::abs(double(v*as)));for(int r=0;r<=R;r++){double a=0;for(int j=0;j<Q;j++)a+=std::abs(double(T[r*Q+j]));tmax=std::max(tmax,a);}cb=aqmax*tmax*1.000001;if(exactSingleton)for(int16_t v:SQ)cb=std::max(cb,std::abs(double(v)/32));
  double dp=0;for(int c=1;c<=22;c++)dp+=codec.capacity[c]*std::abs(DECK_COEFF[c]);double round64=4096*std::numeric_limits<double>::epsilon()*(bmax+15*cb+factorNorm+dp+1);
  factorBound=std::max(.01,4*std::ldexp(1.,-24)*factorNorm+round64+1e-8);if(!std::isfinite(factorBound))throw std::runtime_error("nonfinite factor bound");
 }
 template<class Hand,class Deck>double expectedDraw(int r,int b,int p,int h,const Hand&hm,const Deck&dc)const{
  if(!r&&!b)return p;auto&z=getRow(r,b,p);double value=B[r*2*(N+1)+b*(N+1)+p];for(int j=0;j<15&&sub[h][j]>=0;j++)value+=z.v[sub[h][j]];
  long double addsum=0;for(int j=0;j<dc.k;j++){int c=dc.c[j];double v=z.v[c-1];for(int i=0;i<hm.n;i++)v+=z.v[pairIndex[sub[h][i]+1][c]];addsum+=(long double)dc.count[j]*v;}value+=double(addsum/dc.n);
  static thread_local std::vector<FactorEntry> fc(1024);static thread_local const Compact*owner=nullptr;if(owner!=this){for(auto&e:fc)e.key=~0ULL;owner=this;}
  uint64_t key=uint64_t(h)|(uint64_t(dc.code)<<17);auto&e=fc[KeyHash{}(key)&1023];if(e.key!=key){e.key=key;for(int k=0;k<K;k++){long double v=0;for(int j=0;j<dc.k;j++)v+=(long double)dc.count[j]*phiValue(hm.add[dc.c[j]],k);e.phi[k]=double(v/dc.n);}for(int k=0;k<L;k++){long double v=0;for(int j=0;j<dc.k;j++)v+=(long double)dc.count[j]*localPhi(hm.add[dc.c[j]],k);e.local[k]=double(v/dc.n);}}
  for(int k=0;k<K;k++)value+=e.phi[k]*z.v[275+k];if(r>=Llo&&r<=Lhi)for(int k=0;k<L;k++)value+=e.local[k]*z.v[LocalOffset+k];return value;
 }

 double val(int r,int b,int p,int h,int n)const{
  if(!r&&!b)return p;int x=b*(N+1)+p,row=r*2*(N+1)+x;if(!n)return B[row];
  ++LC; struct Leaf{uint64_t key=~0ULL;double v=0;}; static thread_local std::vector<Leaf> leaves((OPT&2)?65536:0); static thread_local const Compact*lo=nullptr; if(lo!=this){for(auto&l:leaves)l.key=~0ULL;lo=this;} uint64_t lk=uint64_t(row)*80730+h; if((OPT&2)&&leaves[KeyHash{}(lk)&65535].key==lk){++LH;return leaves[KeyHash{}(lk)&65535].v;}
  Row&z=getRow(r,b,p);
  auto coefficient=[&](int c)->float{if(Q>0&&(OPT&(32|256))&&!(z.valid[c/64]&(1ULL<<(c%64)))){if(!quant||J)throw std::runtime_error("lazy requires native quant");const float*t=&T[r*Q];if(OPT&256){int low=(c/16)*16,len=std::min(16,275-low);double acc[16]={};for(int j=0;j<Q;j++){const int16_t*a=&AQ[(size_t(x)*Q+j)*275+low];for(int k=0;k<len;k++)acc[k]+=t[j]*(a[k]*as);}for(int k=0;k<len;k++)z.v[low+k]=acc[k];z.valid[low/64]|=((1ULL<<len)-1)<<(low%64);}else{double v=0;for(int j=0;j<Q;j++)v+=t[j]*(((OPT&128)?AQ[(size_t(x)*Q+j)*275+c]:AQ[(size_t(x)*275+c)*Q+j])*as);z.v[c]=v;z.valid[c/64]|=1ULL<<(c%64);}}return z.v[c];};
  double v=B[row];for(int j=0;j<15&&sub[h][j]>=0;j++)v+=coefficient(sub[h][j]);
  for(int k=0;k<K;k++)v+=(quant&&!(OPT&512)?PQ[h*K+k]*ps:PHI[h*K+k])*z.v[275+k];
  if(r>=Llo&&r<=Lhi)for(int k=0;k<L;k++)v+=localPhi(h,k)*z.v[LocalOffset+k];
  if(!sk.empty()){uint64_t key=uint64_t(row)*80730+h;auto it=std::lower_bound(sk.begin(),sk.end(),key);if(it!=sk.end()&&*it==key)v+=sv[it-sk.begin()];}
  if(OPT&2)leaves[KeyHash{}(lk)&65535]={lk,v};
  return v;
 }
};
