/*!
 * db.js — BK프롬 저장소 (브라우저 IndexedDB · 사진도 넉넉하게 저장)
 * BK톡톡 · BK쇼츠도 같은 주소(bangkeukryul.github.io)라서 이 저장소를 함께 읽고 씀.
 * ⚠️ 이름 'bk-prom' · 버전 1 · 'items' 구조는 세 앱이 같아야 하므로 바꾸지 않기.
 */
(function (g) {
  'use strict';
  const NAME = 'bk-prom', VER = 1;
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('items')) d.createObjectStore('items', { keyPath: 'id' });
      };
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); dbp = null; }; res(d); };
      r.onerror = () => { dbp = null; rej(r.error); };
      r.onblocked = () => { /* 다른 탭이 열려 있음 — 기다림 */ };
    });
    return dbp;
  }
  function run(mode, fn) {
    return open().then(d => new Promise((res, rej) => {
      const t = d.transaction('items', mode), s = t.objectStore('items');
      const req = fn(s);
      t.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('저장 공간이 부족할 수 있어요'));
    }));
  }
  g.BKPROM_DB = {
    all: () => run('readonly', s => s.getAll()),
    get: id => run('readonly', s => s.get(id)),
    put: item => run('readwrite', s => s.put(item)),
    putMany: items => run('readwrite', s => { items.forEach(it => s.put(it)); return null; }),
    del: id => run('readwrite', s => s.delete(id)),
    clear: () => run('readwrite', s => s.clear()),
    newId: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
  };
})(window);
