// Service worker: owns the shared recording state and brokers capture.
//
// State lives in chrome.storage.local under "rec" so every surface — popup,
// in-meeting widget, context menus, toolbar badge — renders the same thing and
// stays in sync no matter where a recording was started or stopped. The
// offscreen document does the actual recording and reports progress here
// (it has no chrome.storage access of its own).
//
// tabCapture needs the extension to be "invoked" for the tab: toolbar popup,
// context menu or keyboard shortcut always qualify; the in-page button works
// once the extension has been invoked on that tab.

const OFFSCREEN_URL = "offscreen/offscreen.html";
const MEETING_PAGES = [
  "https://meet.google.com/*",
  "https://teams.microsoft.com/*",
  "https://teams.live.com/*",
  "https://app.zoom.us/wc/*",
  "https://*.zoom.us/wc/*",
];

const IDLE = {
  status: "idle",
  tabId: null,
  recordingId: null,
  platform: null,
  title: null,
  meetingUrl: null,
  startedAt: null,
  stoppedAt: null,
  tracks: { screen: false, mic: false },
  micError: null,
  screenEnded: false,
  chunks: { recorded: 0, uploaded: 0 },
  uploadError: null,
};

// --- state ----------------------------------------------------------------------

async function getState() {
  const { rec } = await chrome.storage.local.get("rec");
  return { ...IDLE, error: null, last: null, ...(rec ?? {}) };
}

async function setState(patch) {
  const next = { ...(await getState()), ...patch };
  await chrome.storage.local.set({ rec: next });
  renderBadge(next);
  renderMenus(next);
  return next;
}

async function getConfig() {
  const c = await chrome.storage.local.get(["serverUrl", "apiKey", "screenDefault", "micDefault"]);
  return {
    serverUrl: (c.serverUrl || "http://localhost:5173").replace(/\/+$/, ""),
    apiKey: c.apiKey || "",
    screenDefault: c.screenDefault ?? false,
    micDefault: c.micDefault ?? true,
  };
}

// --- badge + context menus ------------------------------------------------------

function elapsedLabel(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

function renderBadge(s) {
  if (s.status === "recording" && s.startedAt) {
    chrome.action.setBadgeBackgroundColor({ color: "#d9536f" });
    chrome.action.setBadgeTextColor?.({ color: "#ffffff" });
    chrome.action.setBadgeText({ text: elapsedLabel(Date.now() - s.startedAt) });
    chrome.action.setTitle({ title: `twodb — recording ${s.title ?? "meeting"}` });
  } else if (s.status === "starting" || s.status === "saving") {
    chrome.action.setBadgeBackgroundColor({ color: "#a99cd6" });
    chrome.action.setBadgeText({ text: "…" });
    chrome.action.setTitle({ title: s.status === "saving" ? "twodb — saving recording" : "twodb — starting" });
  } else {
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setTitle({ title: "twodb Meeting Recorder" });
  }
}

const MENU = [
  { id: "start", title: "Start recording this tab", when: (s) => s.status === "idle" },
  { id: "stop", title: "Stop & save recording", when: (s) => s.status === "recording" },
  { id: "discard", title: "Discard recording", when: (s) => s.status === "recording" },
];

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    for (const item of MENU) {
      // Page menu only on meeting sites; the toolbar icon menu works on any tab.
      chrome.contextMenus.create({ id: `${item.id}@page`, title: item.title, contexts: ["page"], documentUrlPatterns: MEETING_PAGES });
      chrome.contextMenus.create({ id: `${item.id}@action`, title: item.title, contexts: ["action"] });
    }
    void getState().then(renderMenus);
  });
}

function renderMenus(s) {
  for (const item of MENU) {
    for (const ctx of ["page", "action"]) {
      chrome.contextMenus.update(`${item.id}@${ctx}`, { visible: item.when(s) }, () => void chrome.runtime.lastError);
    }
  }
}

// --- offscreen --------------------------------------------------------------------

async function hasOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["USER_MEDIA"],
    justification: "Record the meeting tab, microphone and selected screen.",
  });
}

async function closeOffscreen() {
  if (await hasOffscreen()) await chrome.offscreen.closeDocument().catch(() => {});
}

function toOffscreen(msg) {
  return chrome.runtime.sendMessage({ ...msg, target: "offscreen" });
}

// --- capture helpers -------------------------------------------------------------

function getTabStreamId(tabId) {
  return new Promise((resolve, reject) =>
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      if (chrome.runtime.lastError || !id) reject(new Error(chrome.runtime.lastError?.message ?? "no stream id"));
      else resolve(id);
    }),
  );
}

function pickScreen(tab) {
  // Cancelled picker → null → meeting-only recording.
  return new Promise((resolve) => chrome.desktopCapture.chooseDesktopMedia(["screen", "window", "tab"], tab, (id) => resolve(id || null)));
}

function platformFor(url) {
  try {
    const host = new URL(url).hostname;
    if (host === "meet.google.com") return "meet";
    if (host.endsWith("teams.microsoft.com") || host.endsWith("teams.live.com")) return "teams";
    if (host.endsWith("zoom.us")) return "zoom";
  } catch {}
  return "other";
}

function titleFromTab(tab) {
  const raw = (tab.title ?? "").replace(/^\(\d+\)\s*/, "").trim();
  const cleaned = raw
    .replace(/^Meet\s*[-–]\s*/i, "")
    .replace(/\s*\|\s*Microsoft Teams$/i, "")
    .replace(/\s*[-–|]\s*Zoom$/i, "")
    .trim();
  // Untitled tabs report their URL as the title.
  if (!cleaned || /^[a-z-]+:\/\//i.test(cleaned) || /^(Google Meet|Microsoft Teams|Zoom)$/i.test(cleaned)) return null;
  return cleaned.slice(0, 300);
}

/** The meeting name from the page when the content script can read it; tab title otherwise. */
async function meetingTitle(tab) {
  const fromPage = await Promise.race([
    chrome.tabs.sendMessage(tab.id, { type: "twodb-meeting-info" }).catch(() => null),
    new Promise((r) => setTimeout(() => r(null), 500)),
  ]);
  return fromPage?.title || titleFromTab(tab);
}

function friendlyError(e) {
  const m = String(e?.message ?? e ?? "");
  if (/not been invoked|activeTab|Extension has not/i.test(m))
    return "Chrome needs one click on the twodb icon (or Alt+Shift+R / the right-click menu) before this tab can be recorded.";
  if (/active stream/i.test(m)) return "This tab is already being captured by another extension.";
  if (/not_configured/.test(m)) return "Add your twodb server and API key in the extension popup first.";
  if (/\(401\)/.test(m)) return "The twodb server rejected the API key — update it in the extension popup.";
  if (/Failed to fetch|NetworkError|unreachable/i.test(m)) return "Couldn't reach the twodb server. Check the server URL in the popup.";
  if (/chrome:\/\/|Chrome pages cannot be captured|webstore/i.test(m)) return "Chrome doesn't allow recording this page.";
  return m || "Something went wrong.";
}

// --- lifecycle --------------------------------------------------------------------

let busy = false;

async function start(tab, opts = {}) {
  const s = await getState();
  if (s.status !== "idle") return { ok: false, error: "A recording is already in progress." };
  if (busy) return { ok: false, error: "Starting…" };
  busy = true;
  try {
    const config = await getConfig();
    if (!config.apiKey) throw new Error("not_configured");
    await setState({ ...IDLE, status: "starting", tabId: tab.id, error: null });
    await ensureOffscreen();

    const withScreen = opts.withScreen ?? config.screenDefault;
    const withMic = opts.withMic ?? config.micDefault;
    // Picker first: it blocks while the user browses, and stream ids expire.
    const screenStreamId = withScreen ? await pickScreen(tab) : null;
    const meetingStreamId = await getTabStreamId(tab.id);
    const title = opts.title || (await meetingTitle(tab));
    const platform = platformFor(tab.url ?? "");

    const reply = await toOffscreen({
      type: "start",
      meetingStreamId,
      screenStreamId,
      withMic,
      serverUrl: config.serverUrl,
      apiKey: config.apiKey,
      meetingUrl: tab.url ?? null,
      title,
      platform,
    });
    if (!reply?.ok) throw new Error(reply?.error ?? "offscreen_unreachable");

    await setState({
      status: "recording",
      tabId: tab.id,
      recordingId: reply.recordingId,
      startedAt: reply.startedAt,
      platform,
      title,
      meetingUrl: tab.url ?? null,
      tracks: reply.tracks,
      micError: reply.micError ?? null,
    });
    return { ok: true };
  } catch (e) {
    await setState({ ...IDLE, error: friendlyError(e) });
    await closeOffscreen();
    return { ok: false, error: friendlyError(e) };
  } finally {
    busy = false;
  }
}

async function stop() {
  const s = await getState();
  if (s.status !== "recording") return { ok: false, error: "Nothing is recording." };
  await setState({ status: "saving", stoppedAt: Date.now() });
  const { serverUrl } = await getConfig();
  try {
    const reply = await toOffscreen({ type: "stop" });
    if (!reply?.ok) throw new Error(reply?.error ?? "offscreen_unreachable");
    const last = {
      recordingId: s.recordingId,
      title: s.title,
      platform: s.platform,
      durationMs: reply.durationMs,
      missingChunks: reply.missingChunks ?? 0,
      url: `${serverUrl}/apps/meetings/${s.recordingId}`,
      savedAt: Date.now(),
    };
    await setState({ ...IDLE, error: null, last });
    return { ok: true, last };
  } catch (e) {
    await setState({ ...IDLE, error: `Saving failed: ${friendlyError(e)}` });
    return { ok: false, error: friendlyError(e) };
  } finally {
    await closeOffscreen();
  }
}

async function discard() {
  const s = await getState();
  if (s.status !== "recording") return { ok: false, error: "Nothing is recording." };
  await toOffscreen({ type: "abandon" }).catch(() => null);
  await closeOffscreen();
  await setState({ ...IDLE, error: null });
  return { ok: true };
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

// A restarted browser/extension kills the offscreen recorder; don't show a ghost recording.
(async () => {
  const s = await getState();
  if (s.status !== "idle" && !(await hasOffscreen())) {
    await setState({ ...IDLE, error: s.status === "starting" ? null : "The recording stopped unexpectedly (Chrome or the extension restarted)." });
  } else {
    renderBadge(s);
  }
})();

// --- messages ---------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === "offscreen") return false;
  const handle = async () => {
    switch (msg?.type) {
      case "twodb-ui-start": {
        const tab = msg.tabId ? await chrome.tabs.get(msg.tabId) : sender.tab;
        if (!tab?.id) return { ok: false, error: "No tab to record." };
        return start(tab, { withScreen: msg.withScreen, withMic: msg.withMic, title: msg.title });
      }
      case "twodb-ui-tab":
        return { tabId: sender.tab?.id ?? null };
      case "twodb-ui-stop":
        return stop();
      case "twodb-ui-discard":
        return discard();
      case "twodb-ui-dismiss":
        await setState({ error: null, ...(msg.last ? { last: null } : {}) });
        return { ok: true };
      // offscreen → progress / track events
      case "twodb-progress": {
        const s = await getState();
        if (s.status === "recording" || s.status === "saving") await setState(msg.patch);
        return { ok: true };
      }
      case "twodb-meeting-ended":
        return stop();
      default:
        return undefined;
    }
  };
  const known = typeof msg?.type === "string" && msg.type.startsWith("twodb-");
  if (!known) return false;
  handle().then(sendResponse, (e) => sendResponse({ ok: false, error: friendlyError(e) }));
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "record-toggle") return;
  const s = await getState();
  if (s.status === "recording") return void stop();
  const tab = await activeTab();
  if (tab?.id) void start(tab);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const action = String(info.menuItemId).split("@")[0];
  if (action === "start" && tab?.id) void start(tab);
  if (action === "stop") void stop();
  if (action === "discard") void discard();
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const s = await getState();
  if (s.status === "recording" && s.tabId === tabId) void stop();
});

chrome.runtime.onInstalled.addListener(createMenus);
chrome.runtime.onStartup.addListener(createMenus);
