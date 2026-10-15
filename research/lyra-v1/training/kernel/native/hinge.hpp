#include "engine_factor.hpp"
#include "exact_dp.hpp"
#include <filesystem>
#include <sstream>
using Clock=std::chrono::steady_clock;
static double sec(Clock::time_point t){return std::chrono::duration<double>(Clock::now()-t).count();}
static std::string optionalMetric(double value,bool supported){if(!supported)return "null";std::ostringstream out;out<<std::setprecision(17)<<value;return out.str();}
struct QS{std::array<double,6>q;std::vector<int>a;int best=0;double gap=1e300;};
template<class P>QS inspect(P&p,const State&s,int d){
 QS z;z.q.fill(-1e300);uint32_t seen=0;int h=p.M.codec.hand(s);
 for(int a=0;a<=s.n;a++){int c=a?p.M.codec.idmap[s.h[a-1]]:0;if(seen&(1u<<c))continue;seen|=1u<<c;z.a.push_back(a);z.q[a]=p.Q(s,a,d,h);}
 std::stable_sort(z.a.begin(),z.a.end(),[&](int a,int b){return z.q[a]>z.q[b];});z.best=z.a[0];if(z.a.size()>1)z.gap=z.q[z.a[0]]-z.q[z.a[1]];return z;
}
struct Counts{
 uint64_t calls=0,withHand=0,deep3=0,deep4=0,cap3=0,cap4=0,terminal=0,terminalCap=0,changed=0,roundoff=0;
 uint64_t byR[5][4]={};
 Counts&operator+=(const Counts&o){calls+=o.calls;withHand+=o.withHand;deep3+=o.deep3;deep4+=o.deep4;cap3+=o.cap3;cap4+=o.cap4;terminal+=o.terminal;terminalCap+=o.terminalCap;changed+=o.changed;roundoff+=o.roundoff;for(int i=0;i<5;i++)for(int j=0;j<4;j++)byR[i][j]+=o.byR[i][j];return *this;}
};
struct Candidate {
 OptPlanner<true>p;ExactDP terminalDP;std::string mode;Counts c;
 std::array<double,6> lastQs{};int lastDepth=0,lastBase=0;double lastGap=1e300;
 Candidate(Compact100&m,Meta&t,std::string md,double gamma):p(m,t,"base",true,true),terminalDP(m,Stop::Terminal,5000),mode(md){p.gamma=gamma;}
 void invalidate(){if(++p.epoch==0){for(auto&tab:p.tt)for(auto&e:tab)e.gen=0;p.epoch=1;}}
 QS raw(const State&s,int d){p.rawMode=true;invalidate();try{auto z=inspect(p,s,d);p.rawMode=false;invalidate();++c.roundoff;return z;}catch(...){p.rawMode=false;invalidate();throw;}}
 QS checked(const State&s,int d,double gate=-1){
  auto z=inspect(p,s,d);double e=2*p.M.factorBound*(1+4*p.gamma);
  if(z.gap<=e||(gate>=0&&std::abs(z.gap-gate)<=e))z=raw(s,d);return z;
 }
 int act(const State&s){
  ++c.calls;lastDepth=0;lastGap=1e300;lastBase=0;if(!s.n)return 0;++c.withHand;
  p.clear();p.setBudget(0);int r=100-s.t,nd=__builtin_popcount(s.deck),bin=std::min(4,std::max(0,r-1)/20);++c.byR[bin][0];
  double gate=mode=="full1"?1.:mode=="event"?(nd<=8?1.:-1.):mode=="joint"?((nd<=8&&s.n>=2)?2.:.5):-1.;
  auto two=checked(s,2,gate);lastQs=two.q;int ans=two.best;lastBase=ans;lastGap=two.gap;lastDepth=2;
  if(mode=="base")return ans;
  if((mode=="event"&&r<=1)||(mode=="joint"&&r<=2)){
   double v;std::array<double,6>q;try{ans=terminalDP.inspect(s,0,v,q);++c.terminal;lastDepth=1000;c.changed+=ans!=two.best;return ans;}catch(const Limit&){++c.terminalCap;}
  }
  if(gate<0||two.gap>gate)return ans;
  ++c.byR[bin][1];p.setBudget(mode=="joint"?12000:0);QS three;
  try{three=checked(s,3,mode=="joint"&&nd<=6&&s.n>=3?.25:-1.);++c.deep3;lastDepth=3;ans=three.best;}
  catch(const SearchLimit&){++c.cap3;++c.byR[bin][3];p.setBudget(0);return ans;}
  p.setBudget(0);
  if(mode=="joint"&&three.gap<=.25&&nd<=6&&s.n>=3){p.setBudget(12000);try{auto four=checked(s,4);ans=four.best;++c.deep4;lastDepth=4;}catch(const SearchLimit&){++c.cap4;}p.setBudget(0);}
  if(ans!=two.best){++c.changed;++c.byR[bin][2];}return ans;
 }
};
