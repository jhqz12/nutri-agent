# 私人营养师 Agent

基于《营养师Agent_完整指令v2.md》的可编辑营养计算与配餐应用。

## 源码包说明

这份源码包是可直接继续开发的项目，不是 GitHub Pages 上那种只包含构建产物的目录。
恢复日期：2026-09-07。

## 本地运行

```powershell
npm.cmd install
npm.cmd run dev
```

如需启用 Supabase 云端同步，请把 `.env.example` 复制为 `.env.local`，再填入你自己的项目配置。
不填环境变量也能正常开发，但登录、云端同步和推送功能会使用本地模式。

## 构建

```powershell
npm.cmd run build
npm.cmd run build:pages
```

`build:pages` 会按 GitHub Pages 的 `/nutri-agent/` 路径生成 `dist`。

## 验证

```powershell
npm.cmd test
npm.cmd run build
```
