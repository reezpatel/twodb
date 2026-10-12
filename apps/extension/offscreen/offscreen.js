// Offscreen document: owns the recorders, the on-disk chunk spool and the
// upload loop. Lifecycle commands come from the service worker; progress goes
// back to it (offscreen documents only get chrome.runtime).
//
// Tracks: "meeting" (tab video + tab audio mixed with the microphone) and an
// optional "screen" (picked window/screen, video only). Chunks are 5s webm
// slices; the server appends them in strict seq order per track, so each
// track uploads sequentially and rewinds to the server's expected seq on 409.

const CHUNK_MS = 5000;
const HEARTBEAT_MS = 15000;
const DRAIN_IDLE_MS = 45000; // give up draining after this long without progress
const MAX_BACKOFF_MS = 30000;

let rec = null; // current recording, see startRecording

// --- server ------------------------------------------------------------------------

function api(path, init = {}) {
  return fetch(`${rec.serverUrl}/api/meetings${path}`, {
    ...init,
    headers: { "x-api-key": rec.apiKey, ...(init.headers ?? {}) },
  });
}

// --- chunk spool (OPFS, one file per chunk; memory fallback) ------------------------

async function spoolDir(recordingId, create) {
  const root = await navigator.storage.getDirectory();
  const base = await root.getDirectoryHandle("recordings", { create: true });
  return base.getDirectoryHandle(recordingId, { create });
}

async function spoolPut(track, seq, blob) {
  try {
    const dir = await spoolDir(rec.recordingId, true);
    const handle = await dir.getFileHandle(`${track.id}-${seq}.webm`, { create: true });
    const w = await handle.createWritable();
    await w.write(blob);
    await w.close();
    track.chunks.set(seq, { size: blob.size });
  } catch (e) {
    console.warn("[twodb-ext] OPFS unavailable, keeping chunk in memory", e);
    track.chunks.set(seq, { size: blob.size, blob });
  }
}

async function spoolGet(track, seq) {
  const entry = track.chunks.get(seq);
  if (entry?.blob) return entry.blob;
  const dir = await spoolDir(rec.recordingId, false);
  return (await dir.getFileHandle(`${track.id}-${seq}.webm`)).getFile();
}

async function spoolDrop(track, seq) {
  track.chunks.delete(seq);
  try {
    const dir = await spoolDir(rec.recordingId, false);
    await dir.removeEntry(`${track.id}-${seq}.webm`);
  } catch {}
}

async function spoolClear(recordingId) {
  try {
    const root = await navigator.storage.getDirectory();
    const base = await root.getDirectoryHandle("recordings", { create: true });
    if (recordingId) await base.removeEntry(recordingId, { recursive: true });
    else for await (const name of base.keys()) await base.removeEntry(name, { recursive: true });
  } catch {}
}

// --- progress ----------------------------------------------------------------------

let reportTimer = null;
function report(extra = {}) {
  if (!rec) return;
  Object.assign(rec.pendingReport, extra);
  if (reportTimer) return;
  reportTimer = setTimeout(() => {
    reportTimer = null;
    if (!rec) return;
    let recorded = 0;
    let uploaded = 0;
    for (const t of rec.tracks.values()) {
      recorded += t.lastSeq;
      uploaded += t.serverNext - 1;
    }
    const patch = { chunks: { recorded, uploaded }, uploadError: rec.uploadError, ...rec.pendingReport };
    rec.pendingReport = {};
    chrome.runtime.sendMessage({ type: "twodb-progress", patch }).catch(() => {});
  }, 750);
}

// --- upload loop -------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sha256Hex(blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Uploads a track's chunks strictly in order, starting at the server's expected seq. */
async function pump(track) {
  if (track.pumping || !rec || rec.fatal) return;
  track.pumping = true;
  let failures = 0;
  try {
    while (rec && !rec.fatal && track.chunks.has(track.serverNext)) {
      const seq = track.serverNext;
      let res;
      try {
        const blob = await spoolGet(track, seq);
        res = await api(`/recordings/${rec.recordingId}/tracks/${track.id}/chunks?seq=${seq}`, {
          method: "POST",
          headers: { "content-type": "application/octet-stream", "x-chunk-sha256": await sha256Hex(blob) },
          body: blob,
        });
      } catch (e) {
        res = { ok: false, status: 0, json: async () => ({ error: String(e?.message ?? e) }) };
      }
      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        failures = 0;
        rec.uploadError = null;
        track.serverNext = body.nextSeq ?? seq + 1;
        await spoolDrop(track, seq);
        report();
        continue;
      }
      if (res.status === 409 && body.error === "seq_conflict" && typeof body.expectedSeq === "number" && body.expectedSeq !== seq) {
        // Server is elsewhere: ahead → it already has these chunks; behind → resend from there.
        for (let s = seq; s < body.expectedSeq; s++) await spoolDrop(track, s);
        track.serverNext = body.expectedSeq;
        continue;
      }
      if (res.status === 401 || res.status === 404 || (res.status === 409 && body.error === "not_recording") || res.status === 413) {
        rec.fatal = true;
        rec.uploadError =
          res.status === 401 ? "The server rejected the API key." : res.status === 413 ? "The recording is too large." : "The server closed this recording.";
        report();
        return;
      }
      failures += 1;
      rec.uploadError = res.status ? `Upload failed (${res.status}), retrying…` : "Offline — chunks are kept and will upload when the connection returns.";
      report();
      await sleep(Math.min(1000 * 2 ** Math.min(failures, 5), MAX_BACKOFF_MS));
    }
  } finally {
    track.pumping = false;
  }
}

// --- recording -----------------------------------------------------------------------

function newTrack(id, serverNext) {
  return { id, recorder: null, lastSeq: 0, serverNext, chunks: new Map(), handlers: new Set(), pumping: false, startedAt: Date.now(), streams: [] };
}

function startRecorder(track, stream, mimeType, videoBitsPerSecond) {
  const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : "video/webm", videoBitsPerSecond });
  track.recorder = recorder;
  recorder.ondataavailable = (event) => {
    if (!event.data.size) return;
    const seq = ++track.lastSeq;
    // Tracked so stop() can wait for the final slice to be spooled before finalizing.
    const job = spoolPut(track, seq, event.data).then(() => {
      report();
      void pump(track);
    });
    track.handlers.add(job);
    void job.finally(() => track.handlers.delete(job));
  };
  recorder.start(CHUNK_MS);
  track.startedAt = Date.now();
}

async function startMeetingTrack(track, streamId, withMic) {
  const tab = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
    video: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId, maxWidth: 1920, maxHeight: 1080, maxFrameRate: 30 } },
  });
  track.streams.push(tab);

  // Capturing a tab mutes it for the user — play its audio back so the meeting stays audible.
  const ctx = new AudioContext();
  await ctx.resume().catch(() => {});
  rec.audioContext = ctx;
  const mix = ctx.createMediaStreamDestination();
  if (tab.getAudioTracks().length) {
    const tabAudio = ctx.createMediaStreamSource(tab);
    tabAudio.connect(ctx.destination);
    tabAudio.connect(mix);
  }

  // The tab only carries other people's audio; add the user's own microphone.
  let micError = null;
  if (withMic) {
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      track.streams.push(mic);
      ctx.createMediaStreamSource(mic).connect(mix);
    } catch (e) {
      micError = e?.name === "NotAllowedError" ? "permission" : e?.name === "NotFoundError" ? "no_device" : String(e?.message ?? e);
    }
  }

  const video = tab.getVideoTracks()[0];
  // Tab closed or navigated away: finish the recording instead of leaving it open.
  video?.addEventListener("ended", () => chrome.runtime.sendMessage({ type: "twodb-meeting-ended" }).catch(() => {}));

  startRecorder(track, new MediaStream([...tab.getVideoTracks(), ...mix.stream.getAudioTracks()]), "video/webm;codecs=vp8,opus", 2_500_000);
  return { micError };
}

async function startScreenTrack(track, streamId) {
  const screen = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: streamId, maxWidth: 1920, maxHeight: 1080, maxFrameRate: 15 } },
  });
  track.streams.push(screen);
  // Stopped from Chrome's "Stop sharing" bar: the screen track ends, the meeting continues.
  screen.getVideoTracks()[0]?.addEventListener("ended", () => report({ screenEnded: true }));
  startRecorder(track, screen, "video/webm;codecs=vp8", 1_500_000);
}

async function startRecording(msg) {
  if (rec) throw new Error("A recording is already running.");
  await spoolClear(); // leftovers from a crashed session can't be resumed
  rec = {
    serverUrl: (msg.serverUrl || "").replace(/\/+$/, ""),
    apiKey: msg.apiKey,
    recordingId: null,
    tracks: new Map(),
    uploadError: null,
    fatal: false,
    pendingReport: {},
    audioContext: null,
    heartbeat: null,
  };
  try {
    const trackIds = msg.screenStreamId ? ["meeting", "screen"] : ["meeting"];
    const res = await api("/recordings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        platform: msg.platform || "other",
        title: msg.title || null,
        meetingUrl: msg.meetingUrl,
        clientSessionId: crypto.randomUUID(),
        tracks: trackIds.map((trackId) => ({ trackId })),
      }),
    });
    if (!res.ok) throw new Error(`Couldn't start the recording on the server (${res.status}).`);
    const started = await res.json();
    rec.recordingId = started.recordingId;
    const nextSeq = (id) => started.tracks?.find((t) => t.trackId === id)?.nextSeq ?? 1;

    const meeting = newTrack("meeting", nextSeq("meeting"));
    rec.tracks.set("meeting", meeting);
    const { micError } = await startMeetingTrack(meeting, msg.meetingStreamId, msg.withMic);

    let screen = false;
    if (msg.screenStreamId) {
      const track = newTrack("screen", nextSeq("screen"));
      try {
        await startScreenTrack(track, msg.screenStreamId);
        rec.tracks.set("screen", track);
        screen = true;
      } catch (e) {
        console.warn("[twodb-ext] screen track failed; recording the meeting only", e);
      }
    }

    rec.heartbeat = setInterval(() => {
      if (rec?.recordingId) api(`/recordings/${rec.recordingId}/heartbeat`, { method: "POST" }).catch(() => {});
    }, HEARTBEAT_MS);

    return { recordingId: rec.recordingId, startedAt: meeting.startedAt, tracks: { screen, mic: msg.withMic && !micError }, micError };
  } catch (e) {
    const failed = rec;
    rec = null;
    releaseMedia(failed);
    if (failed.recordingId) {
      await fetch(`${failed.serverUrl}/api/meetings/recordings/${failed.recordingId}/abandon`, { method: "POST", headers: { "x-api-key": failed.apiKey } }).catch(() => {});
    }
    throw e;
  }
}

function releaseMedia(r) {
  for (const t of r.tracks.values()) for (const s of t.streams) s.getTracks().forEach((x) => x.stop());
  void r.audioContext?.close().catch(() => {});
  clearInterval(r.heartbeat);
}

async function stopRecorders() {
  const stoppedAt = Date.now();
  await Promise.all(
    [...rec.tracks.values()].map(
      (t) => new Promise((resolve) => (t.recorder && t.recorder.state !== "inactive" ? ((t.recorder.onstop = resolve), t.recorder.stop()) : resolve())),
    ),
  );
  // onstop fires after the last dataavailable; wait for those slices to reach the spool.
  for (const t of rec.tracks.values()) await Promise.all([...t.handlers]);
  releaseMedia(rec);
  return stoppedAt;
}

function remainingChunks() {
  let n = 0;
  for (const t of rec.tracks.values()) n += t.lastSeq - (t.serverNext - 1);
  return n;
}

async function stopRecording() {
  if (!rec) throw new Error("Nothing is recording.");
  const stoppedAt = await stopRecorders();

  let left = remainingChunks();
  let lastProgress = Date.now();
  while (left > 0 && !rec.fatal && Date.now() - lastProgress < DRAIN_IDLE_MS) {
    for (const t of rec.tracks.values()) void pump(t);
    await sleep(500);
    const now = remainingChunks();
    if (now < left) lastProgress = Date.now();
    left = now;
  }

  const r = rec;
  const tracks = [...r.tracks.values()].map((t) => ({
    trackId: t.id,
    totalChunks: t.lastSeq,
    durationMs: stoppedAt - t.startedAt,
    startedAt: new Date(t.startedAt).toISOString(),
  }));
  let finalized = false;
  for (let attempt = 0; attempt < 4 && !finalized; attempt++) {
    const res = await api(`/recordings/${r.recordingId}/finalize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tracks }),
    }).catch(() => null);
    finalized = !!res?.ok || res?.status === 409;
    if (!finalized) await sleep(1000 * 2 ** attempt);
  }
  rec = null;
  await spoolClear(r.recordingId);
  if (!finalized) throw new Error("Couldn't finalize the recording on the server.");
  return { durationMs: stoppedAt - (r.tracks.get("meeting")?.startedAt ?? stoppedAt), missingChunks: left };
}

async function abandonRecording() {
  if (!rec) return;
  const r = rec;
  rec.fatal = true; // stop the upload loop
  await stopRecorders().catch(() => {});
  rec = null;
  await fetch(`${r.serverUrl}/api/meetings/recordings/${r.recordingId}/abandon`, { method: "POST", headers: { "x-api-key": r.apiKey } }).catch(() => {});
  await spoolClear(r.recordingId);
}

// --- messages --------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== "offscreen") return false;
  const run = {
    start: async () => ({ ok: true, ...(await startRecording(msg)) }),
    stop: async () => ({ ok: true, ...(await stopRecording()) }),
    abandon: async () => (await abandonRecording(), { ok: true }),
  }[msg.type];
  if (!run) return false;
  run().then(sendResponse, (e) => sendResponse({ ok: false, error: String(e?.message ?? e) }));
  return true;
});
