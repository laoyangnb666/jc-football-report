/* ============================================================
   jc-football-report · 全站双语引擎（zh ⇄ en）
   设计：中文为源语言；英文在运行时替换文本节点 / data-i18n 块。
   - 静态文案：短标签走词典精确匹配，长段落走 data-i18n
   - 动态文案：MutationObserver 监听页面脚本插入的节点，走正则规则
   - 切换：导航右侧按钮，写入 localStorage 后整页重载（保证状态一致）
   ============================================================ */
(function () {
  var KEY = 'jc-lang';
  var LANG = localStorage.getItem(KEY) === 'en' ? 'en' : 'zh';
  var DICT = {};      // 精确文本 → 英文
  var HTML = {};      // data-i18n 键 → 英文 HTML
  var RULES = [];     // [RegExp, 替换串 / 替换函数]
  var PHRASES = [];   // [中文片段, 英文片段]，按长度降序做子串替换（兜底动态长句）
  var applying = false;

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  /* ---------- 词典注册 ---------- */
  function extend(pack) {
    if (pack.dict) for (var k in pack.dict) DICT[k] = pack.dict[k];
    if (pack.html) for (var h in pack.html) HTML[h] = pack.html[h];
    if (pack.rules) for (var i = 0; i < pack.rules.length; i++) RULES.push(pack.rules[i]);
    if (pack.phrases) for (var j = 0; j < pack.phrases.length; j++) PHRASES.push(pack.phrases[j]);
    if (pack.phrases) PHRASES.sort(function (a, b) { return b[0].length - a[0].length; });
  }

  function applyPhrases(s) {
    var out = s, hit = false;
    for (var i = 0; i < PHRASES.length; i++) {
      var zh = PHRASES[i][0];
      if (out.indexOf(zh) !== -1) {
        out = out.split(zh).join(PHRASES[i][1]);
        hit = true;
      }
    }
    if (!hit) return null;
    /* 仅在确实命中中文词后，才把中文标点规整为英文标点 */
    return out.replace(/（/g, ' (').replace(/）/g, ')').replace(/，/g, ', ').replace(/；/g, '; ');
  }

  function translateText(raw) {
    var key = norm(raw);
    if (!key) return null;
    if (DICT[key] !== undefined) return DICT[key];
    var base = key;
    for (var i = 0; i < RULES.length; i++) {
      var re = RULES[i][0];
      if (re.test(base)) {
        var out = base.replace(re, RULES[i][1]);
        if (out !== base && out !== null) { base = out; break; }
      }
    }
    if (base !== key && !/[\u4e00-\u9fff]/.test(base)) return base;
    var phrased = applyPhrases(base);
    if (phrased !== null) return phrased;
    return base !== key ? base : null;
  }

  var SKIP = /^(SCRIPT|STYLE|PRE|CODE|TEXTAREA|SVG|CANVAS)$/i;
  var ATTRS = ['title', 'placeholder', 'aria-label'];

  function inSkipped(p) {
    while (p && p.nodeType === 1) {
      if (SKIP.test(p.tagName)) return true;
      if (p.hasAttribute && p.hasAttribute('data-i18n')) return true;
      p = p.parentNode;
    }
    return false;
  }

  function walkText(node) {
    if (!node || node.nodeType !== 3) return;
    var p = node.parentNode;
    if (!p || inSkipped(p)) return;
    var raw = node.nodeValue;
    if (!raw || !/\S/.test(raw)) return;

    if (LANG === 'en') {
      if (node.__en) return;
      var t = translateText(raw);
      if (t === null) return;
      var lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
      node.__zh = raw;
      node.nodeValue = lead + t + trail;
      node.__en = true;
    } else if (node.__en) {
      node.nodeValue = node.__zh;
      node.__en = false;
    }
  }

  function walkAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute && el.getAttribute(a);
      if (!v) continue;
      var slot = '__attr_' + a;
      if (LANG === 'en') {
        if (el[slot] !== undefined) continue;
        var t = translateText(v);
        if (t === null) continue;
        el[slot] = v;
        el.setAttribute(a, t);
      } else if (el[slot] !== undefined) {
        el.setAttribute(a, el[slot]);
        delete el[slot];
      }
    }
  }

  function applyBlock(el) {
    var k = el.getAttribute('data-i18n');
    if (LANG === 'en') {
      if (el.__zhHTML === undefined) el.__zhHTML = el.innerHTML;
      if (HTML[k] !== undefined) el.innerHTML = HTML[k];
    } else if (el.__zhHTML !== undefined) {
      el.innerHTML = el.__zhHTML;
    }
  }

  function walkDeep(n) {
    if (!n) return;
    if (n.nodeType === 3) return walkText(n);
    if (n.nodeType !== 1) return;
    if (SKIP.test(n.tagName)) return;
    if (n.hasAttribute && n.hasAttribute('data-i18n')) { applyBlock(n); return; }
    walkAttrs(n);
    var tw = document.createTreeWalker(n, NodeFilter.SHOW_TEXT, null);
    var arr = [], t;
    while ((t = tw.nextNode())) arr.push(t);
    for (var i = 0; i < arr.length; i++) walkText(arr[i]);
  }

  /* ---------- 监听动态内容 ---------- */
  function startObserver() {
    if (!window.MutationObserver) return;
    var mo = new MutationObserver(function (muts) {
      if (applying) return;
      applying = true;
      try {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type === 'characterData') walkText(m.target);
          else if (m.type === 'childList') {
            for (var j = 0; j < m.addedNodes.length; j++) walkDeep(m.addedNodes[j]);
          } else if (m.type === 'attributes' && m.target.nodeType === 1) {
            walkAttrs(m.target);
          }
        }
      } finally { applying = false; }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ATTRS });
  }

  /* ---------- 语言按钮 ---------- */
  function injectToggle() {
    var host = document.querySelector('.nav-links');
    if (!host || host.querySelector('.lang-switch')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'lang-switch';
    b.textContent = LANG === 'en' ? '中文' : 'EN';
    b.setAttribute('title', LANG === 'en' ? 'Switch to Chinese' : '切换为英文');
    b.setAttribute('aria-label', LANG === 'en' ? 'Switch to Chinese' : 'Switch to English');
    b.addEventListener('click', function () {
      localStorage.setItem(KEY, LANG === 'en' ? 'zh' : 'en');
      location.reload();
    });
    host.appendChild(b);
  }

  function injectStyle() {
    if (document.getElementById('i18n-style')) return;
    var s = document.createElement('style');
    s.id = 'i18n-style';
    s.textContent = [
      '.lang-switch{margin-left:14px;padding:6px 13px;border-radius:999px;border:1px solid rgba(20,40,30,.22);',
      'background:transparent;color:inherit;font:inherit;font-size:11.5px;font-weight:500;letter-spacing:.08em;',
      'cursor:pointer;transition:background .18s,border-color .18s,color .18s;line-height:1.4}',
      '.lang-switch:hover{background:rgba(20,40,30,.07);border-color:rgba(20,40,30,.4)}',
      '@media(max-width:760px){.lang-switch{margin-left:8px;padding:5px 10px;font-size:11px}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ---------- 启动 ---------- */
  function boot() {
    injectStyle();
    injectToggle();
    if (LANG === 'en') {
      document.documentElement.lang = 'en';
      var tk = DICT[norm(document.title)];
      if (tk) document.title = tk;
    }
    var blocks = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < blocks.length; i++) applyBlock(blocks[i]);
    walkDeep(document.body);
    startObserver();
    // 页面脚本可能在本轮事件循环末尾再写入一次
    setTimeout(function () { walkDeep(document.body); }, 60);
    setTimeout(function () { walkDeep(document.body); }, 400);
  }

  /* ============================================================
     公共词典（导航 / 页脚 / 通用标签）
     ============================================================ */
  extend({
    dict: {
      /* 导航 */
      '首页': 'Home',
      'Skill 文档': 'Skill Docs',
      '模拟投注': 'Simulator',
      '21 点': 'Blackjack',
      '回测': 'Backtest',
      '数据源': 'Sources',
      '仓库': 'Repo',
      'GitHub 仓库': 'GitHub',
      '查看仓库': 'View repo',
      '阅读 Skill 文档': 'Read the Skill docs',
      '打开模拟投注': 'Open the simulator',
      'Institutional pricing': 'Institutional pricing',
      'Institutional pricing · Open source': 'Institutional pricing · Open source',

      /* 表头 / 通用词 */
      '编号': 'No.',
      '对阵': 'Match',
      '开赛': 'Kick-off',
      '让': 'Hcp',
      '胜平负': '1X2',
      '总进球': 'Goals',
      '级别': 'Level',
      '方案': 'Plan',
      '口径': 'Metric',
      '命中': 'Hit',
      '四轮累计': '4-round',
      '结论': 'Note',
      '篇': 'Part',
      '章节': 'Section',
      '内容': 'Contents',
      '条件': 'Condition',
      '理由模板': 'Reason',
      '玩法': 'Market',
      '含义': 'Meaning',
      '仓位': 'Stake',
      '函数': 'Function',
      '作用': 'Purpose',
      '串关': 'Parlay',
      '返还率': 'Return',
      '说明': 'Notes',
      '文件': 'File',
      '步骤': 'Step',
      '要点': 'Key points',
      '层': 'Layer',
      '源': 'Source',
      '取什么': 'What we take',
      '边界': 'Boundary',
      '参考文件': 'References',
      '目录': 'Contents',
      '备注': 'Notes',
      '数据源': 'Sources',
      '方法论': 'Method',
      '报告产出': 'Reports',
      '回测校准': 'Backtest calibration',
      '本轮在售': 'On sale now',

      /* 判定级别 */
      '主推': 'Strong pick',
      '小注': 'Small stake',
      '观察': 'Watch',
      '回避': 'Avoid',
      '关注': 'Watch',
      '观望': 'Hold',
      '中性': 'Neutral',
      '不推荐': 'No bet',
      '预测': 'Forecast',

      /* 玩法方向 */
      '主胜': 'Home',
      '平局': 'Draw',
      '客胜': 'Away',
      '双方进球': 'BTTS',
      '大 2.5': 'Over 2.5',
      '小 2.5': 'Under 2.5',
      '球': 'goals',

      /* 页脚 */
      '本页面为统计方法的模拟演示，使用虚拟资金，不涉及任何真实交易。': 'This page is a statistical simulation using virtual funds. No real transactions are involved.'
    },
    html: {
      'common.footDisc': 'This project is an open-source implementation of statistical pricing methodology, for research and study only. All probabilities are model and market estimates. <b>Nothing here is betting advice, and no returns are promised.</b> Backtest samples are limited, with standard errors of 8–10pp; any deviation below 15pp is not statistically significant. Gambling carries extreme risk — you may lose your entire stake. Follow the laws of your jurisdiction; under-18s may not participate.',
      'common.simDisc': 'This page is a statistical simulation using virtual funds. No real transactions are involved. <b>Nothing here is betting advice.</b> All probabilities are model and market estimates; China Sports Lottery margins are about 13.9%, so long-run expectation is negative. Gambling carries extreme risk — you may lose your entire stake. Follow the laws of your jurisdiction; under-18s may not participate.'
    },
    phrases: [
      /* 长词优先（引擎会再按长度排序） */
      ['让球胜平负', 'Handicap 1X2'],
      ['胜平负', '1X2'],
      ['双方进球', 'BTTS'],
      ['总进球', 'Goals'],
      ['比分', 'Score'],
      ['让球', 'Handicap'],
      ['主胜', 'Home'],
      ['客胜', 'Away'],
      ['平局', 'Draw'],
      ['主推', 'Strong'],
      ['小注', 'Small'],
      ['观察', 'Watch'],
      ['回避', 'Avoid'],
      ['不参与', 'No bet'],
      ['大 2.5', 'Over 2.5'],
      ['小 2.5', 'Under 2.5'],
      /* 当期数据：联赛与球队 */
      ['英锦标赛', 'EFL Trophy'],
      ['伯顿', 'Burton'],
      ['诺茨郡', 'Notts County'],
      ['布罗姆利', 'Bromley'],
      ['米尔顿', 'Milton Keynes'],
      ['谢周三', 'Sheffield Wed'],
      ['阿克宁顿', 'Accrington'],
      ['阿克灵顿', 'Accrington'],
      ['巴恩斯利', 'Barnsley'],
      ['奥德汉姆', 'Oldham'],
      /* 单位：只在前面带空格时替换，避免误伤「让球」 */
      [' 球 ', ' goals '],
      [' 球', ' goals']
    ]
  });

  window.I18N = {
    lang: LANG,
    extend: extend,
    t: translateText,
    refresh: function () { walkDeep(document.body); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();