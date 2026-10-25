/*!
 * app.js — BK프롬: 프롬프트 · 결과물 · 이미지 보관함
 * 저장: IndexedDB (db.js) · 백업/복원: JSON 파일 (사진은 글자로 바꿔 함께 담음)
 */
(function () {
  'use strict';
  const DB = window.BKPROM_DB;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const CATS = {
    prompt: ['인사카드', '프로필·홍보', '말씀카드', '이모티콘', '이벤트카드', '움직이는 카드', '쇼츠·영상', '업무', '기타'],
    image: ['증명사진', '로고', '도장·서명', '명함', '배경', '기타'],
  };
  const UI_KEY = 'bk-prom.ui';
  let ui = { tab: 'prompt', sort: 'new' };
  try { Object.assign(ui, JSON.parse(localStorage.getItem(UI_KEY) || '{}')); } catch (e) { /* 무시 */ }
  const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* 무시 */ } };
  let items = [], cat = 'all', urls = [];

  // ═════════ 공통 ═════════
  let toastT = 0;
  function toast(m, ms = 2600) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = n => String(n).padStart(2, '0');
  function fmtDate(t) { const d = new Date(t); return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`; }
  function stamp() { const d = new Date(); return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`; }
  const objUrl = b => { const u = URL.createObjectURL(b); urls.push(u); return u; };
  async function copyText(t) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; } } catch (e) { /* 아래 방법 */ }
    const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } a.remove(); return ok;
  }
  function download(blob, name) {
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
  function loadImg(src) {
    return new Promise((res, rej) => { const u = typeof src === 'string' ? src : URL.createObjectURL(src); const im = new Image();
      im.onload = () => { res(im); if (typeof src !== 'string') setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = () => rej(new Error('사진을 열 수 없어요')); im.src = u; });
  }
  /** 사진 정리: 너무 큰 사진은 줄여서 저장 (투명 PNG 로고는 그대로) + 목록용 작은 사진 */
  async function prepImage(file) {
    const im = await loadImg(file);
    const w = im.naturalWidth, h = im.naturalHeight;
    let blob = file;
    const big = Math.max(w, h) > 2600 || file.size > 4 * 1048576;
    if (big || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      const sc = Math.min(1, 2600 / Math.max(w, h)), c = document.createElement('canvas');
      c.width = Math.round(w * sc); c.height = Math.round(h * sc);
      const x = c.getContext('2d');
      const png = file.type === 'image/png';
      if (!png) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
      x.drawImage(im, 0, 0, c.width, c.height);
      blob = await new Promise(r => c.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.9));
    }
    const ts = Math.min(1, 360 / Math.max(w, h)), tc = document.createElement('canvas');
    tc.width = Math.max(1, Math.round(w * ts)); tc.height = Math.max(1, Math.round(h * ts));
    tc.getContext('2d').drawImage(im, 0, 0, tc.width, tc.height);
    const thumb = tc.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.8);
    return { blob, thumb, w, h };
  }
  function blobToDataUrl(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); }); }
  async function dataUrlToBlob(u) { return (await fetch(u)).blob(); }
  const extOf = b => (b && b.type === 'image/png' ? 'png' : b && b.type === 'image/webp' ? 'webp' : 'jpg');
  const fileName = (title, b) => `${(title || 'BK프롬').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40)}.${extOf(b)}`;

  // ═════════ 목록 ═════════
  async function load() {
    try { items = await DB.all(); } catch (e) { items = []; toast('저장소를 열 수 없어요. 시크릿 모드라면 일반 창에서 열어 주세요', 5000); }
    render();
  }
  function stat() {
    const np = items.filter(i => i.type === 'prompt').length, ni = items.filter(i => i.type === 'image').length;
    let t = `프롬프트 ${np}개 · 이미지 ${ni}개`;
    $('#stat').textContent = t;
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => {
      if (e && e.usage != null) $('#stat').textContent = `${t} · 사용 ${(e.usage / 1048576).toFixed(1)}MB`;
    }).catch(() => {});
  }
  function renderChips() {
    const used = new Set(items.filter(i => i.type === ui.tab).map(i => i.cat).filter(Boolean));
    const list = CATS[ui.tab].filter(c => used.has(c)).concat([...used].filter(c => !CATS[ui.tab].includes(c)));
    const all = [['all', '전체'], ['fav', '⭐ 즐겨찾기']].concat(list.map(c => [c, c]));
    if (!all.some(([v]) => v === cat)) cat = 'all';
    $('#catChips').innerHTML = all.map(([v, l]) => `<button type="button" data-c="${esc(v)}" aria-pressed="${v === cat}">${esc(l)}</button>`).join('');
  }
  function filtered() {
    const q = $('#q').value.trim().toLowerCase();
    let arr = items.filter(i => i.type === ui.tab);
    if (cat === 'fav') arr = arr.filter(i => i.fav);
    else if (cat !== 'all') arr = arr.filter(i => i.cat === cat);
    if (q) arr = arr.filter(i => [i.title, i.cat, i.prompt, i.result, i.memo, i.src].join(' ').toLowerCase().includes(q));
    const s = ui.sort;
    arr.sort((a, b) => s === 'old' ? a.created - b.created : s === 'name' ? (a.title || '').localeCompare(b.title || '', 'ko') : s === 'used' ? (b.used || 0) - (a.used || 0) || b.updated - a.updated : b.updated - a.updated);
    return arr;
  }
  function render() {
    urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
    $$('.tabs button').forEach(b => { if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    $('#sort').value = ui.sort;
    stat(); renderChips();
    const arr = filtered(), L = $('#list');
    L.className = 'list' + (ui.tab === 'image' ? ' images' : '');
    $('#empty').hidden = arr.length > 0;
    if (!arr.length) {
      const none = !items.some(i => i.type === ui.tab);
      $('#empty').innerHTML = none
        ? (ui.tab === 'prompt' ? '아직 저장한 프롬프트가 없어요.<br>아래 <b>＋ 새로 저장</b>을 눌러 자주 쓰는 프롬프트를 넣어 보세요.<br><small>BK톡톡에서 만든 프롬프트도 바로 보낼 수 있어요.</small>' : '아직 저장한 사진이 없어요.<br>아래 <b>＋ 새로 저장</b>으로 증명사진 · 로고 · 도장을 넣어 두세요.')
        : '찾는 항목이 없어요. 검색어나 분류를 바꿔 보세요.';
    }
    L.innerHTML = ui.tab === 'prompt' ? arr.map(promptCard).join('') : arr.map(imageCard).join('');
    if (ui.tab === 'prompt') {
      arr.forEach(it => {
        const box = L.querySelector(`[data-id="${it.id}"] .res-imgs`);
        if (box && it.images) it.images.forEach((b, k) => { const im = document.createElement('img'); im.src = objUrl(b); im.alt = `결과 사진 ${k + 1}`; im.dataset.k = k; im.loading = 'lazy'; box.appendChild(im); });
      });
      $$('.blk pre').forEach(p => { if (p.scrollHeight > p.clientHeight + 4) p.parentNode.querySelector('.more').hidden = false; });
    }
  }
  function promptCard(it) {
    return `<article class="card" data-id="${it.id}">
      <div class="c-head"><div><h3 class="c-title">${esc(it.title)}</h3>
        <div class="c-meta">${it.cat ? `<span class="badge">${esc(it.cat)}</span>` : ''}${it.src ? `<span>📥 ${esc(it.src)}</span>` : ''}<span>${fmtDate(it.updated)}</span>${it.used ? `<span>복사 ${it.used}회</span>` : ''}</div></div>
        <button type="button" class="star${it.fav ? ' on' : ''}" data-a="fav" aria-label="즐겨찾기">⭐</button></div>
      ${it.prompt ? `<div class="blk"><div class="blk-h">📝 프롬프트<button type="button" class="copy" data-a="copyP">📋 복사</button></div><pre>${esc(it.prompt)}</pre><button type="button" class="more" data-a="more" hidden>더 보기 ▾</button></div>` : ''}
      ${it.result ? `<div class="blk"><div class="blk-h">✨ 결과물<button type="button" class="copy" data-a="copyR">📋 복사</button></div><pre>${esc(it.result)}</pre><button type="button" class="more" data-a="more" hidden>더 보기 ▾</button></div>` : ''}
      ${it.images && it.images.length ? '<div class="res-imgs"></div>' : ''}
      <div class="c-acts"><button type="button" class="btn kakao" data-a="kakao">💬 카톡</button><button type="button" class="btn" data-a="edit">✏️ 수정</button><button type="button" class="btn danger" data-a="del">🗑 삭제</button></div>
    </article>`;
  }
  function imageCard(it) {
    return `<div class="icard" data-id="${it.id}" role="button" tabindex="0" aria-label="${esc(it.title)} 크게 보기">
      <div class="ph"><img src="${it.thumb || ''}" alt="" loading="lazy"></div>
      ${it.fav ? '<span class="fav">⭐</span>' : ''}
      <div class="cap">${esc(it.title)}<small>${esc(it.cat || '')}${it.w ? ` · ${it.w}×${it.h}` : ''}</small></div></div>`;
  }

  // ═════════ 목록 이벤트 ═════════
  $$('.tabs button').forEach(b => b.addEventListener('click', () => { ui.tab = b.dataset.tab; cat = 'all'; saveUi(); render(); }));
  $('#catChips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.c; render(); });
  let qT = 0; $('#q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(render, 200); });
  $('#sort').addEventListener('change', () => { ui.sort = $('#sort').value; saveUi(); render(); });
  const byId = id => items.find(i => i.id === id);
  async function bump(it) { it.used = (it.used || 0) + 1; try { await DB.put(it); } catch (e) { /* 무시 */ } }
  $('#list').addEventListener('click', async e => {
    const card = e.target.closest('[data-id]'); if (!card) return;
    const it = byId(card.dataset.id); if (!it) return;
    if (card.classList.contains('icard')) { openView(it); return; }
    const im = e.target.closest('.res-imgs img');
    if (im) { openView(it, +im.dataset.k); return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'copyP' || a === 'copyR') {
      const ok = await copyText(a === 'copyP' ? it.prompt : it.result);
      toast(ok ? (a === 'copyP' ? '✅ 프롬프트를 복사했어요' : '✅ 결과물을 복사했어요') : '복사가 안 돼요. 글을 길게 눌러 복사해 주세요');
      if (ok) bump(it);
    } else if (a === 'more') {
      const blk = b.closest('.blk'); blk.classList.toggle('open'); b.textContent = blk.classList.contains('open') ? '접기 ▴' : '더 보기 ▾';
    } else if (a === 'fav') {
      it.fav = !it.fav; await DB.put(it); render();
    } else if (a === 'kakao') sharePrompt(it);
    else if (a === 'edit') openEdit(it);
    else if (a === 'del') delItem(it);
  });
  $('#list').addEventListener('keydown', e => { if (e.key === 'Enter') { const c = e.target.closest('.icard'); if (c) openView(byId(c.dataset.id)); } });

  async function delItem(it) {
    if (!confirm(`‘${it.title}’ 을(를) 삭제할까요?\n삭제하면 되돌릴 수 없어요.`)) return;
    await DB.del(it.id);
    items = items.filter(i => i.id !== it.id);
    render(); toast('🗑 삭제했어요');
  }

  // ═════════ 카카오톡 보내기 (휴대폰 공유 창 → 카카오톡) ═════════
  function promptText(it) {
    let t = `📌 ${it.title}\n`;
    if (it.prompt) t += `\n📝 프롬프트\n${it.prompt}\n`;
    if (it.result) t += `\n✨ 결과물\n${it.result}\n`;
    return t.trim();
  }
  async function shareTo(data, fallbackText) {
    let ok = false;
    try { ok = !!navigator.share && (!data.files || (navigator.canShare && navigator.canShare(data))); } catch (e) { ok = false; }
    if (ok) {
      try { await navigator.share(data); return true; } catch (e) { if (e && e.name === 'AbortError') return true; }
      if (data.files && data.text) { try { await navigator.share({ text: data.text }); return true; } catch (e) { if (e && e.name === 'AbortError') return true; } }
    }
    if (fallbackText) { await copyText(fallbackText); toast('📋 복사했어요 · 카카오톡 대화방 입력칸을 길게 눌러 붙여넣기 하세요', 5000); }
    return false;
  }
  async function sharePrompt(it) {
    const text = promptText(it);
    const files = (it.images || []).slice(0, 5).map((b, k) => new File([b], `${it.title}_${k + 1}.${extOf(b)}`, { type: b.type || 'image/jpeg' }));
    await shareTo(files.length ? { text, files } : { text }, text);
    bump(it);
  }

  // ═════════ 사진 크게 보기 ═════════
  let vItem = null, vIdx = 0, vBlob = null;
  function openView(it, k = 0) {
    vItem = it; vIdx = k;
    vBlob = it.type === 'image' ? it.blob : (it.images || [])[k];
    if (!vBlob) return;
    $('#vImg').src = objUrl(vBlob);
    $('#vTitle').textContent = it.title + (it.type === 'prompt' ? ` · 결과 사진 ${k + 1}` : '');
    $('#vInfo').textContent = [it.cat, it.w ? `${it.w}×${it.h}` : '', `${Math.round(vBlob.size / 1024)}KB`, it.memo].filter(Boolean).join(' · ');
    $$('#viewDlg [data-v="edit"], #viewDlg [data-v="del"]').forEach(b => { b.hidden = it.type !== 'image'; });
    $('#viewDlg').showModal();
  }
  $('#vClose').addEventListener('click', () => $('#viewDlg').close());
  $('#viewDlg').addEventListener('click', async e => {
    if (e.target === $('#viewDlg')) { $('#viewDlg').close(); return; }
    const b = e.target.closest('[data-v]'); if (!b || !vItem) return;
    const v = b.dataset.v, name = fileName(vItem.title, vBlob);
    if (v === 'down') { download(vBlob, name); toast('⬇ 내 파일 → 다운로드 폴더에 저장했어요'); }
    else if (v === 'kakao') {
      const f = new File([vBlob], name, { type: vBlob.type || 'image/jpeg' });
      const ok = await shareTo({ files: [f] }, null);
      if (!ok) { download(vBlob, name); toast('사진을 저장했어요 · 카톡 대화방 ＋ → 앨범에서 보내 주세요', 5000); }
    } else if (v === 'copy') {
      try {
        const im = await loadImg(vBlob), c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
        const png = await new Promise(r => c.toBlob(r, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
        toast('✅ 이미지를 복사했어요 · 붙여넣기 할 곳에서 길게 누르세요');
      } catch (err) { toast('이 휴대폰은 이미지 복사가 안 돼요 · ⬇ 다운로드를 이용해 주세요', 4000); }
    } else if (v === 'shorts') {
      try {
        const im = await loadImg(vBlob), S = 420, c = document.createElement('canvas'); c.width = c.height = S;
        const iw = im.naturalWidth, ih = im.naturalHeight, sc = Math.max(S / iw, S / ih), x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, S, S);
        x.drawImage(im, (S - iw * sc) / 2, (S - ih * sc) * 0.3, iw * sc, ih * sc);
        const K = 'bk-shorts.card', d = JSON.parse(localStorage.getItem(K) || '{}');
        d.face = c.toDataURL('image/jpeg', 0.85); if (!d.info) d.info = {};
        localStorage.setItem(K, JSON.stringify(d));
        toast('🪪 BK쇼츠 명함 얼굴 사진으로 넣었어요 · BK쇼츠를 열면 바로 보여요', 4500);
      } catch (err) { toast('넣지 못했어요'); }
    } else if (v === 'edit') { $('#viewDlg').close(); openEdit(vItem); }
    else if (v === 'del') { $('#viewDlg').close(); delItem(vItem); }
  });

  // ═════════ 저장 · 수정 ═════════
  let eItem = null, eType = 'prompt', eImgs = [], eNew = [];
  function thumbsHtml(list) { return list.map((b, k) => `<span><img src="${objUrl(b.blob || b)}" alt=""><button type="button" data-x="${k}" aria-label="빼기">✕</button></span>`).join(''); }
  function renderEditThumbs() {
    $('#fResImgs').innerHTML = thumbsHtml(eImgs);
    $('#fImgPrev').innerHTML = thumbsHtml(eNew);
    $('#fImgPick').hidden = !!eItem && eNew.length > 0;
  }
  function openEdit(it, type) {
    eItem = it || null; eType = it ? it.type : (type || ui.tab);
    eImgs = it && it.images ? it.images.slice() : [];
    eNew = it && it.type === 'image' ? [{ blob: it.blob, thumb: it.thumb, w: it.w, h: it.h, keep: true }] : [];
    $('#editTitle').textContent = (it ? '✏️ 수정 · ' : '＋ 새로 저장 · ') + (eType === 'prompt' ? '프롬프트 · 결과물' : '이미지');
    $$('#editForm [data-for]').forEach(d => { d.hidden = d.dataset.for !== eType; });
    $('#fTitle').value = it ? it.title : '';
    $('#fCat').value = it ? (it.cat || '') : (cat !== 'all' && cat !== 'fav' ? cat : '');
    $('#fPrompt').value = it ? (it.prompt || '') : '';
    $('#fResult').value = it ? (it.result || '') : '';
    $('#fMemo').value = it ? (it.memo || '') : '';
    $('#fFav').checked = !!(it && it.fav);
    $('#catList').innerHTML = CATS[eType].map(c => `<option value="${esc(c)}">`).join('');
    $('#fImgFile').multiple = !it;
    renderEditThumbs();
    $('#editDlg').showModal();
    if (!it) setTimeout(() => $('#fTitle').focus(), 50);
  }
  $('#addBtn').addEventListener('click', () => openEdit(null, ui.tab));
  $('#editCancel').addEventListener('click', () => $('#editDlg').close());
  $('#fResFile').addEventListener('change', async e => {
    const fs = Array.from(e.target.files); e.target.value = '';
    for (const f of fs) { try { eImgs.push((await prepImage(f)).blob); } catch (err) { toast('열 수 없는 사진은 건너뛰었어요'); } }
    renderEditThumbs();
  });
  $('#fImgFile').addEventListener('change', async e => {
    const fs = Array.from(e.target.files); e.target.value = '';
    if (eItem) eNew = [];
    for (const f of fs) {
      try { const p = await prepImage(f); p.name = f.name.replace(/\.[^.]+$/, ''); eNew.push(p); } catch (err) { toast('열 수 없는 사진은 건너뛰었어요'); }
    }
    if (!$('#fTitle').value.trim() && eNew.length === 1 && eNew[0].name) $('#fTitle').value = eNew[0].name.slice(0, 80);
    renderEditThumbs();
  });
  $('#fResImgs').addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (b) { eImgs.splice(+b.dataset.x, 1); renderEditThumbs(); } });
  $('#fImgPrev').addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (b) { eNew.splice(+b.dataset.x, 1); renderEditThumbs(); } });
  $('#editForm').addEventListener('submit', async e => {
    e.preventDefault();
    const title = $('#fTitle').value.trim(), now = Date.now();
    if (!title) { toast('제목을 써 주세요'); $('#fTitle').focus(); return; }
    const base = { title, cat: $('#fCat').value.trim(), fav: $('#fFav').checked, updated: now };
    try {
      if (eType === 'prompt') {
        const prompt = $('#fPrompt').value, result = $('#fResult').value;
        if (!prompt.trim() && !result.trim() && !eImgs.length) { toast('프롬프트나 결과물을 하나 이상 넣어 주세요'); return; }
        const it = Object.assign(eItem || { id: DB.newId(), type: 'prompt', created: now, used: 0 }, base, { prompt, result, images: eImgs });
        await DB.put(it);
      } else {
        if (!eNew.length) { toast('사진을 골라 주세요'); return; }
        const memo = $('#fMemo').value.trim();
        if (eItem) {
          const p = eNew[0];
          Object.assign(eItem, base, { memo, blob: p.blob, thumb: p.thumb, w: p.w, h: p.h });
          await DB.put(eItem);
        } else {
          const many = eNew.length > 1;
          await DB.putMany(eNew.map((p, k) => Object.assign({ id: DB.newId() + k, type: 'image', created: now + k, used: 0 }, base, {
            title: many ? `${title} ${k + 1}` : title, memo, blob: p.blob, thumb: p.thumb, w: p.w, h: p.h, updated: now + k })));
        }
      }
      $('#editDlg').close();
      toast(eItem ? '✏️ 수정했어요' : '✅ 저장했어요');
      await load();
    } catch (err) {
      console.error(err);
      toast('저장하지 못했어요. 휴대폰 저장 공간을 확인해 주세요', 5000);
    }
  });

  // ═════════ 데이터 백업 · 복원 (JSON) ═════════
  $('#backupBtn').addEventListener('click', async () => {
    try {
      toast('백업 파일 만드는 중…', 8000);
      const all = await DB.all(), out = [];
      for (const it of all) {
        const o = Object.assign({}, it);
        if (o.blob) o.blob = await blobToDataUrl(o.blob);
        if (o.images) o.images = await Promise.all(o.images.map(blobToDataUrl));
        out.push(o);
      }
      const data = { app: 'BK프롬', format: 1, exported: new Date().toISOString(), count: out.length, items: out };
      const name = `BK프롬_데이터백업_${stamp()}.json`;
      download(new Blob([JSON.stringify(data)], { type: 'application/json' }), name);
      toast(`💾 백업했어요 · 내 파일 → 다운로드 → ${name}`, 6000);
    } catch (e) { console.error(e); toast('백업하지 못했어요', 4000); }
  });
  let pending = null;
  $('#restoreFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const arr = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(arr)) throw new Error('형식');
      pending = arr.filter(o => o && (o.type === 'prompt' || o.type === 'image'));
      if (!pending.length) throw new Error('비어 있음');
      const np = pending.filter(o => o.type === 'prompt').length, ni = pending.length - np;
      $('#restoreInfo').innerHTML = `<b>${esc(f.name)}</b><br>프롬프트 ${np}개 · 이미지 ${ni}개${data.exported ? `<br>백업한 날: ${esc(new Date(data.exported).toLocaleString('ko-KR'))}` : ''}`;
      $('#restoreDlg').showModal();
    } catch (err) { toast('BK프롬 백업 파일(.json)이 아니에요', 4000); }
  });
  $('#restoreDlg').addEventListener('click', async e => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    const r = b.dataset.r;
    if (r === 'cancel' || !pending) { $('#restoreDlg').close(); pending = null; return; }
    if (r === 'replace' && !confirm('지금 저장된 데이터를 모두 지우고 백업으로 바꿀까요?')) return;
    try {
      const list = [];
      for (const o of pending) {
        const it = Object.assign({}, o);
        if (!it.id) it.id = DB.newId();
        if (typeof it.blob === 'string') it.blob = await dataUrlToBlob(it.blob);
        if (Array.isArray(it.images)) it.images = await Promise.all(it.images.map(u => (typeof u === 'string' ? dataUrlToBlob(u) : u)));
        it.created = it.created || Date.now(); it.updated = it.updated || it.created;
        list.push(it);
      }
      if (r === 'replace') await DB.clear();
      await DB.putMany(list);
      $('#restoreDlg').close(); pending = null;
      toast(`📂 복원했어요 · ${list.length}개`, 4000);
      await load();
    } catch (err) { console.error(err); toast('복원하지 못했어요. 저장 공간을 확인해 주세요', 5000); }
  });

  // ═════════ PWA: 설치 · 자동 업데이트 ═════════
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
  $('#installBtn').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; $('#installBtn').hidden = true; });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!had || window.__rl) return;
      if ($('#editDlg').open) { toast('새 버전이 나왔어요 · 다음에 열 때 바뀌어요', 4000); return; }
      window.__rl = 1; location.reload();
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {}));
  }
  // 저장소가 휴대폰 정리 때 지워지지 않게 요청
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* 무시 */ }
  // 다른 화면(BK톡톡 등)에서 저장하고 돌아오면 새로 읽기
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#editDlg').open && !$('#viewDlg').open) load(); });

  window.__prom = { load, get items() { return items; }, openEdit, render };
  load();
})();
