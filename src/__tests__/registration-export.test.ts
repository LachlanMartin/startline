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
