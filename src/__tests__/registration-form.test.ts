import { describe, it, expect } from "vitest";
import {
  validateRegistrationForm,
  validateParticipants,
  getRegistrationFormErrors,
  getEmergencyContactErrors,
  calcAgeFromIsoDate,
  maxDateOfBirthForMinAge,
  splitFullName,
  createEmptyParticipant,
} from "@/lib/registration-form";

describe("registration form validation", () => {
  const valid = {
    firstName: "Alex",
    lastName: "Rossi",
    dateOfBirth: "1995-06-15",
    gender: "",
    email: "alex@example.com",
    mobile: "0400000000",
    emergencyContactName: "Jamie Rossi",
    emergencyContactPhone: "0400000001",
    medicalNotes: "",
    estimatedFinish: "",
    waiverAccepted: true,
  };

  it("accepts valid data", () => {
    expect(validateRegistrationForm(valid)).toBeNull();
  });

  it("requires waiver acceptance", () => {
    expect(validateRegistrationForm({ ...valid, waiverAccepted: false })).toMatch(/waiver/i);
  });

  it("requires emergency contact", () => {
    expect(validateRegistrationForm({ ...valid, emergencyContactPhone: "" })).toMatch(/emergency/i);
  });

  it("rejects an emergency contact matching the single registrant", () => {
    const errors = getRegistrationFormErrors({
      ...valid,
      emergencyContactName: "Alex Rossi",
      emergencyContactPhone: "0400000000",
    });
    expect(errors.emergencyContactName).toMatch(/other than a participant/i);
    expect(errors.emergencyContactPhone).toMatch(/differ from participant/i);
  });

  it("requires participants to be at least 18", () => {
    const latestAllowed = maxDateOfBirthForMinAge();
    const d = new Date(latestAllowed + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const tooYoungIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const errors = getRegistrationFormErrors({ ...valid, dateOfBirth: tooYoungIso });
    expect(errors.dateOfBirth).toMatch(/at least 18/i);
    expect(calcAgeFromIsoDate(latestAllowed)).toBe(18);
  });

  it("returns field-level errors for all missing fields", () => {
    const errors = getRegistrationFormErrors({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      email: "",
      mobile: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      medicalNotes: "",
      estimatedFinish: "",
      waiverAccepted: false,
    });

    expect(errors.firstName).toBeTruthy();
    expect(errors.lastName).toBeTruthy();
    expect(errors.dateOfBirth).toBeTruthy();
    expect(errors.email).toBeTruthy();
    // Phone is optional in the registration form design.
    expect(errors.mobile).toBeUndefined();
    expect(errors.emergencyContactName).toBeTruthy();
    expect(errors.emergencyContactPhone).toBeTruthy();
    expect(errors.waiverAccepted).toBeTruthy();
  });

  it("validates each participant independently", () => {
    const { errors } = validateParticipants([
      createEmptyParticipant(),
      {
        ...createEmptyParticipant(),
        firstName: "Jamie",
        lastName: "Rossi",
        dateOfBirth: "1990-01-01",
        email: "jamie@example.com",
        mobile: "0400000000",
        emergencyContactName: "Alex Rossi",
        emergencyContactPhone: "0400000001",
        waiverAccepted: true,
      },
    ]);

    expect(errors[0]).toBeTruthy();
    expect(errors[1]).toBeUndefined();
  });

  it("uses one shared emergency contact for group registrations", () => {
    const participants = [
      {
        ...createEmptyParticipant(),
        firstName: "Alex",
        lastName: "Rossi",
        dateOfBirth: "1990-01-01",
        email: "alex@example.com",
        mobile: "0400000000",
        waiverAccepted: true,
      },
      {
        ...createEmptyParticipant(),
        firstName: "Jamie",
        lastName: "Rossi",
        dateOfBirth: "1992-02-02",
        email: "jamie@example.com",
        mobile: "0400000002",
        waiverAccepted: true,
      },
    ];

    const { errors, emergencyContactErrors } = validateParticipants(participants, {
      groupRegistration: true,
      sharedEmergencyContact: { name: "Pat Rossi", phone: "0400000003" },
    });

    expect(errors[0]).toBeUndefined();
    expect(errors[1]).toBeUndefined();
    expect(emergencyContactErrors).toEqual({});
  });

  it("rejects shared emergency contact that matches a participant", () => {
    const participants = [
      {
        ...createEmptyParticipant(),
        firstName: "Alex",
        lastName: "Rossi",
        dateOfBirth: "1990-01-01",
        email: "alex@example.com",
        mobile: "0400000000",
        waiverAccepted: true,
      },
    ];

    const nameMatch = getEmergencyContactErrors(
      { name: "Alex Rossi", phone: "0400000003" },
      participants
    );
    expect(nameMatch.emergencyContactName).toMatch(/other than a participant/i);

    const phoneMatch = getEmergencyContactErrors(
      { name: "Pat Rossi", phone: "0400 000 000" },
      participants
    );
    expect(phoneMatch.emergencyContactPhone).toMatch(/differ from participant/i);
  });
});

describe("splitFullName", () => {
  it("splits first and last name", () => {
    expect(splitFullName("Alex Rossi")).toEqual({ firstName: "Alex", lastName: "Rossi" });
  });
});
