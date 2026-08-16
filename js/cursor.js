/* ============================================================
 * 黑客风自定义鼠标：绿色十字准星 + Matrix 字符尾迹
 * - 可交互元素（卡片/按钮/菜单项）悬停放大反馈
 * - 输入框/文本域恢复系统文本光标
 * - 减弱动态效果时只显示静态准星、不撒尾迹
 * ============================================================ */
(function () {
  "use strict";

  var reduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var curs = document.createElement("div");
  curs.className = "curs";
  document.body.appendChild(curs);

  var lastSpawn = 0;

  document.addEventListener("mousemove", function (e) {
    var x = e.clientX;
    var y = e.clientY;
    curs.style.left = x + "px";
    curs.style.top = y + "px";

    var t = e.target;
    // 输入类元素：隐藏自定义准星、用系统文本光标（保证输入体验）
    var isText = !!t.closest("input, textarea");
    curs.classList.toggle("curs-hidden", isText);

    // 可交互元素：准星放大反馈
    var interactive = !!t.closest(
      "a, button, .card, .engine-btn, .engine-opt, .ctx-item, .icon-opt, .home-btn"
    );
    curs.classList.toggle("curs-hover", interactive && !isText);

    // 撒 Matrix 尾迹（节流，减弱动效时跳过）
    var now = performance.now();
    if (!reduced && !isText && now - lastSpawn > 30) {
      lastSpawn = now;
      spawnTrail(x, y);
    }
  });

  // 鼠标离开窗口时隐藏准星
  document.addEventListener("mouseleave", function () {
    curs.style.opacity = "0";
  });
  document.addEventListener("mouseenter", function () {
    curs.style.opacity = "1";
  });

  function spawnTrail(x, y) {
    var t = document.createElement("span");
    t.className = "curs-trail";
    t.textContent = "0123456789abcdef"[Math.floor(Math.random() * 16)];
    t.style.left = x + (Math.random() * 18 - 9) + "px";
    t.style.top = y + (Math.random() * 18 - 9) + "px";
    document.body.appendChild(t);
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 700);
  }
})();
