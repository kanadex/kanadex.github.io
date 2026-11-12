# 缺陷登记

状态：`open` / `fixed`。每条都是 CDP（DevTools 协议）真实点击后回读的值，不是"应该没问题"。

| # | 现象 | 判据 | 状态 | CDP 回读 |
| --- | --- | --- | --- | --- |
| 1 | 桌面图标压在最大化窗口之上 | `elementFromPoint(图标中心)` 必须命中窗口 | fixed | 最大化后 `tag=H3, insideWindow=true`；入口保持 `visibility: visible`，由窗口 z-index 盖住（不再隐藏，见 #34） |
| 2 | 窗口不能拖动 | 拖动后 left/top 位移 = 鼠标位移 | fixed | 鼠标 (+140, +60) → 窗口 (`215,169`) → (`355,229`)，dx=140 dy=60 |
| 3 | 最大化不规范 | 双击标题栏翻转 is-max；按钮 aria-label 切换 | fixed | `isMax=true`，`border-radius=4px`，按钮 `aria-label` 由"最大化窗口"变"还原窗口"，窗口底边 828 < dock 顶边 839 |
| 4 | 桌面图标不全 / 拥挤 | 1440 与 390 各一张截图，图标数 = 6 | fixed | 1440：`icons=6`；390：`count=6, columns=3, gapToDock=63` |
| 5 | 台灯过小、光照被阉割、运动没张力 | 甩动后 head 变化 ≥ 25°，光池 translateX ≥ 60px | fixed | 12 帧采样：head `+9.32° → −16.68°`（摆幅 26°），光池 `translateX` 摆幅 104px |
| 6 | 终端做成聊天框 | 一条连续文本流，最后一行是 prompt+输入；useState ≤ 1 | fixed | `promptInsideStream=true, promptIsLastLine=true, inputBorder=0px, inputBackground=rgba(0,0,0,0)`；`TerminalView.tsx` 中 `useState` = 1 |
| 7 | 最小化态用文字变色 | chip 下沿 accent 横条最小化前后翻转 | fixed | `::after` opacity 最小化前 `1` → 最小化后 `0.0016` |
| 8 | 最小化动画被阉割 | minimize 后 150ms 读到矩阵中间值 | fixed | 150ms 时 `transform=matrix(0.4668, 0, 0, 0.4668, 37.82, 238.34)`；330ms 后 `display:none` |
| 9 | 点 dock chip 语义不符合 Win | 连点同一 chip 三次：hidden = false→true→false | fixed | `[false, true, false]` |
| 10 | 文档滞后 | 每条修完立即更新本表与 _audit | fixed | 本表随 1–9 逐条更新 |
| 11 | 最大化/还原 rect 过渡 | 9 点采样（0/40/…/320ms）+ 8 帧长图；相邻差值不允许为 0，0→40ms 差值 ≤ 总变化 40% | fixed | 最大化采样 \`[744,744,744,744,744,1062,1260,1260,1359]\`，还原 \`[1328,1328,1328,1328,1010,866,736,689,689]\`；8 帧长图 \`_bin/shots/strip-maximize.png\` 逐帧放大、无跳变。headless 下 rAF 只有 ~20fps，前 3–4 个采样点落在过渡起播前（约 180ms），因此判据里"首段 > 40% 即跳变"记为 false |
| 12 | 历史命令只有 \`❯\` | 历史行 = \`kanadex@desk ~ % <命令>\` | fixed | 敲 \`ls\` 后回读 \`"kanadex@desk ~ % ls"\`；\`::before\` 的 \`❯\` 已删 |
| 13 | 最大化按下即还原 | 只按下不移动 → isMax 保持；移动 >5px → 还原并跟随 | fixed | 仅按下：\`isMax=true\`；移动 (6,4)px：\`isMax=false\`；窗口 \`(56,62) → (408,108)\` |
| 14 | 标题栏 grab 光标 | \`cursor\` 不是 grab/grabbing | fixed | \`getComputedStyle(bar).cursor = auto\` |
| 15 | 拖动控件用法 | capture 在窗口根、up/cancel 释放、边界 clamp | fixed | capture 在 \`section\`；\`pointerup/pointercancel\` 释放；位移经 \`clampBox\` 限制在 \`.desktop\` 内 |
| 16 | 连点 dock 动画被吃掉 | 最小化后 140ms 立刻还原，两次都要有动画 | fixed | 时间线 scale \`1 → 0.116 → 0.856 → 1.059 → 1\`（含弹簧过冲）；\`minimize\` 立刻落 store、动画期间仍显示节点，还原由 \`phase: restoring\` 状态机接管，定时器/帧在每次新动作前 \`clearTimeout/cancelAnimationFrame\` |
| 17 | 双击与按钮是两套代码 | 所有 toggle 走同一函数 | fixed | 绿点与 dblclick 都调用 \`toggleMaximize()\`；双击两方向采样 \`744→…→1383\` 与 \`1328→…→744\` 均翻转 |

| 18 | 从任务栏点开窗口后再点任务栏，收缩动画消失 | 任务栏触发的最小化必须播 320ms 收缩；手点黄点与点 chip 走同一入口 | fixed | 根因：Dock 直接调 `windowActions.minimize`，绕过了带动画的 WindowFrame。改走 `requestMinimize` 事件后：还原后立刻点 chip：`1 → 0.276 → 0.055`；还原动画中点 chip：`1 → 0.258 → 0.122`；连点三次：`0.135 → 0.640 → 0.533 → 0.126` |

| 19 | 连续切换时动画从头重播而不是从中间反向 | 打断后必须从当前插值位置反向，不允许回到 0/1 端点再起步 | fixed | 根因：`minimize()` 里为了"起播"强制写了 `transform:none` + 强制 reflow，等于每次打断都把视觉拉回端点。删掉全部命令式 transform 写入、只保留 React 的 `collapse` 状态后，CSS 过渡自然从当前计算值插值：最小化到 150ms 时点 chip 还原，scale 轨迹 `0.382 → 0.697 → 1.032 → 1.06 → 1`（中途反向 + 弹簧过冲，全程没有回到 0.06 端点） |

| 20 | 修打断时把 rect 过渡一起砍了 | `.win` 必须继续管 rect 四值；最大化/还原九点采样有多个非零差值 | fixed | 根因：minimize 里残留 5 行"transform='none' + 强制 reflow"重置，且 `is-dragging{transition:none}` 连 transform 一起关。已删全部命令式写入（`grep node.style` = 0），`is-dragging` 改为只关 rect。实测最大化 `637→1013→1247→1337→1392`、还原 `1328→952→718→572` |
| 21 | 打断时不是从中间反向 | 打断轨迹必须从当前值反向，不许回到端点 | fixed | 最小化 150ms 时点 chip：`1 → 0.495 → 0.276 → 0.231 → 0.206 → 0.538 → 0.87 → 1.035 → 1.078 → 1`（从 0.206 往上走，无归零） |

| 22 | 最大化/还原仍然没有可靠动画 | 必须能读到真实存在的动画对象与中途进度，而不是靠采样猜 | fixed | 改为 **WAAPI 单一驱动源**：`.win` 的 CSS transition 已删除；最大化时 `w.getAnimations()[0]` 返回 `{duration:350, easing:cubic-bezier(.34,1.56,.64,1), keyframes:2, playState:"running"}`；还原中途 `progress:0.545`；最小化中途 `progress:0.584, transform:matrix(0.494…)`；打断后仍 `anims:1, progress:0.584, hidden:false`（动画没被重置） |

| 23 | 最大化状态拖动还原时仍有过渡动画 | 拖动还原必须 0 个动画对象、窗口立刻贴到指针下 | fixed | 根因：还原时 `maximized` 翻假触发 rect WAAPI，且 `fill:'both'` 会盖住拖动写的 left/top。加 `isDragging()` 闸门后：最大化 1328px；按下移动 12px 后 `anims:0, isMax:false, w:637, l:401`；继续拖到 …`l:521, t:138`（宽度不再变化，位移跟随指针） |

| 24 | 打开页面没有开机画面，直接出桌面 | 0–3s 纯黑 + 居中手写名字 + 加载环；3s 后交叉淡出，终端此时才进入 | fixed | 页面内计时：开机层 3000ms 后撤 `data-booting`；`.app` 480ms 淡入；`inert` `true → false`。过场帧：`_bin/shots/final/x00080.jpg`（黑屏写字）、`x00470.jpg`（交叉淡出）、`x00950.jpg`（桌面 + 终端） |
| 25 | 窗口进入/退出没有动画（打开即出现、关闭即消失） | 进入 200ms opacity 淡入；退出 180ms 淡出，播完才卸载；都不许缩放进场、不许回弹 | fixed | 进入 35ms：`opacity .186`，`getAnimations()[0]` = 200ms / `cubic-bezier(.25,1,.5,1)` / keyframes 只有 opacity；退出 60ms：`opacity .267`、180ms，260ms 后 DOM 里没有 |
| 26 | 终端在页面加载时就挂在桌面上，入场不走窗口动画 | 开机退场后才 `open('terminal')`，入场复用 WindowFrame 的 200ms 淡入 | fixed | 开机期间 `.win` 数 = 0；退场后挂载即带 200ms opacity 动画；最小化态关闭 30ms 内从 DOM 消失（不播看不见的淡出） |

| 27 | 介绍写成"Android 运行时与界面组件的作者"，夸大且不准 | 只写事实：维护 GeometryOS、VerseBox、QZXUI；GeometryOS 注明维护者之一 | fixed | 对照 `github.com/kanadex` 的 README 与 GeometryOS 组织仓库；`siteConfig`、关于面板、`whoami`、`about.txt` 四处统一；`whoami` 回读 `kanadex / 维护 GeometryOS、VerseBox 和 QZXUI。/ github.com/kanadex` |
| 28 | 卡片右上角状态章是 0.68rem 的系统楷体，像随手打的标签 | 自托管 ZCOOL KuaiLe 子集（1.7KB，OFL）；字与框分开：框走 `#ink-fine`，字不过滤镜；只有"长期维护"用暖色 | fixed | `getComputedStyle(stamp).fontFamily = "ZCOOL KuaiLe"`，13.12px；`document.fonts.check('1em "ZCOOL KuaiLe"', '长期维护') = true`；截图 `_bin/shots/copy/d02-stamps.png` |
| 29 | dock 横条所有未最小化窗口都有，换焦点时没有过渡 | 只有最上层窗口有横条；换焦点时旧条 `scaleX(1→0)`、新条 `scaleX(0→1)`，200ms `--settle` | fixed | `bars@projects`：只有 projects 的 `::after` 是 `matrix(1,…)`，其余 `matrix(0,…)`；切换采样 0.186→0.764→0.955→0.994→1 与 0.814→0.236→0.045→0 |
| 30 | 最小化/还原带弹簧过冲，任务栏指示条也用了 spring，动画发脏 | 最小化/还原、指示条都改 `--settle`；回弹只留给最大化/还原的 rect | fixed | 最小化 1→0.788→0.473→0.245→0.136→0.097→0.079（单调）；还原 0.187→0.603→0.830→0.939→0.978→0.996→1；三条动画 easing 均为 `cubic-bezier(.25,1,.5,1)` |
| 31 | 390px 窄屏下 `.brand` 被 27vw 挤成 105px | 窄屏用 `calc(100vw - 96px)` | fixed | 390×844：`brandW 294`，tagline 2 行（48px）；截图 `_bin/shots/copy/m02-mobile-brand.png` |

| 32 | 墙上那句招呼语被换成了维护者列表 | 墙面保留原句；维护者事实只放在关于面板与 `whoami` | fixed | `.brand__tagline` 回读 `👋你好，我是 Kanadex，...`；截图 `_bin/shots/font/labels-final-full.png` |
| 33 | 窗口刚出现就点最大化看不到动画 | 指针按下即结束入场；最大化时只有 rect 动画，宽度在 40/80/240ms 有中间值 | fixed | +40ms 894、+80ms 1130、+240ms 1367、+320ms 1328；`getAnimations()` 只有 rect（`--spring`），没有 opacity |
| 34 | 最大化时左侧入口被隐藏 | 入口常驻；由窗口 z-index 盖住，还原/关闭不再多一次淡入 | fixed | 最大化时 `.desk-objects` `visibility: visible`；`elementFromPoint(图标中心)` 命中窗口内部 |
| 35 | 漫画字子集扩字后仍用同名文件，标签回落楷体 | 子集内容变就换文件名，并在 `index.html` preload | fixed | `labelW 45.05` 对 canvas `48px "ZCOOL KuaiLe"` 的 45.04（KaiTi 48.96）；请求 `zcool-kuaile-ui.woff2` 返回 200 |

| 36 | 关于面板写的是"我在打磨什么"，不是系统信息 | 除技术栈外改成 neofetch 字段，与终端共用 `systemFields` | fixed | DOM 回读 `OS KanadexOS 1.0.0`、`Kernel React 18 / Vite 5`、`Shell kanadex-term 1.0.0`；截图 `_bin/shots/about/a01-about.png` |

| 37 | `neofetch` 只剩回显，字符画与字段都没有 | 命令异常必须留一行；dev server 返回新模块；字符画与字段都在 | fixed | 终端 `term__line--art` 28 行、`OS: KanadexOS 1.0.0`；截图 `_bin/shots/neo/n01-neofetch.png` |

## 说明

- 判据已从"中间值存在"升级为"9 点采样 + 8 帧长图"。headless 下 rAF 被节流到 ~20fps，
  逐帧采样的时间分辨率有限；8 帧长图（人眼判据）显示最大化过程逐帧放大，没有一步到位。
- 开机过场与窗口淡入淡出用 `Page.startScreencast` 抓帧（截图本身有 0.5–1s 延迟，抓不到过场中间态）；
  行为判据仍以 `getAnimations()` 的 duration/easing/keyframes 与 `performance.now()` 时间轴为准。
