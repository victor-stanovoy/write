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
  smart: true, autopair: true, fillers: false,
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
// items that sat in the Trash for more than 30 days are removed for good
for (const id of Object.keys(docs)) if (docs[id].trashed && Date.now() - docs[id].trashed > 30 * 864e5) delete docs[id];
let curId = store.get('current', null);
if (!docs[curId] || docs[curId].trashed) {
  const live = Object.values(docs).filter(d => !d.trashed).sort((a, b) => b.updated - a.updated);
  if (live.length) curId = live[0].id;
  else { curId = uid(); docs[curId] = { id: curId, text: '# ', updated: Date.now(), history: [] }; }
}
let _tsT = 0, _tsS = new Set();
const handles = {}; // id -> FileSystemFileHandle (session only)

function titleOf(d) {
  const t = d.text; let i = 0;
  while (i <= t.length) {
    let j = t.indexOf('\n', i); if (j < 0) j = t.length;
    const l = t.slice(i, j).replace(/^#+\s*/, '').replace(/[*_`>~\[\]]/g, '').trim();
    if (l) return l.slice(0, 80);
    if (j >= t.length) break;
    i = j + 1;
  }
  return 'Untitled';
}
const norm = x => x.trim().toLowerCase();
const unesc = x => x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attr = x => esc(x).replace(/"/g, '&quot;');
function liveDocs() { return Object.values(docs).filter(d => !d.trashed); }
function textOf(d) { return d.id === curId ? ed.value : d.text; }
function titleSet() {
  const n = Date.now();
  if (n - _tsT > 1000) { _tsS = new Set(liveDocs().map(d => norm(titleOf({ text: textOf(d) })))); _tsT = n; }
  return _tsS;
}
const hasDoc = x => titleSet().has(norm(x));
const countWords = t => (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;

let saveTimer = null, lastSnap = 0;
function persist() {
  _tsT = 0;
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
const FILL = W('very really just quite actually basically literally simply somewhat rather perhaps maybe probably honestly definitely totally extremely fairly clearly obviously certainly seriously essentially virtually');
function posWrap(text) {
  const anyPos = S.pos.noun || S.pos.verb || S.pos.adj || S.pos.adv || S.pos.conj;
  if (!anyPos && !S.fillers) return esc(text);
  let out = '', last = 0, m;
  const re = /[A-Za-zÀ-ÿ']+/g;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index));
    if (S.fillers && FILL.has(m[0].toLowerCase())) out += '<span class="fill">' + esc(m[0]) + '</span>';
    else { const p = anyPos ? posOf(m[0]) : null; out += (p && S.pos[p]) ? '<span class="' + p + '">' + esc(m[0]) + '</span>' : esc(m[0]); }
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
    else if (t.startsWith('[[')) out += '<span class="wk' + (hasDoc(t.slice(2, -2).split('|')[0]) ? '' : ' miss') + '">' + esc(t) + '</span>';
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

function caretPos() {
  measure.style.width = ed.clientWidth + 'px';
  measure.textContent = ed.value.slice(0, ed.selectionEnd);
  const sp = document.createElement('span'); sp.textContent = '\u200b';
  measure.appendChild(sp);
  return { x: inner.offsetLeft + sp.offsetLeft, y: inner.offsetTop + sp.offsetTop };
}
const caretY = () => caretPos().y;
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
let showTrash = false;
function renderLibrary() {
  const el = $('#libList'); el.innerHTML = '';
  const trashed = Object.values(docs).filter(d => d.trashed).sort((a, b) => b.trashed - a.trashed);
  if (showTrash) {
    const head = document.createElement('div'); head.className = 'trashhead';
    head.innerHTML = '<button data-a="back">← Library</button><button data-a="empty"' + (trashed.length ? '' : ' disabled') + '>Empty Trash</button>';
    head.onclick = e => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'back') { showTrash = false; renderLibrary(); }
      if (a === 'empty' && trashed.length && confirm('Permanently delete ' + trashed.length + ' document(s)?')) { trashed.forEach(d => delete docs[d.id]); persist(); renderLibrary(); }
    };
    el.appendChild(head);
    if (!trashed.length) el.insertAdjacentHTML('beforeend', '<div class="empty">Trash is empty. Deleted documents stay here for 30 days.</div>');
    for (const d of trashed) {
      const div = document.createElement('div'); div.className = 'item';
      div.innerHTML = '<div class="t">' + esc(titleOf(d)) + '</div><div class="s">Deleted ' + esc(fmtDate(d.trashed)) + ' · ' + countWords(d.text) + ' w</div><div class="acts"><button data-a="restore" title="Restore">↩</button><button data-a="purge" title="Delete forever">✕</button></div>';
      div.onclick = e => {
        const a = e.target.closest('button')?.dataset.a;
        if (a === 'restore') { delete d.trashed; d.updated = Date.now(); persist(); renderLibrary(); toast('Restored'); }
        else if (a === 'purge' && confirm('Delete this document forever?')) { delete docs[d.id]; persist(); renderLibrary(); }
      };
      el.appendChild(div);
    }
    return;
  }
  const q = $('#search').value.trim().toLowerCase();
  const list = liveDocs().filter(d => !q || textOf(d).toLowerCase().includes(q)).sort((a, b) => (!!b.pinned - !!a.pinned) || b.updated - a.updated);
  if (!list.length) el.innerHTML = '<div class="empty">No documents found.</div>';
  for (const d of list) {
    const txt = textOf(d);
    const div = document.createElement('div');
    div.className = 'item' + (d.id === curId ? ' cur' : '');
    const body = txt.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim();
    div.innerHTML = '<div class="t">' + (d.pinned ? '<span class="pin">★</span> ' : '') + esc(titleOf({ text: txt })) + '</div><div class="s">' + esc(fmtDate(d.updated)) + ' · ' + countWords(txt) + ' w · ' + esc(body.slice(0, 50)) + '</div>' +
      '<div class="acts"><button data-a="pin" title="' + (d.pinned ? 'Unpin' : 'Pin to top') + '">' + (d.pinned ? '★' : '☆') + '</button><button data-a="dup" title="Duplicate">⧉</button><button data-a="del" title="Move to Trash">🗑</button></div>';
    div.onclick = e => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'del') return deleteDoc(d.id);
      if (a === 'dup') return duplicateDoc(d.id);
      if (a === 'pin') { d.pinned = !d.pinned; persist(); return renderLibrary(); }
      openDoc(d.id);
      if (innerWidth <= 820) toggleSidebar(false);
    };
    el.appendChild(div);
  }
  if (trashed.length) {
    const tr = document.createElement('div'); tr.className = 'trashrow'; tr.textContent = '🗑 Trash (' + trashed.length + ')';
    tr.onclick = () => { showTrash = true; renderLibrary(); };
    el.appendChild(tr);
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
const LISTS = { lib: 'libList', outline: 'outlineList', links: 'linksList', insights: 'insightsList', history: 'historyList' };
function setTab(t) {
  tab = t;
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  for (const k in LISTS) $('#' + LISTS[k]).hidden = k !== t;
  refreshPanel();
}
let panelTimer;
function refreshPanel(delay) {
  clearTimeout(panelTimer);
  const go = () => {
    if (tab === 'outline') renderOutline(); else if (tab === 'history') renderHistory(); else if (tab === 'lib') renderLibrary();
    else if (tab === 'links') renderLinks(); else if (tab === 'insights') renderInsights();
  };
  if (delay) panelTimer = setTimeout(go, delay); else go();
}
function openDoc(id) {
  flush(); hidePop(); showTrash = false;
  curId = id; const d = docs[id];
  ed.value = d.text; lastWords = null; store.set('current', id);
  ed.setSelectionRange(0, 0);
  scroller.scrollTop = 0;
  render(); renderLibrary(); if (tab !== 'lib') refreshPanel(); updatePreview();
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
  const d = docs[id]; if (!d) return;
  if (id === curId) d.text = ed.value;
  d.trashed = Date.now(); delete handles[id];
  if (id === curId) {
    const next = liveDocs().sort((a, b) => b.updated - a.updated)[0];
    if (next) openDoc(next.id); else { newDoc('# '); ed.setSelectionRange(2, 2); }
  }
  persist(); renderLibrary(); toast('Moved to Trash');
}
function duplicateDoc(id) {
  newDoc(textOf(docs[id])); toast('Duplicated');
}

/* ───────── editing helpers ───────── */
function insertText(str) {
  ed.focus();
  if (str === '' && ed.selectionStart === ed.selectionEnd) return;
  let ok = false;
  try { ok = str === '' ? document.execCommand('delete') : document.execCommand('insertText', false, str); } catch (e) { }
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
  const codes = [], wikis = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = esc(s);
  s = s.replace(/\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g, (_, t, al) => { wikis.push('<a class="wiki' + (hasDoc(unesc(t)) ? '' : ' miss') + '" data-wiki="' + t.trim().replace(/"/g, '&quot;') + '" href="#wiki">' + (al || t) + '</a>'); return '\u0001' + (wikis.length - 1) + '\u0001'; });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, src, ti) => isVideoUrl(unesc(src)) ? '<span class="blocked">🚫 video blocked</span>' : '<img alt="' + alt + '" src="' + safeUrl(src) + '"' + (ti ? ' title="' + ti + '"' : '') + '>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, tx, href) => '<a href="' + safeUrl(href) + '" target="_blank" rel="noopener">' + tx + '</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => '<strong>' + (a || b) + '</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + esc(codes[i]) + '</code>');
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => wikis[i]);
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
const unwiki = h => h.replace(/<a class="wiki[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '<span>$1</span>');
const exportBody = () => unwiki(renderMarkdown(ed.value));
const fullHtml = () => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(titleOf({ text: ed.value })) + '</title><style>' + EXPORT_CSS + '</style></head><body>' + exportBody() + '</body></html>';
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
  doc: () => download(fileName('doc'), '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>' + esc(titleOf({ text: ed.value })) + '</title></head><body>' + exportBody() + '</body></html>', 'application/msword'),
  pdf: () => {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f); f.srcdoc = fullHtml();
    f.onload = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
  },
  copyhtml: async () => { try { const html = exportBody(); await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([ed.value], { type: 'text/plain' }) })]); toast('Copied rich text'); } catch (e) { toast('Copy not allowed here'); } },
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

/* ───────── popups: slash menu + [[wiki]] autocomplete ───────── */
const SLASH = [
  { label: 'Heading 1', k: 'h1 title', desc: '#', snip: '# $0' },
  { label: 'Heading 2', k: 'h2 section', desc: '##', snip: '## $0' },
  { label: 'Heading 3', k: 'h3', desc: '###', snip: '### $0' },
  { label: 'Bulleted list', k: 'ul bullets list', desc: '-', snip: '- $0' },
  { label: 'Numbered list', k: 'ol numbers list', desc: '1.', snip: '1. $0' },
  { label: 'Task', k: 'todo checkbox check', desc: '[ ]', snip: '- [ ] $0' },
  { label: 'Quote', k: 'blockquote cite', desc: '>', snip: '> $0' },
  { label: 'Callout', k: 'note tip warning', desc: '> Note', snip: '> **Note**\n> $0' },
  { label: 'Code block', k: 'code fence pre', desc: '```', snip: '```\n$0\n```' },
  { label: 'Table', k: 'grid columns', desc: '| a | b |', snip: '| Column | Column |\n| ------ | ------ |\n| $0 |  |' },
  { label: 'Divider', k: 'hr rule line separator', desc: '---', snip: '---\n$0' },
  { label: 'Link', k: 'url href', desc: '[text](url)', snip: '[$0](url)' },
  { label: 'Image', k: 'picture photo', desc: '![alt](url)', snip: '![$0](url)' },
  { label: 'Wiki link', k: 'note backlink', desc: '[[Note]]', snip: '[[$0]]' },
  { label: 'Today’s date', k: 'date today', desc: '', get snip() { return new Date().toLocaleDateString(undefined, { dateStyle: 'full' }) + '$0'; } },
  { label: 'Time', k: 'clock now', desc: '', get snip() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '$0'; } },
  { label: 'Table of contents', k: 'toc outline', desc: '', snip: '', run: () => insertTOC() }
];
const pop = { on: false, items: [], sel: 0, mode: '', q: '', from: 0 };
const cleanTitle = x => x.replace(/[\[\]|]/g, '').trim();
function inCode(t, p) {
  const before = t.slice(0, p);
  if ((before.match(/^\s*(```|~~~)/gm) || []).length % 2 === 1) return true;
  const ls = before.lastIndexOf('\n') + 1;
  return ((before.slice(ls).match(/`/g) || []).length % 2) === 1;
}
function hidePop() { pop.on = false; const el = $('#pop'); if (el) el.hidden = true; }
function drawPop() {
  const el = $('#pop');
  el.innerHTML = pop.items.map((it, i) => '<div class="pi' + (i === pop.sel ? ' on' : '') + '" data-i="' + i + '"><span>' + esc(it.label) + '</span><small>' + esc(it.desc || '') + '</small></div>').join('');
  el.hidden = false;
  const { x, y } = caretPos(), lh = parseFloat(getComputedStyle(bd).lineHeight) || 28, w = el.offsetWidth || 260;
  el.style.top = (y + lh + 4) + 'px';
  el.style.left = Math.max(0, Math.min(x, $('#column').clientWidth - w)) + 'px';
  const on = el.querySelector('.on');
  if (on) { if (on.offsetTop < el.scrollTop) el.scrollTop = on.offsetTop; else if (on.offsetTop + on.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTop = on.offsetTop + on.offsetHeight - el.clientHeight; }
}
function updatePop() {
  if (document.activeElement !== ed || ed.selectionStart !== ed.selectionEnd) return hidePop();
  const t = ed.value, p = ed.selectionStart, ls = t.lastIndexOf('\n', p - 1) + 1, before = t.slice(ls, p);
  let m, items = [], mode = '', q = '', from = 0;
  if ((m = before.match(/\[\[([^\]\n]*)$/))) {
    mode = 'wiki'; q = m[1]; from = p - q.length;
    const ql = q.toLowerCase();
    items = liveDocs().filter(d => d.id !== curId).map(d => ({ label: cleanTitle(titleOf({ text: d.text })), desc: fmtDate(d.updated) }))
      .filter(it => it.label && (!ql || it.label.toLowerCase().includes(ql))).slice(0, 8);
  } else if (!inCode(t, p) && (m = before.match(/(?:^|\s)\/([\w-]*)$/))) {
    mode = 'slash'; q = m[1]; from = p - q.length - 1;
    const ql = q.toLowerCase();
    items = SLASH.filter(it => !ql || it.label.toLowerCase().includes(ql) || it.k.includes(ql));
  }
  if (!items.length) return hidePop();
  if (!pop.on || pop.mode !== mode || pop.q !== q) pop.sel = 0;
  Object.assign(pop, { on: true, mode, q, from, items });
  drawPop();
}
function choosePop(i) {
  const it = pop.items[i]; if (!it) return;
  const t = ed.value, p = ed.selectionStart, mode = pop.mode, from = pop.from;
  hidePop();
  if (mode === 'wiki') {
    const end = t.slice(p, p + 2) === ']]' ? p + 2 : p;
    replaceRange(from, end, it.label + ']]', from + it.label.length + 2);
  } else if (it.run) {
    replaceRange(from, p, '', from); it.run();
  } else {
    const c = it.snip.indexOf('$0'), text = it.snip.replace('$0', '');
    replaceRange(from, p, text, from + (c < 0 ? text.length : c));
  }
  ed.focus(); updatePop();
}
function popKey(e) {
  if (!pop.on || e.isComposing) return false;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); pop.sel = (pop.sel + (e.key === 'ArrowDown' ? 1 : -1) + pop.items.length) % pop.items.length; drawPop(); return true; }
  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choosePop(pop.sel); return true; }
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hidePop(); return true; }
  return false;
}
$('#pop').addEventListener('mousedown', e => { e.preventDefault(); const it = e.target.closest('.pi'); if (it) choosePop(+it.dataset.i); });

/* ───────── wiki links ───────── */
const WIKI_RE = /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g;
function wikiAtCaret() {
  const t = ed.value, p = ed.selectionStart, [la, lb] = lineBounds(t, p), line = t.slice(la, lb), rel = p - la;
  const re = new RegExp(WIKI_RE.source, 'g'); let m;
  while ((m = re.exec(line))) if (rel >= m.index && rel <= m.index + m[0].length) return m[1].trim();
  return null;
}
function openWiki(title) {
  const k = norm(title), d = liveDocs().find(x => norm(titleOf({ text: textOf(x) })) === k);
  if (d) { if (d.id !== curId) openDoc(d.id); else toast('This is the note'); return; }
  newDoc('# ' + title + '\n\n'); ed.setSelectionRange(ed.value.length, ed.value.length); toast('Created “' + title + '”');
}
function ctrlEnter() {
  const w = wikiAtCaret(); if (w) return openWiki(w);
  const t = ed.value, p = ed.selectionStart, [la, lb] = lineBounds(t, p), line = t.slice(la, lb);
  const tm = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/);
  if (tm) { const i = la + tm[1].length + 1; replaceRange(i, i + 1, tm[2] === ' ' ? 'x' : ' ', p); return; }
  toast('Nothing to open or toggle here');
}
function renderLinks() {
  const el = $('#linksList'), txt = ed.value, key = norm(titleOf({ text: txt }));
  const back = [];
  for (const d of liveDocs()) {
    if (d.id === curId) continue;
    const re = new RegExp(WIKI_RE.source, 'g'); let m;
    while ((m = re.exec(d.text))) if (norm(m[1]) === key) { const [a, b] = lineBounds(d.text, m.index); back.push({ d, snip: d.text.slice(a, b).trim().slice(0, 90) }); break; }
  }
  const out = [], seen = new Set(); const re2 = new RegExp(WIKI_RE.source, 'g'); let m2;
  while ((m2 = re2.exec(txt))) { const k = norm(m2[1]); if (!seen.has(k) && k !== key) { seen.add(k); out.push(m2[1].trim()); } }
  let h = '<h4>Backlinks <span>' + back.length + '</span></h4>';
  h += back.length ? back.map(b => '<div class="item" data-doc="' + b.d.id + '"><div class="t">' + esc(titleOf(b.d)) + '</div><div class="s">' + esc(b.snip) + '</div></div>').join('') : '<div class="empty">No notes link here yet. Type <code>[[</code> in another note to link to this one.</div>';
  h += '<h4>Links in this note <span>' + out.length + '</span></h4>';
  h += out.length ? out.map(o => '<div class="item" data-wiki="' + attr(o) + '"><div class="t">' + esc(o) + (hasDoc(o) ? '' : ' <small>(new)</small>') + '</div></div>').join('') : '<div class="empty">Link notes together with <code>[[Note title]]</code>.</div>';
  el.innerHTML = h;
}
$('#linksList').addEventListener('click', e => {
  const it = e.target.closest('.item'); if (!it) return;
  if (it.dataset.doc) openDoc(it.dataset.doc); else if (it.dataset.wiki) openWiki(it.dataset.wiki);
});

/* ───────── insights ───────── */
const FILLER_PHRASES = ['very', 'really', 'just', 'quite', 'actually', 'basically', 'literally', 'simply', 'somewhat', 'rather', 'perhaps', 'maybe', 'probably', 'honestly', 'definitely', 'totally', 'extremely', 'fairly', 'clearly', 'obviously', 'certainly', 'essentially', 'virtually', 'a bit', 'a lot', 'kind of', 'sort of', 'in order to', 'i think', 'i guess', 'i believe', 'at the end of the day'];
function syllables(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g); return m ? m.length : 1;
}
function analyze(text) {
  const body = text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g, '$1').replace(/^[ \t]*(?:#{1,6}|>|[-*+]|\d+[.)])[ \t]+/gm, '')
    .replace(/^[ \t]*\|?[ \t:|-]+\|?[ \t]*$/gm, ' ').replace(/[*_~|]/g, ' ');
  const wre = /[\p{L}][\p{L}'’-]*/gu;
  const words = body.match(wre) || [];
  const sents = (body.match(/[^.!?\n]+[.!?]*/g) || []).map(x => x.trim()).filter(x => /\p{L}/u.test(x));
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const nW = words.length, nS = Math.max(1, sents.length), wps = nW / nS, spw = nW ? syl / nW : 0;
  const flesch = nW ? 206.835 - 1.015 * wps - 84.6 * spw : 0, grade = nW ? 0.39 * wps + 11.8 * spw - 15.59 : 0;
  const low = body.toLowerCase(), fillers = [];
  for (const f of FILLER_PHRASES) { const n = (low.match(new RegExp('\\b' + f + '\\b', 'g')) || []).length; if (n) fillers.push([f, n]); }
  fillers.sort((a, b) => b[1] - a[1]);
  const passive = (body.match(/\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?\w+(?:ed|en)\b/gi) || []).length;
  const adverbs = words.filter(w => w.length > 4 && /ly$/i.test(w) && !NOT_ADV.has(w.toLowerCase())).length;
  const longSents = sents.filter(x => (x.match(wre) || []).length > 28);
  const freq = {}; for (const w of words) { const l = w.toLowerCase(); if (l.length < 4 || STOP.has(l) || CONJ.has(l)) continue; freq[l] = (freq[l] || 0) + 1; }
  const repeated = Object.entries(freq).filter(e => e[1] > 2).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return { words: nW, sentences: sents.length, wps, flesch, grade, fillers, passive, adverbs, longSents, repeated };
}
function renderInsights() {
  const el = $('#insightsList'), hasSel = ed.selectionStart !== ed.selectionEnd;
  const r = analyze(hasSel ? ed.value.slice(ed.selectionStart, ed.selectionEnd) : ed.value);
  const f = r.flesch, lab = !r.words ? '–' : f >= 90 ? 'Very easy' : f >= 80 ? 'Easy' : f >= 70 ? 'Fairly easy' : f >= 60 ? 'Plain' : f >= 50 ? 'Fairly hard' : f >= 30 ? 'Difficult' : 'Very difficult';
  const weak = r.fillers.reduce((n, x) => n + x[1], 0);
  const card = (v, l) => '<div class="stat"><b>' + v + '</b><span>' + l + '</span></div>';
  let h = '<div class="scope">' + (hasSel ? 'Selection' : 'Whole document') + '</div><div class="stats">' +
    card(r.words ? Math.round(f) : '–', 'Reading ease · ' + lab) + card(r.words ? Math.max(0, r.grade).toFixed(1) : '–', 'Grade level') +
    card(r.words ? r.wps.toFixed(1) : '–', 'Words / sentence') + card(Math.max(1, Math.round(r.words / 130)) * (r.words ? 1 : 0) + ' min', 'Speaking time') +
    card(r.passive, 'Passive phrases') + card(r.adverbs, '-ly adverbs') + card(weak, 'Weak words') + card(r.longSents.length, 'Long sentences') + '</div>' +
    '<label class="chk"><input type="checkbox" id="fillToggle"' + (S.fillers ? ' checked' : '') + '> Highlight weak words in the editor</label>';
  if (r.longSents.length) h += '<h4>Long sentences <span>' + r.longSents.length + '</span></h4>' + r.longSents.slice(0, 8).map(x => '<div class="item" data-jump="' + attr(x.slice(0, 28)) + '"><div class="s">' + esc(x.slice(0, 110)) + '…</div></div>').join('');
  if (r.fillers.length) h += '<h4>Weak words</h4><div class="chips">' + r.fillers.slice(0, 12).map(x => '<span class="chip">' + esc(x[0]) + ' ×' + x[1] + '</span>').join('') + '</div>';
  if (r.repeated.length) h += '<h4>Repeated words</h4><div class="chips">' + r.repeated.map(x => '<span class="chip">' + esc(x[0]) + ' ×' + x[1] + '</span>').join('') + '</div>';
  el.innerHTML = h;
}
$('#insightsList').addEventListener('change', e => { if (e.target.id === 'fillToggle') { S.fillers = e.target.checked; saveSettings(); applySettings(); syncSettingsForm(); } });
$('#insightsList').addEventListener('click', e => {
  const it = e.target.closest('[data-jump]'); if (!it) return;
  const i = ed.value.indexOf(it.dataset.jump); if (i < 0) return toast('Could not locate that sentence');
  ed.focus(); ed.setSelectionRange(i, i + it.dataset.jump.length); ensureCaret(true); render();
});

/* ───────── typing helpers: auto-close, smart typography, move lines ───────── */
const PAIRS = { '(': ')', '[': ']', '{': '}', '`': '`', '"': '"' };
const OPENER_PREV = /[\s(\[{—–-]/;
function onChar(e) {
  if (e.isComposing || e.metaKey || e.key.length !== 1) return false;
  if (e.ctrlKey && !e.altKey) return false;
  if (e.altKey && !e.ctrlKey && !isMac) return false;
  const k = e.key, t = ed.value, a = ed.selectionStart, b = ed.selectionEnd;
  const prev = t[a - 1] || '', next = t[b] || '', sel = a !== b;
  const smart = S.smart && !inCode(t, a);
  const edge = !next || /[\s)\]}.,;:!?”’"'\-–—]/.test(next);
  if (sel) {
    if (!S.autopair) return false;
    const x = t.slice(a, b);
    const W2 = { '(': ['(', ')'], '[': ['[', ']'], '{': ['{', '}'], '`': ['`', '`'], '*': ['*', '*'], '_': ['_', '_'], '~': ['~~', '~~'], '"': smart ? ['“', '”'] : ['"', '"'] };
    if (W2[k] && !x.includes('\n')) { const [l, r] = W2[k]; replaceRange(a, b, l + x + r, a + l.length, a + l.length + x.length); return true; }
    return false;
  }
  if (S.autopair && next === k && ')]}`"'.includes(k)) { ed.setSelectionRange(a + 1, a + 1); return true; }
  if (S.autopair && smart && k === '"' && next === '”') { ed.setSelectionRange(a + 1, a + 1); return true; }
  const put = (x, caret) => { replaceRange(a, b, x, a + caret); return true; };
  if (k === '(' || k === '[' || k === '{') return (S.autopair && edge) ? put(k + PAIRS[k], 1) : false;
  if (k === '`') return (S.autopair && edge && prev !== '`') ? put('``', 1) : false;
  if (k === '"') {
    if (smart) return (!prev || OPENER_PREV.test(prev)) ? put(S.autopair && edge ? '“”' : '“', 1) : put('”', 1);
    return (S.autopair && edge && !/[\p{L}\p{N}]/u.test(prev)) ? put('""', 1) : false;
  }
  if (k === "'" && smart) return put((!prev || OPENER_PREV.test(prev) || prev === '“') ? '‘' : '’', 1);
  if (k === '-' && smart && prev === '-' && /[\p{L}\p{N}]\s?$/u.test(t.slice(0, a - 1))) { replaceRange(a - 1, a, '—', a); return true; }
  if (k === '.' && smart && t.slice(a - 2, a) === '..' && t[a - 3] !== '.') { replaceRange(a - 2, a, '…', a - 1); return true; }
  return false;
}
function onBackspace(e) {
  if (!S.autopair || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return false;
  const t = ed.value, a = ed.selectionStart; if (a !== ed.selectionEnd || a === 0) return false;
  const o = t[a - 1], c = t[a];
  if ((PAIRS[o] && PAIRS[o] === c) || (o === '“' && c === '”')) { e.preventDefault(); replaceRange(a - 1, a + 1, ''); return true; }
  return false;
}
function moveLines(dir) {
  const t = ed.value, a = ed.selectionStart, b = ed.selectionEnd;
  const [la] = lineBounds(t, a), [, lb] = lineBounds(t, b > a && t[b - 1] === '\n' ? b - 1 : b), block = t.slice(la, lb);
  if (dir < 0) {
    if (la === 0) return;
    const [pa, pb] = lineBounds(t, la - 1), prev = t.slice(pa, pb);
    replaceRange(pa, lb, block + '\n' + prev, a - prev.length - 1, b - prev.length - 1);
  } else {
    if (lb >= t.length) return;
    const [na, nb] = lineBounds(t, lb + 1), next = t.slice(na, nb);
    replaceRange(la, nb, next + '\n' + block, a + next.length + 1, b + next.length + 1);
  }
}
function duplicateLine() {
  const t = ed.value, a = ed.selectionStart, b = ed.selectionEnd, [la] = lineBounds(t, a), [, lb] = lineBounds(t, b), block = t.slice(la, lb);
  replaceRange(lb, lb, '\n' + block, b + block.length + 1);
}
function transformSel(fn) {
  const a = ed.selectionStart, b = ed.selectionEnd; if (a === b) return toast('Select some text first');
  const out = fn(ed.value.slice(a, b)); replaceRange(a, b, out, a, a + out.length);
}
const titleCase = x => x.toLowerCase().replace(/(^|[\s(\[“"-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
function insertTOC() {
  const lines = []; let fence = false;
  for (const l of ed.value.split('\n')) {
    if (FENCE.test(l)) { fence = !fence; continue; }
    const m = !fence && l.match(/^(#{2,6})\s+(.*)$/);
    if (m) lines.push('  '.repeat(m[1].length - 2) + '- [' + m[2].replace(/[\[\]]/g, '') + '](#' + slug(m[2]) + ')');
  }
  if (!lines.length) return toast('Add some ## headings first');
  insertText(lines.join('\n') + '\n');
}

/* ───────── templates ───────── */
const TEMPLATES = {
  'Journal entry': '# {{date}}\n\n## Gratitude\n\n- $0\n\n## Highlights\n\n\n\n## Tomorrow\n\n- [ ] \n',
  'Meeting notes': '# Meeting: $0\n\n**Date:** {{date}}  \n**Attendees:** \n\n## Agenda\n\n1. \n\n## Notes\n\n\n\n## Action items\n\n- [ ] \n',
  'Blog post': '# $0\n\n> One-sentence summary of the post.\n\n## Introduction\n\n\n\n## Main points\n\n\n\n## Conclusion\n\n',
  'Weekly review': '# Week of {{date}}\n\n## Wins\n\n- $0\n\n## What didn’t go well\n\n- \n\n## Lessons\n\n- \n\n## Next week\n\n- [ ] \n',
  'Project brief': '# $0\n\n## Goal\n\n\n\n## Audience\n\n\n\n## Scope\n\n- In:\n- Out:\n\n## Milestones\n\n- [ ] \n\n## Risks\n\n',
  'Letter': '{{date}}\n\nDear $0,\n\n\n\nKind regards,\n'
};
function fromTemplate(name) {
  const d = new Date();
  let txt = TEMPLATES[name].replace(/\{\{date\}\}/g, d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
  const c = txt.indexOf('$0'); txt = txt.replace('$0', '');
  newDoc(txt); const pos = c < 0 ? txt.length : c;
  ed.setSelectionRange(pos, pos); ensureCaret(false); render();
}

/* ───────── focus timer + read aloud ───────── */
let timer = null;
function startTimer(min, hard) {
  stopTimer(true);
  timer = { end: Date.now() + min * 60000, min, hard: !!hard, base: stats[today()] || 0 };
  timer.int = setInterval(tickTimer, 500); tickTimer(); toast((hard ? 'Sprint started: no deleting for ' : 'Focus timer started: ') + min + ' min');
}
function tickTimer() {
  if (!timer) return;
  const left = timer.end - Date.now(); if (left <= 0) return finishTimer();
  const sec = Math.ceil(left / 1000), el = $('#stTimer');
  el.hidden = false; el.textContent = (timer.hard ? '🔒 ' : '⏱ ') + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') + ' · +' + Math.max(0, (stats[today()] || 0) - timer.base);
}
function stopTimer(silent) { if (!timer) return; clearInterval(timer.int); timer = null; $('#stTimer').hidden = true; if (!silent) toast('Timer stopped'); }
function finishTimer() { const wrote = (stats[today()] || 0) - timer.base, min = timer.min; stopTimer(true); beep(); toast('⏱ ' + min + ' min done · ' + wrote + ' words written'); }
function beep() {
  try {
    const C = window.AudioContext || window.webkitAudioContext, c = new C(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.frequency.value = 660;
    g.gain.setValueAtTime(.001, c.currentTime); g.gain.exponentialRampToValueAtTime(.2, c.currentTime + .02); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .6);
    o.start(); o.stop(c.currentTime + .65);
  } catch (e) { }
}
$('#stTimer').onclick = () => stopTimer();
let speaking = false;
function readAloud() {
  if (!('speechSynthesis' in window)) return toast('Read aloud is not supported here');
  if (speaking || speechSynthesis.speaking) { speechSynthesis.cancel(); speaking = false; return toast('Stopped reading'); }
  const sel = ed.value.slice(ed.selectionStart, ed.selectionEnd), text = (sel || plainText()).replace(/\s+/g, ' ').trim();
  if (!text) return;
  const chunks = (text.match(/[^.!?]+[.!?]*\s*/g) || [text]).flatMap(c => c.length > 220 ? c.match(/.{1,220}(\s|$)/g) : [c]);
  speaking = true;
  chunks.forEach((c, i) => { const u = new SpeechSynthesisUtterance(c); if (i === chunks.length - 1) u.onend = () => { speaking = false; }; u.onerror = () => { speaking = false; }; speechSynthesis.speak(u); });
  toast('Reading aloud… run it again to stop');
}

/* ───────── backup, restore, zip ───────── */
function backupAll() {
  flush();
  download('Wren backup ' + today() + '.json', JSON.stringify({ app: 'wren', version: 2, exported: new Date().toISOString(), docs: Object.values(docs), stats }, null, 1), 'application/json');
  toast('Backup downloaded');
}
async function restoreBackup(file) {
  try {
    const data = JSON.parse(await file.text()), list = Array.isArray(data) ? data : (data.docs || []);
    let added = 0, copies = 0;
    for (const d of list) {
      if (!d || typeof d.text !== 'string') continue;
      const ex = d.id && docs[d.id];
      if (ex && ex.text === d.text) continue;
      const id = (!d.id || ex) ? uid() : d.id;
      docs[id] = { id, text: d.text, updated: d.updated || Date.now(), history: Array.isArray(d.history) ? d.history.slice(0, 25) : [], pinned: !!d.pinned };
      if (d.trashed) docs[id].trashed = d.trashed;
      if (ex) copies++; else added++;
    }
    if (data.stats) for (const k in data.stats) stats[k] = Math.max(stats[k] || 0, data.stats[k] | 0);
    store.set('stats', stats); persist(); renderLibrary();
    toast('Restored ' + added + ' new' + (copies ? ' and ' + copies + ' changed (kept as copies)' : '') + ' documents');
  } catch (e) { toast('That is not a valid Wren backup'); }
}
$('#restoreInput').onchange = e => { const f = e.target.files[0]; if (f) restoreBackup(f); e.target.value = ''; };
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) { c ^= u8[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return (c ^ 0xFFFFFFFF) >>> 0; }
function buildZip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
  const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, tm, true); lh.setUint16(12, dt, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, tm, true); ch.setUint16(14, dt, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((n, p) => n + p.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)], out = new Uint8Array(all.reduce((n, p) => n + p.length, 0)); let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}
function exportZip() {
  flush(); const used = new Set(), enc = new TextEncoder();
  const files = liveDocs().map(d => {
    const base = (titleOf({ text: textOf(d) }).replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60)) || 'Untitled'; let n = base, i = 2;
    while (used.has(n.toLowerCase())) n = base + ' (' + i++ + ')';
    used.add(n.toLowerCase()); return { name: n + '.md', data: enc.encode(textOf(d)) };
  });
  download('Wren documents.zip', buildZip(files), 'application/zip'); toast('Exported ' + files.length + ' documents');
}

const MORE_COMMANDS = [
  ['Quick open document…', mod_() + ' P', () => openPalette('doc')],
  ...Object.keys(TEMPLATES).map(n => ['New: ' + n, '', () => fromTemplate(n)]),
  ['Open link under cursor / toggle task', mod_() + ' ↩', ctrlEnter],
  ['Show backlinks', '', () => { toggleSidebar(true); setTab('links'); }],
  ['Show insights', '', () => { toggleSidebar(true); setTab('insights'); }],
  ['Toggle weak-word highlight (very, just…)', '', () => { S.fillers = !S.fillers; saveSettings(); applySettings(); syncSettingsForm(); }],
  ['Toggle smart typography', '', () => { S.smart = !S.smart; saveSettings(); syncSettingsForm(); toast('Smart typography ' + (S.smart ? 'on' : 'off')); }],
  ['Toggle auto-close brackets and quotes', '', () => { S.autopair = !S.autopair; saveSettings(); syncSettingsForm(); toast('Auto-close ' + (S.autopair ? 'on' : 'off')); }],
  ['Pin / unpin document', '', () => { const d = docs[curId]; d.pinned = !d.pinned; persist(); renderLibrary(); toast(d.pinned ? 'Pinned' : 'Unpinned'); }],
  ['Show Trash', '', () => { toggleSidebar(true); showTrash = true; setTab('lib'); }],
  ['Duplicate line', '', duplicateLine],
  ['Move line up', 'Alt ↑', () => moveLines(-1)], ['Move line down', 'Alt ↓', () => moveLines(1)],
  ['Insert table of contents', '', insertTOC],
  ['Selection: UPPERCASE', '', () => transformSel(x => x.toUpperCase())],
  ['Selection: lowercase', '', () => transformSel(x => x.toLowerCase())],
  ['Selection: Title Case', '', () => transformSel(titleCase)],
  ['Read aloud / stop', '', readAloud],
  ['Focus timer: 15 minutes', '', () => startTimer(15)], ['Focus timer: 25 minutes', '', () => startTimer(25)], ['Focus timer: 50 minutes', '', () => startTimer(50)],
  ['Stop timer', '', () => stopTimer()],
  ['Backup all documents (.json)', '', backupAll],
  ['Restore from backup…', '', () => $('#restoreInput').click()],
  ['Export all documents (.zip of Markdown)', '', exportZip]
];
function mod_() { return isMac ? '⌘' : 'Ctrl'; }

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
  ['Move document to Trash', '', () => deleteDoc(curId)],
  ['Reset all settings', '', () => { Object.assign(S, JSON.parse(JSON.stringify(defaults))); saveSettings(); applySettings(); syncSettingsForm(); }]
];
/* ───────── Wikipedia research pane + full screen ───────── */
const WLANGS = [['en', 'English'], ['simple', 'Simple English'], ['de', 'Deutsch'], ['fr', 'Français'], ['es', 'Español'], ['it', 'Italiano'], ['pt', 'Português'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['ru', 'Русский'], ['ja', '日本語'], ['zh', '中文'], ['ar', 'العربية']];
const R = { lang: store.get('wikilang', 'en'), cur: null, ctl: null, cache: new Map(), recent: store.get('wikirecent', []), q: '', src: store.get('ressrc', 'wiki') };
$('#resLang').innerHTML = WLANGS.map(([c, n]) => '<option value="' + c + '">' + n + '</option>').join('');
if (!WLANGS.some(l => l[0] === R.lang)) R.lang = 'en';
$('#resLang').value = R.lang;
function wapi(params) {
  const url = 'https://' + R.lang + '.wikipedia.org/w/api.php?' + new URLSearchParams(Object.assign({ format: 'json', formatversion: '2', origin: '*' }, params));
  if (R.cache.has(url)) return Promise.resolve(R.cache.get(url));
  if (R.ctl) R.ctl.abort(); R.ctl = new AbortController();
  return fetch(url, { signal: R.ctl.signal }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(j => { R.cache.set(url, j); return j; });
}
const resBody = () => $('#resBody');
function resError(e, retry) {
  if (e && e.name === 'AbortError') return;
  R.retry = retry; $('#resActions').hidden = true;
  resBody().innerHTML = '<div class="empty">Couldn’t reach Wikipedia. Check your connection.<br><br><button data-a="retry">Try again</button></div>';
}
function resHome() {
  R.cur = null; $('#resActions').hidden = true;
  if (R.src !== 'wiki') { resBody().innerHTML = '<div class="empty">' + (R.src === 'dict' ? 'Type a word to see its definitions.' : 'Type a word to find synonyms, opposites and rhymes. Click a result to swap it into your text.') + '</div>'; return; }
  resBody().innerHTML = '<div class="empty">Search Wikipedia without leaving your document. Select text in an article, then use <b>Quote selection</b> to insert it with its source.</div>' +
    (R.recent.length ? '<h4>Recent</h4>' + R.recent.map(t => '<div class="rr" data-t="' + attr(t) + '"><span class="ph"></span><div><b>' + esc(t) + '</b></div></div>').join('') : '');
}
async function resSearch(q, auto) {
  q = (q || '').trim(); R.q = q;
  if (!q) return resHome();
  if (R.src !== 'wiki') return resWord(q);
  R.cur = null; $('#resActions').hidden = true; resBody().innerHTML = '<div class="empty">Searching…</div>';
  try {
    const j = await wapi({ action: 'query', generator: 'search', gsrsearch: q, gsrlimit: 8, prop: 'description|pageimages', piprop: 'thumbnail', pithumbsize: 80 });
    const pages = (j.query && j.query.pages || []).slice().sort((a, b) => a.index - b.index);
    if (auto && pages.length) return resOpen(pages[0].title);
    resBody().innerHTML = pages.length ? pages.map(p => '<div class="rr" data-t="' + attr(p.title) + '">' + (p.thumbnail ? '<img src="' + attr(p.thumbnail.source) + '" alt="">' : '<span class="ph"></span>') + '<div><b>' + esc(p.title) + '</b><small>' + esc(p.description || '') + '</small></div></div>').join('') : '<div class="empty">No results for “' + esc(q) + '”.</div>';
  } catch (e) { resError(e, () => resSearch(q, auto)); }
}
async function resOpen(title) {
  resBody().innerHTML = '<div class="empty">Loading…</div>';
  try {
    const j = await wapi({ action: 'query', prop: 'extracts|pageimages|description|info', titles: title, redirects: 1, exintro: 1, explaintext: 1, inprop: 'url', piprop: 'thumbnail', pithumbsize: 420 });
    const p = j.query && j.query.pages && j.query.pages[0];
    if (!p || p.missing) { resBody().innerHTML = '<div class="empty">Article not found.</div>'; return; }
    R.cur = { title: p.title, url: p.fullurl || ('https://' + R.lang + '.wikipedia.org/wiki/' + encodeURIComponent(p.title.replace(/ /g, '_'))), intro: (p.extract || '').trim(), desc: p.description || '', thumb: p.thumbnail && p.thumbnail.source };
    R.recent = [p.title].concat(R.recent.filter(t => t !== p.title)).slice(0, 12); store.set('wikirecent', R.recent);
    const c = R.cur;
    resBody().innerHTML = '<button class="rback" data-a="back">← ' + (R.q ? 'Results' : 'Back') + '</button><h2>' + esc(c.title) + '</h2>' + (c.desc ? '<div class="rdesc">' + esc(c.desc) + '</div>' : '') +
      (c.thumb ? '<img class="rimg" src="' + attr(c.thumb) + '" alt="">' : '') + '<div class="rtext">' + paras(c.intro) + '</div><button class="rfull" data-a="full">Read full article</button>';
    $('#resActions').hidden = false; resBody().scrollTop = 0;
  } catch (e) { resError(e, () => resOpen(title)); }
}
const paras = t => t.split(/\n+/).filter(Boolean).map(x => '<p>' + esc(x) + '</p>').join('');
async function resFull() {
  if (!R.cur) return;
  const btn = resBody().querySelector('.rfull'); if (btn) btn.textContent = 'Loading…';
  try {
    const j = await wapi({ action: 'query', prop: 'extracts', titles: R.cur.title, redirects: 1, explaintext: 1 });
    const text = (j.query.pages[0].extract || ''), skip = /^(see also|references|external links|further reading|notes|bibliography|sources|citations|footnotes)$/i;
    let html = '', skipLevel = 0;
    for (const line of text.split('\n')) {
      const m = line.match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
      if (m) { const lv = m[1].length; if (skipLevel && lv > skipLevel) continue; skipLevel = skip.test(m[2]) ? lv : 0; if (!skipLevel) html += '<h3>' + esc(m[2]) + '</h3>'; continue; }
      if (!skipLevel && line.trim()) html += '<p>' + esc(line) + '</p>';
    }
    const rt = resBody().querySelector('.rtext'); if (rt) rt.innerHTML = html || paras(R.cur.intro);
    if (btn) btn.remove(); resBody().scrollTop = 0;
  } catch (e) { resError(e, resFull); }
}
function resSelection() {
  const s = window.getSelection ? window.getSelection() : null;
  return (s && !s.isCollapsed && resBody().contains(s.anchorNode)) ? s.toString().trim() : '';
}
function insertBlock(md) {
  const t = ed.value, a = ed.selectionStart;
  const pre = a > 0 && t[a - 1] !== '\n' ? '\n\n' : (a > 1 && t[a - 2] !== '\n' ? '\n' : '');
  insertText(pre + md + '\n\n');
}
function resAct(act) {
  const c = R.cur; if (!c) return;
  const src = '— [' + c.title + '](' + c.url + '), Wikipedia';
  const quote = x => x.split(/\n+/).map(l => '> ' + l).join('\n>\n') + '\n>\n> ' + src;
  if (act === 'quote') { const s = resSelection(); if (!s) return toast('Select some text in the article first'); insertBlock(quote(s)); }
  else if (act === 'summary') insertBlock(quote(c.intro.split(/\n+/).slice(0, 2).join('\n')));
  else if (act === 'link') insertText('[' + c.title + '](' + c.url + ')');
  else if (act === 'cite') insertText('Wikipedia contributors. “' + c.title + '.” Wikipedia, The Free Encyclopedia. Accessed ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '. ' + c.url);
  ed.focus(); toast('Inserted');
}
function openResearch(q, src) {
  if (src) setSrc(src, true);
  $('#research').hidden = false; $('#researchBtn').style.background = 'var(--panel)';
  if (typeof q === 'string' && q.trim()) { $('#resInput').value = q.trim(); resSearch(q, R.src === 'wiki'); }
  else if (!resBody().innerHTML.trim()) resHome();
  $('#resInput').focus(); $('#resInput').select();
}
function closeResearch() { $('#research').hidden = true; $('#researchBtn').style.background = ''; ed.focus(); }
function toggleResearch() { if ($('#research').hidden) openResearch(); else closeResearch(); }
function lookupSelection(src) {
  let q = ed.value.slice(ed.selectionStart, ed.selectionEnd).trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!q) { const t = ed.value, p = ed.selectionStart; let a = p, b = p; while (a > 0 && /[\p{L}\p{N}'’-]/u.test(t[a - 1])) a--; while (b < t.length && /[\p{L}\p{N}'’-]/u.test(t[b])) b++; q = t.slice(a, b); }
  openResearch(q, typeof src === 'string' ? src : undefined);
}
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else if (el.requestFullscreen || el.webkitRequestFullscreen) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    else toast('Full screen is not available here');
  } catch (e) { toast('Full screen is not available here'); }
}
let resTimer;
$('#resInput').addEventListener('input', () => { clearTimeout(resTimer); resTimer = setTimeout(() => resSearch($('#resInput').value), 350); });
$('#resInput').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(resTimer); resSearch($('#resInput').value); } else if (e.key === 'Escape') { e.stopPropagation(); closeResearch(); } });
$('#resLang').addEventListener('change', e => { R.lang = e.target.value; store.set('wikilang', R.lang); if (R.cur) resOpen(R.cur.title); else resSearch($('#resInput').value); });
$('#resClose').onclick = closeResearch; $('#researchBtn').onclick = toggleResearch; $('#fsBtn').onclick = toggleFullscreen;
$('#resActions').addEventListener('mousedown', e => e.preventDefault());
$('#resActions').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) resAct(b.dataset.act); });
resBody().addEventListener('click', e => {
  const cw = e.target.closest('.chip.w'); if (cw) return useWord(cw.dataset.w);
  const rr = e.target.closest('.rr'); if (rr) return resOpen(rr.dataset.t);
  const a = e.target.closest('[data-a]'); if (!a) return;
  if (a.dataset.a === 'back') { if (R.q) resSearch(R.q); else resHome(); } else if (a.dataset.a === 'full') resFull(); else if (a.dataset.a === 'retry' && R.retry) R.retry();
});
const RESEARCH_COMMANDS = [
  ['Research on Wikipedia', mod_() + ' ⇧ L', () => toggleResearch()],
  ['Look up selection / word on Wikipedia', mod_() + ' ⇧ L', lookupSelection],
  ['Wikipedia: insert summary of open article', '', () => resAct('summary')],
  ['Wikipedia: insert link to open article', '', () => resAct('link')],
  ['Wikipedia: insert citation', '', () => resAct('cite')],
  ['Toggle full screen', mod_() + ' ⇧ ↩', toggleFullscreen],
  ['Full screen + Zen mode', '', () => { toggleFullscreen(); if (!document.body.classList.contains('zen')) toggleZen(); }]
];

/* ───────── video blocking ───────── */
const VIDEO_RE = /(\.(mp4|m4v|mov|webm|ogv|avi|mkv|mpe?g|m3u8)([?#]|$))|((^|\/\/)(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|twitch\.tv|dailymotion\.com)\/)/i;
const isVideoUrl = u => VIDEO_RE.test((u || '').trim());

/* ───────── music: Spotify embed only (audio, never video) ───────── */
const M_PRESETS = [['Deep Focus', 'playlist', '37i9dQZF1DWZeKCadgRdKQ'], ['Peaceful Piano', 'playlist', '37i9dQZF1DX4sWSpwq3LiO'], ['lofi beats', 'playlist', '37i9dQZF1DWWQRwui0ExPn'], ['Brain Food', 'playlist', '37i9dQZF1DWXLeA8Omikj7'], ['Instrumental Study', 'playlist', '37i9dQZF1DX9sIqqvKsjG8']];
const M = { cur: store.get('music', null), big: false };
function parseMusic(u) {
  u = (u || '').trim();
  if (!u) return { err: 'Paste a Spotify link first.' };
  if (/(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|twitch\.tv|netflix\.com|dailymotion\.com)/i.test(u)) return { err: 'Video sites are blocked. Wren only plays music from Spotify.' };
  let m = u.match(/^spotify:(track|album|playlist|artist):([A-Za-z0-9]{22})$/);
  if (!m) m = u.match(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist)\/([A-Za-z0-9]{22})(?:[?#].*)?$/);
  if (m) return { type: m[1], id: m[2] };
  if (/spotify/i.test(u) && /(episode|show)/i.test(u)) return { err: 'Podcasts and shows are blocked because they can include video. Use a track, album, playlist or artist link.' };
  return { err: 'That doesn’t look like a Spotify track, album, playlist or artist link.' };
}
function playMusic(type, id) {
  const h = (type === 'track' || !M.big) ? 152 : 352;
  $('#muFrame').innerHTML = '<iframe title="Spotify player" src="https://open.spotify.com/embed/' + type + '/' + id + '?utm_source=generator" width="100%" height="' + h + '" frameborder="0" allow="autoplay; encrypted-media" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  M.cur = { type, id }; store.set('music', M.cur); $('#muMsg').textContent = '';
}
function openMusic() {
  $('#music').hidden = false; $('#musicBtn').style.background = 'var(--panel)';
  if (!$('#muPresets').children.length) $('#muPresets').innerHTML = M_PRESETS.map(p => '<button class="chip" data-t="' + p[1] + '" data-id="' + p[2] + '">' + esc(p[0]) + '</button>').join('');
  if (M.cur && !$('#muFrame').children.length) playMusic(M.cur.type, M.cur.id);
}
function closeMusic() { $('#muFrame').innerHTML = ''; $('#music').hidden = true; $('#musicBtn').style.background = ''; ed.focus(); }
function toggleMusic() { if ($('#music').hidden) openMusic(); else closeMusic(); }
function submitMusic() {
  const r = parseMusic($('#muInput').value);
  if (r.err) { $('#muMsg').textContent = r.err; return false; }
  playMusic(r.type, r.id); $('#muInput').value = ''; return true;
}
$('#musicBtn').onclick = toggleMusic; $('#muClose').onclick = closeMusic; $('#muGo').onclick = submitMusic;
$('#muInput').addEventListener('keydown', e => { if (e.key === 'Enter') submitMusic(); else if (e.key === 'Escape') { e.stopPropagation(); ed.focus(); } });
$('#muPresets').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) playMusic(b.dataset.t, b.dataset.id); });
$('#muSize').onclick = () => { M.big = !M.big; const f = $('#muFrame iframe'); if (f && M.cur && M.cur.type !== 'track') f.height = M.big ? 352 : 152; };

/* ───────── dictionary + thesaurus (research pane sources) ───────── */
async function jget(url) {
  if (R.cache.has(url)) return R.cache.get(url);
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json(); R.cache.set(url, j); return j;
}
R.tok = 0;
async function resWord(q) {
  const tok = ++R.tok; R.cur = null; $('#resActions').hidden = true;
  resBody().innerHTML = '<div class="empty">Looking up…</div>';
  const enc = encodeURIComponent(q);
  try {
    let html;
    if (R.src === 'dict') {
      const j = await jget('https://api.dictionaryapi.dev/v2/entries/en/' + enc);
      if (tok !== R.tok) return;
      if (!Array.isArray(j) || !j.length) html = '<div class="empty">No definition found for “' + esc(q) + '”.</div>';
      else {
        html = '<h2>' + esc(j[0].word) + '</h2>' + (j[0].phonetic ? '<div class="rdesc">' + esc(j[0].phonetic) + '</div>' : '');
        for (const m of j.flatMap(x => x.meanings || []).slice(0, 6)) html += '<h3>' + esc(m.partOfSpeech) + '</h3><ol>' + (m.definitions || []).slice(0, 3).map(d => '<li>' + esc(d.definition) + (d.example ? '<div class="ex">“' + esc(d.example) + '”</div>' : '') + '</li>').join('') + '</ol>';
      }
    } else {
      const base = 'https://api.datamuse.com/words?max=24&';
      const [syn, ml, ant, rhy] = await Promise.all([jget(base + 'rel_syn=' + enc), jget(base + 'ml=' + enc), jget(base + 'rel_ant=' + enc), jget(base + 'rel_rhy=' + enc)]);
      if (tok !== R.tok) return;
      const seen = new Set((syn || []).map(x => x.word)), sim = (ml || []).filter(x => !seen.has(x.word));
      const grp = (t, a) => (a && a.length) ? '<h4>' + t + '</h4><div class="chips">' + a.map(x => '<span class="chip w" data-w="' + attr(x.word) + '">' + esc(x.word) + '</span>').join('') + '</div>' : '';
      html = '<h2>' + esc(q) + '</h2><div class="rdesc">Click a word to replace your selection (or insert it at the cursor).</div>' + grp('Synonyms', syn) + grp('Similar meaning', sim) + grp('Opposites', ant) + grp('Rhymes', rhy);
      if (!(syn || []).length && !sim.length && !(ant || []).length && !(rhy || []).length) html = '<div class="empty">No results for “' + esc(q) + '”.</div>';
    }
    resBody().innerHTML = html;
  } catch (e) { if (tok === R.tok) resError(e, () => resWord(q)); }
}
function useWord(w) {
  const had = ed.selectionStart !== ed.selectionEnd;
  replaceRange(ed.selectionStart, ed.selectionEnd, w); ed.focus(); toast((had ? 'Replaced with “' : 'Inserted “') + w + '”');
}
function setSrc(v, noSearch) {
  R.src = v; store.set('ressrc', v); $('#resSrc').value = v; $('#resLang').hidden = v !== 'wiki';
  $('#resInput').placeholder = v === 'wiki' ? 'Search Wikipedia…' : v === 'dict' ? 'Look up a word…' : 'Synonyms, opposites, rhymes…';
  if (R.ctl) R.ctl.abort(); R.tok++;
  if (!noSearch) { const q = $('#resInput').value.trim(); if (q) resSearch(q); else resHome(); }
}
$('#resSrc').addEventListener('change', e => setSrc(e.target.value));
setSrc(['wiki', 'dict', 'syn'].includes(R.src) ? R.src : 'wiki', true);

/* ───────── writing stats ───────── */
function showStats() {
  flush();
  let el = $('#statsModal');
  if (!el) {
    el = document.createElement('div'); el.id = 'statsModal'; el.className = 'overlay';
    el.innerHTML = '<div class="card set"><div class="set-head"><h2>Writing stats</h2><button class="icon" id="stClose" aria-label="Close stats">✕</button></div><div id="stBody"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('mousedown', e => { if (e.target === el) { el.hidden = true; ed.focus(); } });
    el.querySelector('#stClose').onclick = () => { el.hidden = true; ed.focus(); };
  }
  const keys = Object.keys(stats).filter(k => stats[k] > 0).sort(), DAY = 864e5;
  const total = keys.reduce((n, k) => n + stats[k], 0), best = keys.reduce((b, k) => stats[k] > (stats[b] || 0) ? k : b, '');
  let longest = 0, run = 0, prev = null;
  for (const k of keys) { const t = Date.parse(k + 'T00:00:00Z'); run = (prev !== null && t - prev === DAY) ? run + 1 : 1; longest = Math.max(longest, run); prev = t; }
  let cur = 0, t = Date.parse(today() + 'T00:00:00Z'); if (!(stats[today()] > 0)) t -= DAY;
  while (stats[new Date(t).toISOString().slice(0, 10)] > 0) { cur++; t -= DAY; }
  const end = Date.parse(today() + 'T00:00:00Z'), dow = (new Date(end).getUTCDay() + 6) % 7, n = 25 * 7 + dow + 1;
  const max = Math.max(1, ...Object.values(stats).map(Number)); let cells = '';
  for (let i = 0; i < n; i++) { const k = new Date(end - (n - 1 - i) * DAY).toISOString().slice(0, 10), v = stats[k] || 0; cells += '<i class="hm l' + (v ? Math.min(4, Math.ceil(4 * v / max)) : 0) + '" title="' + k + ': ' + v + ' words"></i>'; }
  const inNotes = liveDocs().reduce((s, d) => s + countWords(textOf(d)), 0);
  const card = (v, l) => '<div class="stat"><b>' + v + '</b><span>' + l + '</span></div>';
  $('#stBody').innerHTML = '<div class="stats">' + card((stats[today()] || 0).toLocaleString(), 'Words today') + card(cur + ' day' + (cur === 1 ? '' : 's'), 'Current streak') + card(longest + ' day' + (longest === 1 ? '' : 's'), 'Longest streak') + card(best ? stats[best].toLocaleString() : '–', 'Best day' + (best ? ' · ' + best : '')) + card(total.toLocaleString(), 'Words written (tracked)') + card(inNotes.toLocaleString(), 'Words in your notes') + '</div><h4 class="hmh">Last 26 weeks</h4><div class="heat">' + cells + '</div><p class="note">Only words you add while typing are counted; deleting never lowers a day.</p>';
  el.hidden = false;
}

const EXTRA_COMMANDS = [
  ['Music: open Spotify player', '', openMusic],
  ...M_PRESETS.map(p => ['Music: ' + p[0], '', () => { openMusic(); playMusic(p[1], p[2]); }]),
  ['Music: stop and close', '', closeMusic],
  ['Define selection (dictionary)', '', () => lookupSelection('dict')],
  ['Synonyms for selection (thesaurus)', '', () => lookupSelection('syn')],
  ['Sprint (no deleting): 10 minutes', '', () => startTimer(10, true)],
  ['Sprint (no deleting): 20 minutes', '', () => startTimer(20, true)],
  ['Sprint (no deleting): 30 minutes', '', () => startTimer(30, true)],
  ['Writing stats', '', showStats]
];

COMMANDS.push(...MORE_COMMANDS, ...RESEARCH_COMMANDS, ...EXTRA_COMMANDS);
let palSel = 0, palItems = [], palMode = 'cmd';
function openPalette(mode, prefill) {
  palMode = mode === 'doc' ? 'doc' : 'cmd'; palSel = 0;
  $('#palette').hidden = false;
  $('#palInput').value = typeof prefill === 'string' ? prefill : '';
  $('#palInput').placeholder = palMode === 'doc' ? 'Jump to a document…' : 'Type a command…';
  renderPalette(); $('#palInput').focus();
}
function closePalette() { $('#palette').hidden = true; ed.focus(); }
function renderPalette() {
  const q = $('#palInput').value.toLowerCase().trim();
  if (palMode === 'doc') {
    palItems = liveDocs().map(d => { const txt = textOf(d); return { title: titleOf({ text: txt }), txt, d }; })
      .filter(x => !q || x.title.toLowerCase().includes(q) || x.txt.toLowerCase().includes(q))
      .sort((a, b) => (b.title.toLowerCase().includes(q) - a.title.toLowerCase().includes(q)) || b.d.updated - a.d.updated)
      .slice(0, 50)
      .map(x => [x.title, fmtDate(x.d.updated) + ' · ' + countWords(x.txt) + ' w', () => openDoc(x.d.id)]);
  } else palItems = COMMANDS.filter(c => !q || c[0].toLowerCase().includes(q));
  if (palSel >= palItems.length) palSel = 0;
  $('#palList').innerHTML = palItems.map((c, i) => '<div class="cmd' + (i === palSel ? ' on' : '') + '" data-i="' + i + '"><span>' + esc(c[0]) + '</span><kbd>' + esc(c[1]) + '</kbd></div>').join('') || '<div class="empty">' + (palMode === 'doc' ? 'No matching document' : 'No matching command') + '</div>';
  $('#palList .on')?.scrollIntoView?.({ block: 'nearest' });
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
  render(); scheduleSave(); updatePreview(); ensureCaret(false); updatePop();
  if (tab !== 'lib') refreshPanel(250);
});
ed.addEventListener('keydown', e => {
  document.body.classList.add('typing');
  if (popKey(e)) return;
  if (timer && timer.hard && (e.key === 'Backspace' || e.key === 'Delete' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z'))) { e.preventDefault(); toast('Sprint: no deleting until the timer ends'); return; }
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key === 'Enter') { e.preventDefault(); ctrlEnter(); return; }
  if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveLines(e.key === 'ArrowUp' ? -1 : 1); return; }
  if (e.key === 'Backspace') { if (onBackspace(e)) return; }
  else if (e.key === 'Enter' && !(e.metaKey || e.ctrlKey || e.altKey)) onEnter(e);
  else if (e.key === 'Tab' && !(e.metaKey || e.ctrlKey || e.altKey)) onTab(e);
  else if (onChar(e)) e.preventDefault();
});
ed.addEventListener('click', e => { if (e.metaKey || e.ctrlKey) { const t = wikiAtCaret(); if (t) { e.preventDefault(); openWiki(t); } } });
let selTimer;
document.addEventListener('selectionchange', () => {
  if (document.activeElement !== ed) return;
  cancelAnimationFrame(selTimer);
  selTimer = requestAnimationFrame(() => { updatePop(); if (S.focus !== 'off') renderNow(); else updateStatus(); if (!document.body.classList.contains('typing') || S.typewriter) ensureCaret(true); });
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
ed.addEventListener('blur', () => { flush(); hidePop(); });
addEventListener('beforeunload', flush);
addEventListener('pagehide', flush);
addEventListener('resize', () => { render(); });
scroller.addEventListener('mousedown', e => { if (e.target === scroller || e.target.id === 'column') { ed.focus(); const l = ed.value.length; if (e.offsetY > inner.offsetTop) ed.setSelectionRange(l, l); } });
$('#preview').addEventListener('click', e => {
  const w = e.target.closest('a.wiki'); if (w) { e.preventDefault(); openWiki(w.dataset.wiki); return; }
  const a = e.target.closest('a[href^="#"]');
  if (a) { e.preventDefault(); const id = a.getAttribute('href').slice(1); try { $('#preview').querySelector('[id="' + id.replace(/"/g, '') + '"]')?.scrollIntoView(); } catch (_) { } }
});

document.addEventListener('keydown', e => {
  const m = e.metaKey || e.ctrlKey; const k = e.key.toLowerCase();
  if (e.key === 'Escape') {
    if (!$('#palette').hidden) return closePalette();
    if (!$('#settings').hidden) return closeSettings();
    if (!$('#exportMenu').hidden) { $('#exportMenu').hidden = true; return; }
    if (!$('#findbar').hidden) return toggleFind(false);
    if (!$('#research').hidden) return closeResearch();
    if (document.body.classList.contains('zen')) return toggleZen();
  }
  if (!m) return;
  if (e.ctrlKey && e.altKey) return; // AltGr on Windows/Linux sends Ctrl+Alt for characters such as \ [ { @
  const run = fn => { e.preventDefault(); fn(); };
  if (k === 'k' && !e.shiftKey) run(openPalette);
  else if (k === 'k' && e.shiftKey) run(insertLink);
  else if (k === 'b' && !e.shiftKey) run(() => wrap('**'));
  else if (k === 'i' && !e.shiftKey) run(() => wrap('*'));
  else if (k === 'p' && e.shiftKey) run(() => togglePreview());
  else if (k === 'p') run(() => openPalette('doc'));
  else if (k === 'l' && e.shiftKey) run(lookupSelection);
  else if (k === 'enter' && e.shiftKey) run(toggleFullscreen);
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
$('#paletteBtn').onclick = () => openPalette();
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
window.wren = { newDoc, saveFile, openFromDisk, togglePreview, cycleFocus, toggleZen, openPalette, openSettings, exports: EXPORTS, importFiles, backupAll, exportZip, readAloud, startTimer, stopTimer, _t: { analyze, buildZip, openWiki, fromTemplate, parseMusic, playMusic, isVideoUrl, showStats, setSrc } };

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
