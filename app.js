// ==========================================================================
// ПРИГЛАШЕНИЕ НА СВИДАНИЕ — ЛОГИКА И ИНТЕРАКТИВНОСТЬ
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

  // ------------------------------------------------------------------------
  // 1. CONFIG & STATE
  // ------------------------------------------------------------------------
  const state = {
    currentScreen: 'screen-pin',
    pinInput: '',
    pinTarget: (typeof CONFIG !== 'undefined' && CONFIG.pinCode) ? CONFIG.pinCode : '3110',
    kissCount: 0,
    isKissed: false,
    selectedDate: '15.06.2026',
    selectedTime: '19:30',
    botToken: (typeof CONFIG !== 'undefined' && CONFIG.telegramBotToken) ? CONFIG.telegramBotToken : (localStorage.getItem('tg_bot_token') || ''),
    chatId: (typeof CONFIG !== 'undefined' && CONFIG.telegramChatId) ? CONFIG.telegramChatId : (localStorage.getItem('tg_chat_id') || ''),
    username: (typeof CONFIG !== 'undefined' && CONFIG.telegramUsername) ? CONFIG.telegramUsername : 'vor1ngsbiboi'
  };

  // Preview bar text updates for each screen to match the reference screenshots
  const previewTexts = {
    'screen-pin': 'Так получатель увидит открытие — проверьте в превью',
    'screen-question': 'Нажмите «Да» / «Нет» в превью — так увидит получатель',
    'screen-reaction': 'Так выглядит реакция после согласия',
    'screen-date': 'Выбор удобной даты и времени свидания',
    'screen-success': 'Свидание успешно назначено! 💖'
  };

  const previewBarText = document.getElementById('preview-bar-text');

  function setPreviewText(screenId) {
    if (previewBarText && previewTexts[screenId]) {
      previewBarText.textContent = previewTexts[screenId];
    }
  }

  // ------------------------------------------------------------------------
  // 2. AUDIO SYNTHESIZER (Web Audio API)
  // ------------------------------------------------------------------------
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  const Sound = {
    // Soft click on keypad
    keyClick() {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    },

    // Success chime chord
    successChime() {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const startTime = ctx.currentTime + idx * 0.07;
        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.5);
      });
    },

    // PIN error buzz
    errorBuzz() {
      const ctx = getAudioContext();
      if (!ctx) return;
      [0, 0.12].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime + offset);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.08);
      });
    },

    // Kiss "Mwah" sound
    kiss() {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    },

    // Celebratory fanfare
    celebrate() {
      const ctx = getAudioContext();
      if (!ctx) return;
      const chord = [392.00, 523.25, 659.25, 783.99, 1046.50]; // G4, C5, E5, G5, C6
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + idx * 0.06;
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.8);
      });
    }
  };

  // ------------------------------------------------------------------------
  // 3. SCREEN SWITCHING
  // ------------------------------------------------------------------------
  function goToScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));

    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      state.currentScreen = screenId;
      setPreviewText(screenId);
      renderAllScallopBorders();
    }
  }

  // ------------------------------------------------------------------------
  // 4. SCALLOPED BORDER SVG GENERATOR
  // ------------------------------------------------------------------------
  // Generates exact scalloped wavy contours for the white cards
  function generateScallopSVGPath(width, height, nx = 4, ny = 6, depth = 10) {
    const sx = width / nx;
    const sy = height / ny;
    let d = `M 0,0 `;

    // Top edge
    for (let i = 0; i < nx; i++) {
      const x0 = i * sx;
      const x1 = (i + 1) * sx;
      const cx1 = x0 + sx * 0.28;
      const cy1 = -depth * 1.25;
      const cx2 = x0 + sx * 0.72;
      const cy2 = -depth * 1.25;
      d += `C ${cx1.toFixed(2)},${cy1.toFixed(2)} ${cx2.toFixed(2)},${cy2.toFixed(2)} ${x1.toFixed(2)},0 `;
    }

    // Right edge
    for (let i = 0; i < ny; i++) {
      const y0 = i * sy;
      const y1 = (i + 1) * sy;
      const cx1 = width + depth * 1.25;
      const cy1 = y0 + sy * 0.28;
      const cx2 = width + depth * 1.25;
      const cy2 = y0 + sy * 0.72;
      d += `C ${cx1.toFixed(2)},${cy1.toFixed(2)} ${cx2.toFixed(2)},${cy2.toFixed(2)} ${width.toFixed(2)},${y1.toFixed(2)} `;
    }

    // Bottom edge
    for (let i = 0; i < nx; i++) {
      const x0 = width - i * sx;
      const x1 = width - (i + 1) * sx;
      const cx1 = x0 - sx * 0.28;
      const cy1 = height + depth * 1.25;
      const cx2 = x0 - sx * 0.72;
      const cy2 = height + depth * 1.25;
      d += `C ${cx1.toFixed(2)},${cy1.toFixed(2)} ${cx2.toFixed(2)},${cy2.toFixed(2)} ${x1.toFixed(2)},${height.toFixed(2)} `;
    }

    // Left edge
    for (let i = 0; i < ny; i++) {
      const y0 = height - i * sy;
      const y1 = height - (i + 1) * sy;
      const cx1 = -depth * 1.25;
      const cy1 = y0 - sy * 0.28;
      const cx2 = -depth * 1.25;
      const cy2 = y0 - sy * 0.72;
      d += `C ${cx1.toFixed(2)},${cy1.toFixed(2)} ${cx2.toFixed(2)},${cy2.toFixed(2)} 0,${y1.toFixed(2)} `;
    }

    d += 'Z';
    return d;
  }

  function renderAllScallopBorders() {
    const svgs = document.querySelectorAll('.scallop-border-svg');
    svgs.forEach(svg => {
      const card = svg.closest('.scalloped-card');
      if (!card) return;
      const w = card.offsetWidth || 345;
      const h = card.offsetHeight || 530;
      const depth = 9;

      svg.setAttribute('viewBox', `${-depth - 2} ${-depth - 2} ${w + (depth + 2) * 2} ${h + (depth + 2) * 2}`);
      const pathD = generateScallopSVGPath(w, h, 4, 6, depth);

      svg.innerHTML = `
        <defs>
          <filter id="card-inner-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="rgba(240, 160, 185, 0.3)" />
          </filter>
        </defs>
        <path d="${pathD}" fill="#ffffff" filter="url(#card-inner-shadow)" />
      `;
    });
  }

  // Render on load and on resize
  setTimeout(renderAllScallopBorders, 100);
  window.addEventListener('resize', renderAllScallopBorders);

  // ------------------------------------------------------------------------
  // 5. SCREEN 1: PIN CODE LOGIC
  // ------------------------------------------------------------------------
  const pinSlots = document.querySelectorAll('.pin-slot');
  const keypad = document.getElementById('keypad');
  const pinDotsContainer = document.getElementById('pin-dots');

  function updatePinDisplay() {
    pinSlots.forEach((slot, index) => {
      if (index < state.pinInput.length) {
        slot.classList.add('filled');
      } else {
        slot.classList.remove('filled');
      }
    });
  }

  function handleKeyInput(key) {
    if (state.currentScreen !== 'screen-pin') return;

    if (key === 'back') {
      if (state.pinInput.length > 0) {
        state.pinInput = state.pinInput.slice(0, -1);
        Sound.keyClick();
        updatePinDisplay();
      }
      return;
    }

    if (state.pinInput.length < 4 && /^[0-9]$/.test(key)) {
      state.pinInput += key;
      Sound.keyClick();
      updatePinDisplay();

      // Check PIN when 4 digits are entered
      if (state.pinInput.length === 4) {
        validatePin();
      }
    }
  }

  function validatePin() {
    if (state.pinInput === state.pinTarget) {
      // Correct PIN!
      Sound.successChime();
      setTimeout(() => {
        goToScreen('screen-question');
      }, 350);
    } else {
      // Wrong PIN: shake & reset
      Sound.errorBuzz();
      if (pinDotsContainer) {
        pinDotsContainer.classList.add('shake');
        setTimeout(() => {
          pinDotsContainer.classList.remove('shake');
          state.pinInput = '';
          updatePinDisplay();
        }, 500);
      }
    }
  }

  // Keypad click handlers
  if (keypad) {
    keypad.addEventListener('click', (e) => {
      const btn = e.target.closest('.key-btn');
      if (!btn) return;
      const key = btn.dataset.key;
      handleKeyInput(key);
    });
  }

  // Physical keyboard support
  window.addEventListener('keydown', (e) => {
    if (state.currentScreen !== 'screen-pin') return;
    if (e.key >= '0' && e.key <= '9') {
      handleKeyInput(e.key);
    } else if (e.key === 'Backspace') {
      handleKeyInput('back');
    }
  });

  // ------------------------------------------------------------------------
  // 6. SCREEN 2: QUESTION SCREEN («ДА» / «НЕТ» + ПОЦЕЛУЙ)
  // ------------------------------------------------------------------------
  const btnYes = document.getElementById('btn-yes');
  const btnNo = document.getElementById('btn-no');
  const noBtnZone = document.getElementById('no-btn-zone');
  const kissTarget = document.getElementById('kiss-target');

  // Trigger Kiss effect when trying to press "Нет"
  function triggerNoToKiss(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    state.kissCount++;
    state.isKissed = true;
    noBtnZone.classList.add('kissed');
    Sound.kiss();

    // Spawn floating kiss marks & heart particles
    const rect = noBtnZone.getBoundingClientRect();
    const cx = e ? (e.clientX || rect.left + rect.width / 2) : (rect.left + rect.width / 2);
    const cy = e ? (e.clientY || rect.top + rect.height / 2) : (rect.top + rect.height / 2);

    spawnKissParticle(cx, cy);

    // Playful toasts
    const messages = [
      'Поцелуйчик! 💋',
      'Нельзя сказать "нет"! 🥰',
      'Только ДА! 💕',
      'Чмок в щёчку! 😘',
      'Даже не думай! 💖'
    ];
    const msg = messages[(state.kissCount - 1) % messages.length];
    showToast(msg, cx, cy - 20);

    // Make "Да" button gently pulse to draw attention
    btnYes.style.transform = 'scale(1.06)';
    setTimeout(() => {
      btnYes.style.transform = '';
    }, 200);
  }

  if (btnNo) {
    btnNo.addEventListener('click', triggerNoToKiss);
    btnNo.addEventListener('touchstart', triggerNoToKiss, { passive: false });
  }

  // If she clicks on the kiss mark again, give more kisses!
  if (kissTarget) {
    kissTarget.addEventListener('click', (e) => {
      state.kissCount++;
      Sound.kiss();
      spawnKissParticle(e.clientX, e.clientY);
      const messages = ['Ещё поцелуйчик! 💋', 'Мур! 🥰', 'Чмок! 💕', 'Жми ДА скорее! ✨'];
      showToast(messages[state.kissCount % messages.length], e.clientX, e.clientY - 20);
    });
  }

  // When "Да" is clicked: Shake and Explosion («Тряска и взрыв»)
  if (btnYes) {
    btnYes.addEventListener('click', () => {
      Sound.celebrate();
      btnYes.classList.add('btn-rumble-shake');

      // Trigger Confetti Explosion
      const rect = btnYes.getBoundingClientRect();
      const originX = (rect.left + rect.width / 2) / window.innerWidth;
      const originY = (rect.top + rect.height / 2) / window.innerHeight;
      launchConfettiBurst(originX, originY);

      setTimeout(() => {
        btnYes.classList.remove('btn-rumble-shake');
        goToScreen('screen-reaction');
      }, 700);
    });
  }

  // ------------------------------------------------------------------------
  // 7. SCREEN 3: REACTION SCREEN («Да Да дА»)
  // ------------------------------------------------------------------------
  const btnReactionYes = document.getElementById('btn-reaction-yes');
  if (btnReactionYes) {
    btnReactionYes.addEventListener('click', () => {
      Sound.keyClick();
      goToScreen('screen-date');
    });
  }

  // ------------------------------------------------------------------------
  // 8. SCREEN 4: DATE & TIME SELECTION + TELEGRAM SUBMISSION
  // ------------------------------------------------------------------------
  const dateForm = document.getElementById('date-form');
  const inputDate = document.getElementById('input-date');
  const inputTime = document.getElementById('input-time');
  const summaryDateVal = document.getElementById('summary-date-val');
  const summaryTimeVal = document.getElementById('summary-time-val');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const btnTgDirect = document.getElementById('btn-tg-direct');

  if (dateForm) {
    dateForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      state.selectedDate = inputDate.value.trim() || '15.06.2026';
      state.selectedTime = inputTime.value.trim() || '19:30';

      if (summaryDateVal) summaryDateVal.textContent = state.selectedDate;
      if (summaryTimeVal) summaryTimeVal.textContent = state.selectedTime;

      // Celebrate!
      Sound.celebrate();
      launchConfettiBurst(0.5, 0.5);

      // Move to Screen 5
      goToScreen('screen-success');

      // Prepare Telegram Direct Link
      const tgText = `Привет! Я согласна на свидание! 🥰✨\n\n📅 Дата: ${state.selectedDate}\n⏰ Время: ${state.selectedTime}`;
      const directTgUrl = `https://t.me/${state.username}?text=${encodeURIComponent(tgText)}`;
      if (btnTgDirect) {
        btnTgDirect.href = directTgUrl;
      }

      // Send to Telegram via Bot API if token is configured
      await sendTelegramNotification();
    });
  }

  // ------------------------------------------------------------------------
  // 9. TELEGRAM BOT API DISPATCHER
  // ------------------------------------------------------------------------
  async function sendTelegramNotification() {
    const token = state.botToken || (typeof CONFIG !== 'undefined' ? CONFIG.telegramBotToken : '');
    const chat = state.chatId || (typeof CONFIG !== 'undefined' ? CONFIG.telegramChatId : '');

    const messageHtml = 
      `🎉 <b>Ура! Новое свидание подтверждено!</b>\n\n` +
      `💖 <b>Она сказала ДА!</b>\n` +
      `📅 <b>Дата:</b> ${state.selectedDate}\n` +
      `⏰ <b>Время:</b> ${state.selectedTime}\n` +
      `💋 <b>Попыток нажать «Нет»:</b> ${state.kissCount}\n\n` +
      `💌 <i>Приглашение на свидание</i>`;

    // If Bot Token & Chat ID are provided:
    if (token && chat) {
      if (statusText) statusText.textContent = 'Отправка в Telegram...';
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat,
            text: messageHtml,
            parse_mode: 'HTML'
          })
        });

        const data = await response.json();
        if (data.ok) {
          if (statusIndicator) {
            statusIndicator.className = 'status-indicator success';
            statusIndicator.innerHTML = '<span>✅ Ответ успешно доставлен тебе в Telegram!</span>';
          }
          return;
        } else {
          console.warn('Telegram Bot API Error:', data.description);
        }
      } catch (err) {
        console.error('Network Error while sending to Telegram:', err);
      }
    }

    // Fallback if bot is not configured:
    if (statusIndicator) {
      statusIndicator.className = 'status-indicator';
      statusIndicator.innerHTML = `<span>💌 Нажми кнопку ниже, чтобы отправить ответ в чат @${state.username}!</span>`;
    }

    // Automatically trigger Telegram chat tab
    try {
      const tgText = `Привет! Я согласна на свидание! 🥰✨\n\n📅 Дата: ${state.selectedDate}\n⏰ Время: ${state.selectedTime}`;
      const url = `https://t.me/${state.username}?text=${encodeURIComponent(tgText)}`;
      window.open(url, '_blank');
    } catch (_) {}
  }

  // ------------------------------------------------------------------------
  // 10. VISUAL EFFECTS: PARTICLES, TOASTS & CONFETTI
  // ------------------------------------------------------------------------
  const overlay = document.getElementById('particles-overlay');

  function spawnKissParticle(x, y) {
    if (!overlay) return;
    const count = 3;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'floating-kiss-particle';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      const dx = (Math.random() - 0.5) * 120;
      const rot = (Math.random() - 0.5) * 40;
      el.style.setProperty('--dx', `${dx}px`);
      el.style.setProperty('--rot', `${rot}deg`);

      const icons = ['💋', '💕', '❤️', '😘'];
      el.textContent = icons[Math.floor(Math.random() * icons.length)];
      el.style.fontSize = `${20 + Math.random() * 16}px`;

      overlay.appendChild(el);
      setTimeout(() => el.remove(), 1600);
    }
  }

  function showToast(text, x, y) {
    if (!overlay) return;
    const toast = document.createElement('div');
    toast.className = 'floating-toast-msg';
    toast.textContent = text;
    toast.style.left = `${x}px`;
    toast.style.top = `${y}px`;
    overlay.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }

  // Confetti Engine
  const canvas = document.getElementById('confetti-canvas');
  let ctx = null;
  let particles = [];
  let animId = null;

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function launchConfettiBurst(originX, originY) {
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    const startX = originX * canvas.width;
    const startY = originY * canvas.height;
    const colors = ['#f6528b', '#ff70a0', '#ffb6c1', '#ffd166', '#06d6a0', '#118ab2', '#ff4d6d'];

    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 9;
      particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 5 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        alpha: 1,
        isHeart: Math.random() > 0.65
      });
    }

    if (!animId) {
      animLoop();
    }
  }

  function animLoop() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // gravity
      p.vx *= 0.98;
      p.rotation += p.rotSpeed;
      p.alpha -= 0.012;

      if (p.alpha <= 0 || p.y > canvas.height + 50) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.isHeart) {
        ctx.fillStyle = p.color;
        ctx.font = `${p.size * 2}px sans-serif`;
        ctx.fillText('❤️', -p.size, p.size);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
      }
      ctx.restore();
    }

    if (particles.length > 0) {
      animId = requestAnimationFrame(animLoop);
    } else {
      animId = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

});
