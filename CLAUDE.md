# Cinematic Portfolio Agent Guide

## 语言

默认使用中文（简体）。注释、文档、提交信息、对话回复都优先中文。代码标识符、文件名、配置项保持英文。仅在用户明确要求英文时切换。

## 项目目标

这是一个电影化交互作品集，不是传统网页。

访客进入后从一句序幕直接观看连续 reel。每个故事都是独立的 `Scene`，没有路由跳转，没有页面式导航。`MovieDirector` 是唯一播放控制者，负责加载、预热、挂载、播放、转场、章节跳转和销毁。

设计判断优先级：

1. 电影表达：镜头、剪辑、黑场、声音、节奏优先于普通网页布局。
2. 流畅播放：首屏轻、用户点击后只预热前两章，当前场景播放时依赖下一场预热保证转场。
3. 场景隔离：一个场景只讲一个故事，不能引用其他场景。
4. 可扩展：新增场景主要改 `movie/movie.ts` 注册表，不碰 Director 主逻辑。

## 架构

```text
src/
  App.tsx                  # React 壳：挂载 stage，处理音频手势、序幕、控制条和 MovieDirector
  styles.css               # 全局舞台、letterbox、title card、transition matte、控制层

movie/
  movie.ts                 # reel 注册表：轻量 config + lazy load()
  prewarm.ts               # 开场前预热 Three.js pipeline、场景实现和 preload()
  types/scene.ts           # SceneConfig / SceneModule / SceneEntry 契约
  director/
    MovieDirector.ts       # 播放、加载缓存、预热下一场、转场、章节控制、销毁
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
- ROLL 后 `prewarmReel()` 只预热前两章；播放中保持当前场景只等待下一场的模型。
- `vite.config.ts` 只固定 React/GSAP vendor；不要强制 Three.js 手动分包，否则可能把它提升回首屏依赖。
- `npm run check:performance` 必须保证入口小于 80 KB 且首屏 HTML 不加载 Three.js/postprocessing。
- Canvas texture 只在内容变化时更新，不要每帧重画静态画面。
- bloom、shader、阴影、粒子数量要有明确画面收益。
- DOM 粒子用完必须移除。
- 大资源必须进入场景 chunk 或 `preload()`，不要进入主入口包。

## 音频

当前 reel 不启动背景音乐，也不显示声音控制。`SoundDesign.ts` 仍保留为场景声音能力，但启用声音前必须重新设计可靠的用户手势入口；场景内的 loop 必须返回 stop handle，并在 `destroy()` 中停止。

## 用户控制

开场：

- 页面加载后立即显示“生活就是自导自演的一场戏”，没有“开始”按钮。
- 序幕出现时同时调用 `prewarmReel(reel)`，随后自动进入第一幕。
- 序幕至少 1.2 秒；预热最多参与约 1.8 秒，不让开场无限卡住。

播放中：

- 章节轨显示当前章节、标题和每章进度，点击任意章节调用 `goToScene(index)`。
- 控制条使用图标提供播放、重播、跳过和重新开始，依靠 `aria-label` 与 `title` 保持可访问性。
- 播放无操作 3 秒后隐藏控制层；场景加载失败必须显示可重试的错误层。
- Reel 播完后停留在“未完待续”的最终画面，不自动回到第一章。

快捷键：

- `Space`：播放 / 暂停
- `R`：重播当前场景
- `S` 或 `ArrowRight`：跳过当前场景
- `Home`：从第一章重启
- `1` 到 `7`：跳到对应章节

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
npm run check:performance
```

运行体验检查：

```bash
npm run dev
```

重点手动检查：

- 页面载入后没有控制台错误，序幕结束后能及时进入第一幕。
- 每个 title card 可见且没有被场景清空。
- 每个场景结束后能自然进入下一场。
- 控制条和章节轨可点击，快捷键可用。
- reduced motion 下动画明显降级但叙事仍完整。
- 3D 场景切换后旧 canvas 被移除。
- 生产构建没有主入口 chunk 过大的警告。

## 当前 Reel

| 顺序 | ID         | 标题           | 叙事角色                               |
| ---- | ---------- | -------------- | -------------------------------------- |
| 1    | `scene-02` | 关于我         | 身份、原则与兴趣构成动态人物肖像       |
| 2    | `scene-01` | 从问题出发     | 问题、证据和最小改动组成判断路径       |
| 3    | `scene-08` | 让系统彼此听懂 | 需求经过契约、追踪和恢复完整返回       |
| 4    | `scene-11` | 工具退到身后   | 思考、构建、运行与交付组成工作流       |
| 5    | `scene-09` | 屏幕之外       | 阅读、跑步和观察组成生活留白           |
| 6    | `scene-05` | 继续提问       | 为什么、如果与下一步把好奇带向行动     |
| 7    | `scene-06` | 未完待续       | 七幕汇聚成片尾，镜头停在下一幕之前     |

## 编码风格

- TypeScript strict。
- 公共 API 显式标注类型。
- 优先组合，不引入继承层级。
- 不引入全局 mutable state；确有需要时放在 Director 或共享 lib，并清楚管理生命周期。
- 注释只解释不明显的意图、约束或资源生命周期。
- 改动要小而准，不做无关重构。
