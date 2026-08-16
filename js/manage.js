/* ============================================================
 * 右键管理模块（纯前端，无后端）
 * - 卡片上右键：修改链接 / 编辑卡片 / 删除卡片
 * - 分组上右键：添加卡片 / 重命名分组 / 删除分组
 * - 空白处右键：添加分组 / 导出配置 / 恢复默认
 * - 所有修改保存在浏览器 localStorage（仅对当前浏览器生效）
 * ============================================================ */
(function () {
  "use strict";

  var STORAGE_KEY = "dovahkiin-homepage-links-v1";
  var defaultData = null;

  /* ---------- 数据层 ---------- */

  function snapshot(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      return null;
    }
  }

  // 捕获 links.js 里的默认数据（本文件在 links.js 之后加载）
  defaultData = snapshot(window.LINKS);

  // 有本地修改则覆盖默认数据（以默认结构为骨架，旧格式数据不会覆盖新版配置）
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var saved = JSON.parse(raw);
      if (saved && typeof saved === "object" && Array.isArray(saved.groups)) {
        window.LINKS = mergeData(saved);
      }
    }
  } catch (e) {
    console.warn("[manage] 读取本地数据失败，使用默认配置", e);
  }

  // 合并：保留默认数据结构（站点品牌名始终以 links.js 为准），
  // 仅用户可管理的部分（groups）用本地数据覆盖
  function mergeData(saved) {
    var out = defaultData ? snapshot(defaultData) : { groups: [] };
    if (Array.isArray(saved.groups)) out.groups = saved.groups;
    if (saved.search && saved.search.engines && saved.search.engines.length) {
      out.search = saved.search;
    }
    return out;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(window.LINKS));
    } catch (e) {
      alert("保存失败（浏览器存储可能被禁用）：" + e.message);
    }
  }

  function rerender() {
    if (typeof window.renderHome === "function") window.renderHome();
  }

  /* ---------- 右键菜单 ---------- */

  var menu = document.createElement("div");
  menu.id = "ctx-menu";
  document.body.appendChild(menu);

  function hideMenu() {
    menu.style.display = "none";
    menu.textContent = "";
  }

  function showMenu(x, y, items) {
    hideMenu();
    items.forEach(function (item) {
      if (item === "-") {
        var sep = document.createElement("div");
        sep.className = "ctx-sep";
        menu.appendChild(sep);
        return;
      }
      if (item.header) {
        var h = document.createElement("div");
        h.className = "ctx-header";
        h.textContent = item.header;
        menu.appendChild(h);
        return;
      }
      var el = document.createElement("div");
      el.className = "ctx-item" + (item.danger ? " ctx-danger" : "");
      if (item.icon) {
        var ic = document.createElement("span");
        ic.className = "ctx-icon";
        ic.textContent = item.icon;
        el.appendChild(ic);
      }
      var lb = document.createElement("span");
      lb.textContent = item.label;
      el.appendChild(lb);
      el.addEventListener("click", function (e) {
        e.stopPropagation(); // 阻止冒泡，避免触发 document 级监听（空白彩蛋等）
        hideMenu();
        if (typeof item.action === "function") item.action();
      });
      menu.appendChild(el);
    });
    menu.style.display = "block";
    // 防溢出视口
    var mw = menu.offsetWidth || 180;
    var mh = menu.offsetHeight || 40;
    menu.style.left = Math.max(4, Math.min(x, window.innerWidth - mw - 8)) + "px";
    menu.style.top = Math.max(4, Math.min(y, window.innerHeight - mh - 8)) + "px";
  }

  // 左键点击 / 滚动 / 缩放 / Esc 关闭菜单
  document.addEventListener("click", hideMenu);
  document.addEventListener("scroll", hideMenu, true);
  window.addEventListener("resize", hideMenu);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      hideMenu();
      closeModal();
    }
  });

  /* ---------- 编辑模态框 ---------- */

  // 常用图标（供图标字段快速选择）
  var COMMON_ICONS = [
    "🔗", "📝", "📺", "🎵", "🐙", "☁️", "🚀", "📦",
    "🧰", "💻", "🌐", "📚", "🎮", "✉️", "💬", "📷",
    "⏳", "🔧", "⚙️", "🧠", "🔍", "📊", "🎓", "🐳"
  ];

  var modal = document.createElement("div");
  modal.id = "edit-modal";
  modal.innerHTML =
    '<div class="modal-card">' +
    '<h3 id="modal-title">编辑</h3>' +
    '<div id="modal-fields"></div>' +
    '<div class="modal-actions">' +
    '<button id="modal-cancel" type="button" class="m-btn">取消</button>' +
    '<button id="modal-ok" type="button" class="m-btn m-primary">保存</button>' +
    "</div>" +
    "</div>";
  document.body.appendChild(modal);

  var mTitle = modal.querySelector("#modal-title");
  var mFields = modal.querySelector("#modal-fields");
  var onModalSave = null;

  // defs: [{ id, label, value, placeholder, maxlength, iconPicker }]
  function openModal(title, defs, onSave) {
    mTitle.textContent = title;
    mFields.textContent = "";
    var inputs = {};
    defs.forEach(function (d) {
      var wrap = document.createElement("label");
      wrap.textContent = d.label;
      var inp = document.createElement("input");
      inp.type = "text";
      inp.value = d.value || "";
      if (d.placeholder) inp.placeholder = d.placeholder;
      if (d.maxlength) inp.maxlength = d.maxlength;
      wrap.appendChild(inp);
      inputs[d.id] = inp;

      // 常用图标快速选择面板
      if (d.iconPicker) {
        var grid = document.createElement("div");
        grid.className = "icon-picker";
        COMMON_ICONS.forEach(function (ic) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "icon-opt" + (ic === inp.value ? " active" : "");
          b.textContent = ic;
          b.title = "选择图标 " + ic;
          b.addEventListener("click", function () {
            inp.value = ic;
            var opts = grid.querySelectorAll(".icon-opt");
            for (var k = 0; k < opts.length; k++) opts[k].classList.remove("active");
            b.classList.add("active");
            inp.focus();
          });
          grid.appendChild(b);
        });
        wrap.appendChild(grid);
      }

      mFields.appendChild(wrap);
      inputs[d.id] = inp;
    });
    onModalSave = function () {
      var out = {};
      Object.keys(inputs).forEach(function (k) {
        out[k] = inputs[k].value.trim();
      });
      return onSave(out);
    };
    modal.classList.add("open");
    var first = mFields.querySelector("input");
    if (first) first.focus();
  }

  function closeModal() {
    modal.classList.remove("open");
    onModalSave = null;
  }

  // 点遮罩关闭
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeModal();
  });
  modal.querySelector("#modal-cancel").addEventListener("click", closeModal);
  modal.querySelector("#modal-ok").addEventListener("click", function () {
    if (typeof onModalSave !== "function") return;
    var keep = onModalSave(); // onSave 返回 false 表示校验失败，保持弹窗
    if (keep !== false) closeModal();
  });
  // 输入框按 Enter 直接保存
  mFields.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      modal.querySelector("#modal-ok").click();
    }
  });

  /* ---------- 定位数据 ---------- */

  function findCard(el) {
    var card = el.closest(".card");
    if (!card || card.dataset.group === undefined || card.dataset.link === undefined) return null;
    var gi = +card.dataset.group;
    var li = +card.dataset.link;
    var g = window.LINKS.groups[gi];
    if (!g || !g.links) return null;
    return { gi: gi, li: li, group: g, link: g.links[li] };
  }

  function findGroup(el) {
    var groupEl = el.closest(".group");
    if (!groupEl || groupEl.dataset.group === undefined) return null;
    var gi = +groupEl.dataset.group;
    var g = window.LINKS.groups[gi];
    return g ? { gi: gi, group: g } : null;
  }

  /* ---------- 菜单组装 ---------- */

  function cardDefs(link) {
    return [
      { id: "title", label: "标题", value: link.title, maxlength: 30 },
      { id: "url", label: "链接", value: link.url, placeholder: "https://...（留空=占位卡片）" },
      { id: "desc", label: "描述", value: link.desc, maxlength: 60 },
      { id: "icon", label: "图标", value: link.icon || "🔗", maxlength: 4, iconPicker: true }
    ];
  }

  function showCardMenu(x, y, el) {
    var found = findCard(el);
    if (!found) return;
    var link = found.link;
    showMenu(x, y, [
      {
        icon: "🔗",
        label: "修改链接",
        action: function () {
          openModal(
            "修改链接",
            [{ id: "url", label: "新链接", value: link.url, placeholder: "https://...（留空=占位卡片）" }],
            function (f) {
              link.url = f.url;
              save();
              rerender();
            }
          );
        }
      },
      {
        icon: "📝",
        label: "编辑卡片",
        action: function () {
          openModal("编辑卡片", cardDefs(link), function (f) {
            if (!f.title) {
              alert("标题不能为空");
              return false;
            }
            link.title = f.title;
            link.url = f.url;
            link.desc = f.desc;
            link.icon = f.icon || "🔗";
            save();
            rerender();
          });
        }
      },
      "-",
      {
        icon: "🗑️",
        label: "删除卡片",
        danger: true,
        action: function () {
          if (confirm('确定删除卡片「' + (link.title || "未命名") + '」？')) {
            found.group.links.splice(found.li, 1);
            save();
            rerender();
          }
        }
      }
    ]);
  }

  function showGroupMenu(x, y, el) {
    var found = findGroup(el);
    if (!found) return;
    var g = found.group;
    showMenu(x, y, [
      {
        icon: "➕",
        label: "在此分组添加卡片",
        action: function () {
          openModal(
            '添加卡片到「' + g.name + '」',
            [
              { id: "title", label: "标题", maxlength: 30 },
              { id: "url", label: "链接", placeholder: "https://...（留空=占位卡片）" },
              { id: "desc", label: "描述", maxlength: 60 },
              { id: "icon", label: "图标", value: "🔗", maxlength: 4, iconPicker: true }
            ],
            function (f) {
              if (!f.title) {
                alert("标题不能为空");
                return false;
              }
              g.links = g.links || [];
              g.links.push({ title: f.title, url: f.url, desc: f.desc, icon: f.icon || "🔗" });
              save();
              rerender();
            }
          );
        }
      },
      {
        icon: "✏️",
        label: "重命名分组",
        action: function () {
          openModal(
            "重命名分组",
            [
              { id: "name", label: "分组名", value: g.name, maxlength: 20 },
              { id: "icon", label: "图标", value: g.icon || "🧩", maxlength: 4, iconPicker: true }
            ],
            function (f) {
              if (!f.name) {
                alert("分组名不能为空");
                return false;
              }
              g.name = f.name;
              g.icon = f.icon || g.icon;
              save();
              rerender();
            }
          );
        }
      },
      "-",
      {
        icon: "🗑️",
        label: "删除分组",
        danger: true,
        action: function () {
          if (confirm('确定删除分组「' + g.name + '」及其全部卡片？')) {
            window.LINKS.groups.splice(found.gi, 1);
            save();
            rerender();
          }
        }
      }
    ]);
  }

  function showPageMenu(x, y) {
    showMenu(x, y, [
      {
        icon: "➕",
        label: "添加新分组",
        action: function () {
          openModal(
            "添加新分组",
            [
              { id: "name", label: "分组名", maxlength: 20 },
              { id: "icon", label: "图标", value: "🧩", maxlength: 4, iconPicker: true }
            ],
            function (f) {
              if (!f.name) {
                alert("分组名不能为空");
                return false;
              }
              window.LINKS.groups = window.LINKS.groups || [];
              window.LINKS.groups.push({ name: f.name, icon: f.icon || "🧩", links: [] });
              save();
              rerender();
            }
          );
        }
      }
    ]);
  }

  function exportConfig() {
    try {
      var blob = new Blob([JSON.stringify(window.LINKS, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "homepage-links.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
      }, 1000);
    } catch (e) {
      alert("导出失败：" + e.message);
    }
  }

  /* ---------- 屏幕两侧：黑客风终端彩蛋菜单 ---------- */

  var HACK_CMDS = [
    { cmd: "whoami", reply: "guest@byteharbor" },
    { cmd: "ls -la", reply: "3 个隐藏文件被发现" },
    { cmd: "sudo rm -rf /", reply: "permission denied" },
    { cmd: "hack the planet", reply: "hacking... 完成" },
    { cmd: "ping 8.8.8.8", reply: "64 bytes ok · 12.3ms" },
    { cmd: "cat ~/.bashrc", reply: "alias ll='ls -la'" },
    { cmd: "exit", reply: "欢迎再来，访客" }
  ];

  function showSideMenu(x, y) {
    var items = [{ header: "$ byteharbor@localhost: ~" }];
    HACK_CMDS.forEach(function (c) {
      items.push({
        label: "$ " + c.cmd,
        action: function () {
          if (typeof window.spawnTip === "function") {
            window.spawnTip(x, y + 6, c.reply);
          }
        }
      });
    });
    showMenu(x, y, items);
  }

  /* ---------- 右键分发 ---------- */

  document.addEventListener("contextmenu", function (e) {
    // 搜索框区域完全禁止右键（不弹管理菜单，也不弹浏览器菜单）
    if (e.target.closest("#global-search")) {
      e.preventDefault();
      return;
    }
    // 输入框里保留浏览器默认菜单（方便复制粘贴）
    if (e.target.closest("input, textarea")) return;
    var cardEl = e.target.closest(".card");
    var groupEl = e.target.closest(".group");
    if (cardEl) {
      e.preventDefault();
      showCardMenu(e.clientX, e.clientY, cardEl);
    } else if (groupEl) {
      e.preventDefault();
      showGroupMenu(e.clientX, e.clientY, groupEl);
    } else {
      e.preventDefault();
      // 屏幕左右两侧各 1/3 弹黑客风终端彩蛋菜单，中间 1/3 弹管理菜单
      if (e.clientX < window.innerWidth / 3 || e.clientX > (window.innerWidth * 2) / 3) {
        showSideMenu(e.clientX, e.clientY);
      } else {
        showPageMenu(e.clientX, e.clientY);
      }
    }
  });

  /* ---------- 页脚小提示 ---------- */

  var hint = document.createElement("div");
  hint.id = "manage-hint";
  hint.textContent = "右键卡片/空白处可管理链接 · 修改仅保存在当前浏览器";
  document.body.appendChild(hint);

  /* ---------- 空白左键点击：黑客风彩蛋 ---------- */

  var EGG_LINES = [
    ">_ 你戳到了虚空",
    "$ whoami  → guest",
    "一切正常，继续摸鱼",
    "sudo 已授权，无事发生",
    "hack the planet",
    "这里什么都没有……真的",
    "空白即自由",
    "$ echo 彩蛋加载中",
    "检测到好奇心",
    "别戳了，屏幕会疼",
    "printf(\"嗨\\n\")",
    "内存泄漏警告：别乱点"
  ];
  var lastEgg = 0;

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    // 防御：点击目标已被移除出文档（如刚关掉的菜单项）时不触发
    if (!document.contains(t)) return;
    // 排除交互/内容区域，只认页面空白
    if (
      t.closest(
        "a, button, input, textarea, .card, .group, .site-header, .site-footer, " +
          "#global-search, #ctx-menu, #edit-modal, .engine-select, .tip-pop, " +
          ".curs, .curs-trail, #manage-hint"
      )
    ) {
      return;
    }
    var now = performance.now();
    if (now - lastEgg < 350) return; // 节流，避免连点刷屏
    lastEgg = now;
    if (typeof window.spawnTip === "function") {
      window.spawnTip(
        e.clientX,
        e.clientY,
        EGG_LINES[Math.floor(Math.random() * EGG_LINES.length)]
      );
    }
  });

  /* ---------- 移动端管理模式（悬浮按钮 + tap 编辑） ---------- */

  // 是否触屏设备
  var isTouch =
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
    "ontouchstart" in window;
  if (!isTouch) return;

  var manageMode = false;

  // 全局悬浮管理按钮（仅触屏显示）
  var fab = document.createElement("button");
  fab.className = "fab";
  fab.type = "button";
  fab.textContent = "⚙️";
  fab.setAttribute("aria-label", "管理模式");
  document.body.appendChild(fab);

  fab.addEventListener("click", function () {
    manageMode = !manageMode;
    document.body.classList.toggle("manage-mode", manageMode);
    showMenu(fab.getBoundingClientRect().left, fab.getBoundingClientRect().bottom, [
      {
        icon: manageMode ? "✅" : "⚙️",
        label: manageMode ? "退出管理" : "进入管理模式",
        action: function () {
          manageMode = !manageMode;
          document.body.classList.toggle("manage-mode", manageMode);
        }
      },
      {
        icon: "➕",
        label: "添加新分组",
        action: function () {
          manageMode = true;
          document.body.classList.add("manage-mode");
          openModal(
            "添加新分组",
            [
              { id: "name", label: "分组名", maxlength: 20 },
              { id: "icon", label: "图标", value: "🧩", maxlength: 4, iconPicker: true }
            ],
            function (f) {
              if (!f.name) {
                alert("分组名不能为空");
                return false;
              }
              window.LINKS.groups = window.LINKS.groups || [];
              window.LINKS.groups.push({ name: f.name, icon: f.icon || "🧩", links: [] });
              save();
              rerender();
            }
          );
        }
      }
    ]);
    // 菜单需避开屏幕下方，fab 在底部，向下弹会被遮；翻转定位由 showMenu 自动处理
  });

  // 管理模式下的 tap 编辑：点击卡片或分组标题弹出对应菜单
  document.addEventListener("click", function (e) {
    if (!manageMode) return;
    var t = e.target;
    if (!t || !t.closest) return;
    // 点按钮本身/菜单/弹窗内部不重复触发
    if (t.closest(".fab, #ctx-menu, #edit-modal", document.body)) return;

    var cardEl = t.closest(".card");
    if (cardEl) {
      e.preventDefault();
      showCardMenu(e.clientX !== undefined ? e.clientX : t.getBoundingClientRect().left,
        (e.clientY !== undefined ? e.clientY : t.getBoundingClientRect().top) + 8, cardEl);
      return;
    }
    var groupEl = t.closest(".group-title");
    if (groupEl) {
      var sec = groupEl.closest(".group");
      if (sec) {
        e.preventDefault();
        showGroupMenu(
          t.getBoundingClientRect().left,
          t.getBoundingClientRect().bottom,
          sec
        );
      }
    }
  });
})();
