// Full-hand finite-resource dynamic programming for the original board.
// Auxiliary model ONLY: card draws are IID from the 30-card population.
// The deployed game/evaluators retain non-replacement draws and the true cap 5.
#include "value-model.hpp"
#include <omp.h>
#include <chrono>
#include <cstring>
#include <filesystem>
#include <functional>
#include <iomanip>
#include <stdexcept>
#include <string>

struct HandSpace {
  int cap,H,P; static constexpr int first[7]={0,1,23,276,2300,14950,80730};
  std::vector<std::array<int,5>> hand,remove;
  std::vector<std::array<int,23>> add;
  std::vector<int> byClass[23];
  std::vector<int> index;
  std::vector<std::array<int,2>> use[23];
  static int encode(const std::array<int,5>& a) {
    return a[0]+23*a[1]+529*a[2]+12167*a[3]+279841*a[4];
  }
  explicit HandSpace(int capacity):cap(capacity),H(first[capacity+1]),P(first[capacity]) {
    if(cap<1||cap>5) throw std::runtime_error("invalid hand capacity");
    int radix=1;for(int j=0;j<cap;j++)radix*=23;
    index.assign(radix,-1);
    for(int n=0;n<=cap;n++) {
      std::array<int,5> a{};
      std::function<void(int,int)> enumerate=[&](int j,int low) {
        if(j==n){index[encode(a)]=hand.size();hand.push_back(a);return;}
        for(int c=low;c<=22;c++){a[j]=c;enumerate(j+1,c);}a[j]=0;
      };enumerate(0,1);
    }
    if(int(hand.size())!=H)throw std::runtime_error("enumeration count");
    remove.resize(H);add.resize(P);
    for(int h=1;h<H;h++)for(int j=0;j<cap&&hand[h][j];j++) {
      auto a=hand[h];int c=a[j];for(int k=j;k<4;k++)a[k]=a[k+1];a[4]=0;
      int rem=index[encode(a)];if(rem<0)throw std::runtime_error("remove index");
      remove[h][j]=rem;if(j==0||hand[h][j]!=hand[h][j-1])use[c].push_back({h,rem});
    }
    for(int c=1;c<=22;c++)byClass[c].resize(P);
    for(int h=0;h<P;h++)for(int c=1;c<=22;c++){
      auto a=hand[h];int n=0;while(n<5&&a[n])n++;a[n]=c;
      std::sort(a.begin(),a.begin()+n+1);add[h][c]=index[encode(a)];
      if(add[h][c]<0)throw std::runtime_error("add index");byClass[c][h]=add[h][c];
    }
  }
};

struct Solver {
  int R,startR;HandSpace hs;ValueModel classes;std::string dir;
  std::vector<float> v,draw,wait;
  std::ofstream tier[6],projected;
  int completedLayer=-1;double quantError=0;
  Solver(int cap,int horizon,const std::string& out,int resume=-1):R(horizon),startR(resume),hs(cap),dir(out){
    classes.v.clear();classes.v.shrink_to_fit();std::filesystem::create_directories(dir);
    v.resize(size_t(2)*(N+1)*hs.H);draw.resize(size_t(2)*(N+1)*hs.P);wait.resize(size_t(N+1)*hs.H);
    if(startR>=0){
      std::vector<float> bases(size_t(2)*(N+1));
      std::ifstream f(dir+"/tier0.f32",std::ios::binary);
      f.seekg(32+size_t(startR*2)*(N+1)*4);f.read((char*)bases.data(),bases.size()*4);
      if(!f)throw std::runtime_error("resume bases");
      for(int b=0;b<2;b++)for(int p=0;p<=N;p++)row(b,p)[0]=bases[b*(N+1)+p];
      for(int n=1;n<=cap;n++){
        int lo=hs.first[n],len=hs.first[n+1]-lo;std::vector<int16_t> q(len);
        std::ifstream in(dir+"/tier"+std::to_string(n)+".i16",std::ios::binary);
        int hdr[8];in.read((char*)hdr,32);
        if(hdr[0]!=0x33545341||hdr[3]!=N||hdr[4]!=cap||hdr[6]!=len||hdr[7]!=32)throw std::runtime_error("resume header");
        in.seekg(32+size_t(startR*2)*(N+1)*len*2);
        for(int b=0;b<2;b++)for(int p=0;p<=N;p++){
          in.read((char*)q.data(),size_t(len)*2);float* vv=row(b,p);float base=vv[0];
          for(int k=0;k<len;k++)vv[lo+k]=base+q[k]/32.f;
        }
        if(!in)throw std::runtime_error("resume values");
      }
    }
    for(int n=0;n<=cap;n++){
      auto path=dir+"/tier"+std::to_string(n)+(n?".i16":".f32");
      int width=hs.first[n+1]-hs.first[n];
      if(startR>=0)std::filesystem::resize_file(path,32+size_t(2*(startR+1))*(N+1)*width*(n?2:4));
      tier[n].open(path,std::ios::binary|(startR>=0?std::ios::app:std::ios::trunc));
      int hdr[8]={0x33545341,1,R,N,cap,n,width,32};
      if(startR<0)tier[n].write((char*)hdr,sizeof hdr);
      if(!tier[n])throw std::runtime_error("tier file open");
    }
    if(startR>=0)std::filesystem::resize_file(dir+"/pair.bin",4+size_t(2*(startR+1))*(N+1)*276*4);
    projected.open(dir+"/pair.bin",std::ios::binary|(startR>=0?std::ios::app:std::ios::trunc));
    if(startR<0)projected.write((char*)&R,4);
  }

  float* row(int b,int p){return v.data()+(size_t(b)*(N+1)+p)*hs.H;}
  float* drow(int b,int p){return draw.data()+(size_t(b)*(N+1)+p)*hs.P;}
  void updateDraw(int b){
    #pragma omp parallel
    {
      std::vector<double> sum(hs.P);
      #pragma omp for schedule(static)
      for(int p=1;p<=N;p++){
        const float* vv=row(b,p);float* dd=drow(b,p);
        std::fill(sum.begin(),sum.end(),0.0);
        for(int c=1;c<=22;c++){
          const int* map=hs.byClass[c].data();double w=classes.freq[c];
          #pragma omp simd
          for(int h=0;h<hs.P;h++)sum[h]+=w*double(vv[map[h]]);
        }
        for(int h=0;h<hs.P;h++)dd[h]=sum[h]/30.0;
      }
    }
  }
  // Vectorize over hands, not dice outcomes. Each multiplier backup for a
  // remaining hand is reused by all hands containing that multiplier.
  void expectation(int r,int b,int p,int mult,int len,std::vector<double>& sum){
    std::fill(sum.begin(),sum.begin()+len,0.0);
    for(int d=2;d<=12;d++){
      int count=6-std::abs(7-d),doub=(d%2==0);
      int code=mult?LAND[p+mult*d+3]:ROLL[p*11+d-2],dest=code&4095;
      for(int bb=0;bb<=1;bb++){
        int w=b?(bb?0:count):(bb?doub:count-doub);if(!w)continue;
        const float* vv=row(bb,dest);
        int low=(code&4096)?std::min(len,hs.P):0;
        const float* dd=drow(bb,dest);
        for(int h=0;h<low;h++)sum[h]+=w*double(dd[h]);
        for(int h=low;h<len;h++)sum[h]+=w*double(vv[h]);
      }
    }
    for(int h=0;h<len;h++)sum[h]/=36.0;
  }
  void chance(int r,int b){
    #pragma omp parallel
    {
      std::vector<double> tmp(hs.H);
      #pragma omp for schedule(static)
      for(int p=1;p<=N;p++){
        float* dst=wait.data()+size_t(p)*hs.H;
        expectation(r,b,p,0,hs.H,tmp);
        for(int h=0;h<hs.H;h++)dst[h]=tmp[h];
        for(int c=1;c<=22;c++)if(classes.types[c]==2){
          expectation(r,b,p,classes.values[c],hs.P,tmp);
          for(const auto& u:hs.use[c])dst[u[0]]=std::max(dst[u[0]],float(tmp[u[1]]));
        }
      }
    }
    // Old resource layers must stay intact until ALL chance backups finish.
    std::memcpy(row(b,0),wait.data(),wait.size()*sizeof(float));
  }
  double freeBackup(int b){
    double error=0;
    for(int count=1;count<=hs.cap;count++){
      #pragma omp parallel for schedule(static) reduction(max:error)
      for(int p=1;p<=N;p++){
        const float* target[23]={};
        for(int c=1;c<=22;c++)if(classes.types[c]!=2){
          int code=classes.types[c]==3?NEXT[p]:LAND[p+classes.values[c]+3];
          target[c]=(code&4096)?drow(b,code&4095):row(b,code&4095);
        }
        float* vv=row(b,p);const float* ww=wait.data()+size_t(p)*hs.H;
        for(int h=hs.first[count];h<hs.first[count+1];h++){
          float best=ww[h];
          for(int j=0;j<count;j++){
            const float* t=target[hs.hand[h][j]];
            if(t)best=std::max(best,t[hs.remove[h][j]]);
          }
          error=std::max(error,std::abs(double(best)-vv[h]));vv[h]=best;
        }
      }
    }
    return error;
  }
  void save(int r,int b){
    for(int p=0;p<=N;p++)tier[0].write((char*)row(b,p),4);
    for(int n=1;n<=hs.cap;n++){
      int lo=hs.first[n],len=hs.first[n+1]-lo;std::vector<int16_t> q(len);
      for(int p=0;p<=N;p++){
        auto vv=row(b,p);float base=vv[0];
        for(int k=0;k<len;k++){
          double delta=double(vv[lo+k])-base;long val=std::lround(32*delta);
          if(val<-32768||val>32767)throw std::runtime_error("quantization range");
          q[k]=val;quantError=std::max(quantError,std::abs(delta-val/32.0));
        }
        tier[n].write((char*)q.data(),size_t(len)*2);
      }
    }
    for(int p=0;p<=N;p++)projected.write((char*)row(b,p),276*4);
    for(int n=0;n<=hs.cap;n++){tier[n].flush();if(!tier[n])throw std::runtime_error("tier write");}
    projected.flush();if(!projected)throw std::runtime_error("projection write");
    completedLayer=r*2+b;
    std::ofstream ready(dir+"/ready.tmp");ready<<"{\"horizon\":"<<R<<",\"completed_layer\":"<<completedLayer<<",\"cap\":"<<hs.cap<<",\"quantization_max_error\":"<<std::setprecision(12)<<quantError<<"}";ready.close();
    std::filesystem::rename(dir+"/ready.tmp",dir+"/ready.json");
  }
  void build(){
    auto start=std::chrono::steady_clock::now();
    if(startR<0){for(int p=1;p<=N;p++)std::fill(row(0,p),row(0,p)+hs.H,float(p));updateDraw(0);save(0,0);}
    else{updateDraw(0);updateDraw(1);}
    for(int r=std::max(0,startR+1);r<=R;r++)for(int b=0;b<=1;b++){
      if(!r&&!b)continue;chance(r,b);int it=0;double err=0;
      for(;it<150;it++){updateDraw(b);err=freeBackup(b);if(err<.001)break;}
      if(it==150)throw std::runtime_error("Bellman iteration did not converge");
      updateDraw(b);save(r,b);
      std::cerr<<"cap="<<hs.cap<<" r="<<r<<" b="<<b<<" iterations="<<it+1<<" residual="<<err<<" B0="<<row(b,1)[0]<<" seconds="<<std::chrono::duration<double>(std::chrono::steady_clock::now()-start).count()<<std::endl;
    }
  }
};
int main(int argc,char**argv){try{
  if(argc<4){std::cerr<<"usage: solve-hands CAP HORIZON OUTPUT_DIR [THREADS]\n";return 2;}
  int cap=std::stoi(argv[1]),r=std::stoi(argv[2]);if(cap<2||cap>5||r<0||r>100)throw std::runtime_error("argument range");
  omp_set_num_threads(argc>4?std::stoi(argv[4]):4);Solver solver(cap,r,argv[3],argc>5?std::stoi(argv[5]):-1);solver.build();return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
