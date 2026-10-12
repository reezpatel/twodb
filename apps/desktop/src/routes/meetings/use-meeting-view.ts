import { useMemo } from "react";
import { recordingDurationMs } from "./meetings-api";
import { MOCK_SCRIPT } from "./meetings-mock";
import { useMeetings } from "./meetings-provider";
import { useRecordingPlayer } from "./player/use-recording-player";
import type { ScribeLine } from "./scribe/scribe-panel";

/** The selected meeting's page: player plus the sample transcript spread across its length. */
export function useMeetingView() {
  const s = useMeetings();
  const player = useRecordingPlayer(s.selected);

  const lengthMs = player.durationMs || (s.selected ? recordingDurationMs(s.selected) : 0);
  const lines = useMemo<ScribeLine[]>(() => {
    const step = (lengthMs || MOCK_SCRIPT.length * 20_000) / MOCK_SCRIPT.length;
    return MOCK_SCRIPT.map((l) => ({ speaker: l.speaker, text: l.text, atMs: Math.round(l.at * step) }));
  }, [lengthMs]);

  let activeIndex = -1;
  lines.forEach((l, i) => {
    if (l.atMs <= player.currentMs) activeIndex = i;
  });

  return { s, player, lines, activeIndex: player.currentMs > 0 || player.playing ? activeIndex : -1 };
}
