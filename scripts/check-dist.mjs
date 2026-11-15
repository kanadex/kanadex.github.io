#!/usr/bin/env node
/**
 * 产物完整性检查（`pnpm run check:dist`，build 的最后一步）。
 *
 * 静态站最容易出的发布事故，不是语法错误，而是"构建通过了，但产物里有个指向不存在文件的链接"：
 * 少拷一个字体、图标路径写成 /favicon.svg、图片忘了进 public/ —— 页面照样打开，只是某个地方 404。
 *
 * 这个脚本只做三件事，全部对着 dist/ 的真实文件判断：
 *   1. 必需的发布文件在不在（HTML、图标、robots、字体、头像）。
 *   2. HTML 与 CSS 里每一处站内引用，是否都能在 dist/ 里找到对应文件。
 *   3. 产物里有没有混进开发态的东西（/src/、@vite/client、localhost）。
 *
 * 有错就列出来并以 1 退出，不让这份产物进 release。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const dist = path.resolve(process.argv[2] ?? 'dist');
const problems = [];
const fail = (message) => problems.push(message);

if (!fs.existsSync(dist)) {
  console.error('check:dist  找不到 ' + dist + '，先跑 pnpm run build');
  process.exit(1);
}

/** 递归列出 dist 里的所有文件（相对路径，正斜杠）。 */
function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + entry.name : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, rel));
    else out.push(rel);
  }
  return out;
}

const files = new Set(walk(dist));
const required = [
  'index.html',
  'robots.txt',
  'favicon.ico',
  'favicon-32.png',
  'apple-touch-icon.png',
  'media/avatar.jpg',
  'fonts/young-serif-latin.woff2',
  'fonts/zcool-kuaile-ui.woff2',
];
for (const file of required) {
  if (!files.has(file)) fail('缺文件：' + file);
}

/** 站内引用 → dist 里的相对路径；外部链接、协议链接、锚点返回 null。 */
function localTarget(url) {
  const clean = url.trim().replace(/[?#].*$/, '');
  if (!clean || clean.startsWith('#') || clean.startsWith('//')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) return null;
  if (!clean.startsWith('/')) return null;
  return clean.slice(1);
}

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const refs = [];
for (const match of html.matchAll(/\b(?:href|src|content)="([^"]+)"/g)) refs.push({ where: 'index.html', url: match[1] });
for (const ref of refs) {
  const target = localTarget(ref.url);
  if (!target) continue;
  if (target === '') {
    // href="/" 指首页，构建产物里就是 index.html
    continue;
  }
  if (!files.has(target)) fail(ref.where + ' 引用了不存在的文件：' + ref.url);
}

for (const file of files) {
  if (!file.endsWith('.css')) continue;
  const css = fs.readFileSync(path.join(dist, file), 'utf8');
  for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    const target = localTarget(match[1]);
    if (!target || files.has(target)) continue;
    fail(file + ' 引用了不存在的资源：' + match[1]);
  }
}

for (const file of files) {
  if (!/\.(html|js|css)$/.test(file)) continue;
  const text = fs.readFileSync(path.join(dist, file), 'utf8');
  if (text.includes('@vite/client')) fail(file + ' 混进了开发态客户端（@vite/client）');
  if (/\/src\/[\w-]+\.(?:tsx?|css)/.test(text)) fail(file + ' 还在引用源码路径（/src/…）');
  if (text.includes('localhost:7777')) fail(file + ' 写死了开发端口（localhost:7777）');
}

if (!/<div id="root"><\/div>/.test(html)) fail('index.html 里没有空的 <div id="root">，SPA 挂载点被改坏了');

const size = [...files].reduce((sum, file) => sum + fs.statSync(path.join(dist, file)).size, 0);
if (problems.length > 0) {
  console.error('check:dist  发现 ' + problems.length + ' 个问题：');
  for (const problem of problems) console.error('  - ' + problem);
  process.exit(1);
}

console.log('check:dist  ' + files.size + ' 个文件 / ' + (size / 1024).toFixed(1) + ' kB，站内引用全部命中。');
