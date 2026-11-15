#!/usr/bin/env node
/**
 * 冒烟测试（`pnpm run test:smoke`）：对着**构建产物**跑，不是 dev server。
 *
 * 为什么不用 dev 里点一遍代替：
 *   - dev 跑的是热更新态，压缩、分包、路径重写都可能让产物行为和 dev 不一样；
 *   - "我看了一眼没问题"无法复现，也没法进 CI；
 *   - 这里断言的是状态：开机层有没有撤、窗口有没有挂上、最大化后宽度是不是铺满、
 *     dock 菜单有没有按 0.8s 意图延迟出现、等待中点击后会不会偷偷补弹。
 *
 * 实现上不引入依赖：自己起 vite preview，再用 CDP（Chrome DevTools Protocol）驱动本机浏览器。
 * 浏览器按 SMOKE_BROWSER 环境变量或常见安装路径查找；找不到就报错退出，不许静默跳过。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.SMOKE_PORT ?? 4188);
const ORIGIN = 'http://127.0.0.1:' + PORT + '/';
const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  ' + detail : ''));
}

function browserPath() {
  const candidates = [
    process.env.SMOKE_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

/** 等 preview 起来：vite 打印 Ready 之前连不上，用 HTTP 轮询最稳。 */
async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(ORIGIN);
      if (response.ok) return true;
    } catch {
      /* 还没监听 */
    }
    await sleep(150);
  }
  return false;
}

/** 从浏览器 stderr 里捞出 DevTools 的 ws 地址。 */
function waitForDevTools(child) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('浏览器没有给出 DevTools 地址')), 20000);
    child.stderr.on('data', (chunk) => {
      buffer += String(chunk);
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error('浏览器启动后立即退出，code=' + code));
    });
  });
}

/** 极简 CDP 客户端：只用到 Runtime.evaluate 与 Input.*，够冒烟用。 */
function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 0;
  const events = [];
  socket.addEventListener('message', (raw) => {
    const message = JSON.parse(raw.data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
      return;
    }
    if (message.method) events.push(message);
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  const open = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  return { socket, send, open, events };
}

/** 杀进程并等它真的退出，不然下一步删临时目录会撞锁。 */
async function stop(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolve) => {
    child.once('exit', resolve);
    setTimeout(resolve, 5000);
  });
  child.kill('SIGKILL');
  await exited;
}

const browser = browserPath();
if (!browser) {
  console.error('test:smoke  找不到浏览器，设置 SMOKE_BROWSER 指向 Chrome/Edge');
  process.exit(1);
}

if (!fs.existsSync('dist/index.html')) {
  console.error('test:smoke  没有 dist/，先跑 pnpm run build');
  process.exit(1);
}

console.log('test:smoke  preview :' + PORT + '  browser ' + path.basename(browser));
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let previewLog = '';
preview.stdout.on('data', (chunk) => (previewLog += String(chunk)));
preview.stderr.on('data', (chunk) => (previewLog += String(chunk)));

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kanadex-smoke-'));
const chrome = spawn(
  browser,
  [
    '--headless=new',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profile,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1280,860',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] }
);

let failures = 0;
try {
  if (!(await waitForServer())) throw new Error('preview 没起来：' + previewLog.trim());

  const wsUrl = await waitForDevTools(chrome);
  const { socket, send, open } = connect(wsUrl);
  await open;
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setFocusEmulationEnabled', { enabled: true });
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });

  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails.exception ?? result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression, timeoutMs = 8000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        if (await evaluate(expression)) return true;
      } catch {
        /* 页面还没就绪 */
      }
      await sleep(80);
    }
    return false;
  };

  await call('Page.navigate', { url: ORIGIN });

  // 1. 开机层：先出现，字是 Kanadex_OS
  check('开机层出现', await waitFor("!!document.querySelector('.boot__brand')", 5000));
  check('开机字是 Kanadex_OS', (await evaluate("document.querySelector('.boot__word')?.textContent ?? document.querySelector('.boot__name')?.textContent")) === 'Kanadex_OS');
  check('开机期间桌面 inert', await evaluate("document.querySelector('.app').hasAttribute('inert')"));

  // 2. 3 秒后交班，桌面可用
  check('开机层撤掉 data-booting', await waitFor("!document.documentElement.hasAttribute('data-booting')", 9000));
  check('开机结束后桌面恢复可交互', await waitFor("!document.querySelector('.app').hasAttribute('inert')", 3000));
  check('站点淡入完成', await waitFor("parseFloat(getComputedStyle(document.querySelector('.app')).opacity) > 0.98", 5000));

  // 3. 终端在开机后才挂上
  check('终端由开机退场后打开', await waitFor("!!document.querySelector('[data-aim-target=\"win:terminal\"]')", 6000));

  // 4. 打开「项目」，检查窗口数量
  await evaluate("[...document.querySelectorAll('.obj')].find((b) => b.textContent.includes('项目')).click()");
  check('打开窗口后共两扇', await waitFor("document.querySelectorAll('.win').length === 2"));
  const desktopWidth = await evaluate("document.querySelector('.desktop').getBoundingClientRect().width");

  // 5. 最大化铺满、还原回原尺寸
  await evaluate("document.querySelector('[data-aim-target=\"win:projects\"] .win__dot--max').click()");
  check('最大化后铺满桌面区', await waitFor("Math.abs(document.querySelector('[data-aim-target=\"win:projects\"]').getBoundingClientRect().width - document.querySelector('.desktop').getBoundingClientRect().width) < 1.5", 3000));
  await evaluate("document.querySelector('[data-aim-target=\"win:projects\"] .win__dot--max').click()");
  check('还原后不再铺满', await waitFor("document.querySelector('[data-aim-target=\"win:projects\"]').getBoundingClientRect().width < " + (desktopWidth - 40).toFixed(1), 3000));

  // 6. dock：菜单要等 0.8s；等待中点击过就不许补弹
  const chip = await evaluate("(() => { const b = document.querySelectorAll('.dock__item')[0]; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()");
  const mouse = (type, extra = {}) => call('Input.dispatchMouseEvent', { type, x: chip.x, y: chip.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1, ...extra });
  await mouse('mouseMoved');
  await sleep(1200);
  check('悬停满 0.8s 后菜单出现', await evaluate("!!document.querySelector('.dock__menu')"));
  await mouse('mouseMoved', { x: chip.x, y: chip.y - 240 });
  await sleep(200);
  await mouse('mouseMoved');
  await sleep(300);
  await mouse('mousePressed');
  await mouse('mouseReleased');
  await sleep(1000);
  check('等待中点击后菜单不补弹', !(await evaluate("!!document.querySelector('.dock__menu')")));

  // 7. 全程不许有脚本异常
  const errors = (await evaluate("window.__smokeErrors ? window.__smokeErrors.length : 0")) ?? 0;
  check('没有脚本异常', errors === 0);

  socket.close();
} catch (error) {
  failures += 1;
  console.error('test:smoke  中断：' + error.message);
} finally {
  await stop(chrome);
  await stop(preview);
  // Windows 上浏览器退出后仍会短暂占着 profile 目录，删不掉不算失败
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 120 });
  } catch {
    /* 临时目录，交给系统回收 */
  }
}

failures += results.filter((item) => !item.ok).length;
const passed = results.filter((item) => item.ok).length;
console.log('test:smoke  ' + passed + ' 通过 / ' + results.length + ' 检查');
process.exit(failures === 0 ? 0 : 1);
