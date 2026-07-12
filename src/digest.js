import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TOPIC_MAP } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DIGEST_DIR = process.env.DIGEST_DIR || path.join(__dirname, '..', 'digests');

const topicLabels = (topics) =>
  (topics || '')
    .split(',')
    .filter(Boolean)
    .map((k) => TOPIC_MAP[k] || k)
    .join('、');

const esc = (s) =>
  String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n).trim() + '…' : s;
}

// ---- Markdown 彙整檔 ----
export function buildMarkdown(papers, dateStr) {
  const lines = [];
  lines.push(`# 毛髮相關新論文彙整 — ${dateStr}`);
  lines.push('');
  lines.push(`本次新增 **${papers.length}** 篇。資料來源：PubMed。`);
  lines.push('');
  papers.forEach((p, i) => {
    lines.push(`## ${i + 1}. ${p.title}`);
    lines.push('');
    const meta = [];
    if (p.journal) meta.push(`*${p.journal}*`);
    if (p.pub_date) meta.push(p.pub_date);
    if (topicLabels(p.topics)) meta.push(`\`${topicLabels(p.topics)}\``);
    if (meta.length) lines.push(meta.join(' · '));
    if (p.authors) lines.push(`> ${p.authors}`);
    lines.push('');
    if (p.abstract) {
      lines.push(truncate(p.abstract, 900));
      lines.push('');
    }
    const links = [`[PubMed](${p.url})`];
    if (p.doi) links.push(`[DOI](https://doi.org/${p.doi})`);
    lines.push(links.join(' · '));
    lines.push('');
    lines.push('---');
    lines.push('');
  });
  return lines.join('\n');
}

export function writeMarkdown(papers, dateStr) {
  fs.mkdirSync(DIGEST_DIR, { recursive: true });
  const file = path.join(DIGEST_DIR, `${dateStr}.md`);
  fs.writeFileSync(file, buildMarkdown(papers, dateStr), 'utf8');
  return file;
}

// ---- Email HTML ----
export function buildEmailHtml(papers, dateStr) {
  const cards = papers
    .map((p, i) => {
      const meta = [p.journal && `<em>${esc(p.journal)}</em>`, esc(p.pub_date), topicLabels(p.topics) && esc(topicLabels(p.topics))]
        .filter(Boolean)
        .join(' &middot; ');
      const doi = p.doi ? ` &middot; <a href="https://doi.org/${esc(p.doi)}" style="color:#2563eb;">DOI</a>` : '';
      return `
        <div style="margin:0 0 22px;padding:0 0 18px;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:16px;font-weight:600;line-height:1.4;color:#111827;">
            ${i + 1}. <a href="${esc(p.url)}" style="color:#111827;text-decoration:none;">${esc(p.title)}</a>
          </div>
          <div style="font-size:12px;color:#6b7280;margin:6px 0;">${meta}</div>
          <div style="font-size:12px;color:#6b7280;margin:0 0 8px;">${esc(p.authors)}</div>
          <div style="font-size:13px;color:#374151;line-height:1.6;">${esc(truncate(p.abstract, 600))}</div>
          <div style="font-size:12px;margin-top:8px;"><a href="${esc(p.url)}" style="color:#2563eb;">PubMed</a>${doi}</div>
        </div>`;
    })
    .join('');
  return `
  <div style="max-width:640px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <h1 style="font-size:20px;color:#111827;">毛髮相關新論文彙整</h1>
    <p style="font-size:13px;color:#6b7280;">${esc(dateStr)} · 本次新增 <strong>${papers.length}</strong> 篇 · 來源 PubMed</p>
    ${cards || '<p style="color:#6b7280;">本次沒有新論文。</p>'}
    <p style="font-size:11px;color:#9ca3af;margin-top:24px;">由 hair-papers 自動產生</p>
  </div>`;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
