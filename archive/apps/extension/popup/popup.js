const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clock = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = String(Math.floor((t % 3600) / 60)).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${m}:${String(t % 60).padStart(2, "0")}`;
};
const PLATFORMS = { meet: "Google Meet", teams: "Microsoft Teams", zoom: "Zoom", other: "Browser tab" };
const MEETING_HOSTS = /^(meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|([a-z0-9-]+\.)?zoom\.us)$/;

const send = (msg) => chrome.runtime.sendMessage(msg).catch((e) => ({ ok: false, error: String(e?.message ?? e) }));

let store = await chrome.storage.local.get(["rec", "serverUrl", "apiKey", "screenDefault", "micDefault"]);
let rec = store.rec ?? { status: "idle" };
let config = {
  serverUrl: store.serverUrl ?? "",
  apiKey: store.apiKey ?? "",
  screenDefault: store.screenDefault ?? false,
  micDefault: store.micDefault ?? true,
};
let busy = false;
let confirmDiscard = false;
let actionError = null;
let micPermission = "prompt";
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

// --- settings ------------------------------------------------------------------------

$("server").value = config.serverUrl;
$("key").value = config.apiKey;
$("settings").open = !config.apiKey;

function settingsStatus(text, cls = "") {
  $("settings-status").textContent = text;
  $("settings-status").className = `hint ${cls}`;
}

function setConn(kind, text) {
  $("conn").className = `badge ${kind}`;
  $("conn").lastElementChild.textContent = text;
}

async function testConnection(serverUrl, apiKey) {
  if (!serverUrl || !apiKey) return setConn("", "Not set up");
  setConn("", "Checking…");
  try {
    const res = await fetch(`${serverUrl}/api/meetings/recordings?limit=1`, { headers: { "x-api-key": apiKey } });
    if (res.ok) return setConn("ok", "Connected"), true;
    setConn("err", res.status === 401 ? "Invalid key" : `Error ${res.status}`);
  } catch {
    setConn("err", "Unreachable");
  }
  return false;
}

$("save").onclick = async () => {
  const serverUrl = $("server").value.trim().replace(/\/+$/, "");
  const apiKey = $("key").value.trim();
  let origin;
  try {
    origin = new URL(serverUrl).origin;
  } catch {
    return settingsStatus("Enter the full URL, e.g. https://app.example.com", "err");
  }
  // Plain-http servers other than localhost need an extra host grant.
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] }).catch(() => false);
  if (!granted) return settingsStatus(`Chrome needs access to ${origin} to upload recordings.`, "err");
  await chrome.storage.local.set({ serverUrl, apiKey });
  config = { ...config, serverUrl, apiKey };
  settingsStatus("Testing…");
  const ok = await testConnection(serverUrl, apiKey);
  settingsStatus(ok ? "Saved — connected." : "Saved, but the server didn't accept the key.", ok ? "ok" : "err");
  if (ok) $("settings").open = false;
  render();
};

$("keys").onclick = (e) => {
  e.preventDefault();
  const base = ($("server").value.trim() || config.serverUrl).replace(/\/+$/, "");
  if (!base) return settingsStatus("Enter your twodb URL first.", "err");
  chrome.tabs.create({ url: `${base}/apps/settings/administrator` });
};

chrome.commands.getAll().then((cmds) => {
  const shortcut = cmds.find((c) => c.name === "record-toggle")?.shortcut;
  if (shortcut) $("shortcut").textContent = shortcut;
  else $("shortcut").parentElement.firstChild.replaceWith(Object.assign(document.createElement("span"), { textContent: "Set a shortcut in chrome://extensions/shortcuts —" }));
});

navigator.permissions
  .query({ name: "microphone" })
  .then((p) => {
    micPermission = p.state;
    p.onchange = () => ((micPermission = p.state), render());
    render();
  })
  .catch(() => {});

// --- views -------------------------------------------------------------------------

function tabCard() {
  let host = "";
  try {
    host = new URL(tab?.url ?? "").hostname;
  } catch {}
  const isMeeting = MEETING_HOSTS.test(host);
  return `<div class="tab">
      ${tab?.favIconUrl ? `<img src="${esc(tab.favIconUrl)}" alt="" />` : ""}
      <div style="min-width:0">
        <div class="truncate">${esc(tab?.title || "This tab")}</div>
        <div class="hint">${isMeeting ? "Meeting tab — ready to record" : "Not a meeting page — the whole tab will be recorded"}</div>
      </div>
    </div>`;
}

function micHint() {
  if (!config.micDefault || micPermission === "granted") return "";
  return `<div class="note warn"><span>${micPermission === "denied" ? "Microphone access is blocked for twodb." : "twodb needs permission to record your microphone."}</span>
    <button class="btn sm" data-act="grant-mic">Allow</button></div>`;
}

function idleView() {
  const parts = [];
  if (!config.apiKey) {
    parts.push(`<div class="card"><strong>Connect to twodb</strong><p class="hint">Add your twodb URL and an organization API key below to start recording meetings.</p></div>`);
    return parts.join("");
  }
  parts.push(`<div class="card">
    ${tabCard()}
    <label class="switch"><span>Record a screen too<small>Pick a window or screen to capture alongside the meeting</small></span><input type="checkbox" data-setting="screenDefault" ${config.screenDefault ? "checked" : ""} /></label>
    <label class="switch"><span>Record my microphone<small>The tab only carries other people's audio</small></span><input type="checkbox" data-setting="micDefault" ${config.micDefault ? "checked" : ""} /></label>
    ${micHint()}
    <button class="btn record block" data-act="start" ${busy ? "disabled" : ""}>
      <svg width="12" height="12" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="currentColor" /></svg> Start recording
    </button>
  </div>`);
  const error = actionError ?? rec.error;
  if (error) parts.push(`<div class="note err"><span>${esc(error)}</span><button class="btn ghost sm" data-act="dismiss">Dismiss</button></div>`);
  if (rec.last) parts.push(lastView(rec.last));
  return parts.join("");
}

function lastView(last) {
  const when = new Date(last.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `<div class="card">
    <div class="row between"><span class="hint">Last recording · ${when}</span><button class="btn ghost sm" data-act="dismiss-last" title="Hide">✕</button></div>
    <div class="row between">
      <div style="min-width:0"><div class="truncate">${esc(last.title || `${PLATFORMS[last.platform] ?? "Meeting"} recording`)}</div>
      <div class="hint">${clock(last.durationMs ?? 0)}${last.missingChunks ? ` · ${last.missingChunks} chunks didn't upload` : ""}</div></div>
      <a class="btn sm" href="${esc(last.url)}" target="_blank" rel="noreferrer">Open in twodb</a>
    </div>
  </div>`;
}

function recordingView() {
  const recorded = rec.chunks?.recorded ?? 0;
  const uploaded = rec.chunks?.uploaded ?? 0;
  const pct = recorded ? Math.round((uploaded / recorded) * 100) : 100;
  const otherTab = rec.tabId != null && rec.tabId !== tab?.id;
  return `<div class="card">
    <div class="row between">
      <span class="row small"><i class="live-dot"></i> Recording · ${esc(PLATFORMS[rec.platform] ?? "Tab")}</span>
      ${otherTab ? `<button class="btn ghost sm" data-act="goto">Go to tab</button>` : ""}
    </div>
    <div>
      <div class="timer" id="timer">${clock(Date.now() - (rec.startedAt ?? Date.now()))}</div>
      <div class="truncate muted">${esc(rec.title || "Untitled meeting")}</div>
    </div>
    <div class="row" style="flex-wrap:wrap;gap:6px">
      <span class="chip on">Meeting</span>
      <span class="chip ${rec.tracks?.screen && !rec.screenEnded ? "on" : ""}">${rec.screenEnded ? "Screen (stopped)" : rec.tracks?.screen ? "Screen" : "No screen"}</span>
      ${rec.tracks?.mic ? micChip() : `<span class="chip">No microphone</span>`}
    </div>
    ${rec.tracks?.mic && micNudge()}
    <div>
      <div class="row between hint" style="margin-bottom:4px"><span>Uploaded ${uploaded} of ${recorded} chunks</span><span>${pct}%</span></div>
      <div class="progress"><i style="width:${pct}%"></i></div>
    </div>
    ${rec.uploadError ? `<div class="note warn"><span>${esc(rec.uploadError)}</span></div>` : ""}
    ${rec.micError ? micErrorNote() : ""}
    <div class="row">
      <button class="btn primary" style="flex:1" data-act="stop" ${busy ? "disabled" : ""}>
        <svg width="11" height="11" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" /></svg> Stop & save
      </button>
      <button class="btn ${confirmDiscard ? "record" : "danger"}" data-act="discard" ${busy ? "disabled" : ""}>${confirmDiscard ? "Really discard?" : "Discard"}</button>
    </div>
  </div>
  ${actionError ? `<div class="note err"><span>${esc(actionError)}</span></div>` : ""}`;
}

function micChip() {
  const m = rec.mic;
  if (!m) return `<span class="chip on">Microphone</span>`;
  if (m.muted) return `<span class="chip err">Microphone muted</span>`;
  const bars = Array.from({ length: 5 }, (_, i) => `<i class="${m.peak > (i + 1) / 5 ? "on" : ""}"></i>`).join("");
  const label = m.heardVoice ? "You" : "Listening…";
  return `<span class="chip ${m.heardVoice ? "on" : ""}" title="Live microphone level${m.muted ? " — muted" : ""}"><span class="meter">${bars}</span>${label}</span>`;
}

function micNudge() {
  const m = rec.mic;
  if (!m) return "";
  const elapsed = Date.now() - (rec.startedAt ?? Date.now());
  if (m.muted) return `<div class="note warn"><span>Your microphone is muted or disconnected — your voice isn't in the recording. Unmute it to continue.</span></div>`;
  if (m.silent && elapsed > 60_000)
    return `<div class="note warn"><span>Not hearing you on the microphone. If you're speaking, check that the right device is selected — recordings only pick up the mic that was active when recording started.</span></div>`;
  if (!m.heardVoice && elapsed > 90_000 && m.level < 0.005 && m.peak < 0.02)
    return `<div class="note warn"><span>The microphone is picking up silence. Speak now to confirm it's working, or pick a different device before your next recording.</span></div>`;
  return "";
}

function micErrorNote() {
  if (rec.micError === "permission") return `<div class="note warn"><span>Your microphone isn't recorded — twodb doesn't have permission yet. It applies to the next recording.</span><button class="btn sm" data-act="grant-mic">Allow</button></div>`;
  if (rec.micError === "no_device") return `<div class="note warn"><span>No microphone found — only the meeting audio is recorded.</span></div>`;
  return `<div class="note warn"><span>Your microphone isn't recorded: ${esc(rec.micError)}</span></div>`;
}

function render() {
  let html;
  if (rec.status === "recording") html = recordingView();
  else if (rec.status === "starting") html = `<div class="card"><div class="row"><i class="spin"></i><span>Starting… ${config.screenDefault ? "pick a screen in Chrome's dialog." : ""}</span></div></div>`;
  else if (rec.status === "saving") {
    const left = (rec.chunks?.recorded ?? 0) - (rec.chunks?.uploaded ?? 0);
    html = `<div class="card"><div class="row"><i class="spin"></i><span>Saving${left > 0 ? ` — uploading ${left} remaining chunk${left === 1 ? "" : "s"}` : "…"}</span></div>
      <p class="hint">You can close this popup; saving continues in the background.</p></div>`;
  } else html = idleView();
  $("view").innerHTML = html;
}

$("view").addEventListener("change", (e) => {
  const key = e.target.dataset?.setting;
  if (!key) return;
  config[key] = e.target.checked;
  chrome.storage.local.set({ [key]: e.target.checked });
  render();
});

$("view").addEventListener("click", async (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!act) return;
  if (act === "grant-mic") return chrome.tabs.create({ url: chrome.runtime.getURL("permissions/mic.html") });
  if (act === "goto") {
    const t = await chrome.tabs.get(rec.tabId).catch(() => null);
    if (t) {
      await chrome.tabs.update(t.id, { active: true });
      await chrome.windows.update(t.windowId, { focused: true });
    }
    return;
  }
  if (act === "dismiss") return (actionError = null), send({ type: "twodb-ui-dismiss" }), render();
  if (act === "dismiss-last") return send({ type: "twodb-ui-dismiss", last: true });
  if (act === "discard" && !confirmDiscard) {
    confirmDiscard = true;
    render();
    return;
  }
  busy = true;
  actionError = null;
  render();
  const reply =
    act === "start"
      ? await send({ type: "twodb-ui-start", tabId: tab?.id, withScreen: config.screenDefault, withMic: config.micDefault })
      : await send({ type: act === "stop" ? "twodb-ui-stop" : "twodb-ui-discard" });
  busy = false;
  confirmDiscard = false;
  if (!reply?.ok && act !== "start") actionError = reply?.error ?? "Something went wrong.";
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.rec) rec = changes.rec.newValue ?? { status: "idle" };
  for (const k of ["screenDefault", "micDefault"]) if (changes[k]) config[k] = changes[k].newValue;
  render();
});

setInterval(() => {
  const el = document.getElementById("timer");
  if (el && rec.status === "recording") el.textContent = clock(Date.now() - rec.startedAt);
  // Mic level bar + nudges are time-dependent; refresh the view while recording.
  if (rec.status === "recording") render();
}, 1000);

render();
void testConnection(config.serverUrl, config.apiKey);
