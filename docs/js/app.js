/* app.js — 画面描画・ルーティング・イベント処理の中核
 * 依存: storage.js(Store) / data.js(Data) / charts.js(Charts)
 * 方針: 各ビューは HTML 文字列を組み立てて innerHTML に流し込み、
 *        操作は body への委譲リスナ([data-act]/[data-in])で処理する。
 * i18n: 表示文字列は Data.t(key) 経由。言語設定(ja/en)で全体が切り替わる。
 * 種目種別: 部位が cardio の種目は「時間(分)・距離(km)」を記録(筋トレは重量・回数)。
 */
(function () {
  'use strict';

  /* ============ 共通ヘルパ ============ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const t = (k, p) => Data.t(k, p);
  const S = () => Store.getSettings();
  const unit = () => S().unit;
  const uLab = () => Data.unitLabel(unit());
  const disp = (kg) => Data.fmtNum(Data.kgToDisplay(kg, unit()));
  const exName = (ex) => (ex ? (Data.lang() === 'en' && ex.en ? ex.en : ex.name) : '');
  const isCardio = (exId) => { const ex = Store.exerciseById(exId); return !!(ex && Data.isCardioMuscle(ex.muscle)); };

  function toast(msg) {
    $$('.toast').forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }
  const muscleTag = (key) => `<span class="mtag ${Data.muscleMap[key] ? Data.muscleMap[key].cls : ''}">${esc(Data.muscleName(key))}</span>`;

  /* ============ ボトムシート ============ */
  function showSheet(inner, opts) {
    opts = opts || {};
    if (!opts.stack) closeSheet();
    const ov = document.createElement('div');
    ov.className = 'sheet-overlay';
    ov.innerHTML = `<div class="sheet"><div class="grab"></div>${inner}</div>`;
    // 背景タップはこのオーバーレイだけ閉じる(スタック時に下のシートを残す)
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    return ov;
  }
  function closeSheet() { $$('.sheet-overlay').forEach(o => o.remove()); }

  /* ============ ルーティング ============ */
  const state = {
    tab: 'workout',
    wo: { screen: 'home', backTo: null },
    hist: { ym: null, screen: 'list', sessionId: null },
    menu: { screen: 'list', editId: null, draft: null },
    graph: { exerciseId: null, metric: 'max' },
    cond: { screen: 'list', date: null }
  };
  let cur = null;
  const picker = { q: '', muscle: 'all', onPick: null };

  const RENDER = {
    workout: renderWorkout, history: renderHistory, graph: renderGraph,
    menu: renderMenu, condition: renderCondition, settings: renderSettings
  };

  function switchTab(tab) {
    state.tab = tab;
    $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.view').forEach(v => v.classList.remove('active'));
    const view = $('#view-' + tab);
    if (view) view.classList.add('active');
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    const fn = RENDER[state.tab];
    if (fn) $('#view-' + state.tab).innerHTML = fn();
    const wv = $('#view-workout');
    if (wv) wv.classList.toggle('home', state.tab === 'workout' && state.wo.screen === 'home');
    syncTimerBar();
  }

  /* ============ ワークアウト(記録)タブ ============ */
  function renderWorkout() {
    if (state.wo.screen === 'session' && cur) return renderSession();
    return renderWorkoutHome();
  }

  // 連続トレ日数(今日未実施でも昨日まで続いていれば維持)
  function computeStreak(done) {
    const set = new Set(done.map(s => s.date));
    const d = new Date();
    if (!set.has(Data.dateKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (set.has(Data.dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  // ワークアウト内の1種目が完了か(本番セットが1つ以上あり全て完了)
  function exDone(we) {
    const work = we.sets.filter(s => !s.warmup);
    return work.length > 0 && work.every(s => s.done);
  }
  const greetWord = () => { const hh = new Date().getHours(); return hh < 5 ? 'こんばんは' : hh < 11 ? 'おはようございます' : hh < 18 ? 'こんにちは' : 'こんばんは'; };

  function renderWorkoutHome() {
    const active = Store.getActiveSession();
    const templates = Store.getTemplates();
    const done = Store.getSessions().filter(s => s.done);
    const todayK = Data.todayKey();
    const todayVol = done.filter(s => s.date === todayK).reduce((a, s) => a + Data.sessionVolumeKg(s), 0) + (active ? Data.sessionVolumeKg(active) : 0);
    const goal = Math.max(500, S().goalVolume || 5000);
    const pct = Math.min(100, Math.round(todayVol / goal * 100));
    const streak = computeStreak(done);
    const dispVol = Data.fmtNum(Data.kgToDisplay(todayVol, unit()));
    const dispGoal = Data.fmtNum(Data.kgToDisplay(goal, unit()));

    // メニュー: 進行中はそのセッション、無ければ最新テンプレ、無ければ最近の記録
    let menu = [], menuDone = 0, menuTotal = 0, ctaLabel, ctaAct;
    if (active) {
      active.exercises.forEach(we => {
        const ex = Store.exerciseById(we.exerciseId) || { name: '(?)' };
        const d = exDone(we);
        const top = we.sets.find(s => !s.warmup) || we.sets[0] || {};
        const sub = Data.isCardioMuscle((ex.muscle || '')) ? `${Data.fmtNum(top.duration || 0)}分 · ${we.sets.length}set`
          : (top.weight ? `${disp(top.weight)}${uLab()}×${top.reps || 0} · ${we.sets.length}set` : `${we.sets.length}set`);
        menu.push({ name: exName(ex), sub, done: d });
      });
      menuTotal = menu.length; menuDone = menu.filter(m => m.done).length;
      ctaLabel = 'セットを記録する'; ctaAct = 'resume';
    } else if (templates.length) {
      const tp = templates[0];
      menu = tp.exercises.map(te => { const ex = Store.exerciseById(te.exerciseId); return { name: ex ? exName(ex) : '(?)', sub: `${te.sets || '-'}set`, done: false, tplId: tp.id }; });
      menuTotal = menu.length;
      ctaLabel = `${tp.name} を開始`; ctaAct = 'start-tpl'; var ctaId = tp.id;
    } else {
      ctaLabel = 'ワークアウトを開始'; ctaAct = 'start-empty';
    }
    const nextIdx = menu.findIndex(m => !m.done);

    let h = `<div class="ng-top">${active ? '<span class="ng-rec">● 記録中</span>' : `<button class="ng-gear" data-act="open-settings" aria-label="${t('a_settings')}">⚙️</button>`}</div>`;
    h += `<div class="greet">${greetWord()}、<b>${esc(active ? (active.name || 'トレーニング') : (menu.length ? (templates[0] ? templates[0].name : '今日') : '今日'))}</b>${active ? ' を記録中' : (menu.length ? ' の日' : ' も頑張りましょう')}</div>`;

    // 進捗リング + 数値
    h += `<div class="ring-row">
      <div class="ring" style="background:conic-gradient(var(--accent) 0 ${pct}%, var(--bg-elev) ${pct}% 100%)">
        <div class="hole"><span class="pctn">${pct}<small>%</small></span><span class="rlab">目標達成</span></div>
      </div>
      <div class="ring-side">
        <div class="big-vol">${dispVol}</div>
        <div class="big-vol-sub">/ ${dispGoal} ${uLab()}</div>
        <div class="mini2">
          <div class="mini"><div class="n" style="color:var(--accent)">${streak}</div><div class="l">連続日</div></div>
          <div class="mini"><div class="n">${menuTotal ? menuDone + '/' + menuTotal : '—'}</div><div class="l">完了</div></div>
        </div>
      </div>
    </div>`;

    // 今日のメニュー
    h += `<div class="sec-lbl">${active ? '今日のメニュー' : (menu.length ? 'おすすめメニュー' : 'メニュー')}</div>`;
    if (menu.length) {
      h += `<div class="menu-list">` + menu.map((m, i) => {
        const isNext = i === nextIdx;
        const act = active ? 'resume' : (m.tplId ? `start-tpl" data-id="${m.tplId}` : 'start-empty');
        return `<div class="menu-card ${isNext ? 'next' : ''}" data-act="${act}">
          <div class="dot ${m.done ? 'on' : ''}"></div>
          <div class="mc-main"><div class="mc-name">${esc(m.name)}</div><div class="mc-sub">${esc(m.sub)}</div></div>
          ${m.done ? '<span class="mc-check">✓</span>' : (isNext ? '<span class="mc-now">NOW</span>' : '')}
        </div>`;
      }).join('') + `</div>`;
    } else {
      h += `<div class="menu-list"><div class="menu-card" data-act="start-empty"><div class="dot"></div>
        <div class="mc-main"><div class="mc-name">最初のワークアウト</div><div class="mc-sub mono">タップして開始</div></div><span class="mc-now">START</span></div></div>`;
    }

    // 主CTA
    h += `<button class="cta" data-act="${ctaAct}"${ctaAct === 'start-tpl' ? ` data-id="${ctaId}"` : ''}>${esc(ctaLabel)}</button>`;

    // クイック導線
    h += `<div class="quick-row">
      <button class="quick" data-act="start-empty">＋ 空で開始</button>
      <button class="quick" data-act="rm-calc">RM計算機</button>
    </div>`;
    return h;
  }

  // 負荷量カード: 総重量(kg)をトン表示し、乗り物換算を添える
  function loadCard(label, kg, ico, unitTon, cls) {
    const tons = kg / 1000;
    const mult = unitTon ? (tons / unitTon) : 0;
    return `<div class="load-card ${cls}">
      <div class="lc-main"><div class="lc-label">${label}</div>
        <div class="lc-val">${Data.fmtNum(tons)}<small>t</small></div></div>
      <div class="lc-cmp"><span class="ico">${ico}</span>× ${mult.toFixed(mult >= 10 ? 0 : 1)}</div>
    </div>`;
  }

  // ホーム用カレンダー(閲覧＋実施日タップで履歴へ)。月移動は履歴タブで。
  function homeCalendar(done) {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const byDate = {};
    done.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });
    let h = `<div class="card"><div class="cal-head" style="margin-bottom:8px">
      <div class="m" style="text-align:left;flex:1">${Data.fmtMonthYear(y, m)}</div>
      <button data-act="go-history" aria-label="history" style="width:auto;padding:0 12px;font-size:13px">${t('h_history')} ›</button>
    </div><div class="cal-grid">`;
    Data.dow().forEach(d => h += `<div class="dow">${d}</div>`);
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < first; i++) h += `<div class="cal-cell empty"></div>`;
    const todayK = Data.todayKey();
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const has = byDate[key];
      const cls = has ? 'has' : (key === todayK ? 'today' : '');
      const marks = has ? `<span class="mk">${has.slice(0, 3).map(() => '<i></i>').join('')}</span>` : '';
      h += `<div class="cal-cell ${cls}" ${has ? `data-act="cal-day" data-date="${key}"` : ''}>${d}${marks}</div>`;
    }
    h += `</div></div>`;
    return h;
  }

  // 週別の負荷量バー(今週〜5週前、日曜始まり)
  function weeklyBars(done) {
    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay()); // 直近の日曜
    const buckets = [];
    for (let w = 0; w < 6; w++) {
      const s = new Date(startOfWeek); s.setDate(startOfWeek.getDate() - w * 7);
      const e = new Date(s); e.setDate(s.getDate() + 6);
      const sk = Data.dateKey(s), ek = Data.dateKey(e);
      const vol = done.filter(x => x.date >= sk && x.date <= ek).reduce((a, x) => a + Data.sessionVolumeKg(x), 0);
      buckets.push({ w, vol });
    }
    const max = Math.max(1, ...buckets.map(b => b.vol));
    let rows = buckets.map(b => {
      const lab = b.w === 0 ? t('wk_now') : t('wk_ago', { n: b.w });
      const pct = (b.vol / max) * 100;
      const val = b.vol ? Data.fmtNum(b.vol / 1000) + 't' : '—';
      return `<div class="wk-row ${b.w === 0 ? 'now' : ''}"><span class="wk-lab">${lab}</span>
        <span class="wk-track"><span class="wk-fill" style="width:${pct.toFixed(1)}%"></span></span>
        <span class="wk-val">${val}</span></div>`;
    }).join('');
    return `<div class="card"><h2>${t('weekly_load')}</h2><div class="wk">${rows}</div></div>`;
  }

  // 1RM計算機(シート)
  function openRmCalc() {
    rmState = { weight: '', reps: '' };
    showSheet(rmInner());
  }
  let rmState = { weight: '', reps: '' };
  function rmInner() {
    const w = Data.displayToKg(rmState.weight, unit());
    const reps = parseInt(rmState.reps, 10) || 0;
    let out = '';
    if (w > 0 && reps > 0) {
      const oneRm = Data.estimate1RM(w, reps);
      const pcts = [100, 95, 90, 85, 80, 75, 70];
      const rows = pcts.map(p => {
        const wt = oneRm * p / 100;
        const rep = p === 100 ? 1 : Math.round((30 * (100 / p - 1)) + 1); // Epley逆算の目安
        return `<tr><td>${p}%</td><td>${disp(wt)}${uLab()}</td><td>~${rep} ${t('col_reps')}</td></tr>`;
      }).join('');
      out = `<div class="rm-out">
        <div class="rm-1rm"><span class="n">${disp(oneRm)}</span><span class="u"> ${uLab()}</span></div>
        <table class="rm-table"><tbody>${rows}</tbody></table></div>`;
    }
    return `<h2>${t('rm_title')}</h2>
      <div class="row">
        <label class="field" style="flex:1"><span class="lab">${t('rm_weight', { u: uLab() })}</span><input inputmode="decimal" data-in="rm-weight" value="${esc(rmState.weight)}" placeholder="60"></label>
        <label class="field" style="flex:1"><span class="lab">${t('rm_reps')}</span><input inputmode="numeric" data-in="rm-reps" value="${esc(rmState.reps)}" placeholder="8"></label>
      </div>
      <div id="rm-result">${out}</div>
      <p class="muted small mt">${t('rm_hint')}</p>`;
  }
  function refreshRm() {
    const box = $('#rm-result'); if (!box) return;
    const w = Data.displayToKg(rmState.weight, unit());
    const reps = parseInt(rmState.reps, 10) || 0;
    if (w > 0 && reps > 0) {
      const oneRm = Data.estimate1RM(w, reps);
      const pcts = [100, 95, 90, 85, 80, 75, 70];
      const rows = pcts.map(p => {
        const wt = oneRm * p / 100;
        const rep = p === 100 ? 1 : Math.round((30 * (100 / p - 1)) + 1);
        return `<tr><td>${p}%</td><td>${disp(wt)}${uLab()}</td><td>~${rep} ${t('col_reps')}</td></tr>`;
      }).join('');
      box.innerHTML = `<div class="rm-out"><div class="rm-1rm"><span class="n">${disp(oneRm)}</span><span class="u"> ${uLab()}</span></div>
        <table class="rm-table"><tbody>${rows}</tbody></table></div>`;
    } else box.innerHTML = '';
  }

  function sessionRow(s) {
    const vol = Data.sessionVolumeKg(s);
    return `<div class="lrow" data-act="open-session" data-id="${s.id}">
      <div class="lmain"><div class="ltitle">${esc(s.name || Data.fmtDate(s.date))}</div>
      <div class="lsub">${Data.fmtDate(s.date)} ・ ${t('n_exercises', { n: s.exercises.length })} ・ ${t('n_sets', { n: Data.sessionSetCount(s) })}</div></div>
      <div class="lval">${Data.fmtNum(Data.kgToDisplay(vol, unit()))}${uLab()}</div></div>`;
  }

  function renderSession() {
    const s = cur;
    const vol = Data.sessionVolumeKg(s);
    let h = `<button class="back-btn" data-act="close-session">‹ ${state.wo.backTo === 'history' ? t('to_history') : t('to_home')}</button>`;
    h += `<div class="head"><div style="flex:1">
      <input id="s-name" data-in="sname" placeholder="${t('workout_name_ph')}" value="${esc(s.name || '')}" style="font-size:18px;font-weight:600;background:none;border:none;padding:0">
      <div class="sub">${Data.fmtDate(s.date)} ・ ${Data.fmtNum(Data.kgToDisplay(vol, unit()))}${uLab()} ・ ${t('n_sets', { n: Data.sessionSetCount(s) })}</div>
    </div></div>`;

    if (!s.exercises.length) {
      h += `<div class="empty"><span class="big">💪</span>${t('empty_ex')}</div>`;
    } else {
      s.exercises.forEach((we, ei) => { h += exerciseBlock(we, ei); });
    }

    h += `<button class="btn secondary" data-act="pick-ex">${t('add_exercise')}</button>`;
    h += `<label class="field mt"><span class="lab">${t('session_note')}</span>
      <textarea data-in="snote" placeholder="${t('session_note_ph')}">${esc(s.note || '')}</textarea></label>`;
    const showDiscard = state.wo.backTo !== 'history';
    h += `<div class="row mt">
      ${showDiscard ? `<button class="btn danger small" data-act="discard-session">${t('discard')}</button>` : ''}
      <button class="btn" data-act="finish-session">${s.done ? t('save_do') : t('finish_save')}</button></div>`;
    return h;
  }

  function exerciseBlock(we, ei) {
    const ex = Store.exerciseById(we.exerciseId) || { name: '(?)', muscle: '' };
    const cardio = Data.isCardioMuscle(ex.muscle);
    let rows;
    if (cardio) {
      rows = we.sets.map((set, si) => `<tr class="set-row ${set.done ? 'done' : ''}">
        <td><span class="setno">${si + 1}</span></td>
        <td><input class="set-in" inputmode="decimal" data-in="duration" data-ex="${ei}" data-set="${si}" value="${set.duration || ''}" placeholder="0"></td>
        <td><input class="set-in" inputmode="decimal" data-in="distance" data-ex="${ei}" data-set="${si}" value="${set.distance || ''}" placeholder="0"></td>
        <td><button class="set-done ${set.done ? 'on' : ''}" data-act="toggle-set" data-ex="${ei}" data-set="${si}" aria-label="${set.done ? '✓' : ''}" aria-pressed="${set.done}">✓</button></td>
        <td><button class="set-del" data-act="del-set" data-ex="${ei}" data-set="${si}" aria-label="delete">✕</button></td>
      </tr>`).join('');
    } else {
      rows = we.sets.map((set, si) => {
        const wv = set.weight ? disp(set.weight) : '';
        return `<tr class="set-row ${set.done ? 'done' : ''}">
          <td><span class="setno ${set.warmup ? 'warm' : ''}">${set.warmup ? 'W' : setNumber(we, si)}</span></td>
          <td><input class="set-in" inputmode="decimal" data-in="weight" data-ex="${ei}" data-set="${si}" value="${wv}" placeholder="0"></td>
          <td><input class="set-in" inputmode="numeric" data-in="reps" data-ex="${ei}" data-set="${si}" value="${set.reps || ''}" placeholder="0"></td>
          <td><button class="set-done ${set.done ? 'on' : ''}" data-act="toggle-set" data-ex="${ei}" data-set="${si}" aria-label="${set.done ? '✓' : ''}" aria-pressed="${set.done}">✓</button></td>
          <td><button class="set-del" data-act="del-set" data-ex="${ei}" data-set="${si}" aria-label="delete">✕</button></td>
        </tr>`;
      }).join('');
    }
    const head = cardio
      ? `<th>${t('col_set')}</th><th>${t('col_min')}</th><th>${t('col_km')}</th><th>${t('col_done')}</th><th></th>`
      : `<th>${t('col_set')}</th><th>${uLab()}</th><th>${t('col_reps')}</th><th>${t('col_done')}</th><th></th>`;
    const foot = cardio
      ? `<button class="link-btn" data-act="add-set" data-ex="${ei}">${t('add_set')}</button>`
      : `<button class="link-btn" data-act="add-set" data-ex="${ei}">${t('add_set')}</button>
         <button class="link-btn warm" data-act="add-warm" data-ex="${ei}">${t('add_warm')}</button>`;
    return `<div class="ex-block">
      <div class="ex-head">
        <span class="name">${esc(exName(ex))}</span>
        ${ex.muscle ? muscleTag(ex.muscle) : ''}
        <button class="kebab" data-act="ex-menu" data-ex="${ei}" aria-label="menu">⋯</button>
      </div>
      <table class="set-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
      ${we.note ? `<div class="small muted" style="padding:0 14px 6px">📝 ${esc(we.note)}</div>` : ''}
      <div class="ex-foot">${foot}</div>
    </div>`;
  }
  function setNumber(we, si) {
    let n = 0;
    for (let i = 0; i <= si; i++) if (!we.sets[i].warmup) n++;
    return n;
  }

  function saveCur() { if (cur) Store.saveSession(cur); }

  // 直近に同じ種目を行ったときの代表セットを引き継ぎ用に取得(筋トレ=最大重量, 有酸素=最長距離)
  function lastPerformance(exId) {
    const cardio = isCardio(exId);
    const sessions = Store.getSessions().filter(s => s.done).sort((a, b) => b.date.localeCompare(a.date));
    for (const s of sessions) {
      const we = s.exercises.find(e => e.exerciseId === exId);
      if (!we) continue;
      if (cardio) {
        const done = we.sets.filter(x => x.duration || x.distance);
        if (done.length) { const top = done.reduce((a, b) => ((b.distance || 0) > (a.distance || 0) ? b : a)); return { duration: top.duration, distance: top.distance }; }
      } else {
        const done = we.sets.filter(x => !x.warmup && (x.weight || x.reps));
        if (done.length) { const top = done.reduce((a, b) => (b.weight > a.weight ? b : a)); return { weight: top.weight, reps: top.reps }; }
      }
    }
    return null;
  }

  function newSet(exId, from) {
    if (isCardio(exId)) return { id: Store.uid(), duration: from ? (from.duration || 0) : 0, distance: from ? (from.distance || 0) : 0, done: false };
    return { id: Store.uid(), weight: from ? (from.weight || 0) : 0, reps: from ? (from.reps || 0) : 0, warmup: false, done: false };
  }
  function addExerciseToSession(exId) {
    cur.exercises.push({ id: Store.uid(), exerciseId: exId, note: '', sets: [newSet(exId, lastPerformance(exId))] });
    saveCur();
  }

  /* ============ 種目の情報(筋肉マップ＋外部検索) ============ */
  // 種目が鍛える部位を筋肉マップの領域キーに変換
  function exerciseRegions(ex) {
    const r = new Set(); const add = (...k) => k.forEach(x => r.add(x));
    switch (ex.muscle) {
      case 'chest': add('chest'); break;
      case 'back': add('lats', 'traps'); break;
      case 'shoulder': add('delts', 'rear_delts'); break;
      case 'arm': ex.sub === '上腕三頭筋' ? add('triceps') : add('biceps'); break;
      case 'legs':
        if (ex.sub === 'ハムストリングス') add('hamstrings');
        else if (ex.sub === '臀部') add('glutes');
        else if (ex.sub === '内転・外転') add('inner_thigh');
        else if (ex.sub === 'ふくらはぎ') add('calves');
        else add('quads');
        break;
      case 'abs': /バックエクステンション|ローマンチェア|GHD/.test(ex.name) ? add('lower_back', 'glutes') : add('abs'); break;
      case 'cardio': add('quads', 'calves'); break;
    }
    return r;
  }
  const HL = 'fill="var(--accent)" opacity="0.9"';
  function silhouette(ox) {
    const a = 'fill="var(--bg-elev)" stroke="var(--border)"';
    return `<circle cx="${ox}" cy="26" r="13" ${a}/>
      <rect x="${ox - 22}" y="42" width="44" height="92" rx="16" ${a}/>
      <rect x="${ox - 37}" y="46" width="13" height="78" rx="6" ${a}/>
      <rect x="${ox + 24}" y="46" width="13" height="78" rx="6" ${a}/>
      <rect x="${ox - 20}" y="130" width="18" height="98" rx="9" ${a}/>
      <rect x="${ox + 2}" y="130" width="18" height="98" rx="9" ${a}/>`;
  }
  function frontShape(k, ox) {
    switch (k) {
      case 'chest': return `<rect x="${ox - 18}" y="54" width="15" height="18" rx="6" ${HL}/><rect x="${ox + 3}" y="54" width="15" height="18" rx="6" ${HL}/>`;
      case 'delts': return `<circle cx="${ox - 24}" cy="52" r="8" ${HL}/><circle cx="${ox + 24}" cy="52" r="8" ${HL}/>`;
      case 'biceps': return `<ellipse cx="${ox - 30}" cy="74" rx="5" ry="12" ${HL}/><ellipse cx="${ox + 30}" cy="74" rx="5" ry="12" ${HL}/>`;
      case 'abs': return `<rect x="${ox - 11}" y="80" width="22" height="34" rx="5" ${HL}/>`;
      case 'obliques': return `<rect x="${ox - 20}" y="82" width="7" height="28" rx="3" ${HL}/><rect x="${ox + 13}" y="82" width="7" height="28" rx="3" ${HL}/>`;
      case 'quads': return `<ellipse cx="${ox - 11}" cy="156" rx="8" ry="26" ${HL}/><ellipse cx="${ox + 11}" cy="156" rx="8" ry="26" ${HL}/>`;
      case 'inner_thigh': return `<ellipse cx="${ox - 5}" cy="150" rx="4" ry="20" ${HL}/><ellipse cx="${ox + 5}" cy="150" rx="4" ry="20" ${HL}/>`;
    }
    return '';
  }
  function backShape(k, ox) {
    switch (k) {
      case 'traps': return `<rect x="${ox - 14}" y="46" width="28" height="18" rx="6" ${HL}/>`;
      case 'rear_delts': return `<circle cx="${ox - 24}" cy="52" r="8" ${HL}/><circle cx="${ox + 24}" cy="52" r="8" ${HL}/>`;
      case 'lats': return `<path d="M${ox - 20} 66 L${ox - 6} 72 L${ox - 10} 102 L${ox - 20} 94 Z" ${HL}/><path d="M${ox + 20} 66 L${ox + 6} 72 L${ox + 10} 102 L${ox + 20} 94 Z" ${HL}/>`;
      case 'triceps': return `<ellipse cx="${ox - 30}" cy="74" rx="5" ry="12" ${HL}/><ellipse cx="${ox + 30}" cy="74" rx="5" ry="12" ${HL}/>`;
      case 'lower_back': return `<rect x="${ox - 12}" y="104" width="24" height="20" rx="5" ${HL}/>`;
      case 'glutes': return `<ellipse cx="${ox - 9}" cy="134" rx="10" ry="12" ${HL}/><ellipse cx="${ox + 9}" cy="134" rx="10" ry="12" ${HL}/>`;
      case 'hamstrings': return `<ellipse cx="${ox - 11}" cy="166" rx="8" ry="24" ${HL}/><ellipse cx="${ox + 11}" cy="166" rx="8" ry="24" ${HL}/>`;
      case 'calves': return `<ellipse cx="${ox - 11}" cy="206" rx="7" ry="18" ${HL}/><ellipse cx="${ox + 11}" cy="206" rx="7" ry="18" ${HL}/>`;
    }
    return '';
  }
  function bodyMapSvg(regions) {
    const F = 68, B = 192;
    const frontKeys = ['delts', 'chest', 'biceps', 'obliques', 'abs', 'inner_thigh', 'quads'];
    const backKeys = ['traps', 'rear_delts', 'lats', 'triceps', 'lower_back', 'glutes', 'hamstrings', 'calves'];
    let s = `<svg viewBox="0 0 260 270" xmlns="http://www.w3.org/2000/svg">`;
    s += silhouette(F) + silhouette(B);
    frontKeys.forEach(k => { if (regions.has(k)) s += frontShape(k, F); });
    backKeys.forEach(k => { if (regions.has(k)) s += backShape(k, B); });
    s += `<text x="${F}" y="252" text-anchor="middle" font-size="12" fill="var(--text-dim)">${t('front')}</text>`;
    s += `<text x="${B}" y="252" text-anchor="middle" font-size="12" fill="var(--text-dim)">${t('back')}</text>`;
    s += `</svg>`;
    return s;
  }
  /* ---- 動作イラスト(その種目をやっている図) ---- */
  // 種目を動作パターン(ポーズ)に対応づける。順序=判定の優先度。
  function exercisePose(ex) {
    const n = ex.name;
    // 脚(先に判定して「カール/エクステンション」の誤爆を防ぐ)
    if (/レッグプレス/.test(n)) return 'legpress';
    if (/レッグエクステンション/.test(n)) return 'legext';
    if (/レッグカール/.test(n)) return 'legcurl';
    if (/カーフ/.test(n)) return 'calf';
    if (/ヒップスラスト|グルート|ブーティ/.test(n)) return 'hipthrust';
    if (/アダクター|アブダクター/.test(n)) return 'adduction';
    if (/スクワット|ハック|スミス|ランジ/.test(n)) return 'squat';
    // 胸
    if (/インクライン/.test(n)) return 'incline';
    if (/デクライン/.test(n)) return 'decline';
    if (/ベンチプレス|チェストプレス/.test(n)) return 'bench';
    if (/フライ/.test(n) && ex.muscle === 'chest') return 'fly';
    if (/プルオーバー/.test(n)) return 'pullover';
    if (/腕立て/.test(n)) return 'pushup';
    // 背中
    if (/プルダウン|ラットプル/.test(n)) return 'pulldown';
    if (/懸垂/.test(n)) return 'pullup';
    if (/デッドリフト/.test(n)) return 'deadlift';
    if (/ロー|ロウ/.test(n) && ex.muscle === 'back') return 'row';
    // 肩
    if (/ショルダープレス/.test(n)) return 'ohp';
    if (/サイドレイズ|フロントレイズ/.test(n)) return 'lateral';
    if (/リアデルト|リアレイズ/.test(n)) return 'reardelt';
    // 腕
    if (/プレスダウン/.test(n)) return 'pushdown';
    if ((/エクステンション/.test(n) && ex.muscle === 'arm') || /フレンチプレス/.test(n)) return 'triceps';
    if (/ディップ/.test(n)) return 'dip';
    if (/カール/.test(n)) return 'curl';
    // 腹・体幹
    if (/バックエクステンション|ローマンチェア|GHD/.test(n)) return 'backext';
    if (/トーソローテーション/.test(n)) return 'twist';
    if (/クランチ|アブドミナル|レッグレイズ/.test(n)) return 'crunch';
    if (/プランク/.test(n)) return 'plank';
    // 有酸素
    if (/バイク|サイクリング/.test(n)) return 'bike';
    if (ex.muscle === 'cardio') return 'run';
    // 部位フォールバック
    return ({ chest: 'bench', back: 'row', shoulder: 'ohp', legs: 'squat', arm: 'curl', abs: 'crunch' })[ex.muscle] || 'curl';
  }
  // 描画ヘルパ(viewBox 0 0 200 150、床 y=134)
  const _FG = 'stroke="var(--fig)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const _BR = 'stroke="var(--accent)" stroke-width="6" stroke-linecap="round"';
  const _hd = (x, y) => `<circle cx="${x}" cy="${y}" r="11" fill="var(--fig)"/>`;
  const _ch = (pts) => `<polyline points="${pts}" ${_FG}/>`;                 // 手足の連結
  const _bar = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${_BR}/>` +
    `<rect x="${x1 - 3}" y="${y1 - 9}" width="6" height="18" rx="2" fill="var(--accent)"/>` +
    `<rect x="${x2 - 3}" y="${y2 - 9}" width="6" height="18" rx="2" fill="var(--accent)"/>`;
  const _cable = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${_BR}/>`;
  const _pad = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="var(--accent)"/>`;
  // 対象筋のハイライト(塗り)と、左側のラベル＋リーダー線
  const _mus = (cx, cy, rx, ry, rot, c) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" transform="rotate(${rot} ${cx} ${cy})"/>`;
  const _lbl = (y, text, c, lx, ly) => `<text x="4" y="${y}" font-size="10" fill="${c}">${text}</text><line x1="54" y1="${y - 3}" x2="${lx}" y2="${ly}" stroke="${c}" stroke-width="1"/>`;
  const _lblR = (y, text, c, lx, ly) => `<text x="196" y="${y}" font-size="10" text-anchor="end" fill="${c}">${text}</text><line x1="${196 - text.length * 10 - 4}" y1="${y - 3}" x2="${lx}" y2="${ly}" stroke="${c}" stroke-width="1"/>`;
  const _torso = (pts) => `<polygon points="${pts}" fill="var(--fig)"/>`;
  // 筋肉色(参考: 胸=赤/肩=橙/三頭=青/二頭=紫/背=緑/脚=黄)
  const CR = 'var(--ng)', CO = 'var(--warn)', CB = 'var(--accent)', CP = 'var(--accent-2)', CG = 'var(--ok)', CY = 'var(--m-legs)';
  const _db = (x, y) => `<rect x="${x - 9}" y="${y - 4}" width="18" height="8" rx="3" fill="var(--accent)"/>`; // ダンベル
  const _floor = () => `<line x1="14" y1="134" x2="186" y2="134" stroke="var(--border)" stroke-width="2"/>`;
  const _bench = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="7" rx="2" fill="var(--border)"/><line x1="${x + 8}" y1="${y + 7}" x2="${x + 8}" y2="134" stroke="var(--border)" stroke-width="3"/><line x1="${x + w - 8}" y1="${y + 7}" x2="${x + w - 8}" y2="134" stroke="var(--border)" stroke-width="3"/>`;
  const _seat = (x, y) => `<rect x="${x - 16}" y="${y}" width="32" height="8" rx="2" fill="var(--border)"/><rect x="${x + 12}" y="${y - 30}" width="8" height="34" rx="2" fill="var(--border)"/><line x1="${x - 12}" y1="${y + 8}" x2="${x - 12}" y2="134" stroke="var(--border)" stroke-width="3"/>`;
  function poseInner(p) {
    switch (p) {
      case 'bench': return _floor()
        + `<rect x="56" y="102" width="82" height="7" rx="2" fill="var(--border)"/><line x1="66" y1="109" x2="66" y2="133" stroke="var(--border)" stroke-width="3"/><line x1="128" y1="109" x2="128" y2="133" stroke="var(--border)" stroke-width="3"/>`
        + _ch('118,98 132,114') + _ch('118,98 130,133') + _torso('78,87 80,101 118,101 120,87') + _hd(70, 93)
        + _ch('93,95 93,66') + _bar(69, 62, 117, 62)
        + _mus(99, 90, 11, 6, 0, CR) + _mus(85, 90, 6, 6, 0, CO) + _mus(93, 78, 4, 8, 0, CB)
        + _lbl(66, '大胸筋', CR, 99, 90) + _lbl(92, '三角筋前部', CO, 85, 90) + _lbl(118, '上腕三頭筋', CB, 93, 78);
      // インクライン: 斜めベンチで胸上部を狙う。対象筋を色分けラベル表示(自作イラスト)
      case 'incline': return _floor() +
        // 斜めのベンチ(背もたれ+座面)
        `<line x1="96" y1="126" x2="142" y2="58" stroke="var(--border)" stroke-width="11" stroke-linecap="round"/>` +
        `<line x1="96" y1="126" x2="122" y2="132" stroke="var(--border)" stroke-width="11" stroke-linecap="round"/>` +
        `<line x1="108" y1="130" x2="108" y2="134" stroke="var(--border)" stroke-width="3"/>` +
        // 脚(先に描いて胴で股関節を隠す)
        _ch('96,112 84,130') + _ch('96,112 104,131') +
        // 胴(塗りで厚みを出す)
        `<polygon points="140,58 128,72 98,116 88,104" fill="var(--fig)"/>` +
        _hd(148, 52) +
        // 腕→バーベル
        _ch('126,70 122,48 118,40') + _bar(98, 36, 142, 36) +
        // 対象筋のハイライト(赤=大胸筋上部/橙=三角筋前部/青=上腕三頭筋)
        `<ellipse cx="122" cy="80" rx="11" ry="7" fill="var(--ng)" transform="rotate(-48 122 80)"/>` +
        `<circle cx="132" cy="66" r="6" fill="var(--warn)"/>` +
        `<ellipse cx="126" cy="53" rx="4.5" ry="9" fill="var(--accent)" transform="rotate(-38 126 53)"/>` +
        // ラベル(リーダー線付き)
        `<text x="4" y="72" font-size="10" fill="var(--ng)">大胸筋上部</text><line x1="53" y1="69" x2="114" y2="80" stroke="var(--ng)" stroke-width="1"/>` +
        `<text x="4" y="98" font-size="10" fill="var(--warn)">三角筋前部</text><line x1="53" y1="95" x2="128" y2="68" stroke="var(--warn)" stroke-width="1"/>` +
        `<text x="4" y="122" font-size="10" fill="var(--accent)">上腕三頭筋</text><line x1="53" y1="119" x2="124" y2="55" stroke="var(--accent)" stroke-width="1"/>`;
      // デクライン: 頭が低い側の斜めベンチ
      case 'decline': return _floor() +
        `<line x1="56" y1="118" x2="104" y2="70" stroke="var(--border)" stroke-width="7" stroke-linecap="round"/>` +
        `<line x1="96" y1="76" x2="122" y2="70" stroke="var(--border)" stroke-width="7" stroke-linecap="round"/>` +
        `<line x1="118" y1="72" x2="118" y2="134" stroke="var(--border)" stroke-width="3"/>` +
        _hd(58, 108) + _ch('66,104 106,78') + _ch('106,78 122,86') + _ch('74,98 66,74') + _bar(44, 72, 90, 72)
        + _mus(88, 92, 10, 6, -38, CR) + _mus(72, 84, 4, 8, -30, CB)
        + _lblR(66, '大胸筋下部', CR, 88, 92) + _lblR(92, '上腕三頭筋', CB, 72, 84);
      case 'fly': return _floor() + _seat(100, 108) + _hd(100, 40) + _ch('100,48 100,86') + _ch('100,54 74,64') + _ch('100,54 126,64') + _db(72, 64) + _db(128, 64)
        + _mus(100, 62, 12, 7, 0, CR) + _lbl(66, '大胸筋', CR, 100, 62);
      case 'pullover': return _floor() + _bench(60, 98, 80) + _hd(70, 94) + _ch('78,94 120,94') + _ch('120,94 134,112 134,133') + _ch('86,94 70,74') + _bar(58, 70, 82, 70)
        + _mus(96, 90, 10, 6, 0, CR) + _mus(112, 90, 8, 5, 0, CG)
        + _lblR(70, '大胸筋', CR, 96, 90) + _lblR(96, '広背筋', CG, 112, 90);
      case 'pushup': return _floor() + _hd(48, 96) + _ch('56,96 120,110') + _ch('60,98 60,124') + _ch('112,108 120,124') + _ch('120,110 150,120')
        + _mus(92, 103, 10, 6, -6, CR) + _mus(62, 112, 4, 7, 0, CB)
        + _lblR(78, '大胸筋', CR, 92, 103) + _lblR(104, '上腕三頭筋', CB, 62, 112);
      case 'pulldown': return _floor() + _seat(104, 112)
        + _torso('96,60 112,60 110,96 98,96') + _hd(104, 50)
        + _ch('104,64 88,44') + _ch('104,64 120,44') + _bar(80, 40, 132, 40)
        + _ch('100,96 90,120') + _ch('108,96 116,120')
        + _mus(104, 80, 11, 9, 0, CG) + _mus(89, 52, 4.5, 7, -20, CP)
        + _lbl(70, '広背筋', CG, 104, 80) + _lbl(96, '上腕二頭筋', CP, 89, 52);
      case 'pullup': return _hd(100, 50) + _ch('100,58 100,98') + _ch('100,60 84,40') + _ch('100,60 116,40') + `<line x1="60" y1="34" x2="140" y2="34" ${_BR}/>` + _ch('100,98 92,124') + _ch('100,98 108,124')
        + _mus(100, 76, 11, 9, 0, CG) + _mus(88, 52, 4, 7, 20, CP)
        + _lbl(80, '広背筋', CG, 100, 76) + _lbl(106, '上腕二頭筋', CP, 88, 52);
      case 'row': return _floor() + _seat(92, 112)
        + _torso('84,58 100,58 98,94 86,94') + _hd(92, 48)
        + _ch('92,64 122,70') + _cable(122, 60, 122, 78)
        + _ch('90,94 108,102') + _ch('90,94 100,120')
        + _mus(90, 76, 10, 9, 0, CG) + _mus(90, 62, 8, 5, 0, CP)
        + _lbl(72, '広背筋', CG, 90, 76) + _lbl(98, '僧帽筋', CP, 90, 62);
      case 'deadlift': return _floor() + _hd(80, 44)
        + _torso('88,50 102,54 96,78 84,72')
        + _ch('98,76 116,98 112,132') + _ch('98,76 124,98 126,132')
        + _ch('93,62 90,98') + _bar(70, 102, 118, 102)
        + _mus(92, 66, 11, 6, -32, CG) + _mus(118, 110, 7, 15, 0, CO)
        + _lbl(58, '脊柱起立筋', CG, 92, 66) + _lbl(122, '臀筋・ハム', CO, 118, 110);
      case 'ohp': return _floor() + _seat(104, 110)
        + _torso('96,58 112,58 110,92 98,92') + _hd(104, 48)
        + _ch('104,60 88,42') + _ch('104,60 120,42') + _bar(78, 38, 130, 38)
        + _mus(92, 54, 7, 7, 0, CO) + _mus(116, 54, 7, 7, 0, CO) + _mus(90, 45, 4, 7, -20, CB)
        + _lbl(64, '三角筋', CO, 92, 54) + _lbl(92, '上腕三頭筋', CB, 90, 45);
      case 'lateral': return _floor() + _hd(100, 36) + _ch('100,44 100,96') + _ch('100,50 74,52') + _ch('100,50 126,52') + _db(72, 52) + _db(128, 52) + _ch('100,96 90,132') + _ch('100,96 110,132')
        + _mus(88, 52, 6, 6, 0, CO) + _mus(112, 52, 6, 6, 0, CO)
        + _lbl(58, '三角筋中部', CO, 88, 52);
      case 'reardelt': return _floor() + _hd(70, 60) + _ch('78,64 122,88') + _ch('86,70 86,44') + _ch('86,70 108,58') + _db(86, 42) + _ch('122,88 118,132') + _ch('122,88 132,132')
        + _mus(88, 66, 6, 6, 0, CO) + _lblR(64, '三角筋後部', CO, 88, 66);
      case 'curl': return _floor() + _hd(100, 32)
        + _torso('92,42 108,42 106,94 94,94')
        + _ch('96,94 88,132') + _ch('104,94 112,132')
        + _ch('97,54 90,76 104,86') + _db(105, 86)
        + _mus(92, 66, 5, 9, 12, CP)
        + _lbl(70, '上腕二頭筋', CP, 92, 66);
      case 'pushdown': return _floor() + _hd(100, 34) + _ch('100,42 100,96') + _ch('100,52 110,74 104,92') + _cable(104, 28, 104, 74) + _cable(94, 92, 114, 92) + _ch('100,96 90,132') + _ch('100,96 110,132')
        + _mus(108, 64, 4, 9, -20, CB) + _lbl(60, '上腕三頭筋', CB, 108, 64);
      case 'triceps': return _floor() + _seat(100, 108) + _hd(100, 42) + _ch('100,50 100,88') + _ch('100,54 110,40 100,30') + _db(100, 28) + _ch('100,54 90,40 100,30')
        + _mus(105, 44, 4, 8, 20, CB) + _lbl(60, '上腕三頭筋', CB, 105, 44);
      case 'dip': return _hd(100, 44) + _ch('100,52 100,96') + _ch('100,56 82,62') + _ch('100,56 118,62') + `<line x1="72" y1="62" x2="90" y2="62" ${_BR}/><line x1="110" y1="62" x2="128" y2="62" ${_BR}/>` + _ch('100,96 96,120') + _ch('100,96 108,120')
        + _mus(100, 74, 9, 5, 0, CR) + _mus(112, 60, 4, 7, 20, CB)
        + _lbl(70, '大胸筋下部', CR, 100, 74) + _lbl(96, '上腕三頭筋', CB, 112, 60);
      case 'squat': return _floor() + _hd(104, 32)
        + _torso('96,42 112,42 110,80 98,80')
        + _ch('100,80 88,104 88,132') + _ch('108,80 120,104 120,132')
        + _ch('99,50 84,56') + _ch('109,50 124,56') + _bar(76, 52, 128, 52)
        + _mus(92, 108, 7, 17, 0, CY) + _mus(116, 108, 7, 17, 0, CY) + _mus(104, 82, 12, 6, 0, CO)
        + _lbl(100, '大腿四頭筋', CY, 92, 108) + _lbl(124, '臀筋', CO, 104, 82);
      case 'legpress': return _floor() + `<rect x="34" y="100" width="40" height="8" rx="2" fill="var(--border)"/>` + _hd(52, 92) + _ch('60,94 88,100') + _ch('88,100 114,86 138,92') + _pad(138, 68, 10, 46)
        + _mus(112, 90, 9, 6, -18, CY) + _lblR(78, '大腿四頭筋', CY, 112, 90);
      case 'legext': return _floor() + _seat(92, 100) + _hd(92, 60) + _ch('92,68 92,98') + _ch('92,98 116,96') + _ch('116,96 122,80') + _pad(117, 74, 12, 9)
        + _mus(104, 96, 10, 6, 0, CY) + _lbl(66, '大腿四頭筋', CY, 104, 96);
      case 'legcurl': return _floor() + _bench(56, 94, 82) + _hd(64, 90) + _ch('72,90 116,90') + _ch('116,90 132,90') + _ch('132,90 130,108') + _pad(124, 104, 14, 9)
        + _mus(106, 90, 10, 6, 0, CO) + _lblR(84, 'ハムストリングス', CO, 106, 90);
      case 'hipthrust': return _floor() + `<rect x="54" y="90" width="34" height="7" rx="2" fill="var(--border)"/>` + _hd(62, 86) + _ch('70,88 96,88') + _ch('96,88 116,108 116,132') + _pad(86, 78, 22, 9)
        + _mus(104, 98, 9, 7, -42, CO) + _lblR(108, '臀筋（大殿筋）', CO, 104, 98);
      case 'adduction': return _floor() + _seat(100, 104) + _hd(100, 60) + _ch('100,68 100,102') + _ch('100,102 82,118') + _ch('100,102 118,118')
        + _mus(100, 110, 8, 6, 0, CP) + _lbl(96, '内転・外転筋', CP, 100, 110);
      case 'calf': return _floor() + _hd(100, 34) + _ch('100,42 100,94') + _ch('100,94 96,124') + _ch('100,94 104,124') + `<circle cx="96" cy="128" r="4" fill="var(--text-dim)"/><circle cx="104" cy="128" r="4" fill="var(--text-dim)"/>` + _ch('100,52 84,52') + _ch('100,52 116,52') + _db(80, 52) + _db(120, 52)
        + _mus(94, 112, 4, 10, 0, CY) + _mus(106, 112, 4, 10, 0, CY) + _lbl(112, 'ふくらはぎ', CY, 96, 112);
      case 'crunch': return _floor() + _hd(60, 104) + _ch('68,104 96,110') + _ch('96,110 116,96 116,120') + _ch('72,104 84,90')
        + _mus(86, 106, 9, 5, -10, CR) + _lblR(96, '腹直筋', CR, 86, 106);
      case 'plank': return _floor() + _hd(52, 100) + _ch('60,102 140,116') + _ch('60,104 58,120') + _ch('140,116 150,120')
        + _mus(100, 109, 11, 5, 8, CR) + _lblR(96, '体幹（腹直筋）', CR, 100, 109);
      case 'backext': return _floor() + `<rect x="96" y="98" width="34" height="8" rx="2" fill="var(--border)"/><line x1="120" y1="106" x2="120" y2="134" stroke="var(--border)" stroke-width="3"/>` + _hd(60, 76) + _ch('66,78 100,100') + _ch('100,100 120,102')
        + _mus(84, 90, 8, 5, -38, CG) + _lblR(74, '脊柱起立筋', CG, 84, 90);
      case 'twist': return _floor() + _seat(100, 108) + _hd(100, 44) + _ch('100,52 100,90') + _ch('100,58 120,54') + _ch('100,58 116,72') + `<path d="M116 44 A18 18 0 0 1 124 62" ${_BR} fill="none"/>`
        + _mus(100, 74, 10, 7, 0, CO) + _lbl(66, '腹斜筋', CO, 100, 74);
      case 'bike': return _floor() + `<circle cx="130" cy="112" r="20" ${_BR} fill="none"/><circle cx="72" cy="118" r="14" ${_BR} fill="none"/><line x1="72" y1="118" x2="110" y2="96" ${_FG}/>` + _hd(96, 60) + _ch('100,68 108,96') + _ch('102,72 122,80') + _ch('108,96 130,112')
        + _mus(106, 84, 6, 8, -40, CY) + _lbl(60, '下半身・心肺', CY, 106, 84);
      case 'run': default: return _floor() + _hd(104, 34) + _ch('104,42 96,86') + _ch('100,54 118,64') + _ch('100,54 82,48') + _ch('96,86 118,96 116,124') + _ch('96,86 78,104 84,128')
        + _mus(112, 106, 5, 10, -12, CY) + _lbl(64, '全身・心肺持久力', CY, 112, 106);
    }
  }
  function poseSvg(p) { return `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">${poseInner(p)}</svg>`; }

  // 動作パターンごとの「主に効く筋肉(具体)」と「フォームのポイント」(自作の一般的なコツ)
  const POSE_MUSCLES = {
    bench: '大胸筋・三角筋前部・上腕三頭筋', incline: '大胸筋上部・三角筋前部・上腕三頭筋', decline: '大胸筋下部・上腕三頭筋',
    fly: '大胸筋', pullover: '大胸筋・広背筋', pushup: '大胸筋・上腕三頭筋・体幹',
    pulldown: '広背筋・大円筋・上腕二頭筋', pullup: '広背筋・上腕二頭筋', row: '広背筋・僧帽筋・菱形筋',
    deadlift: '脊柱起立筋・臀筋・ハムストリングス', ohp: '三角筋・上腕三頭筋', lateral: '三角筋中部',
    reardelt: '三角筋後部・僧帽筋', curl: '上腕二頭筋', pushdown: '上腕三頭筋', triceps: '上腕三頭筋',
    dip: '上腕三頭筋・大胸筋下部', squat: '大腿四頭筋・臀筋・ハムストリングス', legpress: '大腿四頭筋・臀筋',
    legext: '大腿四頭筋', legcurl: 'ハムストリングス', hipthrust: '臀筋（大殿筋）',
    adduction: '内転筋・外転筋', calf: '下腿三頭筋（ふくらはぎ）', crunch: '腹直筋', plank: '腹横筋・体幹',
    backext: '脊柱起立筋・臀筋', twist: '腹斜筋', bike: '下半身・心肺持久力', run: '全身・心肺持久力'
  };
  const POSE_TIPS = {
    bench: ['肩甲骨を寄せて胸を張り、肩を下げて固定する', 'バーは乳頭のあたりへ真っ直ぐ下ろす', '肘は張りすぎず約45〜75度をキープ', '下ろすときに息を吸い、押すときに吐く'],
    incline: ['ベンチは30〜45度に設定（角度が急すぎると肩に効く）', '肩甲骨を寄せて胸を張り、鎖骨〜大胸筋上部へ下ろす', '肘を開きすぎない（約45度）', 'お尻と背中はベンチにつけたまま行う'],
    decline: ['ベンチを15〜30度下げ、脚を固定する', 'バーは大胸筋下部へ下ろす', '肘を伸ばしきる直前で収縮を意識する'],
    fly: ['肘を軽く曲げたまま角度を固定して弧を描く', '胸のストレッチを感じるところまで開く', '閉じるときは大胸筋で寄せる意識'],
    pullover: ['肘を軽く曲げて頭の後ろまでストレッチ', '胸と広背筋の伸びを感じる', '腰が反りすぎないよう体幹を締める'],
    pushup: ['体を頭から踵まで一直線に保つ', '手は肩幅よりやや広め', '胸が床すれすれまで下ろす'],
    pulldown: ['肩をすくめず、肩甲骨を下げてから引く', 'バーは鎖骨〜胸上部へ引き下ろす', '反動を使わず広背筋で引く', '戻すときもゆっくり効かせる'],
    pullup: ['肩甲骨を寄せて胸を張る', '顎がバーを越えるまで引く', '下ろすときも力を抜かない'],
    row: ['肩甲骨を寄せながらみぞおち〜腹へ引く', '背中は丸めず胸を張る', '反動を使わずゆっくり戻す'],
    deadlift: ['背中を丸めずニュートラルを保つ', 'バーは体の近くを通す', '床を押す意識で脚と股関節で立ち上がる', '腹圧を高めて腰を守る'],
    ohp: ['体幹を締め、腰を反りすぎない', 'バー/ダンベルを頭の真上へ押し上げる', '下ろすときは耳の高さまで'],
    lateral: ['反動を使わず肩の高さまで上げる', '小指側をやや上に、僧帽筋に頼らない', 'ゆっくり下ろして負荷を逃がさない'],
    reardelt: ['前傾姿勢で肩甲骨は動かしすぎない', '肘を軽く曲げ、後方へ開く', '三角筋後部の収縮を意識'],
    curl: ['肘を体側に固定して振らない', '手首を返さず二頭筋で挙げる', '下ろすときもゆっくり効かせる'],
    pushdown: ['肘を体側に固定し前腕だけ動かす', '肘を伸ばしきって収縮させる', '反動を使わない'],
    triceps: ['肘の位置を固定して上腕三頭筋を伸ばす', '頭の後ろでしっかりストレッチ', '肘を伸ばしきる'],
    dip: ['やや前傾で胸下部、垂直で三頭に効く', '肩が上がらないよう下げる', '下ろしすぎて肩を痛めない'],
    squat: ['足は肩幅、つま先はやや外向き', '膝とつま先の向きを揃える', '太ももが床と平行まで下ろす', '背中を丸めず胸を張る'],
    legpress: ['膝を内に入れない（つま先と同方向）', '膝を伸ばしきってロックしない', '踵で押す意識'],
    legext: ['反動を使わず膝を伸ばしきる', '一番上で大腿四頭筋を絞る', 'ゆっくり戻す'],
    legcurl: ['反動を使わず踵をお尻へ引きつける', '収縮位置で止めて効かせる', 'ゆっくり戻す'],
    hipthrust: ['肩甲骨をベンチに乗せる', '顎を引き、お尻を締めて持ち上げる', 'トップで骨盤を後傾させ1秒静止', '腰を反らせない'],
    adduction: ['反動を使わずゆっくり閉じる/開く', '内もも/外ももの収縮を意識', '可動域いっぱいに動かす'],
    calf: ['かかとを深く下げてストレッチ', 'つま先立ちで頂点まで上げる', '一番上で1秒止める'],
    crunch: ['みぞおちを丸めるように起こす', '反動や首の力で引っ張らない', '腹直筋の収縮を意識'],
    plank: ['頭から踵まで一直線を保つ', 'お尻を上げ下げしない', '腹部を締めて呼吸を止めない'],
    backext: ['背中を反らせすぎず水平まで', '反動を使わずゆっくり', '臀筋と脊柱起立筋を意識'],
    twist: ['骨盤は固定して上体だけひねる', '反動を使わずコントロール', '腹斜筋の収縮を意識'],
    bike: ['サドル高は脚が軽く曲がる位置に', '一定の負荷とペースを保つ', '目標時間・距離を決めて行う'],
    run: ['無理のないペースから始める', '着地は体の真下を意識', '呼吸を整えて一定ペースを保つ']
  };

  function openExerciseInfo(exId) {
    const ex = Store.exerciseById(exId); if (!ex) return;
    const pose = exercisePose(ex);
    const regions = exerciseRegions(ex);
    const musc = POSE_MUSCLES[pose] || (Data.muscleName(ex.muscle) + (ex.sub ? ' / ' + ex.sub : ''));
    const tips = (Data.lang() === 'ja' && POSE_TIPS[pose]) ? POSE_TIPS[pose] : null;
    const qImg = encodeURIComponent(ex.name + ' 筋トレ マシン');
    const qVid = encodeURIComponent(ex.name + ' やり方');
    showSheet(`<h2>${esc(exName(ex))}</h2>
      <div class="row" style="gap:6px;margin-bottom:6px">${ex.equip ? `<span class="etag">${esc(ex.equip)}</span>` : ''}${muscleTag(ex.muscle)}</div>
      <div class="sec-title">${t('pose_label')}</div>
      <div class="posefig">${poseSvg(pose)}</div>
      <div class="sec-title">${t('worked_muscles')}：${esc(musc)}</div>
      <div class="bodymap">${bodyMapSvg(regions)}</div>
      ${tips ? `<div class="sec-title">${t('points_label')}</div><ul class="tips">${tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <a class="linkbtn mb" href="https://www.google.com/search?tbm=isch&q=${qImg}" target="_blank" rel="noopener noreferrer">${t('see_images')}</a>
      <a class="linkbtn" href="https://www.youtube.com/results?search_query=${qVid}" target="_blank" rel="noopener noreferrer">${t('see_video')}</a>
      <p class="muted small mt">${t('info_ext_note')}</p>`, { stack: true });
  }

  /* ============ 種目ピッカー(シート) ============ */
  function openPicker(onPick) {
    picker.q = ''; picker.muscle = 'all'; picker.onPick = onPick;
    showSheet(pickerInner());
  }
  function pickerInner() {
    const chips = [{ key: 'all', label: t('all') }].concat(Data.MUSCLES.map(m => ({ key: m.key, label: Data.muscleName(m.key) })));
    return `<h2>${t('pick_title')}</h2>
      <input data-in="pickq" placeholder="${t('search_ph')}" value="${esc(picker.q)}">
      <div class="chips scroll mt">${chips.map(c => `<div class="chip ${picker.muscle === c.key ? 'active' : ''}" data-act="pick-filter" data-key="${c.key}">${esc(c.label)}</div>`).join('')}</div>
      <div id="pick-list">${filteredPickList()}</div>
      <button class="btn ghost mt" data-act="new-exercise">${t('add_custom')}</button>`;
  }
  // 直近に使った種目のID(重複なし・新しい順)
  function recentExerciseIds(limit) {
    const ids = [], seen = new Set();
    const sessions = Store.getSessions().slice().sort((a, b) => (b.startedAt || b.date).localeCompare(a.startedAt || a.date));
    for (const s of sessions) {
      for (const we of s.exercises) {
        if (!seen.has(we.exerciseId) && Store.exerciseById(we.exerciseId)) { seen.add(we.exerciseId); ids.push(we.exerciseId); }
        if (ids.length >= limit) return ids;
      }
    }
    return ids;
  }
  function pickRow(e, showMuscle) {
    const tags = (showMuscle ? muscleTag(e.muscle) : '') + (e.equip ? `<span class="etag">${esc(e.equip)}</span>` : '');
    return `<div class="pick-row" data-act="do-pick" data-id="${e.id}"><span class="pname">${esc(exName(e))}</span>${tags}<button class="pick-info" data-act="ex-info" data-id="${e.id}" aria-label="info">ⓘ</button></div>`;
  }
  // 部位内をサブ部位の見出しでグループ化(サブ無しは先頭にそのまま)
  function renderWithSubs(items) {
    const noSub = items.filter(e => !e.sub);
    let html = noSub.map(e => pickRow(e, false)).join('');
    const subs = {};
    items.filter(e => e.sub).forEach(e => { (subs[e.sub] = subs[e.sub] || []).push(e); });
    const order = Data.SUB_ORDER.filter(s => subs[s]).concat(Object.keys(subs).filter(s => !Data.SUB_ORDER.includes(s)));
    order.forEach(s => { html += `<div class="pick-sub">${esc(s)}</div>` + subs[s].map(e => pickRow(e, false)).join(''); });
    return html;
  }
  function filteredPickList() {
    const all = Store.getExercises();
    // 検索モード: 部位横断でフラット表示(部位タグ付き)
    if (picker.q) {
      const q = picker.q.toLowerCase();
      const list = all.filter(e => exName(e).toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || (e.equip || '').includes(picker.q))
        .sort((a, b) => a.muscle.localeCompare(b.muscle) || a.order - b.order);
      return list.map(e => pickRow(e, true)).join('') || `<p class="muted center">${t('no_match')}</p>`;
    }
    let html = '';
    if (picker.muscle === 'all') {
      const rec = recentExerciseIds(6).map(id => Store.exerciseById(id)).filter(Boolean);
      if (rec.length) html += `<div class="pick-group">🕒 ${t('recent_ex')}</div>` + rec.map(e => pickRow(e, true)).join('');
      Data.MUSCLES.forEach(m => {
        const items = all.filter(e => e.muscle === m.key).sort((a, b) => a.order - b.order);
        if (items.length) html += `<div class="pick-group">${esc(Data.muscleName(m.key))}</div>` + renderWithSubs(items);
      });
    } else {
      const items = all.filter(e => e.muscle === picker.muscle).sort((a, b) => a.order - b.order);
      html += renderWithSubs(items);
    }
    return html || `<p class="muted center">${t('no_match')}</p>`;
  }
  function refreshPicker() {
    const ov = $('.sheet-overlay'); if (!ov) return;
    $('.sheet', ov).innerHTML = `<div class="grab"></div>` + pickerInner();
  }
  function openNewExercise() {
    showSheet(`<h2>${t('custom_title')}</h2>
      <label class="field"><span class="lab">${t('ex_name')}</span><input data-in="newexname" placeholder="${t('ex_name_ph')}"></label>
      <label class="field"><span class="lab">${t('part')}</span>
        <div class="chips">${Data.MUSCLES.map((m, i) => `<div class="chip ${i === 0 ? 'active' : ''}" data-act="newex-muscle" data-key="${m.key}">${Data.muscleName(m.key)}</div>`).join('')}</div>
      </label>
      <button class="btn" data-act="save-newex">${t('add_do')}</button>`);
    newExMuscle = 'chest';
  }

  /* ============ レストタイマー(通知音・振動なし。視覚カウントのみ) ============ */
  const timer = { remain: 0, total: 0, id: null, done: false };
  function startTimer(sec) {
    stopTimer();
    timer.total = sec; timer.remain = sec; timer.done = false;
    timer.id = setInterval(() => {
      timer.remain -= 1;
      if (timer.remain <= 0) { timer.remain = 0; stopTimer(); timer.done = true; }
      syncTimerBar();
    }, 1000);
    syncTimerBar();
  }
  function stopTimer() { if (timer.id) clearInterval(timer.id); timer.id = null; }
  function clearTimer() { stopTimer(); timer.remain = 0; timer.total = 0; timer.done = false; syncTimerBar(); }
  function syncTimerBar() {
    let bar = $('#timer-bar');
    const show = timer.id || timer.done;
    if (!show) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'timer-bar'; document.body.appendChild(bar); }
    bar.className = 'timer-bar' + (timer.done ? ' done' : '');
    if (timer.done) {
      bar.innerHTML = `<span class="t">${t('rest_done')}</span><div class="spacer"></div><button data-act="timer-dismiss">${t('ok')}</button>`;
    } else {
      bar.innerHTML = `<span>${t('rest')}</span><span class="t">${Data.fmtClock(timer.remain)}</span><div class="spacer"></div>
        <button data-act="timer-add">+30s</button><button data-act="timer-skip">${t('skip')}</button>`;
    }
  }

  /* ============ 履歴タブ ============ */
  function renderHistory() {
    if (state.hist.screen === 'detail') return renderSessionDetail();
    if (!state.hist.ym) { const n = new Date(); state.hist.ym = [n.getFullYear(), n.getMonth()]; }
    const [y, m] = state.hist.ym;
    const sessions = Store.getSessions().filter(s => s.done);
    const byDate = {};
    sessions.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });

    let h = `<div class="head"><h1>📅 ${t('h_history')}</h1></div>`;
    h += `<div class="card"><div class="cal-head">
      <button data-act="cal-prev" aria-label="prev">‹</button><div class="m">${Data.fmtMonthYear(y, m)}</div><button data-act="cal-next" aria-label="next">›</button>
    </div><div class="cal-grid">`;
    Data.dow().forEach(d => h += `<div class="dow">${d}</div>`);
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < first; i++) h += `<div class="cal-cell empty"></div>`;
    const todayK = Data.todayKey();
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const has = byDate[key];
      const cls = has ? 'has' : (key === todayK ? 'today' : '');
      const marks = has ? `<span class="mk">${has.slice(0, 3).map(() => '<i></i>').join('')}</span>` : '';
      h += `<div class="cal-cell ${cls}" ${has ? `data-act="cal-day" data-date="${key}"` : ''}>${d}${marks}</div>`;
    }
    h += `</div></div>`;

    const sorted = sessions.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.startedAt || '').localeCompare(a.startedAt || ''));
    h += `<div class="card"><h2>${t('all_records', { n: sorted.length })}</h2>`;
    h += sorted.length ? sorted.map(s => sessionRow(s)).join('') : `<p class="muted small">${t('history_empty')}</p>`;
    h += `</div>`;
    return h;
  }

  function renderSessionDetail() {
    const s = Store.getSession(state.hist.sessionId);
    if (!s) { state.hist.screen = 'list'; return renderHistory(); }
    const vol = Data.sessionVolumeKg(s);
    let h = `<button class="back-btn" data-act="hist-back">‹ ${t('h_history')}</button>`;
    h += `<div class="head"><h1 style="font-size:18px">${esc(s.name || Data.fmtDate(s.date))}</h1></div>`;
    h += `<div class="tiles">
      <div class="tile"><div class="n">${s.exercises.length}</div><div class="l">${t('col_exercises')}</div></div>
      <div class="tile"><div class="n">${Data.sessionSetCount(s)}</div><div class="l">${t('col_sets2')}</div></div>
      <div class="tile"><div class="n">${Data.fmtNum(Data.kgToDisplay(vol, unit()))}</div><div class="l">${uLab()} ${t('col_total')}</div></div>
    </div>`;
    h += `<div class="card"><div class="lsub muted" style="margin-bottom:8px">${Data.fmtDate(s.date)}</div>`;
    s.exercises.forEach(we => {
      const ex = Store.exerciseById(we.exerciseId) || { name: '(?)', muscle: '' };
      const cardio = Data.isCardioMuscle(ex.muscle);
      h += `<div style="margin:10px 0"><div class="row" style="margin-bottom:4px"><b>${esc(exName(ex))}</b> ${ex.muscle ? muscleTag(ex.muscle) : ''}</div>`;
      h += we.sets.map((set, i) => cardio
        ? `<div class="small" style="color:var(--text-dim)">${i + 1}. ${Data.fmtNum(set.duration)}${t('col_min')} / ${Data.fmtNum(set.distance)}km ${set.done ? '✓' : ''}</div>`
        : `<div class="small" style="color:var(--text-dim)">${set.warmup ? 'W' : setNumber(we, i)}. ${disp(set.weight)}${uLab()} × ${set.reps || 0}${t('col_reps')} ${set.done ? '✓' : ''}</div>`
      ).join('');
      if (we.note) h += `<div class="small muted">📝 ${esc(we.note)}</div>`;
      h += `</div>`;
    });
    if (s.note) h += `<div class="hr"></div><div class="small">📝 ${esc(s.note)}</div>`;
    h += `</div>`;
    h += `<div class="row"><button class="btn secondary" data-act="edit-session" data-id="${s.id}">${t('edit_resume')}</button>
      <button class="btn danger" data-act="del-session" data-id="${s.id}">${t('delete')}</button></div>`;
    return h;
  }

  /* ============ グラフタブ ============ */
  function renderGraph() {
    const sessions = Store.getSessions().filter(s => s.done);
    let h = `<div class="head"><h1>📈 ${t('h_graph')}</h1></div>`;
    if (!sessions.length) { h += `<div class="empty"><span class="big">📈</span>${t('graph_empty')}</div>`; return h; }

    const usedIds = new Set();
    sessions.forEach(s => s.exercises.forEach(we => usedIds.add(we.exerciseId)));
    const exs = Store.getExercises().filter(e => usedIds.has(e.id));
    if (!state.graph.exerciseId || !usedIds.has(state.graph.exerciseId)) state.graph.exerciseId = exs[0] && exs[0].id;
    const exId = state.graph.exerciseId;
    const cardio = isCardio(exId);

    h += `<label class="field"><span class="lab">${t('exercise')}</span>
      <select data-in="graph-ex">${exs.map(e => `<option value="${e.id}" ${e.id === exId ? 'selected' : ''}>${esc(exName(e))}</option>`).join('')}</select></label>`;

    if (cardio) {
      if (state.graph.metric !== 'duration' && state.graph.metric !== 'distance') state.graph.metric = 'duration';
      h += `<div class="seg mb">
        <button class="${state.graph.metric === 'duration' ? 'active' : ''}" data-act="graph-metric" data-m="duration">${t('m_duration')}</button>
        <button class="${state.graph.metric === 'distance' ? 'active' : ''}" data-act="graph-metric" data-m="distance">${t('m_distance')}</button></div>`;
      const series = []; let longestT = 0, longestD = 0, count = 0;
      sessions.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
        const we = s.exercises.find(e => e.exerciseId === exId); if (!we) return;
        let dur = 0, dist = 0;
        we.sets.forEach(set => { dur += set.duration || 0; dist += set.distance || 0; });
        if (dur > longestT) longestT = dur; if (dist > longestD) longestD = dist; count += 1;
        series.push({ label: Data.fmtDateShort(s.date), duration: dur, distance: dist });
      });
      const metric = state.graph.metric;
      const points = series.map(p => ({ label: p.label, value: metric === 'duration' ? p.duration : p.distance }));
      h += `<div class="card"><h2>${metric === 'duration' ? t('trend_duration') : t('trend_distance')}</h2>
        <div class="chart-wrap">${Charts.lineAbs(points, { w: 340, h: 210, color: 'var(--m-cardio)' })}</div></div>`;
      h += `<div class="tiles">
        <div class="tile"><div class="n">${Data.fmtNum(longestT)}</div><div class="l">${t('pb_longest_t')}</div></div>
        <div class="tile"><div class="n">${Data.fmtNum(longestD)}</div><div class="l">${t('pb_longest_d')}</div></div>
        <div class="tile"><div class="n">${count}</div><div class="l">${t('pb_sessions')}</div></div>
      </div>`;
      h += renderMuscleVolume(sessions);
      return h;
    }

    if (state.graph.metric !== 'max' && state.graph.metric !== 'volume') state.graph.metric = 'max';
    h += `<div class="seg mb">
      <button class="${state.graph.metric === 'max' ? 'active' : ''}" data-act="graph-metric" data-m="max">${t('m_max')}</button>
      <button class="${state.graph.metric === 'volume' ? 'active' : ''}" data-act="graph-metric" data-m="volume">${t('m_volume')}</button>
    </div>`;
    const series = []; let bestW = 0, bestVol = 0, best1rm = 0;
    sessions.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
      const we = s.exercises.find(e => e.exerciseId === exId); if (!we) return;
      let maxW = 0, vol = 0, one = 0;
      we.sets.forEach(set => {
        if (set.warmup) return;
        const w = set.weight || 0, r = set.reps || 0;
        if (w > maxW) maxW = w; vol += w * r;
        const e1 = Data.estimate1RM(w, r); if (e1 > one) one = e1;
      });
      if (maxW > bestW) bestW = maxW; if (vol > bestVol) bestVol = vol; if (one > best1rm) best1rm = one;
      series.push({ label: Data.fmtDateShort(s.date), max: maxW, volume: vol });
    });
    const metric = state.graph.metric;
    const points = series.map(p => ({ label: p.label, value: Data.kgToDisplay(metric === 'max' ? p.max : p.volume, unit()) }));
    h += `<div class="card"><h2>${metric === 'max' ? t('trend_max') : t('trend_volume')}（${uLab()}）</h2>
      <div class="chart-wrap">${Charts.lineAbs(points, { w: 340, h: 210, unit: uLab() })}</div></div>`;
    h += `<div class="tiles">
      <div class="tile"><div class="n">${Data.fmtNum(Data.kgToDisplay(bestW, unit()))}</div><div class="l">${t('pb_best')} ${uLab()}</div></div>
      <div class="tile"><div class="n">${Data.fmtNum(Data.kgToDisplay(bestVol, unit()))}</div><div class="l">${t('pb_maxvol')}</div></div>
      <div class="tile"><div class="n">${Data.fmtNum(Data.kgToDisplay(best1rm, unit()))}</div><div class="l">${t('pb_1rm')}</div></div>
    </div>`;
    h += renderMuscleVolume(sessions);
    return h;
  }

  function renderMuscleVolume(sessions) {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const sinceK = Data.dateKey(since);
    const byMuscle = {};
    sessions.filter(s => s.date >= sinceK).forEach(s => {
      s.exercises.forEach(we => {
        const ex = Store.exerciseById(we.exerciseId); if (!ex || Data.isCardioMuscle(ex.muscle)) return;
        let v = 0; we.sets.forEach(set => { if (!set.warmup && set.done) v += (set.weight || 0) * (set.reps || 0); });
        byMuscle[ex.muscle] = (byMuscle[ex.muscle] || 0) + v;
      });
    });
    const entries = Data.MUSCLES.map(m => ({ m, v: byMuscle[m.key] || 0 })).filter(e => e.v > 0);
    if (!entries.length) return '';
    const max = Math.max(...entries.map(e => e.v));
    const items = entries.map(e => ({ label: Data.muscleName(e.m.key), value: e.v / max, color: `var(--${e.m.cls})`, note: Data.fmtNum(Data.kgToDisplay(e.v, unit())) }));
    return `<div class="card"><h2>${t('muscle_vol', { u: uLab() })}</h2><div class="chart-wrap">${Charts.bars(items, 320)}</div></div>`;
  }

  /* ============ メニュー(テンプレート)タブ ============ */
  function renderMenu() {
    if (state.menu.screen === 'edit') return renderTemplateEdit();
    const templates = Store.getTemplates();
    let h = `<div class="head"><h1>📋 ${t('h_menu')}</h1><div class="spacer"></div>
      <button class="icon-btn" data-act="new-template" aria-label="${t('a_new_tpl')}">＋</button></div>`;
    if (!templates.length) {
      h += `<div class="empty"><span class="big">📋</span>${t('menu_empty')}</div>`;
      h += `<button class="btn" data-act="new-template">${t('create_tpl')}</button>`;
      return h;
    }
    h += templates.map(tp => `<div class="card tap" data-act="edit-template" data-id="${tp.id}">
      <div class="row"><div class="lmain"><div class="ltitle">${esc(tp.name)}</div>
      <div class="lsub">${tp.exercises.map(te => { const e = Store.exerciseById(te.exerciseId); return e ? esc(exName(e)) : ''; }).filter(Boolean).join('・') || t('no_ex_set')}</div></div>
      <button class="btn small" data-act="start-tpl" data-id="${tp.id}" onclick="event.stopPropagation()">${t('start')}</button></div></div>`).join('');
    return h;
  }

  function renderTemplateEdit() {
    const d = state.menu.draft;
    let h = `<button class="back-btn" data-act="menu-back">‹ ${t('h_menu')}</button>`;
    h += `<div class="head"><h1 style="font-size:18px">${t('template')}</h1></div>`;
    h += `<label class="field"><span class="lab">${t('name')}</span><input data-in="tpl-name" value="${esc(d.name)}" placeholder="${t('name_ph')}"></label>`;
    h += `<label class="field"><span class="lab">${t('desc')}</span><input data-in="tpl-desc" value="${esc(d.description || '')}" placeholder="${t('desc_ph')}"></label>`;
    h += `<div class="card"><h2>${t('ex_and_target')}</h2>`;
    if (!d.exercises.length) {
      h += `<p class="muted small">${t('tpl_hint')}</p>`;
    } else {
      d.exercises.forEach((te, i) => {
        const e = Store.exerciseById(te.exerciseId) || { name: '(?)', muscle: '' };
        const cardio = Data.isCardioMuscle(e.muscle);
        const fields = cardio
          ? `<label class="field" style="flex:1;margin:0"><span class="lab">${t('t_min')}</span><input class="num-in" inputmode="decimal" data-in="tpl-duration" data-i="${i}" value="${te.duration || ''}" placeholder="30"></label>
             <label class="field" style="flex:1;margin:0"><span class="lab">${t('t_km')}</span><input class="num-in" inputmode="decimal" data-in="tpl-distance" data-i="${i}" value="${te.distance || ''}" placeholder="5"></label>`
          : `<label class="field" style="flex:1;margin:0"><span class="lab">${t('t_sets')}</span><input class="num-in" inputmode="numeric" data-in="tpl-sets" data-i="${i}" value="${te.sets || ''}" placeholder="3"></label>
             <label class="field" style="flex:1;margin:0"><span class="lab">${t('t_reps')}</span><input class="num-in" inputmode="numeric" data-in="tpl-reps" data-i="${i}" value="${te.reps || ''}" placeholder="10"></label>
             <label class="field" style="flex:1;margin:0"><span class="lab">${uLab()}</span><input class="num-in" inputmode="decimal" data-in="tpl-weight" data-i="${i}" value="${te.weight != null ? disp(te.weight) : ''}" placeholder="0"></label>`;
        h += `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
          <div class="row" style="margin-bottom:6px"><b style="flex:1">${esc(exName(e))}</b>
            <button class="set-del" data-act="tpl-del-ex" data-i="${i}" aria-label="delete">✕</button></div>
          <div class="row">${fields}</div></div>`;
      });
    }
    h += `<button class="btn ghost mt" data-act="tpl-add-ex">${t('add_exercise')}</button></div>`;
    h += `<div class="row"><button class="btn" data-act="tpl-save">${t('save')}</button></div>`;
    if (d.id) h += `<button class="btn danger mt" data-act="tpl-delete">${t('del_tpl')}</button>`;
    return h;
  }

  /* ============ 体調タブ ============ */
  function renderCondition() {
    if (state.cond.screen === 'edit') return renderConditionEdit();
    const logs = Store.getLogs();
    let h = `<div class="head"><h1>🌙 ${t('h_condition')}</h1><div class="spacer"></div>
      <button class="icon-btn" data-act="cond-today" aria-label="${t('a_cond_today')}">＋</button></div>`;
    const weights = logs.filter(l => l.weight).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (weights.length >= 2) {
      const points = weights.slice(-30).map(l => ({ label: Data.fmtDateShort(l.date), value: Data.kgToDisplay(l.weight, unit()) }));
      h += `<div class="card"><h2>${t('weight_trend', { u: uLab() })}</h2>
        <div class="chart-wrap">${Charts.lineAbs(points, { w: 340, h: 190, unit: uLab(), color: 'var(--m-legs)' })}</div></div>`;
    }
    h += `<button class="btn" data-act="cond-today">${t('cond_today_btn')}</button>`;
    h += `<div class="card mt"><h2>${t('record_list')}</h2>`;
    if (!logs.length) {
      h += `<p class="muted small">${t('cond_empty')}</p>`;
    } else {
      h += logs.map(l => {
        const parts = [];
        if (l.weight) parts.push(`${disp(l.weight)}${uLab()}`);
        if (l.sleepHours) parts.push(`😴 ${Data.fmtNum(l.sleepHours)}h`);
        if (l.calories) parts.push(`🍚 ${l.calories}kcal`);
        if (l.protein) parts.push(`🍗 ${l.protein}g`);
        return `<div class="lrow" data-act="cond-edit" data-date="${l.date}">
          <div class="lmain"><div class="ltitle">${Data.fmtDate(l.date)}</div>
          <div class="lsub">${parts.join(' ・ ') || t('note_only')}</div></div>
          <div style="font-size:18px;color:var(--text-dim)">›</div></div>`;
      }).join('');
    }
    h += `</div>`;
    return h;
  }

  function renderConditionEdit() {
    const date = state.cond.date;
    const l = Store.getLog(date) || { date };
    const q = condQuality;
    let h = `<button class="back-btn" data-act="cond-back">‹ ${t('h_condition')}</button>`;
    h += `<div class="head"><h1 style="font-size:18px">${Data.fmtDate(date)}</h1></div>`;
    h += `<div class="card">
      <label class="field"><span class="lab">${t('c_weight', { u: uLab() })}</span><input inputmode="decimal" data-in="c-weight" value="${l.weight != null ? disp(l.weight) : ''}" placeholder="0"></label>
      <label class="field"><span class="lab">${t('c_sleep')}</span><input inputmode="decimal" data-in="c-sleep" value="${l.sleepHours != null ? Data.fmtNum(l.sleepHours) : ''}" placeholder="7"></label>
      <label class="field"><span class="lab">${t('c_quality')}</span>
        <div class="seg" id="sleep-q">${[1, 2, 3, 4, 5].map(v => `<button class="${q === v ? 'active' : ''}" data-act="c-quality" data-v="${v}">${'★'.repeat(v)}</button>`).join('')}</div></label>
      <label class="field"><span class="lab">${t('c_cal')}</span><input inputmode="numeric" data-in="c-cal" value="${l.calories != null ? l.calories : ''}" placeholder="2000"></label>
      <label class="field"><span class="lab">${t('c_protein')}</span><input inputmode="numeric" data-in="c-protein" value="${l.protein != null ? l.protein : ''}" placeholder="120"></label>
      <label class="field"><span class="lab">${t('c_note')}</span><textarea data-in="c-note" placeholder="${t('c_note_ph')}">${esc(l.note || '')}</textarea></label>
    </div>`;
    h += `<div class="row"><button class="btn" data-act="c-save">${t('save')}</button></div>`;
    if (Store.getLog(date)) h += `<button class="btn danger mt" data-act="c-delete">${t('delete')}</button>`;
    return h;
  }
  let condQuality = 0;

  /* ============ 設定タブ ============ */
  function renderSettings() {
    const s = S();
    const theme = Store.getTheme();
    let h = `<button class="back-btn" data-act="settings-back">‹ ${t('back')}</button>`;
    h += `<div class="head"><h1>⚙️ ${t('settings')}</h1></div>`;
    h += `<div class="card"><h2>${t('s_unit')}</h2>
      <div class="seg"><button class="${s.unit === 'kg' ? 'active' : ''}" data-act="set-unit" data-v="kg">kg</button>
      <button class="${s.unit === 'lbs' ? 'active' : ''}" data-act="set-unit" data-v="lbs">lbs</button></div></div>`;
    h += `<div class="card"><h2>${t('s_lang')}</h2>
      <div class="seg"><button class="${s.lang === 'ja' ? 'active' : ''}" data-act="set-lang" data-v="ja">日本語</button>
      <button class="${s.lang === 'en' ? 'active' : ''}" data-act="set-lang" data-v="en">English</button></div>
      <p class="muted small mt">${t('s_lang_hint')}</p></div>`;
    h += `<div class="card"><h2>${t('s_appearance')}</h2>
      <div class="seg"><button class="${theme === 'system' ? 'active' : ''}" data-act="set-theme" data-v="system">${t('th_auto')}</button>
      <button class="${theme === 'light' ? 'active' : ''}" data-act="set-theme" data-v="light">${t('th_light')}</button>
      <button class="${theme === 'dark' ? 'active' : ''}" data-act="set-theme" data-v="dark">${t('th_dark')}</button></div></div>`;
    h += `<div class="card"><h2>${t('s_rest')}</h2>
      <label class="field"><span class="lab">${t('rest_default')}</span><input inputmode="numeric" data-in="rest-default" value="${s.restDefault}"></label>
      <div class="row"><span class="spacer">${t('rest_auto')}</span>
        <div class="seg" style="width:120px"><button class="${s.restAuto ? 'active' : ''}" data-act="set-restauto" data-v="1">${t('on')}</button>
        <button class="${!s.restAuto ? 'active' : ''}" data-act="set-restauto" data-v="0">${t('off')}</button></div></div></div>`;
    h += `<div class="card"><h2>${t('s_data')}</h2>
      <button class="btn secondary mb" data-act="export">${t('export_btn')}</button>
      <button class="btn secondary mb" data-act="import">${t('import_btn')}</button>
      <button class="btn danger" data-act="reset">${t('reset_btn')}</button>
      <p class="muted small mt">${t('data_hint')}</p></div>`;
    h += `<p class="muted small center">${t('version')}</p>`;
    return h;
  }

  /* ============ イベント処理(委譲) ============ */
  let newExMuscle = 'chest';
  let pendingTplPick = false;
  let exNoteTargetIndex = null;

  const ACTIONS = {
    'open-settings': () => { $$('.view').forEach(v => v.classList.remove('active')); $('#view-settings').classList.add('active'); state.tab = 'settings'; render(); },
    'settings-back': () => switchTab('workout'),
    'go-history': () => switchTab('history'),
    'rm-calc': () => openRmCalc(),

    'start-empty': () => {
      cur = { id: Store.uid(), date: Data.todayKey(), name: '', note: '', startedAt: new Date().toISOString(), finishedAt: null, done: false, exercises: [] };
      Store.saveSession(cur); state.wo.screen = 'session'; state.wo.backTo = null; render();
    },
    'resume': () => { cur = Store.getActiveSession(); state.wo.screen = 'session'; state.wo.backTo = null; render(); },
    'start-tpl': (d) => startFromTemplate(d.id),
    'open-session': (d) => { state.hist.screen = 'detail'; state.hist.sessionId = d.id; switchTab('history'); },
    'close-session': () => { saveCur(); if (state.wo.backTo === 'history') switchTab('history'); else { state.wo.screen = 'home'; render(); } },
    'pick-ex': () => openPicker((exId) => { addExerciseToSession(exId); closeSheet(); render(); }),
    'add-set': (d) => { const we = cur.exercises[+d.ex]; we.sets.push(newSet(we.exerciseId, we.sets[we.sets.length - 1])); saveCur(); render(); },
    'add-warm': (d) => { const we = cur.exercises[+d.ex]; we.sets.unshift({ id: Store.uid(), weight: 0, reps: 0, warmup: true, done: false }); saveCur(); render(); },
    'del-set': (d) => { cur.exercises[+d.ex].sets.splice(+d.set, 1); saveCur(); render(); },
    'toggle-set': (d) => {
      const set = cur.exercises[+d.ex].sets[+d.set];
      set.done = !set.done; saveCur();
      if (set.done && !set.warmup && S().restAuto) startTimer(S().restDefault);
      render();
    },
    'ex-menu': (d) => openExMenu(+d.ex),
    'exnote-save': () => saveExNote(),
    'ex-up': (d) => { const i = +d.ex; if (i > 0) { const a = cur.exercises; [a[i - 1], a[i]] = [a[i], a[i - 1]]; saveCur(); closeSheet(); render(); } },
    'ex-down': (d) => { const i = +d.ex; const a = cur.exercises; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; saveCur(); closeSheet(); render(); } },
    'ex-remove': (d) => { cur.exercises.splice(+d.ex, 1); saveCur(); closeSheet(); render(); },
    'finish-session': () => {
      if (!cur.exercises.length) { toast(t('no_exercise_toast')); return; }
      cur.done = true; cur.finishedAt = new Date().toISOString(); Store.saveSession(cur);
      clearTimer();
      const back = state.wo.backTo; cur = null; state.wo.screen = 'home'; state.wo.backTo = null;
      toast(t('saved_workout'));
      if (back === 'history') switchTab('history'); else render();
    },
    'discard-session': () => confirmSheet(t('discard_confirm'), () => {
      Store.deleteSession(cur.id); clearTimer();
      const back = state.wo.backTo; cur = null; state.wo.screen = 'home'; state.wo.backTo = null;
      if (back === 'history') switchTab('history'); else render();
    }),

    'pick-filter': (d) => { picker.muscle = d.key; refreshPicker(); },
    'do-pick': (d) => { if (picker.onPick) picker.onPick(d.id); },
    'ex-info': (d) => openExerciseInfo(d.id),
    'new-exercise': () => openNewExercise(),
    'newex-muscle': (d, el) => { $$('.chip', el.parentElement).forEach(c => c.classList.remove('active')); el.classList.add('active'); newExMuscle = d.key; },
    'save-newex': () => {
      const name = ($('[data-in="newexname"]') || {}).value || '';
      if (!name.trim()) { toast(t('need_name')); return; }
      const ex = Store.addExercise(name, newExMuscle || 'chest');
      closeSheet();
      if (state.wo.screen === 'session' && picker.onPick) addExerciseToSession(ex.id);
      else if (pendingTplPick) addTplExercise(ex.id);
      render(); toast(t('ex_added'));
    },

    'timer-add': () => { timer.remain += 30; if (!timer.id && !timer.done) startTimer(timer.remain); else if (timer.done) { timer.done = false; startTimer(timer.remain); } syncTimerBar(); },
    'timer-skip': () => clearTimer(),
    'timer-dismiss': () => clearTimer(),

    'cal-prev': () => { let [y, m] = state.hist.ym; m--; if (m < 0) { m = 11; y--; } state.hist.ym = [y, m]; render(); },
    'cal-next': () => { let [y, m] = state.hist.ym; m++; if (m > 11) { m = 0; y++; } state.hist.ym = [y, m]; render(); },
    'cal-day': (d) => { const list = Store.getSessions().filter(s => s.done && s.date === d.date); if (list.length === 1) openDetail(list[0].id); else openDayList(d.date, list); },
    'hist-back': () => { state.hist.screen = 'list'; render(); },
    'day-open': (d) => { closeSheet(); openDetail(d.id); },
    'edit-session': (d) => { cur = Store.getSession(d.id); state.wo.screen = 'session'; state.wo.backTo = 'history'; switchTab('workout'); },
    'del-session': (d) => confirmSheet(t('del_confirm'), () => { Store.deleteSession(d.id); state.hist.screen = 'list'; closeSheet(); render(); }),

    'graph-metric': (d) => { state.graph.metric = d.m; render(); },

    'new-template': () => { state.menu.draft = { id: null, name: '', description: '', exercises: [] }; state.menu.screen = 'edit'; render(); },
    'edit-template': (d) => { state.menu.draft = JSON.parse(JSON.stringify(Store.getTemplate(d.id))); state.menu.screen = 'edit'; render(); },
    'menu-back': () => { state.menu.screen = 'list'; render(); },
    'tpl-add-ex': () => { pendingTplPick = true; openPicker((exId) => { addTplExercise(exId); closeSheet(); render(); }); },
    'tpl-del-ex': (d) => { state.menu.draft.exercises.splice(+d.i, 1); render(); },
    'tpl-save': () => {
      const d = state.menu.draft;
      if (!d.name.trim()) { toast(t('need_name')); return; }
      if (!d.id) d.id = Store.uid();
      Store.saveTemplate(d); state.menu.screen = 'list'; render(); toast(t('tpl_saved'));
    },
    'tpl-delete': () => confirmSheet(t('tpl_del_confirm'), () => { if (state.menu.draft.id) Store.deleteTemplate(state.menu.draft.id); state.menu.screen = 'list'; closeSheet(); render(); }),

    'cond-today': () => { state.cond.date = Data.todayKey(); condQuality = (Store.getLog(state.cond.date) || {}).sleepQuality || 0; state.cond.screen = 'edit'; render(); },
    'cond-edit': (d) => { state.cond.date = d.date; condQuality = (Store.getLog(d.date) || {}).sleepQuality || 0; state.cond.screen = 'edit'; render(); },
    'cond-back': () => { state.cond.screen = 'list'; render(); },
    'c-quality': (d) => { condQuality = +d.v; $$('#sleep-q button').forEach(b => b.classList.toggle('active', +b.dataset.v === condQuality)); },
    'c-save': () => saveCondition(),
    'c-delete': () => confirmSheet(t('cond_del_confirm'), () => { Store.deleteLog(state.cond.date); state.cond.screen = 'list'; closeSheet(); render(); }),

    'set-unit': (d) => { Store.setSettings({ unit: d.v }); render(); },
    'set-lang': (d) => { Store.setSettings({ lang: d.v }); relabelTabs(); render(); },
    'set-theme': (d) => { Store.setTheme(d.v); applyTheme(); render(); },
    'set-restauto': (d) => { Store.setSettings({ restAuto: d.v === '1' }); render(); },
    'export': () => doExport(),
    'import': () => doImport(),
    'reset': () => confirmSheet(t('reset_confirm'), () => { Store.resetData(); closeSheet(); toast(t('reset_done')); render(); }),

    'sheet-close': () => closeSheet()
  };

  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (ACTIONS[act]) { e.preventDefault(); ACTIONS[act](el.dataset, el); }
  }
  function onInput(e) {
    const el = e.target.closest('[data-in]');
    if (!el) return;
    const k = el.dataset.in, v = el.value;
    if (k === 'sname' && cur) { cur.name = v; saveCur(); return; }
    if (k === 'snote' && cur) { cur.note = v; saveCur(); return; }
    if (k === 'weight' && cur) { cur.exercises[+el.dataset.ex].sets[+el.dataset.set].weight = Data.displayToKg(v, unit()); saveCur(); return; }
    if (k === 'reps' && cur) { cur.exercises[+el.dataset.ex].sets[+el.dataset.set].reps = parseInt(v, 10) || 0; saveCur(); return; }
    if (k === 'duration' && cur) { cur.exercises[+el.dataset.ex].sets[+el.dataset.set].duration = parseFloat(v) || 0; saveCur(); return; }
    if (k === 'distance' && cur) { cur.exercises[+el.dataset.ex].sets[+el.dataset.set].distance = parseFloat(v) || 0; saveCur(); return; }
    if (k === 'rm-weight') { rmState.weight = v; refreshRm(); return; }
    if (k === 'rm-reps') { rmState.reps = v; refreshRm(); return; }
    if (k === 'pickq') { picker.q = v; const list = $('#pick-list'); if (list) list.innerHTML = filteredPickList(); return; }
    if (k === 'graph-ex') { state.graph.exerciseId = v; render(); return; }
    if (k === 'tpl-name') { state.menu.draft.name = v; return; }
    if (k === 'tpl-desc') { state.menu.draft.description = v; return; }
    if (k === 'tpl-sets') { state.menu.draft.exercises[+el.dataset.i].sets = parseInt(v, 10) || 0; return; }
    if (k === 'tpl-reps') { state.menu.draft.exercises[+el.dataset.i].reps = parseInt(v, 10) || 0; return; }
    if (k === 'tpl-weight') { state.menu.draft.exercises[+el.dataset.i].weight = Data.displayToKg(v, unit()); return; }
    if (k === 'tpl-duration') { state.menu.draft.exercises[+el.dataset.i].duration = parseFloat(v) || 0; return; }
    if (k === 'tpl-distance') { state.menu.draft.exercises[+el.dataset.i].distance = parseFloat(v) || 0; return; }
    if (k === 'rest-default') { Store.setSettings({ restDefault: Math.max(5, parseInt(v, 10) || 90) }); return; }
  }

  /* ---- サブ処理 ---- */
  function startFromTemplate(id) {
    const tp = Store.getTemplate(id); if (!tp) return;
    const session = { id: Store.uid(), date: Data.todayKey(), name: tp.name, note: '', startedAt: new Date().toISOString(), finishedAt: null, done: false, exercises: [] };
    tp.exercises.forEach(te => {
      let sets;
      if (isCardio(te.exerciseId)) {
        sets = [{ id: Store.uid(), duration: te.duration || 0, distance: te.distance || 0, done: false }];
      } else {
        const n = Math.max(1, te.sets || 1); sets = [];
        for (let i = 0; i < n; i++) sets.push({ id: Store.uid(), weight: te.weight || 0, reps: te.reps || 0, warmup: false, done: false });
      }
      session.exercises.push({ id: Store.uid(), exerciseId: te.exerciseId, note: '', sets });
    });
    cur = session; Store.saveSession(cur);
    state.wo.screen = 'session'; state.wo.backTo = null;
    switchTab('workout');
  }
  function addTplExercise(exId) {
    const entry = isCardio(exId) ? { exerciseId: exId, duration: 30, distance: 5 } : { exerciseId: exId, sets: 3, reps: 10, weight: null };
    state.menu.draft.exercises.push(entry);
    pendingTplPick = false;
  }
  function openExMenu(ei) {
    exNoteTargetIndex = ei;
    const we = cur.exercises[ei];
    const ex = Store.exerciseById(we.exerciseId) || { name: '' };
    showSheet(`<h2>${esc(exName(ex))}</h2>
      <button class="btn secondary mb" data-act="ex-info" data-id="${we.exerciseId}">${t('about_ex')}</button>
      <label class="field"><span class="lab">${t('ex_note')}</span><textarea id="exnote">${esc(we.note || '')}</textarea></label>
      <button class="btn mb" data-act="exnote-save">${t('save_note')}</button>
      <div class="row">
        <button class="btn secondary" data-act="ex-up" data-ex="${ei}" ${ei === 0 ? 'disabled' : ''}>${t('move_up')}</button>
        <button class="btn secondary" data-act="ex-down" data-ex="${ei}" ${ei === cur.exercises.length - 1 ? 'disabled' : ''}>${t('move_down')}</button>
      </div>
      <button class="btn danger mt" data-act="ex-remove" data-ex="${ei}">${t('remove_ex')}</button>`);
  }
  function saveExNote() {
    const ta = $('#exnote'); if (!ta || exNoteTargetIndex == null || !cur) { closeSheet(); return; }
    cur.exercises[exNoteTargetIndex].note = ta.value; saveCur(); closeSheet(); render(); toast(t('note_saved'));
  }
  function saveCondition() {
    const g = (sel) => ($('[data-in="' + sel + '"]') || {}).value || '';
    const log = { date: state.cond.date };
    const w = g('c-weight'); if (w) log.weight = Data.displayToKg(w, unit());
    const sl = g('c-sleep'); if (sl) log.sleepHours = parseFloat(sl);
    if (condQuality) log.sleepQuality = condQuality;
    const cal = g('c-cal'); if (cal) log.calories = parseInt(cal, 10);
    const pr = g('c-protein'); if (pr) log.protein = parseInt(pr, 10);
    const nt = g('c-note'); if (nt.trim()) log.note = nt.trim();
    Store.saveLog(log);
    state.cond.screen = 'list'; render(); toast(t('cond_saved'));
  }
  function openDetail(id) { state.hist.screen = 'detail'; state.hist.sessionId = id; switchTab('history'); }
  function openDayList(date, list) {
    showSheet(`<h2>${Data.fmtDate(date)}</h2>${list.map(s => `<div class="pick-row" data-act="day-open" data-id="${s.id}"><span class="pname">${esc(s.name || t('h_record'))}</span><span class="muted small">${t('n_exercises', { n: s.exercises.length })}</span></div>`).join('')}`);
  }
  function confirmSheet(msg, onOk) {
    showSheet(`<h2>${t('confirm')}</h2><p class="mb">${esc(msg)}</p>
      <button class="btn danger mb" data-act="confirm-ok">${t('run')}</button>
      <button class="btn secondary" data-act="sheet-close">${t('cancel')}</button>`);
    ACTIONS['confirm-ok'] = () => { onOk(); };
  }

  /* ---- エクスポート / インポート ---- */
  function doExport() {
    const data = JSON.stringify(Store.exportAll(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kintore-backup-${Data.todayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t('exported'));
  }
  function doImport() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const r = Store.importMerge(JSON.parse(reader.result));
          applyTheme(); relabelTabs(); render();
          toast(t('imported', { e: r.exercises, s: r.sessions }));
        } catch (e) { toast(t('import_failed')); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  /* ---- テーマ・タブラベル ---- */
  function applyTheme() {
    const pref = Store.getTheme();
    const light = pref === 'light' || (pref === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    const meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', light ? '#eef1f6' : '#070a11');
  }
  function relabelTabs() {
    const map = { workout: 'tab_record', history: 'tab_history', graph: 'tab_graph', menu: 'tab_menu', condition: 'tab_condition' };
    $$('.tabbar button').forEach(b => {
      const key = map[b.dataset.tab]; if (!key) return;
      const ico = b.querySelector('.ico').outerHTML;
      b.innerHTML = ico + t(key);
    });
  }

  /* ============ 起動 ============ */
  function boot() {
    Store.ensureSeed();
    applyTheme();
    relabelTabs();
    document.body.addEventListener('click', onClick);
    document.body.addEventListener('input', onInput);
    $$('.tabbar button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (Store.getTheme() === 'system') applyTheme(); });
    render();
    const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
    if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isLocal) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
