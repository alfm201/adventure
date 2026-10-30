#pragma once
#include "branches.hpp"

struct SearchOutcome { int best=0,depth=2; uint64_t nodes=0; bool capped=false; };
inline SearchOutcome searchDabe(Candidate& candidate,const State& s,uint64_t budget,double* q) {
  SearchOutcome out;
  auto& p=candidate.p;
  p.clear(); p.setBudget(0);
  out.best=candidate.act(s);
  if(!s.n)return out;
  std::vector<int> legal;
  int first[23];std::fill(first,first+23,-1);
  for(int a=0;a<=s.n;a++) {
    int c=a?p.M.codec.idmap[s.h[a-1]]:0;
    if(first[c]>=0)continue;
    first[c]=a;legal.push_back(a);q[a]=candidate.lastQs[a];
  }
  auto best=[&](){int a=legal[0];for(int b:legal)if(q[b]>q[a])a=b;return a;};
  auto gap=[&](){int a=best();double second=-1e300;for(int b:legal)if(b!=a)second=std::max(second,q[b]);return q[a]-second;};
  auto level=[&](int k)->bool {
    const double top=q[best()];
    struct Pending { int action;double probability;State state;bool done=false; };
    std::vector<Pending> pending;
    for(int a:legal) {
      if(k>=4 && top-q[a]>1.5)continue;
      for(const auto& b:branches(s,a,p.M.codec,false))
        if(!b.s.terminal())pending.push_back({a,b.prob,b.s});
    }
    for(size_t count=0;count<pending.size();count++) {
      pollSearch(true);
      const double topNow=q[best()];double priority=-1;size_t next=0;
      for(size_t i=0;i<pending.size();i++)if(!pending[i].done) {
        const auto& b=pending[i];
        double value=b.probability/(1+(topNow-q[b.action])/.5);
        if(value>priority){priority=value;next=i;}
      }
      if(out.nodes>=budget){out.capped=true;return false;}
      p.setBudget(budget-out.nodes);
      auto& b=pending[next];double hi,lo;
      try {hi=p.V(b.state,k-1);lo=p.V(b.state,k-2);}
      catch(const SearchLimit&) {out.nodes+=p.used;p.setBudget(0);out.capped=true;return false;}
      out.nodes+=p.used;p.setBudget(0);
      q[b.action]+=b.probability*(hi-lo);b.done=true;
    }
    return true;
  };
  if(budget && legal.size()>1) {
    if(level(3)) {
      out.depth=3;
      for(int k=4;k<=6;k++) {
        if(gap()>1.5 || !level(k))break;
        out.depth=k;
      }
    }
    out.best=best();
  }
  for(int a=0;a<=s.n;a++)q[a]=q[first[a?p.M.codec.idmap[s.h[a-1]]:0]];
  return out;
}
