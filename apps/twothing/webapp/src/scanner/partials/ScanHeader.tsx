import { Flashlight, FlashlightOff, SwitchCamera, X } from "lucide-react";

const iconBtn = "grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 active:scale-90";

export function ScanHeader({
  title,
  subtitle,
  torch,
  onTorch,
  canSwitch,
  onSwitch,
  onClose,
}: {
  title: string;
  subtitle?: string;
  torch: { supported: boolean; on: boolean };
  onTorch: () => void;
  canSwitch: boolean;
  onSwitch: () => void;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-auto flex items-center gap-2 p-3">
      <button aria-label="Close scanner" className={iconBtn} onClick={onClose}>
        <X className="size-5" />
      </button>
      <div className="min-w-0 flex-1 px-1 text-white drop-shadow">
        <div className="truncate font-semibold">{title}</div>
        {subtitle && <div className="truncate text-xs text-white/70">{subtitle}</div>}
      </div>
      {torch.supported && (
        <button aria-label="Toggle flashlight" className={iconBtn} onClick={onTorch}>
          {torch.on ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
        </button>
      )}
      {canSwitch && (
        <button aria-label="Switch camera" className={iconBtn} onClick={onSwitch}>
          <SwitchCamera className="size-5" />
        </button>
      )}
    </div>
  );
}
