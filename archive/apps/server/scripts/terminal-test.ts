import WebSocket from "ws";

const cookie = process.argv[2];
const runnerId = process.argv[3];

const ws = new WebSocket("ws://localhost:3001/api/terminal", {
  headers: { cookie, origin: "http://localhost:3001" },
});

let gotWelcomeOutput = false;

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "open", runnerId, cols: 80, rows: 24 }));
  setTimeout(() => {
    ws.send(JSON.stringify({ type: "input", data: "echo hello-from-runner\n" }));
  }, 500);
  setTimeout(() => {
    console.log(gotWelcomeOutput ? "TERMINAL_OK" : "TERMINAL_NO_OUTPUT");
    ws.close();
    process.exit(gotWelcomeOutput ? 0 : 1);
  }, 3000);
});

ws.on("message", (raw) => {
  let msg: { type?: string; data?: string };
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (msg.type === "output" && msg.data?.includes("hello-from-runner")) {
    gotWelcomeOutput = true;
  }
});

ws.on("close", (code, reason) => {
  if (!gotWelcomeOutput) {
    console.log(`closed early: ${code} ${reason}`);
    process.exit(1);
  }
});

ws.on("error", (e) => {
  console.error("ws error:", e.message);
  process.exit(1);
});
