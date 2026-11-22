#include "../../finalrun/warm/value.hpp"
#include "../../finalrun/eval/game.hpp"
using namespace adventure_eval;
struct Row {
 int16_t p; uint8_t r,b,n,h[5]; uint16_t padding=0;
 uint32_t deck; float delta; uint32_t game;
};
static_assert(sizeof(Row)==24);
int main(int argc,char**argv){
 if(argc!=6)return 2;
 warm::Model m(argv[1]);warm::Weights no;warm::Value v(m,no);
 int start=std::stoi(argv[3]),games=std::stoi(argv[4]);uint32_t base=std::stoul(argv[5]);
 std::ofstream f(argv[2],std::ios::binary);double avg=0;
 for(int i=start;i<start+games;i++){
  State s;GameResult gr;Tape tape(mix(base+uint32_t(i)),TapeMode::split);
  while(!s.terminal()){
   int a=0;double q=v.q(s,0);
   for(int j=1;j<=s.n;j++){double qa=v.q(s,j);if(qa>q){q=qa;a=j;}}
   Row row{};row.p=s.p;row.r=100-s.t;row.b=s.b;row.n=s.n;std::copy(s.h,s.h+s.n,row.h);row.deck=s.deck;
   row.delta=q-v.at(s);row.game=i;f.write((const char*)&row,sizeof(row));avg+=row.delta;
   advance(s,a,tape,gr);
  }
 }
 State s;std::cerr<<games<<" "<<avg/games+v.at(s)<<"\n";
}
