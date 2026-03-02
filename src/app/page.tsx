"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type Bookmark = {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

type FormState = {
  title: string;
  description: string;
  url: string;
  category: string;
  tagsInput: string;
};

type ImportSummary = {
  status: "idle" | "processing" | "done" | "error";
  total: number;
  processed: number;
  success: number;
  duplicated: number;
  invalid: number;
  failed: number;
  message?: string;
};

const STORAGE_KEY = "nav-bookmarks:v1";

const seedBookmarks: Omit<Bookmark, "id">[] = [
  {
    title: "Next.js App Router",
    description: "官方 App Router 文档与最佳实践合集。",
    url: "https://nextjs.org/docs/app",
    category: "Docs",
    tags: ["Next.js"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    title: "Vercel Templates",
    description: "常用产品化模板参考，适合快速起步。",
    url: "https://vercel.com/templates",
    category: "Inspiration",
    tags: ["Templates"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    title: "React Patterns",
    description: "组件设计与渲染模式整理。",
    url: "https://reactpatterns.com/",
    category: "Development",
    tags: ["React"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    title: "Figma Community",
    description: "高质量 UI 组件与设计系统示例。",
    url: "https://www.figma.com/community",
    category: "Design",
    tags: ["UI"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    title: "OpenAI Cookbook",
    description: "AI 应用场景与接口示例合集。",
    url: "https://cookbook.openai.com/",
    category: "AI",
    tags: ["API"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    title: "Product Hunt",
    description: "每日新品灵感来源，捕捉趋势。",
    url: "https://www.producthunt.com/",
    category: "Inspiration",
    tags: ["Trend"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const emptyForm: FormState = {
  title: "",
  description: "",
  url: "",
  category: "",
  tagsInput: "",
};

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseTags(input: string) {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function isSafeHttpUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeStoredBookmark(raw: unknown): Bookmark | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;

  if (typeof record.id !== "string") return null;
  if (typeof record.title !== "string") return null;
  if (typeof record.description !== "string") return null;
  if (typeof record.url !== "string") return null;
  if (typeof record.category !== "string") return null;
  if (!isSafeHttpUrl(record.url)) return null;

  const tags = Array.isArray(record.tags)
    ? record.tags.filter((t): t is string => typeof t === "string")
    : typeof record.tag === "string"
      ? [record.tag]
      : [];

  const createdAt = typeof record.createdAt === "number" ? record.createdAt : Date.now();
  const updatedAt = typeof record.updatedAt === "number" ? record.updatedAt : createdAt;

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    url: record.url,
    category: record.category,
    tags,
    createdAt,
    updatedAt,
  };
}

function mapToCSVValue(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function toCSV(bookmarks: Bookmark[]) {
  const header = ["title", "url", "category", "tags", "description"];
  const rows = bookmarks.map((bookmark) => [
    mapToCSVValue(bookmark.title),
    mapToCSVValue(bookmark.url),
    mapToCSVValue(bookmark.category),
    mapToCSVValue(bookmark.tags.join("|")),
    mapToCSVValue(bookmark.description),
  ]);
  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

function splitCsvLine(line: string) {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current.trim());
  return fields;
}

function parseCsvBookmarks(text: string): { items: Omit<Bookmark, "id">[]; invalidCount: number } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return { items: [], invalidCount: 0 };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idxTitle = header.indexOf("title");
  const idxUrl = header.indexOf("url");
  const idxCategory = header.indexOf("category");
  const idxTags = header.indexOf("tags");
  const idxDescription = header.indexOf("description");

  if (idxTitle < 0 || idxUrl < 0) {
    throw new Error("CSV 必须包含 title 和 url 列");
  }

  const now = Date.now();
  const items: Omit<Bookmark, "id">[] = [];
  let invalidCount = 0;

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const title = (cols[idxTitle] || "").trim();
    const url = (cols[idxUrl] || "").trim();
    const category = (idxCategory >= 0 ? cols[idxCategory] : "")?.trim() || "Imported";
    const description = (idxDescription >= 0 ? cols[idxDescription] : "")?.trim() || "";
    const rawTags = (idxTags >= 0 ? cols[idxTags] : "") || "";

    if (!title || !url || !isSafeHttpUrl(url)) {
      invalidCount += 1;
      continue;
    }

    const tags = rawTags
      .split(/[|,]/)
      .map((t) => t.trim())
      .filter(Boolean);

    items.push({
      title,
      url,
      category,
      description,
      tags,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { items, invalidCount };
}

function parseHtmlBookmarks(text: string): { items: Omit<Bookmark, "id">[]; invalidCount: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");
  const anchors = Array.from(doc.querySelectorAll("a[href]"));
  const now = Date.now();

  const items: Omit<Bookmark, "id">[] = [];
  let invalidCount = 0;

  anchors.forEach((anchor) => {
    const url = (anchor.getAttribute("href") || "").trim();
    const title = (anchor.textContent || "").trim() || url;

    if (!isSafeHttpUrl(url)) {
      invalidCount += 1;
      return;
    }

    items.push({
      title,
      url,
      category: "Imported",
      description: "来自浏览器书签导入",
      tags: ["Imported"],
      createdAt: now,
      updatedAt: now,
    });
  });

  return { items, invalidCount };
}

export default function Home() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedTag, setSelectedTag] = useState<string>("All");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>("");
  const [undoState, setUndoState] = useState<{ bookmark: Bookmark; expiresAt: number } | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary>({
    status: "idle",
    total: 0,
    processed: 0,
    success: 0,
    duplicated: 0,
    invalid: 0,
    failed: 0,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seeded: Bookmark[] = seedBookmarks.map((bookmark) => ({
          ...bookmark,
          id: makeId(),
        }));
        setBookmarks(seeded);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("invalid storage");

      const normalized = parsed
        .map(normalizeStoredBookmark)
        .filter((bookmark): bookmark is Bookmark => Boolean(bookmark));

      setBookmarks(normalized);
    } catch {
      const seeded: Bookmark[] = seedBookmarks.map((bookmark) => ({
        ...bookmark,
        id: makeId(),
      }));
      setBookmarks(seeded);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    } catch {
      setNotice("本地存储写入失败，请检查浏览器隐私模式或存储权限。");
    }
  }, [bookmarks]);

  const categories = useMemo(() => {
    const base = ["Design", "Development", "AI", "Tools", "Docs", "Inspiration", "Imported"];
    const fromData = Array.from(new Set(bookmarks.map((bookmark) => bookmark.category).filter(Boolean)));
    const all = Array.from(new Set([...base, ...fromData]));
    return ["All", ...all];
  }, [bookmarks]);

  const tags = useMemo(() => {
    const all = bookmarks.flatMap((bookmark) => bookmark.tags || []);
    const uniq = Array.from(new Set(all.map((tag) => tag.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
    return ["All", ...uniq];
  }, [bookmarks]);

  const filtered = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return bookmarks
      .filter((bookmark) => {
        if (selectedCategory !== "All" && bookmark.category !== selectedCategory) return false;
        if (selectedTag !== "All" && !bookmark.tags.includes(selectedTag)) return false;
        if (!query) return true;

        const haystack = `${bookmark.title} ${bookmark.description} ${bookmark.tags.join(" ")} ${bookmark.category}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [bookmarks, searchText, selectedCategory, selectedTag]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEdit(bookmark: Bookmark) {
    setEditingId(bookmark.id);
    setForm({
      title: bookmark.title,
      description: bookmark.description,
      url: bookmark.url,
      category: bookmark.category,
      tagsInput: bookmark.tags.join(", "),
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingId(null);
    setFormError(null);
  }

  function submitForm(event: React.FormEvent) {
    event.preventDefault();

    const title = form.title.trim();
    const description = form.description.trim();
    const url = form.url.trim();
    const category = form.category.trim();
    const tagsArray = parseTags(form.tagsInput);

    if (!title) return setFormError("请输入标题");
    if (!url) return setFormError("请输入 URL");
    if (!isSafeHttpUrl(url)) {
      return setFormError("URL 仅允许 http/https（将拒绝 javascript:/data:/file: 等协议）");
    }
    if (!category) return setFormError("请输入分类");

    const now = Date.now();

    if (editingId) {
      setBookmarks((prev) =>
        prev.map((bookmark) =>
          bookmark.id === editingId
            ? {
                ...bookmark,
                title,
                description,
                url,
                category,
                tags: tagsArray,
                updatedAt: now,
              }
            : bookmark
        )
      );
      setNotice("收藏已更新");
    } else {
      const created: Bookmark = {
        id: makeId(),
        title,
        description,
        url,
        category,
        tags: tagsArray,
        createdAt: now,
        updatedAt: now,
      };
      setBookmarks((prev) => [created, ...prev]);
      setNotice("收藏已新增");
    }

    closeForm();
    setForm(emptyForm);
  }

  function onDelete(bookmark: Bookmark) {
    const ok = confirm(`确认删除「${bookmark.title}」吗？10 秒内可撤销。`);
    if (!ok) return;

    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    setBookmarks((prev) => prev.filter((item) => item.id !== bookmark.id));
    setNotice("收藏已删除，可在 10 秒内撤销");
    const expiresAt = Date.now() + 10_000;
    setUndoState({ bookmark, expiresAt });
    undoTimeoutRef.current = window.setTimeout(() => {
      setUndoState(null);
      undoTimeoutRef.current = null;
    }, 10_000);
  }

  function handleUndoDelete() {
    if (!undoState) return;
    if (undoTimeoutRef.current) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    setBookmarks((prev) => [undoState.bookmark, ...prev]);
    setUndoState(null);
    setNotice("删除已撤销");
  }

  function downloadTextFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleExportJson() {
    const ok = confirm("导出文件将包含全部书签与描述信息，确认继续吗？");
    if (!ok) return;
    const payload = JSON.stringify(bookmarks, null, 2);
    downloadTextFile(payload, `nav-bookmarks-${Date.now()}.json`, "application/json");
    setNotice(`已导出 JSON（${bookmarks.length} 条）`);
  }

  function handleExportCsv() {
    const ok = confirm("导出文件将包含全部书签与描述信息，确认继续吗？");
    if (!ok) return;
    const csv = toCSV(bookmarks);
    downloadTextFile(csv, `nav-bookmarks-${Date.now()}.csv`, "text/csv;charset=utf-8");
    setNotice(`已导出 CSV（${bookmarks.length} 条）`);
  }

  async function mergeImportedInChunks(rawItems: Omit<Bookmark, "id">[], invalidCount: number) {
    const existingUrls = new Set(bookmarks.map((bookmark) => bookmark.url));
    const imported: Bookmark[] = [];
    let success = 0;
    let duplicated = 0;
    let invalid = invalidCount;
    let failed = 0;

    setImportSummary({
      status: "processing",
      total: rawItems.length,
      processed: 0,
      success: 0,
      duplicated: 0,
      invalid: invalidCount,
      failed: 0,
    });

    const chunkSize = 120;
    for (let i = 0; i < rawItems.length; i += chunkSize) {
      const chunk = rawItems.slice(i, i + chunkSize);
      chunk.forEach((item) => {
        try {
          if (!isSafeHttpUrl(item.url)) {
            invalid += 1;
            return;
          }
          if (existingUrls.has(item.url)) {
            duplicated += 1;
            return;
          }

          existingUrls.add(item.url);
          imported.push({ ...item, id: makeId() });
          success += 1;
        } catch {
          failed += 1;
        }
      });

      setImportSummary((prev) => ({
        ...prev,
        processed: Math.min(i + chunk.length, rawItems.length),
        success,
        duplicated,
        invalid,
        failed,
      }));

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (imported.length) {
      setBookmarks((prev) => [...imported, ...prev]);
    }

    setImportSummary({
      status: "done",
      total: rawItems.length,
      processed: rawItems.length,
      success,
      duplicated,
      invalid,
      failed,
    });

    if (!success) {
      setNotice("导入完成，但没有新增条目");
    } else {
      setNotice(`导入完成，新增 ${success} 条`);
    }
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportSummary((prev) => ({
        ...prev,
        status: "processing",
        total: 0,
        processed: 0,
        success: 0,
        duplicated: 0,
        invalid: 0,
        failed: 0,
      }));
      const text = await file.text();
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith(".csv")) {
        const { items, invalidCount } = parseCsvBookmarks(text);
        await mergeImportedInChunks(items, invalidCount);
      } else if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
        const { items, invalidCount } = parseHtmlBookmarks(text);
        await mergeImportedInChunks(items, invalidCount);
      } else {
        setNotice("仅支持导入 CSV 或浏览器书签 HTML 文件");
      }
    } catch {
      setImportSummary({
        status: "error",
        total: 0,
        processed: 0,
        success: 0,
        duplicated: 0,
        invalid: 0,
        failed: 1,
        message: "导入失败，请检查文件格式",
      });
      setNotice("导入失败，请检查文件格式");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div>
              <p className={styles.kicker}>Nav Bookmarks</p>
              <h1 className={styles.title}>灵感与资源的统一入口</h1>
            </div>

            <div className={styles.headerActions}>
              <button className={styles.secondaryButton} type="button" onClick={() => fileInputRef.current?.click()}>
                导入（CSV/HTML）
              </button>
              <button className={styles.secondaryButton} type="button" onClick={handleExportCsv}>
                导出 CSV
              </button>
              <button className={styles.secondaryButton} type="button" onClick={handleExportJson}>
                导出 JSON
              </button>
              <button className={styles.addButton} type="button" onClick={openCreate}>
                新增收藏
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.html,.htm,text/csv,text/html"
              className={styles.hiddenInput}
              onChange={handleImportFile}
            />
          </div>

          <p className={styles.subtitle}>用搜索和分类快速定位常用网站，保持链接库的秩序感。</p>
          {notice ? <div className={styles.notice}>{notice}</div> : null}
          {undoState ? (
            <div className={styles.undoBar}>
              <span>已删除「{undoState.bookmark.title}」，10 秒内可撤销。</span>
              <button className={styles.undoButton} type="button" onClick={handleUndoDelete}>
                撤销
              </button>
            </div>
          ) : null}
          {importSummary.status !== "idle" ? (
            <div className={styles.importStatus}>
              <div className={styles.importTitle}>
                {importSummary.status === "processing" ? "导入处理中" : importSummary.status === "done" ? "导入完成" : "导入失败"}
              </div>
              {importSummary.status === "processing" ? (
                <div className={styles.importDetail}>
                  已处理 {importSummary.processed}/{importSummary.total} 条
                </div>
              ) : importSummary.status === "done" ? (
                <div className={styles.importDetail}>
                  成功 {importSummary.success} | 重复跳过 {importSummary.duplicated} | 非法跳过 {importSummary.invalid} | 失败 {importSummary.failed}
                </div>
              ) : (
                <div className={styles.importDetail}>{importSummary.message || "导入失败"}</div>
              )}
            </div>
          ) : null}
        </header>

        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            placeholder="搜索标题、标签、分类或描述"
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <button className={styles.searchButton} type="button">
            搜索
          </button>
        </div>

        <section className={styles.categories}>
          {categories.map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                className={`${styles.categoryChip} ${active ? styles.chipActive : ""}`}
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            );
          })}
        </section>

        {tags.length > 1 ? (
          <section className={styles.tags}>
            <div className={styles.tagsLabel}>标签筛选：</div>
            <div className={styles.tagsRow}>
              {tags.map((tag) => {
                const active = selectedTag === tag;
                return (
                  <button
                    className={`${styles.tagChip} ${active ? styles.chipActive : ""}`}
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className={styles.cardGrid}>
          {filtered.map((bookmark) => (
            <article className={styles.card} key={bookmark.id}>
              <div className={styles.cardTop}>
                <div className={styles.cardMetaLeft}>
                  {bookmark.tags.slice(0, 2).map((tag) => (
                    <span className={styles.cardTag} key={tag}>
                      {tag}
                    </span>
                  ))}
                  {bookmark.tags.length > 2 ? <span className={styles.cardTagMore}>+{bookmark.tags.length - 2}</span> : null}
                </div>
                <span className={styles.cardCategory}>{bookmark.category}</span>
              </div>

              <h3 className={styles.cardTitle}>{bookmark.title}</h3>
              <p className={styles.cardDescription}>{bookmark.description}</p>

              <div className={styles.cardActions}>
                <a className={styles.cardLink} href={bookmark.url} target="_blank" rel="noreferrer">
                  访问网站 →
                </a>
                <div className={styles.cardButtons}>
                  <button className={styles.secondaryButton} type="button" onClick={() => openEdit(bookmark)}>
                    编辑
                  </button>
                  <button className={styles.dangerButton} type="button" onClick={() => onDelete(bookmark)}>
                    删除
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>

        {isFormOpen ? (
          <div
            className={styles.modalOverlay}
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? "编辑收藏" : "新增收藏"}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeForm();
            }}
          >
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>{editingId ? "编辑收藏" : "新增收藏"}</h2>
                <button className={styles.iconButton} type="button" onClick={closeForm}>
                  ×
                </button>
              </div>

              <form className={styles.form} onSubmit={submitForm}>
                <label className={styles.field}>
                  <div className={styles.fieldLabel}>标题</div>
                  <input
                    className={styles.fieldInput}
                    value={form.title}
                    onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))}
                    placeholder="例如：MDN Web Docs"
                    required
                  />
                </label>

                <label className={styles.field}>
                  <div className={styles.fieldLabel}>描述</div>
                  <textarea
                    className={styles.fieldTextarea}
                    value={form.description}
                    onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))}
                    placeholder="一句话描述用途（可选）"
                    rows={3}
                  />
                </label>

                <label className={styles.field}>
                  <div className={styles.fieldLabel}>URL</div>
                  <input
                    className={styles.fieldInput}
                    value={form.url}
                    onChange={(event) => setForm((state) => ({ ...state, url: event.target.value }))}
                    placeholder="https://example.com"
                    required
                  />
                  <div className={styles.fieldHint}>仅允许 http/https 协议。</div>
                </label>

                <label className={styles.field}>
                  <div className={styles.fieldLabel}>分类</div>
                  <input
                    className={styles.fieldInput}
                    value={form.category}
                    onChange={(event) => setForm((state) => ({ ...state, category: event.target.value }))}
                    placeholder="例如：Tools"
                    list="category-list"
                    required
                  />
                  <datalist id="category-list">
                    {categories
                      .filter((category) => category !== "All")
                      .map((category) => (
                        <option value={category} key={category} />
                      ))}
                  </datalist>
                </label>

                <label className={styles.field}>
                  <div className={styles.fieldLabel}>标签</div>
                  <input
                    className={styles.fieldInput}
                    value={form.tagsInput}
                    onChange={(event) => setForm((state) => ({ ...state, tagsInput: event.target.value }))}
                    placeholder="逗号分隔：AI, Prompt, Tools"
                  />
                  <div className={styles.fieldHint}>支持逗号分隔输入多个标签。</div>
                </label>

                {formError ? <div className={styles.formError}>{formError}</div> : null}

                <div className={styles.formActions}>
                  <button className={styles.secondaryButton} type="button" onClick={closeForm}>
                    取消
                  </button>
                  <button className={styles.primaryButton} type="submit">
                    {editingId ? "保存" : "新增"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
