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
    if (x.images && x.images.length) {
      var shots = el('div', 'shots');
      x.images.forEach(function (im) {
        var a = el('a');
        a.href = im.src; a.target = '_blank'; a.rel = 'noopener';
        var img = el('img');
        img.src = im.src; img.alt = im.alt || ''; img.loading = 'lazy';
        a.appendChild(img);
        if (im.caption) a.appendChild(el('span', null, im.caption));
        shots.appendChild(a);
      });
      box.appendChild(shots);
    }
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
