import { useMemo, useState, type ReactNode } from "react";
import { Layers, Star } from "lucide-react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { ModelPickerContent, ModelPickerMain } from "./model-picker-content";
import { ModelPickerContext } from "./model-picker-context";
import { ModelPickerFooter, ModelPickerShowAll } from "./model-picker-footer";
import { ModelPickerTrigger } from "./model-picker-trigger";
import { ModelItem, ModelList, ModelListEmpty } from "./model-picker-list";
import { ModelOption, ModelPanel, ModelPanelMeta, ModelPanelText, ModelPanelTitle, ModelSection, ModelToggle } from "./model-picker-panel";
import { ModelBrowser, ModelBrowserBody, ModelBrowserContent, ModelBrowserHeader, ModelBrowserMain } from "./model-browser";
import { ModelBrowserEmpty, ModelBrowserList, ModelBrowserRow, ModelBrowserSearch } from "./model-browser-list";
import { ModelBrowserProvider, ModelBrowserProviders, ModelBrowserProvidersLabel } from "./model-browser-providers";
import type { ModelPickedInfo, ModelPickerConfig, ModelPickerModel, ModelPickerProvider } from "./model-picker-types";
import { getModifiers, resolveConfig } from "./model-picker-utils";

export interface ModelPickerProps {
  /** Every model available — can be thousands, the browser virtualizes them. */
  models: ModelPickerModel[];
  /** Provider display names and icons. Derived from `models` when omitted. */
  providers?: ModelPickerProvider[];
  selectedId: string | null;
  /** Config per model id. Models without an entry use their `defaultConfig`. */
  configs?: Record<string, ModelPickerConfig>;
  /** Favorite model ids, in display order. Only these (plus the selected model) show in the popover. */
  favorites: string[];
  onModelPicked: (modelId: string, info: ModelPickedInfo) => void;
  onConfigChanged?: (modelId: string, patch: ModelPickerConfig) => void;
  onFavoriteAdded?: (modelId: string) => void;
  onFavoriteRemoved?: (modelId: string) => void;
  side?: "top" | "bottom";
  disabled?: boolean;
  defaultOpen?: boolean;
  defaultBrowserOpen?: boolean;
  defaultEditingId?: string | null;
  /** A custom trigger element. It becomes the popover trigger as-is (a single element that accepts a ref and props). Defaults to <ModelPickerTrigger />. */
  children?: ReactNode;
}

type BrowserFilter = "all" | "favorites" | (string & {});

export function ModelPicker({
  models,
  providers,
  selectedId,
  configs,
  favorites,
  onModelPicked,
  onConfigChanged,
  onFavoriteAdded,
  onFavoriteRemoved,
  side = "top",
  disabled = false,
  defaultOpen = false,
  defaultBrowserOpen = false,
  defaultEditingId = null,
  children,
}: ModelPickerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [browserOpen, setBrowserOpen] = useState(defaultBrowserOpen);
  const [editingId, setEditingId] = useState<string | null>(defaultEditingId);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BrowserFilter>("all");

  const modelsById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models]);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const providerList = useMemo<ModelPickerProvider[]>(
    () => providers ?? [...new Set(models.map((model) => model.provider))].map((id) => ({ id, label: id })),
    [providers, models],
  );
  const providerLabel = (id: string) => providerList.find((provider) => provider.id === id)?.label ?? id;

  const selected = selectedId ? (modelsById.get(selectedId) ?? null) : null;
  const selectedModifiers = selected ? getModifiers(selected, resolveConfig(selected, configs)) : [];

  const pickerModels = useMemo(() => {
    const list = favorites.map((id) => modelsById.get(id)).filter((model): model is ModelPickerModel => model !== undefined);
    return selected && !favoriteSet.has(selected.id) ? [...list, selected] : list;
  }, [favorites, modelsById, selected, favoriteSet]);

  const providerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const model of models) counts.set(model.provider, (counts.get(model.provider) ?? 0) + 1);
    return counts;
  }, [models]);

  const browserModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    return models.filter((model) => {
      if (filter === "favorites" && !favoriteSet.has(model.id)) return false;
      if (filter !== "all" && filter !== "favorites" && model.provider !== filter) return false;
      return !query || model.label.toLowerCase().includes(query) || model.id.toLowerCase().includes(query);
    });
  }, [models, favoriteSet, filter, search]);

  const panelModel = modelsById.get(editingId ?? previewId ?? "") ?? null;
  const panelConfig = panelModel ? resolveConfig(panelModel, configs) : null;

  const pick = (model: ModelPickerModel, source: ModelPickedInfo["source"]) => onModelPicked(model.id, { oneTime: !favoriteSet.has(model.id), source });
  const toggleFavorite = (id: string) => (favoriteSet.has(id) ? onFavoriteRemoved?.(id) : onFavoriteAdded?.(id));

  const closePopover = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setEditingId(null);
      setPreviewId(null);
    }
  };

  const openBrowser = (next: boolean) => {
    setBrowserOpen(next);
    if (next) {
      setSearch("");
      setFilter("all");
    }
  };

  return (
    <ModelPickerContext.Provider value={{ selected, modifiers: selectedModifiers, disabled }}>
      <Popover open={open && !disabled} onOpenChange={closePopover}>
        <PopoverTrigger asChild>{children ?? <ModelPickerTrigger />}</PopoverTrigger>
        <ModelPickerContent side={side}>
          <ModelPickerMain>
            <ModelList onMouseLeave={() => !editingId && setPreviewId(null)}>
              {pickerModels.length === 0 ? <ModelListEmpty>No favorites yet — star models in the browser.</ModelListEmpty> : null}
              {pickerModels.map((model) => (
                <ModelItem
                  key={model.id}
                  label={model.label}
                  provider={model.provider}
                  modifiers={getModifiers(model, resolveConfig(model, configs))}
                  badge={favoriteSet.has(model.id) ? undefined : "one-time"}
                  selected={model.id === selectedId}
                  editing={model.id === editingId}
                  disabled={model.disabled}
                  onMouseEnter={() => !editingId && setPreviewId(model.id)}
                  onSelect={() => {
                    pick(model, "picker");
                    closePopover(false);
                  }}
                  onEdit={() => {
                    if (model.id !== selectedId) pick(model, "settings");
                    setEditingId(editingId === model.id ? null : model.id);
                  }}
                />
              ))}
            </ModelList>
            <ModelPickerFooter>
              <ModelPickerShowAll
                count={models.length}
                onClick={() => {
                  closePopover(false);
                  openBrowser(true);
                }}
              />
            </ModelPickerFooter>
          </ModelPickerMain>

          {panelModel && panelConfig ? (
            <ModelPanel>
              {editingId ? (
                <>
                  {panelModel.efforts?.length ? (
                    <ModelSection title="Effort">
                      {panelModel.efforts.map((option) => (
                        <ModelOption
                          key={option}
                          label={option}
                          selected={panelConfig.effort === option}
                          onClick={() => onConfigChanged?.(panelModel.id, { effort: option })}
                        />
                      ))}
                    </ModelSection>
                  ) : null}
                  {panelModel.contexts?.length ? (
                    <ModelSection title="Context">
                      {panelModel.contexts.map((option) => (
                        <ModelOption
                          key={option}
                          label={option}
                          selected={panelConfig.context === option}
                          onClick={() => onConfigChanged?.(panelModel.id, { context: option })}
                        />
                      ))}
                    </ModelSection>
                  ) : null}
                  {panelModel.supportsFast || panelModel.supportsThinking ? (
                    <ModelSection title="Modes">
                      {panelModel.supportsFast ? (
                        <ModelToggle
                          label="Fast"
                          selected={Boolean(panelConfig.fast)}
                          onClick={() => onConfigChanged?.(panelModel.id, { fast: !panelConfig.fast })}
                        />
                      ) : null}
                      {panelModel.supportsThinking ? (
                        <ModelToggle
                          label="Thinking"
                          selected={Boolean(panelConfig.thinking)}
                          onClick={() => onConfigChanged?.(panelModel.id, { thinking: !panelConfig.thinking })}
                        />
                      ) : null}
                    </ModelSection>
                  ) : null}
                </>
              ) : (
                <>
                  <ModelPanelTitle>{panelModel.label}</ModelPanelTitle>
                  {panelModel.description ? <ModelPanelText>{panelModel.description}</ModelPanelText> : null}
                  <ModelPanelMeta title="Provider" value={providerLabel(panelModel.provider)} />
                  {panelModel.contexts?.length ? <ModelPanelMeta title="Context" value={panelModel.contexts.join(" · ")} /> : null}
                </>
              )}
            </ModelPanel>
          ) : null}
        </ModelPickerContent>
      </Popover>

      <ModelBrowser open={browserOpen} onOpenChange={openBrowser}>
        <ModelBrowserContent>
          <ModelBrowserHeader title="All models" description="Star models to keep them in your picker, or click a model to use it once." />
          <ModelBrowserBody>
            <ModelBrowserProviders>
              <ModelBrowserProvider label="All models" icon={<Layers />} count={models.length} active={filter === "all"} onClick={() => setFilter("all")} />
              <ModelBrowserProvider
                label="Favorites"
                icon={<Star />}
                count={favorites.length}
                active={filter === "favorites"}
                onClick={() => setFilter("favorites")}
              />
              <ModelBrowserProvidersLabel>Providers</ModelBrowserProvidersLabel>
              {providerList.map((provider) => (
                <ModelBrowserProvider
                  key={provider.id}
                  label={provider.label}
                  icon={provider.icon}
                  count={providerCounts.get(provider.id) ?? 0}
                  active={filter === provider.id}
                  onClick={() => setFilter(provider.id)}
                />
              ))}
            </ModelBrowserProviders>
            <ModelBrowserMain>
              <ModelBrowserSearch value={search} onChange={(event) => setSearch(event.target.value)} />
              <ModelBrowserList
                data={browserModels}
                getKey={(model) => model.id}
                empty={<ModelBrowserEmpty>{search ? `No models match “${search}”.` : "No models here yet."}</ModelBrowserEmpty>}
                renderRow={(model) => (
                  <ModelBrowserRow
                    label={model.label}
                    provider={filter === "all" || filter === "favorites" ? providerLabel(model.provider) : undefined}
                    modelId={model.id}
                    favorite={favoriteSet.has(model.id)}
                    selected={model.id === selectedId}
                    badges={model.badges?.map((badge) => (
                      <span key={badge} className="font-mono text-[10px]">
                        {badge}
                      </span>
                    ))}
                    onToggleFavorite={() => toggleFavorite(model.id)}
                    onSelect={() => {
                      pick(model, "browser");
                      openBrowser(false);
                    }}
                  />
                )}
              />
            </ModelBrowserMain>
          </ModelBrowserBody>
        </ModelBrowserContent>
      </ModelBrowser>
    </ModelPickerContext.Provider>
  );
}
