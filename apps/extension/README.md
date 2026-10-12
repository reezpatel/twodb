# twodb Meeting Recorder (Chrome extension)

Records Google Meet, Microsoft Teams and Zoom (web) meetings from your own
browser tab and uploads them to twodb, where they show up under **Meetings**.

Tracks:

- **meeting**: the meeting tab's video, with the tab audio (everyone else) mixed
  with your microphone
- **screen** (optional): a window or screen you pick, video only

## Set up

1. `chrome://extensions` → Developer mode → **Load unpacked** → select `apps/extension`
2. Open the extension popup → **Server settings**: your twodb URL (the one you
   open in the browser) and an org **API key** (Settings → Administrator → API
   keys) → **Save & test**
3. Optional: turn on **Record my microphone** and click **Allow** once. The
   recorder runs in a background document that can't ask for permission itself.

## Recording

Start or stop from any of these. They all share one state, so the in-page
control, popup, menus and toolbar badge always agree:

- the **Record** control on the meeting page (drag it by its grip to move it)
- the toolbar popup
- right-click the meeting page, or right-click the twodb toolbar icon
- **Alt+Shift+R** (change it in `chrome://extensions/shortcuts`)

While recording, the badge shows the minutes recorded. The popup and the
in-page control show a live timer and upload progress.

Chrome only allows tab capture after the extension has been *invoked* on that
tab (toolbar, menu or shortcut). If the in-page button reports this, start once
from one of those instead.

Closing the meeting tab stops and saves the recording.

## How it works

- `sw.js` (service worker) owns the shared state in `chrome.storage.local`
  (`rec`). It brokers capture stream ids, manages the offscreen document, and
  keeps the badge and context menus up to date.
- `offscreen/` runs the MediaRecorders.
  - Capturing a tab mutes it, so its audio is played back to keep the meeting
    audible, and mixed with the microphone into the recorded track.
  - Each 5 s webm slice is written to OPFS as its own file, then uploaded
    strictly in order per track to `POST /api/meetings/recordings/:id/tracks/:track/chunks?seq=N`.
  - On `409 seq_conflict` the upload jumps to the server's expected seq.
    Network errors retry with backoff, and the chunks stay on disk until the
    server acknowledges them.
- On stop, the final slice is spooled, the queue drains (it gives up after 45 s
  without progress), then `finalize` writes the tracks to the
  `meeting_recordings` storage destination.
- `content/content.js` is the in-meeting control (closed shadow DOM, app colors).
- `popup/` holds the recording card, toggles, last recording and server settings.
- `permissions/mic.html` is the one-time microphone grant.
- `ui.css` holds the twodb design tokens shared by the extension pages.
