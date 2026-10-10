// Offscreen document: owns the MediaRecorders, OPFS byte store, IndexedDB
// queue and the upload loop. The service worker only forwards stream ids and
// lifecycle commands — everything long-lived lives here.

const CHUNK_MS = 5000;
const UPLOAD_PARALLELISM = 2;
const HEARTBEAT_MS = 15000;

const state = {
  serverUrl: "",
  apiKey: "",
  recordingId: null,
  clientSessionId: null,
  platform: null,
  meetingUrl: null,
  recorders: new Map(), // trackId -> { recorder, seq, chunksReceived, startedAt }
  closing: false,
};

async function settings() {
  const { serverUrl = "http://localhost:3001", apiKey = "", screenDefault = true } = await chrome.storage.local.get(["serverUrl", "apiKey", "screenDefault"]);
  state.serverUrl = serverUrl.replace(/\/+$/, "");
  state.apiKey = apiKey;
  return { screenDefault };
}

function api(path, init = {}) {
  return fetch(`${state.serverUrl}/api/meetings${path}`, {
    ...init,
    headers: { "x-api-key": state.apiKey, ...(init.headers ?? {}) },
  });
}

// --- IndexedDB queue (chunk metadata) --------------------------------------

const DB_NAME = "twodb-recorder";
const STORE = "chunks";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: ["trackId", "seq"] });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putChunkMeta(meta) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearChunkMeta(trackId) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const range = IDBKeyRange.bound([trackId, 0], [trackId, Number.MAX_SAFE_INTEGER]);
    const req = store.openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- OPFS byte store --------------------------------------------------------

async function opfsFile(trackId, create) {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle("recordings", { create: true });
  return dir.getFileHandle(`${trackId}.webm`, { create });
}

async function appendChunkBytes(trackId, seq, bytes) {
  const handle = await opfsFile(trackId, true);
  const access = await handle.createSyncAccessHandle();
  try {
    access.write(bytes, { at: access.getSize() - bytes.byteLength });
  } finally {
    access.close();
  }
  await putChunkMeta({ trackId, seq, uploaded: false });
}
async function readChunkBytes(trackId, offset, length) {
  const handle = await opfsFile(trackId, false);
  const access = await handle.createSyncAccessHandle();
  try {
    const buf = new ArrayBuffer(length);
    access.read(buf, { at: offset });
    return new Uint8Array(buf);
  } finally {
    access.close();
  }
}
async function truncateRecording(trackId) {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle("recordings", { create: false });
  await dir.removeEntry(`${trackId}.webm`).catch(() => {});
  await clearChunkMeta(trackId);
}

// Track byte offsets per chunk so retries can read exact ranges back.
const offsets = new Map(); // trackId -> [{offset, length}]

async function storeChunk(trackId, seq, bytes) {
  const handle = await opfsFile(trackId, true);
  const access = await handle.createSyncAccessHandle();
  let offset;
  try {
    offset = access.getSize();
    access.write(bytes, { at: offset });
    access.flush();
  } finally {
    access.close();
  }
  if (!offsets.has(trackId)) offsets.set(trackId, []);
  offsets.get(trackId).push({ offset, length: bytes.byteLength });
  await putChunkMeta({ trackId, seq, uploaded: false, offset, length: bytes.byteLength });
  return { offset, length: bytes.byteLength };
}

// --- Upload loop -------------------------------------------------------------

async function uploadChunk(trackId, seq, bytes, digest) {
  const headers = { "content-type": "application/octet-stream" };
  if (digest) headers["x-chunk-sha256"] = digest;
  const res = await api(`/recordings/${state.recordingId}/tracks/${trackId}/chunks?seq=${seq}`, { method: "POST", headers, body: bytes });
  if (res.status === 409) {
    const body = await res.json().catch(() => null);
    if (body?.expectedSeq !== undefined) {
      // rewind: re-serialize the track pointer to the server's position
      const rec = state.recorders.get(trackId);
      if (rec) rec.serverSeq = body.expectedSeq;
      return body.expectedSeq;
    }
  }
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  const body = await res.json();
  const rec = state.recorders.get(trackId);
  if (rec) rec.serverSeq = body.nextSeq;
  return body.nextSeq;
}

async function withBackoff(fn, tries = 5) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= tries - 1) throw e;
      await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 30000)));
    }
  }
}

const pending = new Map(); // trackId -> seq-sorted [{seq, offset, length, digest}]
const inFlight = new Set();

function queueUpload(trackId, entry) {
  if (!pending.has(trackId)) pending.set(trackId, []);
  pending.get(trackId).push(entry);
  pump();
}

async function pump() {
  for (const [trackId, queue] of pending) {
    while (queue.length && [...inFlight].filter((k) => k.startsWith(trackId)).length < UPLOAD_PARALLELISM) {
      const entry = queue.shift();
      const key = `${trackId}:${entry.seq}`;
      if (inFlight.has(key)) continue;
      inFlight.add(key);
      (async () => {
        try {
          const bytes = await readChunkBytes(trackId, entry.offset, entry.length);
          await withBackoff(() => uploadChunk(trackId, entry.seq, bytes, entry.digest));
          await putChunkMeta({ trackId, seq: entry.seq, uploaded: true, offset: entry.offset, length: entry.length });
        } catch (e) {
          console.error("[twodb-ext] chunk upload failed", entry.seq, e);
          queue.unshift(entry); // retry later — next pump
        } finally {
          inFlight.delete(key);
          pump();
        }
      })();
    }
  }
}

// --- Recording lifecycle ------------------------------------------------------

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function platformFor(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "meet.google.com") return "meet";
    if (u.hostname.endsWith("teams.microsoft.com") || u.hostname.endsWith("teams.live.com")) return "teams";
  } catch {}
  return "other";
}

async function startRecording({ meetingTabId, meetingStreamId, screenStreamId }) {
  await settings();
  state.closing = false;
  state.clientSessionId = crypto.randomUUID();
  state.platform = platformFor(state.meetingUrl ?? "");
  state.meetingUrl = (await chrome.tabs.get?.(meetingTabId))?.url ?? null;

  const tracks = ["meeting"];
  if (screenStreamId) tracks.push("screen");
  const startRes = await api("/recordings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ platform: state.platform || "other", meetingUrl: state.meetingUrl, clientSessionId: state.clientSessionId, tracks: tracks.map((trackId) => ({ trackId })) }),
  });
  if (!startRes.ok) throw new Error(`session start failed (${startRes.status}): ${await startRes.text()}`);
  const started = await startRes.json();
  state.recordingId = started.recordingId;

  await startTrack("meeting", meetingStreamId, started.tracks?.find((t) => t.trackId === "meeting")?.nextSeq ?? 1);
  if (screenStreamId) await startTrack("screen", screenStreamId, started.tracks?.find((t) => t.trackId === "screen")?.nextSeq ?? 1);

  heartbeatLoop();
  return started;
}

async function startTrack(trackId, streamId, serverNextSeq) {
  const constraints =
    trackId === "screen"
      ? {
          audio: false,
          video: { chromeMediaSource: "desktop", chromeMediaSourceId: streamId },
        }
      : {
          audio: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
          video: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
        };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  if (trackId === "screen") {
    stream.getVideoTracks()[0]?.addEventListener("ended", () => chrome.runtime.sendMessage({ type: "twodb-screen-track-ended", trackId }));
  }
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
  const rec = { recorder, seq: 1, serverSeq: serverNextSeq, chunksReceived: 0, startedAt: Date.now() };
  state.recorders.set(trackId, rec);

  recorder.ondataavailable = async (event) => {
    if (event.data.size === 0) return;
    const bytes = new Uint8Array(await event.data.arrayBuffer());
    const seq = rec.seq++;
    rec.chunksReceived += 1;
    const digest = await sha256Hex(bytes);
    const stored = await storeChunk(trackId, seq, bytes);
    if (seq >= rec.serverSeq) queueUpload(trackId, { seq, offset: stored.offset, length: stored.length, digest });
  };
  recorder.start(CHUNK_MS);
}

let heartbeatTimer = null;
function heartbeatLoop() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(async () => {
    if (!state.recordingId || state.closing) return;
    try {
      await withBackoff(() => api(`/recordings/${state.recordingId}/heartbeat`, { method: "POST" }), 2);
    } catch {}
  }, HEARTBEAT_MS);
}

async function stopRecording({ finalize = true } = {}) {
  state.closing = true;
  clearInterval(heartbeatTimer);

  const stops = [...state.recorders.values()].map((rec) => rec.recorder.state !== "inactive" ? new Promise((resolve) => { rec.recorder.onstop = resolve; rec.recorder.stop(); }) : null);
  await Promise.all(stops);

  // wait for pending uploads to drain (bounded)
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && [...inFlight].length + [...pending.values()].reduce((n, q) => n + q.length, 0) > 0) {
    await new Promise((r) => setTimeout(r, 500));
  }

  let result = null;
  if (finalize && state.recordingId) {
    const tracks = [...state.recorders.entries()].map(([trackId, rec]) => ({
      trackId,
      totalChunks: rec.chunksReceived,
      durationMs: Date.now() - rec.startedAt,
      startedAt: new Date(rec.startedAt).toISOString(),
    }));
    const res = await withBackoff(() =>
      api(`/recordings/${state.recordingId}/finalize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tracks }),
      }),
    );
    result = await res.json().catch(() => null);
    for (const trackId of state.recorders.keys()) await truncateRecording(trackId);
  }

  for (const rec of state.recorders.values()) rec.recorder.stream.getTracks().forEach((t) => t.stop());
  state.recorders.clear();
  state.recordingId = null;
  return result;
}

async function abandon() {
  if (state.recordingId) {
    await api(`/recordings/${state.recordingId}/abandon`, { method: "POST" }).catch(() => {});
  }
  await stopRecording({ finalize: false }).catch(() => {});
  for (const trackId of ["meeting", "screen"]) await truncateRecording(trackId).catch(() => {});
}

// --- Message plumbing -----------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case "twodb-start": {
        try {
          const started = await startRecording(msg);
          sendResponse({ ok: true, recordingId: started.recordingId });
        } catch (e) {
          sendResponse({ ok: false, error: String(e?.message ?? e) });
        }
        return;
      }
      case "twodb-stop": {
        try {
          const result = await stopRecording({ finalize: msg.finalize !== false });
          sendResponse({ ok: true, result });
        } catch (e) {
          sendResponse({ ok: false, error: String(e?.message ?? e) });
        }
        return;
      }
      case "twodb-abandon": {
        try {
          await abandon();
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: String(e?.message ?? e) });
        }
        return;
      }
      case "twodb-status": {
        sendResponse({
          recording: state.recordingId != null,
          recordingId: state.recordingId,
          platform: state.platform,
        });
        return;
      }
    }
  })();
  return true; // async sendResponse
});

export {};
