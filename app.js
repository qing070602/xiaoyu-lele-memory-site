(() => {
  "use strict";
  const C = window.SITE_CONFIG;
  const $ = selector => document.querySelector(selector);
  const routes = ["home", "timeline", "album", "letter"];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const gate = $("#gate"), app = $("#app"), main = $("#main"), dialog = $("#photo-dialog");
  let catMarkup = "", timelineData = null, unlocked = false, pageToken = 0, pageAnimation;
  let currentPhoto = 0, photoTrigger = null, dialogClosing = false, dialogToken = 0;
  const icons = {
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/>',
    timeline: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    album: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    letter: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    sparkles: '<path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7Zm7 0v4m-2-2h4"/>'
  };
  function el(tag, className = "", text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function icon(name) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    node.setAttribute("viewBox", "0 0 24 24"); node.setAttribute("fill", "none");
    node.setAttribute("stroke", "currentColor"); node.setAttribute("stroke-linecap", "round");
    node.setAttribute("stroke-linejoin", "round"); node.setAttribute("aria-hidden", "true");
    node.classList.add("icon"); node.innerHTML = icons[name]; return node;
  }
  function button(label, className, iconName) {
    const node = el("button", className); node.type = "button";
    if (iconName) node.append(icon(iconName));
    if (label) node.append(el("span", "", label));
    return node;
  }
  function iconButton(label, iconName) {
    const node = button("", "icon-button", iconName); node.setAttribute("aria-label", label); return node;
  }
  function format(template, values) {
    return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  }
  function dateLabel(value) {
    if (!value) return C.copy.unknownDate;
    const date = new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value);
    if (Number.isNaN(date.getTime())) return C.copy.unknownDate;
    return new Intl.DateTimeFormat("zh-CN", { timeZone: C.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replaceAll("/", ".");
  }
  function dayNumber(now = Date.now()) {
    const start = Date.parse(C.startDate);
    return Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 86400000) + 1) : null;
  }
  function session(value) {
    try {
      if (value === undefined) return sessionStorage.getItem(C.access.sessionKey) === "yes";
      if (value) sessionStorage.setItem(C.access.sessionKey, "yes"); else sessionStorage.removeItem(C.access.sessionKey);
    } catch { return false; }
  }
  function cat(className) {
    const node = el("div", className);
    // The source SVG is our own local illustration, not editable visitor input.
    if (catMarkup) node.innerHTML = catMarkup;
    else node.append(icon("heart"));
    node.setAttribute("aria-hidden", "true"); return node;
  }
  function heading(copy) {
    const node = el("div", "page-heading");
    node.append(el("p", "eyebrow", copy.eyebrow), el("h1", "", copy.title), el("p", "page-description", copy.description));
    return node;
  }
  function emptyState(text, iconName, action) {
    const node = el("div", "empty-state"); node.append(icon(iconName), el("p", "", text));
    if (action) { const retry = button(C.copy.retry, "primary-button"); retry.addEventListener("click", action); node.append(retry); }
    return node;
  }
  function buildHeader() {
    const brand = el("a", "brand"); brand.href = "#home"; brand.setAttribute("aria-label", C.copy.brand);
    const mark = el("span", "brand-mark"); mark.append(icon("heart"));
    const text = el("span", "brand-copy"); text.append(el("span", "brand-title", C.copy.brand), el("span", "brand-english", C.copy.brandEnglish));
    brand.append(mark, text);
    const lock = button(C.copy.lock, "lock-button", "lock"); lock.id = "lock-button"; lock.hidden = true;
    lock.setAttribute("aria-label", C.copy.lock); lock.addEventListener("click", lockApp);
    $("#site-header").append(brand, lock); $("#site-footer").textContent = C.copy.footer;
    const nav = $("#bottom-nav"); nav.setAttribute("aria-label", C.copy.brand);
    nav.append(el("span", "nav-indicator"));
    for (const route of routes) {
      const link = el("a", "nav-item"); link.href = `#${route}`; link.dataset.route = route;
      link.append(icon(route), el("span", "", C.copy.nav[route])); nav.append(link);
    }
  }
  function buildGate() {
    const copy = C.copy.gate, card = el("div", "gate-card"), title = el("h1", "", copy.title); title.id = "gate-title";
    card.append(cat("gate-cat"), el("p", "eyebrow", copy.eyebrow), title, el("p", "gate-description", copy.description));
    const form = el("form", "gate-form"), label = el("label", "", copy.label), input = el("input", "gate-input");
    label.htmlFor = "password"; input.id = "password"; input.type = "password"; input.autocomplete = "current-password";
    input.placeholder = copy.placeholder; input.required = true; input.setAttribute("aria-describedby", "gate-error gate-hint");
    const submit = button(copy.submit, "primary-button", "arrow"); submit.type = "submit";
    const error = el("p", "gate-error"); error.id = "gate-error"; error.setAttribute("aria-live", "polite");
    const hint = el("p", "gate-hint", copy.hint); hint.id = "gate-hint";
    form.append(label, input, submit, error); card.append(form, hint);
    gate.replaceChildren(card, el("p", "gate-signature", copy.signature));
    input.addEventListener("input", () => { error.textContent = ""; input.removeAttribute("aria-invalid"); });
    form.addEventListener("submit", async event => {
      event.preventDefault(); if (submit.disabled) return;
      if (input.value !== C.access.password) {
        error.textContent = copy.error; input.setAttribute("aria-invalid", "true"); input.focus();
        if (!reduced.matches) card.animate([{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }], { duration: 260 });
        return;
      }
      submit.disabled = true; session(true); unlocked = true;
      if (!reduced.matches) await gate.animate([{ opacity: 1, transform: "translateY(0) scale(1)" }, { opacity: 0, transform: "translateY(-8px) scale(.98)" }], { duration: 240 }).finished;
      gate.hidden = true; app.hidden = false; $("#lock-button").hidden = false; input.value = ""; submit.disabled = false;
      renderRoute(false);
    });
  }
  function lockApp() {
    pageToken++; pageAnimation?.cancel(); session(false); unlocked = false;
    if (dialog.open) { dialogToken++; dialog.close(); dialogClosing = false; }
    app.hidden = true; gate.hidden = false; $("#lock-button").hidden = true; main.replaceChildren();
    $("#password").value = ""; $("#gate-error").textContent = "";
    window.scrollTo({ top: 0, behavior: "instant" });
    if (!reduced.matches) gate.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 300 });
  }
  function buildHome() {
    const page = el("section", "home-grid"), copy = el("div", "home-copy"), title = el("div", "home-title");
    title.append(el("p", "eyebrow", C.copy.home.eyebrow), el("h1", "", C.copy.home.title), el("p", "home-subtitle", C.copy.home.subtitle));
    const pills = el("div", "couple-pills"); pills.append(el("span", "", C.couple.first), icon("heart"), el("span", "", C.couple.second)); title.append(pills);
    const details = el("div", "home-details"), counter = el("div", "counter-card");
    const number = el("p", "counter-number"), days = el("strong"); days.id = "days";
    number.append(el("small", "", C.copy.home.counterPrefix), days, el("small", "", C.copy.home.counterSuffix));
    const status = el("p", "counter-status"); status.id = "counter-status"; status.hidden = true;
    counter.append(el("p", "counter-label", C.copy.home.counterLabel), number, status, el("p", "counter-note", format(C.copy.home.counterNote, { date: dateLabel(C.startDate) })));
    const note = el("div", "home-note"); note.append(icon("heart"), el("p", "home-note-label", C.copy.home.quoteLabel), el("p", "", C.copy.home.quote));
    const link = el("a", "text-link", C.copy.home.albumLink); link.href = "#album"; link.append(icon("arrow"));
    details.append(counter, note, link); copy.append(title, details);
    const scene = el("div", "cat-scene"), catButton = button("", "cat-button");
    catButton.setAttribute("aria-label", C.copy.home.catLabel);
    if (catMarkup) catButton.innerHTML = catMarkup; else catButton.append(icon("heart"));
    const reply = el("span", "cat-reply", C.copy.home.catReply); scene.append(catButton, reply, el("p", "cat-hint", C.copy.home.catHint));
    for (const [kind, name] of [["one", "sparkles"], ["two", "heart"], ["three", "star"]]) {
      const sticker = el("span", `cat-sticker ${kind}`); sticker.setAttribute("aria-hidden", "true"); sticker.append(icon(name)); scene.append(sticker);
    }
    const stamp = el("span", "love-stamp", C.copy.home.loveStamp); stamp.setAttribute("aria-hidden", "true"); scene.append(stamp);
    let replyAnimation;
    catButton.addEventListener("click", () => {
      replyAnimation?.cancel();
      replyAnimation = reply.animate([{ opacity: 0, translate: "0 8px" }, { opacity: 1, translate: "0 0", offset: .15 }, { opacity: 1, offset: .75 }, { opacity: 0, translate: "0 -6px" }], { duration: reduced.matches ? 750 : 1600 });
      if (reduced.matches || scene.querySelectorAll(".heart-burst").length > 20) return;
      for (let i = 0; i < 6; i++) {
        const particle = el("span", "heart-burst"); particle.setAttribute("aria-hidden", "true"); particle.append(icon("heart")); scene.append(particle);
        const x = (i - 2.5) * 31 + Math.random() * 10, y = -65 - Math.random() * 85;
        const animation = particle.animate([{ opacity: 0, transform: "translate(-50%,0) scale(.4)" }, { opacity: .9, offset: .2 }, { opacity: 0, transform: `translate(${x}px,${y}px) scale(.8) rotate(${x / 2}deg)` }], { duration: 1000 + Math.random() * 350, easing: "ease-out" });
        animation.finished.then(() => particle.remove()).catch(() => particle.remove());
      }
    });
    page.append(copy, scene); return page;
  }
  async function buildTimeline() {
    const page = el("section"); page.append(heading(C.copy.timeline));
    try {
      if (!timelineData) {
        const response = await fetch("data/timeline.json"); if (!response.ok) throw new Error("timeline");
        timelineData = await response.json(); if (!Array.isArray(timelineData)) { timelineData = null; throw new Error("timeline"); }
      }
      if (!timelineData.length) { page.append(emptyState(C.copy.timeline.empty, "timeline")); return page; }
      const list = el("div", "timeline");
      timelineData.forEach((entry, i) => {
        const card = el("article", "timeline-card"); card.style.setProperty("--i", i);
        const meta = el("div", "card-meta"), date = el("time", "timeline-date", dateLabel(entry.date));
        if (entry.date) date.dateTime = entry.date;
        meta.append(date);
        if (entry.placeholder || i === 0) meta.append(el("span", "small-tag", entry.placeholder ? C.copy.exampleTag : C.copy.timeline.startTag));
        card.append(meta, el("h2", "", entry.title), el("p", "", entry.description)); list.append(card);
      });
      const end = el("p", "timeline-end"); end.append(icon("heart"), document.createTextNode(C.copy.timeline.endNote));
      page.append(list, end);
    } catch { page.append(emptyState(C.copy.timeline.error, "timeline", () => { timelineData = null; renderRoute(); })); }
    return page;
  }
  function setupPhoto(img, photo, onMissing) {
    img.alt = photo.alt; img.src = photo.src; img.decoding = "async";
    img.onerror = () => {
      img.onerror = null; img.alt = C.copy.album.missing; img.src = C.assets.fallbackPhoto;
      if (onMissing) onMissing();
    };
  }
  function buildAlbum() {
    const page = el("section"); page.append(heading(C.copy.album));
    if (!C.photos.length) { page.append(emptyState(C.copy.album.empty, "album")); return page; }
    const grid = el("div", "album-grid");
    C.photos.forEach((photo, i) => {
      const card = button("", "photo-card"); card.style.setProperty("--tilt", `${[-2, 2, -1, 1.5, -2, 2][i % 6]}deg`); card.style.setProperty("--i", i);
      card.setAttribute("aria-label", format(C.copy.album.view, { caption: photo.caption }));
      const image = el("img", "photo-image"); image.loading = "lazy"; image.width = 640; image.height = 480;
      const tag = el("span", "photo-tag", photo.placeholder ? C.copy.album.placeholder : "");
      setupPhoto(image, photo, () => { tag.textContent = C.copy.album.missing; });
      card.append(image, el("span", "photo-caption", photo.caption), tag);
      card.addEventListener("click", () => openPhoto(i, card)); grid.append(card);
    });
    page.append(grid); return page;
  }
  function buildLetter() {
    const page = el("section"); page.append(heading(C.copy.letter));
    const stage = el("div", "letter-stage"), envelope = button("", "envelope-button");
    envelope.setAttribute("aria-label", C.copy.letter.envelopeLabel); envelope.setAttribute("aria-expanded", "false"); envelope.setAttribute("aria-controls", "letter-drawer");
    const insert = el("span", "envelope-insert"); insert.append(el("span", "envelope-to", C.copy.letter.recipient));
    const seal = el("span", "envelope-seal"); seal.append(icon("heart"));
    envelope.append(el("span", "envelope-back"), insert, el("span", "envelope-front"), el("span", "envelope-flap"), seal, el("span", "envelope-stamp", C.copy.letter.stamp));
    const prompt = el("p", "envelope-prompt", C.copy.letter.open), drawer = el("div", "letter-drawer");
    drawer.id = "letter-drawer"; drawer.inert = true; drawer.setAttribute("aria-hidden", "true");
    const holder = el("div", "letter-holder"), paper = el("article", "letter-paper"), lines = el("div", "paper-lines");
    C.letter.paragraphs.forEach(line => lines.append(el("p", "", line)));
    paper.append(el("p", "paper-greeting", C.letter.greeting), lines, el("p", "paper-signature", C.letter.signature), el("p", "paper-date", C.copy.letter.dateLabel));
    holder.append(paper); drawer.append(holder);
    envelope.addEventListener("click", () => {
      const open = stage.classList.toggle("is-open"); drawer.classList.toggle("is-open", open); drawer.inert = !open;
      drawer.setAttribute("aria-hidden", String(!open)); envelope.setAttribute("aria-expanded", String(open)); prompt.textContent = open ? C.copy.letter.close : C.copy.letter.open;
    });
    stage.append(envelope, prompt, drawer); page.append(stage); return page;
  }
  function updateDays() {
    const target = $("#days"); if (!target) return;
    const count = dayNumber(), valid = count !== null && count > 0, status = $("#counter-status");
    target.parentElement.hidden = !valid; status.hidden = valid;
    if (valid) target.textContent = count;
    else status.textContent = count === null ? C.copy.home.invalidDate : C.copy.home.beforeStart;
  }
  function currentRoute() {
    const route = location.hash.slice(1); if (routes.includes(route)) return route;
    history.replaceState(null, "", `${location.pathname}${location.search}#home`); return "home";
  }
  async function renderRoute(animate = true) {
    if (!unlocked) return;
    const route = currentRoute(), token = ++pageToken; pageAnimation?.cancel();
    for (const item of document.querySelectorAll(".nav-item")) {
      if (item.dataset.route === route) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
    }
    $(".nav-indicator").style.transform = `translateX(${routes.indexOf(route) * 100}%)`;
    if (animate && !reduced.matches && main.childElementCount) {
      pageAnimation = main.animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-7px)" }], { duration: 150, fill: "forwards" });
      try { await pageAnimation.finished; } catch { return; }
    }
    const page = route === "home" ? buildHome() : route === "timeline" ? await buildTimeline() : route === "album" ? buildAlbum() : buildLetter();
    if (token !== pageToken || !unlocked) return;
    pageAnimation?.cancel(); main.replaceChildren(page); updateDays(); window.scrollTo({ top: 0, behavior: "instant" });
    if (!reduced.matches) pageAnimation = main.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: "cubic-bezier(.2,.7,.2,1)" });
    main.focus({ preventScroll: true });
  }
  function buildDialog() {
    const top = el("div", "dialog-top"), count = el("span", "dialog-count"), close = iconButton(C.copy.album.close, "close"); count.id = "dialog-count";
    top.append(count, close); const image = el("img", "dialog-image"); image.id = "dialog-image";
    const bottom = el("div", "dialog-bottom"), previous = iconButton(C.copy.album.previous, "left"), next = iconButton(C.copy.album.next, "right"), caption = el("p", "dialog-caption");
    caption.id = "dialog-caption"; bottom.append(previous, caption, next);
    dialog.setAttribute("aria-labelledby", "dialog-caption"); dialog.append(top, image, bottom, el("p", "swipe-hint", C.copy.album.swipeHint));
    close.addEventListener("click", closePhoto); previous.addEventListener("click", () => changePhoto(-1)); next.addEventListener("click", () => changePhoto(1));
    dialog.addEventListener("cancel", event => { event.preventDefault(); closePhoto(); });
    dialog.addEventListener("click", event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePhoto(); } });
    dialog.addEventListener("keydown", event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); changePhoto(event.key === "ArrowLeft" ? -1 : 1); } });
    let start;
    image.addEventListener("pointerdown", event => { start = { x: event.clientX, y: event.clientY }; });
    image.addEventListener("pointerup", event => { if (!start) return; const dx = event.clientX - start.x, dy = event.clientY - start.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) changePhoto(dx < 0 ? 1 : -1); start = null; });
    image.addEventListener("pointercancel", () => { start = null; });
  }
  function showPhoto() {
    const photo = C.photos[currentPhoto]; setupPhoto($("#dialog-image"), photo);
    $("#dialog-caption").textContent = photo.caption;
    $("#dialog-count").textContent = format(C.copy.album.count, { current: currentPhoto + 1, total: C.photos.length });
  }
  function openPhoto(index, trigger) {
    currentPhoto = index; photoTrigger = trigger; dialogClosing = false; dialogToken++; showPhoto(); dialog.showModal();
  }
  function changePhoto(offset) {
    if (dialogClosing || !C.photos.length) return;
    currentPhoto = (currentPhoto + offset + C.photos.length) % C.photos.length; showPhoto();
    if (!reduced.matches) $("#dialog-image").animate([{ opacity: .4, transform: `translateX(${offset > 0 ? 8 : -8}px)` }, { opacity: 1, transform: "none" }], { duration: 220 });
  }
  async function closePhoto() {
    if (!dialog.open || dialogClosing) return; dialogClosing = true; const token = ++dialogToken;
    if (!reduced.matches) await dialog.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(10px) scale(.97)" }], { duration: 180 }).finished;
    if (token !== dialogToken) return;
    dialog.close(); dialogClosing = false; if (photoTrigger?.isConnected) photoTrigger.focus({ preventScroll: true });
  }
  async function init() {
    document.title = C.title; document.querySelector('meta[name="description"]').content = C.description;
    gate.textContent = C.copy.loading;
    try { const response = await fetch(C.assets.cat); if (response.ok) catMarkup = await response.text(); } catch { /* Keep the rest of the little home usable. */ }
    buildHeader(); buildGate(); buildDialog(); unlocked = session(); currentRoute();
    if (unlocked) { gate.hidden = true; app.hidden = false; $("#lock-button").hidden = false; renderRoute(false); }
    window.addEventListener("hashchange", () => { if (dialog.open) { dialogToken++; dialog.close(); dialogClosing = false; } renderRoute(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) updateDays(); });
    setInterval(updateDays, 1000);
  }
  init();
})();
