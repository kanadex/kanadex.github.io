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
pnpm dev      # http://localhost:7777
pnpm build    # 产物在 dist/
```

需要 Node ≥ 20.10 与 pnpm

## 发布

站点用 GitHub Actions 构建。发布时：

1. 打 tag 并推送：`git tag v1.0.0 && git push origin v1.0.0`
2. 在 GitHub 上以这个 tag 创建并发布 release。
3. `release` workflow 会构建，把 `dist/` 打成 `dist.tar.gz`，附到该 release 上；
   同时留一份 7 天的 `dist-<run id>` artifact。

tag push 本身不触发构建，发布 release 才触发。需要重跑时，在 Actions 里手动运行
`release`，填已有的 tag。

