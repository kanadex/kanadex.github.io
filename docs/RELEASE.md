# 发布校验

这个仓库的质量门禁只有四道，全部对着**构建产物**，不靠"我打开看了一眼"。
每一道都能在本地一条命令跑完，也都在 CI 里跑。

| 门 | 命令 | 跑在哪 | 查什么 |
| --- | --- | --- | --- |
| 1 类型 | `pnpm run typecheck` | 本地 / ci / release | `tsc --noEmit`：类型是否闭合 |
| 2 构建 + 产物完整性 | `pnpm run build` | 本地 / ci / release | 能否产出 `dist/`，且产物里的引用全部命中真实文件 |
| 3 产物冒烟 | `pnpm run test:smoke` | 本地 / ci / release | 用真实浏览器打开 `dist/`，断言开机、窗口、最大化、dock 菜单的状态 |
| 4 打包 | `release.yml` | 推送 tag 并发布 release | 前三道全过才把 `dist/` 打成 `dist.tar.gz` 挂到 release |

`pnpm run build` 内部已经是 `typecheck → vite build → check:dist`，所以**构建成功就等于前两道过了**。

## 1 类型：`pnpm run typecheck`

`tsc --noEmit` 只做检查、不产出文件。它抓的是"代码内部约定被破坏"：
属性名打错、函数参数类型不对、改了一个 `interface` 却漏改调用方。

原理：这一步不跑代码，所以最快，也最不值得省。CI 里它是第一道，失败后面都不用跑。

## 2 产物完整性：`scripts/check-dist.mjs`

构建通过 ≠ 产物可用。静态站最常见的事故是**引用指向不存在的文件**：
图标路径写成 `/favicon.svg`（文件早改名了）、字体只放进了源码目录、图片忘了进 `public/`。
页面照样打开，只是某个角落 404，而且开发态完全看不出来。

脚本对着 `dist/` 的真实文件列表判断三件事：

1. 必需的发布文件在不在：`index.html`、`robots.txt`、`favicon.ico`、`favicon-32.png`、
   `apple-touch-icon.png`、`media/avatar.jpg`、两套字体。
2. `index.html` 里的 `href` / `src` / `content`，以及每个 CSS 里的 `url(...)`，
   站内引用是否都能在 `dist/` 里找到对应文件（外部链接、`mailto:`、`#锚点` 跳过）。
3. 有没有混进开发态的东西：`@vite/client`、`/src/xxx.tsx`、写死的 `localhost:7777`。

失败时它把问题逐条列出来并以 1 退出 —— 构建这一步就红，不会带着坏产物往下走。

为什么用脚本而不是插件：规则很短、全是路径判断，一个 100 行的 node 脚本比引一个
依赖更好读，也不会有版本噪音。加规则就是往 `required` 或检查段里加一条。

## 3 产物冒烟：`scripts/smoke.mjs`

它起 `vite preview` 指向 `dist/`，再用 CDP 驱动一个真实浏览器跑 13 条断言。

| 断言 | 防的是什么 |
| --- | --- |
| 开机层出现、字是 `Kanadex_OS` | 开机画面被删掉、或被改回别的字 |
| 开机期间 `.app` 带 `inert`，结束后摘掉 | 过场期间桌面能被点到；或者反过来永远点不到 |
| `data-booting` 在 3 秒后撤掉、`.app` 淡入到 1 | 站点永远停在黑屏或者半透明 |
| 终端窗口在开机退场后才挂上 | 终端提前出现在桌面上，入场动画失效 |
| 打开「项目」后共两扇窗 | 窗口系统挂不上 |
| 最大化后宽度等于桌面区、还原后小于它 | 最大化/还原的 rect 与类名脱节 |
| 悬停满 0.8s 弹出 dock 菜单 | 意图延迟被改没 |
| 等待中点击后菜单不补弹 | 点击作废被改没（移动端会闪菜单） |
| 没有脚本异常 | 任何运行时报错 |

原理：冒烟测的不是"每条逻辑"，而是**几个跨模块的状态有没有接上**。
窗口系统、开机过场、dock 菜单各自都能单独看起来正常，接起来才会出问题，
而这些问题恰好都是"打开页面就知道坏了"的类型。

为什么不用 dev server 手点代替：

- dev 跑的是热更新态，压缩、分包、路径重写都可能让产物行为不同；冒烟测的是产物；
- "我看了一眼"不可复现，也进不了 CI；
- 0.8s 意图延迟、最大化宽度这类东西，肉眼判不准，脚本每次都判同一个标准。

为什么自己写 CDP 而不是装 Playwright：这个仓库只需要打开页面、点几下、读几个数值，
CDP 够用；不引依赖就不会有"等下载 100MB 浏览器"和版本漂移。
代价是断言得自己写，所以只保留最有价值的那 13 条。

浏览器查找顺序：`SMOKE_BROWSER` 环境变量 → Windows 的 Edge/Chrome → Linux 的
`google-chrome` / `chromium` → macOS 的 Chrome。找不到就**报错退出**，不静默跳过。

## 4 打包：只在 release 时发生

`.github/workflows/release.yml` 在 release 发布时按 tag 构建，再跑一次冒烟，
然后 `tar -czf dist.tar.gz dist` 挂到 release 上。
也就是说：**tag 可以随便打，但只有过了前三道的产物才会成为 release 资产。**

## 本地怎么用

```bash
pnpm run typecheck   # 类型
pnpm run build       # 类型 + 构建 + 产物完整性
pnpm run check:dist  # 只跑产物完整性（dist 已存在时）
pnpm run test:smoke  # 产物冒烟（会自己起 preview，端口 4188）
```

`test:smoke` 需要本机有 Chrome 或 Edge，并且 `dist/` 是最新的。CI 里用
`SMOKE_BROWSER=/usr/bin/google-chrome` 指定。

## 不做什么（以及为什么）

- **不写单元测试**：这个仓库的逻辑几乎全是 DOM 与动画，纯函数很少，
  单测会写成"测一遍 React 有没有工作"，收益低于成本。等真的出现复杂纯逻辑再补。
- **不做视觉回归截图对比**：字体、抗锯齿、GPU 渲染在不同机器上有差异，
  截图 diff 会变成天天修基线。视觉靠人看截图，靠脚本守状态。
- **不引 ESLint / Prettier**：现在代码风格统一靠约定，`tsc` 已经能挡住大部分低级错误；
  真要加，先加 `noUnusedLocals` 这类已经开着的规则，再考虑格式化工具。

## 加新检查的规矩

1. 一条断言只描述**一个可复现的状态**（数值、类名、元素存在），不描述"看起来对"。
2. 断言失败必须指向具体原因，不是"smoke failed"。
3. 允许慢，不允许 flaky：等状态而不是 `sleep` 一个魔法数字（必要的等待要写清为什么）。
4. 门禁只加在**本地也能跑**的地方 —— 本地跑不了的检查，等于没有。
