/* Secret Pip-Boy theme controller. Load synchronously in <head> (applies saved state before paint).
   Triggers: Konami code, or a double tap/click on the logo. Same triggers switch it back off.
   Exposes window.PipBoy = { active, set, onChange }. */
(function () {
  var VARIANTS = {
    green: "#1bff80",
    amber: "#ffb642",
    blue: "#4fd8ff",
  };
  var KEY = "em_pipboy"; // active variant name, absent when off
  var root = document.documentElement;
  var listeners = [];
  var booting = false;

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function active() { return root.classList.contains("pipboy"); }
  function variant() { for (var v in VARIANTS) if (root.classList.contains("pb-" + v)) return v; return null; }
  function reduced() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function emit() { listeners.forEach(function (fn) { try { fn(active()); } catch (e) {} }); }

  function restoreBaseTheme() {
    var saved = read("em_theme");
    var dark = saved ? saved === "dark" : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
  }

  function apply(v) {
    Object.keys(VARIANTS).forEach(function (k) { root.classList.remove("pb-" + k); });
    if (v && VARIANTS[v]) {
      root.classList.add("pipboy", "pb-" + v, "dark");
      write(KEY, v);
    } else {
      root.classList.remove("pipboy");
      write(KEY, null);
      restoreBaseTheme();
    }
    syncPicker();
  }

  // apply saved state immediately, before first paint
  var saved = read(KEY);
  if (saved && VARIANTS[saved]) apply(saved);

  function set(v, opts) {
    if (v && !active() && !(opts && opts.noBoot)) {
      apply(v);
      emit();
      boot(v);
      return;
    }
    apply(v);
    emit();
  }

  function toggle() { set(active() ? null : "blue"); }

  function syncPicker() {
    var host = document.querySelector(".header-right");
    var picker = document.querySelector(".pb-variants");
    var exit = document.querySelector(".pb-exit");
    if (!active()) { if (picker) picker.remove(); if (exit) exit.remove(); return; }
    if (!host) return;
    if (!picker) {
      picker = document.createElement("div");
      picker.className = "pb-variants";
      picker.setAttribute("role", "group");
      picker.setAttribute("aria-label", "Pip-Boy phosphor colour");
      Object.keys(VARIANTS).forEach(function (k) {
        var b = document.createElement("button");
        b.type = "button";
        b.dataset.variant = k;
        b.title = "Phosphor: " + k;
        b.setAttribute("aria-label", "Phosphor " + k);
        b.style.setProperty("--c", VARIANTS[k]);
        b.addEventListener("click", function () { set(k, { noBoot: true }); });
        picker.appendChild(b);
      });
      host.insertBefore(picker, host.firstChild);
    }
    if (!exit) {
      exit = document.createElement("button");
      exit.type = "button";
      exit.className = "pb-exit";
      exit.textContent = "[ EXIT ]";
      exit.title = "Leave the Pip-Boy terminal";
      exit.addEventListener("click", function () { set(null); });
      host.insertBefore(exit, picker.nextSibling); // right of the colour swatches
    }
    var cur = variant();
    picker.querySelectorAll("button").forEach(function (b) { b.classList.toggle("active", b.dataset.variant === cur); });
  }

  // ---- boot sequence ----
  // Real dataset numbers for the terminal screen, from the build-time /pb-stats.json.
  // Fetched lazily (warm() runs on the first trigger keystroke/tap), so normal visitors never request it.
  var statsPromise = null;
  function warm() {
    if (!statsPromise) {
      statsPromise = fetch("/pb-stats.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    return statsPromise;
  }

  function fmtInt(n) { return Math.round(n).toLocaleString("en-GB"); }
  function pad(str, n) { str = String(str); while (str.length < n) str += " "; return str; }
  function bar(pct) {
    var fill = Math.round((pct / 100) * 5), out = "";
    for (var i = 0; i < 5; i++) out += i < fill ? "#" : " ";
    return "[" + out + "]";
  }

  // Terminal device. t runs 0..1 and drives the count-up and bar fill. st null means the stats failed to load.
  function artLines(st, t) {
    var e = t * t * (3 - 2 * t);
    function row(text) { return "  | |" + pad(" " + text, 24) + "| |"; }
    function val(label, v) { return row(pad(label, 11) + v); }
    function pbar(label, pct) { return row(pad(label, 10) + bar(pct * e) + " " + ("   " + Math.round(pct * e)).slice(-3) + "%"); }
    var inner = st
      ? [
          val("EVENTS", fmtInt(st.events * e)),
          val("COUNTRIES", fmtInt(st.countries * e)),
          val("CITIES", fmtInt(st.cities * e)),
          val("NEXT 30D", fmtInt(st.soon * e)),
          pbar("MAJOR+", st.majorPct),
          pbar("EUROPE", st.europePct),
        ]
      : [val("EVENTS", "--"), val("COUNTRIES", "--"), val("CITIES", "--"), val("NEXT 30D", "--"), row("DATA LINK OFFLINE"), row("")];
    return [
      "  .----------------------------.",
      "  | .------------------------. |",
      row("PIP-BOY 3000 MK IV"),
    ].concat(inner, [
      "  | '------------------------' |",
      "  |  (o)   [STAT][INV][DATA]   |",
      "  '----------------------------'",
    ]);
  }

  function boot(v) {
    if (booting || !document.body) return;
    booting = true;
    var el = document.createElement("div");
    el.id = "pb-boot";
    el.setAttribute("role", "status");
    el.setAttribute("aria-label", "Pip-Boy terminal starting");
    var art = document.createElement("div");
    art.className = "art";
    var text = document.createElement("span");
    var cur = document.createElement("span");
    cur.className = "cur";
    var skip = document.createElement("span");
    skip.className = "skip";
    skip.textContent = "[ CLICK OR PRESS ANY KEY TO SKIP ]";
    el.appendChild(art);
    el.appendChild(text);
    el.appendChild(cur);
    el.appendChild(skip);
    document.body.appendChild(el);

    var done = false;
    var timer = null;
    var raf = 0;
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", finish, true);
      el.classList.add("out");
      setTimeout(function () { el.remove(); booting = false; }, 400);
    }
    el.addEventListener("click", finish);
    document.addEventListener("keydown", finish, true);

    // wait briefly for the stats; the boot still plays (with the screen offline) if they are slow or missing
    Promise.race([warm(), new Promise(function (res) { setTimeout(function () { res(null); }, 1200); })]).then(run);

    function run(st) {
      if (done) return;
      var lines = [
        "@ART",
        "",
        "ROBCO INDUSTRIES (TM) TERMLINK PROTOCOL",
        "COPYRIGHT 2075-2077 ROBCO INDUSTRIES",
        "",
        "> LOGON ADMIN",
        "> ENTER PASSWORD NOW",
        "> PASSWORD ACCEPTED",
        "",
        "LOADING TECH-EVENTS OS V7.1.0.8",
        "MOUNTING VAULT-TEC EVENT DATABASE ... OK",
        "SCANNING WASTELAND FOR CONFERENCES ... OK",
        "PHOSPHOR: " + String(v).toUpperCase(),
        "",
        "WELCOME, OVERSEER.",
      ];

      if (reduced()) {
        art.textContent = artLines(st, 1).join("\n");
        text.textContent = lines.slice(1).join("\n");
        timer = setTimeout(finish, 1200);
        return;
      }

      // ASCII device: frame prints a row at a time with empty meters, then the numbers count up and bars fill
      function playArt() {
        var shown = 0, total = artLines(st, 0).length;
        (function reveal() {
          if (done) return;
          shown++;
          art.textContent = artLines(st, 0).slice(0, shown).join("\n");
          if (shown < total) { timer = setTimeout(reveal, 45); return; }
          var t0 = performance.now(), DUR = 1600;
          (function tick(now) {
            if (done) return;
            var t = Math.min(1, (now - t0) / DUR);
            art.textContent = artLines(st, t).join("\n");
            if (t < 1) raf = requestAnimationFrame(tick);
          })(t0);
        })();
      }

      var li = 0, ci = 0;
      function step() {
        if (done) return;
        if (li >= lines.length) { timer = setTimeout(finish, 700); return; }
        var line = lines[li];
        if (line === "@ART") {
          playArt();
          li++;
          timer = setTimeout(step, 700); // text starts while the numbers are still counting
        } else if (ci < line.length) {
          text.textContent += line.charAt(ci++);
          timer = setTimeout(step, 5);
        } else {
          text.textContent += "\n";
          li++; ci = 0;
          timer = setTimeout(step, line.indexOf("PASSWORD NOW") > -1 ? 350 : 60);
        }
      }
      step();
    }
  }

  // ---- triggers ----
  var KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  var pos = 0;
  document.addEventListener("keydown", function (e) {
    if (booting) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === KONAMI[pos]) {
      pos++;
      if (pos === 1) warm();
      if (pos === KONAMI.length) { pos = 0; toggle(); }
    } else {
      pos = k === KONAMI[0] ? 1 : 0;
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    syncPicker();

    // double tap/click on the logo (mobile friendly). On the map page the link is a no-op, so the first tap is
    // swallowed. Elsewhere the first tap holds the navigation home briefly, so a second tap can still land.
    var logo = document.querySelector(".logo");
    var last = 0, navTimer = null;
    if (logo) {
      logo.addEventListener("click", function (e) {
        var now = Date.now();
        var second = now - last < 600;
        last = now;
        if (second) {
          e.preventDefault();
          clearTimeout(navTimer);
          last = 0;
          toggle();
          return;
        }
        warm();
        if (location.pathname !== "/") {
          e.preventDefault();
          navTimer = setTimeout(function () { location.href = logo.getAttribute("href") || "/"; }, 650);
        } else {
          e.preventDefault();
        }
      });
    }
  });

  window.PipBoy = {
    active: active,
    set: set,
    onChange: function (fn) { listeners.push(fn); },
  };
})();
