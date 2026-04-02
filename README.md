# 动一动方块

一个基于浏览器摄像头和 MediaPipe Pose 的体感俄罗斯方块小游戏。

## 功能

- 摄像头姿态识别
- 动作校准
- 体感控制方块移动、旋转、加速下落
- 本地最高分保存
- 电脑端和手机端独立布局

## 本地运行

项目是纯静态前端，建议通过本地 HTTP 服务打开。

### 方法 1：Python

```bash
python -m http.server 8080
```

打开：

```text
http://localhost:8080
```

### 方法 2：VS Code Live Server

直接用 Live Server 打开项目根目录即可。

## 发布到 GitHub Pages

1. 在 GitHub 新建一个空仓库
2. 把本项目推送到该仓库默认分支
3. 在仓库 `Settings -> Pages`
4. 选择 `Deploy from a branch`
5. 选择 `main` 和 `/ (root)`
6. 保存后等待 GitHub Pages 部署完成

## 目录结构

```text
.
├─ index.html
├─ styles.css
├─ README.md
├─ .nojekyll
└─ src
   ├─ app.js
   ├─ calibration.js
   ├─ config.js
   ├─ game.js
   ├─ motion.js
   ├─ pose.js
   ├─ storage.js
   └─ ui.js
```
