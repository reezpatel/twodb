import { useCallback, useEffect, useRef, useState } from "react";

const FORMATS = ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39", "itf", "data_matrix"];

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

async function createDetector(): Promise<Detector> {
  const native = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (native) {
    const supported = await native.getSupportedFormats().catch(() => FORMATS);
    const formats = FORMATS.filter((f) => supported.includes(f));
    if (formats.length > 0) return new native({ formats });
  }
  const [{ BarcodeDetector, prepareZXingModule }, wasm] = await Promise.all([import("barcode-detector/ponyfill"), import("zxing-wasm/reader/zxing_reader.wasm?url")]);
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasm.default : prefix + path) },
  });
  return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
}

export type ScannerStatus = "idle" | "starting" | "scanning" | "error";

/** Camera barcode scanning: native BarcodeDetector when present, otherwise
 *  the bundled ZXing WASM ponyfill (Safari / WebKitGTK). */
export function useScanner(onCode: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access needs a secure (https) connection.");
      setStatus("error");
      return;
    }
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      const detector = await createDetector();
      setStatus("scanning");
      let last = { code: "", at: 0 };
      let busy = false;
      const tick = async () => {
        frameRef.current = requestAnimationFrame(() => void tick());
        if (busy || video.readyState < 2) return;
        busy = true;
        try {
          const found = await detector.detect(video);
          const code = found[0]?.rawValue;
          const now = Date.now();
          if (code && (code !== last.code || now - last.at > 2500)) {
            last = { code, at: now };
            onCodeRef.current(code);
          }
        } catch {
          // transient decode failures are expected between frames
        } finally {
          busy = false;
        }
      };
      void tick();
    } catch (e) {
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Camera permission was denied." : e instanceof Error ? e.message : "Couldn't start the camera.");
      setStatus("error");
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { videoRef, status, error, start, stop };
}
