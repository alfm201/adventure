#include "inference.hpp"
#include <memory>
#include <string>

static std::unique_ptr<PairModel> four;
static std::unique_ptr<StaticFive> five;
static std::unique_ptr<ResidualPolicy> policy;
static int input[10];
static double values[6];
static std::string error;

extern "C" {
int* state_ptr() { return input; }
double* values_ptr() { return values; }
const char* last_error() { return error.c_str(); }
int init_model(const char* data, unsigned int bytes) {
  try {
    uint64_t fourBytes, fiveBytes;
    if (bytes != 1096193164 || std::memcmp(data, "VELAV4\0", 8)) throw std::runtime_error("Invalid model bundle");
    std::memcpy(&fourBytes, data + 8, 8);
    std::memcpy(&fiveBytes, data + 16, 8);
    if (fourBytes != 160024804 || fiveBytes != 936168296) throw std::runtime_error("Invalid model dimensions");
    policy.reset(); five.reset(); four.reset();
    four = std::make_unique<PairModel>(data + 64);
    five = std::make_unique<StaticFive>(data + 64 + fourBytes);
    policy = std::make_unique<ResidualPolicy>(*four, *five);
    policy->depth = 2; policy->window = 24; policy->taper = 12;
    policy->scale = 1; policy->deckBeta = .6; policy->timeSlope = 0;
    return 1;
  } catch (const std::exception& e) { error = e.what(); return 0; }
}
int evaluate_state() {
  try {
    if (!policy) throw std::runtime_error("Model is not ready");
    State s; s.p=input[0]; s.t=input[1]; s.b=input[2]; s.n=input[3]; s.deck=input[9];
    if(s.p<1||s.p>N||s.t<0||s.t>100||s.b<0||s.b>1||s.n<0||s.n>5||!s.deck||s.deck>0x3fffffff)throw std::runtime_error("Invalid state");
    for(int i=0;i<s.n;i++){s.h[i]=input[4+i];if(s.h[i]<1||s.h[i]>30)throw std::runtime_error("Invalid card");}
    std::fill(values,values+6,0);
    if(s.terminal()){for(int a=0;a<=s.n;a++)values[a]=s.p;return 0;}
    const int action=policy->act(s);
    if(!s.n){s.t=100-std::min(100-s.t,24);policy->cache.clear();values[0]=policy->q2(s,0);}
    else {
      int first[23];std::fill(first,first+23,-1);
      for(int a=0;a<=s.n;a++){
        int c=a?four->classes.idmap[s.h[a-1]]:0;
        if(first[c]>=0)values[a]=values[first[c]];
        else {first[c]=a;values[a]=policy->qvalues[a];}
      }
    }
    for(int a=0;a<=s.n;a++)if(!std::isfinite(values[a]))throw std::runtime_error("Non-finite evaluation");
    return action;
  } catch(const std::exception& e){error=e.what();return -1;}
}
}
