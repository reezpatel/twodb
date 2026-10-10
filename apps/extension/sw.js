// Service worker: brokers capture stream ids (user-gesture bound) and owns
// the offscreen document. All recording state lives in the offscreen doc.
//
// tabCapture requires the extension to be "invoked" for the target tab
// (activeTab-style). Invocation = action click, context menu, or keyboard
// shortcut — a content-script button click is not always honored, so the
// popup / context-menu paths are the guaranteed ones.

const OFFSCREEN_URL = "offscreen/offscreen.html";

async function hasOffscreen() {
  const contexts = await chrome.runtime.getContexts({});
  return contexts.some((c) => c.contextType === "OFFSCREEN_DOCUMENT");
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["USER_MEDIA"],
    justification: "Record meeting tab audio/video and the selected screen.",
  });
}

async function closeOffscreenIfIdle() {
  const status = await chrome.runtime.sendMessage({ type: "twodb-status" }).catch(() => null);
  if (status?.recording) return;
  if (await hasOffscreen()) await chrome.offscreen.closeDocument();
}

async function getTabStreamId(tabId) {
  return new Promise((resolve) =>
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      if (chrome.runtime.lastError || !id) {
        resolve({ err: chrome.runtime.lastError?.message ?? "no stream id" });
      } else {
        resolve({ id });
      }
    }),
  );
}

async function startRecordingForTab(tabId, tab, withScreen) {
  await ensureOffscreen();

  // Desktop picker first — it blocks for as long as the user browses choices,
  // and capture stream ids expire if fetched before the picker resolves.
  let screenStreamId = null;
  if (withScreen) {
    screenStreamId = await new Promise((resolve) => {
      // cancelled picker → null → meeting-only recording continues
      chrome.desktopCapture.chooseDesktopMedia(["screen", "window", "tab"], tab, (id) => resolve(id || null));
    });
  }

  const stream = await getTabStreamId(tabId);
  if (stream.err) return { ok: false, error: `tab_capture_failed: ${stream.err}` };

  const { serverUrl = "http://localhost:3001", apiKey = "" } = await chrome.storage.local.get(["serverUrl", "apiKey"]);
  const reply = await chrome.runtime.sendMessage({
    type: "twodb-start",
    meetingStreamId: stream.id,
    screenStreamId,
    serverUrl,
    apiKey,
    meetingUrl: tab.url ?? null,
  });
  return reply ?? { ok: false, error: "offscreen_unreachable" };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case "twodb-ui-start": {
        try {
          const tabId = msg.tabId ?? sender.tab?.id;
          if (!tabId) return sendResponse({ ok: false, error: "no_tab" });
          const tab = sender.tab ?? (await chrome.tabs.get(tabId));
          const { screenDefault = true } = await chrome.storage.local.get(["screenDefault"]);
          const reply = await startRecordingForTab(tabId, tab, msg.withScreen ?? screenDefault);
          if (!reply.ok) void closeOffscreenIfIdle();
          sendResponse(reply);
        } catch (e) {
          sendResponse({ ok: false, error: String(e?.message ?? e) });
        }
        return;
      }

      case "twodb-ui-stop": {
        try {
          await ensureOffscreen();
          const reply = await chrome.runtime.sendMessage({ type: "twodb-stop", finalize: true });
          sendResponse(reply ?? { ok: false, error: "offscreen_unreachable" });
          void closeOffscreenIfIdle();
        } catch (e) {
          sendResponse({ ok: false, error: String(e?.message ?? e) });
        }
        return;
      }

      case "twodb-ui-status": {
        try {
          const reply = await chrome.runtime.sendMessage({ type: "twodb-status" });
          sendResponse(reply ?? { recording: false });
        } catch {
          sendResponse({ recording: false });
        }
        return;
      }

      // offscreen → screen track revoked from Chrome's native bar
      case "twodb-screen-track-ended": {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          for (const tab of tabs) tab.id != null && void chrome.tabs.sendMessage(tab.id, { type: "twodb-screen-ended" }).catch(() => {});
        } catch {}
        return;
      }
    }
  })();
  return true;
});

// Keyboard shortcut = extension invocation (activeTab) → tabCapture passes.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "record-toggle") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const status = await chrome.runtime.sendMessage({ type: "twodb-status" }).catch(() => null);
  if (status?.recording) {
    await chrome.runtime.sendMessage({ type: "twodb-stop", finalize: true }).catch(() => {});
    void closeOffscreenIfIdle();
    return;
  }
  const { screenDefault = true } = await chrome.storage.local.get(["screenDefault"]);
  const reply = await startRecordingForTab(tab.id, tab, screenDefault).catch((e) => ({ ok: false, error: String(e) }));
  if (!reply.ok) console.error("[twodb-ext] start via shortcut failed:", reply.error);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "twodb-record",
      title: "Record this meeting (twodb)",
      contexts: ["page"],
      documentUrlPatterns: ["https://meet.google.com/*", "https://teams.microsoft.com/*", "https://teams.live.com/*"],
    });
  });
});

// Context-menu click = extension invocation (activeTab) → tabCapture passes.
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "twodb-record" || !tab?.id) return;
  const { screenDefault = true } = await chrome.storage.local.get(["screenDefault"]);
  const reply = await startRecordingForTab(tab.id, tab, screenDefault).catch((e) => ({ ok: false, error: String(e) }));
  if (!reply.ok) console.error("[twodb-ext] start via context menu failed:", reply.error);
});
