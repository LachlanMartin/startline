import { describe, it, expect } from "vitest";
import { assignSequentialBibs, nextAvailableBib } from "@/lib/bib-assignment";
import { parseCsvTable } from "@/lib/registration-csv";
import { exportRowsToCsv, mapAndSortExportRows } from "@/lib/registration-export";

describe("nextAvailableBib", () => {
  it("returns start when nothing is taken", () => {
    expect(nextAvailableBib({ taken: [], start: 1 })).toBe("1");
  });

  it("skips occupied numbers", () => {
    expect(nextAvailableBib({ taken: ["1", "2", "4"], start: 1 })).toBe("3");
  });

  it("ignores the athlete's current bib so it can be kept or freed", () => {
    expect(nextAvailableBib({ taken: ["1", "2", "3"], start: 1, ignore: "2" })).toBe("2");
  });

  it("rejects invalid start", () => {
    expect(() => nextAvailableBib({ taken: [], start: 0 })).toThrow(/positive integer/);
  });
});

describe("assignSequentialBibs", () => {
  const candidates = [
    { id: "a", name: "Zoe", bibNumber: null, waveLabel: "General" },
    { id: "b", name: "Alex", bibNumber: null, waveLabel: "Early Bird" },
    { id: "c", name: "Mia", bibNumber: "5", waveLabel: "General" },
  ];

  it("assigns by name order starting at start", () => {
    const result = assignSequentialBibs({ candidates, start: 100 });
    expect(result).toEqual([
      { registrationId: "b", bibNumber: "100" },
      { registrationId: "a", bibNumber: "101" },
    ]);
  });

  it("skips taken numbers", () => {
    const result = assignSequentialBibs({
      candidates: [
        { id: "a", name: "Alex", bibNumber: null, waveLabel: null },
        { id: "b", name: "Bea", bibNumber: null, waveLabel: null },
      ],
      start: 1,
      taken: new Set(["1"]),
    });
    expect(result).toEqual([
      { registrationId: "a", bibNumber: "2" },
      { registrationId: "b", bibNumber: "3" },
    ]);
  });

  it("filters by wave", () => {
    const result = assignSequentialBibs({
      candidates,
      start: 1,
      waveFilter: "General",
    });
    expect(result).toEqual([{ registrationId: "a", bibNumber: "1" }]);
  });

  it("can reassign everyone when onlyWithoutBib is false", () => {
    const result = assignSequentialBibs({
      candidates: [
        { id: "c", name: "Mia", bibNumber: "5", waveLabel: "General" },
        { id: "a", name: "Alex", bibNumber: null, waveLabel: "General" },
      ],
      start: 10,
      onlyWithoutBib: false,
      taken: new Set(),
    });
    // Mia's old bib 5 is still in occupied from candidates, but she gets a new one
    expect(result.map((r) => r.registrationId)).toEqual(["a", "c"]);
    expect(result[0].bibNumber).toBe("10");
    expect(result[1].bibNumber).toBe("11");
  });

  it("rejects invalid start", () => {
    expect(() => assignSequentialBibs({ candidates, start: 0 })).toThrow(/positive integer/);
  });
});

describe("registration csv", () => {
  it("round-trips header and a row via export mapper", () => {
    const csv = exportRowsToCsv(
      mapAndSortExportRows([
        {
          id: "r1",
          athleteName: "Alex Turner",
          athleteEmail: "alex@example.com",
          mobile: null,
          bibNumber: "42",
          startWaveLabel: "Wave A",
          startWaveStartTime: "07:30",
          waveLabel: "General",
          category: "Open",
          gender: null,
          dateOfBirth: null,
          status: "CONFIRMED",
          amountCents: 5500,
          emergencyContactName: null,
          emergencyContactPhone: null,
          medicalNotes: null,
          resultDistance: "10km",
          resultTime: "41:05",
          resultPlacement: "8th",
        },
      ]),
    );
    const { header, rows } = parseCsvTable(csv);
    expect(header[0]).toBe("registrationid");
    expect(rows[0][1]).toBe("Alex Turner");
    expect(rows[0][4]).toBe("42");
    expect(rows[0][5]).toBe("Wave A");
    expect(rows[0][6]).toBe("7:30 AM");
    expect(rows[0][7]).toBe("Open");
    expect(rows[0][12]).toBe("55.00");
  });
});
