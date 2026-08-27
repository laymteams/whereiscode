(function () {
  let currentLevel = 0;
  let inputBuffer = '';
  let foundDigits = [];
  let revealedSpots = [];
  let hintsLeft = 5;
  let wrongAttempts = 0;
  const MAX_WRONG = 3;
  let timerSeconds = 0;
  let timerInterval = null;
  let alarmTimeout = null;
  let currentLevelData = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const startScreen = $('#start-screen');
  const gameScreen = $('#game-screen');
  const levelComplete = $('#level-complete');
  const gameOver = $('#game-over');
  const alarmOverlay = $('#alarm-overlay');
  const timeoutOverlay = $('#timeout-overlay');
  const levelDisplay = $('#level-display');
  const foundDisplay = $('#found-display');
  const phoneDisplay = $('#phone-display');
  const phoneFound = $('#phone-found');
  const phoneScreen = $('#phone-screen');
  const scene = $('#scene');
  const wall = $('#wall');
  const doorphone = $('#doorphone');
  const timerDisplay = $('#timer-display');
  const attemptsDisplay = $('#attempts-display');

  $('#btn-start').addEventListener('click', startGame);
  $('#btn-next').addEventListener('click', nextLevel);
  $('#btn-restart').addEventListener('click', restartGame);
  $('#btn-retry').addEventListener('click', retryLevel);
  $('#btn-hint').addEventListener('click', useHint);

  $$('.key').forEach((btn) => {
    btn.addEventListener('click', () => handleKey(btn.dataset.val));
  });

  document.addEventListener('keydown', (e) => {
    if (gameScreen.classList.contains('hidden')) return;
    if (!levelComplete.classList.contains('hidden')) return;
    if (!alarmOverlay.classList.contains('hidden')) return;
    if (!timeoutOverlay.classList.contains('hidden')) return;
    if (e.key >= '0' && e.key <= '9') handleKey(e.key);
    else if (e.key === 'Backspace') handleKey('clear');
    else if (e.key === 'Enter') handleKey('ok');
  });

  /* ══════════════════════════════════════════
     SOUND — Web Audio API
     ══════════════════════════════════════════ */

  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playTone(freq, dur, type, vol) {
    ensureAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  }

  function playNoise(dur, vol) {
    ensureAudio();
    const bufferSize = audioCtx.sampleRate * dur;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol || 0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
  }

  function sfxClick() { playNoise(0.05, 0.06); }
  function sfxReveal() { playTone(600, 0.15, 'sine', 0.12); setTimeout(() => playTone(900, 0.15, 'sine', 0.1), 80); }
  function sfxCorrect() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.12), i * 100));
  }
  function sfxWrong() { playTone(150, 0.35, 'sawtooth', 0.1); }
  function sfxAlarm() { playTone(800, 0.15, 'square', 0.08); setTimeout(() => playTone(600, 0.15, 'square', 0.08), 150); }
  function sfxTick() { playTone(1200, 0.03, 'sine', 0.05); }
  function sfxWin() { [784, 988, 1175, 1319, 1568].forEach((f, i) => setTimeout(() => playTone(f, 0.25, 'sine', 0.1), i * 80)); }

  /* ══════════════════════════════════════════
     GAME FLOW
     ══════════════════════════════════════════ */

  function startGame() {
    ensureAudio();
    currentLevel = 0;
    hintsLeft = 5;
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    loadLevel(currentLevel);
  }

  function restartGame() {
    gameOver.classList.add('hidden');
    currentLevel = 0;
    hintsLeft = 5;
    loadLevel(currentLevel);
  }

  function retryLevel() {
    timeoutOverlay.classList.add('hidden');
    loadLevel(currentLevel);
  }

  function nextLevel() {
    levelComplete.classList.add('hidden');
    currentLevel++;
    if (currentLevel >= 100) {
      gameOver.classList.remove('hidden');
      sfxWin();
      return;
    }
    loadLevel(currentLevel);
  }

  /* ══════════════════════════════════════════
     LEVEL LOADING
     ══════════════════════════════════════════ */

  function loadLevel(idx) {
    const lvl = LEVELS[idx];
    currentLevelData = lvl;
    inputBuffer = '';
    foundDigits = [];
    revealedSpots = [];
    wrongAttempts = 0;
    phoneDisplay.textContent = '____';
    levelDisplay.textContent = 'Уровень ' + lvl.level + ' / 100';
    updateFoundDisplay(lvl);
    phoneFound.textContent = '';
    doorphone.classList.remove('locked');
    attemptsDisplay.innerHTML = '❤'.repeat(MAX_WRONG);

    const grad = `linear-gradient(135deg, ${lvl.wallColor[0]}, ${lvl.wallColor[1]})`;
    wall.style.background = grad;

    scene.innerHTML = '';

    renderCracks(lvl);
    renderStains(lvl);
    renderPattern(lvl);
    renderObjects(lvl);
    renderDigitSpots(lvl);
    renderAtmosphere();
    startTimer(lvl);

    $('#btn-hint').style.opacity = '1';
    $('#btn-hint').style.pointerEvents = 'auto';
  }

  /* ══════════════════════════════════════════
     ATMOSPHERE
     ══════════════════════════════════════════ */

  function renderAtmosphere() {
    const flicker = document.createElement('div');
    flicker.className = 'wall-flicker';
    scene.appendChild(flicker);

    const light = document.createElement('div');
    light.className = 'light-cone';
    scene.appendChild(light);

    const vignette = document.createElement('div');
    vignette.className = 'vignette';
    scene.appendChild(vignette);

    for (let i = 0; i < 7; i++) {
      const d = document.createElement('div');
      d.className = 'dust';
      const dx = (Math.random() - 0.5) * 80;
      const dy = -(20 + Math.random() * 80);
      const dur = 6 + Math.random() * 8;
      const x = 10 + Math.random() * 80;
      const y = 10 + Math.random() * 70;
      d.style.cssText = `
        left: ${x}%;
        top: ${y}%;
        --dust-dx: ${dx}px;
        --dust-dy: ${dy}px;
        --dust-dur: ${dur}s;
        animation-delay: ${Math.random() * dur}s;
      `;
      scene.appendChild(d);
    }
  }

  /* ══════════════════════════════════════════
     TIMER
     ══════════════════════════════════════════ */

  function startTimer(lvl) {
    clearInterval(timerInterval);
    timerSeconds = Math.max(15, 60 - Math.floor((lvl.level - 1) / 3));
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      if (!alarmOverlay.classList.contains('hidden')) return;
      timerSeconds--;
      updateTimerDisplay();
      if (timerSeconds <= 10 && timerSeconds > 0) {
        timerDisplay.classList.add('urgent');
        sfxTick();
      }
      if (timerSeconds <= 0) {
        clearInterval(timerInterval);
        timerDisplay.classList.remove('urgent');
        timeUp();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    timerDisplay.textContent = '⏱ ' + timerSeconds;
    if (timerSeconds <= 10) timerDisplay.classList.add('urgent');
    else timerDisplay.classList.remove('urgent');
  }

  function timeUp() {
    timeoutOverlay.classList.remove('hidden');
    sfxWrong();
  }

  /* ══════════════════════════════════════════
     WRONG ATTEMPTS / ALARM
     ══════════════════════════════════════════ */

  function updateAttemptsDisplay() {
    let hearts = '';
    for (let i = 0; i < MAX_WRONG; i++) {
      hearts += i < (MAX_WRONG - wrongAttempts)
        ? '<span class="attempt-alive">❤</span>'
        : '<span class="attempt-dead">❤</span>';
    }
    attemptsDisplay.innerHTML = hearts;
  }

  function triggerAlarm() {
    clearInterval(timerInterval);
    alarmOverlay.classList.remove('hidden');
    doorphone.classList.add('locked');

    let countdown = 5;
    $('#alarm-countdown').textContent = countdown;
    sfxAlarm();

    const tick = () => {
      countdown--;
      $('#alarm-countdown').textContent = countdown;
      if (countdown > 0) {
        sfxAlarm();
        alarmTimeout = setTimeout(tick, 1000);
      } else {
        alarmOverlay.classList.add('hidden');
        doorphone.classList.remove('locked');
        wrongAttempts = 0;
        updateAttemptsDisplay();
        startTimer(currentLevelData);
      }
    };
    alarmTimeout = setTimeout(tick, 1000);
  }

  /* ══════════════════════════════════════════
     RENDERING — WALL PATTERNS
     ══════════════════════════════════════════ */

  function renderPattern(lvl) {
    const canvas = document.createElement('canvas');
    canvas.width = wall.clientWidth || 800;
    canvas.height = wall.clientHeight || 600;
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0.06;z-index:1;';
    const ctx = canvas.getContext('2d');

    if (lvl.wallPattern === 'bricks') {
      const bw = 40, bh = 18;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.5;
      for (let row = 0; row < canvas.height / bh + 1; row++) {
        const offset = row % 2 === 0 ? 0 : bw / 2;
        for (let col = -1; col < canvas.width / bw + 1; col++) {
          ctx.strokeRect(col * bw + offset, row * bh, bw, bh);
        }
      }
    } else if (lvl.wallPattern === 'plaster') {
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.3})`;
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 8 + 1, Math.random() * 3 + 1);
      }
    } else if (lvl.wallPattern === 'wood') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.3;
      for (let y = 0; y < canvas.height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 20, canvas.height * 0.3, x - 20, canvas.height * 0.6, x + 10, canvas.height);
        ctx.stroke();
      }
    } else if (lvl.wallPattern === 'tiles') {
      const ts = 35;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < canvas.width; x += ts) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
      for (let y = 0; y < canvas.height; y += ts) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    } else if (lvl.wallPattern === 'concrete') {
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`;
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 4 + 1, Math.random() * 2 + 1);
      }
    } else if (lvl.wallPattern === 'wallpaper') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.2;
      const sp = 25;
      for (let x = 0; x < canvas.width; x += sp) {
        for (let y = 0; y < canvas.height; y += sp) {
          ctx.beginPath();
          ctx.arc(x + sp / 2, y + sp / 2, 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    scene.appendChild(canvas);
  }

  function renderCracks(lvl) {
    lvl.cracks.forEach((cr) => {
      const el = document.createElement('div');
      el.className = 'wall-crack';
      el.style.cssText = `
        left: ${cr.x}%; top: ${cr.y}%; width: ${cr.w}px; height: 2px;
        background: linear-gradient(90deg, transparent, #000, transparent);
        transform: rotate(${cr.rotation}deg); z-index: 1;
      `;
      scene.appendChild(el);
    });
  }

  function renderStains(lvl) {
    lvl.stains.forEach((st) => {
      const el = document.createElement('div');
      el.className = 'wall-stain';
      el.style.cssText = `
        left: ${st.x}%; top: ${st.y}%; width: ${st.size}%; height: ${st.size}%;
        background: radial-gradient(ellipse, rgba(0,0,0,0.5), transparent); z-index: 1;
      `;
      scene.appendChild(el);
    });
  }

  /* ══════════════════════════════════════════
     RENDERING — CSS OBJECTS
     ══════════════════════════════════════════ */

  const OBJ_CSS_CLASS = {
    picture: 'obj-picture', clock: 'obj-clock', poster: 'obj-poster',
    pipe: 'obj-pipe', switch: 'obj-switch', meter: 'obj-meter',
    outlet: 'obj-outlet', sticker: 'obj-sticker', graffiti: 'obj-graffiti',
    mail: 'obj-mail', sensor: 'obj-camera', bell: 'obj-bell',
    camera: 'obj-camera', sign: 'obj-sign', scratch: 'obj-scratch',
  };

  function renderObjects(lvl) {
    lvl.objects.forEach((obj) => {
      const el = document.createElement('div');
      const cssClass = OBJ_CSS_CLASS[obj.type] || 'obj-sign';
      el.className = 'wall-object ' + cssClass;

      let extraStyles = '';
      if (obj.type === 'clock') {
        const r1 = Math.floor(Math.random() * 360);
        const r2 = Math.floor(Math.random() * 360);
        extraStyles = `--clock-rot: ${r1}deg; --clock-rot2: ${r2}deg;`;
      }
      if (obj.type === 'scratch') {
        extraStyles = `--scratch-rot: ${obj.rotation}deg;`;
      }
      if (obj.type === 'sign') {
        el.textContent = 'КВ';
      }
      if (obj.type === 'graffiti') {
        el.innerHTML = '<svg viewBox="0 0 60 40"><path d="M5,20 Q15,5 25,20 T45,20" stroke="rgba(200,200,200,0.25)" fill="none" stroke-width="1.5"/></svg>';
      }

      el.style.cssText = `
        left: ${obj.x}%;
        top: ${obj.y}%;
        width: ${obj.w}px;
        height: ${obj.h}px;
        transform: rotate(${obj.rotation}deg);
        --base-rot: ${obj.rotation}deg;
        ${extraStyles}
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (obj.hidesDigit >= 0) {
          revealDigit(obj.hidesDigit, lvl);
        } else {
          sfxClick();
          el.classList.remove('empty-shake');
          void el.offsetWidth;
          el.classList.add('empty-shake');
          setTimeout(() => el.classList.remove('empty-shake'), 400);
        }
      });

      scene.appendChild(el);
    });
  }

  /* ══════════════════════════════════════════
     RENDERING — DIGIT SPOTS
     ══════════════════════════════════════════ */

  function renderDigitSpots(lvl) {
    lvl.digitPositions.forEach((dp, idx) => {
      const spot = document.createElement('div');
      spot.className = 'digit-spot';
      spot.style.cssText = `
        left: ${dp.x}%; top: ${dp.y}%;
        width: 36px; height: 36px;
        transform: translate(-50%, -50%);
      `;
      spot.dataset.index = idx;

      const digitEl = document.createElement('div');
      digitEl.className = 'hidden-digit';
      digitEl.textContent = dp.digit;
      spot.appendChild(digitEl);

      spot.addEventListener('click', (e) => {
        e.stopPropagation();
        revealDigit(idx, lvl);
      });

      scene.appendChild(spot);
    });
  }

  function revealDigit(idx, lvl) {
    if (revealedSpots.includes(idx)) return;
    revealedSpots.push(idx);
    foundDigits.push(lvl.digitPositions[idx].digit);

    const spots = scene.querySelectorAll('.digit-spot');
    const digitEl = spots[idx].querySelector('.hidden-digit');
    digitEl.classList.add('revealed');
    spots[idx].classList.add('found');
    sfxReveal();

    updateFoundDisplay(lvl);
  }

  function updateFoundDisplay(lvl) {
    foundDisplay.textContent = 'Найдено: ' + foundDigits.length + ' / ' + lvl.codeLen;
    phoneFound.textContent = foundDigits.join(' ');
  }

  /* ══════════════════════════════════════════
     KEYPAD / CODE CHECK
     ══════════════════════════════════════════ */

  function handleKey(val) {
    if (doorphone.classList.contains('locked')) return;
    if (!alarmOverlay.classList.contains('hidden')) return;
    if (!timeoutOverlay.classList.contains('hidden')) return;

    if (val === 'clear') {
      inputBuffer = inputBuffer.slice(0, -1);
    } else if (val === 'ok') {
      checkCode();
      return;
    } else {
      if (inputBuffer.length < 10) inputBuffer += val;
    }
    phoneDisplay.textContent = inputBuffer || '____';
  }

  function checkCode() {
    const lvl = LEVELS[currentLevel];
    if (inputBuffer === lvl.code) {
      clearInterval(timerInterval);
      timerDisplay.classList.remove('urgent');
      sfxCorrect();
      phoneScreen.classList.add('flash-correct');
      setTimeout(() => {
        phoneScreen.classList.remove('flash-correct');
        levelComplete.classList.remove('hidden');
      }, 600);
    } else {
      wrongAttempts++;
      updateAttemptsDisplay();
      sfxWrong();
      phoneScreen.classList.add('flash-wrong');
      wall.classList.add('screen-shake');
      setTimeout(() => {
        phoneScreen.classList.remove('flash-wrong');
        wall.classList.remove('screen-shake');
        inputBuffer = '';
        phoneDisplay.textContent = '____';
      }, 500);

      if (wrongAttempts >= MAX_WRONG) {
        setTimeout(() => triggerAlarm(), 600);
      }
    }
  }

  /* ══════════════════════════════════════════
     HINTS
     ══════════════════════════════════════════ */

  function useHint() {
    if (hintsLeft <= 0) return;
    const lvl = LEVELS[currentLevel];
    const unrevealed = lvl.digitPositions
      .map((dp, idx) => ({ dp, idx }))
      .filter((item) => !revealedSpots.includes(item.idx));

    if (unrevealed.length === 0) return;

    hintsLeft--;
    if (hintsLeft <= 0) {
      $('#btn-hint').style.opacity = '0.3';
      $('#btn-hint').style.pointerEvents = 'none';
    }

    const target = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    const targetIdx = target.idx;

    let hintTarget = null;
    for (const obj of lvl.objects) {
      if (obj.hidesDigit === targetIdx) {
        const objs = scene.querySelectorAll('.wall-object');
        hintTarget = objs[lvl.objects.indexOf(obj)];
        break;
      }
    }

    if (!hintTarget) {
      const spots = scene.querySelectorAll('.digit-spot');
      hintTarget = spots[targetIdx];
    }

    hintTarget.classList.add('hint-pulse');
    setTimeout(() => hintTarget.classList.remove('hint-pulse'), 3000);
  }
})();
