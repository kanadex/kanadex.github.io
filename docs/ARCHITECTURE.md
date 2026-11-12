# 架构

## 三层

```
┌─────────────────────────────────────────────┐
│ Boot（开机画面，z-index: 1000）              │  纯黑 / 手写的 Kanadex_OS / 加载环，3 秒后卸载
├─────────────────────────────────────────────┤
│ Stage（固定舞台，z-index: 0）                │  夜空 / 山丘 / 桌面 / 台灯
├─────────────────────────────────────────────┤
│ Desktop（窗口层，z-index: 3）                │  若干窗口，绝对定位，按 z 排序
├─────────────────────────────────────────────┤
│ Chrome（顶栏 60 / 桌面物件 4 / 任务栏 40）    │  全局常驻
└─────────────────────────────────────────────┘
```

开机画面与站点本体是兄弟节点，都挂在 `#root` 下；`.app` 包住舞台、窗口、任务栏，
开机期间整层 `opacity: 0` + `inert`。

舞台不参与滚动、不接收指针事件；窗口是唯一可交互的内容层。
舞台与窗口之间没有 CSS 依赖，只共享设计令牌。

## 状态

只有一份全局状态：窗口管理器。

```ts
// src/desktop/windowStore.ts
interface WindowState {
  id: WindowId;
  open: boolean;       // 是否在桌面上存在
  minimized: boolean;  // 是否收进任务栏
  maximized: boolean;  // 是否铺满
  z: number;           // 叠放次序
}
```

- 用 `useSyncExternalStore` 订阅，没有引第三方状态库。
- **初始时桌面上没有窗口。** 终端由 `App` 在开机画面退场后 `open('terminal')`，
  这样它的"进入"和后来打开的窗口是同一条动画，不是页面一加载就在那儿。
- `windowActions` 只有六个动作：`open / close / minimize / restore / toggleMaximize / focus`。
- 最小化不改 `open`，窗口组件仍然挂载，只是 `hidden`，
  所以终端历史、面板滚动位置都不会丢。
- 关闭才把 `open` 置否，窗口卸载。

其余状态全部是局部的：终端行、输入框内容、拖拽滚动都在组件内部。

## 舞台：三层关节灯 + 目标注册表

```
画布 815×1216（比例 0.6702），关节在画布里的坐标：

lamp__lean   （底座 + 下臂）  原点：(475, 1204)
lamp__upper  （上臂）         原点：(758, 579)
lamp__head   （灯颈 + 灯罩 + 光锥） 原点：(473, 137)
罩口（指向极点）：(125, 235)，轴线静止角 164.28°
```

三个 `transform-origin` 只在 `scene.css` 里写一次（view-box 坐标），
组件不给 SVG 写 `transform-origin` 属性。

灯的运动拆成三个文件，各管一件事：

| 文件 | 职责 |
| --- | --- |
| `app/aimRegistry.ts` | 谁可能被照：目标注册、hover/touch/focus 解析、矩形缓存 |
| `app/lampKinematics.ts` | 纯运动学：角度分配、弹簧积分、呼吸/走神/点头 |
| `app/useLampRig.ts` | 每帧回路：取目标点 → 算角度 → 写三层 `transform` |

关键点：

1. **灯不追鼠标。** 回路里没有 `pointermove`。目标优先级：`touch`（粘 2s）> `hover` > `focused` > 静止朝向。
2. 目标点 = 目标元素包围盒中心；角度以**罩口**（viewBox `125, 235`）为极点计算，
   减掉光锥的静止角 `164.28°` 才是灯头要转的角度（拿"虚构的静止点"当基准会差 36°）。
3. 角度分配：`lean = clamp(delta×.07, ±4°)`、`upper = clamp(delta×.30, ±13°)`、
   `head = axis − upper − lean`（head 是导出量，保证光锥真的落在目标上）。
4. 弹簧：`a = k(target−x) − 2√k·ζ·v`，半隐式欧拉，`dt` 钳 34ms / 1/120s 子步。
5. 台灯**不进 React 状态**：帧循环直接写 DOM `transform`，所以桌面不会每帧重渲染。

光锥和桌面光池画在灯头组里，所以灯头一转，光就跟着转——
这也是为什么光锥不能用固定背景图。

`prefers-reduced-motion` 下不做弹簧与呼吸：直接把角度设到目标值。

## 窗口

`WindowFrame` 负责三件事：定位、控制键、内容插槽。

- 位置来自 `windowMeta[id].rect`（百分比，相对桌面区），响应式在窄屏统一铺满。
- 控制键是 `win__dot--close / --min / --max`，与桌面系统一致：红黄绿，悬停才显形。
- 最大化时 `App` 会给舞台加 `is-dim`，让灯与月亮退后（`scale + brightness + blur`）。

窗口的运动拆成两个钩子，各管一件事，互不写对方的属性：

| 文件 | 管什么 | 驱动 |
| --- | --- | --- |
| `desktop/useWindowMotion.ts` | 最大化/还原的 rect、最小化/还原的 transform | WAAPI |
| `desktop/useWindowFade.ts` | 进入与退出的 opacity（200ms / 180ms） | WAAPI |

- 进入 = 组件挂载（关闭后重开也是同一条路径），所以开机后终端的入场不需要任何特殊分支。
- 退出必须**播完再提交**：红点与任务栏菜单都走 `lib/windowBus.requestClose` → `WindowFrame.close`，
  淡出结束（或被作废）才 `windowActions.close`。
- 最小化不经过 `useWindowFade`：那是收缩到 chip 的 transform 动画，组件保持挂载。
  两个动作共用一条动画，用户就分不清"收进任务栏"和"关掉了"。
- 缓动只有一个来源：`lib/easing.ts` 读 `tokens.css` 的 `--settle` / `--spring`，
  不许在 JS 里再写一份 cubic-bezier。

## 开机

```
src/boot/BootScreen.tsx   纯黑 + 手写的名字 + 加载环；自己管 3s 计时、字体等待与退场
src/styles/boot.css       上面那一屏的全部样式（遮罩写法、环的规格都在这里）
```

- 3 秒到点：删掉 `<html>` 上的 `data-booting`（站点本体开始淡入）、给开机层加 `is-leaving`（开始淡出），
  480ms 后调 `onDone` —— `App` 在这一刻卸载开机层，并 `open('terminal')` 与解析深链接。
- 开机期间 `.app` 带 `inert`，指针与键盘都进不去；这期间桌面是挂载的，只是不可见。
- 名字用 `siteConfig.handle`，字体是 `--serif`（和墙上名字同一个 Young Serif），
  写法是把整行用一个两倍宽的软边遮罩扫过去——不拆 `<span>`，否则会丢字距。
- 加载环是 WinUI 3 ProgressRing 的不确定态：conic-gradient 的弧 + 径向遮罩取环带 + 头端一个圆点，
  匀速转盘改成每圈快慢各一次。
- 首帧不能闪：`index.html` 里静态写 `html{background:#000}` 与 `data-booting`。

## 终端

终端是"内核 + 外壳"两段：

- `src/terminal/` 内核：`vfs.ts`（只读虚拟文件）、`commands.ts`（命令表 + Tab 补全 + 拼写建议）、
  `useTerminalSession.ts`（行缓冲、历史、开机输出、verbose 开关）。
- `src/terminal/TerminalView.tsx` 外壳：只管渲染文本流与键盘，不写业务判断。

文案纪律（见 `docs/INTERACTION.md`）：历史回显是完整提示符一行、失败只有一行
`command not found: xxx`，成功操作不输出确认行。

跨组件触发终端：`lib/terminalBus.ts` 发一个自定义事件，
项目卡片里的 `open versebox` 按钮就是这样把命令送进终端的。

## 主题

`tokens.css` 里有两套：默认夜色（`data-theme="night"`）与白天（`paper"`）。
切换只改 `<html data-theme>`，窗口的纸色、终端的暗色保持不变，
变的是天空、山丘、桌面、灯线——所以切换不会让窗口"跳一下"。

## 新增一个窗口

1. 在 `windowStore.ts` 的 `WindowId` 与 `windowMeta` 里加一项（含位置与 `tone`）。
2. 在 `src/panes/` 写内容组件。
3. 在 `App.tsx` 的 `panes` 映射里注册。
4. 需要的话，在 `DeskObjects.tsx` 加一个桌面物件，或在 `TopBar` 的 `nav` 里加一项。

不需要改任何 CSS 位置规则，也不需要动舞台。
新窗口自动成为台灯的目标（`WindowFrame` 会登记 `win:<id>`）；
如果它还需要桌面图标，在 `DeskObjects` 的 `entries` 里加一项就行。
