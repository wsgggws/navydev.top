# Cinematic Portfolio Agent Guide

## 语言

默认使用中文（简体）。注释、文档、提交信息、对话回复都优先中文。代码标识符、文件名、配置项保持英文。仅在用户明确要求英文时切换。

## 项目目标

这是一个电影化交互作品集，不是传统网页。

访客点击开始后连续观看一卷 reel。每个故事都是独立的 `Scene`，没有路由跳转，没有页面式导航。`MovieDirector` 是唯一播放控制者，负责加载、预热、挂载、播放、转场、章节跳转和销毁。

设计判断优先级：

1. 电影表达：镜头、剪辑、黑场、声音、节奏优先于普通网页布局。
2. 流畅播放：首屏轻、首个用户手势后可整卷预热、当前场景播放时仍只依赖下一场预热保证转场。
3. 场景隔离：一个场景只讲一个故事，不能引用其他场景。
4. 可扩展：新增场景主要改 `movie/movie.ts` 注册表，不碰 Director 主逻辑。

## 架构

```text
src/
  App.tsx                  # React 壳：挂载 stage，处理音频手势、倒计时、控制条和 MovieDirector
  styles.css               # 全局舞台、letterbox、title card、transition matte、控制层

movie/
  movie.ts                 # reel 注册表：轻量 config + lazy load()
  prewarm.ts               # 开场前预热 Three.js pipeline、场景实现和 preload()
  types/scene.ts           # SceneConfig / SceneModule / SceneEntry 契约
  director/
    MovieDirector.ts       # 播放、加载缓存、预热下一场、转场、章节控制、自动重启、销毁
    Timeline.ts            # 每场唯一 GSAP 时间线
    Camera.ts              # CSS camera 抽象
  lib/
    motion.ts              # prefers-reduced-motion 读取和监听
    transition.ts          # title card / iris 等共享过场能力
    audio/SoundDesign.ts   # 共享声音设计
    three/CinematicStage.ts# Three.js 舞台，动态加载 three + postprocessing
  scenes/
    scene-01/
      config.ts            # 轻量 metadata，可静态导入
      scene.md             # 剧本
      index.ts             # 重实现，必须通过 load() 动态导入
      styles.css           # 场景样式，使用 data-scene-id 作用域
```

## 场景注册

`movie/movie.ts` 必须保持 lazy registry 形态。

正确模式：

```ts
import type { SceneEntry } from "./types/scene";
import { scene as hacker } from "./scenes/scene-01/config";

const reel: SceneEntry[] = [
  {
    config: hacker,
    load: async () => (await import("./scenes/scene-01")).default,
  },
];

export default reel;
```

不要在 `movie/movie.ts` 静态导入场景 `index.ts`：

```ts
// 不要这样做：这会把所有场景塞回首屏主包。
import Hacker from "./scenes/scene-01";
```

原因：`config.ts` 是轻量 metadata，Director 可以立即读取标题、时长、节奏、色彩和转场；`index.ts` 会包含 Three.js、CSS、音频、shader、剧本等重内容，必须按 reel 进度加载或在用户点击 ROLL 后预热。

## 场景契约

每个场景目录必须包含：

- `config.ts`
- `scene.md`
- `index.ts`
- `styles.css`

`config.ts` 必须完整描述该场景的叙事和调度信息：

```ts
export const scene: SceneConfig = {
  id: "scene-12",
  title: "New Scene",
  caption: "short intent line",
  mood: "signal",
  pacing: "pulse",
  shot: "closeup",
  colorGrade: "monitor-blue",
  soundMotif: "rhythm",
  titleCard: "chapter-card",
  duration: 14,
  playbackRate: 1.5,
  transition: "fade",
  preload: [],
};
```

当前支持的配置枚举以 `movie/types/scene.ts` 为准：

- `transition`：`fade`、`cut`、`wipe`、`zoom`、`glitch`、`iris`、`match-cut`
- `mood`：`isolation`、`signal`、`rush`、`contrast`、`play`、`release`
- `pacing`：`slow-burn`、`pulse`、`staccato`、`hold`、`crescendo`
- `shot`：`establishing`、`medium`、`closeup`、`macro`、`overhead`、`split`
- `colorGrade`：`monitor-blue`、`noir-green`、`neon-pink`、`toxic-red`、`warm-garden`、`launch-amber`
- `soundMotif`：`bed`、`rhythm`、`accent`、`silence`
- `titleCard`：`chapter-card`、`cold-open`、`burn-in`、`terminal-caption`、`silent-card`

`index.ts` 默认导出一个 `SceneModule`：

```ts
{
  config,
  script,
  preload(): Promise<void>,
  create(root: HTMLElement): void,
  warmup?(): Promise<void>,
  play(timeline): void,
  pause(): void,
  destroy(): void,
}
```

要求：

- `config.id` 必须等于文件夹名。
- `script` 来自同目录 `scene.md`，用于剧本、字幕、辅助上下文。
- `preload()` 只做资源预载，不挂载 DOM。
- `create()` 只创建 DOM、Canvas、Three.js 对象和局部引用，不启动叙事动画。
- `warmup()` 可选，用于 post-create 的首帧准备；不要在其中安排剧情。
- `play(timeline)` 把叙事动画挂到 Director 提供的 GSAP timeline。
- `destroy()` 必须幂等，释放 DOM、音频、ticker、Three.js geometry/material/renderer/canvas。
- 场景之间不能互相 import。
- 共享能力放入 `movie/lib/`，不要复制到每个场景。

## 时间与动画

GSAP timeline 是场景叙事的唯一时间源。

禁止：

- 用 `setTimeout` 或 `setInterval` 安排剧情节点。
- 在主 timeline 里放 `repeat: -1` 的无限 tween。
- 在场景销毁后仍保留 ticker、audio loop、DOM 粒子或 WebGL 渲染循环。

允许：

- CSS keyframes 用于局部纹理、雨滴、闪烁等非叙事装饰。
- 瞬时粒子、火花等可以用独立 GSAP tween，但不能改变主 timeline 的总时长。
- `MovieDirector` 内部可以用短 `setTimeout` 驱动 CSS transition matte，因为这是剪辑层，不是场景叙事层。

`MovieDirector` 会把 timeline pin 到 `config.duration`：如果场景动画总时长短于声明时长，会补一个空 tween；如果动画超出声明时长，需要优先修场景，不要依赖 Director 自动兜底。

## 剪辑与转场

舞台分两层：

- `.stage-scenes`：当前场景根节点。
- `.stage-overlays`：Director 创建的过场 matte 覆盖层。

Title card 由 `App.tsx` 通过 `mountTitleCard(stage)` 挂到 `.stage`，使用更高 z-index 保持跨场景可见。Title card 样式会读取 `mood`、`pacing`、`colorGrade`、`titleCard`。

Director 在黑场完全覆盖后销毁旧场景并挂载新场景。不要在场景内部自行切换到下一个场景。场景只声明 `config.transition`，实际转场由 Director 控制。

支持的 `transition`：

- `fade`
- `cut`
- `wipe`
- `zoom`
- `glitch`
- `iris`
- `match-cut`

在 `prefers-reduced-motion: reduce` 下，非 `cut` 转场会降级为较短的 fade。

## Three.js 与性能

3D 场景必须在 `preload()` 中调用 `ensureThree()`，再在 `create()` 中 new `CinematicStage`。

`CinematicStage` 已经做了：

- 动态导入 `three` 和 postprocessing。
- renderer pixel ratio 默认上限 `1.5`。
- 高 DPR 下关闭 antialias。
- 使用 `powerPreference: "high-performance"`。
- 统一 `dispose()` 释放 renderer、composer、geometry、material。

性能约束：

- 首屏主包不能静态包含场景实现、Three.js 重模块或场景级资源。
- ROLL 后 `prewarmReel()` 可以整卷预热；播放中仍保持当前场景只等待下一场的模型。
- Canvas texture 只在内容变化时更新，不要每帧重画静态画面。
- bloom、shader、阴影、粒子数量要有明确画面收益。
- DOM 粒子用完必须移除。
- 大资源必须进入场景 chunk 或 `preload()`，不要进入主入口包。

## 音频

浏览器需要用户手势才能播放音频。`App.tsx` 的 ROLL 流程会调用 `primeAudio()`；自动触发时浏览器可能仍保持 AudioContext suspended，手动点击 ROLL 或解除静音才是可靠的音频手势。场景内的 ambient/loop 音效必须返回 stop handle，并在 `destroy()` 中全部停止。

静音状态由 `SoundDesign.ts` 管理。UI 和键盘 `M` 都应该走 `toggleMuted()`，解除静音后调用 `primeAudio()`。

## 用户控制

开场：

- 页面加载后会自动触发一次 ROLL 流程；用户也可以手动点击 `ROLL`。
- ROLL 后显示 3 秒倒计时，同时调用 `primeAudio()` 和 `prewarmReel(reel)`。
- 倒计时至少 3 秒；预热最多等待约 5.2 秒，不让开场无限卡住。

播放中：

- 章节轨显示当前章节、标题和每章进度，点击任意章节调用 `goToScene(index)`。
- 控制条提供 `PLAY/PAUSE`、`SOUND/MUTE`、`REPLAY`、`SKIP`、`RESTART`。
- Reel 播完后会在最终黑场停留约 3.2 秒，然后自动回到第一章。

快捷键：

- `Space`：播放 / 暂停
- `M`：静音 / 解除静音
- `R`：重播当前场景
- `S` 或 `ArrowRight`：跳过当前场景
- `Home`：从第一章重启
- `1` 到 `9`：跳到第 1 到第 9 章
- `0`：跳到第 10 章
- `-`：跳到第 11 章

## 新增场景流程

假设新增 `scene-12`：

1. 创建 `movie/scenes/scene-12/`。
2. 添加 `config.ts`、`scene.md`、`index.ts`、`styles.css`。
3. 在 `movie/movie.ts` 静态导入 `config`，并添加 `load()` 动态导入。
4. 确认 `config.id` 等于 `scene-12`。
5. 运行 `npm run typecheck` 和 `npm run build`。
6. 手动跑完整 reel，确认场景能进入、能退出、资源能销毁。

## 验证

当前没有自动化测试套件。提交前至少运行：

```bash
npm run typecheck
npm run build
```

运行体验检查：

```bash
npm run dev
```

重点手动检查：

- ROLL 后音频没有报错，倒计时期间预热状态正常。
- 每个 title card 可见且没有被场景清空。
- 每个场景结束后能自然进入下一场。
- 控制条和章节轨可点击，快捷键可用。
- reduced motion 下动画明显降级但叙事仍完整。
- 3D 场景切换后旧 canvas 被移除。
- 生产构建没有主入口 chunk 过大的警告。

## 当前 Reel

| 顺序 | ID         | 标题                | 叙事角色                                   |
| ---- | ---------- | ------------------- | ------------------------------------------ |
| 1    | `scene-02` | The Terminal        | 自我介绍，身份、motto、终端人格先出场      |
| 2    | `scene-09` | The Reading Room    | 阅读、历史、没有 Claude Code 的古代 Coding |
| 3    | `scene-10` | The Runner's Loop   | 跑步路线、配速、系统提升                   |
| 4    | `scene-01` | The Hacker          | 暗室、显示器、代码纹理、进入工作状态       |
| 5    | `scene-08` | The API Affair      | WebAPI 关系日志、崩溃陪跑和背锅            |
| 6    | `scene-07` | The Bug Forge       | GIL/goroutine 气质的 Bug 与优雅修复        |
| 7    | `scene-04` | The Garden          | 左右分屏：算法噪音 vs 花园秩序             |
| 8    | `scene-11` | The Toolchain Orbit | Tmux/Neovim/Python/Go/Linux 工具链星图     |
| 9    | `scene-03` | Sparks              | Neovim、粒子火花、combo 节拍               |
| 10   | `scene-05` | Crabtris            | 3D 方块棋盘、游戏化节奏                    |
| 11   | `scene-06` | The Launch Deck     | 发射控制台、路线图、收束结尾               |

## 编码风格

- TypeScript strict。
- 公共 API 显式标注类型。
- 优先组合，不引入继承层级。
- 不引入全局 mutable state；确有需要时放在 Director 或共享 lib，并清楚管理生命周期。
- 注释只解释不明显的意图、约束或资源生命周期。
- 改动要小而准，不做无关重构。
