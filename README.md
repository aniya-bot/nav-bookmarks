# nav-bookmarks

用于管理个人收藏网页的导航站项目。

## 已完成功能
- 收藏 CRUD：新增、编辑、删除、搜索、分类/标签筛选
- 本地持久化：`localStorage`
- 导入：`CSV`、浏览器书签 `HTML`
- 导出：`JSON`、`CSV`
- URL 安全校验：仅允许 `http/https`

## 运行方式
```bash
npm install
npm run dev
```

## 构建
```bash
npm run build
```

## 导入说明
- CSV 至少包含 `title,url` 两列，可选：`category,tags,description`
- `tags` 支持 `|` 或 `,` 分隔
- HTML 支持浏览器导出的书签文件（解析 `<a href="...">`）
- 导入时会跳过重复 URL 与非法协议链接

## 协作口令
- `推进到下一里程碑`
- `项目收尾`
