# ForeverRise-rebuild

一个基于 Tauri + React 的 CS2 CFG 安装器项目，当前应用名为 `nullify`。

## 功能

- 检测本机 Steam 账号
- 安装 / 卸载 CFG 文件
- 引导设置 Steam 或第三方平台启动项
- 配置连跳、跳投、大跳等功能键位

## 开发环境

- Windows
- Node.js
- Rust / Cargo

## 本地开发

```bash
cd app
npm install
npm run tauri dev
```

## 构建

```bash
cd app
npm install
npm run tauri build
```

## 目录

- `app/`: 前端与 Tauri 应用
- `cfg/`: 生成并写入游戏目录的 CFG 文件
- `tools/`: 辅助生成脚本
