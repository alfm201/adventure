const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const outputDir = path.join(root, 'benchmarks', 'results', 'full_game');
const EPISODES = Number(process.env.FULL_GAME_EPISODES || process.env.PAIRED_FULL_GAME_EPISODES || process.argv[2] || 30);
const DEFAULT_SEED_BASE = 1;
const envSeedBase = Number(process.env.FULL_GAME_SEED ?? process.env.PAIRED_FULL_GAME_SEED);
const argSeedBase = Number(process.argv[3]);
const SEED_BASE = Number.isFinite(envSeedBase)
  ? (envSeedBase >>> 0)
  : Number.isFinite(argSeedBase)
    ? (argSeedBase >>> 0)
    : Number.isFinite(EPISODES) && EPISODES > 0
      ? EPISODES
      : DEFAULT_SEED_BASE;
const REPLICATE_ID = Number(process.env.FULL_GAME_REPLICATE || process.env.PAIRED_FULL_GAME_REPLICATE || process.argv[4] || 0);
const POLICY_SET = String(process.env.FULL_GAME_POLICY_SET || process.env.PAIRED_POLICY_SET || process.argv[5] || 'operational_vs_i50k');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.env.FULL_GAME_BENCH_PORT || process.env.PAIRED_BENCH_PORT || 17891);
const DEBUG_PORT = Number(process.env.FULL_GAME_CHROME_DEBUG_PORT || process.env.PAIRED_CHROME_DEBUG_PORT || 17892);
const TRACE_DECISIONS = process.env.FULL_GAME_TRACE_DECISIONS === '1' || process.argv[7] === 'trace';
const TRACE_OVERRIDES = process.env.FULL_GAME_TRACE_OVERRIDES === '1' || process.argv[7] === 'traceOverrides';
const TRACE_CHUNKED = (TRACE_DECISIONS || TRACE_OVERRIDES) && process.env.FULL_GAME_TRACE_CHUNKED !== '0';
const RUN_STAMP = process.env.FULL_GAME_RUN_ID || process.env.PAIRED_FULL_GAME_RUN_ID || process.argv[6] || '';
const ROLLOUT_COUNT = Number(process.env.FULL_GAME_ROLLOUT_COUNT || process.env.FULL_GAME_ROLLOUTS || NaN);
const MAX_STEPS = Number(process.env.FULL_GAME_MAX_STEPS || NaN);

function outputBaseName() {
  const suffix = RUN_STAMP ? `_${RUN_STAMP}` : '';
  return `keyed_${POLICY_SET}_${EPISODES}ep_seed${SEED_BASE}_rep${REPLICATE_ID}${suffix}`;
}

function traceSidecarPath() {
  return path.join(outputDir, `${outputBaseName()}_trace.jsonl`);
}

function mimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === '/trace-chunk') {
      if (!TRACE_CHUNKED || req.method !== 'POST') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      let body = '';
      req.setEncoding('utf8');
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        fs.mkdirSync(outputDir, { recursive: true });
        fs.appendFileSync(traceSidecarPath(), `${body}\n`, 'utf8');
        res.writeHead(204);
        res.end();
      });
      req.on('error', error => {
        res.writeHead(500);
        res.end(String(error));
      });
      return;
    }
    const relative = url.pathname === '/' ? 'benchmarks/runner/full_game_gpu.html' : url.pathname;
    const filePath = path.normalize(path.join(root, relative));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (error, body) => {
      if (error) {
        res.writeHead(404);
        res.end(String(error));
        return;
      }
      res.writeHead(200, { 'content-type': mimeType(filePath) });
      res.end(body);
    });
  });
  return new Promise(resolve => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, response => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function cdpCall(socket, method, params = {}) {
  const id = ++cdpCall.nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    cdpCall.pending.set(id, { resolve, reject });
  });
}
cdpCall.nextId = 0;
cdpCall.pending = new Map();

async function connectCdp() {
  let lastError;
  for (let i = 0; i < 100; i += 1) {
    try {
      const tabs = await requestJson(`http://127.0.0.1:${DEBUG_PORT}/json`);
      const tab = tabs.find(item => item.type === 'page') || tabs[0];
      if (tab && tab.webSocketDebuggerUrl) {
        const socket = new WebSocket(tab.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          socket.onopen = resolve;
          socket.onerror = reject;
        });
        socket.onmessage = event => {
          const message = JSON.parse(event.data);
          if (!message.id) return;
          const pending = cdpCall.pending.get(message.id);
          if (!pending) return;
          cdpCall.pending.delete(message.id);
          if (message.error) pending.reject(new Error(message.error.message));
          else pending.resolve(message.result);
        };
        return socket;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw lastError || new Error('Could not connect to Chrome DevTools.');
}

async function waitForResult(socket) {
  for (;;) {
    const result = await cdpCall(socket, 'Runtime.evaluate', {
      expression: 'window.__fullGameBenchmarkResult || null',
      returnByValue: true,
    });
    if (result.result && result.result.value) return result.result.value;

    const error = await cdpCall(socket, 'Runtime.evaluate', {
      expression: 'window.__fullGameBenchmarkError || null',
      returnByValue: true,
    });
    if (error.result && error.result.value) throw new Error(error.result.value);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

let progressActive = false;
let lastProgress = null;

function formatClock(ms) {
  let seconds = Math.max(0, Math.round(Number(ms) / 1000));
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  const pad = value => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function progressBar(percent, width = 40) {
  const filled = Math.max(0, Math.min(width, Math.round((Number(percent) / 100) * width)));
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`;
}

function clearProgress() {
  if (!progressActive) return;
  process.stderr.write('\x1b[2F\x1b[0J');
  progressActive = false;
}

function finishProgress() {
  if (!progressActive) return;
  process.stderr.write('\n');
  progressActive = false;
  lastProgress = null;
}

function renderProgress(progress) {
  lastProgress = progress;
  const line = `episode: ${progress.done}/${progress.total} | ${Number(progress.percent).toFixed(1)}% | elapsed: ${formatClock(progress.elapsedMs)} | ETA: ${formatClock(progress.etaMs)}`;
  const bar = progressBar(progress.percent);
  clearProgress();
  process.stderr.write(`${line}\n${bar}\n`);
  progressActive = true;
}

function writeLogBelowProgress(text) {
  clearProgress();
  console.error(text);
  if (lastProgress) renderProgress(lastProgress);
}

function handleBrowserConsole(text) {
  const message = String(text || '');
  const prefix = '__ADVENTURE_PROGRESS__';
  if (message.startsWith(prefix)) {
    renderProgress(JSON.parse(message.slice(prefix.length)));
    return;
  }
  if (message === 'done') {
    finishProgress();
    console.error(`[browser] ${message}`);
    return;
  }
  writeLogBelowProgress(`[browser] ${message}`);
}

function writeOutput(result) {
  fs.mkdirSync(outputDir, { recursive: true });
  result.benchmark = 'keyed_full_game';
  result.source = 'benchmarks/scripts/run_full_game_gpu_browser.js';
  if (TRACE_CHUNKED) {
    const sidecar = traceSidecarPath();
    result.traceChunked = true;
    result.traceSidecarPath = path.relative(root, sidecar).replace(/\\/g, '/');
    result.traceSidecarBytes = fs.existsSync(sidecar) ? fs.statSync(sidecar).size : 0;
  }
  const fileName = `${outputBaseName()}.json`;
  const outputPath = path.join(outputDir, fileName);
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'latest_keyed.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'latest.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return outputPath;
}

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME}`);
  if (TRACE_CHUNKED) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.rmSync(traceSidecarPath(), { force: true });
  }
  const server = await startServer();
  const userDataDir = process.env.FULL_GAME_CHROME_USER_DATA_DIR || path.join(root, `.tmp-chrome-full-game-benchmark-${PORT}-${POLICY_SET}`);
  const query = new URLSearchParams({
    episodes: String(EPISODES),
    seedBase: String(SEED_BASE),
    replicateId: String(REPLICATE_ID),
    policySet: POLICY_SET,
    traceDecisions: TRACE_DECISIONS ? '1' : '0',
    traceOverrides: TRACE_OVERRIDES ? '1' : '0',
    traceChunked: TRACE_CHUNKED ? '1' : '0',
  });
  if (Number.isFinite(ROLLOUT_COUNT) && ROLLOUT_COUNT > 0) query.set('rolloutCount', String(Math.floor(ROLLOUT_COUNT)));
  if (Number.isFinite(MAX_STEPS) && MAX_STEPS > 0) query.set('maxSteps', String(Math.floor(MAX_STEPS)));
  const url = `http://127.0.0.1:${PORT}/benchmarks/runner/full_game_gpu.html?${query.toString()}`;
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,WebGPU',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--disable-background-timer-throttling',
    url,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  chrome.stderr.on('data', chunk => {
    const text = String(chunk).trim();
    if (text) {
      writeLogBelowProgress(text);
    }
  });

  try {
    const socket = await connectCdp();
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.consoleAPICalled') {
        const arg = (message.params && message.params.args || [])[0];
        if (arg && arg.value) {
          handleBrowserConsole(arg.value);
        } else if (arg && arg.description) {
          handleBrowserConsole(arg.description);
        }
      }
      if (!message.id) return;
      const pending = cdpCall.pending.get(message.id);
      if (!pending) return;
      cdpCall.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    };
    await cdpCall(socket, 'Runtime.enable');
    await cdpCall(socket, 'Log.enable');
    const result = await waitForResult(socket);
    socket.close();
    const outputPath = writeOutput(result);
    finishProgress();
    console.log(`Wrote ${outputPath}`);
    console.log(JSON.stringify({
      episodes: result.episodes,
      seedBase: result.seedBase,
      rngMode: result.rng?.mode,
      policySet: result.policySet,
      policies: result.policyResults.map(row => ({
        policy: row.policy,
        meanScore: row.meanScore,
        stdScore: row.stdScore,
        meanDecisionMs: row.meanDecisionMs,
      })),
    }, null, 2));
  } finally {
    chrome.kill();
    server.close();
  }
}

main().catch(error => {
  finishProgress();
  console.error(error);
  process.exitCode = 1;
});
