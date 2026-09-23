#include "pair-model.hpp"
#include <omp.h>
#include <chrono>
#include <cstring>
struct FourProject{
 int R,K=22,H=14950,P=2300,PP=276;ValueModel cls;
 std::vector<std::array<int,4>> hands,rem;std::vector<std::array<int,23>> add;std::vector<int>idx;
 std::vector<float>v,dr,wait,out,projection;
 FourProject(int r):R(r){cls.v.clear();cls.v.shrink_to_fit();idx.resize(23*23*23*23,-1);hands.push_back({0,0,0,0});for(int a=1;a<=K;a++)hands.push_back({a,0,0,0});for(int a=1;a<=K;a++)for(int b=a;b<=K;b++)hands.push_back({a,b,0,0});for(int a=1;a<=K;a++)for(int b=a;b<=K;b++)for(int c=b;c<=K;c++)hands.push_back({a,b,c,0});for(int a=1;a<=K;a++)for(int b=a;b<=K;b++)for(int c=b;c<=K;c++)for(int d=c;d<=K;d++)hands.push_back({a,b,c,d});H=hands.size();rem.resize(H);add.resize(P);
 for(int h=0;h<H;h++){auto a=hands[h];idx[a[0]+23*a[1]+529*a[2]+12167*a[3]]=h;}
 for(int h=0;h<H;h++)for(int j=0;j<4;j++){auto a=hands[h];for(int k=j;k<3;k++)a[k]=a[k+1];a[3]=0;rem[h][j]=idx[a[0]+23*a[1]+529*a[2]+12167*a[3]];}
 for(int h=0;h<P;h++)for(int c=1;c<=K;c++){auto a=hands[h];int n=(a[0]!=0)+(a[1]!=0)+(a[2]!=0);a[n]=c;std::sort(a.begin(),a.begin()+n+1);add[h][c]=idx[a[0]+23*a[1]+529*a[2]+12167*a[3]];}
 v.resize(4*(N+1)*H);dr.resize(4*(N+1)*P);wait.resize((N+1)*H);out.resize((N+1)*H);projection.resize((R+1)*2*(N+1)*PP);
 }
 float*row(int r,int b,int p){return v.data()+(((r%2)*2+b)*(N+1)+p)*H;}
 float*drow(int r,int b,int p){return dr.data()+(((r%2)*2+b)*(N+1)+p)*P;}
 double land(int r,int b,int code,int h){int p=code&4095;return ((code&4096)&&h<P)?drow(r,b,p)[h]:row(r,b,p)[h];}
 void updateDraw(int r,int b){
 #pragma omp parallel for schedule(static)
 for(int p=1;p<=N;p++){auto vv=row(r,b,p),dd=drow(r,b,p);for(int h=0;h<P;h++){double sum=0;for(int c=1;c<=K;c++)sum+=cls.freq[c]*vv[add[h][c]];dd[h]=sum/30;}}}
 void project(int r,int b){for(int p=1;p<=N;p++)std::copy(row(r,b,p),row(r,b,p)+PP,projection.data()+((r*2+b)*(N+1)+p)*PP);}
 void build(){for(int p=1;p<=N;p++)for(int h=0;h<H;h++)row(0,0,p)[h]=p;updateDraw(0,0);project(0,0);
 for(int r=0;r<=R;r++)for(int b=0;b<=1;b++){if(!r&&!b)continue;
 #pragma omp parallel for schedule(static)
 for(int p=1;p<=N;p++)for(int h=0;h<H;h++){double best=cls.diceExpectation(r,b,[&](int rr,int bb,int d){return land(rr,bb,ROLL[p*11+d-2],h);});
 for(int j=0;j<4;j++){int c=hands[h][j];if(c&&cls.types[c]==2){double val=cls.diceExpectation(r,b,[&](int rr,int bb,int d){return land(rr,bb,LAND[p+cls.values[c]*d+3],rem[h][j]);});best=std::max(best,val);}}
 wait[p*H+h]=row(r,b,p)[h]=best;}
 int it;double err=0;
 for(it=0;it<150;it++){updateDraw(r,b);err=0;
 #pragma omp parallel for schedule(static) reduction(max:err)
 for(int p=1;p<=N;p++)for(int h=0;h<H;h++){double val=wait[p*H+h];for(int j=0;j<4;j++){int c=hands[h][j];if(c&&cls.types[c]!=2){int code=cls.types[c]==3?NEXT[p]:LAND[p+cls.values[c]+3];val=std::max(val,land(r,b,code,rem[h][j]));}}out[p*H+h]=val;err=std::max(err,std::abs(val-row(r,b,p)[h]));}
 std::memcpy(row(r,b,0),out.data(),out.size()*4);if(err<.001)break;
 }updateDraw(r,b);project(r,b);if(r%4==0&&b==1)std::cerr<<"four-card layer "<<r<<" iter "<<it<<" residual "<<err<<'\n';
 }}
 void save(const char*path){std::ofstream f(path,std::ios::binary);f.write((char*)&R,4);f.write((char*)projection.data(),projection.size()*4);}
};
int main(int argc,char**argv){int r=argc>1?atoi(argv[1]):32;omp_set_num_threads(4);auto st=std::chrono::steady_clock::now();FourProject m(r);m.build();std::string path="results/four-projected-"+std::to_string(r)+".bin";m.save(path.c_str());std::cout<<"B0="<<m.projection[(r*2*(N+1)+1)*276]<<" seconds="<<std::chrono::duration<double>(std::chrono::steady_clock::now()-st).count()<<'\n';}
