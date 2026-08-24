# 教师个人工作平台

面向教师日常教学与班级管理的一站式信息流工具。**纯前端应用**，数据本地优先（IndexedDB），保护隐私；支持 **PWA 安装**、离线使用、多端备份（WebDAV/坚果云）。

> 中文界面 · 简洁低干扰 · 响应式（Windows 浏览器 + 手机浏览器均可良好运行）

---

## ✨ 功能总览

平台分为九大区域，覆盖教师日常工作全流程：

### 一、主工作台
- **工作台总览**：自动汇总今日课程、待办、学生生日、预约沟通、重要倒计时
- **我的课表**：按周显示，支持单双周、调课备注、切换周次
- **学期校历**：月历视图，标记节假日 / 考试 / 学校活动
- **待办事项**：增删改、完成标记、按日期与优先级分组排序

### 二、教学工作台
- 学生名单（含选科）、备课资源、备课模板、教学记录
- **学生成绩**：自定义考试类型，手动录入 + Excel/CSV 批量导入，历次成绩留存
- **成绩分析**：班级分析（平均/最高最低/优秀率/及格率/分数段/历次对比）、个人分析（趋势/强弱科雷达图）、学科对比、排名与赋分、分数段、偏科预警、临界生、贡献率

### 三、班主任工作台
- 花名册、座位安排（拖拽 + 轮换 + 历史版本）、值日安排（按组轮换 + 打印）、班干部
- 家校沟通、班级总结、奖惩、请假、学生关注、班会、班费（自动算余额）、班级日志、考勤、宿舍走读、早晚自习、安全健康、家长会、家访、家庭情况、通知模板

### 四、学科协同（高中班主任）
- 学科教师通讯录、教学进度共享、作业与考试协调（自动预警作业过多）、学科成绩对比（雷达图）、偏科预警、学科协调会、临界生学科跟踪（一生一策）

### 五、成绩进阶
- 选科走班管理（3+1+2 / 3+3）、赋分与排名、目标管理（目标大学/专业）、学科贡献率、分数段统计

### 六、学生发展指导
- 生涯规划与选科指导、心理状态记录、谈心谈话、目标大学与专业、综合素质评价档案

### 七、行政事务
- 学籍信息、高考报名与体检、贫困资助与保险、重要事项倒计时（高考/一模二模自动提醒）

### 八、常用工具
- AI 工具、办公软件、文档模板（一键复制）、文件工具入口

### 九、数据与设置
- 数据导入导出（JSON / Excel / CSV）、云同步（WebDAV）、密码保护、打印友好

> 模块间数据联动：成绩分析中的临界生可一键加入「临界生跟踪」；学生成绩变化可在谈心谈话中对照；选科组合贯穿成绩排名与分班管理。

---

## 🛠 技术栈

| 类别 | 方案 |
| --- | --- |
| 前端框架 | React 18 + TypeScript 5 |
| 构建工具 | Vite 5 |
| 样式 | Tailwind CSS 3 |
| 数据存储 | IndexedDB（Dexie 4，本地优先） |
| 图表 | Recharts（趋势图 / 柱状图 / 雷达图） |
| 导入导出 | SheetJS（xlsx）+ 自研 CSV |
| PWA | vite-plugin-pwa（可安装、离线可用） |
| 桌面应用 | Tauri 2（可打包为 Windows .exe） |
| 云同步 | WebDAV 协议（坚果云等） |

---

## 🚀 本地运行

**环境要求**：Node.js ≥ 18（推荐 20+）

```bash
cd teacher-platform

# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
```

浏览器打开终端提示的地址（默认 `http://localhost:5173`）。

首次启动会自动注入一份「高一（1）班」示例数据（12 名学生、3 场考试、完整课表等），方便快速体验。可在「数据与设置 → 数据管理」中一键清空或重新载入。

> ⚠️ 若遇到 `npm install` 因缓存权限报 `EACCES`，可改用独立缓存目录：
> `npm install --cache /tmp/npm-cache`

---

## 📦 构建与部署

### 构建

```bash
npm run build
```

产物输出到 `dist/`，为纯静态文件（含 `sw.js`、`manifest.webmanifest`），可部署到任意静态托管。

### 部署到 GitHub Pages

```bash
npm run build

# 方式一：使用 gh-pages 分支
npx gh-pages -d dist

# 方式二：手动将 dist/ 推送到 gh-pages 分支
```

项目已配置 `base: './'` 相对路径 + HashRouter，无需额外配置即可部署到任意子目录。

### 部署到 Vercel / Netlify

- **Vercel**：导入仓库，`Build Command` 填 `npm run build`，`Output Directory` 填 `dist`。
- **Netlify**：同上，`Publish directory` 填 `dist`。

> 纯前端无需服务端；WebDAV 云同步由浏览器直接请求你的云盘，不经过部署服务器。

### 打包为 Windows 桌面程序（.exe）

用 Tauri 2 打包，桌面双击即开、独立窗口、数据本地，体验最接近原生软件。

**一次性准备（在 Windows 上）**：

1. 安装 [Rust](https://www.rust-lang.org/tools/install)（一路默认即可）。
2. 安装 [Microsoft Visual C++ 构建工具](https://visualstudio.microsoft.com/zh-hans/visual-cpp-build-tools/)（勾选「使用 C++ 的桌面开发」）。
3. Windows 10 老版本若缺 WebView2，安装 [WebView2 运行时](https://developer.microsoft.com/microsoft-edge/webview2/)（Win10/11 一般已自带）。

**打包**：

```bash
npm install          # 首次
npm run tauri:build
```

生成文件在 `src-tauri/target/release/`，其中 `教师个人工作平台.exe`（或 `teacher-platform.exe`）双击即用；`bundle/` 下还有安装包（.msi / .exe setup）。

**开发调试**：`npm run tauri:dev`（会同时启动前端 + 桌面窗口）。

> ⚠️ 数据迁移：桌面版的数据存在系统 WebView 的 IndexedDB，与浏览器版**相互独立**。首次使用桌面版时，先在浏览器版「数据管理 → 导出全部」，再到桌面版「数据管理 → 从备份恢复」，即可把数据搬过去；之后用「云同步」保持两台设备一致。

---

## 📱 PWA 安装

1. 用手机浏览器（Chrome / Safari / Edge）打开部署地址。
2. Chrome/Edge：菜单 →「添加到主屏幕」/「安装应用」。
3. iOS Safari：分享按钮 →「添加到主屏幕」。

安装后即可**离线使用**，所有数据仍保存在本机。

---

## 💾 数据与隐私

- 所有数据保存在浏览器 **IndexedDB**，默认**不上传任何服务器**。
- 通过「数据管理」导出 JSON 备份；通过「云同步」配置坚果云 WebDAV 实现多设备备份。
- 可设置**访问密码**保护本地数据。

### 成绩导入格式

CSV/Excel 首行为表头，需包含「学号」或「姓名」列，其余列自动识别：

| 列名示例 | 导入为 |
| --- | --- |
| `语文` `数学` `英语` `历史` `政治` `地理`… | 各科原始分 |
| `语文赋分` `历史(赋分)` `地理_赋分`… | 各科赋分 |
| `总分` | 赋分后总分 |
| `班级排名` `班排名` | 班级排名 |
| `年级排名` `年排名` | 年级排名 |
| `组合排名` | 组合内排名 |

导入后可在「成绩分析 → 排名与赋分」查看与修改。

**每科满分**：默认按高考标准（语数英 150，其余 100），可在「学生成绩 → 科目满分」里自定义。及格率 / 优秀率 / 雷达图均按各科真实满分计算。

### 学生名单导入格式

支持中英文表头（如「姓名」/`name`、「学号」/`studentNo`、「家长电话」/`parentPhone` 等），至少需要「姓名」列。

---

## 📁 目录结构

```
teacher-platform/
├── index.html
├── vite.config.ts          # Vite + PWA 配置
├── tailwind.config.js
├── scripts/gen-icons.mjs   # 生成 PWA 图标
├── public/icons/           # 应用图标
└── src/
    ├── main.tsx            # 入口（注册 PWA）
    ├── App.tsx             # 路由 + 密码保护
    ├── db/
    │   ├── index.ts        # IndexedDB Schema（Dexie）
    │   └── seed.ts         # 示例数据
    ├── lib/
    │   ├── types.ts        # 类型与常量
    │   ├── utils.ts        # 工具函数
    │   ├── csv.ts / excel.ts
    │   ├── stats.ts        # 成绩分析算法
    │   ├── data-io.ts      # 全库导入导出
    │   ├── webdav.ts       # WebDAV 同步
    │   └── nav.tsx         # 导航配置
    ├── components/
    │   ├── ui.tsx          # 基础 UI 组件
    │   ├── EntityManager.tsx  # 字段驱动的通用 CRUD
    │   ├── charts.tsx      # 图表封装
    │   └── Layout.tsx      # 响应式布局
    └── pages/              # 各功能页面
```

---

## 🧩 二次开发提示

- **新增一个「列表式」模块**：只需在 `src/pages/generic.tsx` 的 `GENERIC` 里加一条配置（表名 + 字段），再在 `src/App.tsx` 注册路由、`src/lib/nav.tsx` 加导航项即可。
- **新增数据表**：在 `src/db/index.ts` 的 `SCHEMA` 中声明表名与索引；如需纳入备份，同步加到 `src/lib/data-io.ts` 的 `DATA_TABLES`。
- **成绩分析算法**：集中在 `src/lib/stats.ts`，纯函数，便于扩展。

---

## 📝 许可

本项目仅用于个人教学管理用途，代码可自由修改与自用。
