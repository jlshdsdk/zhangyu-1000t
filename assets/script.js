/* ===== 公共交互：主题 / KaTeX / 折叠 / 进度 / 导航 ===== */
(function () {
  'use strict';

  /* ---------- 夜间模式 ---------- */
  var THEME_KEY = 'zy_theme';
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  /* ---------- 进度存取 ---------- */
  var PROG_KEY = 'zy_progress_v1';
  function loadProg() {
    try { return JSON.parse(localStorage.getItem(PROG_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveProg(p) { localStorage.setItem(PROG_KEY, JSON.stringify(p)); }

  /* ---------- 收藏库存取（错题/好题，互斥） ---------- */
  var STAR_KEY = 'zy_star_v1';
  function loadStars() {
    try { return JSON.parse(localStorage.getItem(STAR_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveStars(s) { localStorage.setItem(STAR_KEY, JSON.stringify(s)); }
  function libCount(stars, type) {
    var n = 0;
    Object.keys(stars).forEach(function (cid) {
      Object.keys(stars[cid]).forEach(function (no) { if (stars[cid][no] === type) n++; });
    });
    return n;
  }

  /* ---------- 首页：章节进度 + 收藏库入口计数 ---------- */
  if (document.body.dataset.page === 'index') {
    var prog = loadProg();
    document.querySelectorAll('.ci-prog').forEach(function (el) {
      var cid = el.dataset.cid;
      var total = window.INDEX_TOTALS && window.INDEX_TOTALS[cid];
      var done = (prog[cid] || []).length;
      if (!total) return;
      var pct = total ? Math.round(done / total * 100) : 0;
      if (pct === 0) { el.innerHTML = '<span class="muted">未开始</span>'; return; }
      el.innerHTML = '<span class="bar"><i style="width:' + pct + '%"></i></span> ' + pct + '%' +
        (pct === 100 ? ' <span class="done-flag">✓</span>' : '');
    });
    var stars0 = loadStars();
    document.querySelectorAll('.lib-count').forEach(function (el) {
      el.textContent = libCount(stars0, el.dataset.lib) + ' 题';
    });
    return; // 首页无需以下章节页逻辑
  }

  /* ---------- 收藏库页 ---------- */
  if (document.body.dataset.page === 'collections') {
    var DATA = window.QUESTION_INDEX || { chapters: [], questions: {} };
    var chById = {};
    DATA.chapters.forEach(function (c) { chById[c.cid] = c; });
    var listEl = document.getElementById('lib-list');
    var tabs = document.querySelectorAll('.lib-tab');
    var curTab = location.search.indexOf('tab=good') !== -1 ? 'good' : 'wrong';

    function mathRender(el) {
      if (window.renderMathInElement) {
        renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      }
    }
    function render() {
      var stars = loadStars();
      document.getElementById('cnt-wrong').textContent = libCount(stars, 'wrong') + ' 题';
      document.getElementById('cnt-good').textContent = libCount(stars, 'good') + ' 题';
      tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.lib === curTab); });
      var groups = {};
      Object.keys(stars).forEach(function (cid) {
        if (!DATA.questions[cid]) return;
        Object.keys(stars[cid]).forEach(function (no) {
          if (stars[cid][no] === curTab) (groups[cid] = groups[cid] || []).push(+no);
        });
      });
      var cids = Object.keys(groups).filter(function (cid) { return groups[cid].length; })
        .sort(function (a, b) { return +a - +b; });
      if (!cids.length) {
        listEl.innerHTML = '<div class="lib-empty">' + (curTab === 'wrong'
          ? '错题库还是空的 —— 打开任意章节，点题目右上角的 ✗ 即可收录错题'
          : '好题库还是空的 —— 打开任意章节，点题目右上角的 ★ 即可收录好题') + '</div>';
        return;
      }
      var html = '';
      cids.forEach(function (cid) {
        var c = chById[cid];
        var file = 'chapters/chapter-' + ('0' + cid).slice(-2) + '.html';
        html += '<div class="lib-group">' + c.part + ' · ' + c.subject + ' · ' + c.title +
          '（' + groups[cid].length + '题）</div>';
        groups[cid].sort(function (a, b) { return a - b; }).forEach(function (no) {
          var q = null;
          DATA.questions[cid].some(function (x) { if (x.no === no) { q = x; return true; } return false; });
          if (!q) return;
          html += '<div class="lib-item">' +
            '<a class="lib-main" href="' + file + '#q' + no + '">' +
            '<span class="lib-item-head">第' + no + '题 · ' + q.kind + '<em class="lib-loc">点击回到原题位置</em></span>' +
            '<span class="lib-stem">' + q.stem + '</span></a>' +
            '<button class="lib-remove" data-cid="' + cid + '" data-no="' + no + '" title="从' +
            (curTab === 'wrong' ? '错题库' : '好题库') + '移除">移出</button></div>';
        });
      });
      listEl.innerHTML = html;
      mathRender(listEl);
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        curTab = t.dataset.lib;
        history.replaceState(null, '', 'collections.html?tab=' + curTab);
        render();
      });
    });
    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.lib-remove');
      if (!btn) return;
      var stars = loadStars();
      if (stars[btn.dataset.cid]) { delete stars[btn.dataset.cid][btn.dataset.no]; saveStars(stars); }
      render();
    });
    render();
    return;
  }

  /* ---------- 章节页 ---------- */
  var meta = window.CHAPTER_META || {};
  var content = document.getElementById('content');

  /* 左侧多级目录：折叠交互（记忆状态）+ 当前章滚到可视区 + 移动端抽屉 */
  var sidebar = document.getElementById('sidebar');
  var TOC_KEY = 'zy_toc_open';

  function toggleToc(head) {
    var body = document.getElementById(head.dataset.target);
    if (!body) return;
    var open = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    head.classList.toggle('closed', open);
    var st = {};
    try { st = JSON.parse(localStorage.getItem(TOC_KEY)) || {}; } catch (e) {}
    st[head.dataset.target] = !open;
    try { localStorage.setItem(TOC_KEY, JSON.stringify(st)); } catch (e) {}
  }
  document.querySelectorAll('.toc-l1, .toc-l2').forEach(function (head) {
    head.addEventListener('click', function () { toggleToc(head); });
    head.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleToc(head); }
    });
  });
  /* 恢复用户上次的手动折叠状态（覆盖默认） */
  try {
    var st = JSON.parse(localStorage.getItem(TOC_KEY)) || {};
    Object.keys(st).forEach(function (id) {
      var body = document.getElementById(id);
      var head = document.querySelector('[data-target="' + id + '"]');
      if (!body || !head) return;
      body.style.display = st[id] ? '' : 'none';
      head.classList.toggle('closed', !st[id]);
    });
  } catch (e) {}

  var curToc = document.querySelector('.toc-l3.cur');
  if (sidebar && curToc && sidebar.scrollHeight > sidebar.clientHeight) {
    sidebar.scrollTop = curToc.offsetTop - 80;
  }
  var menuBtn = document.getElementById('menu-toggle');
  if (menuBtn && sidebar) {
    var overlay = null;
    function closeDrawer() {
      sidebar.classList.remove('open');
      if (overlay) { overlay.remove(); overlay = null; }
    }
    menuBtn.addEventListener('click', function () {
      if (sidebar.classList.contains('open')) { closeDrawer(); return; }
      sidebar.classList.add('open');
      overlay = document.createElement('div');
      overlay.className = 'side-overlay';
      overlay.addEventListener('click', closeDrawer);
      document.body.appendChild(overlay);
    });
    sidebar.addEventListener('click', function (e) {
      if (e.target.closest('a')) setTimeout(closeDrawer, 50);
    });
  }

  /* KaTeX 渲染 */
  function renderMath() {
    if (window.renderMathInElement) {
      renderMathInElement(content, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
  }
  if (document.readyState === 'interactive' || document.readyState === 'complete') renderMath();
  else document.addEventListener('DOMContentLoaded', renderMath);
  window.addEventListener('load', function () {
    if (!content.querySelector('.katex')) renderMath();
    /* KaTeX渲染改变版面后，重新定位到 #qN 锚点（收藏库回跳等场景） */
    var h = location.hash;
    if (h && h.indexOf('#q') === 0) {
      var el = document.querySelector(h);
      if (el) el.scrollIntoView({ block: 'start' });
    }
  });

  /* 解析折叠：>50题的章节默认折叠视口外的解析，滚动到附近自动展开 */
  var sections = Array.prototype.slice.call(document.querySelectorAll('.analysis'));
  if (meta.lazy) {
    sections.forEach(function (sec) {
      var btn = sec.querySelector('.fold-btn');
      var txt = sec.querySelector('.fold-text');
      sec.dataset.open = 'false';
      btn.setAttribute('aria-expanded', 'false');
      if (txt) txt.textContent = '展开解析';
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && en.target.dataset.auto !== '0') {
          var btn = en.target.querySelector('.fold-btn');
          en.target.dataset.open = 'true';
          btn.setAttribute('aria-expanded', 'true');
          var txt = en.target.querySelector('.fold-text');
          if (txt) txt.textContent = '收起解析';
        }
      });
    }, { rootMargin: '120px 0px' });
    sections.forEach(function (s) { io.observe(s); });
    /* scroll 兜底：个别环境（后台标签页/嵌入式webview）IO可能被节流 */
    var lastCheck = 0;
    function expandNear(force) {
      var now = Date.now();
      if (!force && now - lastCheck < 180) return;
      lastCheck = now;
      var vh = window.innerHeight;
      sections.forEach(function (s) {
        if (s.dataset.open === 'true' || s.dataset.auto === '0') return;
        var r = s.getBoundingClientRect();
        if (r.top < vh + 120 && r.bottom > -120) {
          s.dataset.open = 'true';
          var b = s.querySelector('.fold-btn');
          b.setAttribute('aria-expanded', 'true');
          var t = s.querySelector('.fold-text');
          if (t) t.textContent = '收起解析';
        }
      });
    }
    window.addEventListener('scroll', expandNear, { passive: true });
    window.addEventListener('resize', expandNear);
    expandNear();
    /* 后台标签页无渲染帧时scroll/IO均不触发，用低频轮询兜底 */
    var poll = setInterval(function () {
      expandNear(true);
      var remaining = sections.some(function (s) { return s.dataset.open === 'false' && s.dataset.auto !== '0'; });
      if (!remaining) clearInterval(poll);
    }, 500);
  }
  document.querySelectorAll('.fold-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var sec = btn.closest('.analysis');
      var open = sec.dataset.open === 'true';
      sec.dataset.open = open ? 'false' : 'true';
      sec.dataset.auto = '0'; /* 手动操作后不再自动展开 */
      btn.setAttribute('aria-expanded', String(!open));
      var txt = btn.querySelector('.fold-text');
      if (txt) txt.textContent = open ? '展开解析' : '收起解析';
    });
  });

  /* 已做标记 */
  var prog = loadProg();
  function syncDoneUI() {
    document.querySelectorAll('.done-btn').forEach(function (btn) {
      var cid = btn.dataset.cid, no = +btn.dataset.no;
      var on = (prog[cid] || []).indexOf(no) !== -1;
      btn.classList.toggle('on', on);
      var nav = document.querySelector('.nav-no[href="#q' + no + '"]');
      if (nav) nav.classList.toggle('done', on);
    });
  }
  document.querySelectorAll('.done-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cid = btn.dataset.cid, no = btn.dataset.no;
      var arr = prog[cid] || [];
      var i = arr.indexOf(+no);
      if (i === -1) arr.push(+no); else arr.splice(i, 1);
      prog[cid] = arr;
      saveProg(prog);
      syncDoneUI();
    });
  });
  syncDoneUI();

  /* 收藏库标记（错题/好题，两库互斥，再点取消） */
  function syncStarUI() {
    var stars = loadStars();
    document.querySelectorAll('.star-btn').forEach(function (btn) {
      var t = stars[btn.dataset.cid] && stars[btn.dataset.cid][btn.dataset.no];
      btn.classList.toggle('on', btn.dataset.type === t);
    });
  }
  document.querySelectorAll('.star-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cid = btn.dataset.cid, no = btn.dataset.no, type = btn.dataset.type;
      var stars = loadStars();
      stars[cid] = stars[cid] || {};
      if (stars[cid][no] === type) delete stars[cid][no];
      else stars[cid][no] = type;
      saveStars(stars);
      syncStarUI();
    });
  });
  syncStarUI();

  /* 侧边栏高亮 + 上下题切换 */
  var blocks = Array.prototype.slice.call(document.querySelectorAll('.question'));
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        document.querySelectorAll('.nav-no').forEach(function (a) { a.classList.remove('active'); });
        var link = document.querySelector('.nav-no[href="#' + en.target.id + '"]');
        if (link) { link.classList.add('active'); link.scrollIntoView({ block: 'nearest' }); }
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  blocks.forEach(function (b) { spy.observe(b); });

  function curIdx() {
    var y = window.scrollY + 120, cur = 0;
    blocks.forEach(function (b, i) { if (b.offsetTop <= y) cur = i; });
    return cur;
  }
  function goto(i) {
    i = Math.max(0, Math.min(blocks.length - 1, i));
    blocks[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  var nav = document.createElement('div');
  nav.className = 'q-switch';
  nav.innerHTML = '<button id="q-prev" title="上一题（←）">↑ 上一题</button>' +
    '<button id="q-next" title="下一题（→）">↓ 下一题</button>';
  document.body.appendChild(nav);
  document.getElementById('q-prev').addEventListener('click', function () { goto(curIdx() - 1); });
  document.getElementById('q-next').addEventListener('click', function () { goto(curIdx() + 1); });
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') goto(curIdx() - 1);
    if (e.key === 'ArrowRight') goto(curIdx() + 1);
  });

  /* 回到顶部 */
  var top = document.getElementById('to-top');
  if (top) {
    window.addEventListener('scroll', function () {
      top.classList.toggle('show', window.scrollY > 600);
    });
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
})();