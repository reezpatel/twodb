import type { ModelPickerConfig, ModelPickerModel } from "./model-picker-types";

export function resolveConfig(model: ModelPickerModel, configs?: Record<string, ModelPickerConfig>): ModelPickerConfig {
  return { ...model.defaultConfig, ...configs?.[model.id] };
}

/** The muted modifiers shown after a model name: effort, Fast, Thinking. */
export function getModifiers(model: ModelPickerModel, config: ModelPickerConfig): string[] {
  return [config.effort, model.supportsFast && config.fast ? "Fast" : null, model.supportsThinking && config.thinking ? "Thinking" : null].filter(
    (modifier): modifier is string => Boolean(modifier),
  );
}
