(function () {
  // 打字机动效的计时器（重新渲染时清掉旧的，避免泄漏）
  var intervals = [];
  var timeouts = [];
  // 当前展开的引擎下拉面板（点击外部关闭，监听只注册一次）
  var activePanel = null;

  document.addEventListener("click", function () {
    if (activePanel) {
      activePanel.classList.remove("open");
      activePanel = null;
    }
  });

  function clearTimers() {
    intervals.forEach(clearInterval);
    timeouts.forEach(clearTimeout);
    intervals.length = 0;
    timeouts.length = 0;
  }

  // 点击位置蹦出小字提示（非弹窗，短暂显示后消失）
  function spawnTip(x, y, text) {
    var t = document.createElement("span");
    t.className = "tip-pop";
    t.textContent = text;
    // 防溢出视口：x 贴近右/左边缘时收拢
    t.style.left = Math.max(10, Math.min(x, window.innerWidth - 140)) + "px";
    t.style.top = y + "px";
    document.body.appendChild(t);
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 1600);
  }
  window.spawnTip = spawnTip;

  window.renderHome = function () {
    var data = window.LINKS;
    if (!data) return;
    clearTimers();

    document.getElementById("site-name").textContent = data.siteName || "";
    var sub = document.getElementById("site-subtitle");
    var subtitles = data.subtitles && data.subtitles.length ? data.subtitles : ["记录技术与生活的点滴"];
    sub.textContent = "";
    var cursor = document.createElement("span");
    cursor.className = "cursor";
    sub.appendChild(cursor);
    var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      sub.insertBefore(document.createTextNode(subtitles[0]), cursor);
    } else {
      function typeLoop() {
        while (sub.firstChild !== cursor) sub.removeChild(sub.firstChild);
        var subtitleText = subtitles[Math.floor(Math.random() * subtitles.length)];
        var i = 0;
        var typeTimer = setInterval(function () {
          if (i < subtitleText.length) {
            cursor.insertAdjacentText("beforebegin", subtitleText[i]);
            i++;
          } else {
            clearInterval(typeTimer);
            timeouts.push(setTimeout(eraseLoop, 3000));
          }
        }, 120);
        intervals.push(typeTimer);
      }

      function eraseLoop() {
        var delTimer = setInterval(function () {
          var prev = cursor.previousSibling;
          if (!prev) {
            clearInterval(delTimer);
            typeLoop();
            return;
          }
          if (prev.nodeType === 3 && prev.data.length > 1) {
            prev.data = prev.data.slice(0, -1);
          } else {
            sub.removeChild(prev);
          }
        }, 40);
        intervals.push(delTimer);
      }

      typeLoop();
    }
    document.getElementById("footer-text").textContent = data.footer || "";
    document.title = data.siteName || "ByteHarbor";

    var container = document.getElementById("groups");
    var frag = document.createDocumentFragment();

    data.groups.forEach(function (group, gi) {
      var section = document.createElement("section");
      section.className = "group";
      section.dataset.group = gi;

      var title = document.createElement("h2");
      title.className = "group-title";
      title.textContent = (group.icon ? group.icon + " " : "") + group.name;
      section.appendChild(title);

      var grid = document.createElement("div");
      grid.className = "card-grid";

      group.links.forEach(function (link, li) {
        var a = document.createElement(link.url ? "a" : "div");
        a.className = "card" + (link.url ? "" : " card-placeholder");
        a.dataset.group = gi;
        a.dataset.link = li;
        if (link.url) {
          a.href = link.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        } else {
          // 占位卡片：点击时在点击位置蹦出提示
          a.addEventListener("click", function (e) {
            spawnTip(e.clientX, e.clientY, "链接待配置");
          });
        }

        var icon = document.createElement("span");
        icon.className = "card-icon";
        icon.textContent = link.icon || "🔗";

        var body = document.createElement("span");
        body.className = "card-body";

        var t = document.createElement("span");
        t.className = "card-title";
        t.textContent = link.title;

        body.appendChild(t);
        if (link.desc) {
          var d = document.createElement("span");
          d.className = "card-desc";
          d.textContent = link.desc;
          body.appendChild(d);
        }
        a.appendChild(icon);
        a.appendChild(body);
        grid.appendChild(a);
      });

      section.appendChild(grid);
      frag.appendChild(section);
    });

    container.textContent = "";
    container.appendChild(frag);

    /* ===== 全局搜索框（固定悬浮底部居中，左侧可切换搜索引擎） ===== */
    var oldSearch = document.getElementById("global-search");
    if (oldSearch) oldSearch.remove();

    var sc = data.search;
    if (sc && ((sc.searchUrl) || (sc.engines && sc.engines.length))) {
      var engines = sc.engines && sc.engines.length ? sc.engines : [sc];

      var form = document.createElement("form");
      form.id = "global-search";
      form.method = "get";
      form.target = "_blank";
      form.rel = "noopener noreferrer";
      form.setAttribute("autocomplete", "off");

      /* 引擎选择器：自定义下拉（弹出列表可完全定制样式） */
      var selBox = document.createElement("div");
      selBox.className = "engine-select";
      selBox.setAttribute("aria-label", "选择搜索引擎");

      var selBtn = document.createElement("button");
      selBtn.type = "button";
      selBtn.className = "engine-btn";

      var selPanel = document.createElement("ul");
      selPanel.className = "engine-panel";
      selPanel.setAttribute("role", "listbox");

      var optEls = [];
      engines.forEach(function (eng, i) {
        var li = document.createElement("li");
        li.className = "engine-opt";
        li.setAttribute("role", "option");
        li.textContent = eng.name || "引擎" + (i + 1);
        li.addEventListener("click", function (e) {
          e.stopPropagation();
          setEngine(i);
          closePanel();
        });
        selPanel.appendChild(li);
        optEls.push(li);
      });
      selBox.appendChild(selBtn);
      selBox.appendChild(selPanel);

      function setEngine(idx) {
        var eng = engines[idx] || engines[0];
        form.action = eng.searchUrl || "";
        input.name = eng.queryParam || "q";
        input.placeholder = eng.placeholder || sc.placeholder || "输入关键词搜索";
        input.setAttribute("aria-label", (eng.name || "搜索") + "搜索");
        selBtn.textContent = (eng.name || "搜索") + " ▾";
        optEls.forEach(function (li, i) {
          li.classList.toggle("active", i === idx);
        });
        try {
          localStorage.setItem("dovahkiin-search-engine-v1", String(idx));
        } catch (e) {}
      }

      function openPanel() {
        activePanel = selPanel;
        selBox.classList.add("open");
        selPanel.classList.add("open");
      }

      function closePanel() {
        if (activePanel === selPanel) activePanel = null;
        selBox.classList.remove("open");
        selPanel.classList.remove("open");
      }

      selBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (selPanel.classList.contains("open")) closePanel();
        else openPanel();
      });

      var input = document.createElement("input");
      input.type = "text";
      input.setAttribute("autocomplete", "off");
      input.setAttribute("spellcheck", "false");
      input.setAttribute("aria-label", "搜索");

      // 记忆上次选择的引擎（必须在 input 创建之后调用 setEngine）
      var savedIdx = 0;
      try {
        savedIdx = parseInt(localStorage.getItem("dovahkiin-search-engine-v1"), 10) || 0;
      } catch (e) {}
      setEngine(savedIdx >= 0 && savedIdx < engines.length ? savedIdx : 0);

      var btn = document.createElement("button");
      btn.type = "submit";
      btn.textContent = "搜索";

      form.appendChild(selBox);
      form.appendChild(input);
      form.appendChild(btn);
      var footer = document.querySelector(".site-footer");
      if (footer) {
        footer.parentNode.insertBefore(form, footer);
      } else {
        document.body.appendChild(form);
      }
    }
  };

  window.renderHome();
})();
