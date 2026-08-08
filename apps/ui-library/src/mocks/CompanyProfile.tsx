import { Badge, DataTable, type DataColumn } from "@twodb/ui";
import {
  Building2,
  FileText,
  Link2,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";

/* ---------------- data ---------------- */

interface DocRow {
  id: string;
  docType: string;
  product: string;
  file: string | null;
  expires: string | null; // ISO date
  template: string | null;
}

const ROWS: DocRow[] = [
  { id: "r1", docType: "Aerodynamic Aluminum Bag", product: "Awesome Bronze", file: null, expires: null, template: null },
  { id: "r2", docType: "Aerodynamic Aluminum Bag", product: "Awesome Bronze", file: "document-2023.pdf", expires: "2026-08-18", template: null },
  { id: "r3", docType: "Awesome Bronze Shirt", product: "Awesome Silk Clock", file: "shirt-image-23980.img", expires: "2026-08-19", template: null },
  { id: "r4", docType: "Aerodynamic Aluminum Bag", product: "Awesome Bronze", file: "document-2023.pdf", expires: "2026-08-18", template: "sign22.pdf" },
  { id: "r5", docType: "Aerodynamic Aluminum Bag", product: "Awesome Bronze", file: null, expires: null, template: null },
  { id: "r6", docType: "Aerodynamic Aluminum Bag", product: "Awesome Bronze", file: "document-2023.pdf", expires: "2026-08-28", template: null },
  { id: "r7", docType: "Aerodynamic Aluminum Bag", product: "Awesome Bronze", file: null, expires: null, template: null },
  { id: "r8", docType: "Awesome Bronze Shirt", product: "Awesome Silk Clock", file: "shirt-image-23980.img", expires: "2026-08-29", template: null },
  { id: "r9", docType: "Quality Manual v4", product: "Awesome Bronze", file: "quality-manual.pdf", expires: "2026-09-24", template: "manual-template.pdf" },
  { id: "r10", docType: "Safety Checklist", product: "Silk Clock Pro", file: "checklist-2026.pdf", expires: "2026-07-12", template: null },
  { id: "r11", docType: "Weld Inspection ISO 3834", product: "Awesome Bronze", file: "weld-report.pdf", expires: "2026-08-11", template: null },
  { id: "r12", docType: "Coating Specification", product: "Silk Clock Pro", file: null, expires: null, template: "coating.dotx" },
];

const CERTS = [
  "ISO 1738:2004",
  "IDF 194:2003",
  "Milk Product ISO",
  "Butter ISO 2234",
  "ISO 2920:2004",
  "ISO 707:2008",
  "IDF 58:2004",
  "ISO 707 · IDF 50:2008",
];

/* ---------------- helpers ---------------- */

type ExpState = "expired" | "soon" | "ok" | "none";

function expState(iso: string | null): ExpState {
  if (!iso) return "none";
  const days = Math.ceil((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return "ok";
}

function ExpirationPill({ iso }: { iso: string | null }) {
  const state = expState(iso);
  if (state === "none") return <Badge tone="neutral">No Expiration</Badge>;
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso! + "T00:00:00"));
  if (state === "expired") return <Badge tone="danger">Expired · {label}</Badge>;
  if (state === "soon") return <Badge tone="warning">{label}</Badge>;
  return <Badge tone="go">{label}</Badge>;
}

function FileChip({ name }: { name: string | null }) {
  if (!name) return <span className="mock-cp__nofile">No File</span>;
  return (
    <span className="mock-cp__file">
      <FileText size={13} aria-hidden="true" />
      {name}
    </span>
  );
}

/* ---------------- table ---------------- */

const EXP_OPTIONS = [
  { value: "expired", label: "Expired" },
  { value: "soon", label: "Expires soon" },
  { value: "ok", label: "Valid" },
  { value: "none", label: "No expiration" },
];

const columns: DataColumn<DocRow>[] = [
  {
    id: "docType",
    label: "Document Type",
    width: 175,
    cell: (r) => r.docType,
    sortValue: (r) => r.docType,
    filter: { kind: "text" },
  },
  {
    id: "product",
    label: "Product",
    width: 110,
    cell: (r) => r.product,
    sortValue: (r) => r.product,
    filter: { kind: "text" },
  },
  {
    id: "file",
    label: "File",
    width: 165,
    cell: (r) => <FileChip name={r.file} />,
    filter: {
      kind: "enum",
      options: [
        { value: "yes", label: "Has file" },
        { value: "no", label: "No file" },
      ],
    },
    filterValue: (r) => (r.file ? "yes" : "no"),
  },
  {
    id: "expires",
    label: "Expiration",
    width: 165,
    cell: (r) => <ExpirationPill iso={r.expires} />,
    sortValue: (r) => r.expires ?? "9999",
    filter: { kind: "enum", options: EXP_OPTIONS },
    filterValue: (r) => expState(r.expires),
  },
  {
    id: "template",
    label: "Template",
    width: 135,
    cell: (r) => <FileChip name={r.template} />,
  },
];

/* ---------------- main ---------------- */

export function CompanyProfileMock() {
  return (
    <div className="mock-cp">
      <header className="mock-cp__hero">
        <span className="mock-cp__logo">S</span>
        <div className="mock-cp__hero-text">
          <span className="mock-cp__name">
            Scrumrails <Badge tone="neutral">Public</Badge>
          </span>
          <span className="mock-cp__tag">All about your scrum delivery.</span>
        </div>
      </header>

      <div className="mock-cp__layout">
        <aside className="mock-cp__side">
          <section className="mock-cp__sec">
            <h4>About</h4>
            <p>
              Leveraging cutting-edge technology and innovative methodologies, ScrumRail empowers
              organizations to optimize their project management processes and enhance productivity.
            </p>
            <button type="button" className="mock-cp__link">
              <Link2 size={13} aria-hidden="true" /> scrumrail.com/
            </button>
          </section>

          <section className="mock-cp__sec">
            <h4>Certifications</h4>
            <div className="mock-cp__certs">
              {CERTS.map((c) => (
                <Badge key={c} tone="go" size="sm">
                  {c}
                </Badge>
              ))}
            </div>
          </section>

          <section className="mock-cp__sec">
            <h4>Company Details</h4>
            <div className="mock-cp__details">
              <span><Building2 size={14} aria-hidden="true" /> Scrumrail LLC</span>
              <span className="tw-tnum"><Phone size={14} aria-hidden="true" /> +49 00 00 0000</span>
              <span><Mail size={14} aria-hidden="true" /> info@scrumrail.com</span>
              <span><MapPin size={14} aria-hidden="true" /> Planetenfeldstraße, Dortmund</span>
            </div>
          </section>
        </aside>

        <div className="mock-cp__main">
          <span className="tw-cue">Company Profile</span>
          <h3>Scrumrail</h3>
          <DataTable
            columns={columns}
            rows={ROWS}
            rowKey={(r) => r.id}
            searchText={(r) => `${r.docType} ${r.product} ${r.file ?? ""} ${r.template ?? ""}`}
            searchPlaceholder="Search for checklist, files, etc."
            pageSize={8}
            emptyMessage="No documents match."
          />
        </div>
      </div>
    </div>
  );
}
