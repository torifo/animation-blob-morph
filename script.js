/* ────────────────────────────────────────────
   B·Lo · Blob Morph
   - SVG path を制御点 N 個で構築、3 周波ノイズ + global breath + カーソルで変形
   - 2 レイヤー（outer / inner）が独立位相で morph
   - setState() で挙動を「目標値」へ更新、tick で ease 補間
   - beat() で外向きの一発膨張
   - SYNCH chat controller：4 ターンを 6s 周期で循環、状態に応じて latency/tk/s を更新
   ──────────────────────────────────────────── */

(() => {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ════════════ BlobMorph ════════════
  function initBlob(root) {
    const points       = clampInt(root.dataset.blobPoints, 12, 4, 32);
    const radius       = clampFloat(root.dataset.blobRadius, 120, 50, 200);
    const amp          = clampFloat(root.dataset.blobAmp, 22, 0, 100);
    const cursorRadius = clampFloat(root.dataset.blobCursor, 38, 0, 200);

    const paths = Array.from(root.querySelectorAll('[data-blob-path]'));
    if (!paths.length) return;
    const host = root.querySelector('[data-blob-host]');

    const layers = paths.map((path, i) => ({
      path,
      role: path.dataset.blobRole || 'main',
      seedOffset: 7.13 + i * 41.9,                      // 各層の独立シード
      breathPhase: Math.random() * Math.PI * 2,          // 各層の呼吸位相
    }));

    // 「目標値」と「現在値」を分けて、tick で ease 補間
    const target  = { amp: 1.0, speed: 1.0, expand: 1.0 };
    const current = { amp: 1.0, speed: 1.0, expand: 1.0 };
    const EASE_K  = 4.5;          // 大きいほどスナップ早い（exponential approach）

    const cur = {
      cursorActive: false,
      cursorX: 0,
      cursorY: 0,
      cursorAlpha: 0,             // pointermove で 1 へ、leave で 0 へ ease
      beatStrength: 0,
      mode: 'listening',
    };

    if (host) {
      host.addEventListener('pointermove', (e) => {
        const rect = host.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const pxToVb = 400 / Math.min(rect.width, rect.height);
        cur.cursorX = (e.clientX - cx) * pxToVb;
        cur.cursorY = (e.clientY - cy) * pxToVb;
        cur.cursorActive = true;
      });
      host.addEventListener('pointerleave', () => { cur.cursorActive = false; });
    }

    // 3 周波スムースノイズ（slow / mid / fast の合成）— "呼吸 + テクスチャー"
    function pnoise(i, t, seed) {
      const x = i * 0.62 + seed;
      const slow = Math.sin(x * 0.92 + t * 0.55 + seed * 0.13);
      const mid  = Math.sin(x * 1.71 + t * 1.27 + 1.3 + seed * 0.21);
      const fast = Math.sin(x * 2.43 + t * 2.55 + 0.7 + seed * 0.08);
      return slow * 0.56 + mid * 0.33 + fast * 0.11;
    }

    let lastT = performance.now();
    function tick(now) {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const t = now / 1000;

      // 状態の ease 補間（amp/speed/expand → target へ）
      const a = 1 - Math.exp(-EASE_K * dt);
      current.amp    += (target.amp    - current.amp)    * a;
      current.speed  += (target.speed  - current.speed)  * a;
      current.expand += (target.expand - current.expand) * a;

      // cursorAlpha も滑らかに（ホスト出入りで一瞬で消えないように）
      const targetAlpha = cur.cursorActive ? 1 : 0;
      cur.cursorAlpha += (targetAlpha - cur.cursorAlpha) * (1 - Math.exp(-6 * dt));

      // beat decay（~330ms で 0 に）
      if (cur.beatStrength > 0) {
        cur.beatStrength = Math.max(0, cur.beatStrength - dt * 3);
      }
      const beat = cur.beatStrength;

      layers.forEach((layer) => {
        const seedOff = layer.seedOffset;
        const isOuter = layer.role === 'outer';
        const layerRadius = isOuter ? radius : radius * 0.74;
        const layerAmp = amp * (isOuter ? 1.0 : 0.82) * current.amp;
        const layerSpeed = current.speed * (isOuter ? 0.72 : 1.18);

        // global breath：全点同期の ±2.5% 緩やかな膨張収縮（~14s 周期）
        const breath = Math.sin(t * 0.45 + layer.breathPhase) * 0.025;
        const baseR = layerRadius * current.expand * (1 + breath) + beat * 18;

        const pts = new Array(points);
        for (let i = 0; i < points; i++) {
          const theta = (i / points) * Math.PI * 2;

          const seedRad = pnoise(i, t * layerSpeed, seedOff);
          const seedAng = pnoise(i, t * layerSpeed * 0.78, seedOff + 17.7);

          const dR = seedRad * layerAmp;
          const dA = seedAng * 0.08;

          let r = baseR + dR;
          const ang = theta + dA;

          let x = r * Math.cos(ang);
          let y = r * Math.sin(ang);

          // カーソル近接（実距離・距離²で滑らかな引き寄せ）
          if (cur.cursorAlpha > 0.01) {
            const dx = cur.cursorX - x;
            const dy = cur.cursorY - y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < cursorRadius) {
              const k = 1 - dist / cursorRadius;
              const strength = cursorRadius * 0.42 * k * k * (isOuter ? 1.0 : 0.62) * cur.cursorAlpha;
              x += (dx / dist) * strength;
              y += (dy / dist) * strength;
            }
          }

          pts[i] = [x, y];
        }

        layer.path.setAttribute('d', catmullRomClosedPath(pts));
      });

      raf = requestAnimationFrame(tick);
    }
    let raf = requestAnimationFrame(tick);

    // catmull-rom → cubic bezier、closed loop
    function catmullRomClosedPath(pts) {
      const n = pts.length;
      const cmd = [`M${fix(pts[0][0])},${fix(pts[0][1])}`];
      for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];
        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        cmd.push(`C${fix(cp1x)},${fix(cp1y)} ${fix(cp2x)},${fix(cp2y)} ${fix(p2[0])},${fix(p2[1])}`);
      }
      cmd.push('Z');
      return cmd.join(' ');
    }
    function fix(v) { return v.toFixed(2); }

    root._blob = {
      get mode() { return cur.mode; },
      setState(mode) {
        cur.mode = mode;
        if (mode === 'listening') {
          target.amp = 1.0;  target.speed = 1.0;  target.expand = 1.0;
        } else if (mode === 'thinking') {
          target.amp = 1.55; target.speed = 2.4;  target.expand = 0.96;
        } else if (mode === 'speaking') {
          target.amp = 1.28; target.speed = 1.7;  target.expand = 1.07;
        }
        root.setAttribute('data-blob-state', mode);
      },
      beat() { cur.beatStrength = 1.0; },
    };
    root._blob.setState('listening');

    if (REDUCED) {
      cancelAnimationFrame(raf);
    }
  }

  // ════════════ SYNCH chat cycle ════════════
  function initChat(root) {
    if (!root._blob) return;
    const chat = root.querySelector('[data-chat]');
    if (!chat) return;
    const turns = Array.from(chat.querySelectorAll('[data-turn]'));
    if (!turns.length) return;

    const counterEl  = root.querySelector('[data-chat-counter]');
    const progressEl = root.querySelector('[data-chat-progress] i');
    const skipBtn    = root.querySelector('[data-chat-skip]');
    const stateLabel = root.querySelector('[data-state-label]');
    const pillText   = root.querySelector('[data-statepill-text]');
    const footState  = root.querySelector('[data-foot-state]');
    const uptimeEl   = root.querySelector('.sy-uptime');

    const TOTAL     = turns.length;
    const CYCLE_MS  = 6000;
    const THINK_MS  = 950;
    const SPEAK_MS  = 3500;

    // 例示用：uptime/avg の循環ごとの微変動（決め打ちで信頼感）
    const UPTIMES = ['99.98', '99.97', '99.99', '99.98', '99.97', '99.99'];
    const AVGS    = [0.31,    0.29,    0.33,    0.30,    0.32,    0.28];

    let idx = 0;
    let cycleStart = 0;
    let phase = 'init';
    let raf;

    function pad(n) { return String(n).padStart(2, '0'); }

    function updateCounter() {
      if (counterEl) counterEl.textContent = `${pad(idx + 1)} / ${pad(TOTAL)}`;
    }
    function updateUptime() {
      if (!uptimeEl) return;
      const k = idx % UPTIMES.length;
      uptimeEl.textContent = `${UPTIMES[k]}% · ${AVGS[k].toFixed(2)}s avg`;
    }
    function activate(i) {
      turns.forEach((t, k) => t.classList.toggle('is-active', k === i));
    }

    function setMode(mode) {
      root._blob.setState(mode);

      // 状態に応じた detail（latency / tk/s）を決定
      let label, detail, footTxt;
      if (mode === 'listening') {
        label = 'LISTENING';
        detail = '· idle';
        footTxt = 'operational';
      } else if (mode === 'thinking') {
        const ms = 280 + Math.floor(Math.random() * 180);   // 0.28–0.46s
        label = 'THINKING';
        detail = `· ${(ms / 1000).toFixed(2)}s`;
        footTxt = 'thinking';
      } else if (mode === 'speaking') {
        const tps = 18 + Math.floor(Math.random() * 11);    // 18–28 tk/s
        label = 'SPEAKING';
        detail = `· ${tps} tk/s`;
        footTxt = 'speaking';
      }
      if (stateLabel) stateLabel.textContent = `${label} ${detail}`;
      if (pillText)   pillText.textContent = mode;
      if (footState)  footState.textContent = footTxt;
      chat.setAttribute('data-thinking', mode === 'thinking' ? 'true' : 'false');
    }

    function startCycle(now) {
      cycleStart = now;
      phase = 'thinking';
      setMode('thinking');
      turns.forEach((t) => t.classList.remove('is-active'));
      updateCounter();
      updateUptime();
    }

    function loop(now) {
      if (!cycleStart) startCycle(now);
      const elapsed = now - cycleStart;

      if (progressEl) {
        progressEl.style.width = `${Math.min(100, (elapsed / CYCLE_MS) * 100)}%`;
      }

      if (phase === 'thinking' && elapsed >= THINK_MS) {
        phase = 'speaking';
        setMode('speaking');
        root._blob.beat();
        activate(idx);
      } else if (phase === 'speaking' && elapsed >= THINK_MS + SPEAK_MS) {
        phase = 'listening';
        setMode('listening');
      } else if (phase === 'listening' && elapsed >= CYCLE_MS) {
        idx = (idx + 1) % TOTAL;
        startCycle(now);
      }

      raf = requestAnimationFrame(loop);
    }

    activate(0);
    updateCounter();
    updateUptime();
    raf = requestAnimationFrame(loop);

    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        const now = performance.now();
        cycleStart = now - CYCLE_MS;
      });
    }
  }

  function clampInt(raw, fallback, min, max) {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }
  function clampFloat(raw, fallback, min, max) {
    const n = parseFloat(raw);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function boot() {
    document.querySelectorAll('[data-blob]').forEach((root) => {
      initBlob(root);
      initChat(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
