import { dividerStyles } from "./Divider.style";
export interface DividerProps {
  label?: string;
}

export function Divider({ label }: DividerProps) {
  if (!label) return (
    <>
      <hr className="tw-divider" />
      <style jsx>{dividerStyles}</style>
    </>
  );

  return (
    <div className="tw-divider tw-divider--labeled" role="separator">
      <span className="tw-divider__label">{label}</span>
    </div>
  );
}
