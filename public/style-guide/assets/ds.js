/* NFF Design System docs — shared shell: sidebar nav, theme toggle.
   Each page ships only <main class="ds-content" data-ds-page="KEY">…</main>;
   this script wraps it in the shell so nav lives in ONE place.
   When embedded in the app (?embed=1) the app owns the theme + chrome: we
   hide the doc topbar and follow the app's theme key (shared, same-origin). */
(function () {
  var NAV = [
    { group: "Start", items: [
      { key: "index", label: "Overview", href: "index.html" },
      { key: "principles", label: "Principles", href: "index.html#principles" },
    ] },
    { group: "Foundations", items: [
      { key: "color", label: "Color", href: "foundations.html#color" },
      { key: "type", label: "Typography", href: "foundations.html#type" },
      { key: "space", label: "Shape & space", href: "foundations.html#space" },
      { key: "motion", label: "Motion", href: "foundations.html#motion" },
      { key: "voice", label: "Voice", href: "foundations.html#voice" },
    ] },
    { group: "Components", items: [
      { key: "components", label: "All components", href: "components.html" },
    ] },
    { group: "Patterns", items: [
      { key: "patterns", label: "All patterns", href: "patterns.html" },
    ] },
    { group: "Voice", items: [
      { key: "voice-guide", label: "Tone & voice", href: "voice.html" },
    ] },
  ];

  var EMBED = /[?&]embed=1\b/.test(location.search);
  var APP_KEY = "nff-theme";     // the app's localStorage key (index.html boot)
  var DOC_KEY = "nff-ds-theme";  // standalone key
  var KEY = EMBED ? APP_KEY : DOC_KEY;

  function readTheme() {
    if (EMBED) {
      // Same-origin: match the host app's live theme exactly.
      try {
        var pt = window.parent.document.documentElement.getAttribute("data-theme");
        if (pt) return pt;
      } catch (e) {}
    }
    try { return localStorage.getItem(KEY) || "light"; } catch (e) { return "light"; }
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    if (!EMBED) { try { localStorage.setItem(DOC_KEY, t); } catch (e) {} }
    document.querySelectorAll(".ds-toggle button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.theme === t ? "true" : "false");
    });
  }

  function navHref(href) {
    // Preserve ?embed=1 across in-doc navigation so sub-pages stay embedded.
    if (!EMBED) return href;
    var hash = "";
    var h = href.indexOf("#");
    if (h !== -1) { hash = href.slice(h); href = href.slice(0, h); }
    return href + (href.indexOf("?") === -1 ? "?embed=1" : "&embed=1") + hash;
  }

  function build() {
    var main = document.querySelector("main.ds-content");
    var pageKey = main ? main.getAttribute("data-ds-page") : "";

    var shell = document.createElement("div");
    shell.className = "ds-shell";

    var nav = document.createElement("nav");
    nav.className = "ds-nav";
    var html = '<div class="ds-brand">NFF</div>' +
      '<div class="ds-brand-sub">Design system</div>';
    NAV.forEach(function (g) {
      html += '<div class="ds-navgroup">' + g.group + "</div>";
      g.items.forEach(function (it) {
        var active = it.key === pageKey ? ' class="active"' : "";
        html += '<a href="' + navHref(it.href) + '"' + active + ">" +
          it.label + "</a>";
      });
    });
    nav.innerHTML = html;

    var col = document.createElement("div");
    col.className = "ds-main";

    if (!EMBED) {
      var bar = document.createElement("div");
      bar.className = "ds-topbar";
      bar.innerHTML =
        '<span class="ds-eyebrow">Theme</span>' +
        '<div class="ds-toggle">' +
        '<button data-theme="light">Light</button>' +
        '<button data-theme="dark">Dark</button>' +
        "</div>";
      col.appendChild(bar);
    }

    main.parentNode.removeChild(main);
    col.appendChild(main);
    shell.appendChild(nav);
    shell.appendChild(col);
    document.body.appendChild(shell);

    col.querySelectorAll(".ds-toggle button").forEach(function (b) {
      b.addEventListener("click", function () { applyTheme(b.dataset.theme); });
    });
    applyTheme(readTheme());

    // Embedded: live-follow the app theme when it changes in another frame.
    if (EMBED) {
      window.addEventListener("storage", function (e) {
        if (e.key === APP_KEY && e.newValue) applyTheme(e.newValue);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else { build(); }
})();
