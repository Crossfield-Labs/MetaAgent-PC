# MetaAgent-PC

MetaAgent-PC 是 `MetaAgent` 项目的电脑端组件。这个仓库来源于 NanoClaw 的下游二次开发，目前由 `Crossfield-Labs` 维护，用于 `MetaAgent` 项目的桌面控制与联动能力。

## 项目标识

- 项目名：`MetaAgent-PC`
- 组织：`Crossfield-Labs`
- 小组：`concrete.ai`（`转专业都队`）
- 最终项目名：`MetaAgent`

上游 NanoClaw 的 MIT 许可证继续有效。本仓库保留上游署名，并在 `LICENSE` 中加入了当前项目的下游署名。

## 这个仓库现在做什么

这个仓库已经不是老 README 里描述的通用 NanoClaw 助手框架了。当前版本的核心目标，是作为 `MetaAgent` 的电脑端被控端与调试控制台。

目前主要能力包括：

- Windows 桌面控制 HTTP 服务
- Android 与 PC 的配对流程
- 配对成功后签发临时会话令牌
- 桌面截图与持续桌面预览流
- 鼠标与键盘控制
- 剪贴板、窗口列表、系统信息、启动应用等桌面辅助能力
- 基于 Electron 的桌面控制台，用于本地启动、授权确认、日志查看和调试

预期工作流是：

1. 在 Windows 电脑上启动 MetaAgent-PC。
2. 在 Android 端打开 MetaAgent。
3. 让手机与电脑完成配对。
4. 由手机查看桌面预览并控制电脑。

## 当前技术栈

- Node.js 20+
- TypeScript
- Electron 桌面控制台
- 基于 PowerShell 的 Windows 自动化能力
- 面向 Android 控制端的 HTTP API

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 启动桌面控制台

```bash
npm run gui
```

如果你只想启动桌面控制服务，也可以：

```bash
npm run desktop
```

## 桌面控制台

当前 Electron 控制台提供这些能力：

- 启动与停止桌面服务
- 配置监听地址与端口
- 设置配对密码与自动同意
- 审批手机发起的连接请求
- 调试桌面控制动作
- 查看桌面截图预览
- 查看服务日志与最近事件

## 当前主要接口

桌面服务目前主要暴露这些接口：

- `GET /api/desktop/health`
- `GET /api/desktop/capabilities`
- `POST /api/desktop/pair/request`
- `GET /api/desktop/pair/status`
- `POST /api/desktop/pair/authenticate`
- `GET /api/desktop/session`
- `POST /api/desktop/session/heartbeat`
- `POST /api/desktop/session/close`
- `GET /api/desktop/screenshot`
- `GET /api/desktop/stream`
- `POST /api/desktop/input/move`
- `POST /api/desktop/input/move-relative`
- `POST /api/desktop/input/click`
- `POST /api/desktop/input/type`
- `POST /api/desktop/input/key`

另外还有一组只给 Electron 控制台使用的管理接口，用来处理配对请求与授权设置。

## 仓库结构

当前这个 fork 里，和桌面控制相关的重点目录有：

- `electron/`：Electron 桌面控制台
- `src/desktop/`：桌面控制后端与 HTTP 接口
- `tests/unit/desktop/`：桌面侧单元测试
- `scripts/`：本地启动脚本

## 说明

- 当前项目主要面向 Windows 桌面控制。
- 当前桌面预览是基于截图流的持续刷新，不是硬件编码的远程桌面协议。
- 这个仓库已经和原始 NanoClaw 的产品定位明显分叉，旧 README 已经不再适用。

## 许可证

MIT
