/*!
 * admin.js — BK프롬 관리자 메뉴 (만든 사람용): 관리용 주소 · 지금 버전 백업 · 숨기기
 * 켜는 방법: 주소 뒤에 ?bkadmin  /  맨 아래 'BK Agent · 비케이'를 3초 안에 7번 누르기
 * BK톡톡과 같은 주소(bangkeukryul.github.io)를 쓰므로, 관리자 켜짐 표시('bkAdmin')를 함께 써요.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'bkAdmin';
  const REPO = 'https://github.com/bangkeukryul/bk-prom';
  const UPLOAD = REPO + '/upload/main';
  const APP = 'https://bangkeukryul.github.io/bk-prom/';
  const FILES = ['index.html', 'style.css', 'app.js', 'db.js', 'admin.js', 'share.js', 'sw.js', 'manifest.webmanifest',
    'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'README.md'];

  // ── 켜기 / 끄기 ──
  let on = false, verLoaded = false;
  try {
    const q = location.search;
    if (/[?&]bkadmin=off\b/.test(q)) localStorage.removeItem(KEY);
    else if (/[?&]bkadmin\b/.test(q)) localStorage.setItem(KEY, '1');
    on = localStorage.getItem(KEY) === '1';
  } catch (e) { on = /[?&]bkadmin\b/.test(location.search); }
  const box = $('adminBox');
  const adminVis = v => document.querySelectorAll('.adminOnly').forEach(e => { e.style.display = v ? '' : 'none'; });
  function show(v, open) {
    box.hidden = !v;
    adminVis(v);
    if (v && open) box.open = true;
    if (v) loadVersion();
  }
  show(on, /[?&]bkadmin\b/.test(location.search));

  // 숨은 방법: 맨 아래 'BK Agent · 비케이'를 3초 안에 7번
  let n = 0, t = 0;
  $('bkFoot').addEventListener('click', () => {
    const now = Date.now();
    if (now - t > 3000) n = 0;
    t = now; n++;
    if (n < 7) return;
    n = 0;
    const v = box.hidden;
    try { v ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch (e) { /* 저장 불가 */ }
    show(v, true);
    if (v) box.scrollIntoView({ behavior: 'smooth' });
    alert(v ? '🛠 관리자 메뉴를 켰어요. (이 휴대폰에서만 보여요 · BK톡톡에서도 켜져요)' : '관리자 메뉴를 숨겼어요.');
  });
  $('adminOff').addEventListener('click', () => {
    try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ }
    show(false);
  });

  // ── 지금 버전 표시 (sw.js 의 VERSION) ──
  async function loadVersion() {
    if (verLoaded) return;
    verLoaded = true;
    try {
      const txt = await (await fetch('sw.js?v=' + Date.now(), { cache: 'no-store' })).text();
      const m = txt.match(/VERSION\s*=\s*'([^']+)'/);
      $('adminVer').textContent = m ? m[1] : '알 수 없음';
    } catch (e) { $('adminVer').textContent = '확인 못 함 (인터넷 확인)'; verLoaded = false; }
  }

  // ── 관리용 주소 복사 ──
  const ADMIN_TXT = `🛠 BK프롬 관리용 주소\n\n① 파일 올리기 (업데이트)\n${UPLOAD}\n\n② 저장소 (파일 목록·변경 기록)\n${REPO}\n\n`
    + `③ 관리자 메뉴 켜기 (내 휴대폰 전용, 남에게 알려 주지 않기)\n${APP}?bkadmin\n\n④ 앱 주소 (다른 분께 공유용)\n${APP}\n\n`
    + '※ 업데이트 순서: 앱 관리자 메뉴에서 백업 → ①에서 새 파일 올리기 → Commit changes → 1~2분 뒤 앱 두 번 열기';
  async function acopy(text, ok) {
    const m = $('adminCopyMsg');
    const good = () => { m.textContent = ok; m.style.color = '#16a34a'; };
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return good(); } } catch (e) { /* 아래 방법 */ }
    const a = document.createElement('textarea');
    a.value = text; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select();
    try { document.execCommand('copy'); good(); } catch (e) { m.textContent = '복사가 안 되면 주소를 길게 눌러 복사해 주세요.'; m.style.color = '#b45309'; }
    a.remove();
  }
  $('copyAdminAll').addEventListener('click', () => acopy(ADMIN_TXT, '✅ 복사했어요. 카톡 ‘나와의 채팅’에 길게 눌러 붙여넣고 보내 두세요.'));
  $('copyUpload').addEventListener('click', () => acopy(UPLOAD, '✅ 올리기 주소를 복사했어요.'));

  // ── 지금 버전 백업 (압축 없이 담는 zip) ──
  const CRC = (() => { const tb = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tb[i] = c >>> 0; } return tb; })();
  function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function makeZip(files) {
    const enc = new TextEncoder(), parts = [], cen = [];
    let off = 0;
    const now = new Date();
    const dt = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dd = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const h = len => { const b = new Uint8Array(len); return { b, v: new DataView(b.buffer) }; };
    for (const f of files) {
      const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const L = h(30);
      L.v.setUint32(0, 0x04034b50, true); L.v.setUint16(4, 20, true); L.v.setUint16(6, 0x0800, true);
      L.v.setUint16(10, dt, true); L.v.setUint16(12, dd, true); L.v.setUint32(14, crc, true);
      L.v.setUint32(18, sz, true); L.v.setUint32(22, sz, true); L.v.setUint16(26, nm.length, true);
      parts.push(L.b, nm, f.data);
      const C = h(46);
      C.v.setUint32(0, 0x02014b50, true); C.v.setUint16(4, 20, true); C.v.setUint16(6, 20, true); C.v.setUint16(8, 0x0800, true);
      C.v.setUint16(12, dt, true); C.v.setUint16(14, dd, true); C.v.setUint32(16, crc, true);
      C.v.setUint32(20, sz, true); C.v.setUint32(24, sz, true); C.v.setUint16(28, nm.length, true); C.v.setUint32(42, off, true);
      cen.push(C.b, nm);
      off += 30 + nm.length + sz;
    }
    const cl = cen.reduce((a, b) => a + b.length, 0), E = h(22);
    E.v.setUint32(0, 0x06054b50, true); E.v.setUint16(8, files.length, true); E.v.setUint16(10, files.length, true);
    E.v.setUint32(12, cl, true); E.v.setUint32(16, off, true);
    return new Blob([...parts, ...cen, E.b], { type: 'application/zip' });
  }
  const msg = (text, col) => { const m = $('backupMsg'); m.textContent = text; m.style.color = col || '#087a54'; };
  $('backupProgBtn').addEventListener('click', async () => {
    const d = new Date(), p = x => String(x).padStart(2, '0');
    const ds = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
    msg('사이트에서 파일을 받는 중…');
    const out = [];
    try {
      for (let i = 0; i < FILES.length; i++) {
        const f = FILES[i];
        msg(`사이트에서 파일을 받는 중… ${i + 1}/${FILES.length}`);
        const r = await fetch(f + '?backup=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) {
          if (f === 'README.md') continue;   // 예전 버전엔 없을 수 있음
          throw new Error(`${f} (${r.status})`);
        }
        out.push({ name: f, data: new Uint8Array(await r.arrayBuffer()) });
      }
    } catch (e) { msg('⚠️ 백업 실패: ' + e.message + ' — 인터넷 연결을 확인하고 다시 눌러 주세요.', '#dc2626'); return; }
    const names = out.map(f => f.name);
    const note = `BK프롬 백업\n백업한 때: ${d.toLocaleString('ko-KR')}\n버전: ${$('adminVer').textContent}\n\n[되돌리는 방법]\n1. 이 zip을 압축 풀기\n`
      + `2. ${UPLOAD.replace('https://', '')} 접속\n3. choose your files → 아래 파일 ${names.length}개 모두 선택 → Commit changes\n4. 1~2분 뒤 앱을 닫았다가 두 번 열기\n\n`
      + `파일: ${names.join(', ')}\n(이 안내 파일은 올리지 않아도 돼요)\n`;
    out.push({ name: '백업안내.txt', data: new TextEncoder().encode(note) });
    const blob = makeZip(out), name = `BK프롬_백업_${ds}.zip`, u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
    msg(`✅ 백업 완료! 내 파일 → 다운로드에 “${name}” (${Math.round(blob.size / 1024)}KB, 파일 ${names.length}개)로 저장했어요.`, '#16a34a');
  });
})();
