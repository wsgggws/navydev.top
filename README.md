# Director - 电影化交互作品集

不是网站，是一部电影。

`Director` 把作品集组织成一卷连续播放的 reel。每个故事都是独立的 `Scene`：有环境、演员、道具、声音、镜头运动和结束转场。访客进入后看到 ROLL 开场，随后连续观看；也可以通过章节轨、控制条或快捷键在 reel 内跳转。

架构和开发约束见 [CLAUDE.md](./CLAUDE.md)。

## 特性

- 2.35:1 cinematic letterbox 舞台，竖屏自动切换为 9:16 构图
- `MovieDirector` 统一控制播放、转场、挂载、销毁、跳章和自动重启
- 场景插件化：每个 `scene-*` 都是独立模块
- Lazy scene loader：首屏只加载轻量配置，场景实现按需加载
- ROLL 后预热 Three.js pipeline、场景 chunk 和场景 `preload()`
- 当前场景播放时继续预热下一场，减少转场等待
- GSAP timeline 作为每个场景的叙事时间源
- Three.js 场景按需加载，包含 bloom/postprocessing 和统一 dispose
- Web Audio 音效设计，遵守浏览器用户手势限制
- 章节进度轨、播放控制条、键盘快捷键和 `prefers-reduced-motion` 支持

## 技术栈

- React 18
- TypeScript
- Vite
- GSAP
- Three.js

React 只负责应用壳和舞台挂载。场景内部可以使用 DOM、Canvas、Three.js 或它们的组合。叙事动画统一交给 GSAP timeline。

## 运行

需要 Node 18+。CI 当前使用 Node 20。

```bash
npm install
npm run dev
```

开发服务器默认地址：

```text
http://localhost:5173
```

其他命令：

```bash
npm run typecheck
npm run build
npm run preview
```

## 体验控制

开场行为：

- 页面加载后会自动触发一次 ROLL，也可以手动点击 `ROLL`。
- ROLL 会先调用 `primeAudio()` 再进入 3 秒倒计时；自动触发时浏览器可能仍保持静音，手动点击或解除静音才是可靠的音频手势。
- 倒计时期间会调用 `prewarmReel(reel)`，预热 Three.js pipeline、所有场景实现和各场景的 `preload()`。
- 预热最多等待约 5.2 秒；即使重资源慢，也不会无限阻塞开场。

播放中控制：

- 左下角章节轨显示当前章节、标题和每章进度，点击任意章节可跳转。
- 右下角控制条提供 `PLAY/PAUSE`、`SOUND/MUTE`、`REPLAY`、`SKIP`、`RESTART`。
- Reel 播完后会停留约 3.2 秒，然后自动从第一章重启。
- 系统开启 `prefers-reduced-motion: reduce` 时，转场和部分动效会降级。

快捷键：

| 按键                | 行为               |
| ------------------- | ------------------ |
| `Space`             | 播放 / 暂停        |
| `M`                 | 静音 / 解除静音    |
| `R`                 | 重播当前场景       |
| `S` 或 `ArrowRight` | 跳过当前场景       |
| `Home`              | 从第一章重启       |
| `1` 到 `9`          | 跳到第 1 到第 9 章 |
| `0`                 | 跳到第 10 章       |
| `-`                 | 跳到第 11 章       |

## 部署

项目包含 GitHub Actions 自动部署配置：

- `.github/workflows/ci.yml`：push / pull request 时运行 `npm ci`、`npm run typecheck`、`npm run build`。
- `.github/workflows/deploy.yml`：合并到 `main` 或推送 `v*.*.*` tag 后构建并通过 SSH/SCP 部署到 `navydev.top`。
- `config/nginx/conf.d/navydev.top.conf`：线上 nginx 站点配置。

GitHub 仓库需要配置这些 Secrets：

```text
SSH_PRIVATE_KEY
REMOTE_IP
SSH_USER
```

服务器需要提前准备：

```bash
sudo mkdir -p /var/www/navydev.top /var/www/navydev.top/nghh
```

并确保证书路径存在：

```text
/etc/letsencrypt/live/navydev.top/fullchain.pem
/etc/letsencrypt/live/navydev.top/privkey.pem
```

部署流程会在 GitHub Actions 里执行 `npm ci`、`npm run typecheck`、`npm run build`，然后：

- 把 `dist/*` 发布到 `/var/www/navydev.top/`。
- 保留 `/var/www/navydev.top/nghh/` 和 `/var/www/navydev.top/.well-known/`，并把 `random.html` 发布为 `/var/www/navydev.top/nghh/random.html`。
- 把 `config/nginx/conf.d/navydev.top.conf` 复制到 `/etc/nginx/conf.d/navydev.top.conf`。
- 执行 `sudo nginx -t` 和 `sudo systemctl reload nginx`。

## 目录结构

```text
.
├── src/
│   ├── App.tsx                  # React 壳：开始按钮、音频解锁、倒计时、控制条、Director 实例
│   ├── main.tsx
│   └── styles.css               # 全局舞台、letterbox、title card、transition matte、控制层
├── movie/
│   ├── movie.ts                 # reel 注册表：config 静态导入 + scene 动态导入
│   ├── prewarm.ts               # ROLL 后预热 pipeline、场景实现和 preload()
│   ├── types/scene.ts           # SceneConfig / SceneModule / SceneEntry
│   ├── director/
│   │   ├── MovieDirector.ts     # 播放、加载缓存、预热下一场、转场、章节控制、自动重启、销毁
│   │   ├── Timeline.ts          # 每场唯一 GSAP timeline
│   │   └── Camera.ts            # CSS camera 抽象
│   ├── lib/
│   │   ├── motion.ts
│   │   ├── transition.ts
│   │   ├── audio/SoundDesign.ts
│   │   └── three/CinematicStage.ts
│   └── scenes/
│       ├── scene-01/
│       ├── scene-02/
│       ├── scene-03/
│       ├── scene-04/
│       ├── scene-05/
│       ├── scene-06/
│       ├── scene-07/
│       ├── scene-08/
│       ├── scene-09/
│       ├── scene-10/
│       └── scene-11/
└── index.html
```

每个场景目录通常包含：

```text
config.ts     # 轻量 metadata
scene.md      # 剧本
index.ts      # SceneModule 实现
styles.css    # 场景样式，使用 data-scene-id 作用域
```

## 当前 Reel

| 顺序 | ID         | 标题                | 表达                                       |
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

## Lazy Scene Loader

`movie/movie.ts` 是 reel 注册表。它只静态导入场景配置，不静态导入场景实现。

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

这样做的目的：

- 首屏主包不包含所有场景实现。
- Three.js、shader、scene CSS、剧本和音频逻辑进入按需 chunk。
- Director 可以先读取 `config.title`、`config.duration`、`config.transition`、`config.pacing`、`config.colorGrade` 等轻量 metadata。
- 当前场景播放时，Director 会预热下一场，减少转场等待。
- ROLL 后的整卷预热是用户手势之后的体验优化，不改变首屏拆包策略。

生产构建中可以看到多个 `index-*.js/css` chunk，以及单独的 `three.module-*`、`CinematicStage-*` chunk。

## 场景契约

`movie/types/scene.ts` 定义了两个层次：

```ts
export interface SceneEntry {
  config: SceneConfig;
  load(): Promise<SceneModule>;
}
```

`SceneEntry` 是注册表条目，轻量、可延迟加载。

```ts
export interface SceneConfig {
  id: string;
  title: string;
  caption?: string;
  mood: SceneMood;
  pacing: ScenePacing;
  shot: SceneShot;
  colorGrade: SceneColorGrade;
  soundMotif: SceneSoundMotif;
  titleCard?: TitleCardStyle;
  duration: number;
  playbackRate?: number;
  transition: TransitionKind;
  preload: string[];
}
```

`SceneConfig` 是场景 metadata。`id` 必须等于文件夹名；`duration` 是 Director 调度时间；`transition` 只声明交接方式，具体转场由 Director 执行。

```ts
export interface SceneModule {
  config: SceneConfig;
  script: string;
  preload(): Promise<void>;
  create(root: HTMLElement): void;
  warmup?(): Promise<void>;
  play(timeline: any): void;
  pause(): void;
  destroy(): void;
}
```

`SceneModule` 是真正的场景插件。

生命周期：

1. `load()`：动态导入场景实现。
2. `preload()`：加载 Three.js、字体、模型、音频或其他重资源。
3. `create(root)`：创建 DOM / Canvas / Three.js 对象。
4. `warmup()`：可选，等待 post-create 首帧或昂贵资源准备。
5. `play(timeline)`：把叙事动画挂到 Director 提供的 GSAP timeline。
6. `destroy()`：释放场景资源。

## 新增场景

假设新增 `scene-12`。

1. 创建目录：

   ```bash
   mkdir movie/scenes/scene-12
   ```

2. 添加 `config.ts`：

   ```ts
   import type { SceneConfig } from "@movie/types/scene";

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

3. 添加 `scene.md`、`styles.css`、`index.ts`。

4. 在 `movie/movie.ts` 注册：

   ```ts
   import { scene as newScene } from "./scenes/scene-12/config";

   const reel: SceneEntry[] = [
     // ...
     {
       config: newScene,
       load: async () => (await import("./scenes/scene-12")).default,
     },
   ];
   ```

5. 验证：

   ```bash
   npm run typecheck
   npm run build
   ```

## 动画规则

场景叙事动画必须挂到 `play(timeline)` 收到的 GSAP timeline 上。不要用 `setTimeout` / `setInterval` 安排剧情节点。

可以接受：

- CSS keyframes 用于局部装饰，比如雨滴、噪点、扫描线。
- 独立 GSAP tween 用于瞬时粒子或火花，但不要改变主 timeline 的总时长。

需要避免：

- 主 timeline 中的 `repeat: -1`。
- 场景销毁后仍在运行的 ticker、audio loop、WebGL render loop。
- 每帧重画静态 canvas texture。

## 转场

Director 使用两层舞台：

- `.stage-scenes`：当前场景
- `.stage-overlays`：黑场、wipe、zoom、glitch、iris、match-cut 等 Director 过场 matte

Title card 由 `App.tsx` 挂到 `.stage`，独立于 `.stage-scenes`，所以不会在场景切换时被清空。Title card 样式读取 `mood`、`pacing`、`colorGrade`、`titleCard`。

场景结束后，Director 先关闭 matte，在黑场完全覆盖期间销毁旧场景并挂载新场景，再打开 matte。场景只声明 `config.transition`，不要在场景内部自行推进到下一场。

支持：

- `fade`
- `cut`
- `wipe`
- `zoom`
- `glitch`
- `iris`
- `match-cut`

## 性能与构建

关键策略：

- `movie/movie.ts` lazy registry 降低首屏主包。
- `prewarmReel()` 只在 ROLL 后运行，避免首屏主动拉重资源。
- `CinematicStage` 动态导入 Three.js 和 postprocessing。
- 当前场景播放时只预热下一场。
- 3D renderer 默认限制 pixel ratio，降低高 DPR 屏幕上的 bloom 成本。
- 场景销毁时释放 renderer、composer、geometry、material、audio、ticker。

推荐检查：

```bash
npm run build
```

如果 Vite 再次提示主 chunk 超过 500 kB，优先检查是否有人在 `movie/movie.ts` 或 `src/App.tsx` 静态导入了场景实现、Three.js 重模块或场景级资源。

## 测试与验收

当前项目没有自动化测试套件。每次修改至少运行：

```bash
npm run typecheck
npm run build
```

手动验收：

- 打开 `npm run dev`。
- 点击或等待 ROLL，确认音频解锁后没有控制台错误。
- 观察倒计时和预热文案是否正常。
- 观察每个场景是否能自然推进到下一场。
- 观察 title card 是否正常显示。
- 操作章节轨、控制条和键盘快捷键。
- 观察 3D 场景切换后旧 canvas 是否被移除。
- 观察转场是否像剪辑，而不是页面重挂闪烁。

## 开发约定

- 默认中文文档和注释；代码标识符保持英文。
- 场景即插件，文件夹名必须等于 `config.id`。
- 一个场景只讲一个故事。
- `destroy()` 必须幂等。
- 共享逻辑放入 `movie/lib/`。
- 不在场景之间互相引用。
- 不为小特效引入大依赖。
