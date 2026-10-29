(() => {
  "use strict";
  const dialog = document.querySelector("#editor-dialog"), copy = window.SITE_CONFIG.copy.shared;
  let busy = false, closing = false, previewUrl, trigger;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }
  async function close() {
    if (busy || closing || !dialog.open) return;
    closing = true;
    if (!reduced.matches) {
      try { await dialog.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(16px) scale(.98)" }], { duration: 180 }).finished; } catch { /* A forced sign-out can cancel the animation. */ }
    }
    reset();
  }
  function reset() {
    dialog.close(); dialog.replaceChildren(); closing = false; busy = false;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    else document.querySelector("#main")?.focus({ preventScroll: true });
  }
  function open({ title, fields, save, submitLabel=copy.save, hint=copy.editHint }) {
    if (dialog.open) return;
    trigger = document.activeElement;
    const form = node("form", "editor-form"), heading = node("h2", "", title); heading.id = "editor-heading";
    form.append(heading, node("p", "editor-hint", hint));
    const inputs = new Map();
    for (const field of fields) {
      const wrapper = node("div", "editor-field"), label = node("label", "", field.label);
      const input = node(field.type === "textarea" ? "textarea" : "input", "editor-input");
      input.id = `editor-${field.name}`; input.name = field.name; label.htmlFor = input.id;
      if (field.type === "textarea") input.rows = field.rows || 4; else input.type = field.type || "text";
      if (field.type !== "file") input.value = field.value || "";
      if (field.max) input.maxLength = field.max;
      input.required = field.required !== false;
      if (field.type === "file") {
        input.accept = "image/jpeg,image/png,image/webp";
        const preview = node("img", "upload-preview"); preview.alt = copy.photo; preview.hidden = true;
        input.addEventListener("change", () => {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          const file = input.files[0]; preview.hidden = !file;
          previewUrl = file ? URL.createObjectURL(file) : null;
          if (previewUrl) preview.src = previewUrl; else preview.removeAttribute("src");
        });
        wrapper.append(label, input, node("p", "editor-hint", copy.photoHint), preview);
      } else wrapper.append(label, input);
      inputs.set(field.name, input); form.append(wrapper);
    }
    const error = node("p", "editor-error"); error.setAttribute("role", "alert");
    const actions = node("div", "editor-actions"), cancel = node("button", "secondary-button", copy.cancel), submit = node("button", "primary-button", submitLabel);
    cancel.type = "button"; submit.type = "submit"; cancel.addEventListener("click", close);
    actions.append(cancel, submit); form.append(error, actions); dialog.replaceChildren(form);
    form.addEventListener("submit", async event => {
      event.preventDefault(); if (busy || closing) return;
      busy = true; error.textContent = ""; submit.textContent = copy.saving;
      for (const input of inputs.values()) input.disabled = true;
      submit.disabled = true; cancel.disabled = true;
      const values = {};
      for (const [name, input] of inputs) values[name] = input.type === "file" ? input.files[0] : input.value.trim();
      try { await save(values); busy = false; await close(); }
      catch (problem) { error.textContent = window.MemoryCloud.message(problem); }
      finally {
        busy = false; submit.disabled = false; cancel.disabled = false; submit.textContent = submitLabel;
        for (const input of inputs.values()) input.disabled = false;
      }
    });
    dialog.showModal();
    if (!reduced.matches) dialog.animate([{ opacity: 0, transform: "translateY(18px) scale(.98)" }, { opacity: 1, transform: "none" }], { duration: 240, easing: "ease-out" });
  }
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  window.MemoryEditor = { open, close, reset, isOpen: () => dialog.open };
})();
