# 交互契约

## 开机

页面打开时先是一段 3 秒的开机画面，它结束之前站点不接受任何操作。

| 时刻 | 状态 |
| --- | --- |
| 0–3000ms | 纯黑 + 正在"写"出来的 `Kanadex_OS` + 加载环；站点本体 `opacity: 0` 且 `inert`（点不到、Tab 不到） |
| 3000–3480ms | 开机画面淡出、站点本体淡入（各 480ms / `--settle`）。这一刻输入已经放行 |
| 3480ms | 开机画面卸载；终端用 `windowActions.open('terminal')` 进入，播的就是普通窗口的 200ms 淡入；深链接窗口也在这一刻一起打开 |
| 之后 | 和以前一样：三键、任务栏、深链接、终端都不变 |

- 开机画面只在页面加载时出现一次，不随任何窗口操作重播。
- 没有"跳过"按钮：过场只有 3 秒，点它反而多一次误触。
- `prefers-reduced-motion`：名字直接给出、加载环停住，退场与窗口都直接出现。
- 判据：`html[data-booting]` 在 3000ms 撤掉；随后 `.app` 的 opacity 从 0 过渡到 1；
  终端窗口挂载时 `getAnimations()[0]` 是 200ms 的 opacity 动画，不是直接出现。

## 窗口

| 动作 | 触发 | 结果 |
| --- | --- | --- |
| 置顶 | 点击窗口任意位置 | `z` 提升，瞬时切换，不做动画 |
| 关闭 | 左上角红点，或任务栏 chip 菜单里的「关闭」 | 一条 `opacity` 淡出（180ms，`--settle`），播完才 `open=false`、组件卸载、chip 消失。**和最小化是两条动画**：最小化绝不淡出 |
| 关闭（已最小化） | 任务栏 chip 菜单里的「关闭」 | 窗口已经收在任务栏里，看不见淡出，直接 `close`，不让人白等 180ms |
| 取消关闭 | 淡出中途点窗口、最小化或最大化 | 把那条淡出**反向播回 1**（不是 `cancel` 跳变），窗口留在原地 |
| 最小化 | 左上角黄点 | 一条 `transform` 缩到任务栏对应 chip（320ms，`--settle`，不过冲），动画结束后才 `display:none`；`minimized` 立刻写入 store，所以任务栏能马上接住"还原"；**组件不卸载** |
| 最大化 / 还原 | 左上角绿点，或双击标题栏 | `left/top/width/height` 四个值插值；最大化后圆角 4px、按钮图标改 ❐ 形态、按钮 aria-label 在"最大化/还原"间切换、底边停在 dock 之上 |
| 拖动 | 在标题栏上按下并移动 | 窗口跟着指针走；最大化时按下不还原，位移 >5px 才还原，且**还原过程不播任何动画**（`anims:0`），窗口立刻贴到指针下 |
| 恢复 | 点任务栏里带「已最小化」的 chip | 回到布局位，内容状态（终端历史、滚动）不丢 |

窗口背景是实心纸色，没有半透明、没有 backdrop-filter；场景的任何渐变都不会盖到窗口上。
同时可以有多个窗口，位置来自 `windowMeta[id].rect`，窄屏（≤860px）统一铺满。

## 任务栏（dock）

- **底部只有这一条**，不放桌面图标，避免和"恢复窗口"混淆。
- 只列出**已打开**的窗口；最小化的 chip 带「已最小化」徽标，点一下恢复。
- 每个 chip 只有一个漫画图标（和 Win11 任务栏一样），标题放在悬停菜单里。
- 下沿 3px 暖色横条**只属于最上面的那扇窗**：换焦点时旧的一条横向收回去、新的一条从中间长出来，
  200ms、`--settle`。最小化 = 收回去，不再有"未最小化的都有横条"的做法。
- **悬停菜单**：指针停在 chip 上时，chip **上方**弹出纸色菜单，固定三项：应用名 / 进入（或还原）/ 关闭。
  菜单是 `<li>` 的子元素，指针移进菜单不会关掉它；键盘 focus 也展开。不是系统 tooltip。
- `z-index: 900`，永远高于所有窗口；最大化窗口的底边停在桌面区下沿（桌面区 `bottom: var(--dock-space)` = 116px），
  与 dock 顶边留出空隙，dock 不会被压住、也不会位移。
- 桌面图标（六个）摆在桌面上，底边距 dock 顶边至少 48px。

## 桌面图标

六个漫画风格入口：终端→terminal，关于→about，项目→projects，笔记→notes，联系→contact，
GitHub→新标签打开外链。点击即打开对应窗口并置顶；hover 只抬 2px。**最大化时也不隐藏**：
窗口的 z-index 高于图标，会自然盖住它们；隐藏只会让还原时多一次淡入。

## 台灯

- 灯指向**当前被操作的目标**，不是鼠标：指针在空白处移动/画圈，灯一动不动。
- 目标优先级：触摸命中（粘 2 秒）> 指针悬停在图标/chip > 焦点窗口 > 静止朝向。
- 移动端：`touchstart` 命中目标才转，`touchmove` 离开后保持指向，松手 2 秒后缓慢回落。
- 逐帧弹簧，不走 CSS transition；判据见 [DESIGN.md 的「台灯」一节](./DESIGN.md)。

## 深链接

```
#about            打开关于
#about,projects   同时打开两个（后者在最上层）
#terminal         回到终端
```

## 终端

终端是一台**只读的会话**：能读文件、能切目录、能看系统信息，不写盘、不发请求、不留副作用。
下面每一项都是可核对的契约，不是氛围描写。

### 开机输出

顺序固定，一共四段：

```
Welcome to KanadexOS <release> (web)

 * Documentation:  github.com/kanadex
 * Management:     cloud.geometryos.cn/serverstatus
 * Support:        qzxxfy@gmail.com

挂载 /dev/web ......................... ok

输入 help 查看全部命令，Tab 补全，↑↓ 翻历史。
Last login: <上次打开终端的时间>
```

| 行 | 来源 | 作用 |
| --- | --- | --- |
| `Welcome to …` | `siteConfig.os` + `release` | 这是哪套系统、哪个版本 |
| 三个 `* …:` | `siteConfig.contact`（github / status / email） | 仓库、服务状态、联系方式，全部是真链接 |
| `挂载 /dev/web … ok` | 固定文案 | 场景叙事：终端挂在这个桌面上 |
| `输入 help …` | `siteConfig.terminal.hint` | 唯一的操作提示 |
| `Last login: …` | `localStorage['kanadex.lastLogin']` | 上次打开的时间；**第一次访问不出现这一行** |

横幅逐行淡入（每行间隔 130ms）。`prefers-reduced-motion` 下一次全部打印。
横幅只出现在首次挂载，`clear` 之后不会重播。

### 提示符

分段上色，和真终端一致，每段一个令牌：

| 段 | 例子 | 颜色 |
| --- | --- | --- |
| 用户名 | `kanadex` | `--term-ok`（绿） |
| `@` | `@` | `--term-fg`（白） |
| 主机名 | `web` | `--term-ok`（绿） |
| `:` | `:` | `--term-fg`（白） |
| 路径 | `~` / `~/projects` | `--term-path`（蓝） |
| 符号 | `%` | `--term-fg`（白） |

- 路径跟着 `cd` 变，实时反映当前目录。
- **历史回显里的提示符用当时那条命令的目录**，不是当前目录。所以往上翻能看到
  `~/projects` 和 `~` 混在一起，这是对的。

### 输入行

输入行就是文本流的最后一行：`提示符 + 已输入文本` 同行，没有边框、没有背景、没有圆角。
光标色用 `--term-accent`。命令文本本身是白色（`--term-fg`），不跟提示符同色。

### 命令

| 命令 | 作用 |
| --- | --- |
| `help` | 列出全部命令 |
| `whoami` / `hello` | 自我介绍 |
| `ls [目录]` | 列出目录内容，路径相对当前目录 |
| `cd [目录]` | 切目录，支持 `..`、`~`、`/`；**成功不输出任何行** |
| `pwd` | 打印当前绝对路径（家目录是 `/`） |
| `cat <文件>` | 读文件，路径相对当前目录 |
| `projects` / `open <id>` | 列出或展示项目，`open` 会把项目窗口叫到前面 |
| `goto <terminal\|about\|projects\|notes\|contact>` | 打开或聚焦对应窗口，不输出确认行 |
| `neofetch` | 一屏系统信息，见下 |
| `date` / `echo` | 时间与回显 |
| `github` / `mail` | 链接与联系方式 |
| `verbose [on\|off]` | 打开后失败才多说一句"是不是想输入…"（默认关） |
| `clear` / `sudo` / `exit` | 清屏与两个玩笑 |

键盘：`Enter` 执行，`↑/↓` 翻历史，`Tab` 补全（命令名、文件路径、项目 id），`Ctrl/Cmd+L` 清屏。
补全按当前目录解析，`cd projects` 之后 `Tab` 补出来的是 `projects/` 下的文件。

### neofetch

左边是字符画（`src/data/portrait.txt`，55 列 × 28 行，构建时打包，运行时不加载图片），
右边是字段。两边同字号、同字宽，整块 `white-space: pre`——**不换行、不缩放、不裁切**。

| 字段 | 取值 |
| --- | --- |
| `OS` | `KanadexOS` + `siteConfig.release` |
| `Host` | `window.location.host`（页面真实被服务的地址，不写死） |
| `Kernel` | 固定文案，写的是这个站点的技术栈 |
| `Uptime` | `performance.now()` 换算成天/时/分 |
| `Packages` | 命令总数（`commands.length`） |
| `Shell` | `kanadex-term` + `siteConfig.release` |
| `Resolution` | `window.innerWidth × innerHeight` |
| `CPU` | `navigator.hardwareConcurrency`（拿不到写 `(0)`） |
| `GPU` | WebGL `UNMASKED_RENDERER_WEBGL`，截断到 44 字符 |
| `Memory` | `performance.memory` 已用/上限；浏览器不给就写 `n/a` |

冒号左边的字段名用 `--term-accent`，值用 `--term-fg`——两段颜色，同一行不换行。

### 输出纪律

- 历史回显 = 提示符（分段上色）+ 空格 + **原始命令**，命令部分白色。
- 命令不存在：只输出一行 `command not found: <原样输入>`。
- 命令执行抛错：必须留一行 `命令执行失败: <message>`，不许静默回到提示符——
  否则"命令崩了"和"命令没有输出"在界面上无法区分。
  没有品牌前缀，没有"是不是想输入 xxx"（除非 `verbose on`）。
- 成功操作不输出确认行（`cd`、`theme`、`goto` 都不报喜）；失败才给一行短错误。
- **任何命令都不许清屏。** 只有用户敲 `clear` 能清。命令只追加输出，不删除别人的输出。
- 放不下就滚动。窗口高度是窗口的问题，不是命令的问题。
- 判据：每条用户命令的响应里，是否多了用户没要求的一行？多了就删。

## 动效预算（一个动作一条）

| 动作 | 动画 |
| --- | --- |
| 打开窗口 | 一条 `opacity` 0→1，200ms，`--settle` |
| 关闭窗口 | 一条 `opacity` 1→0，180ms，`--settle`，播完才卸载 |
| 置顶 | 无（瞬时 z-index） |
| 最小化 | 一条 `transform: translate() scale()`，320ms，`--settle`，缩放比 = chip.width / win.width |
| 任务栏指示条 | 一条 `transform: scaleX()`，200ms，`--settle`；只有最上面的窗口有 |
| 最大化 / 还原 | `left/top/width/height` 四值插值，350ms，`--spring` |
| 开机 | 3s 停留 + 480ms 交叉淡出；名字 1500ms 写完 |
| 灯 | 逐帧弹簧逼近目标方向（指向控件，不跟鼠标）；无目标回静止朝向；静止 1.2s 后呼吸 + 偶尔走神 |

进入与退出只动 opacity，**最小化只动 transform**；没有入场缩放、没有回弹、没有焦点抬升、
没有背景变暗、没有模糊。回弹只留给最大化/还原的 rect 插值——不是所有动作都配得上弹簧。

## 五个动作的判据（九点采样，实测量）

| 动作 | 采样 | 结论 |
| --- | --- | --- |
| 最大化 | 637 → 1013 → 1247 → 1337 → 1392 | 有过渡，末尾回弹 |
| 还原 | 1328 → 952 → 718 → 572 | 有过渡 |
| 最小化（现版本 `--settle`） | 1 → 0.788 → 0.473 → 0.245 → 0.136 → 0.097 → 0.079 | 有过渡，单调收敛，无过冲 |
| 从 chip 还原 | 0.187 → 0.603 → 0.830 → 0.939 → 0.978 → 0.996 → 1 | 有过渡，无过冲 |
| 任务栏指示条（切焦点） | 新条 0.186 → 0.764 → 0.955 → 0.994 → 1；旧条 0.814 → 0.236 → 0.045 → 0 | 横向伸/缩，0 与 1 之间单调 |
| 打断（140ms 时反向） | 0.172 → 0.444 → 0.697 → 0.848 → 0.932 → 0.980 → 0.995 → 1 | 从中间值反向，无归零、无过冲 |
| 进入（打开「关于」） | 35ms：`opacity: .186`；`getAnimations()[0]` = 200ms / `cubic-bezier(.25,1,.5,1)` / keyframes 只有 opacity | 有淡入，无缩放 |
| 退出（红点） | 60ms：`opacity: .267`；动画 180ms；260ms 后窗口已不在 DOM | 有淡出，播完才卸载 |
| 最小化（对照） | 140ms：`opacity: 1`、`transform: matrix(.024…) scale`；动画 320ms、keyframes 只有 transform | 是收缩，不是淡出 |
| 关闭已最小化的窗口 | 关闭后 30ms：`.win` 数量 0 | 不播看不见的淡出 |
| 取消关闭 | 60ms 时 `opacity .36`；作废后 `playbackRate: -1`，340ms 时回到 `1`、窗口还在、动画已摘掉 | 从中间值反向，不跳变 |
| 开机 | 3000ms 撤 `data-booting`；卸载后终端以 200ms 淡入出现 | 终端入场复用窗口动画 |

实现：窗口的 rect / transform 走 WAAPI（`useWindowMotion`），进入 / 退出的 opacity 走 WAAPI
（`useWindowFade`），`.win` 上没有 CSS transition；判据用 `getAnimations()` 的
duration/easing/keyframes/progress，而不是只看采样值。

判据细则见 `_audit/05-动画可打断红线.md`。

**打断规则**：任何动画进行中再次触发，都从当前计算位置反向插值（不回到端点重播）。
实现上只有一份真相——React 的 `collapse` 状态；禁止用 `style.transform = 'none'` 之类的"重置起播"技巧，
那会把中间位置的视觉拉回端点，表现为跳变。
