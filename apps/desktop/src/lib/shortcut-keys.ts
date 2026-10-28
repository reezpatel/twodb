export type ShortcutKey = "mod" | "shift" | "alt" | "ctrl" | (string & {});

export function isMacPlatform() {
  if (typeof navigator === "undefined") return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

const MAC_LABELS: Record<string, string> = { mod: "⌘", shift: "⇧", alt: "⌥", ctrl: "⌃" };
const OTHER_LABELS: Record<string, string> = { mod: "Ctrl", shift: "Shift", alt: "Alt", ctrl: "Ctrl" };

/** Display labels for a shortcut, e.g. ["mod", "1"] → ["⌘", "1"] on macOS and ["Ctrl", "1"] elsewhere. */
export function formatShortcut(keys: ShortcutKey[], mac = isMacPlatform()): string[] {
  const labels = mac ? MAC_LABELS : OTHER_LABELS;
  return keys.map((key) => labels[key] ?? key.toUpperCase());
}
