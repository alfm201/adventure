#include "policy.hpp"
#include "../../finalrun/eval/game.hpp"
using namespace adventure_eval;
struct Row {int16_t p; uint8_t r,b,n,h[5]; uint16_t padding=0; uint32_t deck; float delta; uint32_t game;float deltaCorrection,correction;};
static_assert(sizeof(Row)==32);
int main(int argc,char**argv){
 if(argc!=8)return 2;
 warm::Model tbl("finalrun/warm/r256.bin");res::Model m(tbl,argv[1]);res::Planner pol(m,std::atof(argv[7]));
 int start=std::stoi(argv[3]),games=std::stoi(argv[4]),depth=std::stoi(argv[6]);uint32_t base=std::stoul(argv[5]);
 std::ofstream f(argv[2],std::ios::binary);double avg=0;
 for(int i=start;i<start+games;i++){
  State s;GameResult gr;Tape tape(mix(base+uint32_t(i)),TapeMode::split);
  while(!s.terminal()){
   int rank=tbl.codec.hand(s),a=0;float best=-1e10f;
   if(depth==1)a=pol.one(s,rank,best);else a=pol.choose(s,depth);
   auto q=pol.q1(s,a,rank);auto v=pol.after(rank,s.deck,100-s.t,s.b,s.p);
   Row row{};row.p=s.p;row.r=100-s.t;row.b=s.b;row.n=s.n;std::copy(s.h,s.h+s.n,row.h);row.deck=s.deck;
   row.delta=q.base-v.base;row.game=i;row.deltaCorrection=q.fix-v.fix;row.correction=v.fix;
   f.write((const char*)&row,sizeof(row));avg+=row.delta;
   advance(s,a,tape,gr);
  }
 }
 State s;std::cerr<<games<<" "<<avg/games+pol.after(0,s.deck,100,0,1).base<<"\n";
}
