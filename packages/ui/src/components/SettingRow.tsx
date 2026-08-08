import type { ReactNode } from "react";

export interface SettingGroupProps {
  /** Tracked-caps section label. */
  label: string;
  /** Optional quiet line under the label. */
  description?: string;
  children: ReactNode;
}

export function SettingGroup({ label, description, children }: SettingGroupProps) {
  return (
    <section className="tw-sgroup">
      <div className="tw-sgroup__head">
        <span className="tw-cue">{label}</span>
        {description ? <p className="tw-sgroup__desc">{description}</p> : null}
      </div>
      <div className="tw-sgroup__frame">{children}</div>
    </section>
  );
}

export interface SettingRowProps {
  label: string;
  /** Quiet explanation under the label. */
  description?: string;
  /** Control rendered at the row's right edge. */
  control?: ReactNode;
  /** Full-width custom body instead of the label/control split. */
  children?: ReactNode;
}

export function SettingRow({ label, description, control, children }: SettingRowProps) {
  if (children) {
    return (
      <div className="tw-srow tw-srow--custom">
        <div className="tw-srow__text">
          <span className="tw-srow__label">{label}</span>
          {description ? <span className="tw-srow__desc">{description}</span> : null}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="tw-srow">
      <div className="tw-srow__text">
        <span className="tw-srow__label">{label}</span>
        {description ? <span className="tw-srow__desc">{description}</span> : null}
      </div>
      {control ? <div className="tw-srow__control">{control}</div> : null}
    </div>
  );
}
