(function () {
  const rainC = document.createElement("canvas");
  rainC.id = "rain";
  const logC = document.createElement("canvas");
  logC.id = "log";
  const rctx = rainC.getContext("2d");
  const lctx = logC.getContext("2d");

  /* ===== 纵深透视雨（伪 3D） ===== */
  const CHARS = "ABCDEF0123456789アイウエオカキクケコサシスセソタチツテト";
  const DEPTH_MIN = 0.5; // 远处深度（聚拢温和）
  const DEPTH_MAX = 1; // 近处深度
  const BASE_SPEED = 276; // 近层基准速度 px/s（原 230 +20%）
  // 移动端（粗指针）性能：雨滴数量减半
  const IS_TOUCH =
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
    "ontouchstart" in window;
  const TARGET_DROPS = IS_TOUCH ? 24 : 45; // 屏幕上雨滴目标数
  const CHANGE_MIN = 14; // 字符变动最小间隔 ms
  const CHANGE_MAX = 20; // 字符变动最大间隔 ms
  let drops = [];

  function randChars(len) {
    return Array.from({ length: len }, function () {
      return CHARS[Math.floor(Math.random() * CHARS.length)];
    });
  }

  function spawnDrop(fromTop) {
    // z 偏向近处（数量加权），近处雨滴铺满全幅、远处少量温和聚拢 → 视觉密度均匀
    const z = 1 - Math.pow(Math.random(), 0.7) * (1 - DEPTH_MIN);
    const len = Math.max(6, Math.round(10 * (0.5 + z)));
    return {
      x: (Math.random() - 0.5 + 0.5 * z) / z, // 反推补偿：屏幕横向密度均匀，两侧不空
      z: z,
      y: fromTop ? -0.1 : Math.random(),
      size: Math.round((9.8 + 16.8 * z) * (0.7 + Math.random() * 0.6)),
      speed: BASE_SPEED * (0.35 + 0.9 * z),
      chars: randChars(len),
      nextChange: 0
    };
  }

  /* ===== 终端日志流 ===== */
  const FONT = 14;
  const LINE_H = 18;
  const LOG_SPEED = 84; // 像素/秒（向上）（原 70 +20%）
  const CMDS = [
    "ls -la", "cat config.json", "npm run dev", "git status", "ping 8.8.8.8",
    "ssh root@server", "curl -I https://ayato233.github.io", "python train.py",
    "systemctl status mysql", "docker ps", "tail -f app.log", "kubectl get pods",
    "java -jar app.jar", "make build", "pip install flask", "ps aux | grep java"
  ];
  const OKS = ["OK", "200 OK", "success", "done", "0 errors", "uptime: 99.98%", "3 passed"];
  const ERRS = ["ERROR: connection refused", "404 Not Found", "timeout", "WARN: deprecated", "403 Forbidden", "exit code 1"];
  const INFOS = ["Downloading 1.2 MB...", "Building project...", "Compiling 42 files...", "Listening on :8080", "Fetching data...", "Deploying...", "Waiting for lock..."];
  let lines = [];
  let nextLine = 0;

  function rand(a) {
    return a[Math.floor(Math.random() * a.length)];
  }

  function newLine(y) {
    const r = Math.random();
    let text, color;
    if (r < 0.25) {
      text = "$ " + rand(CMDS);
      color = "#00ff41";
    } else if (r < 0.45) {
      text = "  " + rand(OKS);
      color = "#1fbf3f";
    } else if (r < 0.6) {
      text = "  " + rand(ERRS);
      color = "#ff5555";
    } else if (r < 0.85) {
      text = "  " + rand(INFOS);
      color = "#8f9f8f";
    } else {
      text = "  " + Math.random().toString(16).slice(2, 12);
      color = "#0c7a22";
    }
    return { text: text, y: y !== undefined ? y : logC.height + LINE_H, color: color };
  }

  // 打开页面即铺满整个屏幕的日志行（行距按滚动时的自然分布，不挤）
  function seedLog() {
    lines = [];
    const maxY = logC.height + LINE_H;
    let y = LINE_H;
    while (y <= maxY) {
      lines.push(newLine(y));
      // 行距 = 滚动速度 × 行生成间隔（0.3~0.9s），与滚动时一致的稀疏度
      y += LOG_SPEED * (0.3 + Math.random() * 0.6);
    }
    nextLine = 0.3 + Math.random() * 0.6;
  }

  let last = performance.now();

  function resize() {
    rainC.width = logC.width = window.innerWidth;
    rainC.height = logC.height = window.innerHeight;
    drops = Array.from({ length: TARGET_DROPS }, function () {
      return spawnDrop(false);
    });
  }

  function draw(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    /* 雨层：纵深透视雨——近大远小、近快远慢、近亮远暗，向屏幕中心聚拢成走廊 */
    rctx.globalCompositeOperation = "destination-in";
    rctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    rctx.fillRect(0, 0, rainC.width, rainC.height);
    rctx.globalCompositeOperation = "source-over";
    const cx = rainC.width / 2;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const sx = cx + (d.x * rainC.width - cx) * d.z;
      const sy = d.y * rainC.height;
      if (now >= d.nextChange) {
        d.chars = randChars(d.chars.length);
        d.nextChange = now + CHANGE_MIN + Math.random() * (CHANGE_MAX - CHANGE_MIN);
      }
      for (let k = 0; k < d.chars.length; k++) {
        const yy = sy - k * d.size;
        if (yy < -d.size || yy > rainC.height + d.size) continue;
        rctx.font = d.size + "px monospace";
        rctx.globalAlpha = (1 - k / d.chars.length) * (0.1 + 0.3 * d.z);
        rctx.fillStyle = k === 0 ? (Math.random() < 0.08 ? "#ffffff" : "#00c233") : "#00652c";
        const ch = d.chars[k];
        const isFullWidth = ch.charCodeAt(0) > 0x2e7f; // 片假名等全角字符
        rctx.fillText(ch, sx - (isFullWidth ? d.size / 2 : 0), yy);
      }
      d.y += (d.speed * dt) / rainC.height;
      if (d.y > 1.1) {
        const nd = spawnDrop(true);
        drops[i] = nd;
      }
    }
    rctx.globalAlpha = 1;

    /* 日志层：全黑清屏 + 行向上滚动 */
    lctx.fillStyle = "#000";
    lctx.fillRect(0, 0, logC.width, logC.height);
    nextLine -= dt;
    if (nextLine <= 0) {
      lines.push(newLine());
      nextLine = 0.3 + Math.random() * 0.6;
    }
    lctx.font = FONT + "px monospace";
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      l.y -= LOG_SPEED * dt;
      if (l.y < -LINE_H) {
        lines.splice(i, 1);
        continue;
      }
      lctx.fillStyle = l.color;
      lctx.fillText(l.text, 20, l.y);
    }

    requestAnimationFrame(draw);
  }

  resize();
  seedLog();
  document.body.appendChild(logC);
  document.body.appendChild(rainC);
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    rctx.fillStyle = "#000";
    rctx.fillRect(0, 0, rainC.width, rainC.height);
  } else {
    requestAnimationFrame(draw);
  }
  window.addEventListener("resize", resize);
})();
