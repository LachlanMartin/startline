import { calcAgeFromIsoDate } from "@/lib/registration-form";
import { formatTime } from "@/lib/utils";

/** Raw registration fields needed for organiser exports. */
export type ExportRegistrationInput = {
  id: string;
  athleteName: string;
  athleteEmail: string;
  mobile: string | null;
  bibNumber: string | null;
  startWaveLabel: string | null;
  /** Wave start as HH:mm (wave override or event start). */
  startWaveStartTime: string | null;
  waveLabel: string | null;
  category: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  status: string;
  amountCents: number;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medicalNotes: string | null;
  resultDistance: string | null;
  resultTime: string | null;
  resultPlacement: string | null;
  /** Merchandise bought with this entry. Absent on callers that do not load it. */
  addOns?: {
    nameSnapshot: string;
    variantLabelSnapshot: string;
    quantity: number;
    amountCents: number;
    platformFeeCents: number;
    feeStructure: string;
    status: string;
  }[];
};

export type ExportRegistrationRow = {
  id: string;
  bib: string;
  name: string;
  email: string;
  mobile: string;
  startWave: string;
  waveStartTime: string;
  waveStartTimeRaw: string;
  category: string;
  ticketTier: string;
  gender: string;
  dateOfBirth: string;
  age: string;
  status: string;
  statusRaw: string;
  paidAud: string;
  emergencyContact: string;
  emergencyPhone: string;
  medicalNotes: string;
  hasMedical: boolean;
  resultDistance: string;
  resultTime: string;
  resultPlacement: string;
  /** "Event tee - M x2; Cap - One size x1", or "" when nothing was bought. */
  addOns: string;
  /** What the athlete paid for merchandise, entry excluded. */
  addOnsPaidAud: string;
};

/** Selectable organiser export fields (Excel + filtered CSV). */
export const EXPORT_COLUMNS = [
  { key: "bib", label: "Bib", width: 8, required: false },
  { key: "name", label: "Name", width: 22, required: true },
  { key: "email", label: "Email", width: 28, required: false },
  { key: "mobile", label: "Mobile", width: 14, required: false },
  { key: "startWave", label: "Start wave", width: 14, required: false },
  { key: "waveStart", label: "Wave start", width: 12, required: false },
  { key: "category", label: "Category", width: 16, required: false },
  { key: "ticketTier", label: "Ticket tier", width: 14, required: false },
  { key: "gender", label: "Gender", width: 12, required: false },
  { key: "dateOfBirth", label: "Date of birth", width: 14, required: false },
  { key: "age", label: "Age", width: 6, required: false },
  { key: "status", label: "Status", width: 16, required: false },
  { key: "paidAud", label: "Paid (AUD)", width: 12, required: false },
  { key: "emergencyContact", label: "Emergency contact", width: 20, required: false },
  { key: "emergencyPhone", label: "Emergency phone", width: 16, required: false },
  { key: "medicalNotes", label: "Medical notes", width: 24, required: false },
  { key: "resultDistance", label: "Result distance", width: 14, required: false },
  { key: "resultTime", label: "Result time", width: 10, required: false },
  { key: "resultPlacement", label: "Result placement", width: 14, required: false },
  { key: "addOns", label: "Add-ons", width: 28, required: false },
  { key: "addOnsPaidAud", label: "Add-ons paid (AUD)", width: 16, required: false },
] as const;

export type ExportColumnKey = (typeof EXPORT_COLUMNS)[number]["key"];

export const DEFAULT_EXPORT_COLUMN_KEYS: ExportColumnKey[] = EXPORT_COLUMNS.map((c) => c.key);

export const EXCEL_HEADERS = EXPORT_COLUMNS.map((c) => c.label);

const EXPORT_COLUMN_BY_KEY = Object.fromEntries(
  EXPORT_COLUMNS.map((c) => [c.key, c]),
) as Record<ExportColumnKey, (typeof EXPORT_COLUMNS)[number]>;

const CELL_GETTERS: Record<ExportColumnKey, (r: ExportRegistrationRow) => string> = {
  bib: (r) => r.bib,
  name: (r) => r.name,
  email: (r) => r.email,
  mobile: (r) => r.mobile,
  startWave: (r) => r.startWave,
  waveStart: (r) => r.waveStartTime,
  category: (r) => r.category,
  ticketTier: (r) => r.ticketTier,
  gender: (r) => r.gender,
  dateOfBirth: (r) => r.dateOfBirth,
  age: (r) => r.age,
  status: (r) => r.status,
  paidAud: (r) => r.paidAud,
  emergencyContact: (r) => r.emergencyContact,
  emergencyPhone: (r) => r.emergencyPhone,
  medicalNotes: (r) => r.medicalNotes,
  resultDistance: (r) => r.resultDistance,
  resultTime: (r) => r.resultTime,
  resultPlacement: (r) => r.resultPlacement,
  addOns: (r) => r.addOns,
  addOnsPaidAud: (r) => r.addOnsPaidAud,
};

/** Machine CSV: key → header (age omitted; status uses raw enum). */
const MACHINE_CSV_FIELD: Partial<Record<ExportColumnKey, { header: string; get: (r: ExportRegistrationRow) => string }>> = {
  name: { header: "name", get: (r) => r.name },
  email: { header: "email", get: (r) => r.email },
  mobile: { header: "mobile", get: (r) => r.mobile },
  bib: { header: "bib", get: (r) => r.bib },
  startWave: { header: "startWave", get: (r) => r.startWave },
  waveStart: { header: "waveStart", get: (r) => r.waveStartTime },
  category: { header: "category", get: (r) => r.category },
  ticketTier: { header: "ticketTier", get: (r) => r.ticketTier },
  gender: { header: "gender", get: (r) => r.gender },
  dateOfBirth: { header: "dateOfBirth", get: (r) => r.dateOfBirth },
  status: { header: "status", get: (r) => r.statusRaw },
  paidAud: { header: "paidAud", get: (r) => r.paidAud },
  emergencyContact: { header: "emergencyContact", get: (r) => r.emergencyContact },
  emergencyPhone: { header: "emergencyPhone", get: (r) => r.emergencyPhone },
  medicalNotes: { header: "medicalNotes", get: (r) => r.medicalNotes },
  addOns: { header: "addOns", get: (r) => r.addOns },
  addOnsPaidAud: { header: "addOnsPaidAud", get: (r) => r.addOnsPaidAud },
  resultDistance: { header: "distance", get: (r) => r.resultDistance },
  resultTime: { header: "time", get: (r) => r.resultTime },
  resultPlacement: { header: "placement", get: (r) => r.resultPlacement },
};

/** Machine CSV headers (advanced / timing systems) — full default set. */
export const MACHINE_CSV_HEADERS = [
  "registrationId",
  "name",
  "email",
  "mobile",
  "bib",
  "startWave",
  "waveStart",
  "category",
  "ticketTier",
  "gender",
  "dateOfBirth",
  "status",
  "paidAud",
  "emergencyContact",
  "emergencyPhone",
  "medicalNotes",
  "distance",
  "time",
  "placement",
  "addOns",
  "addOnsPaidAud",
] as const;

/** Parse `columns=bib,name,email` query; empty/invalid → all columns. Name is always kept. */
export function parseExportColumns(raw: string | null | undefined): ExportColumnKey[] {
  if (!raw?.trim()) return [...DEFAULT_EXPORT_COLUMN_KEYS];
  const allowed = new Set<string>(DEFAULT_EXPORT_COLUMN_KEYS);
  const seen = new Set<ExportColumnKey>();
  const keys: ExportColumnKey[] = [];
  for (const part of raw.split(",")) {
    const key = part.trim() as ExportColumnKey;
    if (!allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  if (keys.length === 0) return [...DEFAULT_EXPORT_COLUMN_KEYS];
  if (!seen.has("name")) keys.unshift("name");
  return keys;
}

export function resolveExportColumns(keys?: ExportColumnKey[] | null) {
  const resolved = keys?.length ? keys : DEFAULT_EXPORT_COLUMN_KEYS;
  return resolved.map((key) => EXPORT_COLUMN_BY_KEY[key]);
}

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmed",
  REFUND_REQUESTED: "Refund requested",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

export function formatRegistrationStatus(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatWaveStartTime(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const trimmed = raw.trim();
  if (!/^\d{1,2}:\d{2}/.test(trimmed)) return trimmed;
  try {
    return formatTime(trimmed.slice(0, 5));
  } catch {
    return trimmed;
  }
}

export function safeExportFilename(title: string): string {
  return title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event";
}

function bibSortKey(bib: string | null): number {
  if (!bib) return Number.POSITIVE_INFINITY;
  const n = parseInt(bib, 10);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function waveTimeSortKey(raw: string): number {
  if (!raw) return Number.POSITIVE_INFINITY;
  const [h, m] = raw.split(":").map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.POSITIVE_INFINITY;
  return h * 60 + m;
}

/** Race-day sort: wave start → start wave label → bib → name. Unassigned last. */
export function compareExportRows(a: ExportRegistrationRow, b: ExportRegistrationRow): number {
  const timeDiff = waveTimeSortKey(a.waveStartTimeRaw) - waveTimeSortKey(b.waveStartTimeRaw);
  if (timeDiff !== 0) return timeDiff;
  const waveA = a.startWave || "\uffff";
  const waveB = b.startWave || "\uffff";
  if (waveA !== waveB) return waveA.localeCompare(waveB);
  const bibDiff = bibSortKey(a.bib || null) - bibSortKey(b.bib || null);
  if (bibDiff !== 0) return bibDiff;
  return a.name.localeCompare(b.name);
}

/**
 * Add-on statuses that represent goods the organiser still has to hand over.
 * A refunded item stays in the database as history but must not appear on a
 * picking list or count toward what the athlete paid.
 */
const EXPORTED_ADDON_STATUSES = new Set(["PURCHASED", "REFUND_REQUESTED"]);

type ExportAddOn = NonNullable<ExportRegistrationInput["addOns"]>[number];

function liveAddOns(addOns: ExportRegistrationInput["addOns"]): ExportAddOn[] {
  return (addOns ?? []).filter((a) => EXPORTED_ADDON_STATUSES.has(a.status));
}

/** "Event tee - M x2; Cap - One size x1". Hyphens, so it survives a CSV cleanly. */
export function formatAddOnsCell(addOns: ExportRegistrationInput["addOns"]): string {
  return liveAddOns(addOns)
    .map((a) => {
      const label = a.variantLabelSnapshot
        ? `${a.nameSnapshot} - ${a.variantLabelSnapshot}`
        : a.nameSnapshot;
      return `${label} x${a.quantity}`;
    })
    .join("; ");
}

/** What the athlete paid for merchandise on this entry, in dollars. */
export function addOnsPaidCents(addOns: ExportRegistrationInput["addOns"]): number {
  return liveAddOns(addOns).reduce(
    (sum, a) => sum + a.amountCents + (a.feeStructure === "athlete" ? a.platformFeeCents : 0),
    0,
  );
}

export function toExportRow(r: ExportRegistrationInput): ExportRegistrationRow {
  const age =
    r.dateOfBirth && calcAgeFromIsoDate(r.dateOfBirth) > 0
      ? String(calcAgeFromIsoDate(r.dateOfBirth))
      : "";
  const waveStartTimeRaw = r.startWaveStartTime?.trim() ?? "";
  return {
    id: r.id,
    bib: r.bibNumber ?? "",
    name: r.athleteName,
    email: r.athleteEmail,
    mobile: r.mobile ?? "",
    startWave: r.startWaveLabel ?? "",
    waveStartTime: formatWaveStartTime(waveStartTimeRaw || null),
    waveStartTimeRaw,
    category: r.category ?? "",
    ticketTier: r.waveLabel ?? "",
    gender: r.gender ?? "",
    dateOfBirth: r.dateOfBirth ?? "",
    age,
    status: formatRegistrationStatus(r.status),
    statusRaw: r.status,
    paidAud: (r.amountCents / 100).toFixed(2),
    emergencyContact: r.emergencyContactName ?? "",
    emergencyPhone: r.emergencyContactPhone ?? "",
    medicalNotes: r.medicalNotes ?? "",
    hasMedical: Boolean(r.medicalNotes?.trim()),
    resultDistance: r.resultDistance ?? "",
    resultTime: r.resultTime ?? "",
    resultPlacement: r.resultPlacement ?? "",
    addOns: formatAddOnsCell(r.addOns),
    // Kept separate from paidAud, which stays the entry alone.
    addOnsPaidAud: (addOnsPaidCents(r.addOns) / 100).toFixed(2),
  };
}

export function mapAndSortExportRows(rows: ExportRegistrationInput[]): ExportRegistrationRow[] {
  return rows.map(toExportRow).sort(compareExportRows);
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Advanced machine CSV from mapped rows. Optional column filter (Name always included). */
export function exportRowsToCsv(
  rows: ExportRegistrationRow[],
  columnKeys?: ExportColumnKey[] | null,
): string {
  const keys = parseExportColumns(columnKeys?.join(",") ?? null);
  const fields = keys
    .map((key) => MACHINE_CSV_FIELD[key])
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  // Full default set when every machine field is selected (preserves registrationId + order).
  const usingDefaults = keys.length === DEFAULT_EXPORT_COLUMN_KEYS.length;
  if (usingDefaults) {
    const lines = [MACHINE_CSV_HEADERS.join(",")];
    for (const r of rows) {
      const cells = [
        r.id,
        r.name,
        r.email,
        r.mobile,
        r.bib,
        r.startWave,
        r.waveStartTime,
        r.category,
        r.ticketTier,
        r.gender,
        r.dateOfBirth,
        r.statusRaw,
        r.paidAud,
        r.emergencyContact,
        r.emergencyPhone,
        r.medicalNotes,
        r.resultDistance,
        r.resultTime,
        r.resultPlacement,
        r.addOns,
        r.addOnsPaidAud,
      ].map((c) => escapeCsvCell(String(c)));
      lines.push(cells.join(","));
    }
    return lines.join("\n") + "\n";
  }

  const headers = ["registrationId", ...fields.map((f) => f.header)];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const cells = [r.id, ...fields.map((f) => f.get(r))].map((c) => escapeCsvCell(String(c)));
    lines.push(cells.join(","));
  }
  return lines.join("\n") + "\n";
}

export function excelHeadersFor(columnKeys?: ExportColumnKey[] | null): string[] {
  return resolveExportColumns(columnKeys).map((c) => c.label);
}

export function excelWidthsFor(columnKeys?: ExportColumnKey[] | null): number[] {
  return resolveExportColumns(columnKeys).map((c) => c.width);
}

export function excelCellValues(
  r: ExportRegistrationRow,
  columnKeys?: ExportColumnKey[] | null,
): string[] {
  const keys = columnKeys?.length ? columnKeys : DEFAULT_EXPORT_COLUMN_KEYS;
  return keys.map((key) => CELL_GETTERS[key](r));
}

export type StartListGroup = {
  wave: string;
  waveStartTime: string;
  rows: ExportRegistrationRow[];
};

/**
 * Group rows by start wave for PDF / Excel section layout.
 * Preserves race-day order from the already-sorted export rows; Unassigned last.
 */
export function groupByStartWave(rows: ExportRegistrationRow[]): StartListGroup[] {
  const map = new Map<string, ExportRegistrationRow[]>();
  for (const r of rows) {
    const key = r.startWave || "Unassigned";
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  const groups = Array.from(map.entries()).map(([wave, groupRows]) => ({
    wave,
    waveStartTime: groupRows.find((r) => r.waveStartTime)?.waveStartTime ?? "",
    rows: groupRows,
  }));
  // Stable: named waves keep encounter order; Unassigned always last.
  groups.sort((a, b) => {
    if (a.wave === "Unassigned") return 1;
    if (b.wave === "Unassigned") return -1;
    return 0;
  });
  return groups;
}

export function formatStartListGroupTitle(g: StartListGroup): string {
  const timeBit = g.waveStartTime ? ` · ${g.waveStartTime}` : "";
  return `${g.wave}${timeBit} (${g.rows.length})`;
}
