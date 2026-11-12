import { NavLink, Navigate, useParams } from "react-router";
import { GeneralSettings } from "./GeneralSettings";
import { StatusesSettings, TypesSettings } from "./WorkflowSettings";
import { LabelsSettings, FieldsSettings } from "./LabelsFieldsSettings";
import { TemplatesSettings } from "./TemplatesSettings";
import { DataSettings } from "./DataSettings";

const SECTIONS = [["general", "General", GeneralSettings], ["workflow", "Workflow", () => <><StatusesSettings /><TypesSettings /></>], ["labels", "Labels", LabelsSettings], ["fields", "Custom fields", FieldsSettings], ["templates", "Templates", TemplatesSettings], ["data", "Import, export & sharing", DataSettings]] as const;

export function SettingsPage() {
  const { section } = useParams();
  const current = SECTIONS.find(([id]) => id === section);
  if (!section) return <Navigate to="general" replace />;
  if (!current) return <Navigate to="../general" replace />;
  const Body = current[2];
  return (
    <div className="mx-auto flex w-full max-w-5xl gap-8 px-6 py-6">
      <nav className="flex w-48 shrink-0 flex-col gap-0.5 text-sm">{SECTIONS.map(([id, label]) => <NavLink key={id} to={`../${id}`} relative="path" className={({ isActive }) => `rounded-sm px-2.5 py-1.5 ${isActive ? "bg-stone text-ink" : "text-ink-muted hover:text-ink"}`}>{label}</NavLink>)}</nav>
      <div className="min-w-0 flex-1"><Body /></div>
    </div>
  );
}
