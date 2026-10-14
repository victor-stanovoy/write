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
  theme: 'auto', accent: '#0a84ff', font: 'mono', size: 18, lh: 1.7, width: 680,
  focus: 'off', typewriter: true, spell: false, dailyGoal: 500, sidebar: true, preview: false,
  smart: true, autopair: true, fillers: false, style: false, pvTheme: 'standard',
  pos: { noun: false, verb: false, adj: false, adv: false, conj: false }
};
const S = Object.assign({}, defaults, store.get('settings', {}));
S.pos = Object.assign({}, defaults.pos, S.pos || {});
if (S.accent === '#10a5c8') S.accent = defaults.accent;
const THEMES = [["light", "Light", "#ffffff", "#1d1d1f", 0], ["paper", "Paper", "#fbf9f4", "#2a2622", 0], ["sepia", "Sepia", "#f4ecd8", "#433422", 0], ["rose", "Rose", "#fff8f8", "#3b2226", 0], ["lavender", "Lavender", "#faf8ff", "#26223a", 0], ["mint", "Mint", "#f5faf7", "#1f2d24", 0], ["solar", "Solar", "#fdf6e3", "#586e75", 0], ["dark", "Dark", "#1c1c1e", "#f2f2f7", 1], ["graphite", "Graphite", "#26272b", "#e4e4e8", 1], ["midnight", "Midnight", "#0e1524", "#dbe4f5", 1], ["nord", "Nord", "#2e3440", "#e5e9f0", 1], ["plum", "Plum", "#1e1a2b", "#e9e4f7", 1], ["ink", "Ink", "#000000", "#f5f5f7", 1]];
const FONTS = {
  mono: 'ui-monospace,"SF Mono","JetBrains Mono","IBM Plex Mono",Menlo,Consolas,"Liberation Mono",monospace',
  courier: '"Courier Prime","Courier New",Courier,monospace',
  menlo: 'Menlo,Monaco,Consolas,"DejaVu Sans Mono",monospace',
  jetbrains: '"JetBrains Mono","Fira Code","Fira Mono","Source Code Pro",monospace',
  serif: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif',
  sans: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Helvetica,Arial,sans-serif'
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
const countWords = t => (t.replace(/^\s*\/\/.*$/gm, '').replace(/<\/?(?:span|mark)[^>]*>/g, '').replace(/\]\(img:[A-Za-z0-9]+\)/g, '])').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;

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
let posWrap = function (text) {
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
};

/* ───────── markdown highlighting (editor backdrop) ───────── */
const INL = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_|`[^`\n]+`|!?\[[^\]\n]*\]\([^)\n]*\)|\[\[[^\]\n]+\]\]|~~[^~\n]+~~|<\/?(?:span|mark)(?: style="[^"\n]*")?>|(?<![\w&#\/="'])#[A-Za-z\u00C0-\u024F][\w\/-]*|https?:\/\/[^\s)]+)/g;
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
    else if (t[0] === '#') out += '<span class="tg">' + esc(t) + '</span>';
    else if (t[0] === '<') out += '<span class="mk">' + esc(t) + '</span>';
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
  if (atStart && /^\s*\/\/(\s|$)/.test(l)) return '<span class="cmt">' + esc(l) + '</span>';
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
  const list = liveDocs().filter(d => matchDoc(d, q)).sort((a, b) => (!!b.pinned - !!a.pinned) || b.updated - a.updated);
  el.appendChild(libBar(q));
  if (!list.length) el.insertAdjacentHTML('beforeend', '<div class="empty">No documents found.</div>');
  for (const d of list) {
    const txt = textOf(d);
    const div = document.createElement('div');
    div.className = 'item' + (d.id === curId ? ' cur' : '');
    const body = txt.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim();
    div.innerHTML = '<div class="t">' + (d.pinned ? '<span class="pin">★</span> ' : '') + esc(titleOf({ text: txt })) + '</div><div class="s">' + esc(fmtDate(d.updated)) + ' · ' + countWords(txt) + ' w · ' + esc(snip(body, q)) + '</div>' +
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
  const el = $('#outlineList'); el.innerHTML = '<button class="wide" id="cardsBtn">▦ Rearrange sections</button>';
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
  if (!found) el.insertAdjacentHTML('beforeend', '<div class="empty">Add headings with # to build an outline.</div>');
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
  { const c = $('#column'); c.classList.remove('swap'); void c.offsetWidth; c.classList.add('swap'); }
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
  const codes = [], wikis = [], tags = [];
  s = s.replace(/\\([\\`*_{}\[\]()#+\-.!~<>|])/g, (_, c) => '\u0002' + c.charCodeAt(0) + '\u0002');
  s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c.replace(/\u0002(\d+)\u0002/g, (_, n) => '\\' + String.fromCharCode(+n))); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = s.replace(/<span style="color:(#[0-9a-fA-F]{3,8})">/g, (_, c) => { tags.push('<span style="color:' + c + '">'); return '\u0003' + (tags.length - 1) + '\u0003'; })
    .replace(/<mark style="background:(#[0-9a-fA-F]{3,8})">/g, (_, c) => { tags.push('<mark style="background:' + c + '">'); return '\u0003' + (tags.length - 1) + '\u0003'; })
    .replace(/<\/(span|mark)>/g, (_, t) => { tags.push('</' + t + '>'); return '\u0003' + (tags.length - 1) + '\u0003'; });
  s = esc(s);
  s = s.replace(/\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g, (_, t, al) => { wikis.push('<a class="wiki' + (hasDoc(unesc(t)) ? '' : ' miss') + '" data-wiki="' + t.trim().replace(/"/g, '&quot;') + '" href="#wiki">' + (al || t) + '</a>'); return '\u0001' + (wikis.length - 1) + '\u0001'; });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, src, ti) => isVideoUrl(unesc(src)) ? '<span class="blocked">🚫 video blocked</span>' : '<img alt="' + alt + '" src="' + (/^img:/.test(src) ? (imgData(src.slice(4)) || '') : safeUrl(src)) + '"' + (ti ? ' title="' + ti + '"' : '') + '>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, tx, href) => '<a href="' + safeUrl(href) + '" target="_blank" rel="noopener">' + tx + '</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => '<strong>' + (a || b) + '</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + esc(codes[i]) + '</code>');
  s = s.replace(/(^|[\s(>])#([A-Za-z\u00C0-\u024F][\w\/-]*)/g, (_, p, t) => p + '<a class="tag" href="#tag" data-tag="' + t.toLowerCase() + '">#' + t + '</a>');
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => wikis[i]);
  s = s.replace(/\u0003(\d+)\u0003/g, (_, i) => tags[i]);
  s = s.replace(/\u0002(\d+)\u0002/g, (_, c) => esc(String.fromCharCode(+c)));
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
function renderMarkdown(src, depth = 0) {
  const lines = src.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const out = []; let i = 0;
  const isCmt = l => /^\s*\/\/(\s|$)/.test(l);
  const isBlockStart = l => isCmt(l) || /^\s*!\[\[[^\]\n]+\]\]\s*$/.test(l) || /^(#{1,6}\s|\s*>|\s*```|\s*~~~|\s*([-*_])(\s*\2){2,}\s*$|\s*([-*+]|\d+[.)])\s)/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim() || isCmt(l)) { i++; continue; }
    let m;
    if ((m = l.match(/^\s*!\[\[([^\]\n]+)\]\]\s*$/))) { out.push(renderEmbed(m[1].trim(), depth)); i++; continue; }
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
      out.push('<blockquote>' + renderMarkdown(buf.join('\n'), depth) + '</blockquote>'); continue;
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
  pvTimer = setTimeout(() => { $('#preview').innerHTML = '<div class="md th-' + S.pvTheme + '">' + renderMarkdown(ed.value) + '</div>'; }, 120);
}
function togglePreview(force) {
  S.preview = force ?? !S.preview;
  $('#preview').hidden = !S.preview; $('#previewBtn').style.background = S.preview ? 'var(--panel)' : '';
  saveSettings(); updatePreview();
}

/* ───────── export ───────── */
const EXPORT_CSS = 'body{font:17px/1.7 Georgia,"Times New Roman",serif;max-width:720px;margin:48px auto;padding:0 24px;color:#222}h1,h2,h3,h4{font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.25;margin:1.6em 0 .5em}a{color:#0b7fa0}code{font-family:Menlo,Consolas,monospace;font-size:.88em;background:#f1f1ee;padding:.1em .35em;border-radius:4px}pre{background:#f1f1ee;padding:14px 16px;border-radius:8px;overflow:auto}pre code{background:none;padding:0}blockquote{margin:1em 0;padding-left:1em;border-left:3px solid #10a5c8;color:#555}table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 12px}img{max-width:100%}hr{border:0;border-top:1px solid #ddd}li.task{list-style:none;margin-left:-1.2em}';
const unwiki = h => h.replace(/<a class="tag"[^>]*>([\s\S]*?)<\/a>/g, '<span class="tag">$1</span>').replace(/<a class="wiki[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '<span>$1</span>');
const exportBody = () => unwiki(renderMarkdown(ed.value));
const fullHtml = () => '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(titleOf({ text: ed.value })) + '</title><style>' + EXPORT_CSS + EMBED_CSS + (THEME_CSS[S.pvTheme] || '') + '</style></head><body>' + exportBody() + '</body></html>';
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
    if (h) { const w = await h.createWritable(); await w.write(mdOut(ed.value)); await w.close(); toast('Saved to ' + h.name); return; }
    if (window.showSaveFilePicker) {
      const nh = await showSaveFilePicker({ suggestedName: fileName('md'), types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }] });
      const w = await nh.createWritable(); await w.write(mdOut(ed.value)); await w.close(); handles[curId] = nh; toast('Saved to ' + nh.name); return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  download(fileName('md'), mdOut(ed.value), 'text/markdown'); toast('Downloaded ' + fileName('md'));
}
const EXPORTS = {
  md: () => download(fileName('md'), mdOut(ed.value), 'text/markdown'),
  txt: () => download(fileName('txt'), plainText(), 'text/plain'),
  html: () => download(fileName('html'), fullHtml(), 'text/html'),
  doc: () => download(fileName('doc'), '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>' + esc(titleOf({ text: ed.value })) + '</title></head><body>' + exportBody() + '</body></html>', 'application/msword'),
  pdf: () => {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f); f.srcdoc = fullHtml();
    f.onload = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
  },
  copyhtml: async () => { try { const html = exportBody(); await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([mdOut(ed.value)], { type: 'text/plain' }) })]); toast('Copied rich text'); } catch (e) { toast('Copy not allowed here'); } },
  present: () => openPresent(),
  copymd: async () => { try { await navigator.clipboard.writeText(mdOut(ed.value)); toast('Markdown copied'); } catch (e) { toast('Copy not allowed here'); } }
};
function showExportMenu() {
  const m = $('#exportMenu');
  if (!m.hidden) { m.hidden = true; return; }
  const items = [['md', 'Markdown (.md)'], ['html', 'HTML (.html)'], ['pdf', 'PDF (print)…'], ['doc', 'Word (.doc)'], ['txt', 'Plain text (.txt)'], ['present', 'Present as slides'], ['copyhtml', 'Copy as rich text'], ['copymd', 'Copy Markdown']];
  m.innerHTML = items.map(([k, v]) => '<button data-x="' + k + '">' + v + '</button>').join('');
  m.hidden = false;
  m.onclick = e => { const k = e.target.dataset.x; if (k) { EXPORTS[k](); m.hidden = true; } };
}

/* ───────── import ───────── */
async function importFiles(files) {
  let n = 0;
  for (const f of files) {
    if (!/\.(md|markdown|mdown|txt|text)$/i.test(f.name) && !f.type.startsWith('text/')) { toast('Skipped ' + f.name); continue; }
    const text = await f.text(); newDoc(text); adoptImages(); n++;
  }
  if (n) toast('Imported ' + n + (n === 1 ? ' file' : ' files'));
}
async function openFromDisk() {
  if (window.showOpenFilePicker) {
    try {
      const [h] = await showOpenFilePicker({ types: [{ description: 'Text', accept: { 'text/*': ['.md', '.markdown', '.txt'] } }] });
      const text = await (await h.getFile()).text(); newDoc(text); adoptImages(); handles[curId] = h; toast('Opened ' + h.name + ' — Ctrl/⌘ S saves back to it');
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
  const meta = $('meta[name=theme-color]'); if (meta) meta.content = (THEMES.find(x => x[0] === th) || THEMES[0])[2];
  r.setProperty('--pad-top', S.typewriter ? '38vh' : '56px'); r.setProperty('--pad-bot', S.typewriter ? '50vh' : '30vh');
  document.body.dataset.prop = (S.font === 'serif' || S.font === 'sans') ? '1' : '';
  ed.spellcheck = !!S.spell;
  if (!$('#preview').hidden && typeof updatePreview === 'function') updatePreview();
  $$('[data-focus]').forEach(b => b.classList.toggle('on', b.dataset.focus === S.focus));
  drawSwatches();
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
  const order = THEMES.map(t => t[0]);
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
  { label: 'Tag', k: 'hashtag label', desc: '#tag', snip: '#$0' },
  { label: 'Embed note', k: 'transclude include', desc: '![[Note]]', snip: '![[$0]]' },
  { label: 'Comment', k: 'note hidden private', desc: '// …', snip: '// $0' },
  { label: 'Color text', k: 'colour red blue', desc: '<span>', snip: '<span style="color:#e11d48">$0</span>' },
  { label: 'Highlight', k: 'mark marker', desc: '<mark>', snip: '<mark style="background:#fde68a">$0</mark>' },
  { label: 'Image from file', k: 'upload picture photo', desc: '', snip: '', run: () => pickImage() },
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
  el.innerHTML = h + styleHtml();
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
const TPL = [
  { name: 'Journal entry', cat: 'Personal', md: '# {{date}}\n\n> **How I feel today:** $0\n\n## <span style="color:#f97316">Gratitude</span>\n\n- \n- \n- \n\n## <span style="color:#0891b2">Highlights</span>\n\n\n\n## <span style="color:#7c3aed">Tomorrow</span>\n\n- [ ] \n' },
  { name: 'Morning pages', cat: 'Personal', md: '# Morning pages\n\n*{{date}} · write three pages without stopping, without editing.*\n\n---\n\n$0\n' },
  { name: 'Gratitude log', cat: 'Personal', md: '# Gratitude log\n\n*{{date}}*\n\n| | Today I’m grateful for |\n| --- | --- |\n| 1 | $0 |\n| 2 | |\n| 3 | |\n\n> **A small win:** \n' },
  { name: 'Weekly review', cat: 'Personal', md: '# Week of {{date}}\n\n## <span style="color:#16a34a">Wins</span>\n\n- $0\n\n## <span style="color:#e11d48">What didn’t go well</span>\n\n- \n\n## <span style="color:#2563eb">Lessons</span>\n\n- \n\n## Next week\n\n- [ ] \n- [ ] \n- [ ] \n' },
  { name: 'Recipe', cat: 'Personal', md: '# $0\n\n*Serves 4 · Prep 15 min · Cook 30 min*\n\n---\n\n## Ingredients\n\n- \n- \n- \n\n## Method\n\n1. \n2. \n3. \n\n> **Tip:** \n' },
  { name: 'Trip plan', cat: 'Personal', md: '# $0\n\n**When:** {{date}}  \n**Who:** \n\n## Days\n\n| Day | Morning | Afternoon | Evening |\n| --- | --- | --- | --- |\n| 1 | | | |\n| 2 | | | |\n| 3 | | | |\n\n## Packing\n\n- [ ] Passport\n- [ ] Charger\n- [ ] \n' },
  { name: 'Meeting notes', cat: 'Work', md: '# Meeting: $0\n\n**Date:** {{date}}  \n**Attendees:** \n\n---\n\n## Agenda\n\n1. \n2. \n\n## Notes\n\n\n\n## Decisions\n\n> \n\n## Action items\n\n- [ ] \n- [ ] \n' },
  { name: 'One-on-one', cat: 'Work', md: '# 1:1 with $0\n\n*{{date}}*\n\n## Their topics\n\n- \n\n## My topics\n\n- \n\n## Feedback\n\n| Going well | Could be better |\n| --- | --- |\n| | |\n\n## Follow-ups\n\n- [ ] \n' },
  { name: 'Project brief', cat: 'Work', md: '# $0\n\n> **One-line summary:** \n\n## <span style="color:#2563eb">Goal</span>\n\n\n\n## Audience\n\n\n\n## Scope\n\n| In | Out |\n| --- | --- |\n| | |\n\n## Milestones\n\n- [ ] \n- [ ] \n\n## Risks\n\n- \n' },
  { name: 'Product spec', cat: 'Work', md: '# $0\n\n**Status:** Draft · **Owner:** · **Updated:** {{date}}\n\n## Problem\n\n\n\n## Users\n\n\n\n## Requirements\n\n1. **Must:** \n2. **Should:** \n3. **Could:** \n\n## Open questions\n\n- \n\n## Success metrics\n\n- \n' },
  { name: 'Cover letter', cat: 'Work', md: '{{date}}\n\nDear $0,\n\nI’m excited to apply for the role of **[position]** at **[company]**. \n\n\n\nThank you for your time and consideration.\n\nKind regards,  \n[Your name]\n' },
  { name: 'Blog post', cat: 'Writing', md: '# $0\n\n*A short subtitle that makes people want to read on.*\n\n---\n\n> **In short:** one sentence that sums up the post.\n\n## Introduction\n\n\n\n## The main idea\n\n\n\n## What to do next\n\n\n\n---\n\n*Thanks for reading.*\n' },
  { name: 'Newsletter', cat: 'Writing', md: '# $0\n\n*Issue · {{date}}*\n\n---\n\n## <span style="color:#7c3aed">The big story</span>\n\n\n\n## Three quick links\n\n1. \n2. \n3. \n\n## One thing I’m reading\n\n> \n\n---\n\nSee you next time.\n' },
  { name: 'Letter', cat: 'Writing', md: '{{date}}\n\nDear $0,\n\n\n\nWith warm regards,\n' },
  { name: 'Essay outline', cat: 'Study', md: '# $0\n\n> **Thesis:** \n\n## 1. Introduction\n\n- Hook\n- Context\n- Thesis\n\n## 2. Argument one\n\n- Claim\n- Evidence\n- Analysis\n\n## 3. Argument two\n\n- Claim\n- Evidence\n- Analysis\n\n## 4. Counterargument\n\n\n\n## 5. Conclusion\n\n' },
  { name: 'Study notes', cat: 'Study', md: '# $0\n\n*{{date}}*\n\n| Cues | Notes |\n| --- | --- |\n| | |\n| | |\n\n## <span style="color:#16a34a">Summary</span>\n\n\n\n## Questions to review\n\n- [ ] \n' },
  { name: 'Book notes', cat: 'Study', md: '# $0\n\n**Author:** · **Finished:** {{date}} · **Rating:** ☆☆☆☆☆\n\n## The idea in one line\n\n\n\n## Highlights\n\n> \n\n## What I’ll apply\n\n- [ ] \n' },
  { name: 'Short story', cat: 'Creative', md: '# $0\n\n*A short story*\n\n---\n\n// Setting: \n// Character: \n// What changes: \n\nIt began \n' },
  { name: 'Character profile', cat: 'Creative', md: '# $0\n\n| | |\n| --- | --- |\n| **Age** | |\n| **Role** | |\n| **Wants** | |\n| **Fears** | |\n\n## Voice\n\n> \n\n## Backstory\n\n\n\n## Relationships\n\n- \n' }
];
TPL.push(
  { name: 'Daily plan', cat: 'Personal', md: `# {{date}}

## <span style="color:#2563eb">Top 3</span>

- [ ] $0
- [ ] 
- [ ] 

## Schedule

| Time | Plan |
| --- | --- |
| Morning | |
| Afternoon | |
| Evening | |

## Notes

` },
  { name: 'Habit tracker', cat: 'Personal', md: `# Habits · {{date}}

| Habit | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| $0 | | | | | | | |
| Exercise | | | | | | | |
| Read | | | | | | | |
| Sleep 8h | | | | | | | |

> Mark each day with ✓ — streaks beat intensity.
` },
  { name: 'Goal setting', cat: 'Personal', md: `# Goal: $0

*Started {{date}}*

## <span style="color:#7c3aed">Why it matters</span>

## <span style="color:#16a34a">Success looks like</span>

- 

## <span style="color:#f97316">Milestones</span>

- [ ] 30 days
- [ ] 60 days
- [ ] 90 days

## Obstacles & plan

| Obstacle | If it happens, I will… |
| --- | --- |
| | |
` },
  { name: 'Reading list', cat: 'Personal', md: `# Reading list

| | Title | Author | Status |
| :---: | --- | --- | --- |
| 1 | $0 | | To read |
| 2 | | | |
| 3 | | | |

## Currently reading

- 

## Finished

- 
` },
  { name: 'Budget plan', cat: 'Personal', md: `# Budget · {{date}}

## Income

| Source | Amount |
| --- | ---: |
| $0 | |

## Fixed costs

| Item | Amount |
| --- | ---: |
| Rent | |
| Utilities | |
| Insurance | |

## Variable

| Item | Planned | Actual |
| --- | ---: | ---: |
| Groceries | | |
| Transport | | |
| Fun | | |

> **Rule of thumb:** 50 needs · 30 wants · 20 savings.
` },
  { name: 'Workout log', cat: 'Personal', md: `# Workout · {{date}}

**Focus:** $0  
**Energy (1–5):** 

| Exercise | Sets | Reps | Weight |
| --- | :---: | :---: | ---: |
| | | | |
| | | | |
| | | | |

## Notes

` },
  { name: 'Packing list', cat: 'Personal', md: `# Packing · $0

## Documents
- [ ] Passport / ID
- [ ] Tickets
- [ ] Insurance

## Clothes
- [ ] 
- [ ] 

## Tech
- [ ] Phone charger
- [ ] Adapter
- [ ] Headphones

## Toiletries
- [ ] 
` },
  { name: 'Weekly meal plan', cat: 'Personal', md: `# Meals · week of {{date}}

| Day | Breakfast | Lunch | Dinner |
| --- | --- | --- | --- |
| Mon | $0 | | |
| Tue | | | |
| Wed | | | |
| Thu | | | |
| Fri | | | |
| Sat | | | |
| Sun | | | |

## Shopping list

- [ ] 
` },
  { name: 'Meeting agenda', cat: 'Work', md: `# Agenda: $0

**When:** {{date}}  **Length:** 30 min  
**Goal of this meeting:** 

| Time | Topic | Owner |
| --- | --- | --- |
| 5 min | Check-in | |
| 15 min | | |
| 10 min | Next steps | |

## Pre-reads

- 
` },
  { name: 'Standup', cat: 'Work', md: `# Standup · {{date}}

## <span style="color:#16a34a">Yesterday</span>

- $0

## <span style="color:#2563eb">Today</span>

- 

## <span style="color:#e11d48">Blockers</span>

- None
` },
  { name: 'Decision log', cat: 'Work', md: `# Decision: $0

**Date:** {{date}}  **Status:** Proposed  **Owner:** 

## Context

## Options considered

| Option | Pros | Cons |
| --- | --- | --- |
| A | | |
| B | | |

## Decision

> 

## Consequences

` },
  { name: 'OKRs', cat: 'Work', md: `# OKRs · {{date}}

## Objective: $0

- [ ] **KR1:** 
- [ ] **KR2:** 
- [ ] **KR3:** 

## Initiatives

| Initiative | Owner | Due |
| --- | --- | --- |
| | | |

## Check-in

*Confidence (1–10):* 
` },
  { name: 'Retrospective', cat: 'Work', md: `# Retro · {{date}}

## <span style="color:#16a34a">What went well</span>

- $0

## <span style="color:#f97316">What could be better</span>

- 

## <span style="color:#2563eb">Ideas</span>

- 

## Actions

- [ ] 
` },
  { name: 'SWOT analysis', cat: 'Work', md: `# SWOT · $0

| Strengths | Weaknesses |
| --- | --- |
| | |

| Opportunities | Threats |
| --- | --- |
| | |

## So what?

` },
  { name: 'Interview notes', cat: 'Work', md: `# Interview · $0

**Date:** {{date}}  **Role:** 

## Impressions

## Questions & answers

> **Q:** 
>
> **A:** 

## Scorecard

| Skill | 1–5 | Evidence |
| --- | :---: | --- |
| | | |

**Verdict:** 
` },
  { name: 'One-pager', cat: 'Work', md: `# $0

> One sentence that explains it.

## Problem

## Solution

## Why now

## Plan

1. 
2. 
3. 

## Ask

` },
  { name: 'Pitch outline', cat: 'Work', md: `# Pitch: $0

1. **Hook** — 
2. **Problem** — 
3. **Solution** — 
4. **Demo** — 
5. **Market** — 
6. **Traction** — 
7. **Team** — 
8. **The ask** — 
` },
  { name: 'Press release', cat: 'Work', md: `# $0

*{{date}} — For immediate release*

**Lead paragraph:** who, what, when, where, why.

Second paragraph with the key detail.

> “Quote from a spokesperson.” — Name, Title

## About

---

**Contact:** 
` },
  { name: 'Lecture notes', cat: 'Study', md: `# $0

*{{date}}*

| Cues | Notes |
| --- | --- |
| | |
| | |

## Summary

` },
  { name: 'Flashcards', cat: 'Study', md: `# Flashcards · $0

| Question | Answer |
| --- | --- |
| | |
| | |
| | |
` },
  { name: 'Research paper', cat: 'Study', md: `# $0

*Abstract — two or three sentences.*

## 1 Introduction

## 2 Background

## 3 Method

## 4 Results

## 5 Discussion

## References

1. 
` },
  { name: 'Lab notebook', cat: 'Study', md: `# Experiment: $0

**Date:** {{date}}

## Hypothesis

## Materials

- 

## Procedure

1. 

## Observations

| Trial | Result | Notes |
| --- | --- | --- |
| 1 | | |

## Conclusion

` },
  { name: 'Speech', cat: 'Writing', md: `# $0

*Length: 5 minutes · ~650 words*

## Opening — hook

## Point one

## Point two

## Point three

## Close — call to action

` },
  { name: 'Poem', cat: 'Creative', md: `# $0

*{{date}}*

&nbsp;

` },
  { name: 'Screenplay scene', cat: 'Creative', md: `# SCENE $0

**INT. LOCATION — DAY**

*Action line describing what we see.*

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**CHARACTER**  
&nbsp;&nbsp;&nbsp;&nbsp;Dialogue goes here.

` },
  { name: 'Chapter outline', cat: 'Creative', md: `# $0

| # | Chapter | Purpose | Status |
| :---: | --- | --- | --- |
| 1 | | | Idea |
| 2 | | | |
| 3 | | | |

## Themes

- 

## Open questions

- 
` },
  { name: 'README', cat: 'Dev', md: `# $0

> What this project does in one line.

## Install

\`\`\`sh
npm install
\`\`\`

## Usage

\`\`\`js

\`\`\`

## Contributing

## License
` },
  { name: 'Bug report', cat: 'Dev', md: `# Bug: $0

**Severity:** Medium  **Found:** {{date}}

## Steps to reproduce

1. 
2. 

## Expected

## Actual

## Environment

- OS: 
- Version: 
` },
  { name: 'Changelog', cat: 'Dev', md: `# Changelog

## [Unreleased]

### Added
- $0

### Changed
- 

### Fixed
- 
` },
  { name: 'Architecture decision', cat: 'Dev', md: `# ADR: $0

**Status:** Proposed · {{date}}

## Context

## Decision

## Consequences

- Good: 
- Bad: 
` },
  { name: 'Idea capture', cat: 'Creative', md: `# Idea: $0

*{{date}} #idea*

## The spark

## Why it could work

## First tiny step

- [ ] 
` },
  { name: 'Brain dump', cat: 'Personal', md: `# Brain dump · {{date}}

Write everything on your mind. Sort it later.

$0

---

## Sort it

- [ ] Do
- [ ] Delegate
- [ ] Drop
` }
);

function fromTemplate(name) {
  const t = TPL.find(x => x.name === name); if (!t) return;
  const d = new Date();
  let txt = t.md.replace(/\{\{date\}\}/g, d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
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
  download('Wren backup ' + today() + '.json', JSON.stringify({ app: 'wren', version: 2, exported: new Date().toISOString(), docs: Object.values(docs), stats, folders }, null, 1), 'application/json');
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
      if (d.images && typeof d.images === 'object') docs[id].images = d.images;
      if (d.trashed) docs[id].trashed = d.trashed;
      if (ex) copies++; else added++;
    }
    if (Array.isArray(data.folders)) for (const f of data.folders) if (f && f.name && f.q && !folders.some(x => x.q === f.q)) folders.push({ name: String(f.name).slice(0, 30), q: String(f.q) });
    store.set('folders', folders);
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
    used.add(n.toLowerCase()); return { name: n + '.md', data: enc.encode(mdOut(textOf(d), d)) };
  });
  download('Wren documents.zip', buildZip(files), 'application/zip'); toast('Exported ' + files.length + ' documents');
}

const MORE_COMMANDS = [
  ['Quick open document…', mod_() + ' P', () => openPalette('doc')],
  ...TPL.map(t => ['New: ' + t.name, '', () => fromTemplate(t.name)]),
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

/* ───────── images (stored inside the note, referenced as img:ID) ───────── */
let imgScope = null;
const imgData = id => { const d = imgScope || docs[curId]; return d && d.images && d.images[id]; };
const mdOut = (t, d) => { d = d || docs[curId]; return t.replace(/\]\(img:([A-Za-z0-9]+)\)/g, (m, id) => d && d.images && d.images[id] ? '](' + d.images[id] + ')' : m); };
const readDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
function storeImage(data) {
  const d = docs[curId]; d.images = d.images || {};
  for (const k in d.images) if (d.images[k] === data) return k;
  const id = uid(); d.images[id] = data;
  if (!store.set('docs', docs)) { delete d.images[id]; toast('Not enough storage for this image. Export a backup and clear space.'); return null; }
  return id;
}
async function addImage(file) {
  if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) { toast(file.type.startsWith('video/') ? 'Videos are blocked in Wren' : 'Only PNG, JPEG, GIF and WebP images are supported'); return null; }
  let data = await readDataURL(file);
  if (file.type !== 'image/gif') {
    try {
      const img = await loadImg(data), sc = Math.min(1, 1400 / Math.max(img.width, img.height));
      if (sc < 1 || file.size > 350000) {
        const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const out = c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp', .85);
        if (out.length < data.length) data = out;
      }
    } catch (e) { }
  }
  if (data.length > 2.5e6) { toast('That image is too large (about 1.8 MB max)'); return null; }
  return storeImage(data);
}
const imgAlt = n => (n || '').replace(/\.[a-z0-9]+$/i, '').replace(/[\[\]()]/g, '').replace(/[_-]+/g, ' ').trim();
async function insertImageFile(file) {
  const id = await addImage(file); if (!id) return;
  insertBlock('![' + imgAlt(file.name) + '](img:' + id + ')'); toast('Image added');
}
function handleFiles(files) {
  const rest = [];
  for (const f of files) { if (f.type.startsWith('image/')) insertImageFile(f); else if (f.type.startsWith('video/')) toast('Videos are blocked in Wren'); else rest.push(f); }
  if (rest.length) importFiles(rest);
}
function pickImage() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/gif,image/webp'; i.multiple = true;
  i.onchange = () => [...i.files].forEach(insertImageFile); i.click();
}
function adoptImages() {
  const t = ed.value, d = docs[curId]; let found = false;
  const out = t.replace(/\]\((data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+)\)/g, (m, data) => { const id = storeImage(data); if (!id) return m; found = true; return '](img:' + id + ')'; });
  if (found) { ed.value = out; d.text = out; persist(); render(); updatePreview(); }
}
function toggleComment() {
  const t = ed.value, a = ed.selectionStart, b = ed.selectionEnd, [la] = lineBounds(t, a), [, lb] = lineBounds(t, b > a && t[b - 1] === '\n' ? b - 1 : b);
  const lines = t.slice(la, lb).split('\n'), all = lines.every(l => !l.trim() || /^\s*\/\/(\s|$)/.test(l));
  const out = lines.map(l => !l.trim() ? l : all ? l.replace(/^(\s*)\/\/ ?/, '$1') : '// ' + l).join('\n');
  replaceRange(la, lb, out, la, la + out.length);
}
function renderEmbed(title, depth) {
  const d = liveDocs().find(x => norm(titleOf({ text: textOf(x) })) === norm(title));
  if (!d) return '<div class="embed miss">Note “' + esc(title) + '” not found</div>';
  if (depth >= 2 || d.id === curId) return '<div class="embed miss">Can’t embed “' + esc(title) + '” here</div>';
  const prev = imgScope; imgScope = d;
  try { return '<div class="embed"><div class="embed-t">' + esc(titleOf({ text: textOf(d) })) + '</div>' + renderMarkdown(textOf(d).replace(/^\s*#[^\n]*\n/, ''), depth + 1) + '</div>'; } finally { imgScope = prev; }
}
const EMBED_CSS = '.embed{border-left:3px solid #bbb;padding:.2em 1em;margin:1em 0;background:#f7f7f5;border-radius:0 8px 8px 0}.embed-t{font:600 12px sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#777}.blocked{color:#888;font-style:italic}';
const THEME_CSS = {
  standard: '',
  manuscript: 'body{font:18px/2 "Times New Roman",Times,serif;max-width:640px}h1{text-align:center;font-weight:400;letter-spacing:.08em;text-transform:uppercase}h2,h3{font-weight:400;font-style:italic}p{margin:0;text-indent:1.6em}h1+p,h2+p,h3+p,hr+p,blockquote+p{text-indent:0}',
  magazine: 'body{font:17px/1.7 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;max-width:760px}h1{font-size:2.8em;line-height:1.05;letter-spacing:-.02em;border-bottom:4px solid #10a5c8;padding-bottom:.2em}h1+p::first-letter{font-size:3.2em;float:left;line-height:.85;padding:.05em .1em 0 0;color:#10a5c8;font-weight:700}blockquote{border-left:0;font-size:1.25em;font-style:italic;color:#10a5c8;padding-left:0}',
  compact: 'body{font:15px/1.5 -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;max-width:700px;margin:24px auto}h1,h2,h3{margin:1em 0 .3em}p,li{margin:.3em 0}'
};

/* ───────── template gallery ───────── */
let tplCat = 'All';
function openTemplates() {
  let el = $('#tplModal');
  if (!el) {
    el = document.createElement('div'); el.id = 'tplModal'; el.className = 'overlay';
    el.innerHTML = '<div class="card tpl"><div class="set-head"><h2>New from template</h2><button class="icon" id="tplClose" aria-label="Close">✕</button></div><div class="tpl-bar"><input id="tplSearch" type="search" placeholder="Search templates" aria-label="Search templates"><div id="tplCats" class="chips"></div></div><div id="tplGrid" class="tpl-grid"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('mousedown', e => { if (e.target === el) el.hidden = true; });
    el.querySelector('#tplClose').onclick = () => { el.hidden = true; ed.focus(); };
    el.querySelector('#tplSearch').addEventListener('input', renderTemplates);
    el.querySelector('#tplCats').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { tplCat = b.dataset.c; renderTemplates(); } });
    el.querySelector('#tplGrid').addEventListener('click', e => { const c = e.target.closest('[data-n]'); if (c) { el.hidden = true; fromTemplate(c.dataset.n); } });
  }
  el.hidden = false; renderTemplates(); el.querySelector('#tplSearch').focus();
}
function renderTemplates() {
  const q = $('#tplSearch').value.trim().toLowerCase(), cats = ['All', ...new Set(TPL.map(t => t.cat))];
  $('#tplCats').innerHTML = cats.map(c => '<button class="chip' + (c === tplCat ? ' on' : '') + '" data-c="' + c + '">' + c + '</button>').join('');
  const list = TPL.filter(t => (tplCat === 'All' || t.cat === tplCat) && (!q || (t.name + ' ' + t.cat).toLowerCase().includes(q)));
  $('#tplGrid').innerHTML = list.map(t => '<button class="tcard" data-n="' + attr(t.name) + '"><div class="tprev md">' + renderMarkdown(t.md.replace(/\{\{date\}\}/g, 'Today').replace('$0', '').slice(0, 520)) + '</div><div class="tmeta"><b>' + esc(t.name) + '</b><span>' + t.cat + '</span></div></button>').join('') || '<div class="empty">No templates match.</div>';
}
$('#tplBtn').onclick = openTemplates;
$('#studioBtn').onclick = openStudio;

/* ───────── Studio: visual editor that writes Markdown ───────── */
const ST = { dirty: false, hist: [], i: -1, range: null, drag: null, mo: null, snapT: 0 };
const BLOCK_SET = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL', 'PRE', 'HR', 'TABLE', 'FIGURE']);
const TEXT_COLORS = ['#e11d48', '#f97316', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#111827', '#6b7280'];
const HILITES = ['#fde68a', '#fed7aa', '#fecaca', '#bbf7d0', '#a5f3fc', '#bfdbfe', '#ddd6fe', '#fbcfe8', '#e5e7eb'];
const BLOCK_HTML = {
  h1: '<h1>Heading</h1>', h2: '<h2>Section heading</h2>', p: '<p>Write something…</p>', quote: '<blockquote><p>A memorable quote</p></blockquote>',
  list: '<ul><li>First</li><li>Second</li></ul>', tasks: '<ul><li><input type="checkbox"> A task</li></ul>', hr: '<hr>',
  callout: '<blockquote><p><strong>Note</strong></p><p>Something worth remembering</p></blockquote>', code: '<pre><code>code</code></pre>'
};
const BLOCK_LABEL = { h1: 'Title', h2: 'Heading', p: 'Paragraph', quote: 'Quote', list: 'List', tasks: 'Tasks', hr: 'Divider', callout: 'Callout', code: 'Code' };

function splitBlocks(md) {
  const out = []; let cur = [], fence = false;
  const push = () => { const t = cur.join('\n').replace(/^\n+|\n+$/g, ''); if (t.trim()) out.push(t); cur = []; };
  for (const l of md.replace(/\r\n?/g, '\n').split('\n')) {
    if (FENCE.test(l)) fence = !fence;
    if (!fence && !l.trim() && !FENCE.test(l)) { push(); continue; }
    cur.push(l);
  }
  push(); return out;
}
const isRawBlock = b => { const t = b.trim(); return t.startsWith('<!--') || /^!\[\[[^\]]+\]\]$/.test(t) || t.split('\n').every(l => /^\s*\/\/(\s|$)/.test(l)) || /^!\[[^\]]*\]\(([^)\s]+)\)$/.test(t) && isVideoUrl(t.match(/\(([^)\s]+)\)/)[1]); };
const GRIP = '<span class="grip" contenteditable="false" draggable="true" title="Drag to move">⋮⋮</span>';
const blockHtml = b => isRawBlock(b)
  ? '<div class="blk raw" contenteditable="false" data-md="' + attr(b) + '">' + GRIP + '<code class="rawtxt">' + esc(b) + '</code></div>'
  : '<div class="blk" data-md="' + attr(b) + '">' + GRIP + renderMarkdown(b) + '</div>';

/* HTML → Markdown */
const mdEsc = t => t.replace(/([\\`*_\[\]<>~])/g, '\\$1');
function toHex(c) {
  c = (c || '').trim().toLowerCase(); if (!c) return '';
  if (/^#[0-9a-f]{3,8}$/.test(c)) return c;
  const m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/); if (!m) return '';
  return '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('');
}
function wrapMd(mk, inner) { const core = inner.trim(); if (!core) return inner; const i = inner.indexOf(core); return inner.slice(0, i) + mk + core + mk + inner.slice(i + core.length); }
function d2mNode(c) {
  if (c.nodeType === 3) return mdEsc(c.nodeValue.replace(/\u00a0/g, ' '));
  if (c.nodeType !== 1 || c.classList.contains('grip')) return '';
  const tag = c.tagName.toLowerCase(), inner = () => d2mInline(c);
  switch (tag) {
    case 'strong': case 'b': return wrapMd('**', inner());
    case 'em': case 'i': return wrapMd('*', inner());
    case 'del': case 's': case 'strike': return wrapMd('~~', inner());
    case 'code': return '`' + c.textContent.replace(/`/g, '') + '`';
    case 'br': return '\n';
    case 'a': {
      if (c.classList.contains('wiki')) { const t = c.dataset.wiki || c.textContent, x = c.textContent; return '[[' + t + (x && x !== t ? '|' + x : '') + ']]'; }
      const href = c.getAttribute('href') || ''; return href ? '[' + inner() + '](' + href + ')' : inner();
    }
    case 'img': {
      let id = c.dataset.imgId; const src = c.getAttribute('src') || '', alt = mdEsc(c.getAttribute('alt') || '');
      if (!id && /^data:image\//.test(src)) id = storeImage(src);
      if (id) return '![' + alt + '](img:' + id + ')';
      return /^https?:/.test(src) ? '![' + alt + '](' + src + ')' : '';
    }
    case 'span': { const h = toHex(c.style.color); return h ? '<span style="color:' + h + '">' + inner() + '</span>' : inner(); }
    case 'mark': { const h = toHex(c.style.backgroundColor || c.style.background); return h ? '<mark style="background:' + h + '">' + inner() + '</mark>' : inner(); }
    case 'input': return '';
    default: return inner();
  }
}
const d2mInline = p => [...p.childNodes].map(d2mNode).join('');
const guardLine = t => t.replace(/^(#{1,6}\s|[-+]\s|>|---)/, '\\$1').replace(/^(\d+)([.)]) /, '$1\\$2 ');
function d2mList(el, depth) {
  const ordered = el.tagName === 'OL'; let n = parseInt(el.getAttribute('start') || '1', 10) || 1; const out = [];
  for (const li of el.children) {
    if (li.tagName !== 'LI') continue;
    let text = '', cb = null; const nested = [];
    for (const c of li.childNodes) {
      if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) nested.push(d2mList(c, depth + 1));
      else if (c.nodeType === 1 && c.tagName === 'INPUT') cb = c;
      else if (c.nodeType === 1 && (c.tagName === 'P' || c.tagName === 'DIV')) text += (text ? ' ' : '') + d2mInline(c);
      else text += d2mNode(c);
    }
    out.push('  '.repeat(depth) + (ordered ? (n++) + '. ' : '- ') + (cb ? (cb.checked || cb.hasAttribute('checked') ? '[x] ' : '[ ] ') : '') + text.replace(/\n+/g, ' ').trim());
    nested.forEach(x => out.push(x));
  }
  return out.join('\n');
}
function d2mTable(t) {
  const trs = [...t.querySelectorAll('tr')]; if (!trs.length) return '';
  const rows = trs.map(tr => [...tr.children].map(c => d2mInline(c).replace(/\|/g, '/').replace(/\n/g, ' ').trim()));
  const al = [...trs[0].children].map(c => c.style.textAlign === 'center' ? ':---:' : c.style.textAlign === 'right' ? '---:' : '---');
  const line = r => '| ' + rows[0].map((_, i) => r[i] || '').join(' | ') + ' |';
  return [line(rows[0]), '| ' + al.join(' | ') + ' |'].concat(rows.slice(1).map(line)).join('\n');
}
function d2mBlock(el) {
  const tag = el.tagName;
  if (el.classList.contains('raw')) return el.dataset.md || '';
  if (/^H[1-6]$/.test(tag)) return '#'.repeat(+tag[1]) + ' ' + d2mInline(el).replace(/\n/g, ' ').trim();
  if (tag === 'P') return guardLine(d2mInline(el).replace(/[ \t]+\n/g, '\n').trim());
  if (tag === 'BLOCKQUOTE') return d2mBlocks(el).split('\n').map(l => l ? '> ' + l : '>').join('\n');
  if (tag === 'UL' || tag === 'OL') return d2mList(el, 0);
  if (tag === 'PRE') { const code = el.querySelector('code'), lang = ((code && code.className.match(/language-([\w+-]+)/)) || [])[1] || ''; return '```' + lang + '\n' + el.textContent.replace(/\n$/, '') + '\n```'; }
  if (tag === 'HR') return '---';
  if (tag === 'TABLE') return d2mTable(el);
  return d2mBlocks(el);
}
function d2mBlocks(root) {
  const parts = []; let run = '';
  const flush = () => { const t = run.replace(/[ \t]+\n/g, '\n').trim(); if (t) parts.push(guardLine(t)); run = ''; };
  for (const c of root.childNodes) {
    if (c.nodeType === 1 && BLOCK_SET.has(c.tagName)) { flush(); const t = d2mBlock(c); if (t !== '') parts.push(t); }
    else run += d2mNode(c);
  }
  flush(); return parts.join('\n\n');
}
const d2mHtml = html => { const d = document.createElement('div'); d.innerHTML = html; return d2mBlocks(d); };
function studioMarkdown() {
  const out = [];
  for (const b of $('#stCanvas').childNodes) {
    if (b.nodeType === 3) { const t = guardLine(mdEsc(b.nodeValue).trim()); if (t) out.push(t); continue; }
    if (b.nodeType !== 1) continue;
    if (b.classList.contains('blk') && b.dataset.md !== undefined && !b.dataset.dirty) { out.push(b.dataset.md); continue; }
    const t = d2mBlocks(b.cloneNode(true)).trim(); if (t) out.push(t);
  }
  return out.join('\n\n') + '\n';
}

/* Studio UI */
(function buildStudio() {
  const el = document.createElement('div'); el.id = 'studio'; el.hidden = true;
  const tb = (c, label, title) => '<button data-c="' + c + '" title="' + title + '">' + label + '</button>';
  el.innerHTML =
    '<div class="st-top"><button id="stBack" class="st-plain">← Back</button><div class="st-brand"><b>Studio</b><span>Edit visually — saved as Markdown</span></div>' +
    '<div class="st-tools">' + tb('bold', '<b>B</b>', 'Bold') + tb('italic', '<i>I</i>', 'Italic') + tb('strike', '<s>S</s>', 'Strikethrough') + tb('code', '&lt;/&gt;', 'Inline code') + '<i class="sep"></i>' +
    tb('h1', 'H1', 'Title') + tb('h2', 'H2', 'Heading') + tb('h3', 'H3', 'Subheading') + tb('p', '¶', 'Paragraph') + '<i class="sep"></i>' +
    tb('ul', '•', 'Bulleted list') + tb('ol', '1.', 'Numbered list') + tb('quote', '❝', 'Quote') + tb('link', '🔗', 'Link') + tb('clear', '⌫', 'Clear formatting') + '</div><div class="spacer"></div>' +
    '<button id="stUndo" title="Undo (Ctrl/⌘ Z)">↶</button><button id="stRedo" title="Redo">↷</button><button id="stApply" class="primary" title="Ctrl/⌘ Enter">Apply to document</button></div>' +
    '<div class="st-body"><aside id="stRail"><div class="st-tabs"><button data-p="blocks" class="on">Blocks</button><button data-p="colors">Colors</button><button data-p="images">Images</button></div>' +
    '<div class="st-panel" data-p="blocks"><p class="hint">Drag a block onto the page.</p><div class="bgrid">' + Object.keys(BLOCK_HTML).map(k => '<div class="bchip" draggable="true" data-drag=\'{"k":"block","t":"' + k + '"}\'>' + BLOCK_LABEL[k] + '</div>').join('') + '</div></div>' +
    '<div class="st-panel" data-p="colors" hidden><p class="hint">Select text, then click a color, or drag a color onto any block.</p><h5>Text</h5><div class="sgrid">' + TEXT_COLORS.map(c => '<button class="sw" draggable="true" style="background:' + c + '" title="Text ' + c + '" data-hex="' + c + '" data-mode="color" data-drag=\'{"k":"color","hex":"' + c + '","mode":"color"}\'></button>').join('') + '</div>' +
    '<h5>Highlight</h5><div class="sgrid">' + HILITES.map(c => '<button class="sw" draggable="true" style="background:' + c + '" title="Highlight ' + c + '" data-hex="' + c + '" data-mode="bg" data-drag=\'{"k":"color","hex":"' + c + '","mode":"bg"}\'></button>').join('') + '</div>' +
    '<h5>Custom</h5><div class="cust"><input type="color" id="stCustom" value="#e11d48"><button id="stCustomText">Text</button><button id="stCustomBg">Highlight</button></div><button id="stClearColor" class="wide">Remove color</button></div>' +
    '<div class="st-panel" data-p="images" hidden><div id="stZone" class="zone">Drop images here<small>PNG · JPEG · GIF · WebP</small></div><button id="stAddImg" class="wide">Add image…</button><div id="stTray" class="tray"></div></div></aside>' +
    '<div id="stPageWrap"><div id="stPage"><div id="stCanvas" contenteditable="true" spellcheck="true" aria-label="Page"></div><div id="stDrop" hidden></div></div></div></div>';
  document.body.appendChild(el);
})();
const stCanvas = () => $('#stCanvas');
function stSnap() {
  const h = stCanvas().innerHTML; if (ST.hist[ST.i] === h) return;
  ST.hist.length = ST.i + 1; ST.hist.push(h); ST.i++; if (ST.hist.length > 80) { ST.hist.shift(); ST.i--; }
}
function stRestore(i) { stSnap(); if (i < 0 || i >= ST.hist.length) return; ST.i = i; stCanvas().innerHTML = ST.hist[i]; ST.dirty = true; renderTray(); }
const studioUndo = () => stRestore(ST.i - 1), studioRedo = () => stRestore(ST.i + 1);
function renderTray() {
  const imgs = (docs[curId] && docs[curId].images) || {}, ids = Object.keys(imgs);
  $('#stTray').innerHTML = ids.length ? ids.map(id => '<img draggable="true" src="' + imgs[id] + '" alt="" data-drag=\'{"k":"image","id":"' + id + '"}\'>').join('') : '<p class="hint">Images you add appear here so you can reuse them.</p>';
}
function openStudio() {
  flush(); if (document.fullscreenElement === null) { /* keep window mode */ }
  const root = stCanvas(), blocks = splitBlocks(ed.value);
  root.innerHTML = blocks.map(blockHtml).join('') || '<div class="blk"><p><br></p></div>';
  renderTray(); ST.dirty = false; ST.hist = [root.innerHTML]; ST.i = 0;
  if (ST.mo) ST.mo.disconnect();
  ST.mo = new MutationObserver(ms => {
    ST.dirty = true;
    for (const m of ms) { let n = m.target; while (n && n.parentNode !== root) n = n.parentNode; if (n && n.nodeType === 1 && n !== root) n.dataset.dirty = '1'; }
  });
  ST.mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'src', 'alt', 'checked', 'href'] });
  $('#studio').hidden = false; root.focus();
}
function closeStudio(force) {
  if (!force && ST.dirty && !confirm('Discard your changes in Studio?')) return;
  if (ST.mo) ST.mo.disconnect();
  $('#studio').hidden = true; ed.focus();
}
function applyStudio() {
  if (ST.mo) ST.mo.takeRecords();
  const md = studioMarkdown();
  if (ST.dirty && md.trim() !== ed.value.trim()) { ed.focus(); ed.setSelectionRange(0, ed.value.length); insertText(md); toast('Studio changes applied'); }
  closeStudio(true);
}
const stBlockAt = n => { while (n && n !== stCanvas()) { if (n.parentNode === stCanvas()) return n; n = n.parentNode; } return null; };
function stRef(y) { for (const b of stCanvas().querySelectorAll(':scope > .blk')) { const r = b.getBoundingClientRect(); if (y < r.top + r.height / 2) return b; } return null; }
function stPlace(node, ref) { const root = stCanvas(); if (ref) root.insertBefore(node, ref); else root.appendChild(node); }
function stInsertHtml(html, ref) {
  stSnap(); const d = document.createElement('div'); d.className = 'blk'; d.innerHTML = GRIP + html; stPlace(d, ref);
  const t = d.querySelector('p,h1,h2,li,pre'); if (t) { const r = document.createRange(); r.selectNodeContents(t); getSelection().removeAllRanges(); getSelection().addRange(r); }
  stSnap(); return d;
}
function stInsertImage(id, alt, ref) { const data = docs[curId].images[id]; return stInsertHtml('<p><img data-img-id="' + id + '" src="' + data + '" alt="' + attr(alt || '') + '"></p>', ref); }
function stApplyColor(hex, mode, block) {
  const root = stCanvas(), sel = getSelection(); let range = sel.rangeCount ? sel.getRangeAt(0) : null;
  if (!(range && !range.collapsed && root.contains(range.commonAncestorContainer))) range = ST.range && !ST.range.collapsed && root.contains(ST.range.commonAncestorContainer) ? ST.range : null;
  if (range && block && !block.contains(range.commonAncestorContainer)) range = null;
  if (!range) { if (!block) return toast('Select some text first, or drop a color onto a block'); range = document.createRange(); range.selectNodeContents(block); }
  stSnap();
  const tag = mode === 'bg' ? 'mark' : 'span', prop = mode === 'bg' ? 'background' : 'color', nodes = [];
  const rootNode = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer;
  const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (range.intersectsNode(n) && n.nodeValue.trim() && !n.parentNode.closest('.grip,.rawtxt')) nodes.push(n);
  for (const n of nodes) {
    const s = n === range.startContainer ? range.startOffset : 0, e = n === range.endContainer ? range.endOffset : n.nodeValue.length;
    if (s >= e) continue;
    const p = n.parentNode;
    if (s === 0 && e === n.nodeValue.length && p.tagName.toLowerCase() === tag && p.childNodes.length === 1) { p.style[prop] = hex; continue; }
    const r = document.createRange(); r.setStart(n, s); r.setEnd(n, e);
    const el = document.createElement(tag); el.style[prop] = hex; r.surroundContents(el);
  }
  stSnap();
}
function stClearColor(block) {
  const root = stCanvas(), sel = getSelection(); let range = sel.rangeCount ? sel.getRangeAt(0) : null;
  if (!range || !root.contains(range.commonAncestorContainer)) range = ST.range;
  if (!range || range.collapsed) { if (!block) return toast('Select text first'); range = document.createRange(); range.selectNodeContents(block); }
  stSnap();
  for (const el of [...root.querySelectorAll('span[style],mark')]) {
    if (!range.intersectsNode(el)) continue;
    const f = document.createDocumentFragment(); while (el.firstChild) f.appendChild(el.firstChild); el.replaceWith(f);
  }
  stSnap();
}
function stCmd(c) {
  const root = stCanvas(); root.focus(); stSnap();
  const x = (cmd, v) => document.execCommand(cmd, false, v);
  if (c === 'bold') x('bold'); else if (c === 'italic') x('italic'); else if (c === 'strike') x('strikeThrough');
  else if (c === 'ul') x('insertUnorderedList'); else if (c === 'ol') x('insertOrderedList');
  else if (/^h[1-3]$/.test(c)) x('formatBlock', '<' + c + '>'); else if (c === 'p') x('formatBlock', '<p>'); else if (c === 'quote') x('formatBlock', '<blockquote>');
  else if (c === 'link') { const u = prompt('Link address (https://…)'); if (u && /^(https?:|mailto:)/i.test(u.trim())) x('createLink', u.trim()); else if (u) toast('Links must start with http(s):// or mailto:'); }
  else if (c === 'code') { const s = getSelection().toString(); if (s) x('insertHTML', '<code>' + esc(s) + '</code>'); }
  else if (c === 'clear') { x('removeFormat'); stClearColor(null); }
  stSnap();
}
function stMove(block, ref) { if (!block || block === ref || block.nextSibling === ref) return; stSnap(); stPlace(block, ref); stSnap(); ST.dirty = true; }
function stDropIndicator(ref) {
  const ind = $('#stDrop'), root = stCanvas(); ind.hidden = false;
  ind.style.top = (ref ? ref.offsetTop : root.offsetTop + root.offsetHeight) + 'px';
}
function stDragEnd() { $('#stDrop').hidden = true; stCanvas().querySelectorAll('.dropblk').forEach(b => b.classList.remove('dropblk')); ST.drag = null; }

(function wireStudio() {
  const el = $('#studio'), root = stCanvas();
  el.addEventListener('keydown', e => {
    e.stopPropagation(); const m = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (e.key === 'Escape') { e.preventDefault(); closeStudio(); }
    else if (m && e.key === 'Enter') { e.preventDefault(); applyStudio(); }
    else if (m && k === 'z' && !e.shiftKey) { e.preventDefault(); studioUndo(); }
    else if (m && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); studioRedo(); }
  });
  $('#stBack').onclick = () => closeStudio(); $('#stApply').onclick = applyStudio; $('#stUndo').onclick = studioUndo; $('#stRedo').onclick = studioRedo;
  el.querySelector('.st-tools').addEventListener('mousedown', e => e.preventDefault());
  el.querySelector('.st-tools').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) stCmd(b.dataset.c); });
  el.querySelector('.st-tabs').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; el.querySelectorAll('.st-tabs button').forEach(x => x.classList.toggle('on', x === b)); el.querySelectorAll('.st-panel').forEach(p => p.hidden = p.dataset.p !== b.dataset.p); });
  document.addEventListener('selectionchange', () => { const s = getSelection(); if (s.rangeCount && root.contains(s.getRangeAt(0).commonAncestorContainer)) ST.range = s.getRangeAt(0).cloneRange(); });
  $('#stRail').addEventListener('click', e => {
    const sw = e.target.closest('.sw'); if (sw) return stApplyColor(sw.dataset.hex, sw.dataset.mode, null);
    const t = e.target.closest('.tray img'); if (t) return stInsertImage(JSON.parse(t.dataset.drag).id, '', stRef(1e9));
  });
  $('#stCustomText').onclick = () => stApplyColor($('#stCustom').value, 'color', null);
  $('#stCustomBg').onclick = () => stApplyColor($('#stCustom').value, 'bg', null);
  $('#stClearColor').onclick = () => stClearColor(null);
  $('#stAddImg').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/gif,image/webp'; i.multiple = true; i.onchange = async () => { for (const f of i.files) { const id = await addImage(f); if (id) stInsertImage(id, imgAlt(f.name), null); } renderTray(); }; i.click(); };
  $('#stRail').addEventListener('dragstart', e => { const d = e.target.closest('[data-drag]'); if (!d) return; ST.drag = JSON.parse(d.dataset.drag); e.dataTransfer.setData('application/x-wren', d.dataset.drag); e.dataTransfer.effectAllowed = 'copy'; });
  root.addEventListener('dragstart', e => { const g = e.target.closest('.grip'); if (!g) return; ST.drag = { k: 'move', b: g.closest('.blk') }; e.dataTransfer.setData('application/x-wren', '{"k":"move"}'); e.dataTransfer.effectAllowed = 'move'; });
  el.addEventListener('dragend', stDragEnd);
  root.addEventListener('dragover', e => {
    const isFile = [...(e.dataTransfer.types || [])].includes('Files'); if (!isFile && !ST.drag) return;
    e.preventDefault(); e.stopPropagation();
    if (ST.drag && ST.drag.k === 'color') { root.querySelectorAll('.dropblk').forEach(b => b.classList.remove('dropblk')); const b = stBlockAt(e.target); if (b) b.classList.add('dropblk'); $('#stDrop').hidden = true; }
    else stDropIndicator(stRef(e.clientY));
  });
  root.addEventListener('dragleave', e => { if (!root.contains(e.relatedTarget)) stDragEnd(); });
  root.addEventListener('drop', async e => {
    e.preventDefault(); e.stopPropagation();
    const ref = stRef(e.clientY), blk = stBlockAt(e.target), files = [...(e.dataTransfer.files || [])], d = ST.drag; stDragEnd();
    if (files.length) { for (const f of files) { const id = await addImage(f); if (id) stInsertImage(id, imgAlt(f.name), ref); } renderTray(); return; }
    if (!d) return;
    if (d.k === 'block') stInsertHtml(BLOCK_HTML[d.t], ref);
    else if (d.k === 'image') stInsertImage(d.id, '', ref);
    else if (d.k === 'color') stApplyColor(d.hex, d.mode, blk);
    else if (d.k === 'move') stMove(d.b, ref);
  });
  let t; root.addEventListener('input', () => { clearTimeout(t); t = setTimeout(stSnap, 500); });
  root.addEventListener('dblclick', e => { if (e.target.tagName === 'IMG') { const a = prompt('Describe this image (alt text)', e.target.alt || ''); if (a !== null) { stSnap(); e.target.alt = a; stSnap(); } } });
  root.addEventListener('paste', e => {
    const f = [...(e.clipboardData && e.clipboardData.files || [])].filter(x => x.type.startsWith('image/')); if (f.length) { e.preventDefault(); f.forEach(async x => { const id = await addImage(x); if (id) stInsertImage(id, '', null); }); return; }
    e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });
  $('#stZone').addEventListener('dragover', e => e.preventDefault());
  $('#stZone').addEventListener('drop', async e => { e.preventDefault(); e.stopPropagation(); for (const f of e.dataTransfer.files) { const id = await addImage(f); if (id) stInsertImage(id, imgAlt(f.name), null); } renderTray(); });
})();

const NEW_COMMANDS = [
  ['Studio: visual editor', mod_() + ' ⇧ E', openStudio],
  ['New from template…', '', openTemplates],
  ['Insert image…', '', pickImage],
  ['Toggle comment on line(s)', mod_() + ' /', toggleComment],
  ...['standard', 'manuscript', 'magazine', 'compact'].map(n => ['Preview & export style: ' + n[0].toUpperCase() + n.slice(1), '', () => { S.pvTheme = n; saveSettings(); applySettings(); syncSettingsForm(); }])
];

/* ───────── style check ───────── */
const STYLE_WORDY = { 'in order to': 'to', 'due to the fact that': 'because', 'at this point in time': 'now', 'a number of': 'several', 'in the event that': 'if', 'for the purpose of': 'for', 'with regard to': 'about', 'is able to': 'can', 'has the ability to': 'can', 'in spite of the fact that': 'although', 'the vast majority of': 'most', 'each and every': 'every', 'at the present time': 'now', 'in the near future': 'soon', 'on a daily basis': 'daily', 'it is important to note that': '', 'needless to say': '' };
const STYLE_CLICHE = ['at the end of the day', 'think outside the box', 'low-hanging fruit', 'game changer', 'paradigm shift', 'circle back', 'move the needle', 'win-win', 'touch base', 'take it to the next level', 'best of both worlds', 'it goes without saying', 'last but not least', 'only time will tell', 'read between the lines', 'the elephant in the room', 'back to square one', 'a perfect storm', 'at the drop of a hat', 'tip of the iceberg', 'without further ado', 'in today’s world', 'in today\'s world'];
const STYLE_WEAK = ['very', 'really', 'just', 'quite', 'actually', 'basically', 'literally', 'simply', 'somewhat', 'rather', 'perhaps', 'maybe', 'probably', 'honestly', 'definitely', 'totally', 'extremely', 'fairly', 'obviously', 'certainly', 'essentially', 'virtually', 'i think', 'i guess', 'i believe', 'kind of', 'sort of'];
const NOT_PP = new Set('open often even seven ten then when green children kitchen golden garden screen token women men listen hidden sudden'.split(' '));
const reEsc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const STYLE_RE = new RegExp('\\b([A-Za-z]+)\\s+\\1\\b|\\b(?:' + [...Object.keys(STYLE_WORDY), ...STYLE_CLICHE].sort((a, b) => b.length - a.length).map(reEsc).join('|') + '|' + STYLE_WEAK.join('|') + '|(?:is|are|was|were|be|been|being)\\s+(?:\\w+ly\\s+)?\\w{2,}(?:ed|en))\\b', 'gi');
const TYPE_LABEL = { repeat: 'Repeated', wordy: 'Wordy', cliche: 'Cliché', weak: 'Weak', passive: 'Passive' };
function styleClass(m) {
  const low = m[0].toLowerCase().replace(/\s+/g, ' ');
  if (m[1] !== undefined) return low.split(' ')[0] === low.split(' ')[1] ? { t: 'repeat', msg: 'Repeated word', fix: m[1] } : null;
  if (low in STYLE_WORDY) { let f = STYLE_WORDY[low]; if (f && /^[A-Z]/.test(m[0])) f = f[0].toUpperCase() + f.slice(1); return { t: 'wordy', msg: f ? 'Wordy — try “' + f + '”' : 'Wordy — can usually be cut', fix: f }; }
  if (STYLE_CLICHE.includes(low)) return { t: 'cliche', msg: 'Cliché — say it in your own words', fix: null };
  if (STYLE_WEAK.includes(low)) return { t: 'weak', msg: 'Weak word — often better cut', fix: '' };
  const w = low.split(' ').pop(); if (NOT_PP.has(w) || /^(?:be|is|are|was|were|been|being)$/.test(w)) return null;
  return { t: 'passive', msg: 'Possible passive voice', fix: null };
}
function styleScan(text) {
  const skip = []; let fence = false, off = 0;
  for (const l of text.split('\n')) { if (FENCE.test(l)) { fence = !fence; skip.push([off, off + l.length]); } else if (fence || /^\s*\/\//.test(l)) skip.push([off, off + l.length]); off += l.length + 1; }
  const out = []; let m; STYLE_RE.lastIndex = 0;
  while ((m = STYLE_RE.exec(text))) {
    const i = m.index; if (skip.some(([a, b]) => i >= a && i < b)) continue;
    if (/[`\]]/.test(text[i - 1] || '') || /\(https?:[^)]*$/.test(text.slice(Math.max(0, i - 80), i))) continue;
    const c = styleClass(m); if (c) out.push({ i, len: m[0].length, text: m[0], ...c });
  }
  return out;
}
const posWrap0 = posWrap;
posWrap = function (text) {
  if (!S.style) return posWrap0(text);
  let out = '', last = 0, m; STYLE_RE.lastIndex = 0;
  while ((m = STYLE_RE.exec(text))) {
    const c = styleClass(m); if (!c) continue;
    out += posWrap0(text.slice(last, m.index)) + '<span class="sty sty-' + c.t + '" title="' + attr(c.msg) + '">' + esc(m[0]) + '</span>'; last = m.index + m[0].length;
  }
  return out + posWrap0(text.slice(last));
};
function fixEdit(t, is) {
  let a = is.i, b = is.i + is.len, rep = is.fix;
  if (rep === '') { if (t[b] === ' ') b++; else if (t[a - 1] === ' ') a--; if (/^[A-Z]/.test(is.text) && t[b] && /[a-z]/.test(t[b])) { rep = t[b].toUpperCase(); b++; } }
  return [a, b, rep];
}
function applyStyleFix(is) {
  const t = ed.value; if (t.slice(is.i, is.i + is.len) !== is.text) return toast('Text changed — refresh');
  const [a, b, rep] = fixEdit(t, is); replaceRange(a, b, rep, a + rep.length); refreshPanel();
}
function fixAllStyle() {
  const t = ed.value, list = styleScan(t).filter(x => x.fix !== null && x.t !== 'weak');
  if (!list.length) return toast('Nothing to fix automatically');
  let out = t; for (const is of list.reverse()) { const [a, b, rep] = fixEdit(out, is); out = out.slice(0, a) + rep + out.slice(b); }
  const p = ed.selectionStart; ed.focus(); ed.setSelectionRange(0, t.length); insertText(out); ed.setSelectionRange(Math.min(p, out.length), Math.min(p, out.length)); toast('Fixed ' + list.length + ' issues');
}
let styleList = [];
function styleHtml() {
  styleList = styleScan(ed.value);
  let h = '<h4>Style check <span>' + styleList.length + '</span></h4><label class="chk"><input type="checkbox" id="styleToggle"' + (S.style ? ' checked' : '') + '> Underline issues in the editor</label>';
  if (!styleList.length) return h + '<div class="empty">No style issues found. Nice.</div>';
  if (styleList.some(x => x.fix !== null && x.t !== 'weak')) h += '<button id="styleFixAll" class="wide">Apply safe fixes (wordy phrases, repeats)</button>';
  return h + styleList.slice(0, 40).map((x, k) => '<div class="item sty-i" data-s="' + k + '"><div class="s"><span class="chip sty-' + x.t + '">' + TYPE_LABEL[x.t] + '</span> ' + esc(x.text) + (x.fix ? ' → <b>' + esc(x.fix) + '</b>' : '') + '</div>' + (x.fix !== null ? '<div class="acts"><button data-a="fix">Fix</button></div>' : '') + '</div>').join('') + (styleList.length > 40 ? '<div class="empty">+' + (styleList.length - 40) + ' more</div>' : '');
}
$('#insightsList').addEventListener('change', e => { if (e.target.id === 'styleToggle') { S.style = e.target.checked; saveSettings(); applySettings(); syncSettingsForm(); } });
$('#insightsList').addEventListener('click', e => {
  if (e.target.id === 'styleFixAll') return fixAllStyle();
  const it = e.target.closest('[data-s]'); if (!it) return; const is = styleList[+it.dataset.s]; if (!is) return;
  if (e.target.closest('[data-a=fix]')) return applyStyleFix(is);
  ed.focus(); ed.setSelectionRange(is.i, is.i + is.len); ensureCaret(true); render();
});

/* ───────── tags + smart folders ───────── */
const TAG_RE = /(?<![\w&#\/="'])#([A-Za-z\u00C0-\u024F][\w\/-]*)/g;
function tagsOf(text) {
  const t = text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ').replace(/`[^`\n]*`/g, ' ').replace(/<[^>\n]+>/g, ' ').replace(/\]\([^)\n]*\)/g, '] ').replace(/^\s*\/\/.*$/gm, ' ').replace(/^#{1,6}\s.*$/gm, l => l);
  const set = new Set(); let m; TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(t))) set.add(m[1].toLowerCase().replace(/[-\/]+$/, ''));
  return set;
}
let folders = store.get('folders', []);
function matchDoc(d, q) {
  if (!q) return true;
  const txt = textOf(d), low = txt.toLowerCase(), days = (Date.now() - d.updated) / 864e5; let tags = null;
  for (const raw of q.match(/"[^"]+"|\S+/g) || []) {
    const tk = raw.replace(/"/g, '').toLowerCase(); let m;
    if (tk[0] === '#' && tk.length > 1) { tags = tags || tagsOf(txt); if (![...tags].some(x => x === tk.slice(1) || x.startsWith(tk.slice(1) + '/'))) return false; }
    else if ((m = tk.match(/^(older|newer):(\d+)$/))) { if (m[1] === 'older' ? !(days > +m[2]) : !(days < +m[2])) return false; }
    else if ((m = tk.match(/^words([<>])(\d+)$/))) { const n = countWords(txt); if (m[1] === '>' ? !(n > +m[2]) : !(n < +m[2])) return false; }
    else if (tk === 'pinned') { if (!d.pinned) return false; }
    else if (tk === 'has:image') { if (!/!\[[^\]]*\]\(/.test(txt)) return false; }
    else if (tk === 'has:task') { if (!/^\s*[-*+]\s+\[ \]/m.test(txt)) return false; }
    else if (tk === 'has:link') { if (!/\[\[|\]\(http/.test(txt)) return false; }
    else if (!low.includes(tk)) return false;
  }
  return true;
}
function libBar(q) {
  const counts = {}; for (const d of liveDocs()) for (const t of tagsOf(textOf(d))) counts[t] = (counts[t] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14), raw = $('#search').value.trim();
  const bar = document.createElement('div'); bar.className = 'tagbar';
  bar.innerHTML = folders.map((f, i) => '<span class="chip fold' + (f.q.toLowerCase() === q ? ' on' : '') + '" data-q="' + attr(f.q) + '" title="' + attr(f.q) + '">📁 ' + esc(f.name) + ' <i data-del="' + i + '" title="Delete folder">✕</i></span>').join('') +
    top.map(([t, n]) => '<span class="chip tg' + (q === '#' + t ? ' on' : '') + '" data-q="#' + attr(t) + '">#' + esc(t) + ' <small>' + n + '</small></span>').join('') +
    (raw && !folders.some(f => f.q === raw) ? '<span class="chip save" data-save="1">＋ Save as smart folder</span>' : '') + (raw ? '<span class="chip clr" data-clear="1">Clear</span>' : '');
  if (!bar.innerHTML) bar.innerHTML = '<span class="hint">Add #tags to notes, or search with older:7, words&gt;500, has:image, pinned…</span>';
  bar.onclick = e => {
    const del = e.target.closest('[data-del]'); if (del) { e.stopPropagation(); folders.splice(+del.dataset.del, 1); store.set('folders', folders); return renderLibrary(); }
    if (e.target.closest('[data-clear]')) { $('#search').value = ''; return renderLibrary(); }
    if (e.target.closest('[data-save]')) { const n = prompt('Name this smart folder', raw.replace(/[#"]/g, '').slice(0, 24)); if (n && n.trim()) { folders.push({ name: n.trim().slice(0, 30), q: raw }); store.set('folders', folders); renderLibrary(); } return; }
    const c = e.target.closest('[data-q]'); if (c) { $('#search').value = $('#search').value.trim() === c.dataset.q ? '' : c.dataset.q; renderLibrary(); }
  };
  return bar;
}
function filterTag(t) { toggleSidebar(true); setTab('lib'); $('#search').value = '#' + t; renderLibrary(); }
const TAG_SNIP = '#$0';

/* ───────── outline cards ───────── */
function splitSections(t) {
  let fence = false, off = 0; const heads = [];
  for (const l of t.split('\n')) { if (FENCE.test(l)) fence = !fence; const m = !fence && l.match(/^(#{1,6})\s+(.*)$/); if (m) heads.push({ off, level: m[1].length, title: m[2].trim() }); off += l.length + 1; }
  const cnt = {}; heads.forEach(h => cnt[h.level] = (cnt[h.level] || 0) + 1);
  const lvl = Object.keys(cnt).map(Number).sort((a, b) => a - b).find(k => cnt[k] >= 2) || (heads.length ? Math.min(...heads.map(h => h.level)) : 0);
  const sp = heads.filter(h => h.level === lvl); if (!sp.length) return { pre: t, secs: [] };
  return { pre: t.slice(0, sp[0].off), secs: sp.map((h, i) => ({ title: h.title, level: h.level, text: t.slice(h.off, i + 1 < sp.length ? sp[i + 1].off : t.length) })) };
}
const CARDS = { pre: '', secs: [], drag: -1, dirty: false };
function openCards() {
  const sp = splitSections(ed.value);
  if (!sp.secs.length) return toast('Add some headings first, then rearrange the sections here');
  CARDS.pre = sp.pre; CARDS.secs = sp.secs; CARDS.dirty = false;
  let el = $('#cards');
  if (!el) {
    el = document.createElement('div'); el.id = 'cards'; el.className = 'overlay';
    el.innerHTML = '<div class="card cards"><div class="set-head"><div><h2>Rearrange sections</h2><small>Drag cards (or use ◀ ▶) — then apply</small></div><div class="spacer"></div><button id="cdAdd">＋ Section</button><button id="cdApply" class="primary">Apply order</button><button id="cdClose" class="icon" aria-label="Close">✕</button></div><div id="cdGrid" class="cd-grid"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('mousedown', e => { if (e.target === el) closeCards(); });
    el.querySelector('#cdClose').onclick = () => closeCards(); el.querySelector('#cdApply').onclick = applyCards;
    el.querySelector('#cdAdd').onclick = () => { CARDS.secs.push({ title: 'New section', level: CARDS.secs[0].level, text: '#'.repeat(CARDS.secs[0].level) + ' New section\n\n' }); CARDS.dirty = true; drawCards(); };
    const g = el.querySelector('#cdGrid');
    g.addEventListener('click', e => {
      const c = e.target.closest('.cd'); if (!c) return; const i = +c.dataset.i, b = e.target.closest('[data-m]');
      if (b) { moveCard(i, i + (b.dataset.m === 'l' ? -1 : 1)); return; }
      if (e.target.closest('[data-x]')) { if (confirm('Remove this section from the document?')) { CARDS.secs.splice(i, 1); CARDS.dirty = true; drawCards(); } return; }
    });
    g.addEventListener('dragstart', e => { const c = e.target.closest('.cd'); if (!c) return; CARDS.drag = +c.dataset.i; e.dataTransfer.setData('text/plain', 'card'); e.dataTransfer.effectAllowed = 'move'; c.classList.add('lift'); });
    g.addEventListener('dragend', () => { CARDS.drag = -1; g.querySelectorAll('.lift,.over').forEach(x => x.classList.remove('lift', 'over')); });
    g.addEventListener('dragover', e => { if (CARDS.drag < 0) return; e.preventDefault(); const c = e.target.closest('.cd'); g.querySelectorAll('.over').forEach(x => x.classList.remove('over')); if (c) c.classList.add('over'); });
    g.addEventListener('drop', e => { if (CARDS.drag < 0) return; e.preventDefault(); const c = e.target.closest('.cd'); if (c) moveCard(CARDS.drag, +c.dataset.i); CARDS.drag = -1; });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeCards(); } });
  }
  el.hidden = false; drawCards(); el.querySelector('#cdApply').focus();
}
function moveCard(from, to) { const s = CARDS.secs; if (from === to || to < 0 || to >= s.length) return; s.splice(to, 0, s.splice(from, 1)[0]); CARDS.dirty = true; drawCards(); }
function drawCards() {
  $('#cdGrid').innerHTML = CARDS.secs.map((s, i) => {
    const body = s.text.replace(/^#+[^\n]*\n?/, '').replace(/^#{1,6}\s.*$/gm, '').replace(/[*_`>#\[\]]/g, '').replace(/\s+/g, ' ').trim();
    return '<div class="cd l' + s.level + '" draggable="true" data-i="' + i + '"><div class="cd-n">' + (i + 1) + '</div><b>' + esc(s.title.replace(/<[^>]+>/g, '')) + '</b><p>' + esc(body.slice(0, 130)) + '</p><div class="cd-f"><span>' + countWords(s.text) + ' words</span><span class="cd-a"><button data-m="l" title="Move earlier"' + (i ? '' : ' disabled') + '>◀</button><button data-m="r" title="Move later"' + (i < CARDS.secs.length - 1 ? '' : ' disabled') + '>▶</button><button data-x title="Remove">✕</button></span></div></div>';
  }).join('');
}
function cardsText() { const p = CARDS.pre.replace(/\s+$/, ''); return (p ? p + '\n\n' : '') + CARDS.secs.map(s => s.text.replace(/\s+$/, '')).join('\n\n') + '\n'; }
function closeCards() { const el = $('#cards'); if (!el) return; if (CARDS.dirty && !confirm('Discard the new order?')) return; el.hidden = true; ed.focus(); }
function applyCards() {
  if (CARDS.dirty) { const out = cardsText(); ed.focus(); ed.setSelectionRange(0, ed.value.length); insertText(out); ed.setSelectionRange(0, 0); toast('Sections rearranged'); }
  CARDS.dirty = false; $('#cards').hidden = true; ed.focus();
}

const TOOL_COMMANDS = [
  ['Rearrange sections (outline cards)', mod_() + ' ⇧ O', openCards],
  ['Style check: toggle underlines', '', () => { S.style = !S.style; saveSettings(); applySettings(); syncSettingsForm(); toast('Style check ' + (S.style ? 'on' : 'off')); }],
  ['Style check: apply safe fixes', '', fixAllStyle],
  ['Show style issues', '', () => { toggleSidebar(true); setTab('insights'); }],
  ['Filter library by tag…', '', () => { const t = prompt('Tag (without #)'); if (t) filterTag(t.replace(/^#/, '')); }],
  ['Insert tag', '', () => insertText('#')]
];

$('#outlineList').addEventListener('click', e => { if (e.target.id === 'cardsBtn') openCards(); });
/* ───────── themes picker, daily note, presentation, reading mode, table tools ───────── */
const ACCENTS = ['#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ff9f0a', '#30b0c7', '#32d74b', '#8e8e93'];
function setTheme(id) { S.theme = id; saveSettings(); applySettings(); syncSettingsForm(); }
function drawSwatches() {
  const a = $('#themeSw'); if (!a) return;
  a.innerHTML = [['auto', 'Auto', 'linear-gradient(90deg,#fff 50%,#1c1c1e 50%)', '#888', 0], ...THEMES.map(t => [t[0], t[1], t[2], t[3], t[4]])].map(([id, l, bg, fg]) => '<button class="sw-t' + (S.theme === id ? ' on' : '') + '" data-t="' + id + '" title="' + l + '" style="--b:' + bg + ';--f:' + fg + '"><i>Aa</i><span>' + l + '</span></button>').join('');
  $('#accSw').innerHTML = ACCENTS.map(c => '<button class="sw-a' + (S.accent.toLowerCase() === c ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '" title="' + c + '" aria-label="Accent ' + c + '"></button>').join('');
}
$('#themeSw').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) setTheme(b.dataset.t); });
$('#accSw').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { S.accent = b.dataset.c; saveSettings(); applySettings(); syncSettingsForm(); } });

function openDaily() {
  const title = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const d = liveDocs().find(x => norm(titleOf({ text: textOf(x) })) === norm(title));
  if (d) { openDoc(d.id); return toast('Today’s note'); }
  const t = '# ' + title + '\n\n## Plan\n\n- [ ] \n\n## Notes\n\n\n\n## Reflection\n\n';
  newDoc(t); const p = t.indexOf('- [ ] ') + 6; ed.setSelectionRange(p, p); ensureCaret(false); render();
}

function toggleReading(force) {
  const on = force ?? !document.body.classList.contains('reading');
  document.body.classList.toggle('reading', on);
  $('#preview').hidden = on ? false : !S.preview;
  if (on) updatePreview(); else ed.focus();
  if (on) toast('Reading mode · Esc to exit');
}

function splitSlides(t) {
  const lines = t.replace(/\r\n?/g, '\n').split('\n'); let fence = false;
  const hasHr = lines.some(l => { if (FENCE.test(l)) fence = !fence; return !fence && /^\s*([-*_])(\s*\1){2,}\s*$/.test(l); });
  const out = []; let cur = []; fence = false;
  const push = () => { const s = cur.join('\n').trim(); if (s) out.push(s); cur = []; };
  for (const l of lines) {
    if (FENCE.test(l)) fence = !fence;
    if (!fence && hasHr && /^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { push(); continue; }
    if (!fence && !hasHr && /^#{1,2}\s/.test(l)) push();
    cur.push(l);
  }
  push(); return out;
}
const PR = { i: 0, slides: [] };
function openPresent() {
  PR.slides = splitSlides(ed.value); if (!PR.slides.length) return toast('Nothing to present yet');
  let el = $('#present');
  if (!el) {
    el = document.createElement('div'); el.id = 'present';
    el.innerHTML = '<div id="prSlide" class="md"></div><div id="prBar"><i></i></div><div id="prHint">← → to move · Esc to exit</div><button id="prClose" class="icon" aria-label="Exit presentation">✕</button>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target.closest('#prClose')) return closePresent(); prGo(e.clientX < innerWidth * .3 ? -1 : 1); });
  }
  PR.i = 0; el.hidden = false; document.addEventListener('keydown', prKey, true); drawSlide(0);
  try { if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => { }); } catch (e) { }
}
function drawSlide(dir) {
  const s = $('#prSlide'), t = PR.slides[PR.i], title = /^#\s/.test(t) && t.split('\n').filter(x => x.trim()).length <= 2;
  s.className = 'md' + (title ? ' pr-title' : '');
  s.innerHTML = renderMarkdown(t);
  s.style.animation = 'none'; void s.offsetWidth; s.style.animation = dir < 0 ? 'prInL .45s var(--spring)' : 'prInR .45s var(--spring)';
  $('#prBar i').style.width = ((PR.i + 1) / PR.slides.length * 100) + '%';
}
function prGo(d) { const n = PR.i + d; if (n < 0 || n >= PR.slides.length) return; PR.i = n; drawSlide(d); }
function prKey(e) {
  const k = e.key; let h = true;
  if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown' || k === 'Enter') prGo(1);
  else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') prGo(-1);
  else if (k === 'Home') { PR.i = 0; drawSlide(-1); } else if (k === 'End') { PR.i = PR.slides.length - 1; drawSlide(1); }
  else if (k === 'Escape') closePresent(); else h = false;
  if (h) { e.preventDefault(); e.stopPropagation(); }
}
function closePresent() {
  const el = $('#present'); if (!el) return; el.hidden = true; document.removeEventListener('keydown', prKey, true);
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { } ed.focus();
}

function formatTable() {
  const t = ed.value, p = ed.selectionStart, lines = t.split('\n'), isRow = l => /^\s*\|.*\|\s*$/.test(l);
  let off = 0, idx = -1; for (let i = 0; i < lines.length; i++) { if (p >= off && p <= off + lines[i].length) { idx = i; break; } off += lines[i].length + 1; }
  if (idx < 0 || !isRow(lines[idx])) return toast('Put the cursor inside a table first');
  let a = idx, b = idx; while (a > 0 && isRow(lines[a - 1])) a--; while (b < lines.length - 1 && isRow(lines[b + 1])) b++;
  const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const rows = lines.slice(a, b + 1).map(cells), si = rows.length > 1 && rows[1].every(c => /^:?-{2,}:?$/.test(c)) ? 1 : -1;
  const n = Math.max(...rows.map(r => r.length)), al = [], w = [];
  for (let c = 0; c < n; c++) { const m = si > 0 ? rows[si][c] || '' : ''; al[c] = /^:-+:$/.test(m) ? 'c' : /-:$/.test(m) ? 'r' : /^:-/.test(m) ? 'l' : ''; w[c] = Math.max(3, ...rows.map((r, i) => i === si ? 0 : (r[c] || '').length)); }
  const pad = (s, c) => al[c] === 'r' ? s.padStart(w[c]) : al[c] === 'c' ? s.padStart(Math.floor((w[c] + s.length) / 2)).padEnd(w[c]) : s.padEnd(w[c]);
  const out = rows.map((r, i) => '| ' + Array.from({ length: n }, (_, c) => i === si ? (al[c] === 'c' ? ':' + '-'.repeat(w[c] - 2) + ':' : al[c] === 'r' ? '-'.repeat(w[c] - 1) + ':' : al[c] === 'l' ? ':' + '-'.repeat(w[c] - 1) : '-'.repeat(w[c])) : pad(r[c] || '', c)).join(' | ') + ' |').join('\n');
  let s = 0; for (let i = 0; i < a; i++) s += lines[i].length + 1; const e = s + lines.slice(a, b + 1).join('\n').length;
  replaceRange(s, e, out, s + out.length); toast('Table formatted');
}
function snip(body, q) {
  const toks = (q.match(/"[^"]+"|\S+/g) || []).map(x => x.replace(/"/g, '')).filter(x => x && !/^(#|older:|newer:|words[<>]|has:|pinned$)/.test(x));
  if (!toks.length) return body.slice(0, 50);
  const low = body.toLowerCase(); let i = -1; for (const tk of toks) { i = low.indexOf(tk); if (i >= 0) break; }
  return i < 0 ? body.slice(0, 50) : (i > 20 ? '…' : '') + body.slice(Math.max(0, i - 20), i + 50);
}
const FEAT_COMMANDS = [
  ['Today’s daily note', mod_() + ' ⇧ D', openDaily],
  ['Present as slides', '', openPresent],
  ['Reading mode', '', () => toggleReading()],
  ['Format table at cursor', '', formatTable],
  ...[['auto', 'Auto'], ...THEMES.map(t => [t[0], t[1]])].map(([id, l]) => ['Theme: ' + l, '', () => setTheme(id)])
];

COMMANDS.push(...MORE_COMMANDS, ...RESEARCH_COMMANDS, ...EXTRA_COMMANDS, ...NEW_COMMANDS, ...TOOL_COMMANDS, ...FEAT_COMMANDS);
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
  const imgs = [...items].filter(it => it.kind === 'file' && it.type.startsWith('image/')).map(it => it.getAsFile()).filter(Boolean);
  if (imgs.length) { e.preventDefault(); imgs.forEach(insertImageFile); return; }
  void html;
});
['mousemove', 'mousedown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => document.body.classList.remove('typing'), { passive: true }));
ed.addEventListener('blur', () => { flush(); hidePop(); });
addEventListener('beforeunload', flush);
addEventListener('pagehide', flush);
addEventListener('resize', () => { render(); });
scroller.addEventListener('mousedown', e => { if (e.target === scroller || e.target.id === 'column') { ed.focus(); const l = ed.value.length; if (e.offsetY > inner.offsetTop) ed.setSelectionRange(l, l); } });
$('#preview').addEventListener('click', e => {
  const tg = e.target.closest('a.tag'); if (tg) { e.preventDefault(); filterTag(tg.dataset.tag); return; }
  const w = e.target.closest('a.wiki'); if (w) { e.preventDefault(); openWiki(w.dataset.wiki); return; }
  const a = e.target.closest('a[href^="#"]');
  if (a) { e.preventDefault(); const id = a.getAttribute('href').slice(1); try { $('#preview').querySelector('[id="' + id.replace(/"/g, '') + '"]')?.scrollIntoView(); } catch (_) { } }
});

document.addEventListener('keydown', e => {
  const m = e.metaKey || e.ctrlKey; const k = e.key.toLowerCase();
  if (e.key === 'Escape') {
    if (!$('#studio').hidden) return;
    if ($('#cards') && !$('#cards').hidden) return;
    if (document.body.classList.contains('reading')) return toggleReading(false);
    if (!$('#tplModal')?.hidden && $('#tplModal')) { $('#tplModal').hidden = true; ed.focus(); return; }
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
  else if (k === 'e' && e.shiftKey) run(openStudio);
  else if (k === 'o' && e.shiftKey) run(openCards);
  else if (k === 'd' && e.shiftKey) run(openDaily);
  else if (k === '/') run(toggleComment);
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
addEventListener('drop', e => { e.preventDefault(); dragN = 0; if (!$('#studio').hidden) return; document.body.classList.remove('drop'); if (e.dataTransfer?.files?.length) handleFiles([...e.dataTransfer.files]); });

// desktop wrapper hooks (Electron menu)
window.wren = { openDaily, openPresent, toggleReading, formatTable, setTheme, openCards, openStudio, openTemplates, newDoc, saveFile, openFromDisk, togglePreview, cycleFocus, toggleZen, openPalette, openSettings, exports: EXPORTS, importFiles, backupAll, exportZip, readAloud, startTimer, stopTimer, _t: { splitSlides, snip, THEMES, styleScan, applyStyleFix, fixAllStyle, tagsOf, matchDoc, splitSections, CARDS, moveCard, applyCards, renderMarkdown, countWords, fullHtml, setPV: v => { S.pvTheme = v; }, d2mHtml, splitBlocks, storeImage, mdOut, studioMarkdown, applyStudio, stApplyColor, stInsertHtml, stInsertImage, renderEmbed, toggleComment, analyze, buildZip, openWiki, fromTemplate, parseMusic, playMusic, isVideoUrl, showStats, setSrc } };

/* ───────── boot ───────── */
document.body.classList.toggle('nosb', !S.sidebar || innerWidth <= 820);
$('#preview').hidden = !S.preview;
$('#previewBtn').style.background = S.preview ? 'var(--panel)' : '';
for (const d of Object.values(docs)) if (d.images) { let ch = false; for (const k in d.images) if (!d.text.includes('img:' + k) && !(d.history || []).some(h => h.text.includes('img:' + k))) { delete d.images[k]; ch = true; } if (ch) store.set('docs', docs); }
ed.value = docs[curId].text;
applySettings(); renderLibrary(); updatePreview();
if (!ed.value || ed.value === WELCOME) { /* show welcome from the top */ }
ed.focus({ preventScroll: true }); ed.setSelectionRange(ed.value.length > 400 ? 0 : ed.value.length, ed.value.length > 400 ? 0 : ed.value.length);
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
