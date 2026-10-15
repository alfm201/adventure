// dk: shared C++ kernel for deck_actor_20261011 (DESIGN.md v3.2), loaded from Python via ctypes.
// One code path for: batched env + CV terms (f, mu), Hinge 2-step teacher labels (DESIGN §5), full Hinge games.
// Reference transition/CV code = ../s0/src/support.hpp (verified by S0-mu). Headers = runtime/vela-v4.2/native copies.
#include "support.hpp"
#include <condition_variable>
#include <functional>
#include <cstdio>
#include <climits>
#define DK extern "C" __declspec(dllexport)

static Compact100*Mp=nullptr;static Meta*Tp=nullptr;
// ---------------- persistent worker pool (keeps thread_local Hinge caches warm) ----------------
struct Pool{
 int n;std::vector<std::thread>th;std::mutex m;std::condition_variable cv,dn;std::function<void(int)>job;int gen=0,rem=0;bool stop=false;std::exception_ptr err;
 explicit Pool(int k):n(k){for(int w=0;w<n;w++)th.emplace_back([this,w]{int seen=0;for(;;){std::function<void(int)>j;{std::unique_lock l(m);cv.wait(l,[&]{return stop||gen!=seen;});if(stop)return;seen=gen;j=job;}
   try{j(w);}catch(...){std::lock_guard l(m);if(!err)err=std::current_exception();}{std::lock_guard l(m);if(--rem==0)dn.notify_all();}}});}
 void run(std::function<void(int)>f){std::unique_lock l(m);job=std::move(f);rem=n;err=nullptr;gen++;cv.notify_all();dn.wait(l,[&]{return rem==0;});if(err)std::rethrow_exception(err);}
 ~Pool(){{std::lock_guard l(m);stop=true;}cv.notify_all();for(auto&t:th)t.join();}
};
static Pool*P=nullptr;static std::vector<std::unique_ptr<Candidate>>C;
static thread_local std::string lastErr;static std::string gErr;
static void setErr(const std::string&e){gErr=e;}

// ---------------- teacher labels (DESIGN §5) ----------------
struct Label{int cls=0;float q[23];uint32_t mask=1;int bad=0;};
// Empty hand: roll only, lastQs is NOT read (act returns before refreshing it). Otherwise slots -> classes via idmap,
// only evaluated (first) slot per class kept, -1e300 never used. bad counts any rule violation (must stay 0).
static Label label(Candidate&A,const State&s){
 Label L;for(float&x:L.q)x=NAN;const Codec&c=A.p.M.codec;
 if(!s.n){L.cls=0;L.mask=1;return L;}
 int a=A.act(s);const auto&q=A.lastQs;double best=-1e300,qd[23];uint32_t seen=0;
 for(int j=0;j<=s.n;j++){int cl=j?c.idmap[s.h[j-1]]:0;bool first=!(seen>>cl&1);seen|=1u<<cl;bool ev=q[j]>-1e299;
  if(first!=ev)L.bad++;if(ev){L.mask|=1u<<cl;qd[cl]=q[j];best=std::max(best,q[j]);}}
 int ac=a?c.idmap[s.h[a-1]]:0;if(!(L.mask>>ac&1))L.bad++;if(q[a]!=best)L.bad++;
 // teacher slot must be the first slot of its class
 for(int j=1;j<a;j++)if(c.idmap[s.h[j-1]]==ac)L.bad++;
 for(int k=0;k<23;k++)if(L.mask>>k&1)L.q[k]=float(qd[k]-best);
 L.cls=ac;return L;
}
static int slotOf(const State&s,int cls,const Codec&c){if(!cls)return 0;for(int j=0;j<s.n;j++)if(c.idmap[s.h[j]]==cls)return j+1;return -1;}

// ---------------- batched env ----------------
struct Env{State s;Tape tape;uint32_t seed;int steps=0,done=0;double w0=0,sumd=0;long double mart=0;Env(uint32_t sd,int mode):tape(sd,mode),seed(sd){}};
static std::vector<Env>E;static long long envBad=0;

DK int dk_init(const wchar_t*model,int threads){try{
  OPT=4228;FILE*f=_wfopen(model,L"rb");if(!f)throw std::runtime_error("model open");std::vector<char>b;fseek(f,0,SEEK_END);long sz=ftell(f);fseek(f,0,SEEK_SET);b.resize(sz);if(fread(b.data(),1,sz,f)!=size_t(sz))throw std::runtime_error("model read");fclose(f);
  Mp=new Compact100(b.data(),b.size());Tp=new Meta(*Mp);P=new Pool(threads);for(int w=0;w<threads;w++)C.emplace_back(new Candidate(*Mp,*Tp,"base",0));return 0;
 }catch(const std::exception&e){setErr(e.what());return -1;}}
DK const char*dk_error(){return gErr.c_str();}
DK int dk_threads(){return P?P->n:0;}
// Tables for Python-side features. idmap[31], ctype/cval/capacity/rep[23] (class 0 = roll), LAND/ROLL/NEXT sizes via dk_table_sizes.
DK void dk_classes(int32_t*idmap,int32_t*ctype,int32_t*cval,int32_t*cap,int32_t*rep){const Codec&c=Mp->codec;for(int i=0;i<31;i++)idmap[i]=i?c.idmap[i]:0;for(int k=0;k<23;k++){ctype[k]=k?CTYPE[c.representative[k]]:0;cval[k]=k?CVAL[c.representative[k]]:0;cap[k]=k?c.capacity[k]:0;rep[k]=k?c.representative[k]:0;}}
DK void dk_table_sizes(int32_t*out){out[0]=N;out[1]=sizeof(LAND)/sizeof(int);out[2]=sizeof(ROLL)/sizeof(int);out[3]=sizeof(NEXT)/sizeof(int);}
DK void dk_tables(int32_t*land,int32_t*roll,int32_t*next){std::copy(std::begin(LAND),std::end(LAND),land);std::copy(std::begin(ROLL),std::end(ROLL),roll);std::copy(std::begin(NEXT),std::end(NEXT),next);}

DK int dk_env_reset(int n,const uint32_t*seeds,int mode){E.clear();E.reserve(n);for(int i=0;i<n;i++){E.emplace_back(seeds[i],mode);E.back().w0=Mp->leaf(E.back().s);}envBad=0;return 0;}
// obs row (50 int32): p,t,b,n,deckcount,done, hand class counts[22], deck class counts[22]
DK void dk_env_obs(int32_t*o){const Codec&c=Mp->codec;for(size_t i=0;i<E.size();i++){auto&s=E[i].s;int32_t*r=o+i*50;std::fill(r,r+50,0);r[0]=s.p;r[1]=s.t;r[2]=s.b;r[3]=s.n;r[4]=__builtin_popcount(s.deck);r[5]=E[i].done;
  for(int j=0;j<s.n;j++)r[6+c.idmap[s.h[j]]-1]++;for(uint32_t d=s.deck;d;d&=d-1)r[28+c.idmap[__builtin_ctz(d)+1]-1]++;}}
// raw state (11 int32): p,t,b,n,h[5],deck,done
DK void dk_env_raw(int32_t*o){for(size_t i=0;i<E.size();i++){auto&s=E[i].s;int32_t*r=o+i*11;r[0]=s.p;r[1]=s.t;r[2]=s.b;r[3]=s.n;for(int j=0;j<5;j++)r[4+j]=j<s.n?s.h[j]:0;r[9]=int32_t(s.deck);r[10]=E[i].done;}}
// Step every live env with a class action. Out: f(s), mu(s,a) (doubles), done flag, score (terminal p). Returns #illegal actions (must be 0).
DK long long dk_env_step(const int32_t*cls,double*fb,double*mu,int32_t*done,int32_t*score){try{
  std::atomic<size_t>next{0};std::atomic<long long>illegal{0},bad{0};
  P->run([&](int){for(;;){size_t i=next.fetch_add(64);if(i>=E.size())break;for(size_t k=i;k<std::min(E.size(),i+64);k++){auto&e=E[k];if(e.done){fb[k]=mu[k]=0;done[k]=1;score[k]=e.s.p;continue;}
     int a=slotOf(e.s,cls[k],Mp->codec);if(a<0){illegal++;a=0;}
     double f=Mp->leaf(e.s),m=leaf_expect(e.s,a,*Mp);sample_step(e.s,a,e.tape);double f2=Mp->leaf(e.s);
     e.sumd+=m-f;e.mart+=(long double)f2-m;if(++e.steps>1078)bad++;fb[k]=f;mu[k]=m;
     if(e.s.terminal()){e.done=1;if(std::abs((e.s.p-e.w0)-(e.sumd+double(e.mart)))>1e-6)bad++;}
     done[k]=e.done;score[k]=e.s.p;}}});
  envBad+=bad;return illegal;}catch(const std::exception&e){setErr(e.what());return -1;}}
// per-env summary (4 doubles): w0, sum delta, mart, steps
DK void dk_env_summary(double*o){for(size_t i=0;i<E.size();i++){o[i*4]=E[i].w0;o[i*4+1]=E[i].sumd;o[i*4+2]=double(E[i].mart);o[i*4+3]=E[i].steps;}}
DK long long dk_env_bad(){return envBad;}
// Teacher labels on current live envs: cls, qrel[23] (NaN = not evaluated/illegal), mask. Returns #rule violations (must be 0).
DK long long dk_env_teacher(int32_t*cls,float*q,uint32_t*mask){try{std::atomic<size_t>next{0};std::atomic<long long>bad{0};
  P->run([&](int w){for(;;){size_t i=next++;if(i>=E.size())break;if(E[i].done){cls[i]=0;mask[i]=0;for(int k=0;k<23;k++)q[i*23+k]=NAN;continue;}auto L=label(*C[w],E[i].s);cls[i]=L.cls;mask[i]=L.mask;std::copy(L.q,L.q+23,q+i*23);bad+=L.bad;}});
  return bad;}catch(const std::exception&e){setErr(e.what());return -1;}}

// ---------------- full Hinge games (teacher data / baseline) ----------------
#pragma pack(push,1)
struct TRec{uint32_t game;uint16_t step,p;uint8_t t,b,n,flags;uint8_t h[5];uint32_t deck;int8_t cls;uint8_t pad[2];uint32_t mask;float q[23];float f,mu;};
#pragma pack(pop)
static_assert(sizeof(TRec)==128,"TRec size");
DK int dk_trec_size(){return sizeof(TRec);}
// Plays n full games with Hinge+2-step (seed = mix(seed_base+i), Tape mode). Writes per-game rows (seed,score,steps,w0,sumd,mart) to games
// (double[n*6]); if recpath non-null, appends TRec per decision (game order, deterministic). Returns #label violations, or -1.
DK long long dk_teacher_games(uint32_t seedBase,int n,int mode,const wchar_t*recpath,double*games,int chunk){try{
  FILE*out=nullptr;if(recpath){out=_wfopen(recpath,L"wb");if(!out)throw std::runtime_error("rec open");}
  std::atomic<long long>bad{0};
  for(int c0=0;c0<n;c0+=chunk){int c1=std::min(n,c0+chunk);std::vector<std::vector<TRec>>recs(out?c1-c0:0);std::atomic<int>next{c0};
   P->run([&](int w){for(;;){int i=next++;if(i>=c1)break;uint32_t seed=mix(seedBase+uint32_t(i));Tape tape(seed,mode);State s;double w0=Mp->leaf(s),sumd=0;long double mart=0;int st=0;
     while(!s.terminal()){Label L=label(*C[w],s);bad+=L.bad;int a=slotOf(s,L.cls,Mp->codec);if(a<0)throw std::runtime_error("teacher slot");
      double f=Mp->leaf(s),m=leaf_expect(s,a,*Mp);
      if(out){TRec r{};r.game=i;r.step=st;r.p=s.p;r.t=s.t;r.b=s.b;r.n=s.n;r.flags=s.n?0:1;for(int j=0;j<s.n;j++)r.h[j]=s.h[j];r.deck=s.deck;r.cls=L.cls;r.mask=L.mask;std::copy(L.q,L.q+23,r.q);r.f=float(f);r.mu=float(m);recs[i-c0].push_back(r);}
      sample_step(s,a,tape);mart+=(long double)Mp->leaf(s)-m;sumd+=m-f;if(++st>1078)throw std::runtime_error("steps");}
     if(std::abs((s.p-w0)-(sumd+double(mart)))>1e-6)bad++;
     double*g=games+size_t(i)*6;g[0]=seed;g[1]=s.p;g[2]=st;g[3]=w0;g[4]=sumd;g[5]=double(mart);}});
   if(out)for(auto&v:recs)if(!v.empty()&&fwrite(v.data(),sizeof(TRec),v.size(),out)!=v.size())throw std::runtime_error("rec write");
  }
  if(out)fclose(out);return bad;}catch(const std::exception&e){setErr(e.what());return -1;}}
// Labels for arbitrary raw states (11 int32 rows as dk_env_raw; done ignored). For DAgger.
DK long long dk_label_states(int n,const int32_t*raw,int32_t*cls,float*q,uint32_t*mask){try{std::atomic<int>next{0};std::atomic<long long>bad{0};
  P->run([&](int w){for(;;){int i=next++;if(i>=n)break;const int32_t*r=raw+size_t(i)*11;State s;s.p=r[0];s.t=r[1];s.b=r[2];s.n=r[3];for(int j=0;j<5;j++)s.h[j]=r[4+j];s.deck=uint32_t(r[9]);
    auto L=label(*C[w],s);cls[i]=L.cls;mask[i]=L.mask;std::copy(L.q,L.q+23,q+size_t(i)*23);bad+=L.bad;}});return bad;}catch(const std::exception&e){setErr(e.what());return -1;}}
// Children of (raw state, class action) for value-training targets: class-merged branches (S0-mu verified).
// off[n+1] offsets into craw (11 int32 rows: p,t,b,n,h[5],deck,terminal) and prob. Returns total children, or -needed if cap too small.
DK long long dk_children(int n,const int32_t*raw,const int32_t*cls,int32_t*off,int32_t*craw,double*prob,long long cap){try{
  long long k=0;
  for(int i=0;i<n;i++){const int32_t*r=raw+size_t(i)*11;State s;s.p=r[0];s.t=r[1];s.b=r[2];s.n=r[3];for(int j=0;j<5;j++)s.h[j]=r[4+j];s.deck=uint32_t(r[9]);
   off[i]=int32_t(k);int a=slotOf(s,cls[i],Mp->codec);if(a<0)throw std::runtime_error("children: illegal class");
   for(auto&b:branches(s,a,Mp->codec,false)){if(k<cap){int32_t*o=craw+k*11;o[0]=b.s.p;o[1]=b.s.t;o[2]=b.s.b;o[3]=b.s.n;for(int j=0;j<5;j++)o[4+j]=j<b.s.n?b.s.h[j]:0;o[9]=int32_t(b.s.deck);o[10]=b.s.terminal();prob[k]=b.prob;}k++;}}
  off[n]=int32_t(k);return k<=cap?k:-k;}catch(const std::exception&e){setErr(e.what());return LLONG_MIN;}}
// f (Hinge leaf + DeckPotential, terminal -> p) for raw states
DK void dk_leaf(int n,const int32_t*raw,double*out){for(int i=0;i<n;i++){const int32_t*r=raw+size_t(i)*11;State s;s.p=r[0];s.t=r[1];s.b=r[2];s.n=r[3];for(int j=0;j<5;j++)s.h[j]=r[4+j];s.deck=uint32_t(r[9]);out[i]=Mp->leaf(s);}}
// V2(s) = max_a sum_s' P(s'|s,a) f(s')  (planner depth-1 Q, production OPT); terminal -> p. raw rows: 11 int32.
DK long long dk_v2(int n,const int32_t*raw,double*out){try{std::atomic<int>next{0};
  P->run([&](int w){for(;;){int i=next++;if(i>=n)break;const int32_t*r=raw+size_t(i)*11;State s;s.p=r[0];s.t=r[1];s.b=r[2];s.n=r[3];for(int j=0;j<5;j++)s.h[j]=r[4+j];s.deck=uint32_t(r[9]);
    if(s.terminal()){out[i]=s.p;continue;}auto&A=*C[w];A.p.clear();A.p.setBudget(0);auto z=inspect(A.p,s,1);double best=-1e300;for(int a:z.a)best=std::max(best,z.q[a]);out[i]=best;}});
  return 0;}catch(const std::exception&e){setErr(e.what());return -1;}}
