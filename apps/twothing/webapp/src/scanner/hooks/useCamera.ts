import { useCallback, useEffect, useRef, useState } from "react";

const FORMATS = ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39", "code_93", "itf", "data_matrix", "codabar", "pdf417", "aztec"];

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

let detectorPromise: Promise<Detector> | null = null;

/** Native BarcodeDetector when the platform has one (Chrome/Android), else the bundled ZXing WASM build (iOS Safari, Firefox, desktop). */
function getDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const native = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
    if (native) {
      const supported = await native.getSupportedFormats().catch(() => [] as string[]);
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.includes("qr_code")) return new native({ formats });
    }
    const [{ BarcodeDetector, prepareZXingModule }, wasm] = await Promise.all([import("barcode-detector/ponyfill"), import("zxing-wasm/reader/zxing_reader.wasm?url")]);
    prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasm.default : prefix + path) } });
    return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
  })();
  return detectorPromise;
}

export type CameraStatus = "idle" | "starting" | "scanning" | "error";

/**
 * Continuous camera decoding. Calls `onCode` for each distinct code; the same
 * code is suppressed for `repeatMs` so holding a label in frame doesn't fire
 * fifty times (but re-scanning it a moment later deliberately does).
 */
export function useCamera(onCode: (code: string) => void, opts: { repeatMs?: number; paused?: boolean } = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const pausedRef = useRef(!!opts.paused);
  pausedRef.current = !!opts.paused;
  const repeatMs = opts.repeatMs ?? 2200;

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(() => localStorage.getItem("twothing.camera"));
  const [lastHit, setLastHit] = useState(0);

  // Every start()/stop() bumps the generation; an in-flight start that finds
  // itself stale (StrictMode double effects, fast camera switching) releases
  // only its own stream and bails without touching state.
  const genRef = useRef(0);

  const stop = useCallback(() => {
    genRef.current++;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setTorch({ supported: false, on: false });
  }, []);

  const start = useCallback(
    async (wantDevice: string | null = deviceId) => {
      stop();
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera needs a secure (https) connection. Use the keyboard field or a USB scanner instead.");
        setStatus("error");
        return;
      }
      setStatus("starting");
      const gen = ++genRef.current;
      let stream: MediaStream | null = null;
      const stale = () => gen !== genRef.current;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: wantDevice
            ? { deviceId: { exact: wantDevice }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        const video = videoRef.current;
        if (stale() || !video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        if (stale()) return;
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorch({ supported: !!caps.torch, on: false });
        navigator.mediaDevices
          .enumerateDevices()
          .then((d) => setCameras(d.filter((x) => x.kind === "videoinput")))
          .catch(() => {});

        const detector = await getDetector();
        if (stale()) return;
        setStatus("scanning");
        let last = { code: "", at: 0 };
        let busy = false;
        const tick = async () => {
          frameRef.current = requestAnimationFrame(() => void tick());
          if (busy || pausedRef.current || video.readyState < 2) return;
          busy = true;
          try {
            const found = await detector.detect(video);
            const code = found[0]?.rawValue?.trim();
            const now = Date.now();
            if (code && (code !== last.code || now - last.at > repeatMs)) {
              last = { code, at: now };
              setLastHit(now);
              onCodeRef.current(code);
            } else if (code) last.at = now; // still in frame → keep suppressing
          } catch {
            // transient decode failures between frames are expected
          } finally {
            busy = false;
          }
        };
        void tick();
      } catch (e) {
        if (stale()) {
          // superseded by a newer start/stop — release only our own stream
          if (stream && stream !== streamRef.current) stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const name = e instanceof DOMException ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera permission was denied — allow it in the browser's site settings."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera found."
              : e instanceof Error
                ? e.message
                : "Couldn't start the camera.",
        );
        if (name === "OverconstrainedError") localStorage.removeItem("twothing.camera");
        setStatus("error");
        stream?.getTracks().forEach((t) => t.stop());
      }
    },
    [deviceId, stop, repeatMs],
  );

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch((t) => ({ ...t, on }));
    } catch {
      setTorch({ supported: false, on: false });
    }
  }, [torch.on]);

  const switchCamera = useCallback(() => {
    if (cameras.length < 2) return;
    const currentId = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
    const idx = cameras.findIndex((c) => c.deviceId === currentId);
    const next = cameras[(idx + 1) % cameras.length].deviceId;
    localStorage.setItem("twothing.camera", next);
    setDeviceId(next);
    void start(next);
  }, [cameras, start]);

  useEffect(() => stop, [stop]);

  return { videoRef, status, error, start, stop, torch, toggleTorch, canSwitch: cameras.length > 1, switchCamera, lastHit };
}
