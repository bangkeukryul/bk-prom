/*!
 * share.js — BK프롬 주소 · QR코드 보내기 (BK톡톡과 같은 방식)
 */
(function () {
  'use strict';
  const URL_ = 'https://bangkeukryul.github.io/bk-prom/';
  const ROWS = ["11111110001011001111101111111", "10000010010101110010101000001", "10111010100110100001101011101", "10111010100101111100001011101", "10111010101001001001101011101", "10000010110110110000001000001", "11111110101010101010101111111", "00000000111000110011100000000", "10111110000101011101001111100", "11001101111001001111011110001", "11011110110001111010011100000", "01110100001000111010101111010", "00001111110100000101000001100", "10111101101111000001111110001", "11000011011001111000100001100", "10110000000001000000100100010", "01110111010000100100100001100", "11110100101110001011101110101", "10111111111110010110100110100", "10110100001110100010000010010", "10000111111000010111111110111", "00000000100111101111100011111", "11111110000101111101101011100", "10000010111111001011100010001", "10111010101000100100111110100", "10111010111000000110100001111", "10111010110000011010011111110", "10000010001111001001111001010", "11111110110101000101001010100"];   // QR 무늬 (주소를 바꾸면 다시 만들어야 함)
  const MSG = '📲 BK프롬 (무료)\n자주 쓰는 AI 프롬프트 · 결과물 · 증명사진 · 로고를 한곳에 모아 두고 바로 복사해 써요.\n\n👉 ' + URL_
    + '\n\n※ 카톡에서 열리면 오른쪽 ⋮ → ‘다른 브라우저로 열기’ → 크롬으로 열고, ⋮ → ‘홈 화면에 추가’ 하세요.';
  const F = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const $ = id => document.getElementById(id);
  const inApp = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent || '');
  const msg = (t, c) => { const m = $('qrMsg'); m.textContent = t; m.style.color = c || '#16a34a'; };
  function draw() {
    const n = ROWS.length, W = 1200, cell = Math.floor((W - 200) / (n + 8)), qs = cell * (n + 8), H = qs + 560;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    const g = x.createLinearGradient(0, 0, W, 190); g.addColorStop(0, '#087a54'); g.addColorStop(1, '#2cc28c');
    x.fillStyle = g; x.fillRect(0, 0, W, 190);
    x.textAlign = 'center'; x.textBaseline = 'top'; x.fillStyle = '#fff'; x.font = '800 84px ' + F; x.fillText('BK프롬', W / 2, 45);
    const qx = Math.floor((W - qs) / 2), qy = 230;
    x.fillStyle = '#000';
    ROWS.forEach((r, yy) => { for (let xx = 0; xx < n; xx++) if (r[xx] === '1') x.fillRect(qx + (xx + 4) * cell, qy + (yy + 4) * cell, cell, cell); });
    let y = qy + qs + 20;
    [['휴대폰 카메라로 찍으면 바로 열려요', '800 44px ', '#087a54'], ['bangkeukryul.github.io/bk-prom', '700 40px ', '#334155'],
      ['크롬으로 열고 ‘홈 화면에 추가’ 하세요 · 무료', '700 40px ', '#64748b']].forEach(([t, f, col]) => { x.font = f + F; x.fillStyle = col; x.fillText(t, W / 2, y); y += 78; });
    return c;
  }
  let cv = null;
  const make = () => { cv = draw(); $('qrImg').src = cv.toDataURL('image/png'); };
  let made = false;
  $('shareBox').addEventListener('toggle', () => {
    if (!$('shareBox').open || made) return;
    made = true;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(make); else make();
  });
  async function copy(t, ok) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); msg(ok); return; } } catch (e) { /* 아래 방법 */ }
    const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select();
    try { document.execCommand('copy'); msg(ok); } catch (e) { msg('주소를 길게 눌러 복사해 주세요.', '#b45309'); }
    a.remove();
  }
  $('copyUrlBtn').addEventListener('click', () => copy(URL_, '✅ 주소를 복사했어요. 카톡 대화창에 길게 눌러 붙여넣으세요.'));
  $('copyMsgBtn').addEventListener('click', () => copy(MSG, '✅ 안내 문구를 복사했어요. 카톡 대화창에 붙여넣으세요.'));
  const blob = () => new Promise(r => { if (!cv) make(); cv.toBlob(r, 'image/png'); });
  $('qrSave').addEventListener('click', async () => {
    const b = await blob(), u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = 'BK프롬_QR코드.png'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 3000);
    if (inApp) msg('⚠️ 카톡 안 브라우저에서는 저장이 안 될 수 있어요. ⋮ → ‘다른 브라우저로 열기’로 크롬에서 연 뒤 다시 저장하세요.', '#b45309');
    else msg('✅ QR코드를 저장했어요. 내 파일 → 다운로드 폴더(갤러리의 ‘Download’ 앨범)에 BK프롬_QR코드.png 로 있어요.');
  });
  $('qrShareBtn').addEventListener('click', async () => {
    const f = new File([await blob()], 'BK프롬_QR코드.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); } catch (e) { /* 취소 */ } }
    else msg('이 휴대폰은 바로 보내기를 지원하지 않아요. 저장한 뒤 카톡에서 사진으로 보내세요.', '#b45309');
  });
})();
