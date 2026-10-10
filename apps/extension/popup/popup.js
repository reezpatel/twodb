const $ = (id) => document.getElementById(id);
const status = (text, cls = "") => {
  $("status").textContent = text;
  $("status").className = `status ${cls}`;
};

const { serverUrl = "http://localhost:3001", apiKey = "", screenDefault = true } = await chrome.storage.local.get(["serverUrl", "apiKey", "screenDefault"]);
$("server").value = serverUrl;
$("key").value = apiKey;
$("screen").checked = screenDefault;

$("save").onclick = async () => {
  await chrome.storage.local.set({
    serverUrl: $("server").value.trim().replace(/\/+$/, ""),
    apiKey: $("key").value.trim(),
    screenDefault: $("screen").checked,
  });
  status("saved", "ok");
};

$("test").onclick = async () => {
  const base = $("server").value.trim().replace(/\/+$/, "");
  const key = $("key").value.trim();
  status("testing…");
  try {
    const res = await fetch(`${base}/api/meetings/recordings?limit=1`, { headers: { "x-api-key": key } });
    if (res.ok) status("connected ✓", "ok");
    else if (res.status === 401) status("invalid API key", "err");
    else status(`server error ${res.status}`, "err");
  } catch (e) {
    status(`unreachable: ${e.message}`, "err");
  }
};

$("keys").onclick = async (e) => {
  e.preventDefault();
  const base = $("server").value.trim().replace(/\/+$/, "");
  const origin = new URL(base).origin;
  chrome.tabs.create({ url: `${origin.replace(":3001", ":5173")}/settings/administrator` });
};

$("record").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return status("no active tab", "err");
  status("starting…");
  const r = await chrome.runtime.sendMessage({ type: "twodb-ui-start", tabId: tab.id });
  if (r?.ok) status(`recording ✓ (${tab.url?.includes("teams") ? "Teams" : "meeting"} tab)`, "ok");
  else status(r?.error ?? "failed", "err");
};

chrome.runtime.sendMessage({ type: "twodb-ui-status" }, (s) => {
  if (chrome.runtime.lastError || !s?.recording) return;
  status(`recording in progress (${s.platform ?? "meeting"})`, "ok");
});
