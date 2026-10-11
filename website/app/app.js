(() => {
'use strict';

/* ───────── helpers ───────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const store = {
  get(k, d) { try { const v = localStorage.getItem('wren.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('wren.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const today = () => new Date().toISOString().slice(0, 10);

/* ───────── settings ───────── */
const defaults = {
  theme: 'auto', accent: '#10a5c8', font: 'mono', size: 18, lh: 1.7, width: 680,
  focus: 'off', typewriter: true, spell: false, dailyGoal: 500, sidebar: true, preview: false,
  pos: { noun: false, verb: false, adj: false, adv: false, conj: false }
};
const S = Object.assign({}, defaults, store.get('settings', {}));
S.pos = Object.assign({}, defaults.pos, S.pos || {});
const FONTS = {
  mono: 'ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,Consolas,"Liberation Mono",monospace',
  courier: '"Courier Prime","Courier New",Courier,monospace',
  menlo: 'Menlo,Monaco,Consolas,"DejaVu Sans Mono",monospace',
  jetbrains: '"JetBrains Mono","Fira Code","Fira Mono","Source Code Pro",monospace'
};

/* ───────── documents ───────── */
const WELCOME = `# Welcome to Wren

Wren is a calm place to write. Everything you type is saved automatically in this browser.

## Try these

- Press **Ctrl/⌘ Shift F** to cycle *focus mode* and dim everything but the line, sentence or paragraph you are writing.
- Press **Ctrl/⌘ Shift P** to open the live preview.
- Press **Ctrl/⌘ K** for the command palette: export, find, themes, headings and more.
- Open **Settings** to highlight nouns, verbs, adjectives, adverbs and conjunctions while you edit.

## Markdown

You can write **bold**, *italic*, ~~strikethrough~~, \`inline code\` and [links](https://example.com).

> Quotes look like this.

1. Numbered lists continue when you press Enter
2. Tab indents a list item
   - Shift Tab outdents it

- [ ] Task lists work too
- [x] Like this one

| Feature | Included |
| ------- | -------- |
| Tables  | yes      |
| Export  | md, html, pdf, doc, txt |

\`\`\`js
console.log("fenced code blocks are supported");
\`\`\`

Happy writing.
`;

let docs = store.get('docs', null);
if (!docs || !Object.keys(docs).length) {
  const id = uid();
  docs = { [id]: { id, text: WELCOME, updated: Date.now(), history: [] } };
  store.set('docs', docs);
  store.set('current', id);
}
let curId = store.get('current', null);
if (!docs[curId]) curId = Object.keys(docs).sort((a, b) => docs[b].updated - docs[a].updated)[0];
const handles = {}; // id -> FileSystemFileHandle (session only)

function titleOf(d) {
  const lines = d.text.split('\n');
  for (const l of lines) {
    const t = l.replace(/^#+\s*/, '').replace(/[*_`>~\[\]]/g, '').trim();
    if (t) return t.slice(0, 80);
  }
  return 'Untitled';
}
const countWords = t => (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;

let saveTimer = null, lastSnap = 0;
function persist() {
  const ok = store.set('docs', docs);
  store.set('current', curId);
  const el = $('#stSaved');
  el.textContent = ok ? 'Saved' : 'Storage full!';
}
function scheduleSave() {
  $('#stSaved').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const d = docs[curId];
    d.text = ed.value; d.updated = Date.now();
    if (Date.now() - lastSnap > 90000) { snapshot(d); lastSnap = Date.now(); }
    persist(); renderLibrary();
  }, 400);
}
function snapshot(d) {
  const last = d.history[0];
  if (last && last.text === d.text) return;
  d.history.unshift({ t: Date.now(), text: d.text });
  d.history.length = Math.min(d.history.length, 25);
}
function flush() {
  const d = docs[curId]; if (!d) return;
  if (d.text !== ed.value) { d.text = ed.value; d.updated = Date.now(); }
  persist();
}

/* ───────── elements ───────── */
const ed = $('#editor'), bd = $('#backdrop'), scroller = $('#scroller'), measure = $('#measure');
const inner = $('#inner');

/* ───────── part-of-speech heuristics ───────── */
const W = s => new Set(s.split(' '));
const CONJ = W('and or but nor so yet although though because since unless while whereas if when whenever whether however therefore moreover furthermore thus hence also then than as that which until once after before');
const STOP = W('the a an of in on at to from by with into onto over under about this these those it its he she they we you i me him her them us my your his their our is are was were be been being am do does did have has had will would can could shall should may might must not no there here what who whom whose how why where all any each every some such very just more most much many one two three');
const VERBS = W('go went gone goes make made take took taken see saw seen come came get got give gave find found think thought tell told become became leave left feel felt put bring brought begin began keep kept hold held write wrote written stand stood hear heard let mean meant set meet met run ran pay paid sit sat speak spoke lead led read grow grew lose lost fall fell send sent build built understand understood draw drew break broke spend spent cut rise rose drive drove buy bought wear wore choose chose throw threw reach walk talk look use work call try ask need seem help show play move live believe happen provide include continue change watch follow stop create open allow add learn remember love consider appear wait serve die expect stay like want know say');
const ADJ = W('good new first last long great little own other old right big high different small large next early young important few public bad same able free full hard easy simple clear real best better worse worst sure whole late');
const NOT_ADV = W('family early only july apply reply supply fly rely ally italy belly jelly bully holy ugly lily silly');
function posOf(w) {
  const l = w.toLowerCase();
  if (CONJ.has(l)) return 'conj';
  if (STOP.has(l) || l.length < 3) return null;
  if (VERBS.has(l)) return 'verb';
  if (ADJ.has(l)) return 'adj';
  if (l.length > 4 && /ly$/.test(l) && !NOT_ADV.has(l)) return 'adv';
  if (l.length > 4 && /(ing|ed)$/.test(l)) return 'verb';
  if (l.length > 4 && /(ous|ful|ive|able|ible|less|ish|ical|ic|ant|ent)$/.test(l)) return 'adj';
  if (l.length >= 4) return 'noun';
  return null;
}
function posWrap(text) {
  if (!S.pos.noun && !S.pos.verb && !S.pos.adj && !S.pos.adv && !S.pos.conj) return esc(text);
  let out = '', last = 0, m;
  const re = /[A-Za-zÀ-ÿ']+/g;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index));
    const p = posOf(m[0]);
    out += (p && S.pos[p]) ? '<span class="' + p + '">' + esc(m[0]) + '</span>' : esc(m[0]);
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

/* ───────── markdown highlighting (editor backdrop) ───────── */
const INL = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_|`[^`\n]+`|!?\[[^\]\n]*\]\([^)\n]*\)|\[\[[^\]\n]+\]\]|~~[^~\n]+~~|https?:\/\/[^\s)]+)/g;
function inl(text) {
  let out = '', last = 0, m;
  INL.lastIndex = 0;
  while ((m = INL.exec(text))) {
    out += posWrap(text.slice(last, m.index));
    const t = m[0];
    if (/^(\*\*|__)/.test(t)) out += '<span class="mk">' + t.slice(0, 2) + '</span><span class="b">' + posWrap(t.slice(2, -2)) + '</span><span class="mk">' + t.slice(-2) + '</span>';
    else if (/^[*_]/.test(t)) out += '<span class="mk">' + t[0] + '</span><span class="i">' + posWrap(t.slice(1, -1)) + '</span><span class="mk">' + t[0] + '</span>';
    else if (t[0] === '`') out += '<span class="code"><span class="mk">`</span>' + esc(t.slice(1, -1)) + '<span class="mk">`</span></span>';
    else if (t.startsWith('~~')) out += '<span class="mk">~~</span><span class="s">' + posWrap(t.slice(2, -2)) + '</span><span class="mk">~~</span>';
    else out += '<span class="lk">' + esc(t) + '</span>';
    last = m.index + t.length;
  }
  return out + posWrap(text.slice(last));
}
const FENCE = /^\s*(```|~~~)/;
function hlLine(l, st, atStart) {
  if (st.fence) {
    if (atStart && FENCE.test(l)) { st.fence = false; return '<span class="mk">' + esc(l) + '</span>'; }
    return '<span class="code">' + esc(l) + '</span>';
  }
  if (atStart && FENCE.test(l)) { st.fence = true; return '<span class="mk">' + esc(l) + '</span>'; }
  let m;
  if (atStart && (m = l.match(/^(#{1,6})(\s+)(.*)$/))) return '<span class="h h' + m[1].length + '"><span class="mk">' + m[1] + m[2] + '</span>' + inl(m[3]) + '</span>';
  if (atStart && /^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) return '<span class="mk">' + esc(l) + '</span>';
  if (atStart && (m = l.match(/^(\s*>+\s?)(.*)$/))) return '<span class="mk">' + esc(m[1]) + '</span><span class="quote">' + inl(m[2]) + '</span>';
  if (atStart && (m = l.match(/^(\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)(.*)$/))) return '<span class="mk">' + esc(m[1]) + '</span>' + inl(m[2]);
  return inl(l);
}
function hl(chunk, offset) {
  if (!chunk) return '';
  const full = ed.value;
  const st = { fence: ((full.slice(0, offset).match(/^\s*(```|~~~)/gm) || []).length % 2) === 1 };
  const lines = chunk.split('\n');
  return lines.map((l, i) => hlLine(l, st, i > 0 || offset === 0 || full[offset - 1] === '\n')).join('\n');
}

/* ───────── focus ranges ───────── */
function lineBounds(t, p) {
  const a = t.lastIndexOf('\n', p - 1) + 1;
  let b = t.indexOf('\n', p); if (b < 0) b = t.length;
  return [a, b];
}
function paraBounds(t, p) {
  let a = p, b = p;
  const before = t.slice(0, p), after = t.slice(p);
  const mb = before.lastIndexOf('\n\n');
  a = mb < 0 ? 0 : mb + 2;
  const ma = after.indexOf('\n\n');
  b = ma < 0 ? t.length : p + ma;
  return [a, b];
}
function sentenceBounds(t, p) {
  const [pa, pb] = paraBounds(t, p);
  const para = t.slice(pa, pb);
  const re = /[^.!?\n]+(?:[.!?]+["'”’)\]]*\s*|\n|$)|\n/g;
  let m, best = [pa, pb];
  const rel = p - pa;
  while ((m = re.exec(para))) {
    if (m[0] === '') { re.lastIndex++; continue; }
    if (rel >= m.index && rel <= m.index + m[0].length) { best = [pa + m.index, pa + m.index + m[0].length]; break; }
  }
  return best;
}
function activeRange(t, p, q) {
  const fn = { line: lineBounds, paragraph: paraBounds, sentence: sentenceBounds }[S.focus];
  const [a] = fn(t, p);
  const [, b] = fn(t, Math.max(p, q));
  return [a, Math.max(a, b)];
}

/* ───────── render ───────── */
let rafId = 0;
function renderNow() {
  const t = ed.value, p = ed.selectionStart, q = ed.selectionEnd;
  let html;
  if (S.focus === 'off') html = hl(t, 0);
  else {
    const [a, b] = activeRange(t, p, q);
    html = '<span class="dim">' + hl(t.slice(0, a), 0) + '</span>' + hl(t.slice(a, b), a) + '<span class="dim">' + hl(t.slice(b), b) + '</span>';
  }
  bd.innerHTML = html + '​';
  updateStatus();
}
function render() { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(renderNow); }

function caretY() {
  measure.style.width = ed.clientWidth + 'px';
  measure.textContent = ed.value.slice(0, ed.selectionEnd);
  const sp = document.createElement('span'); sp.textContent = '​';
  measure.appendChild(sp);
  return inner.offsetTop + sp.offsetTop;
}
function ensureCaret(smooth) {
  const y = caretY();
  const lh = parseFloat(getComputedStyle(bd).lineHeight) || 28;
  const h = scroller.clientHeight;
  let target;
  if (S.typewriter) target = y - h / 2 + lh / 2;
  else if (y < scroller.scrollTop + 60) target = y - 60;
  else if (y + lh > scroller.scrollTop + h - 80) target = y + lh - h + 80;
  else return;
  scroller.classList.toggle('smooth', !!smooth);
  scroller.scrollTop = Math.max(0, target);
}

/* ───────── status bar ───────── */
const stats = store.get('stats', {});
let lastWords = null;
function updateStatus() {
  const t = ed.value;
  const w = countWords(t);
  const sent = (t.match(/[^.!?\n]+[.!?]+(\s|$)/g) || []).length;
  $('#stWords').textContent = w.toLocaleString() + (w === 1 ? ' word' : ' words');
  $('#stChars').textContent = t.length.toLocaleString() + ' chars';
  $('#stSent').textContent = sent + (sent === 1 ? ' sentence' : ' sentences');
  $('#stRead').textContent = Math.max(w ? 1 : 0, Math.round(w / 220)) + ' min read';
  const sel = t.slice(ed.selectionStart, ed.selectionEnd);
  $('#stSel').textContent = sel ? countWords(sel) + ' words selected' : '';
  if (lastWords !== null && w > lastWords) { stats[today()] = (stats[today()] || 0) + (w - lastWords); store.set('stats', stats); }
  lastWords = w;
  const done = stats[today()] || 0;
  $('#stGoal').textContent = S.dailyGoal ? 'Today ' + done + ' / ' + S.dailyGoal + (done >= S.dailyGoal ? ' ✓' : '') + streakText() : '';
  $('#docTitle').textContent = titleOf({ text: t });
  document.title = titleOf({ text: t }) + ' — Wren';
}
function streakText() {
  let n = 0; const d = new Date();
  if (!(stats[d.toISOString().slice(0, 10)] > 0)) d.setDate(d.getDate() - 1);
  while (stats[d.toISOString().slice(0, 10)] > 0) { n++; d.setDate(d.getDate() - 1); }
  return n > 1 ? ' · ' + n + '-day streak' : '';
}

/* ───────── library / outline / history ───────── */
let tab = 'lib';
function fmtDate(t) {
  const d = new Date(t), n = new Date();
  if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function renderLibrary() {
  const q = $('#search').value.trim().toLowerCase();
  const list = Object.values(docs).filter(d => !q || d.text.toLowerCase().includes(q)).sort((a, b) => b.updated - a.updated);
  const el = $('#libList');
  el.innerHTML = '';
  if (!list.length) { el.innerHTML = '<div class="empty">No documents found.</div>'; return; }
  for (const d of list) {
    const txt = d.id === curId ? ed.value : d.text;
    const div = document.createElement('div');
    div.className = 'item' + (d.id === curId ? ' cur' : '');
    const body = txt.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim();
    div.innerHTML = '<div class="t">' + esc(titleOf({ text: txt })) + '</div><div class="s">' + esc(fmtDate(d.updated)) + ' · ' + countWords(txt) + ' w · ' + esc(body.slice(0, 50)) + '</div>' +
      '<div class="acts"><button data-a="dup" title="Duplicate">⧉</button><button data-a="del" title="Delete">🗑</button></div>';
    div.onclick = e => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'del') return deleteDoc(d.id);
      if (a === 'dup') return duplicateDoc(d.id);
      openDoc(d.id);
      if (innerWidth <= 820) toggleSidebar(false);
    };
    el.appendChild(div);
  }
}
function renderOutline() {
  const el = $('#outlineList'); el.innerHTML = '';
  const t = ed.value; let fence = false, idx = 0, found = 0;
  for (const l of t.split('\n')) {
    if (FENCE.test(l)) fence = !fence;
    const m = !fence && l.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      found++;
      const div = document.createElement('div');
      div.className = 'item o' + m[1].length;
      div.innerHTML = '<div class="t" style="padding-right:0">' + esc(m[2]) + '</div>';
      const at = idx;
      div.onclick = () => { ed.focus(); ed.setSelectionRange(at, at + l.length); ensureCaret(true); render(); };
      el.appendChild(div);
    }
    idx += l.length + 1;
  }
  if (!found) el.innerHTML = '<div class="empty">Add headings with # to build an outline.</div>';
}
function renderHistory() {
  const el = $('#historyList'); el.innerHTML = '';
  const h = docs[curId].history;
  if (!h.length) { el.innerHTML = '<div class="empty">Snapshots appear here automatically as you write (about every 90 seconds of editing).</div>'; return; }
  h.forEach(s => {
    const div = document.createElement('div'); div.className = 'item';
    div.innerHTML = '<div class="t">' + esc(new Date(s.t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</div><div class="s">' + countWords(s.text) + ' words · click to restore</div>';
    div.onclick = () => {
      if (!confirm('Restore this version? Your current text is saved to history first.')) return;
      snapshot({ history: docs[curId].history, text: ed.value });
      docs[curId].history.unshift({ t: Date.now(), text: ed.value });
      ed.focus(); ed.select(); insertText(s.text);
      toast('Version restored');
    };
    el.appendChild(div);
  });
}
function setTab(t) {
  tab = t;
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('#libList').hidden = t !== 'lib'; $('#outlineList').hidden = t !== 'outline'; $('#historyList').hidden = t !== 'history';
  if (t === 'outline') renderOutline(); if (t === 'history') renderHistory(); if (t === 'lib') renderLibrary();
}
function openDoc(id) {
  flush();
  curId = id; const d = docs[id];
  ed.value = d.text; lastWords = null; store.set('current', id);
  ed.setSelectionRange(0, 0);
  scroller.scrollTop = 0;
  render(); renderLibrary(); if (tab !== 'lib') setTab(tab); updatePreview();
  setTimeout(() => ed.focus(), 0);
}
function newDoc(text = '') {
  flush();
  const id = uid();
  docs[id] = { id, text, updated: Date.now(), history: [] };
  openDoc(id); persist();
  ed.focus();
}
function deleteDoc(id) {
  if (!confirm('Delete "' + titleOf(docs[id]) + '"? This cannot be undone.')) return;
  delete docs[id]; delete handles[id];
  if (!Object.keys(docs).length) { newDoc('# '); ed.setSelectionRange(2, 2); return; }
  if (id === curId) openDoc(Object.values(docs).sort((a, b) => b.updated - a.updated)[0].id);
  persist(); renderLibrary();
}
function duplicateDoc(id) {
  const t = id === curId ? ed.value : docs[id].text;
  newDoc(t); toast('Duplicated');
}

/* ───────── editing helpers ───────── */
function insertText(str) {
  ed.focus();
  let ok = false;
  try { ok = document.execCommand('insertText', false, str); } catch (e) { }
  if (!ok) { ed.setRangeText(str, ed.selectionStart, ed.selectionEnd, 'end'); ed.dispatchEvent(new Event('input', { bubbles: true })); }
}
function replaceRange(a, b, str, selA, selB) {
  ed.focus(); ed.setSelectionRange(a, b); insertText(str);
  if (selA !== undefined) ed.setSelectionRange(selA, selB ?? selA);
}
function wrap(mark, ph = 'text') {
  const a = ed.selectionStart, b = ed.selectionEnd, t = ed.value, n = mark.length;
  const sel = t.slice(a, b);
  if (sel && t.slice(a - n, a) === mark && t.slice(b, b + n) === mark) { replaceRange(a - n, b + n, sel, a - n, b - n); return; }
  if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= 2 * n) { const inn = sel.slice(n, -n); replaceRange(a, b, inn, a, a + inn.length); return; }
  const body = sel || ph;
  replaceRange(a, b, mark + body + mark, a + n, a + n + body.length);
}
function linePrefix(prefix) {
  const t = ed.value, [a, b] = lineBounds(t, ed.selectionStart);
  const line = t.slice(a, b).replace(/^(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '');
  replaceRange(a, b, prefix + line, a + prefix.length + line.length);
}
function heading(n) {
  const t = ed.value, [a, b] = lineBounds(t, ed.selectionStart);
  const line = t.slice(a, b), cur = (line.match(/^(#{1,6})\s/) || [])[1];
  const body = line.replace(/^#{1,6}\s+/, '');
  const pre = (cur && cur.length === n) ? '' : '#'.repeat(n) + ' ';
  replaceRange(a, b, pre + body, a + pre.length + body.length);
}
function insertLink() {
  const a = ed.selectionStart, b = ed.selectionEnd, sel = ed.value.slice(a, b) || 'link text';
  const s = '[' + sel + '](url)';
  replaceRange(a, b, s, a + sel.length + 3, a + sel.length + 6);
}
function onEnter(e) {
  if (e.shiftKey || e.isComposing) return;
  const t = ed.value, p = ed.selectionStart;
  if (p !== ed.selectionEnd) return;
  const [a, b] = lineBounds(t, p);
  const line = t.slice(a, b);
  const m = line.match(/^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?(.*)$/) || line.match(/^(\s*)(>)(\s?)()(.*)$/);
  if (!m || p < a + (m[1] + m[2] + m[3]).length) return;
  e.preventDefault();
  if (!m[5].trim()) { replaceRange(a, b, '', a); return; } // empty item ends the list
  let marker = m[2];
  const num = marker.match(/^(\d+)([.)])$/);
  if (num) marker = (parseInt(num[1], 10) + 1) + num[2];
  insertText('\n' + m[1] + marker + m[3] + (m[4] ? '[ ] ' : ''));
}
function onTab(e) {
  e.preventDefault();
  const t = ed.value, a = ed.selectionStart, b = ed.selectionEnd;
  const [la] = lineBounds(t, a), [, lb] = lineBounds(t, Math.max(a, b - (b > a && t[b - 1] === '\n' ? 1 : 0)));
  const block = t.slice(la, lb);
  const multi = block.includes('\n');
  const isList = /^\s*([-*+]|\d+[.)])\s/.test(block);
  if (!e.shiftKey && !multi && !isList) { insertText('  '); return; }
  const out = block.split('\n').map(l => e.shiftKey ? l.replace(/^( {1,2}|\t)/, '') : '  ' + l).join('\n');
  replaceRange(la, lb, out, la, la + out.length);
  if (!multi) ed.setSelectionRange(Math.max(la, a + out.length - block.length), Math.max(la, b + out.length - block.length));
}

/* ───────── markdown → HTML ───────── */
const slug = s => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
function inlineMd(s) {
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, src, ti) => '<img alt="' + alt + '" src="' + safeUrl(src) + '"' + (ti ? ' title="' + ti + '"' : '') + '>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, tx, href) => '<a href="' + safeUrl(href) + '" target="_blank" rel="noopener">' + tx + '</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => '<strong>' + (a || b) + '</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + esc(codes[i]) + '</code>');
  return s;
}
function safeUrl(u) { u = u.replace(/&amp;/g, '&'); return /^\s*(javascript|data:text|vbscript):/i.test(u) ? '#' : esc(u).replace(/"/g, '&quot;'); }
function buildList(items, start) {
  const base = items[start].indent, ordered = items[start].ordered;
  let html = '<' + (ordered ? 'ol' : 'ul') + '>', i = start;
  while (i < items.length && items[i].indent >= base) {
    if (items[i].indent > base) { const [sub, ni] = buildList(items, i); html = html.replace(/<\/li>$/, sub + '</li>'); i = ni; continue; }
    const it = items[i]; let t = inlineMd(it.text), cls = '';
    if (it.checked !== null) { t = '<input type="checkbox" disabled' + (it.checked ? ' checked' : '') + '> ' + t; cls = ' class="task"'; }
    html += '<li' + cls + '>' + t + '</li>'; i++;
  }
  return [html + '</' + (ordered ? 'ol' : 'ul') + '>', i];
}
function renderMarkdown(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out = []; let i = 0;
  const isBlockStart = l => /^(#{1,6}\s|\s*>|\s*```|\s*~~~|\s*([-*_])(\s*\2){2,}\s*$|\s*([-*+]|\d+[.)])\s)/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^\s*(```|~~~)\s*([\w+-]*)/))) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(m[1])) buf.push(lines[i++]);
      i++; out.push('<pre><code' + (m[2] ? ' class="language-' + esc(m[2]) + '"' : '') + '>' + esc(buf.join('\n')) + '</code></pre>'); continue;
    }
    if ((m = l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) { out.push('<h' + m[1].length + ' id="' + slug(m[2]) + '">' + inlineMd(m[2]) + '</h' + m[1].length + '>'); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(l)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push('<blockquote>' + renderMarkdown(buf.join('\n')) + '</blockquote>'); continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(l), al = cells(lines[i + 1]).map(c => /^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : /^:-/.test(c) ? 'left' : '');
      i += 2; const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      const td = (t, c, k) => '<' + t + (al[k] ? ' style="text-align:' + al[k] + '"' : '') + '>' + inlineMd(c || '') + '</' + t + '>';
      out.push('<table><thead><tr>' + head.map((c, k) => td('th', c, k)).join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + head.map((_, k) => td('td', r[k], k)).join('') + '</tr>').join('') + '</tbody></table>'); continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s/.test(l)) {
      const items = [];
      while (i < lines.length && (/^\s*([-*+]|\d+[.)])\s/.test(lines[i]) || (/^\s+\S/.test(lines[i]) && items.length))) {
        const mm = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(\[([ xX])\]\s+)?(.*)$/);
        if (mm) items.push({ indent: mm[1].replace(/\t/g, '    ').length, ordered: /\d/.test(mm[2]), checked: mm[3] ? /x/i.test(mm[4]) : null, text: mm[5] });
        else items[items.length - 1].text += ' ' + lines[i].trim();
        i++;
      }
      out.push(buildList(items, 0)[0]); continue;
    }
    const buf = [l]; i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
    out.push('<p>' + inlineMd(buf.join('\n')).replace(/\n/g, '<br>') + '</p>');
  }
  return out.join('\n');
}

/* ───────── preview ───────── */
let pvTimer;
function updatePreview() {
  if ($('#preview').hidden) return;
  clearTimeout(pvTimer);
  pvTimer = setTimeout(() => { $('#preview').innerHTML = '<div class="md">' + renderMarkdown(ed.value) + '</div>'; }, 120);
}
function togglePreview(force) {
  S.preview = force ?? !S.preview;
  $('#preview').hidden = !S.preview; $('#previewBtn').style.background = S.preview ? 'var(--panel)' : '';
  saveSettings(); updatePreview();
}

/* ───────── export ───────── */
const EXPORT_CSS = 'body{font:17px/1.7 Georgia,"Times New Roman",serif;max-width:720px;margin:48px auto;padding:0 24px;color:#222}h1,h2,h3,h4{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.25;margin:1.6em 0 .5em}a{color:#0b7fa0}code{font-family:Menlo,Consolas,monospace;font-size:.88em;background:#f1f1ee;padding:.1em .35em;border-radius:4px}pre{background:#f1f1ee;padding:14px 16px;border-radius:8px;overflow:auto}pre code{background:none;padding:0}blockquote{margin:1em 0;padding-left:1em;border-left:3px solid #10a5c8;color:#555}table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 12px}img{max-width:100%}hr{border:0;border-top:1px solid #ddd}li.task{list-style:none;margin-left:-1.2em}';
const fullHtml = () => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(titleOf({ text: ed.value })) + '</title><style>' + EXPORT_CSS + '</style></head><body>' + renderMarkdown(ed.value) + '</body></html>';
const fileName = ext => (titleOf({ text: ed.value }).replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'Untitled') + '.' + ext;
function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function plainText() {
  const d = document.createElement('div'); d.innerHTML = renderMarkdown(ed.value);
  return d.innerText || d.textContent;
}
async function saveFile() {
  const h = handles[curId];
  try {
    if (h) { const w = await h.createWritable(); await w.write(ed.value); await w.close(); toast('Saved to ' + h.name); return; }
    if (window.showSaveFilePicker) {
      const nh = await showSaveFilePicker({ suggestedName: fileName('md'), types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }] });
      const w = await nh.createWritable(); await w.write(ed.value); await w.close(); handles[curId] = nh; toast('Saved to ' + nh.name); return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  download(fileName('md'), ed.value, 'text/markdown'); toast('Downloaded ' + fileName('md'));
}
const EXPORTS = {
  md: () => download(fileName('md'), ed.value, 'text/markdown'),
  txt: () => download(fileName('txt'), plainText(), 'text/plain'),
  html: () => download(fileName('html'), fullHtml(), 'text/html'),
  doc: () => download(fileName('doc'), '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>' + esc(titleOf({ text: ed.value })) + '</title></head><body>' + renderMarkdown(ed.value) + '</body></html>', 'application/msword'),
  pdf: () => {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f); f.srcdoc = fullHtml();
    f.onload = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
  },
  copyhtml: async () => { try { const html = renderMarkdown(ed.value); await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([ed.value], { type: 'text/plain' }) })]); toast('Copied rich text'); } catch (e) { toast('Copy not allowed here'); } },
  copymd: async () => { try { await navigator.clipboard.writeText(ed.value); toast('Markdown copied'); } catch (e) { toast('Copy not allowed here'); } }
};
function showExportMenu() {
  const m = $('#exportMenu');
  if (!m.hidden) { m.hidden = true; return; }
  const items = [['md', 'Markdown (.md)'], ['html', 'HTML (.html)'], ['pdf', 'PDF (print)…'], ['doc', 'Word (.doc)'], ['txt', 'Plain text (.txt)'], ['copyhtml', 'Copy as rich text'], ['copymd', 'Copy Markdown']];
  m.innerHTML = items.map(([k, v]) => '<button data-x="' + k + '">' + v + '</button>').join('');
  m.hidden = false;
  m.onclick = e => { const k = e.target.dataset.x; if (k) { EXPORTS[k](); m.hidden = true; } };
}

/* ───────── import ───────── */
async function importFiles(files) {
  let n = 0;
  for (const f of files) {
    if (!/\.(md|markdown|mdown|txt|text)$/i.test(f.name) && !f.type.startsWith('text/')) { toast('Skipped ' + f.name); continue; }
    const text = await f.text(); newDoc(text); n++;
  }
  if (n) toast('Imported ' + n + (n === 1 ? ' file' : ' files'));
}
async function openFromDisk() {
  if (window.showOpenFilePicker) {
    try {
      const [h] = await showOpenFilePicker({ types: [{ description: 'Text', accept: { 'text/*': ['.md', '.markdown', '.txt'] } }] });
      const text = await (await h.getFile()).text(); newDoc(text); handles[curId] = h; toast('Opened ' + h.name + ' — Ctrl/⌘ S saves back to it');
    } catch (e) { }
  } else $('#fileInput').click();
}

/* ───────── find & replace ───────── */
function findRegex() {
  const q = $('#findInput').value; if (!q) return null;
  try { return new RegExp($('#findRe').checked ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g' + ($('#findCase').checked ? '' : 'i')); } catch (e) { return null; }
}
function findAll() {
  const re = findRegex(), res = []; if (!re) return res;
  let m; const t = ed.value;
  while ((m = re.exec(t)) && res.length < 5000) { if (m[0] === '') { re.lastIndex++; continue; } res.push([m.index, m.index + m[0].length, m[0]]); }
  return res;
}
function findStep(dir) {
  const all = findAll(); $('#findCount').textContent = all.length ? all.length + ' found' : 'none';
  if (!all.length) return;
  const p = dir > 0 ? ed.selectionEnd : ed.selectionStart;
  let hit = dir > 0 ? all.find(r => r[0] >= p) || all[0] : [...all].reverse().find(r => r[1] <= p) || all[all.length - 1];
  ed.focus(); ed.setSelectionRange(hit[0], hit[1]); ensureCaret(true); render();
}
function replaceOne() {
  const re = findRegex(); if (!re) return;
  const sel = ed.value.slice(ed.selectionStart, ed.selectionEnd);
  const one = new RegExp(re.source, re.flags.replace('g', ''));
  if (sel && one.test(sel) && sel.replace(one, '') === '' ) insertText(sel.replace(one, $('#replInput').value));
  findStep(1);
}
function replaceAll() {
  const re = findRegex(); if (!re) return;
  const n = findAll().length; if (!n) return;
  const out = ed.value.replace(re, $('#replInput').value);
  ed.focus(); ed.select(); insertText(out); toast('Replaced ' + n);
  $('#findCount').textContent = '0 found';
}
function toggleFind(show) {
  const f = $('#findbar'); const open = show ?? f.hidden;
  f.hidden = !open;
  if (open) {
    const sel = ed.value.slice(ed.selectionStart, ed.selectionEnd);
    if (sel && !sel.includes('\n')) $('#findInput').value = sel;
    $('#findInput').focus(); $('#findInput').select(); findStep(1);
  } else ed.focus();
}

/* ───────── UI state ───────── */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1800);
}
function saveSettings() { store.set('settings', S); }
const mq = matchMedia('(prefers-color-scheme: dark)');
function applySettings() {
  const r = document.documentElement.style;
  r.setProperty('--fs', S.size + 'px'); r.setProperty('--lh', S.lh); r.setProperty('--measure', S.width + 'px');
  r.setProperty('--acc', S.accent); r.setProperty('--font', FONTS[S.font] || FONTS.mono);
  const th = S.theme === 'auto' ? (mq.matches ? 'dark' : 'light') : S.theme;
  document.body.dataset.theme = th;
  const meta = $('meta[name=theme-color]'); if (meta) meta.content = { light: '#fafaf8', dark: '#17181a', sepia: '#f4ecd8' }[th];
  r.setProperty('--pad-top', S.typewriter ? '38vh' : '56px'); r.setProperty('--pad-bot', S.typewriter ? '50vh' : '30vh');
  ed.spellcheck = !!S.spell;
  $$('[data-focus]').forEach(b => b.classList.toggle('on', b.dataset.focus === S.focus));
  render();
}
mq.addEventListener?.('change', () => S.theme === 'auto' && applySettings());
function toggleSidebar(force) {
  const show = force ?? document.body.classList.contains('nosb');
  document.body.classList.toggle('nosb', !show); S.sidebar = show; saveSettings();
}
function cycleFocus() {
  const order = ['off', 'line', 'sentence', 'paragraph'];
  S.focus = order[(order.indexOf(S.focus) + 1) % order.length]; saveSettings(); applySettings(); toast('Focus: ' + S.focus);
}
function cycleTheme() {
  const order = ['light', 'dark', 'sepia'];
  const cur = document.body.dataset.theme;
  S.theme = order[(order.indexOf(cur) + 1) % order.length]; saveSettings(); applySettings(); syncSettingsForm();
}
function toggleZen() { document.body.classList.toggle('zen'); toast(document.body.classList.contains('zen') ? 'Zen mode on' : 'Zen mode off'); }

/* settings form */
function getPath(k) { return k.split('.').reduce((o, x) => o[x], S); }
function setPath(k, v) { const p = k.split('.'); const last = p.pop(); p.reduce((o, x) => o[x], S)[last] = v; }
function syncSettingsForm() {
  $$('#settings [data-k]').forEach(el => { const v = getPath(el.dataset.k); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; });
}
$$('#settings [data-k]').forEach(el => {
  el.addEventListener('input', () => {
    let v = el.type === 'checkbox' ? el.checked : (el.type === 'range' || el.type === 'number') ? parseFloat(el.value) || 0 : el.value;
    setPath(el.dataset.k, v); saveSettings(); applySettings();
  });
});

/* command palette */
const mod = isMac ? '⌘' : 'Ctrl';
const COMMANDS = [
  ['New document', mod + ' N', () => newDoc()],
  ['Save to file', mod + ' S', saveFile],
  ['Open file from disk…', '', openFromDisk],
  ['Import files…', '', () => $('#fileInput').click()],
  ['Toggle preview', mod + ' ⇧ P', () => togglePreview()],
  ['Toggle library sidebar', mod + ' \\', () => toggleSidebar()],
  ['Zen mode', mod + ' ⇧ J', toggleZen],
  ['Cycle focus mode', mod + ' ⇧ F', cycleFocus],
  ['Focus: off', '', () => { S.focus = 'off'; applySettings(); saveSettings(); }],
  ['Focus: line', '', () => { S.focus = 'line'; applySettings(); saveSettings(); }],
  ['Focus: sentence', '', () => { S.focus = 'sentence'; applySettings(); saveSettings(); }],
  ['Focus: paragraph', '', () => { S.focus = 'paragraph'; applySettings(); saveSettings(); }],
  ['Toggle typewriter scrolling', '', () => { S.typewriter = !S.typewriter; saveSettings(); applySettings(); syncSettingsForm(); }],
  ['Theme: light', '', () => { S.theme = 'light'; saveSettings(); applySettings(); syncSettingsForm(); }],
  ['Theme: dark', '', () => { S.theme = 'dark'; saveSettings(); applySettings(); syncSettingsForm(); }],
  ['Theme: sepia', '', () => { S.theme = 'sepia'; saveSettings(); applySettings(); syncSettingsForm(); }],
  ['Theme: auto', '', () => { S.theme = 'auto'; saveSettings(); applySettings(); syncSettingsForm(); }],
  ['Find & replace', mod + ' F', () => toggleFind(true)],
  ['Show outline', '', () => { toggleSidebar(true); setTab('outline'); }],
  ['Show history', '', () => { toggleSidebar(true); setTab('history'); }],
  ['Show library', '', () => { toggleSidebar(true); setTab('lib'); }],
  ['Settings', mod + ' ,', () => openSettings()],
  ['Bold', mod + ' B', () => wrap('**')],
  ['Italic', mod + ' I', () => wrap('*')],
  ['Strikethrough', '', () => wrap('~~')],
  ['Inline code', '', () => wrap('`', 'code')],
  ['Insert link', mod + ' ⇧ K', insertLink],
  ['Heading 1', '', () => heading(1)], ['Heading 2', '', () => heading(2)], ['Heading 3', '', () => heading(3)],
  ['Heading 4', '', () => heading(4)], ['Heading 5', '', () => heading(5)], ['Heading 6', '', () => heading(6)],
  ['Bulleted list', '', () => linePrefix('- ')], ['Numbered list', '', () => linePrefix('1. ')],
  ['Task item', '', () => linePrefix('- [ ] ')], ['Quote', '', () => linePrefix('> ')],
  ['Insert today’s date', '', () => insertText(new Date().toLocaleDateString(undefined, { dateStyle: 'full' }))],
  ['Insert table', '', () => insertText('\n| Column | Column |\n| ------ | ------ |\n|        |        |\n')],
  ['Insert code block', '', () => insertText('\n```\n\n```\n')],
  ['Export Markdown', '', EXPORTS.md], ['Export HTML', '', EXPORTS.html], ['Export PDF (print)', '', EXPORTS.pdf],
  ['Export Word (.doc)', '', EXPORTS.doc], ['Export plain text', '', EXPORTS.txt],
  ['Copy as rich text', '', EXPORTS.copyhtml], ['Copy Markdown', '', EXPORTS.copymd],
  ['Sort selected lines A→Z', '', () => { const a = ed.selectionStart, b = ed.selectionEnd; if (a === b) return toast('Select some lines first'); const out = ed.value.slice(a, b).split('\n').sort((x, y) => x.localeCompare(y)).join('\n'); replaceRange(a, b, out, a, a + out.length); }],
  ['Delete this document', '', () => deleteDoc(curId)],
  ['Reset all settings', '', () => { Object.assign(S, JSON.parse(JSON.stringify(defaults))); saveSettings(); applySettings(); syncSettingsForm(); }]
];
let palSel = 0, palItems = [];
function openPalette() {
  $('#palette').hidden = false; $('#palInput').value = ''; renderPalette(); $('#palInput').focus();
}
function closePalette() { $('#palette').hidden = true; ed.focus(); }
function renderPalette() {
  const q = $('#palInput').value.toLowerCase().trim();
  palItems = COMMANDS.filter(c => !q || c[0].toLowerCase().includes(q));
  if (palSel >= palItems.length) palSel = 0;
  $('#palList').innerHTML = palItems.map((c, i) => '<div class="cmd' + (i === palSel ? ' on' : '') + '" data-i="' + i + '"><span>' + esc(c[0]) + '</span><kbd>' + esc(c[1]) + '</kbd></div>').join('') || '<div class="empty">No matching command</div>';
  $('#palList .on')?.scrollIntoView({ block: 'nearest' });
}
function runPalette(i) { const c = palItems[i]; if (!c) return; closePalette(); setTimeout(c[2], 0); }
$('#palInput').addEventListener('input', () => { palSel = 0; renderPalette(); });
$('#palInput').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { palSel = (palSel + 1) % Math.max(1, palItems.length); renderPalette(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { palSel = (palSel - 1 + palItems.length) % Math.max(1, palItems.length); renderPalette(); e.preventDefault(); }
  else if (e.key === 'Enter') { runPalette(palSel); e.preventDefault(); }
  else if (e.key === 'Escape') closePalette();
});
$('#palList').addEventListener('click', e => { const c = e.target.closest('.cmd'); if (c) runPalette(+c.dataset.i); });
$('#palette').addEventListener('mousedown', e => { if (e.target.id === 'palette') closePalette(); });
function openSettings() { syncSettingsForm(); $('#settings').hidden = false; }
function closeSettings() { $('#settings').hidden = true; ed.focus(); }
$('#settings').addEventListener('mousedown', e => { if (e.target.id === 'settings') closeSettings(); });
$('#setClose').onclick = closeSettings;

/* ───────── events ───────── */
ed.addEventListener('input', () => {
  render(); scheduleSave(); updatePreview(); ensureCaret(false);
  if (tab === 'outline') renderOutline();
});
ed.addEventListener('keydown', e => {
  document.body.classList.add('typing');
  if (e.key === 'Enter' && !(e.metaKey || e.ctrlKey || e.altKey)) onEnter(e);
  else if (e.key === 'Tab' && !(e.metaKey || e.ctrlKey || e.altKey)) onTab(e);
});
let selTimer;
document.addEventListener('selectionchange', () => {
  if (document.activeElement !== ed) return;
  cancelAnimationFrame(selTimer);
  selTimer = requestAnimationFrame(() => { if (S.focus !== 'off') renderNow(); else updateStatus(); if (!document.body.classList.contains('typing') || S.typewriter) ensureCaret(true); });
});
ed.addEventListener('paste', e => {
  const items = e.clipboardData?.items || [];
  const html = e.clipboardData?.getData('text/html');
  const text = e.clipboardData?.getData('text/plain') || '';
  // paste URL over selection → link
  if (ed.selectionStart !== ed.selectionEnd && /^https?:\/\/\S+$/.test(text.trim())) {
    e.preventDefault(); const a = ed.selectionStart, b = ed.selectionEnd, s = ed.value.slice(a, b);
    replaceRange(a, b, '[' + s + '](' + text.trim() + ')'); return;
  }
  void items; void html;
});
['mousemove', 'mousedown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => document.body.classList.remove('typing'), { passive: true }));
ed.addEventListener('blur', flush);
addEventListener('beforeunload', flush);
addEventListener('pagehide', flush);
addEventListener('resize', () => { render(); });
scroller.addEventListener('mousedown', e => { if (e.target === scroller || e.target.id === 'column') { ed.focus(); const l = ed.value.length; if (e.offsetY > inner.offsetTop) ed.setSelectionRange(l, l); } });
$('#preview').addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (a) { e.preventDefault(); $('#preview').querySelector(a.getAttribute('href'))?.scrollIntoView(); } });

document.addEventListener('keydown', e => {
  const m = e.metaKey || e.ctrlKey; const k = e.key.toLowerCase();
  if (e.key === 'Escape') {
    if (!$('#palette').hidden) return closePalette();
    if (!$('#settings').hidden) return closeSettings();
    if (!$('#exportMenu').hidden) { $('#exportMenu').hidden = true; return; }
    if (!$('#findbar').hidden) return toggleFind(false);
    if (document.body.classList.contains('zen')) return toggleZen();
  }
  if (!m) return;
  const run = fn => { e.preventDefault(); fn(); };
  if (k === 'k' && !e.shiftKey) run(openPalette);
  else if (k === 'k' && e.shiftKey) run(insertLink);
  else if (k === 'b' && !e.shiftKey) run(() => wrap('**'));
  else if (k === 'i' && !e.shiftKey) run(() => wrap('*'));
  else if (k === 'p' && e.shiftKey) run(() => togglePreview());
  else if (k === 'f' && e.shiftKey) run(cycleFocus);
  else if (k === 'f') run(() => toggleFind(true));
  else if (k === 'n' && !e.shiftKey) run(() => newDoc());
  else if (k === 's') run(saveFile);
  else if (k === '\\') run(() => toggleSidebar());
  else if (k === ',') run(openSettings);
  else if (e.shiftKey && k === 'x') run(() => wrap('~~'));
});
// Zen mode shortcut that does not clash with undo/redo
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'j') { e.preventDefault(); toggleZen(); } });

$('#newBtn').onclick = () => newDoc();
$('#sbToggle').onclick = () => toggleSidebar();
$('#previewBtn').onclick = () => togglePreview();
$('#findBtn').onclick = () => toggleFind();
$('#exportBtn').onclick = e => { e.stopPropagation(); showExportMenu(); };
$('#themeBtn').onclick = cycleTheme;
$('#settingsBtn').onclick = openSettings;
$('#paletteBtn').onclick = openPalette;
$('#importBtn').onclick = () => $('#fileInput').click();
$('#openBtn').onclick = openFromDisk;
$('#fileInput').onchange = e => { importFiles([...e.target.files]); e.target.value = ''; };
$('#search').addEventListener('input', renderLibrary);
$$('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
$$('[data-focus]').forEach(b => b.onclick = () => { S.focus = b.dataset.focus; saveSettings(); applySettings(); ed.focus(); });
document.addEventListener('click', e => { if (!e.target.closest('#exportMenu') && e.target.id !== 'exportBtn') $('#exportMenu').hidden = true; });
$('#findInput').addEventListener('input', () => { const n = findAll().length; $('#findCount').textContent = n ? n + ' found' : 'none'; });
$('#findInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); } });
$('#replInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } });
$('#findNext').onclick = () => findStep(1); $('#findPrev').onclick = () => findStep(-1);
$('#replOne').onclick = replaceOne; $('#replAll').onclick = replaceAll; $('#findClose').onclick = () => toggleFind(false);
$('#findCase').onchange = $('#findRe').onchange = () => findStep(1);

// drag & drop import
let dragN = 0;
addEventListener('dragenter', e => { if (e.dataTransfer?.types?.includes('Files')) { dragN++; document.body.classList.add('drop'); } });
addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; document.body.classList.remove('drop'); } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); dragN = 0; document.body.classList.remove('drop'); if (e.dataTransfer?.files?.length) importFiles([...e.dataTransfer.files]); });

// desktop wrapper hooks (Electron menu)
window.wren = { newDoc, saveFile, openFromDisk, togglePreview, cycleFocus, toggleZen, openPalette, openSettings, exports: EXPORTS, importFiles };

/* ───────── boot ───────── */
document.body.classList.toggle('nosb', !S.sidebar || innerWidth <= 820);
$('#preview').hidden = !S.preview;
$('#previewBtn').style.background = S.preview ? 'var(--panel)' : '';
ed.value = docs[curId].text;
applySettings(); renderLibrary(); updatePreview();
if (!ed.value || ed.value === WELCOME) { /* show welcome from the top */ }
ed.focus({ preventScroll: true }); ed.setSelectionRange(ed.value.length > 400 ? 0 : ed.value.length, ed.value.length > 400 ? 0 : ed.value.length);
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
