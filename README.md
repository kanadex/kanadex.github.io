<p align="center">
  <img src="public/media/avatar.jpg" alt="Kanadex" width="96">
</p>

# kanadex-web

👋 你好，我是 Kanadex。这是我的个人 web 主页

- <https://kanadex.geometryos.cn>
- <https://kanadex.github.io>

![主页](docs/assets/homepage.png)

## 它做了什么

可跟随鼠标改变角度的台灯、有趣的窗口管理以及前端实现的终端页面。

## 运行

```bash
pnpm install
pnpm dev      # http://localhost:7777（热更新）
```

需要 Node ≥ 22 与 pnpm。

## 发布校验

```bash
pnpm run typecheck   # 类型
pnpm run build       # 类型 + 构建 + 产物完整性（check:dist）
pnpm run test:smoke  # 对着 dist 用真实浏览器冒烟
```

详见 [docs/RELEASE.md](docs/RELEASE.md)。