/**
 * Игра "Определи вес"
 * Уравновешивай весы, ловя падающие гирьки
 */

// Мобильное меню
(function() {
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  if (burger && nav) {
    burger.addEventListener('click', () => nav.classList.toggle('nav--open'));
  }
})();

// Игра
(function() {
  'use strict';

  // Конфигурация игры
  const CFG = {
    levels: [
      { id: 1, name: 'Лёгкий', min: 1, max: 10, fallTime: 4000, spawnInterval: 2000, timeLimit: 60, rounds: 2, mult: 1 },
      { id: 2, name: 'Средний', min: 1, max: 25, fallTime: 3200, spawnInterval: 1700, timeLimit: 55, rounds: 2, mult: 1.5 },
      { id: 3, name: 'Сложный', min: 5, max: 50, fallTime: 2500, spawnInterval: 1400, timeLimit: 50, rounds: 2, mult: 2 }
    ],
    shelfMax: 3,
    panMax: 15,
    basePoints: 100,
    perfectBonus: 50,
    timeBonus: 1.5,
    wrongPenalty: 30,
    missedPenalty: 5,
    storageKey: 'weightGame_history',
    maxHistory: 50
  };

  // Состояние игры
  let S = {
    name: '',
    level: 0,
    round: 0,
    score: 0,
    timeLeft: 0,
    leftW: [],
    rightW: [],
    shelfW: [],
    roundResults: [],
    totalRounds: 0,
    successRounds: 0,
    playing: false,
    timerInt: null,
    spawnInt: null,
    weightPool: []
  };

  // DOM элементы
  const $ = id => document.getElementById(id);
  const el = {
    splash: $('splash-screen'),
    game: $('game-screen'),
    results: $('results-screen'),
    nameInput: $('player-name'),
    btnStart: $('btn-start'),
    btnCheck: $('btn-check'),
    btnSkip: $('btn-skip'),
    btnRestart: $('btn-restart'),
    btnNewPlayer: $('btn-new-player'),
    btnClearSplash: $('btn-clear-splash'),
    btnClearResults: $('btn-clear-results'),
    hudLevel: $('hud-level'),
    hudRound: $('hud-round'),
    hudTime: $('hud-time'),
    hudScore: $('hud-score'),
    timeBar: $('time-bar'),
    roundDots: $('round-dots'),
    gameArea: $('game-area'),
    fallZone: $('fall-zone'),
    shelf: $('shelf'),
    beam: $('beam'),
    panLeft: $('pan-left'),
    panRight: $('pan-right'),
    panZoneLeft: $('pan-zone-left'),
    panZoneRight: $('pan-zone-right'),
    totalLeft: $('total-left'),
    totalRight: $('total-right'),
    resultsTitle: $('results-title'),
    finalScore: $('final-score'),
    resultsMsg: $('results-msg'),
    statLevel: $('stat-level'),
    statRounds: $('stat-rounds'),
    statAcc: $('stat-acc'),
    splashHistory: $('splash-history'),
    splashHistoryList: $('splash-history-list'),
    resultsHistoryList: $('results-history-list'),
    toast: $('toast')
  };

  // === Утилиты ===

  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  function toast(msg, type = 'info', dur = 2000) {
    el.toast.textContent = msg;
    el.toast.className = 'toast show ' + type;
    setTimeout(() => el.toast.classList.remove('show'), dur);
  }

  function shuffle(arr) {
    for (let pass = 0; pass < 3; pass++) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    return arr;
  }

  // === Генерация гирек с гарантией решения ===

  function generateSolvableWeights(cfg, count) {
    const weights = [];
    const minTarget = cfg.min * 2;
    const maxTarget = Math.min(cfg.max * 3, 100);
    const targetSum = Math.max(rand(minTarget, maxTarget), cfg.min * 2);

    const leftWeights = generateWeightsForSum(targetSum, rand(2, 4), cfg.min, cfg.max);
    const rightWeights = generateWeightsForSum(targetSum, rand(2, 4), cfg.min, cfg.max);

    weights.push(...leftWeights, ...rightWeights);

    const distractorCount = Math.max(0, count - weights.length);
    for (let i = 0; i < distractorCount; i++) {
      weights.push(rand(cfg.min, cfg.max));
    }

    return shuffle(weights);
  }

  function generateWeightsForSum(targetSum, count, min, max) {
    const weights = [];
    let remaining = targetSum;

    for (let i = 0; i < count - 1; i++) {
      const minNeeded = (count - i - 1) * min;
      const maxAllowed = remaining - minNeeded;

      if (maxAllowed < min) break;

      const w = rand(min, Math.min(max, maxAllowed));
      weights.push(w);
      remaining -= w;
    }

    if (remaining >= min && remaining <= max) {
      weights.push(remaining);
    } else if (remaining > max) {
      while (remaining > 0) {
        const w = Math.min(remaining, max);
        weights.push(w);
        remaining -= w;
      }
    } else if (remaining > 0) {
      weights.push(remaining);
    }

    return weights;
  }

  function refillWeightPool() {
    const cfg = CFG.levels[S.level];
    const count = rand(12, 20);
    S.weightPool = shuffle(generateSolvableWeights(cfg, count));
  }

  // === Хранилище ===

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(CFG.storageKey)) || []; }
    catch { return []; }
  }

  function saveGame(result) {
    let h = getHistory();
    const acc = S.totalRounds > 0 ? Math.round((S.successRounds / S.totalRounds) * 100) : 0;
    const now = new Date();

    h.unshift({
      id: Date.now(),
      name: S.name,
      score: Math.round(S.score),
      level: S.level + 1,
      rounds: S.successRounds,
      accuracy: acc,
      result,
      date: now.toLocaleDateString('ru-RU'),
      time: now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    });

    h = h.slice(0, CFG.maxHistory);
    localStorage.setItem(CFG.storageKey, JSON.stringify(h));
    return h;
  }

  function clearHistory() {
    localStorage.removeItem(CFG.storageKey);
    toast('История очищена');
  }

  const resultEmoji = r => ({ complete: '🏆', time: '⏰', failed: '❌', skipped: '⏭️' }[r] || '🎮');

  function renderHistory(listEl, h, limit = 10) {
    if (!h.length) {
      listEl.innerHTML = '<li class="history-item"><span style="color:var(--muted)">Пусто</span></li>';
      return;
    }

    listEl.innerHTML = h.slice(0, limit).map((g, i) => `
      <li class="history-item ${i === 0 ? 'current' : ''}">
        <span class="history-emoji">${resultEmoji(g.result)}</span>
        <div class="history-info">
          <div class="history-name">${g.name}</div>
          <div class="history-details">Ур.${g.level} • ${g.rounds}р • ${g.accuracy}%</div>
        </div>
        <div class="history-right">
          <div class="history-score">${g.score}</div>
          <div class="history-date">${g.date}</div>
        </div>
      </li>
    `).join('');
  }

  // === Весы ===

  function updateScale() {
    const L = S.leftW.reduce((a, b) => a + b, 0);
    const R = S.rightW.reduce((a, b) => a + b, 0);

    el.totalLeft.textContent = L;
    el.totalRight.textContent = R;

    const diff = L - R;
    const angle = Math.max(-12, Math.min(12, (diff / 50) * 12));
    el.beam.style.transform = `translateX(-50%) rotate(${-angle}deg)`;

    const shift = Math.abs(angle) * 3.5;
    if (L > R) {
      el.panZoneLeft.style.transform = `translateY(${shift}px)`;
      el.panZoneRight.style.transform = `translateY(${-shift}px)`;
    } else if (R > L) {
      el.panZoneLeft.style.transform = `translateY(${-shift}px)`;
      el.panZoneRight.style.transform = `translateY(${shift}px)`;
    } else {
      el.panZoneLeft.style.transform = 'translateY(0)';
      el.panZoneRight.style.transform = 'translateY(0)';
    }

    el.btnCheck.disabled = !(L > 0 || R > 0);
    el.btnCheck.style.opacity = (L === R && L > 0) ? '1' : '0.7';
  }

  function renderPan(panEl, weights) {
    const side = panEl.dataset.side;
    panEl.innerHTML = weights.map(w => `<div class="pan-weight" data-value="${w}">${w}</div>`).join('');
    panEl.querySelectorAll('.pan-weight').forEach(w => makeDraggable(w, side));
  }

  function renderShelf() {
    el.shelf.querySelectorAll('.shelf-weight').forEach(w => w.remove());
    S.shelfW.forEach(w => {
      const div = document.createElement('div');
      div.className = 'shelf-weight';
      div.dataset.value = w;
      div.textContent = w;
      makeDraggable(div, 'shelf');
      el.shelf.appendChild(div);
    });
  }

  // === Выделение гирьки (для клавиатуры) ===

  let selected = { el: null, from: null, value: null };

  function selectWeight(element, from) {
    if (!S.playing) return;
    clearSelection();
    selected.el = element;
    selected.from = from;
    selected.value = parseInt(element.dataset.value);
    element.classList.add('selected');
    toast(`Гирька ${selected.value} — A/D/W`, 'info', 1200);
  }

  function selectFallingWeight(element) {
    if (!S.playing) return;
    clearSelection();
    selected.el = element;
    selected.from = 'falling';
    selected.value = parseInt(element.dataset.value);
    element.classList.add('selected');
    toast(`Поймана ${selected.value} — A/D/W`, 'success', 1200);
  }

  function clearSelection() {
    if (selected.el) selected.el.classList.remove('selected');
    selected = { el: null, from: null, value: null };
  }

  function moveSelectedTo(target) {
    if (!selected.el || !S.playing) return;

    // Проверяем лимиты
    if (target === 'left' && S.leftW.length >= CFG.panMax) {
      toast('⚖️ Левая чаша полная!', 'error', 1000);
      return;
    }
    if (target === 'right' && S.rightW.length >= CFG.panMax) {
      toast('⚖️ Правая чаша полная!', 'error', 1000);
      return;
    }
    if (target === 'shelf' && S.shelfW.length >= CFG.shelfMax) {
      toast('📦 Полка заполнена!', 'error', 1000);
      return;
    }
    if (target === selected.from) return;

    // Удаляем из источника
    if (selected.from === 'falling') {
      // Падающая гирька — удаляем DOM элемент
      if (selected.el && selected.el.parentNode) {
        selected.el.remove();
      }
    } else {
      const arr = selected.from === 'left' ? S.leftW : selected.from === 'right' ? S.rightW : S.shelfW;
      const i = arr.indexOf(selected.value);
      if (i > -1) arr.splice(i, 1);
    }

    // Добавляем в цель
    if (target === 'left') S.leftW.push(selected.value);
    else if (target === 'right') S.rightW.push(selected.value);
    else S.shelfW.push(selected.value);

    clearSelection();
    renderPan(el.panLeft, S.leftW);
    renderPan(el.panRight, S.rightW);
    renderShelf();
    updateScale();
  }

  // === Drag & Drop ===

  let ghost = null;
  let dragData = { value: null, from: null, el: null };
  let dragStartPos = null;
  let isDragging = false;
  const DRAG_THRESHOLD = 5;

  function makeDraggable(element, from) {
    element.addEventListener('touchstart', e => startDrag(e, element, from), { passive: false });
    element.addEventListener('mousedown', e => startDrag(e, element, from));
  }

  function startDrag(e, element, from) {
    e.preventDefault();
    
    const pos = e.touches ? e.touches[0] : e;
    dragStartPos = { x: pos.clientX, y: pos.clientY };
    isDragging = false;
    
    dragData.value = parseInt(element.dataset.value);
    dragData.from = from;
    dragData.el = element;

    if (e.touches) {
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    } else {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
    }
  }

  function beginActualDrag() {
    if (isDragging) return;
    isDragging = true;
    
    dragData.el.style.opacity = '0.4';
    
    ghost = document.createElement('div');
    ghost.className = 'weight-ghost';
    ghost.textContent = dragData.value;
    document.body.appendChild(ghost);

    if (S.leftW.length < CFG.panMax) el.panLeft.classList.add('drag-over');
    if (S.rightW.length < CFG.panMax) el.panRight.classList.add('drag-over');
    if (S.shelfW.length < CFG.shelfMax && dragData.from !== 'shelf') {
      el.shelf.classList.add('drag-over');
    }
  }

  function onMove(e) {
    e.preventDefault();
    const pos = e.touches ? e.touches[0] : e;
    
    // Проверяем порог для начала перетаскивания
    if (!isDragging && dragStartPos) {
      const dx = pos.clientX - dragStartPos.x;
      const dy = pos.clientY - dragStartPos.y;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        beginActualDrag();
      }
    }
    
    if (!isDragging) return;
    
    moveGhost(pos.clientX, pos.clientY);

    const shelfFull = S.shelfW.length >= CFG.shelfMax;
    const leftFull = S.leftW.length >= CFG.panMax;
    const rightFull = S.rightW.length >= CFG.panMax;

    const overLeft = isOver(pos, el.panLeft);
    const overRight = isOver(pos, el.panRight);
    const overShelf = isOver(pos, el.shelf) && dragData.from !== 'shelf';

    el.panLeft.classList.toggle('drag-over', overLeft && !leftFull);
    el.panLeft.classList.toggle('pan-full', overLeft && leftFull);
    el.panRight.classList.toggle('drag-over', overRight && !rightFull);
    el.panRight.classList.toggle('pan-full', overRight && rightFull);
    el.shelf.classList.toggle('drag-over', overShelf && !shelfFull);
    el.shelf.classList.toggle('shelf-full', overShelf && shelfFull);
  }

  function onEnd(e) {
    const pos = e.changedTouches ? e.changedTouches[0] : e;
    
    // Если не было перетаскивания — это клик для выделения
    if (!isDragging && dragData.el) {
      if (dragData.from === 'falling') {
        // Падающая гирька поймана — выделяем её
        selectFallingWeight(dragData.el);
      } else {
        // Гирька на весах/полке — выделяем
        selectWeight(dragData.el, dragData.from);
      }
      cleanupDrag();
      return;
    }
    
    let target = null;
    let dropFailed = false;

    const shelfFull = S.shelfW.length >= CFG.shelfMax;
    const leftFull = S.leftW.length >= CFG.panMax;
    const rightFull = S.rightW.length >= CFG.panMax;

    if (isOver(pos, el.panLeft)) {
      if (leftFull) {
        toast('⚖️ Левая чаша полная!', 'error', 1500);
        el.panLeft.classList.add('shake-pan');
        setTimeout(() => el.panLeft.classList.remove('shake-pan'), 300);
        dropFailed = true;
      } else {
        target = 'left';
      }
    } else if (isOver(pos, el.panRight)) {
      if (rightFull) {
        toast('⚖️ Правая чаша полная!', 'error', 1500);
        el.panRight.classList.add('shake-pan');
        setTimeout(() => el.panRight.classList.remove('shake-pan'), 300);
        dropFailed = true;
      } else {
        target = 'right';
      }
    } else if (isOver(pos, el.shelf) && dragData.from !== 'shelf') {
      if (shelfFull) {
        toast('📦 Полка заполнена!', 'error', 1500);
        el.shelf.classList.add('shake');
        setTimeout(() => el.shelf.classList.remove('shake'), 300);
        dropFailed = true;
      } else {
        target = 'shelf';
      }
    }

    if (target && !dropFailed) {
      dropWeight(target);
    } else if (dragData.from === 'falling' && dragData.el) {
      resumeFalling(dragData.el);
    }

    cleanupDrag();
  }
  
  function cleanupDrag() {
    if (dragData.el && dragData.from !== 'falling') dragData.el.style.opacity = '1';
    if (ghost) { ghost.remove(); ghost = null; }

    el.panLeft.classList.remove('drag-over', 'pan-full');
    el.panRight.classList.remove('drag-over', 'pan-full');
    el.shelf.classList.remove('drag-over', 'shelf-full');
    
    dragData = { value: null, from: null, el: null };
    dragStartPos = null;
    isDragging = false;

    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
  }

  function resumeFalling(weightEl) {
    if (!weightEl || !weightEl.parentNode) return;

    const cfg = CFG.levels[S.level];
    weightEl.classList.remove('caught');
    weightEl.style.opacity = '1';
    weightEl.style.animationPlayState = 'running';

    const fallZoneRect = el.fallZone.getBoundingClientRect();
    const weightRect = weightEl.getBoundingClientRect();
    const currentTop = weightRect.top - fallZoneRect.top;

    if (currentTop >= 180) {
      weightEl.style.animation = 'flyAway 0.3s ease forwards';
      setTimeout(() => weightEl.remove(), 300);
      return;
    }

    const remainingDistance = 200 - currentTop;
    const remainingTime = Math.max((remainingDistance / 260) * cfg.fallTime, 400);

    weightEl.style.animation = 'none';
    weightEl.style.top = currentTop + 'px';
    void weightEl.offsetWidth;
    weightEl.style.animation = `fallResume ${remainingTime}ms linear forwards`;

    const timeoutId = setTimeout(() => {
      if (weightEl.parentNode && !weightEl.classList.contains('caught')) {
        weightEl.style.animation = 'flyAway 0.3s ease forwards';
        setTimeout(() => weightEl.remove(), 300);
        S.score = Math.max(0, S.score - CFG.missedPenalty * cfg.mult);
        updateHUD();
      }
    }, remainingTime);

    weightEl.dataset.fallTimeout = timeoutId;
  }

  function moveGhost(x, y) {
    if (ghost) {
      ghost.style.left = x + 'px';
      ghost.style.top = y + 'px';
    }
  }

  function isOver(pos, elem) {
    const r = elem.getBoundingClientRect();
    return pos.clientX >= r.left && pos.clientX <= r.right && 
           pos.clientY >= r.top && pos.clientY <= r.bottom;
  }

  function dropWeight(target) {
    const v = dragData.value;
    const from = dragData.from;

    if (from === 'shelf') {
      const i = S.shelfW.indexOf(v);
      if (i > -1) S.shelfW.splice(i, 1);
    } else if (from === 'left') {
      const i = S.leftW.indexOf(v);
      if (i > -1) S.leftW.splice(i, 1);
    } else if (from === 'right') {
      const i = S.rightW.indexOf(v);
      if (i > -1) S.rightW.splice(i, 1);
    } else if (from === 'falling') {
      if (dragData.el && dragData.el.parentNode) {
        dragData.el.remove();
      }
    }

    if (target === 'left') S.leftW.push(v);
    else if (target === 'right') S.rightW.push(v);
    else if (target === 'shelf' && S.shelfW.length < CFG.shelfMax) S.shelfW.push(v);

    renderPan(el.panLeft, S.leftW);
    renderPan(el.panRight, S.rightW);
    renderShelf();
    updateScale();
  }

  // === Падающие гирьки ===

  function spawnWeight() {
    if (!S.playing) return;

    const cfg = CFG.levels[S.level];

    if (S.weightPool.length === 0) {
      refillWeightPool();
    }

    const v = S.weightPool.pop();
    const w = document.createElement('div');
    w.className = 'falling-weight';
    w.textContent = v;
    w.dataset.value = v;

    const zoneWidth = el.fallZone.offsetWidth || 300;
    w.style.left = rand(15, Math.max(50, zoneWidth - 70)) + 'px';

    const fallVariation = cfg.fallTime * (0.85 + Math.random() * 0.3);
    w.style.animation = `fall ${Math.round(fallVariation)}ms linear forwards`;

    el.fallZone.appendChild(w);

    const startFallDrag = (e) => {
      e.preventDefault();
      if (w.dataset.fallTimeout) {
        clearTimeout(parseInt(w.dataset.fallTimeout));
        delete w.dataset.fallTimeout;
      }
      w.style.animationPlayState = 'paused';
      w.classList.add('caught');
      startDrag(e, w, 'falling');
    };

    w.addEventListener('touchstart', startFallDrag, { passive: false });
    w.addEventListener('mousedown', startFallDrag);

    const fallTimeout = setTimeout(() => {
      if (w.parentNode && !w.classList.contains('caught')) {
        w.style.animation = 'flyAway 0.3s ease forwards';
        setTimeout(() => w.remove(), 300);
        S.score = Math.max(0, S.score - CFG.missedPenalty * cfg.mult);
        updateHUD();
      }
    }, Math.round(fallVariation));

    w.dataset.fallTimeout = fallTimeout;
  }

  function startSpawning() {
    const cfg = CFG.levels[S.level];
    spawnWeight();
    S.spawnInt = setInterval(spawnWeight, cfg.spawnInterval);
  }

  function stopSpawning() {
    clearInterval(S.spawnInt);
    el.fallZone.innerHTML = '';
  }

  // === Игровая логика ===

  function startGame() {
    S.name = el.nameInput.value.trim() || 'Игрок';
    S.level = 0;
    S.score = 0;
    S.totalRounds = 0;
    S.successRounds = 0;
    showScreen('game-screen');
    startLevel();
  }

  function startLevel() {
    const cfg = CFG.levels[S.level];
    S.round = 0;
    S.roundResults = [];
    S.timeLeft = cfg.timeLimit;
    S.playing = true;
    updateHUD();
    renderRoundDots();
    startRound();
    startTimer();
  }

  function startRound() {
    S.leftW = [];
    S.rightW = [];
    S.shelfW = [];
    S.weightPool = [];
    refillWeightPool();
    renderPan(el.panLeft, []);
    renderPan(el.panRight, []);
    renderShelf();
    updateScale();
    stopSpawning();
    startSpawning();
  }

  function startTimer() {
    clearInterval(S.timerInt);
    S.timerInt = setInterval(() => {
      if (!S.playing) return;
      S.timeLeft--;
      updateHUD();
      if (S.timeLeft <= 0) endGame('time');
    }, 1000);
  }

  function updateHUD() {
    const cfg = CFG.levels[S.level];
    el.hudLevel.textContent = cfg.id;
    el.hudRound.textContent = `${S.round + 1}/${cfg.rounds}`;
    el.hudScore.textContent = Math.round(S.score);
    el.hudTime.textContent = S.timeLeft;

    el.hudTime.classList.remove('warning', 'danger');
    if (S.timeLeft <= 10) el.hudTime.classList.add('danger');
    else if (S.timeLeft <= 20) el.hudTime.classList.add('warning');

    const pct = (S.timeLeft / cfg.timeLimit) * 100;
    el.timeBar.style.width = pct + '%';
    el.timeBar.classList.remove('warning', 'danger');
    if (pct <= 20) el.timeBar.classList.add('danger');
    else if (pct <= 40) el.timeBar.classList.add('warning');
  }

  function renderRoundDots() {
    const cfg = CFG.levels[S.level];
    el.roundDots.innerHTML = '';
    for (let i = 0; i < cfg.rounds; i++) {
      const d = document.createElement('div');
      d.className = 'round-dot';
      if (i < S.roundResults.length) {
        d.classList.add(S.roundResults[i] ? 'done' : 'failed');
      } else if (i === S.round) {
        d.classList.add('current');
      }
      el.roundDots.appendChild(d);
    }
  }

  function checkBalance() {
    if (!S.playing) return;

    const L = S.leftW.reduce((a, b) => a + b, 0);
    const R = S.rightW.reduce((a, b) => a + b, 0);

    if (L === 0 && R === 0) return;

    const cfg = CFG.levels[S.level];
    S.totalRounds++;
    S.playing = false;
    el.btnCheck.disabled = true;
    stopSpawning();

    if (L === R && L > 0) {
      S.successRounds++;
      let pts = CFG.basePoints * cfg.mult;
      if (S.leftW.length + S.rightW.length >= 4) pts += CFG.perfectBonus;
      pts += S.timeLeft * CFG.timeBonus * cfg.mult;
      S.score += pts;
      S.roundResults.push(true);
      showRoundMsg(true, pts);
    } else {
      const pen = CFG.wrongPenalty * cfg.mult;
      S.score = Math.max(0, S.score - pen);
      S.roundResults.push(false);
      el.beam.classList.add('shake');
      setTimeout(() => el.beam.classList.remove('shake'), 250);
      showRoundMsg(false, -pen);
    }

    updateHUD();
    renderRoundDots();
  }

  function showRoundMsg(ok, pts) {
    S.playing = false;
    el.btnCheck.disabled = true;

    const msg = document.createElement('div');
    msg.className = 'game-msg ' + (ok ? 'success' : 'fail');
    msg.innerHTML = `
      <h2>${ok ? '✓ Баланс!' : '✗ Не равно!'}</h2>
      <p>${ok ? 'Отлично!' : 'Попробуйте ещё!'}</p>
      <div class="pts ${pts >= 0 ? 'plus' : 'minus'}">${pts >= 0 ? '+' : ''}${Math.round(pts)}</div>
    `;
    el.gameArea.appendChild(msg);

    setTimeout(() => {
      msg.remove();
      nextRound();
    }, 1200);
  }

  function nextRound() {
    const cfg = CFG.levels[S.level];
    const wins = S.roundResults.filter(r => r).length;

    if (wins >= cfg.rounds) {
      showLevelComplete();
    } else if (S.roundResults.length >= cfg.rounds + 2) {
      endGame('failed');
    } else {
      S.round++;
      S.playing = true;
      startRound();
    }
  }

  function showLevelComplete() {
    S.playing = false;
    stopSpawning();

    S.leftW = [];
    S.rightW = [];
    S.shelfW = [];
    renderPan(el.panLeft, []);
    renderPan(el.panRight, []);
    renderShelf();
    updateScale();
    el.btnCheck.disabled = true;

    const cfg = CFG.levels[S.level];
    const bonus = 150 * cfg.mult;
    S.score += bonus;

    const ov = document.createElement('div');
    ov.className = 'level-overlay';
    ov.innerHTML = `
      <div class="level-card">
        <h2>🎉 Уровень ${cfg.id} пройден!</h2>
        <div class="stats">
          <div class="stat">
            <div class="stat-value">+${Math.round(bonus)}</div>
            <div class="stat-label">Бонус</div>
          </div>
          <div class="stat">
            <div class="stat-value">${Math.round(S.score)}</div>
            <div class="stat-label">Всего</div>
          </div>
        </div>
        ${S.level < CFG.levels.length - 1
          ? `<p>Следующий: ${CFG.levels[S.level + 1].name}</p>
             <button class="btn-start" id="btn-next">▶ Далее</button>`
          : `<p style="color:var(--lime)">Все уровни пройдены!</p>
             <button class="btn-start" id="btn-finish">🏆 Финиш</button>`}
      </div>
    `;
    el.gameArea.appendChild(ov);

    const btnId = S.level < CFG.levels.length - 1 ? 'btn-next' : 'btn-finish';
    $(btnId).onclick = () => {
      ov.remove();
      if (S.level < CFG.levels.length - 1) {
        S.level++;
        startLevel();
      } else {
        endGame('complete');
      }
    };
  }

  function endGame(reason) {
    S.playing = false;
    el.btnCheck.disabled = true;
    clearInterval(S.timerInt);
    stopSpawning();

    const h = saveGame(reason);

    const titles = {
      complete: '🏆 Победа!',
      time: '⏰ Время вышло!',
      failed: '❌ Игра окончена',
      skipped: '⏭️ Пропущено'
    };

    const msgs = {
      complete: 'Вы прошли все уровни!',
      time: 'Попробуйте ещё!',
      failed: 'Много ошибок',
      skipped: ''
    };

    el.resultsTitle.textContent = titles[reason] || 'Конец';
    el.resultsTitle.className = reason === 'complete' ? 'win' : 'lose';
    el.resultsMsg.textContent = msgs[reason] || '';
    el.finalScore.textContent = Math.round(S.score);
    el.statLevel.textContent = S.level + 1;
    el.statRounds.textContent = S.successRounds;
    el.statAcc.textContent = S.totalRounds > 0 
      ? Math.round((S.successRounds / S.totalRounds) * 100) + '%' 
      : '—';

    renderHistory(el.resultsHistoryList, h, 10);
    showScreen('results-screen');
  }

  // === Инициализация ===

  function updateSplashHistory() {
    const h = getHistory();
    if (h.length > 0) {
      el.splashHistory.style.display = 'block';
      renderHistory(el.splashHistoryList, h, 5);
    } else {
      el.splashHistory.style.display = 'none';
    }
  }

  function init() {
    el.btnStart.onclick = startGame;
    el.btnCheck.onclick = checkBalance;
    el.btnSkip.onclick = () => { if (confirm('Завершить игру?')) endGame('skipped'); };

    el.btnRestart.onclick = () => {
      showScreen('game-screen');
      S.level = 0;
      S.score = 0;
      S.totalRounds = 0;
      S.successRounds = 0;
      startLevel();
    };

    el.btnNewPlayer.onclick = () => {
      showScreen('splash-screen');
      el.nameInput.value = '';
      el.nameInput.focus();
      updateSplashHistory();
    };

    el.btnClearSplash.onclick = () => {
      if (confirm('Очистить историю?')) {
        clearHistory();
        updateSplashHistory();
      }
    };

    el.btnClearResults.onclick = () => {
      if (confirm('Очистить историю?')) {
        clearHistory();
        renderHistory(el.resultsHistoryList, []);
      }
    };

    el.nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') startGame();
    });

    // Горячие клавиши
    document.addEventListener('keydown', e => {
      // Только на экране игры
      const gameScreen = document.getElementById('game-screen');
      if (!gameScreen || !gameScreen.classList.contains('active')) return;
      if (document.activeElement.tagName === 'INPUT') return;

      const key = e.key.toLowerCase();
      
      if (key === 'a' || key === 'ф') {
        e.preventDefault();
        if (selected.el) moveSelectedTo('left');
        else toast('Сначала кликни на гирьку', 'info', 1000);
      } else if (key === 'd' || key === 'в') {
        e.preventDefault();
        if (selected.el) moveSelectedTo('right');
        else toast('Сначала кликни на гирьку', 'info', 1000);
      } else if (key === 'w' || key === 'ц') {
        e.preventDefault();
        if (selected.el) moveSelectedTo('shelf');
        else toast('Сначала кликни на гирьку', 'info', 1000);
      } else if (key === ' ') {
        e.preventDefault();
        if (S.playing && !el.btnCheck.disabled) checkBalance();
      } else if (key === 'escape') {
        e.preventDefault();
        clearSelection();
      }
    });

    // Снять выделение при клике на пустое место (не на гирьку)
    el.gameArea.addEventListener('click', e => {
      if (!e.target.classList.contains('pan-weight') && 
          !e.target.classList.contains('shelf-weight') &&
          !e.target.classList.contains('falling-weight')) {
        clearSelection();
      }
    });

    updateSplashHistory();
    el.nameInput.focus();

    const h = getHistory();
    if (h.length > 0) {
      const best = h.reduce((a, b) => a.score > b.score ? a : b);
      toast(`🏆 Рекорд: ${best.name} — ${best.score}`, 'info', 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
