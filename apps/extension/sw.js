// Service worker: brokers capture stream ids (user-gesture bound) and owns
// the offscreen document. All recording state lives in the offscreen doc.

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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      // content script → start recording (user gesture alive in this turn)
      case "twodb-ui-start": {
        try {
          await ensureOffscreen();

          const tabId = sender.tab?.id;
          if (!tabId) return sendResponse({ ok: false, error: "no_tab" });

          const meetingStreamId = await new Promise((resolve) =>
            chrome.tabCapture.getMediaStreamId({ targetTabId: tabId, consumerTabId: tabId }, (id) => resolve(chrome.runtime.lastError ? null : id)),
          );
          if (!meetingStreamId) return sendResponse({ ok: false, error: "tab_capture_failed" });

          const { screenDefault = true } = await chrome.storage.local.get(["screenDefault"]);
          let screenStreamId = null;
          if (msg.withScreen ?? screenDefault) {
            screenStreamId = await new Promise((resolve) => {
              // desktopCapture picker must run inside the user gesture;
              // cancelled → resolve null, meeting-only recording continues.
              chrome.desktopCapture.chooseDesktopMedia(["screen", "window", "tab"], sender.tab, (id) => resolve(id || null));
            });
          }

          const reply = await chrome.runtime.sendMessage({
            type: "twodb-start",
            meetingTabId: tabId,
            meetingStreamId,
            screenStreamId,
          });
          sendResponse(reply ?? { ok: false, error: "offscreen_unreachable" });
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});
