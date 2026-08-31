import { describe, expect, it } from "vitest";
import {
  compareExportRows,
  excelCellValues,
  excelHeadersFor,
  exportRowsToCsv,
  formatRegistrationStatus,
  formatStartListGroupTitle,
  formatWaveStartTime,
  groupByStartWave,
  mapAndSortExportRows,
  parseExportColumns,
  safeExportFilename,
  toExportRow,
  type ExportRegistrationInput,
} from "@/lib/registration-export";
import { parseCsvTable } from "@/lib/registration-csv";

function base(overrides: Partial<ExportRegistrationInput> = {}): ExportRegistrationInput {
  return {
    id: "r1",
    athleteName: "Alex Turner",
    athleteEmail: "alex@example.com",
    mobile: "0400000001",
    bibNumber: "42",
    startWaveLabel: "Wave A",
    startWaveStartTime: "07:30",
    waveLabel: "Early Bird",
    category: "Open",
    gender: "Male",
    dateOfBirth: "1990-01-15",
    status: "CONFIRMED",
    amountCents: 5500,
    emergencyContactName: "Sam Turner",
    emergencyContactPhone: "0400000099",
    medicalNotes: null,
    resultDistance: null,
    resultTime: null,
    resultPlacement: null,
    ...overrides,
  };
}

describe("formatRegistrationStatus", () => {
  it("maps known statuses to human labels", () => {
    expect(formatRegistrationStatus("CONFIRMED")).toBe("Confirmed");
    expect(formatRegistrationStatus("REFUND_REQUESTED")).toBe("Refund requested");
    expect(formatRegistrationStatus("REFUNDED")).toBe("Refunded");
    expect(formatRegistrationStatus("CANCELLED")).toBe("Cancelled");
  });
});

describe("formatWaveStartTime", () => {
  it("formats HH:mm to 12-hour", () => {
    expect(formatWaveStartTime("07:30")).toBe("7:30 AM");
    expect(formatWaveStartTime("14:00")).toBe("2:00 PM");
  });
});

describe("safeExportFilename", () => {
  it("slugifies event titles", () => {
    expect(safeExportFilename("The Apex Throwdown 2026")).toBe("the-apex-throwdown-2026");
  });
});

describe("toExportRow", () => {
  it("maps start wave, wave start, and category", () => {
    const row = toExportRow(base());
    expect(row.startWave).toBe("Wave A");
    expect(row.waveStartTime).toBe("7:30 AM");
    expect(row.category).toBe("Open");
    expect(row.ticketTier).toBe("Early Bird");
    expect(row.status).toBe("Confirmed");
    expect(row.paidAud).toBe("55.00");
    expect(row.hasMedical).toBe(false);
  });

  it("flags medical notes", () => {
    const row = toExportRow(base({ medicalNotes: "Asthma" }));
    expect(row.hasMedical).toBe(true);
    expect(row.medicalNotes).toBe("Asthma");
  });
});

describe("mapAndSortExportRows", () => {
  it("sorts by wave start time, then bib, then name", () => {
    const rows = mapAndSortExportRows([
      base({ id: "3", athleteName: "Zoe", bibNumber: "2", startWaveLabel: "Wave B", startWaveStartTime: "09:00" }),
      base({ id: "1", athleteName: "Alex", bibNumber: "10", startWaveLabel: "Wave A", startWaveStartTime: "07:30" }),
      base({ id: "2", athleteName: "Ben", bibNumber: "3", startWaveLabel: "Wave A", startWaveStartTime: "07:30" }),
      base({ id: "4", athleteName: "Una", bibNumber: "1", startWaveLabel: null, startWaveStartTime: null }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["2", "1", "3", "4"]);
  });

  it("places unassigned waves after named waves via compare", () => {
    const a = toExportRow(base({ startWaveLabel: "Wave A", bibNumber: "1" }));
    const u = toExportRow(base({ id: "u", startWaveLabel: null, startWaveStartTime: null, bibNumber: "1" }));
    expect(compareExportRows(a, u)).toBeLessThan(0);
  });
});

describe("groupByStartWave", () => {
  it("groups with wave start time in title and keeps Unassigned last", () => {
    const rows = mapAndSortExportRows([
      base({ id: "1", startWaveLabel: "Wave A", startWaveStartTime: "07:30" }),
      base({ id: "2", startWaveLabel: null, startWaveStartTime: null, athleteName: "Una" }),
      base({ id: "3", startWaveLabel: "Wave B", startWaveStartTime: "07:45", athleteName: "Ben", bibNumber: "3" }),
    ]);
    const groups = groupByStartWave(rows);
    expect(groups.map((g) => g.wave)).toEqual(["Wave A", "Wave B", "Unassigned"]);
    expect(formatStartListGroupTitle(groups[0])).toBe("Wave A · 7:30 AM (1)");
    expect(formatStartListGroupTitle(groups[2])).toBe("Unassigned (1)");
  });
});

describe("exportRowsToCsv", () => {
  it("writes machine headers with wave start and category", () => {
    const csv = exportRowsToCsv(mapAndSortExportRows([base()]));
    const { header, rows } = parseCsvTable(csv);
    expect(header).toContain("startwave");
    expect(header).toContain("wavestart");
    expect(header).toContain("category");
    expect(header).toContain("tickettier");
    expect(rows[0][1]).toBe("Alex Turner");
    expect(rows[0][4]).toBe("42");
    expect(rows[0][5]).toBe("Wave A");
    expect(rows[0][6]).toBe("7:30 AM");
    expect(rows[0][7]).toBe("Open");
    expect(rows[0][8]).toBe("Early Bird");
    expect(rows[0][12]).toBe("55.00");
  });

  it("filters CSV columns when a subset is selected", () => {
    const csv = exportRowsToCsv(mapAndSortExportRows([base()]), ["name", "bib", "startWave"]);
    const { header, rows } = parseCsvTable(csv);
    expect(header).toEqual(["registrationid", "name", "bib", "startwave"]);
    expect(rows[0]).toEqual(["r1", "Alex Turner", "42", "Wave A"]);
  });
});

describe("parseExportColumns", () => {
  it("defaults to all columns when empty", () => {
    expect(parseExportColumns(null).length).toBeGreaterThan(10);
    expect(parseExportColumns("")).toEqual(parseExportColumns(null));
  });

  it("keeps name even when omitted", () => {
    expect(parseExportColumns("bib,email")).toEqual(["name", "bib", "email"]);
  });

  it("drops unknown keys and dedupes", () => {
    expect(parseExportColumns("name,bib,name,nope")).toEqual(["name", "bib"]);
  });
});

describe("excel column projection", () => {
  it("projects headers and cells to the selected columns", () => {
    const row = toExportRow(base());
    const keys = parseExportColumns("bib,name,startWave");
    expect(excelHeadersFor(keys)).toEqual(["Bib", "Name", "Start wave"]);
    expect(excelCellValues(row, keys)).toEqual(["42", "Alex Turner", "Wave A"]);
  });
});

// ─── Paid add-ons in exports ─────────────────────────────────────────────────

const tee = {
  nameSnapshot: "Event tee",
  variantLabelSnapshot: "M",
  quantity: 2,
  amountCents: 5000,
  platformFeeCents: 198,
  feeStructure: "athlete",
  status: "PURCHASED",
};

describe("toExportRow — add-ons", () => {
  it("is empty for an entry that bought nothing", () => {
    const row = toExportRow(base());
    expect(row.addOns).toBe("");
    expect(row.addOnsPaidAud).toBe("0.00");
  });

  it("lists items with a hyphen and a quantity", () => {
    const row = toExportRow(base({ addOns: [tee] }));
    expect(row.addOns).toBe("Event tee - M x2");
    expect(row.addOns).not.toContain("—");
  });

  it("joins several items with a semicolon so a CSV cell stays one field", () => {
    const row = toExportRow(
      base({
        addOns: [tee, { ...tee, nameSnapshot: "Cap", variantLabelSnapshot: "", quantity: 1 }],
      }),
    );
    expect(row.addOns).toBe("Event tee - M x2; Cap x1");
  });

  it("totals what the athlete paid, fee included when they paid it", () => {
    expect(toExportRow(base({ addOns: [tee] })).addOnsPaidAud).toBe("51.98");
  });

  it("excludes the fee the organiser absorbed", () => {
    const row = toExportRow(base({ addOns: [{ ...tee, feeStructure: "organiser" }] }));
    expect(row.addOnsPaidAud).toBe("50.00");
  });

  // A refunded shirt is history, not something to pack or to bill for.
  it("drops refunded items from both the list and the total", () => {
    const row = toExportRow(base({ addOns: [{ ...tee, status: "REFUNDED" }] }));
    expect(row.addOns).toBe("");
    expect(row.addOnsPaidAud).toBe("0.00");
  });

  // Until the organiser decides, the item is still the athlete's.
  it("keeps items with a refund still pending", () => {
    const row = toExportRow(base({ addOns: [{ ...tee, status: "REFUND_REQUESTED" }] }));
    expect(row.addOns).toBe("Event tee - M x2");
  });

  it("drops items that were never fulfilled", () => {
    expect(toExportRow(base({ addOns: [{ ...tee, status: "CANCELLED" }] })).addOns).toBe("");
  });

  // The money rule: paidAud stays the entry alone.
  it("never folds add-on money into the entry's paid column", () => {
    const row = toExportRow(base({ addOns: [tee] }));
    expect(row.paidAud).toBe(toExportRow(base()).paidAud);
  });
});

describe("export columns — add-ons", () => {
  it("offers both add-on columns for selection", () => {
    expect(parseExportColumns("addOns,addOnsPaidAud")).toEqual(["name", "addOns", "addOnsPaidAud"]);
  });

  it("flows into the Excel headers and cells automatically", () => {
    expect(excelHeadersFor(["addOns", "addOnsPaidAud"])).toEqual(["Add-ons", "Add-ons paid (AUD)"]);
    const row = toExportRow(base({ addOns: [tee] }));
    expect(excelCellValues(row, ["addOns", "addOnsPaidAud"])).toEqual(["Event tee - M x2", "51.98"]);
  });

  it("survives a CSV round trip as a single field", () => {
    const rows = mapAndSortExportRows([base({ addOns: [tee] })]);
    // A filtered CSV always leads with registrationId, so the chosen columns follow it.
    const csv = exportRowsToCsv(rows, ["name", "addOns"]);
    const parsed = parseCsvTable(csv);
    expect(parsed.header).toEqual(["registrationid", "name", "addons"]);
    expect(parsed.rows[0][2]).toBe("Event tee - M x2");
  });

  // The default CSV writes a fixed column list rather than reading the selection,
  // so a new column has to be added there too or it silently vanishes.
  it("includes add-ons in the default full CSV", () => {
    const rows = mapAndSortExportRows([base({ addOns: [tee] })]);
    const parsed = parseCsvTable(exportRowsToCsv(rows, null));
    const index = parsed.header.indexOf("addons");
    expect(index).toBeGreaterThan(-1);
    expect(parsed.rows[0][index]).toBe("Event tee - M x2");
    expect(parsed.rows[0][parsed.header.indexOf("addonspaidaud")]).toBe("51.98");
  });
});
