import type { ReactNode } from "react";

/** Per-model runtime options. Every field is optional — a model only exposes the options it supports. */
export interface ModelPickerConfig {
  effort?: string;
  context?: string;
  fast?: boolean;
  thinking?: boolean;
}

export interface ModelPickerModel {
  /** Stable unique key (may be a composite like `connectionId::modelId`). Never shown to users. */
  id: string;
  label: string;
  /** Grouping id, shown as `provider/label` and used to group the browser. */
  provider: string;
  /** Original provider catalog name (e.g. "GLM (z.ai)"), shown in the browser row's second line. Falls back to the provider group label. */
  providerName?: string;
  /** The provider-native model identifier, shown in the browser row — distinct from `id`. */
  modelId?: string;
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
