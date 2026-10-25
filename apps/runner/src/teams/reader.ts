import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { BrowserContext, CDPSession, Page } from "playwright";
import type { TeamsAccountConfig, TeamsEvent, TeamsLiveInput, TeamsAccountStatus } from "@twodb/runner-core";
import { TEAMS_HOME, TEAMS_ACTIVITY, LOGIN_HOST_RE, TEAMS_HOST_RE, scrapeActivityInPage, scrapeUnreadChatsInPage, detectCallToastInPage, classifyActivity } from "./selectors";

/**
 * One watched Teams account: a persistent Chromium profile with two pages —
 * a user page (what the live view shows, where sign-in happens) and a worker
 * page that navigates the activity feed / chat list for scraping. Events are
 * deduped by stable id in <profile>/twodb-state.json.
 */

const DEBUG = process.env.TWODB_TEAMS_DEBUG === "1";
const CALL_POLL_MS = 4_000;
const DEFAULT_POLL_MS = 30_000;

export interface ReaderEmit {
  (msg: { type: string; teamsAccountId: string; status?: TeamsAccountStatus; error?: string; event?: TeamsEvent; viewId?: string; dataBase64?: string }): void;
}

interface SeenState {
  seen: string[];
}

export class TeamsReader {
  private context: BrowserContext | null = null;
  private userPage: Page | null = null;
  private workerPage: Page | null = null;
  private stopped = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private callTimer: ReturnType<typeof setTimeout> | null = null;
  private status: TeamsAccountStatus = "idle";
  private seen = new Set<string>();
  private ringingCallId: string | null = null;
  private cdp: CDPSession | null = null;
  private liveViewId: string | null = null;

  constructor(
    private config: TeamsAccountConfig,
    private profileDir: string,
    private emit: ReaderEmit,
  ) {}

  async start() {
    this.setStatus("starting");
    fs.mkdirSync(this.profileDir, { recursive: true });
    this.loadSeen();
    try {
      const { chromium } = await import("playwright");
      this.context = await chromium.launchPersistentContext(this.profileDir, {
        headless: process.env.TWODB_TEAMS_HEADFUL !== "1",
        executablePath: process.env.TWODB_TEAMS_CHROMIUM_PATH || undefined,
        viewport: { width: 1280, height: 900 },
        args: ["--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage"],
        permissions: ["notifications"],
      });
    } catch (e) {
      const message = (e as Error).message;
      this.setStatus("error", /playwright|executable/i.test(message) ? `chromium unavailable on this runner: ${message.split("\n")[0]}` : message);
      return;
    }

    await this.context.exposeBinding("__twodbTeamsApi", (_source, url: string, json: string) => {
      if (!DEBUG) return;
      const dir = path.join(this.profileDir, "debug-api");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${Date.now()}-${hash(url)}.json`), json);
    });
    await this.context.addInitScript(() => {
      const w = window as unknown as { __twodbTeamsApi?: (url: string, json: string) => void; __twodbPatchedFetch?: boolean };
      if (w.__twodbPatchedFetch) return;
      w.__twodbPatchedFetch = true;
      const original = window.fetch.bind(window);
      window.fetch = async (...args: Parameters<typeof fetch>) => {
        const res = await original(...args);
        try {
          const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
          if (/chatsvc|teams\.microsoft\.com\/api|\/messages|\/conversations/i.test(url) && w.__twodbTeamsApi) {
            res
              .clone()
              .text()
              .then((t) => {
                if (t.length < 2_000_000) w.__twodbTeamsApi!(url, t);
              })
              .catch(() => {});
          }
        } catch {
          // sniffing must never break the app
        }
        return res;
      };
    });

    this.userPage = await this.context.newPage();
    await this.userPage.goto(TEAMS_HOME, { waitUntil: "domcontentloaded" }).catch(() => {});

    this.schedulePoll(5_000);
    this.scheduleCallPoll(CALL_POLL_MS);
  }

  async stop() {
    this.stopped = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.callTimer) clearTimeout(this.callTimer);
    await this.context?.close().catch(() => {});
    this.context = null;
    this.userPage = null;
    this.workerPage = null;
  }

  // --- live view ------------------------------------------------------------

  async liveStart(viewId: string) {
    if (!this.userPage || this.userPage.isClosed() || this.liveViewId) return;
    this.liveViewId = viewId;
    this.cdp = await this.context!.newCDPSession(this.userPage);
    this.cdp.on("Page.screencastFrame", (frame: { data: string; sessionId: number }) => {
      if (this.liveViewId === viewId) {
        this.emit({ type: "teamsLiveFrame", teamsAccountId: this.config.id, viewId, dataBase64: frame.data });
      }
      void this.cdp?.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => {});
    });
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 65, maxWidth: 1280, maxHeight: 900, everyNthFrame: 1 });
  }

  async liveStop(viewId: string) {
    if (this.liveViewId !== viewId) return;
    this.liveViewId = null;
    const cdp = this.cdp;
    this.cdp = null;
    if (cdp) await cdp.send("Page.stopScreencast").catch(() => {});
  }

  async liveInput(input: TeamsLiveInput) {
    const page = this.userPage;
    if (!page || page.isClosed()) return;
    try {
      if (input.kind === "click" && input.x != null && input.y != null) await page.mouse.click(input.x, input.y);
      else if (input.kind === "type" && input.text) await page.keyboard.type(input.text, { delay: 15 });
      else if (input.kind === "key" && input.key) await page.keyboard.press(input.key);
      else if (input.kind === "scroll") await page.mouse.wheel(0, input.deltaY ?? 0);
    } catch {
      // page mid-navigation — drop the input
    }
  }

  // --- polling ----------------------------------------------------------------

  private schedulePoll(delayMs: number) {
    if (this.stopped) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => void this.tick(), delayMs);
  }

  private scheduleCallPoll(delayMs: number) {
    if (this.stopped) return;
    if (this.callTimer) clearTimeout(this.callTimer);
    this.callTimer = setTimeout(() => void this.callTick(), delayMs);
  }

  private async tick() {
    if (this.stopped || !this.context) return;
    try {
      const authed = await this.checkAuth();
      if (!authed) {
        this.schedulePoll(15_000);
        return;
      }
      await this.scrapeOnce();
    } catch (e) {
      if (DEBUG) console.error(`[teams:${this.config.id}] tick failed`, e);
    }
    this.schedulePoll(this.config.pollIntervalMs ?? DEFAULT_POLL_MS);
  }

  /** Fast path: watch for the incoming-call toast on every open page. */
  private async callTick() {
    if (this.stopped || !this.context || this.status !== "running") {
      this.scheduleCallPoll(CALL_POLL_MS);
      return;
    }
    try {
      for (const page of this.context.pages()) {
        const toast = await page.evaluate(detectCallToastInPage).catch(() => null);
        if (toast?.ringing) {
          const caller = toast.caller ?? "Unknown caller";
          if (!this.ringingCallId) {
            this.ringingCallId = `ring:${caller}:${new Date().toISOString().slice(0, 13)}`;
            this.sendEvent({ kind: "call", id: this.ringingCallId, sender: caller, callState: "incoming", url: TEAMS_HOME });
          }
          this.scheduleCallPoll(CALL_POLL_MS);
          return;
        }
      }
      if (this.ringingCallId) {
        this.sendEvent({ kind: "call", id: this.ringingCallId, callState: "ended", url: TEAMS_HOME });
        this.ringingCallId = null;
      }
    } catch {
      // navigation during evaluate — next tick catches up
    }
    this.scheduleCallPoll(CALL_POLL_MS);
  }

  // --- scraping -----------------------------------------------------------------

  /** True when signed in; transitions auth_required ↔ running. */
  private async checkAuth(): Promise<boolean> {
    const page = await this.ensureUserPage();
    const url = page.url();
    if (LOGIN_HOST_RE.test(url)) {
      this.setStatus("auth_required", "Sign-in or 2FA is waiting in the browser session.");
      return false;
    }
    if (TEAMS_HOST_RE.test(url)) {
      // Teams renders a spinner while the session bootstraps — the presence of
      // a password field means we're actually on a login interstitial.
      const hasPassword = await page
        .evaluate(() => !!document.querySelector('input[type="password"]'))
        .catch(() => false);
      if (hasPassword) {
        this.setStatus("auth_required", "Sign-in is waiting in the browser session.");
        return false;
      }
      this.setStatus("running");
      return true;
    }
    // Unknown page (error, landing) — try to get back to the app.
    await page.goto(TEAMS_HOME, { waitUntil: "domcontentloaded" }).catch(() => {});
    return false;
  }

  private async scrapeOnce() {
    const worker = await this.ensureWorkerPage();
    const events: TeamsEvent[] = [];

    await worker.goto(TEAMS_ACTIVITY, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
    await worker.waitForTimeout(3_000);
    const activity = await worker.evaluate(scrapeActivityInPage).catch(() => []);
    if (DEBUG) console.log(`[teams:${this.config.id}] activity items: ${activity.length}`);
    for (const item of activity) {
      const kind = classifyActivity(item.text);
      events.push({
        kind: kind === "call" ? "call" : kind,
        id: `act:${hash(item.id)}`,
        text: item.text,
        ts: item.timeText || null,
        callState: kind === "call" ? "missed" : undefined,
        url: item.href?.startsWith("http") ? item.href : TEAMS_HOME,
      });
    }

    await worker.goto(TEAMS_HOME, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
    await worker.waitForTimeout(2_500);
    const unread = await worker.evaluate(scrapeUnreadChatsInPage).catch(() => []);
    if (DEBUG) console.log(`[teams:${this.config.id}] unread chats: ${unread.length}`);
    for (const chat of unread) {
      events.push({
        kind: "message",
        id: `chat:${hash(`${chat.name}|${chat.preview}`)}`,
        chatName: chat.name,
        text: chat.preview ? `${chat.preview}${chat.unread > 1 ? ` (${chat.unread} unread)` : ""}` : `${chat.unread} unread message${chat.unread > 1 ? "s" : ""}`,
        url: TEAMS_HOME,
      });
    }

    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      this.sendEvent(event);
    }
    this.saveSeen();
  }

  // --- helpers ----------------------------------------------------------------

  private async ensureUserPage(): Promise<Page> {
    if (!this.userPage || this.userPage.isClosed()) {
      this.userPage = await this.context!.newPage();
      await this.userPage.goto(TEAMS_HOME, { waitUntil: "domcontentloaded" }).catch(() => {});
    }
    return this.userPage;
  }

  private async ensureWorkerPage(): Promise<Page> {
    if (!this.workerPage || this.workerPage.isClosed()) {
      this.workerPage = await this.context!.newPage();
    }
    return this.workerPage;
  }

  private setStatus(status: TeamsAccountStatus, error?: string) {
    if (status === this.status && !error) return;
    this.status = status;
    console.log(`[teams:${this.config.id}] ${status}${error ? ` — ${error}` : ""}`);
    this.emit({ type: "teamsStatus", teamsAccountId: this.config.id, status, ...(error ? { error } : {}) });
  }

  private sendEvent(event: TeamsEvent) {
    console.log(`[teams:${this.config.id}] event ${event.kind}: ${event.text ?? event.sender ?? event.id}`.slice(0, 160));
    this.emit({ type: "teamsEvent", teamsAccountId: this.config.id, event });
  }

  private statePath() {
    return path.join(this.profileDir, "twodb-state.json");
  }

  private loadSeen() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.statePath(), "utf8")) as SeenState;
      this.seen = new Set(raw.seen ?? []);
    } catch {
      this.seen = new Set();
    }
  }

  private saveSeen() {
    const seen = [...this.seen].slice(-2_000);
    this.seen = new Set(seen);
    fs.writeFileSync(this.statePath(), JSON.stringify({ seen } satisfies SeenState));
  }
}

function hash(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 16);
}
