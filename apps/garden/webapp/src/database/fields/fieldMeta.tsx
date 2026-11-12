import {
  AtSign,
  Calendar,
  CheckSquare,
  CircleDot,
  Clock,
  Hash,
  Link2,
  List,
  Phone,
  Sigma,
  SquareFunction,
  Tags,
  Text,
  Type,
  User,
  ArrowUpRight,
  Loader,
  History,
  UserCircle,
} from "lucide-react";
import type { FieldType, UserFieldType } from "@shared/model";
import { FIELD_TYPE_LABELS } from "@shared/model";

const ICONS: Record<FieldType, typeof Text> = {
  title: Type,
  text: Text,
  number: Hash,
  select: CircleDot,
  multi_select: Tags,
  status: Loader,
  date: Calendar,
  checkbox: CheckSquare,
  url: Link2,
  email: AtSign,
  phone: Phone,
  person: User,
  relation: ArrowUpRight,
  rollup: Sigma,
  formula: SquareFunction,
  created_time: Clock,
  updated_time: History,
  created_by: UserCircle,
};

export function FieldIcon({ type, size = 14, className }: { type: FieldType; size?: number; className?: string }) {
  const Icon = ICONS[type] ?? List;
  return <Icon size={size} strokeWidth={1.7} className={className ?? "shrink-0 text-ink-muted"} />;
}

/** Order + grouping in the "add property" / "change type" menus. */
export const TYPE_MENU: { group: string; types: UserFieldType[] }[] = [
  { group: "Basic", types: ["text", "number", "select", "multi_select", "status", "date", "checkbox", "person"] },
  { group: "Contact", types: ["url", "email", "phone"] },
  { group: "Advanced", types: ["relation", "rollup", "formula"] },
];

export const typeLabel = (t: FieldType) => FIELD_TYPE_LABELS[t];

/** Fields whose value the user edits directly. */
export const isEditable = (t: FieldType) => !["rollup", "formula", "created_time", "updated_time", "created_by"].includes(t);
