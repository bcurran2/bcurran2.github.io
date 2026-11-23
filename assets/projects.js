// Builds the project list from projects.json (written daily from pinned repositories)
// plus hand-written overrides in project-extras.json. If either file is missing,
// the static project cards already in the page stay as they are.
(function () {
  var list = document.getElementById('project-list');
  if (!list || !window.fetch) return;

  var NAMES = {
    'bigquery': 'BigQuery', 'dbt': 'dbt', 'github-actions': 'GitHub Actions', 'power-bi': 'Power BI',
    'powerbi': 'Power BI', 'tableau': 'Tableau', 'python': 'Python', 'sql': 'SQL', 'pandas': 'pandas',
    'numpy': 'NumPy', 'matplotlib': 'Matplotlib', 'jupyter': 'Jupyter', 'jupyter-notebook': 'Jupyter',
    'pytest': 'pytest', 'etl': 'ETL', 'api': 'API', 'postgresql': 'PostgreSQL', 'javascript': 'JavaScript'
  };

  // One image: a single figure. Two or more: a slideshow that rotates, with
  // dots to pick a slide. It pauses on hover/focus and when motion is reduced.
  function gallery(images) {
    var wrap = el('div', 'gallery');
    var stage = el('div', 'stage');
    var slides = images.map(function (im, i) {
      var a = el('a', 'slide' + (i === 0 ? ' on' : ''));
      a.href = im.src; a.target = '_blank'; a.rel = 'noopener';
      var img = el('img');
      img.src = im.src; img.alt = im.alt || ''; if (i) img.loading = 'lazy';
      a.appendChild(img);
      stage.appendChild(a);
      return a;
    });
    wrap.appendChild(stage);
    var cap = el('p', 'cap', images[0].caption || '');
    cap.setAttribute('aria-live', 'off');
    wrap.appendChild(cap);
    if (images.length < 2) return wrap;

    var cur = 0, timer = null, dots = el('div', 'dots');
    var buttons = images.map(function (im, i) {
      var b = el('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Show image ' + (i + 1) + ' of ' + images.length + ': ' + (im.caption || ''));
      b.addEventListener('click', function () { show(i); start(); });
      dots.appendChild(b);
      return b;
    });
    function show(i) {
      slides[cur].classList.remove('on'); buttons[cur].classList.remove('on');
      cur = i;
      slides[cur].classList.add('on'); buttons[cur].classList.add('on');
      cap.textContent = images[cur].caption || '';
    }
    buttons[0].classList.add('on');
    wrap.appendChild(dots);

    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      stop();
      if (still) return;
      timer = setInterval(function () { if (!document.hidden) show((cur + 1) % slides.length); }, 5000);
    }
    wrap.addEventListener('mouseenter', stop);
    wrap.addEventListener('mouseleave', start);
    wrap.addEventListener('focusin', stop);
    wrap.addEventListener('focusout', start);
    start();
    return wrap;
  }

  function pretty(topic) {
    if (NAMES[topic]) return NAMES[topic];
    return topic.split('-').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
  }

  var ACRONYMS = { eia: 'EIA', github: 'GitHub', ai: 'AI', dc: 'DC', api: 'API', sql: 'SQL', etl: 'ETL', dbt: 'dbt', bi: 'BI' };

  function titleFrom(name) {
    return name.split(/[-_]/).map(function (w) {
      return ACRONYMS[w.toLowerCase()] || w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  function safeUrl(u) { return typeof u === 'string' && /^https:\/\//.test(u) ? u : null; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function linkLabel(url) {
    if (url.indexOf('public.tableau.com') !== -1) return 'Tableau dashboard';
    if (url.indexOf('colab.research.google.com') !== -1) return 'Open in Colab';
    return 'Website';
  }

  function card(p, x) {
    var box = el('div', 'project');
    box.appendChild(el('h3', null, x.title || titleFrom(p.name)));
    var summary = x.summary || p.description;
    if (summary) box.appendChild(el('p', null, summary));
    if (x.images && x.images.length) box.appendChild(gallery(x.images));
    if (x.flow && x.flow.steps) {
      var flow = el('div', 'flow');
      flow.appendChild(el('p', 'flow-title', x.flow.title || ''));
      var ol = el('ol');
      x.flow.steps.forEach(function (s, i) {
        ol.appendChild(el('li', i === x.flow.steps.length - 1 ? 'end' : null, s));
      });
      flow.appendChild(ol);
      box.appendChild(flow);
    }
    var tools = x.tools || (p.topics || []).map(pretty);
    if (tools.length) {
      var ul = el('ul', 'tools');
      ul.setAttribute('aria-label', 'Tools used');
      tools.forEach(function (t) { ul.appendChild(el('li', null, t)); });
      box.appendChild(ul);
    }
    var links = x.links;
    if (!links) {
      links = [{ label: 'Repository', url: p.url }];
      if (p.homepage) links.push({ label: linkLabel(p.homepage), url: p.homepage });
    }
    var wrap = el('p', 'plinks');
    links.forEach(function (l) {
      var u = safeUrl(l.url);
      if (!u) return;
      var a = el('a', null, l.label);
      a.href = u;
      wrap.appendChild(a);
    });
    box.appendChild(wrap);
    return box;
  }

  function get(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  Promise.all([get('projects.json'), get('project-extras.json')]).then(function (res) {
    var data = res[0], extras = res[1] || {};
    if (!data || !data.projects || !data.projects.length) return;
    var frag = document.createDocumentFragment();
    data.projects.forEach(function (p) {
      if (!p || !p.name || !safeUrl(p.url)) return;
      frag.appendChild(card(p, extras[p.name] || {}));
    });
    if (!frag.childNodes.length) return;
    list.textContent = '';
    list.appendChild(frag);
  });
})();
