#include "policy.hpp"
#include "../../finalrun/eval/game.hpp"
using namespace adventure_eval;
struct Row {int16_t p;uint8_t r,b,n,h[5];uint16_t padding=0;uint32_t deck;float delta;uint32_t game;};
struct Labeled {Row state;float martingale,current;};
int main(int argc,char**argv){
 if(argc!=6)return 2;
 warm::Model tbl("finalrun/warm/r256.bin");res::Model m(tbl,argv[1]);res::Planner policy(m,1);
 std::ifstream in(argv[2],std::ios::binary);std::ofstream out(argv[3],std::ios::binary);
 int samples=std::stoi(argv[4]);uint32_t seed=std::stoul(argv[5]);RNG selection(seed);
 in.seekg(0,std::ios::end);size_t total=size_t(in.tellg())/sizeof(Row);
 for(int i=0;i<samples;i++){
  Row row;in.seekg(selection.pick(total)*sizeof(row));in.read((char*)&row,sizeof(row));
  State s;s.p=row.p;s.t=100-row.r;s.b=row.b;s.n=row.n;std::copy(row.h,row.h+s.n,s.h);s.deck=row.deck;
  GameResult gr;Tape tape(mix(seed+i),TapeMode::split);
  advance(s,selection.pick(s.n+1),tape,gr);int length=3+selection.pick(6);
  for(int t=0;t<length&&!s.terminal();t++){
   int rank=tbl.codec.hand(s);float best=0;int a=policy.one(s,rank,best);
   auto q=policy.q1(s,a,rank),v=policy.after(rank,s.deck,100-s.t,s.b,s.p);
   Labeled y{};y.state.p=s.p;y.state.r=100-s.t;y.state.b=s.b;y.state.n=s.n;
   std::copy(s.h,s.h+s.n,y.state.h);y.state.deck=s.deck;y.state.delta=q.base-v.base;y.state.game=1000000+i;
   y.martingale=q.fix-v.fix;y.current=v.fix;out.write((char*)&y,sizeof(y));advance(s,a,tape,gr);
  }
 }
}
