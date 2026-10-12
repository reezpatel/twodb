// In-meeting control. Renders the shared recording state from
// chrome.storage.local ("rec") — the same state the popup, context menu and
// toolbar badge use — so it always agrees with them. Shadow DOM keeps the
// meeting page's styles out.

(() => {
  if (window.__twodbRecorderInjected) return;
  window.__twodbRecorderInjected = true;

  const ICON = {
    record: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    screen: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
    open: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  };
  const icon = (name, size = 14) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const clock = (ms) => {
    const t = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(t / 3600);
    const mm = String(Math.floor((t % 3600) / 60)).padStart(h ? 2 : 1, "0");
    return `${h ? `${h}:` : ""}${mm}:${String(t % 60).padStart(2, "0")}`;
  };

  const host = document.createElement("div");
  host.id = "twodb-recorder-host";
  host.style.cssText = "position:fixed;z-index:2147483647;top:16px;right:16px;";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; }
    .root { --bg: oklch(0.196 0 0 / 0.94); --fg: oklch(0.833 0.009 301.3); --muted: oklch(0.698 0.015 299.7);
      --border: oklch(0.27 0.005 286); --accent: oklch(0.244 0 0); --primary: oklch(0.734 0.067 295.7);
      --primary-fg: oklch(0.187 0 0); --destructive: oklch(0.731 0.131 359.7); --success: oklch(0.749 0.058 156.9);
      --warning: oklch(0.819 0.065 53.5);
      font: 500 13px/1.2 "Outfit Variable", "Outfit", ui-sans-serif, system-ui, sans-serif; color: var(--fg);
      display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .bar { display: flex; align-items: center; gap: 4px; padding: 4px; border-radius: 999px; background: var(--bg);
      border: 1px solid var(--border); box-shadow: 0 8px 24px oklch(0 0 0 / 0.35); backdrop-filter: blur(8px); }
    button, a { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
      height: 28px; padding: 0 10px; font: inherit; color: inherit; transition: background .15s, color .15s, opacity .15s; }
    button:hover, a:hover { background: var(--accent); }
    button:focus-visible, a:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
    button[disabled] { opacity: .6; cursor: default; }
    .icon { width: 28px; padding: 0; justify-content: center; color: var(--muted); }
    .icon.on { color: var(--primary); background: oklch(0.734 0.067 295.7 / 0.14); }
    .rec { background: var(--destructive); color: var(--primary-fg); font-weight: 600; padding: 0 12px; }
    .rec:hover { background: oklch(0.731 0.131 359.7 / 0.85); }
    .primary { background: var(--primary); color: var(--primary-fg); font-weight: 600; }
    .primary:hover { background: oklch(0.734 0.067 295.7 / 0.85); }
    .grip { cursor: grab; width: 18px; padding: 0; justify-content: center; color: var(--muted); opacity: .6; }
    .grip:hover { background: none; opacity: 1; }
    .live { display: inline-flex; align-items: center; gap: 7px; padding: 0 8px 0 10px; font-variant-numeric: tabular-nums; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--destructive); animation: pulse 1.6s ease-out infinite; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 oklch(0.731 0.131 359.7 / .6); } 70%,100% { box-shadow: 0 0 0 7px transparent; } }
    .sep { width: 1px; height: 16px; background: var(--border); margin: 0 2px; }
    .meta { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); font-size: 12px; padding: 0 6px; }
    .meta.warn { color: var(--warning); }
    .meta.ok { color: var(--success); }
    .spin { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--primary); animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .note { max-width: 320px; padding: 8px 10px 8px 12px; border-radius: 10px; background: var(--bg); border: 1px solid var(--border);
      font-size: 12px; line-height: 1.4; display: flex; gap: 8px; align-items: flex-start; box-shadow: 0 8px 24px oklch(0 0 0 / 0.35); }
    .note.err { border-color: oklch(0.731 0.131 359.7 / 0.5); }
    .note.err svg:first-child { color: var(--destructive); flex: none; margin-top: 1px; }
    .note .x { height: 18px; width: 18px; padding: 0; justify-content: center; color: var(--muted); flex: none; }
    .title { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 12px; }
  </style><div class="root"></div>`;
  const root = shadow.querySelector(".root");

  let state = null;
  let settings = { screenDefault: false, micDefault: true };
  let myTabId = null;
  let busy = false;
  let confirmDiscard = false;
  let localError = null;
  let lastHtml = "";

  const send = (msg) =>
    new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : r)));

  const inMeeting = () => {
    const { hostname, pathname } = location;
    if (hostname === "meet.google.com") return /^\/[a-z]{3,4}-[a-z]{4}-[a-z]{3,4}/.test(pathname);
    if (hostname.endsWith("zoom.us")) return pathname.startsWith("/wc/");
    return true;
  };

  function render() {
    if (!state) return;
    const s = state;
    const mine = s.tabId != null && s.tabId === myTabId;
    const visible = inMeeting() || (mine && s.status !== "idle");
    host.style.display = visible ? "" : "none";
    if (!visible) return;

    const parts = [];
    const grip = `<span class="grip" data-grip title="Drag to move">${icon("grip", 14)}</span>`;

    if (s.status === "recording") {
      const left = (s.chunks?.recorded ?? 0) - (s.chunks?.uploaded ?? 0);
      const upload = s.uploadError
        ? `<span class="meta warn" title="${esc(s.uploadError)}">${icon("alert", 13)} ${left} queued</span>`
        : `<span class="meta ${left > 2 ? "" : "ok"}" title="${s.chunks?.uploaded ?? 0} of ${s.chunks?.recorded ?? 0} chunks uploaded">${icon("cloud", 13)} ${left > 2 ? `${left} queued` : "Synced"}</span>`;
      parts.push(`<div class="bar">${grip}
        <span class="live"><i class="dot"></i>${mine ? "" : "Other tab · "}<span data-clock></span></span>
        ${mine && s.title ? `<span class="title" title="${esc(s.title)}">${esc(s.title)}</span>` : ""}
        <span class="sep"></span>${upload}
        ${s.tracks?.screen && !s.screenEnded ? `<span class="icon on" title="Recording your screen">${icon("screen")}</span>` : ""}
        ${s.tracks?.mic ? `<span class="icon on" title="Recording your microphone">${icon("mic")}</span>` : ""}
        <button data-act="discard" class="${confirmDiscard ? "rec" : "icon"}" title="Discard this recording">${icon("trash")}${confirmDiscard ? "Discard?" : ""}</button>
        <button data-act="stop" class="primary" ${busy ? "disabled" : ""}>${icon("stop", 12)} Stop & save</button>
      </div>`);
      if (s.micError) {
        parts.push(
          `<div class="note">${icon("mic")}<span>Your microphone isn't being recorded${s.micError === "permission" ? " — allow it from the twodb popup" : ""}.</span></div>`,
        );
      }
    } else if (s.status === "starting") {
      parts.push(`<div class="bar">${grip}<span class="meta"><i class="spin"></i> ${settings.screenDefault ? "Pick a screen to share…" : "Starting…"}</span></div>`);
    } else if (s.status === "saving") {
      const left = (s.chunks?.recorded ?? 0) - (s.chunks?.uploaded ?? 0);
      parts.push(`<div class="bar">${grip}<span class="meta"><i class="spin"></i> Saving${left > 0 ? ` · ${left} chunk${left === 1 ? "" : "s"} left` : "…"}</span></div>`);
    } else {
      parts.push(`<div class="bar">${grip}
        <button data-act="toggle-screen" class="icon ${settings.screenDefault ? "on" : ""}" title="${settings.screenDefault ? "Also record a screen (on)" : "Also record a screen (off)"}">${icon("screen")}</button>
        <button data-act="toggle-mic" class="icon ${settings.micDefault ? "on" : ""}" title="${settings.micDefault ? "Record my microphone (on)" : "Record my microphone (off)"}">${icon("mic")}</button>
        <button data-act="start" class="rec" ${busy ? "disabled" : ""}>${icon("record", 12)} Record</button>
      </div>`);
      const last = s.last;
      if (last && Date.now() - last.savedAt < 20000) {
        parts.push(`<div class="note">${icon("check")}<span>Saved ${esc(last.title ?? "recording")} · ${clock(last.durationMs ?? 0)}${last.missingChunks ? ` · ${last.missingChunks} chunks couldn't upload` : ""}</span>
          <a href="${esc(last.url)}" target="_blank" rel="noreferrer" style="height:18px;padding:0 4px;color:var(--primary)">${icon("open", 13)}</a>
          <button class="x" data-act="dismiss-last">${icon("x", 12)}</button></div>`);
      }
    }

    const error = localError ?? (s.status === "idle" ? s.error : null);
    if (error) parts.push(`<div class="note err">${icon("alert")}<span>${esc(error)}</span><button class="x" data-act="dismiss">${icon("x", 12)}</button></div>`);
    const html = parts.join("");
    if (html !== lastHtml) {
      root.innerHTML = html;
      lastHtml = html;
    }
    updateClock();
  }

  function updateClock() {
    const el = root.querySelector("[data-clock]");
    if (el && state?.startedAt) el.textContent = clock(Date.now() - state.startedAt);
  }

  root.addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    if (act !== "discard") confirmDiscard = false;
    if (act === "toggle-screen") return chrome.storage.local.set({ screenDefault: !settings.screenDefault });
    if (act === "toggle-mic") return chrome.storage.local.set({ micDefault: !settings.micDefault });
    if (act === "dismiss") {
      localError = null;
      render();
      return send({ type: "twodb-ui-dismiss" });
    }
    if (act === "dismiss-last") return send({ type: "twodb-ui-dismiss", last: true });
    if (act === "discard" && !confirmDiscard) {
      confirmDiscard = true;
      render();
      setTimeout(() => ((confirmDiscard = false), render()), 4000);
      return;
    }
    busy = true;
    localError = null;
    render();
    const type = { start: "twodb-ui-start", stop: "twodb-ui-stop", discard: "twodb-ui-discard" }[act];
    const r = await send({ type, withScreen: settings.screenDefault, withMic: settings.micDefault, title: meetingTitle() });
    busy = false;
    confirmDiscard = false;
    if (!r?.ok && r?.error && act !== "start") localError = r.error; // start errors arrive via shared state
    render();
  });

  // Drag to reposition; remembered across meetings.
  root.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("[data-grip]")) return;
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const move = (ev) => {
      const left = Math.min(Math.max(0, ev.clientX - dx), innerWidth - rect.width);
      const top = Math.min(Math.max(0, ev.clientY - dy), innerHeight - 40);
      host.style.left = `${left}px`;
      host.style.top = `${top}px`;
      host.style.right = "auto";
    };
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      chrome.storage.local.set({ widgetPos: { right: Math.max(0, innerWidth - host.getBoundingClientRect().right), top: host.offsetTop } });
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
  });

  function placeWidget(pos) {
    if (!pos) return;
    host.style.left = "auto";
    host.style.right = `${Math.min(pos.right, innerWidth - 120)}px`;
    host.style.top = `${Math.min(pos.top, innerHeight - 40)}px`;
  }

  function meetingTitle() {
    const meet = document.querySelector("[data-meeting-title]")?.getAttribute("data-meeting-title");
    if (meet) return meet.trim().slice(0, 300);
    const t = document.title.replace(/^\(\d+\)\s*/, "").replace(/^Meet\s*[-–]\s*/i, "").replace(/\s*\|\s*Microsoft Teams$/i, "").trim();
    return t && !/^(Google Meet|Microsoft Teams|Zoom)$/i.test(t) ? t.slice(0, 300) : null;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "twodb-meeting-info") sendResponse({ title: meetingTitle() });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.rec) state = changes.rec.newValue ?? null;
    if (changes.screenDefault) settings.screenDefault = !!changes.screenDefault.newValue;
    if (changes.micDefault) settings.micDefault = changes.micDefault.newValue !== false;
    if (changes.widgetPos) placeWidget(changes.widgetPos.newValue);
    render();
  });

  (async () => {
    const stored = await chrome.storage.local.get(["rec", "screenDefault", "micDefault", "widgetPos"]);
    state = stored.rec ?? { status: "idle" };
    settings = { screenDefault: stored.screenDefault ?? false, micDefault: stored.micDefault ?? true };
    placeWidget(stored.widgetPos);
    myTabId = (await send({ type: "twodb-ui-tab" }))?.tabId ?? null;
    document.documentElement.appendChild(host);
    render();
  })();

  // Ticking clock; render() is a no-op unless something changed (SPA navigation, expiring notes).
  setInterval(render, 1000);
})();
