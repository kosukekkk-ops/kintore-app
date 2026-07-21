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
  function showSheet(inner) {
    closeSheet();
    const ov = document.createElement('div');
    ov.className = 'sheet-overlay';
    ov.innerHTML = `<div class="sheet"><div class="grab"></div>${inner}</div>`;
    ov.addEventListener('click', (e) => { if (e.target === ov) closeSheet(); });
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
    syncTimerBar();
  }

  /* ============ ワークアウト(記録)タブ ============ */
  function renderWorkout() {
    if (state.wo.screen === 'session' && cur) return renderSession();
    return renderWorkoutHome();
  }

  function renderWorkoutHome() {
    const active = Store.getActiveSession();
    const templates = Store.getTemplates();
    const recent = Store.getSessions().filter(s => s.done).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    let h = `<div class="head"><h1>🏋️ ${t('h_record')}</h1><div class="spacer"></div>
      <button class="icon-btn" data-act="open-settings" aria-label="${t('a_settings')}">⚙️</button></div>`;

    if (active) {
      h += `<div class="card tap" data-act="resume">
        <div class="row"><div class="lmain">
          <div class="ltitle">▶ ${t('in_progress')}</div>
          <div class="lsub">${esc(active.name || Data.fmtDate(active.date))} ・ ${t('n_exercises', { n: active.exercises.length })}</div>
        </div><div style="font-size:22px">›</div></div></div>`;
    }
    h += `<button class="btn" data-act="start-empty">${t('start_new')}</button>`;

    h += `<div class="card mt"><h2>${t('start_from_tpl')}</h2>`;
    if (!templates.length) {
      h += `<p class="muted small">${t('no_tpl_hint')}</p>`;
    } else {
      h += templates.map(tp => `<div class="lrow" data-act="start-tpl" data-id="${tp.id}">
        <div class="lmain"><div class="ltitle">${esc(tp.name)}</div>
        <div class="lsub">${t('n_exercises', { n: tp.exercises.length })}</div></div>
        <div style="font-size:20px;color:var(--text-dim)">▶</div></div>`).join('');
    }
    h += `</div>`;

    h += `<div class="card"><h2>${t('recent')}</h2>`;
    h += recent.length ? recent.map(s => sessionRow(s)).join('') : `<p class="muted small">${t('no_records')}</p>`;
    h += `</div>`;
    return h;
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
  function filteredPickList() {
    let list = Store.getExercises().slice().sort((a, b) => a.muscle.localeCompare(b.muscle) || a.order - b.order);
    if (picker.muscle !== 'all') list = list.filter(e => e.muscle === picker.muscle);
    if (picker.q) { const q = picker.q.toLowerCase(); list = list.filter(e => exName(e).toLowerCase().includes(q) || e.name.toLowerCase().includes(q)); }
    return list.map(e => `<div class="pick-row" data-act="do-pick" data-id="${e.id}"><span class="pname">${esc(exName(e))}</span>${muscleTag(e.muscle)}</div>`).join('') || `<p class="muted center">${t('no_match')}</p>`;
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
    const meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', light ? '#eef1f6' : '#0f1420');
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
