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

  /* ---------- 首页：章节进度 ---------- */
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
    return; // 首页无需以下章节页逻辑
  }

  /* ---------- 章节页 ---------- */
  var meta = window.CHAPTER_META || {};
  var content = document.getElementById('content');

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
  window.addEventListener('load', function () { if (!content.querySelector('.katex')) renderMath(); });

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
      var cid = btn.dataset.cid, no = +btn.dataset.no;
      var arr = prog[cid] || [];
      var i = arr.indexOf(no);
      if (i === -1) arr.push(no); else arr.splice(i, 1);
      prog[cid] = arr;
      saveProg(prog);
      syncDoneUI();
    });
  });
  syncDoneUI();

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