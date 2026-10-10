# twodb Meeting Recorder (Chrome extension)

Records Google Meet / Microsoft Teams meetings from the user's own browser tab
and uploads them to a twodb server. Two capture tracks:

- **meeting** — the meeting tab (tabCapture): audio + video
- **screen** — an explicitly picked screen/window (desktopCapture), video only

## Load unpacked

1. `chrome://extensions` → Developer mode → **Load unpacked** → select `apps/extension`
2. Open the extension popup → set the twodb server URL + an org **API key**
   (Settings → Administrator → API keys on the desktop app) → **Test**
3. In a Meet/Teams tab, click the red **● Record** button. With the screen
   toggle on, Chrome's picker appears — pick a screen/window. Recording pill
   shows status; **Stop & save** finalizes.

## How it works

- The **service worker** only brokers capture ids (user-gesture bound) and
  opens/closes the offscreen document.
- The **offscreen document** owns both MediaRecorders, spools chunks to OPFS
  with per-chunk metadata in IndexedDB, and uploads sequentially
  (2 in flight, retry with backoff) to `POST /api/meetings/recordings/:id/tracks/:track/chunks?seq=N`.
- Chunks are 5s slices of `video/webm;codecs=vp8,opus`; server-side they
  concatenate into a valid webm (only the first slice has the init segment).
- Server acks `{nextSeq}`; on `409 seq_conflict` the client rewinds to the
  server's expected seq and re-uploads from the OPFS copy.
- Heartbeat every 15s. On stop, remaining chunks drain (≤60s), then
  `finalize` writes tracks + `metadata.json` to the `meeting_recordings`
  storage destination and registers `media_asset` rows.

## Files

- `manifest.json` — MV3, permissions for tabCapture/desktopCapture/offscreen
- `sw.js` — service worker (capture brokering, offscreen lifecycle)
- `offscreen/` — recorders, OPFS + IndexedDB spool, upload loop
- `content/content.js` — in-meeting floating control (shadow DOM)
- `popup/` — server URL + API key config, connection test
