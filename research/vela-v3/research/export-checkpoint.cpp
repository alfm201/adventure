#include "tier-model.hpp"
#include <zlib.h>
#include <iomanip>
#include <stdexcept>
static void writeall(gzFile f,const void*data,unsigned n){if(gzwrite(f,data,n)!=(int)n)throw std::runtime_error("gzip write");}
static void readall(gzFile f,void*data,unsigned n){if(gzread(f,data,n)!=(int)n)throw std::runtime_error("gzip read");}
int main(int argc,char**argv){try{
 if(argc<4)throw std::runtime_error("model-dir horizon output-prefix required");int r=std::stoi(argv[2]);TierModel m;m.load(argv[1],r);constexpr int H=80730;
 std::vector<int16_t>q(H);std::vector<unsigned char>lo(H),hi(H);long long count=0;std::string prefix=argv[3];
 for(int b=0;b<2;b++){
  std::string path=prefix+"_part"+std::to_string(b+1)+".qdelta.gz";gzFile out=gzopen(path.c_str(),"wb6");if(!out)throw std::runtime_error("gzip open");
  if(b==0){char magic[8]={'A','S','T','5','C','P','1',0};int hdr[4]={r,N,H,32};writeall(out,magic,8);writeall(out,hdr,16);}
  for(int p=0;p<=N;p++){
   float base=m.base(r,b,p);q[0]=0;
   for(int n=1;n<=5;n++){int width=m.first[n+1]-m.first[n];size_t ix=(size_t(r*2+b)*(N+1)+p)*width;
    std::memcpy(q.data()+m.first[n],(const char*)m.maps[n]+32+ix*2,size_t(width)*2);}
   uint16_t prev=0;for(int h=0;h<H;h++){uint16_t next=uint16_t(q[h]),d=uint16_t(next-prev);lo[h]=d&255;hi[h]=d>>8;prev=next;}
   writeall(out,&base,4);writeall(out,lo.data(),H);writeall(out,hi.data(),H);
  }
  if(gzclose(out)!=Z_OK)throw std::runtime_error("gzip close");
  gzFile in=gzopen(path.c_str(),"rb");if(!in)throw std::runtime_error("verify open");
  if(b==0){char hdr[24];readall(in,hdr,24);if(std::memcmp(hdr,"AST5CP1",7))throw std::runtime_error("verify magic");}
  for(int p=0;p<=N;p++){
   float base;readall(in,&base,4);readall(in,lo.data(),H);readall(in,hi.data(),H);if(base!=m.base(r,b,p))throw std::runtime_error("base mismatch");
   uint16_t prev=0;int n=0;
   for(int h=0;h<H;h++){while(n<5&&h>=m.first[n+1])n++;prev=uint16_t(prev+uint16_t(lo[h]|(uint16_t(hi[h])<<8)));
    if(int16_t(prev)!=std::lround(m.rawDelta(r,b,p,h,n)*32))throw std::runtime_error("quantized value mismatch");count++;}
  }
  char byte;if(gzread(in,&byte,1)!=0)throw std::runtime_error("trailing data");gzclose(in);
 }
 std::cout<<"{\"horizon\":"<<r<<",\"rows_checked\":"<<2*(N+1)<<",\"quantized_values_checked\":"<<count<<",\"lossless_roundtrip\":true,\"parts\":2,\"header_in_first_part_only\":true}\n";
 return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
