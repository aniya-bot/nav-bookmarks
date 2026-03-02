# TASKS.md — nav-bookmarks

## Backlog
- [x] 初始化项目（Next.js + TypeScript）
- [x] 设计收藏数据结构（URL/标题/分类/标签/备注/时间）
- [x] 实现新增收藏表单
- [x] 实现收藏列表与卡片视图
- [x] 实现编辑/删除收藏
- [x] 实现关键词搜索
- [x] 实现分类与标签筛选
- [x] 实现重复 URL 检测提示
- [x] 增加基础样式（可爱但简洁）
- [x] 本地构建验证（`npm run build`）
- [x] 部署到 Vercel
- [x] 实现导入（CSV / 书签 HTML）
- [x] 实现导出（JSON / CSV）

## 当前里程碑（M3）
- [x] M1：页面结构草图 + 路由与基础布局 + 假数据联调
- [x] M2：CRUD + localStorage 持久化 + URL 协议校验
- [x] M3：导入/导出功能上线（CSV、HTML、JSON）

## 风险与注意
- [x] 防止误删：删除前二次确认
- [x] 防止跨项目污染：所有文件仅在 `projects/nav-bookmarks`
- [x] 发布前确认：分支、改动清单、URL
- [ ] 超大导入文件性能优化（后续可加分批解析）
- [ ] 导出隐私提示优化（后续可加导出确认）
