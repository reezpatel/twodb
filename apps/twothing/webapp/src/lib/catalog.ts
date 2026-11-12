import {
  Archive,
  Box,
  Brush,
  Cable,
  CircuitBoard,
  Container,
  DoorOpen,
  FlaskConical,
  Hammer,
  HardDrive,
  Inbox,
  LayoutGrid,
  MapPin,
  Nut,
  Package,
  Rows3,
  Server,
  Shapes,
  ShoppingBag,
  Spool,
  type LucideIcon,
} from "lucide-react";

export interface Category {
  id: string;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Tailwind-safe hex — used for tints, chart bars and the label stripe. */
  color: string;
  /** Spec keys offered (as ready-to-fill rows) when adding an item of this kind. */
  specs: string[];
  units: string[];
  /** Quick-pick tag suggestions. */
  tags: string[];
  /** Example names for the "name" placeholder. */
  example: string;
}

export const CATEGORIES: Category[] = [
  {
    id: "electronics",
    label: "Electronic components",
    short: "Electronics",
    icon: CircuitBoard,
    color: "#4f63ad",
    specs: ["Value", "Package", "Voltage", "Current", "Tolerance", "Power"],
    units: ["pcs", "reel", "strip", "m"],
    tags: ["resistor", "capacitor", "IC", "MCU", "sensor", "module", "LED", "transistor", "diode", "connector", "SMD", "THT"],
    example: "ESP32-C3 dev board",
  },
  {
    id: "computer",
    label: "Computer parts",
    short: "Computer",
    icon: HardDrive,
    color: "#7c5cbf",
    specs: ["Model", "Capacity", "Interface", "Form factor", "Serial no.", "Condition"],
    units: ["pcs", "set"],
    tags: ["SSD", "HDD", "RAM", "GPU", "CPU", "PSU", "motherboard", "fan", "NIC", "spare", "for sale"],
    example: "Samsung 970 EVO 1TB",
  },
  {
    id: "cables",
    label: "Cables & connectors",
    short: "Cables",
    icon: Cable,
    color: "#2f8f8a",
    specs: ["Type", "Length", "Connector A", "Connector B", "Gauge", "Rating"],
    units: ["pcs", "m", "spool"],
    tags: ["USB-C", "HDMI", "Ethernet", "power", "jumper", "JST", "Dupont", "XT60", "wire"],
    example: "USB-C to C 1m 100W",
  },
  {
    id: "hardware",
    label: "Hardware & fasteners",
    short: "Hardware",
    icon: Nut,
    color: "#b4791f",
    specs: ["Size", "Thread", "Length", "Material", "Head", "Finish"],
    units: ["pcs", "box", "bag", "kg", "m"],
    tags: ["screw", "bolt", "nut", "washer", "standoff", "insert", "bracket", "hinge", "magnet", "spring"],
    example: "M3×10 socket head, stainless",
  },
  {
    id: "tools",
    label: "Tools",
    short: "Tools",
    icon: Hammer,
    color: "#c8323f",
    specs: ["Brand", "Model", "Power", "Battery", "Tip / bit", "Serial no."],
    units: ["pcs", "set"],
    tags: ["hand tool", "power tool", "measuring", "soldering", "cutting", "clamp", "bits", "borrowed"],
    example: "Pinecil soldering iron",
  },
  {
    id: "art_craft",
    label: "Art & craft",
    short: "Art & craft",
    icon: Brush,
    color: "#d9608a",
    specs: ["Color", "Brand", "Size", "Material", "Finish", "Pack"],
    units: ["pcs", "pack", "sheet", "roll", "ml", "g", "m"],
    tags: ["paint", "brush", "paper", "yarn", "fabric", "glue", "beads", "marker", "resin", "clay", "ribbon"],
    example: "Acrylic paint — Cadmium red 75ml",
  },
  {
    id: "printing",
    label: "3D printing",
    short: "3D print",
    icon: Spool,
    color: "#3f8a5c",
    specs: ["Material", "Color", "Diameter", "Weight", "Brand", "Temp"],
    units: ["spool", "kg", "g", "pcs"],
    tags: ["PLA", "PETG", "TPU", "ABS", "resin", "nozzle", "spare part", "opened"],
    example: "PETG 1.75mm Galaxy black 1kg",
  },
  {
    id: "consumables",
    label: "Consumables",
    short: "Consumables",
    icon: FlaskConical,
    color: "#5f7f9e",
    specs: ["Type", "Brand", "Volume", "Expiry"],
    units: ["pcs", "ml", "g", "roll", "tube", "can"],
    tags: ["solder", "flux", "tape", "glue", "IPA", "heat shrink", "zip tie", "battery", "lubricant"],
    example: "Kapton tape 20mm",
  },
  {
    id: "other",
    label: "Other",
    short: "Other",
    icon: Shapes,
    color: "#6b6b6b",
    specs: [],
    units: ["pcs"],
    tags: [],
    example: "Thing",
  },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
export const categoryOf = (id: string | null | undefined): Category => BY_ID.get(id ?? "") ?? { ...CATEGORIES[CATEGORIES.length - 1], id: id ?? "other", label: id ?? "Other", short: id ?? "Other" };

export const ALL_UNITS = [...new Set(CATEGORIES.flatMap((c) => c.units))];

export interface PlaceKind {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const PLACE_KINDS: PlaceKind[] = [
  { id: "room", label: "Room", icon: DoorOpen },
  { id: "cabinet", label: "Cabinet", icon: Archive },
  { id: "shelf", label: "Shelf", icon: Rows3 },
  { id: "rack", label: "Rack", icon: Server },
  { id: "drawer", label: "Drawer", icon: Inbox },
  { id: "organizer", label: "Organizer", icon: LayoutGrid },
  { id: "bin", label: "Bin", icon: Container },
  { id: "box", label: "Box", icon: Package },
  { id: "bag", label: "Bag", icon: ShoppingBag },
  { id: "other", label: "Other", icon: MapPin },
];
const KIND_BY_ID = new Map(PLACE_KINDS.map((k) => [k.id, k]));
export const kindOf = (id: string | null | undefined): PlaceKind => KIND_BY_ID.get(id ?? "") ?? { id: id ?? "other", label: id ?? "Place", icon: Box };
