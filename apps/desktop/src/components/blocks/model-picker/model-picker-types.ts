import type { ReactNode } from "react";

/** Per-model runtime options. Every field is optional — a model only exposes the options it supports. */
export interface ModelPickerConfig {
  effort?: string;
  context?: string;
  fast?: boolean;
  thinking?: boolean;
}

export interface ModelPickerModel {
  id: string;
  label: string;
  /** Provider id, shown as `provider/label` and used to group the browser. */
  provider: string;
  description?: string;
  efforts?: string[];
  contexts?: string[];
  supportsFast?: boolean;
  supportsThinking?: boolean;
  /** Config used until the caller supplies one in `configs`. */
  defaultConfig?: ModelPickerConfig;
  /** Small capability tags shown in the browser, e.g. "thinking", "vision". */
  badges?: string[];
  disabled?: boolean;
}

export interface ModelPickerProvider {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface ModelPickedInfo {
  /** True when the model isn't a favorite — a one-time pick. */
  oneTime: boolean;
  /** Where the pick came from. */
  source: "picker" | "browser" | "settings";
}
