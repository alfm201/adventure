importScripts('/adventure/js/Board.js');

let idx, stage, cardInfo;

onmessage = function (e) {
  idx = e.data.idx;
  stage = e.data.stage;
  cardInfo = e.data.cardInfo;
  state = e.data.state;
  let res = simulation(e.data.iteration, state, e.data.route);
  postMessage({
    res: res,
    idx: idx,
    route: e.data.route,
  });
}

function simulation(iteration = 10000, state, route) {
  let env = new Board();
  env.setState(state);
  env.autoProcess = true;
  if (env.diceUse >= 100 && !env.isDouble) return [-2];
  try {
    let actionSize = env.cards.length + 1;
    let avgScores = new Array(actionSize).fill(0);
    let minScores = new Array(actionSize).fill(0);
    let maxScores = new Array(actionSize).fill(0);
    let stdScores = new Array(actionSize).fill(0);
    let medianScores = new Array(actionSize).fill(0);
    for (let i = 0; i < actionSize; i++) {
      let scores = [];
      if (route !== undefined && route.includes(i)) {
        for (let j = 0; j < iteration; j++) {
          let done = false;
          let sEnv = new Board();
          sEnv.setState(state);
          sEnv.autoProcess = true;

          sEnv.step(i);
          // sEnv.step(Math.trunc(Math.random() * (sEnv.cards.length + 1)));

          while (!done) {
            done = sEnv.step(sEnv.chooseAction());
          }
          scores.push(sEnv.score);
        }
        avgScores[i] = scores.reduce((a, v) => a + v, 0) / scores.length;
        minScores[i] = scores.reduce((min, current) => (current < min ? current : min), scores[0]);
        maxScores[i] = scores.reduce((max, current) => (current > max ? current : max), scores[0]);
        let variance = scores.reduce((a, v) => a + Math.pow(v - avgScores[i], 2), 0) / scores.length;
        stdScores[i] = Math.sqrt(variance);
        let sortedScores = [...scores].sort((a, b) => a - b);
        let median;
        if (sortedScores.length % 2 === 0) {
          median = (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2;
        } else {
          median = sortedScores[Math.floor(sortedScores.length / 2)];
        }
        medianScores[i] = median;
      }
    }
    return [1, { avg: avgScores, min: minScores, max: maxScores, std: stdScores, mid: medianScores }];
  } catch (err) {
    console.error(err);
    return [-1];
  }

}
