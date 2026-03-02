# nav-bookmarks

个人导航收藏站（Next.js），支持收藏管理、导入导出与增强交互视觉。

## 线上地址

- Production: `https://nav-bookmarks.vercel.app`

## 核心功能

- 收藏 CRUD：新增、编辑、删除
- 搜索、分类筛选、标签筛选
- 本地持久化：`localStorage`
- 导入：`CSV`、浏览器书签 `HTML`
- 导出：`JSON`、`CSV`
- URL 校验：仅允许 `http/https`
- 交互增强：卡片/按钮/chip 的 hover/active/focus 反馈
- 视觉主题：教育平台风背景层（含动效与 `prefers-reduced-motion` 兼容）

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 导入格式

- CSV 必含：`title,url`
- 可选字段：`category,tags,description`
- `tags` 支持 `|` 或 `,` 分隔
- HTML 支持浏览器导出的书签文件（解析 `<a href="...">`）
- 导入时会跳过重复 URL 与非法协议链接

## 里程碑概览

- M2：CRUD + 持久化
- M3：导入导出
- M3.1：稳态增强（Undo/提示/交互体验）
