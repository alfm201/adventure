var stage = [];
var cardInfo = [];

importScripts('./board.js?v=20260807203200000000');

let idx;

onmessage = function (e) {
  idx = e.data.idx;
  stage = e.data.stage;
  cardInfo = e.data.cardInfo;
  const state = e.data.state;
  Board.rolloutPolicy = e.data.cpuPolicy === 'quality' ? 'quality' : 'fast';
  const res = simulation(e.data.iteration, state, e.data.route);
  postMessage({
    res,
    idx,
    route: e.data.route,
  });
};

function simulation(iteration = 10000, state, route) {
  const env = new Board();
  env.setState(state);
  env.autoProcess = true;
  if (env.diceUse >= 100 && !env.isDouble) return [-2];

  try {
    const actionSize = env.cards.length + 1;
    const avgScores = new Array(actionSize).fill(0);
    const minScores = new Array(actionSize).fill(0);
    const maxScores = new Array(actionSize).fill(0);
    const stdScores = new Array(actionSize).fill(0);
    const medianScores = new Array(actionSize).fill(0);
    const countScores = new Array(actionSize).fill(0);
    const sumScores = new Array(actionSize).fill(0);
    const sumSqScores = new Array(actionSize).fill(0);
    const scoreCountArrays = new Array(actionSize).fill(0).map(() => new Uint32Array(2899));
    const scoreCounts = new Array(actionSize).fill(0).map(() => []);

    for (let action = 0; action < actionSize; action++) {
      if (route === undefined || !route.includes(action)) continue;

      for (let j = 0; j < iteration; j++) {
        let done = false;
        const sEnv = new Board();
        sEnv.setState(state);
        sEnv.autoProcess = true;

        sEnv.step(action);
        while (!done) {
          done = sEnv.step(sEnv.chooseAction());
        }

        const score = sEnv.score;
        countScores[action]++;
        sumScores[action] += score;
        sumSqScores[action] += score * score;
        minScores[action] = countScores[action] === 1 ? score : Math.min(minScores[action], score);
        maxScores[action] = countScores[action] === 1 ? score : Math.max(maxScores[action], score);
        if (score >= 0 && score < scoreCountArrays[action].length) {
          scoreCountArrays[action][score]++;
        }
      }

      avgScores[action] = sumScores[action] / countScores[action];
      const variance = Math.max(
        0,
        sumSqScores[action] / countScores[action] - avgScores[action] * avgScores[action]
      );
      stdScores[action] = Math.sqrt(variance);
      medianScores[action] = getMedianFromCounts(scoreCountArrays[action], countScores[action]);
      scoreCounts[action] = compactScoreCounts(scoreCountArrays[action]);
    }

    return [1, {
      avg: avgScores,
      min: minScores,
      max: maxScores,
      std: stdScores,
      mid: medianScores,
      count: countScores,
      sum: sumScores,
      sumSq: sumSqScores,
      scoreCounts,
    }];
  } catch (err) {
    console.error(err);
    return [-1];
  }
}

function getMedianFromCounts(scoreCounts, count) {
  if (count === 0) return 0;
  const leftTarget = Math.floor((count + 1) / 2);
  const rightTarget = Math.floor((count + 2) / 2);
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
  const compact = [];
  for (let score = 0; score < scoreCounts.length; score++) {
    if (scoreCounts[score] > 0) {
      compact.push([score, scoreCounts[score]]);
    }
  }
  return compact;
}
