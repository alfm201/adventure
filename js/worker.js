importScripts('https://alfm201.github.io/adventure/js/board.js');

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
    let countScores = new Array(actionSize).fill(0);
    let sumScores = new Array(actionSize).fill(0);
    let sumSqScores = new Array(actionSize).fill(0);
    let scoreCountArrays = new Array(actionSize).fill(0).map(() => new Uint32Array(2899));
    let scoreCounts = new Array(actionSize).fill(0).map(() => []);
    for (let i = 0; i < actionSize; i++) {
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
          let score = sEnv.score;
          countScores[i]++;
          sumScores[i] += score;
          sumSqScores[i] += score * score;
          minScores[i] = countScores[i] === 1 ? score : Math.min(minScores[i], score);
          maxScores[i] = countScores[i] === 1 ? score : Math.max(maxScores[i], score);
          if (score >= 0 && score < scoreCountArrays[i].length) {
            scoreCountArrays[i][score]++;
          }
        }
        avgScores[i] = sumScores[i] / countScores[i];
        let variance = Math.max(0, sumSqScores[i] / countScores[i] - avgScores[i] * avgScores[i]);
        stdScores[i] = Math.sqrt(variance);
        medianScores[i] = getMedianFromCounts(scoreCountArrays[i], countScores[i]);
        scoreCounts[i] = compactScoreCounts(scoreCountArrays[i]);
      }
    }
    return [1, { avg: avgScores, min: minScores, max: maxScores, std: stdScores, mid: medianScores, count: countScores, sum: sumScores, sumSq: sumSqScores, scoreCounts: scoreCounts }];
  } catch (err) {
    console.error(err);
    return [-1];
  }

}

function getMedianFromCounts(scoreCounts, count) {
  if (count === 0) return 0;
  let leftTarget = Math.floor((count + 1) / 2);
  let rightTarget = Math.floor((count + 2) / 2);
  let seen = 0;
  let leftValue;
  for (let score = 0; score < scoreCounts.length; score++) {
    seen += scoreCounts[score];
    if (leftValue === undefined && seen >= leftTarget) {
      leftValue = score;
    }
    if (seen >= rightTarget) {
      return (leftValue + score) / 2;
    }
  }
  return 0;
}

function compactScoreCounts(scoreCounts) {
  let compact = [];
  for (let score = 0; score < scoreCounts.length; score++) {
    if (scoreCounts[score] > 0) {
      compact.push([score, scoreCounts[score]]);
    }
  }
  return compact;
}


