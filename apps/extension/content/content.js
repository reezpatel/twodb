// In-meeting floating control. Shadow DOM so Meet/Teams styles never bleed
// in. Sends user-gesture-initiated messages to the service worker.

(() => {
  if (window.__twodbRecorderInjected) return;
  window.__twodbRecorderInjected = true;

  const HOST_ID = "twodb-recorder-host";
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "position:fixed;z-index:2147483647;top:16px;right:16px;";
    const shadow = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      .wrap { display:flex; flex-direction:column; gap:6px; align-items:flex-end; font-family: system-ui, sans-serif; }
      .pill { display:inline-flex; align-items:center; gap:8px; background:#0a0a0acc; color:#fafafa; border:1px solid #ffffff26;
              border-radius:999px; padding:8px 14px; font-size:13px; backdrop-filter:blur(6px); user-select:none; }
      .btn { cursor:pointer; border:none; background:#ef4444; color:white; font-size:13px; font-weight:600;
             padding:8px 16px; border-radius:999px; display:inline-flex; align-items:center; gap:8px; }
      .btn:hover { background:#dc2626; }
      .btn.stop { background:#171717; border:1px solid #ffffff33; }
      .dot { width:8px; height:8px; border-radius:50%; background:white; animation:blink 1.2s infinite; }
      @keyframes blink { 50% { opacity:.25; } }
      .screen-toggle { cursor:pointer; font-size:12px; color:#a3a3a3; display:inline-flex; align-items:center; gap:4px; }
    `;
    shadow.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "wrap";

    const idle = document.createElement("button");
    idle.className = "btn";
    idle.textContent = "● Record";

    const recordingPill = document.createElement("span");
    recordingPill.className = "pill";
    recordingPill.style.display = "none";

    const screenToggle = document.createElement("label");
    screenToggle.className = "screen-toggle";
    const screenCheckbox = document.createElement("input");
    screenCheckbox.type = "checkbox";
    screenCheckbox.checked = true;
    screenToggle.append(screenCheckbox, document.createTextNode("screen"));

    wrap.append(idle, recordingPill);
    shadow.append(wrap);

    const send = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : r)));

    const setState = (recording, note = "") => {
      idle.style.display = recording ? "none" : "inline-flex";
      if (!recording) {
        shadow.querySelector(".wrap").contains(screenToggle) && screenToggle.remove();
        wrap.appendChild(screenToggle);
      }
      recordingPill.style.display = recording ? "inline-flex" : "none";
      recordingPill.textContent = "";
      if (recording) {
        const dot = document.createElement("span");
        dot.className = "dot";
        recordingPill.append(dot, document.createTextNode(note || "Recording"));
        const stop = document.createElement("button");
        stop.className = "btn stop";
        stop.textContent = "Stop & save";
        stop.onclick = async (e) => {
          e.stopPropagation();
          stop.disabled = true;
          stop.textContent = "Saving…";
          const r = await send({ type: "twodb-ui-stop" });
          setState(false, "");
          if (!r?.ok) alert(`twodb recorder: stop failed — ${r?.error ?? "unknown"}`);
        };
        wrap.appendChild(stop);
      } else {
        wrap.querySelector(".btn.stop")?.remove();
      }
    };

    idle.onclick = async () => {
      idle.disabled = true;
      idle.textContent = "Starting…";
      const r = await send({ type: "twodb-ui-start", withScreen: screenCheckbox.checked });
      idle.disabled = false;
      idle.textContent = "● Record";
      if (r?.ok) setState(true, r.platform === "teams" ? "Recording (Teams)" : "Recording");
      else alert(`twodb recorder: ${r?.error ?? "failed to start"}`);
    };

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === "twodb-screen-ended") setState(true, "Recording (screen ended)");
    });

    // reflect current state on (re)injection
    send({ type: "twodb-ui-status" }).then((s) => setState(!!s?.recording));

    document.documentElement.appendChild(host);
  }
})();
