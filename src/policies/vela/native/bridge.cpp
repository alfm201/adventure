#include "dabe.hpp"
static std::unique_ptr<Compact100> model;
static std::unique_ptr<Meta> meta;
static std::unique_ptr<Candidate> policy;
static SearchOutcome outcome;
static int input[10];static double values[6];static std::string error;
extern "C" {
int* state_ptr(){return input;}double* values_ptr(){return values;}
const char* last_error(){return error.c_str();}
int last_depth(){return outcome.depth;}int last_capped(){return outcome.capped;}
int last_nodes(){return int(outcome.nodes);}
int init_model(const char*data,unsigned int bytes){try{
 policy.reset();meta.reset();model.reset();OPT=4228;
 model=std::make_unique<Compact100>(data,bytes);meta=std::make_unique<Meta>(*model);
 policy=std::make_unique<Candidate>(*model,*meta,"base",0);return 1;
}catch(const std::exception&e){error=e.what();return 0;}}
int evaluate_state(int budget=0){try{
 outcome={}; beginSearch(budget>0);
 if(!policy)throw std::runtime_error("Model is not ready");
 State s;s.p=input[0];s.t=input[1];s.b=input[2];s.n=input[3];s.deck=input[9];
 if(s.p<1||s.p>N||s.t<0||s.t>100||s.b<0||s.b>1||s.n<0||s.n>5||!s.deck||s.deck>0x3fffffff)throw std::runtime_error("Invalid state");
 for(int i=0;i<s.n;i++){s.h[i]=input[4+i];if(s.h[i]<1||s.h[i]>30)throw std::runtime_error("Invalid card");}
 std::fill(values,values+6,0);if(s.terminal()){for(int a=0;a<=s.n;a++)values[a]=s.p;return 0;}
 outcome=searchDabe(*policy,s,budget,values);
 int best=outcome.best;
 if(!s.n){policy->p.clear();policy->p.setBudget(0);values[0]=policy->p.Q(s,0,2);}
 for(int a=0;a<=s.n;a++)if(!std::isfinite(values[a])||values[a]<-1e200)throw std::runtime_error("Invalid action value");
 return best;
}catch(const SearchCancelled&){policy->p.setBudget(0);return -2;}
catch(const std::exception&e){error=e.what();return -1;}}
}
