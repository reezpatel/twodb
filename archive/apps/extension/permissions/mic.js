const status = (text, cls = "") => {
  const el = document.getElementById("status");
  el.textContent = text;
  el.className = `hint ${cls}`;
};

async function refresh() {
  const p = await navigator.permissions.query({ name: "microphone" }).catch(() => null);
  if (p?.state === "granted") status("Microphone access is allowed. You can close this tab.", "ok");
  if (p?.state === "denied") status("Microphone access is blocked. Click the icon at the left of the address bar to allow it, then reload.", "err");
  return p?.state;
}

document.getElementById("allow").onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    await refresh();
    setTimeout(() => window.close(), 1200);
  } catch (e) {
    if ((await refresh()) !== "denied") status(e?.name === "NotFoundError" ? "No microphone was found." : `Couldn't get access: ${e?.message ?? e}`, "err");
  }
};

void refresh();
