export interface RegistrationFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  mobile: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalNotes: string;
  /** Optional self-reported estimated finish time, entered as "h:mm" or plain minutes. */
  estimatedFinish: string;
  waiverAccepted: boolean;
}

export type RegistrationFormField = keyof RegistrationFormData;

export type RegistrationFormErrors = Partial<Record<RegistrationFormField, string>>;

export type ParticipantFormErrors = Record<number, RegistrationFormErrors>;

export type EmergencyContactErrors = Partial<
  Pick<RegistrationFormErrors, "emergencyContactName" | "emergencyContactPhone">
>;

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface ValidateParticipantsOptions {
  groupRegistration?: boolean;
  sharedEmergencyContact?: EmergencyContact;
  includeWaiver?: boolean;
}

export const MAX_REGISTRATION_PARTICIPANTS = 10;
export const MIN_REGISTRATION_AGE = 18;
// Each participant is round-tripped through a single Stripe PaymentIntent
// metadata value (500-char hard limit). Cap the free-text medical note so the
// serialised participant always fits alongside the other fields.
export const MAX_MEDICAL_NOTES_LENGTH = 200;

export interface CompactParticipant {
  fn: string;
  ln: string;
  dob: string;
  gen?: string;
  em: string;
  mob: string;
  ecn: string;
  ecp: string;
  med?: string;
  /** Ticket tier (wave label) this participant's ticket belongs to. */
  wav?: string;
  /** Estimated finish time in whole minutes. */
  eft?: number;
}

/**
 * Parse a finish estimate into whole minutes. Accepts "h:mm" (e.g. "3:30" → 210),
 * or a plain minutes number (e.g. "45" → 45). Returns null for blank/invalid input.
 */
export function parseFinishToMinutes(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const colon = raw.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (colon) {
    return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);
  }
  if (/^\d{1,4}$/.test(raw)) {
    return parseInt(raw, 10);
  }
  return null;
}

/** Format whole minutes back to "h:mm" (e.g. 210 → "3:30", 45 → "0:45"). */
export function formatFinishMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** One line of a mixed-tier ticket selection: how many tickets of each tier. */
export interface TicketSelection {
  waveLabel: string;
  quantity: number;
}

export const GENDER_OPTIONS = ["Prefer not to say", "Male", "Female", "Non-binary", "Other"] as const;

export function splitFullName(name: string | null | undefined): { firstName: string; lastName: string } {
  if (!name?.trim()) return { firstName: "", lastName: "" };
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

/** Convert Cognito E.164 (+614…) to local AU display (04…). */
export function formatPhoneForDisplay(phone: string): string {
  const raw = phone.trim().replace(/[\s\-()]/g, "");
  if (raw.startsWith("+61")) return "0" + raw.slice(3);
  if (raw.startsWith("61") && raw.length > 2) return "0" + raw.slice(2);
  return phone.trim();
}

function parseIsoDateLocal(dateOfBirth: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const parsed = new Date(dateOfBirth + "T00:00:00");
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function calcAgeFromIsoDate(dateOfBirth: string): number {
  const dob = parseIsoDateLocal(dateOfBirth);
  if (!dob) return 0;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/** Latest allowed DOB for a minimum age (e.g. 18 → born on or before this date). */
export function maxDateOfBirthForMinAge(minAge: number = MIN_REGISTRATION_AGE): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - minAge);
  // Build from local date parts to match calcAgeFromIsoDate (which parses the
  // DOB at local midnight). Using toISOString() here would shift the boundary
  // by a day in timezones ahead of UTC, mis-gating people born exactly minAge
  // years ago.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isValidIsoDate(dateOfBirth: string): boolean {
  return parseIsoDateLocal(dateOfBirth) !== null;
}

export function getRegistrationFormErrors(
  data: RegistrationFormData,
  options?: { includeEmergencyContact?: boolean; includeWaiver?: boolean }
): RegistrationFormErrors {
  const errors: RegistrationFormErrors = {};
  const includeEmergencyContact = options?.includeEmergencyContact !== false;
  // Waiver/terms acceptance is a single gate on the review step, so step-1
  // detail validation opts out of it.
  const includeWaiver = options?.includeWaiver !== false;

  if (!data.firstName.trim()) errors.firstName = "First name is required.";
  if (!data.lastName.trim()) errors.lastName = "Last name is required.";

  if (!data.dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required.";
  } else if (!isValidIsoDate(data.dateOfBirth)) {
    errors.dateOfBirth = "Enter a valid date of birth.";
  } else if (calcAgeFromIsoDate(data.dateOfBirth) < MIN_REGISTRATION_AGE) {
    errors.dateOfBirth = `Participants must be at least ${MIN_REGISTRATION_AGE} years old.`;
  }

  if (!data.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  // Phone is optional per the registration form design.

  if (includeEmergencyContact) {
    if (!data.emergencyContactName.trim()) {
      errors.emergencyContactName = "Emergency contact name is required.";
    }
    if (!data.emergencyContactPhone.trim()) {
      errors.emergencyContactPhone = "Emergency contact number is required.";
    }
  }

  if (includeWaiver && !data.waiverAccepted) {
    errors.waiverAccepted = "You must accept the event waiver to continue.";
  }

  return errors;
}

function normalizeComparable(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(value: string): string {
  const raw = value.trim().replace(/[\s\-()+]/g, "");
  if (raw.startsWith("+61")) return "0" + raw.slice(3);
  if (raw.startsWith("61") && raw.length > 2) return "0" + raw.slice(2);
  return raw;
}

function participantFullName(participant: RegistrationFormData): string {
  return `${participant.firstName.trim()} ${participant.lastName.trim()}`.trim();
}

export function getEmergencyContactErrors(
  emergency: EmergencyContact,
  participants: RegistrationFormData[]
): EmergencyContactErrors {
  const errors: EmergencyContactErrors = {};

  if (!emergency.name.trim()) {
    errors.emergencyContactName = "Emergency contact name is required.";
  }
  if (!emergency.phone.trim()) {
    errors.emergencyContactPhone = "Emergency contact number is required.";
  }
  if (Object.keys(errors).length > 0) return errors;

  const emergencyName = normalizeComparable(emergency.name);
  const emergencyPhone = normalizePhone(emergency.phone);

  for (const participant of participants) {
    const participantName = normalizeComparable(participantFullName(participant));
    const participantEmail = normalizeComparable(participant.email);
    const participantMobile = normalizePhone(participant.mobile);

    if (emergencyName === participantName || emergencyName === participantEmail) {
      errors.emergencyContactName = "Emergency contact must be someone other than a participant.";
    }
    if (emergencyPhone && participantMobile && emergencyPhone === participantMobile) {
      errors.emergencyContactPhone = "Emergency contact number must differ from participant mobile numbers.";
    }
    if (errors.emergencyContactName || errors.emergencyContactPhone) break;
  }

  return errors;
}

export function applySharedEmergencyContact(
  participants: RegistrationFormData[],
  emergency: EmergencyContact
): RegistrationFormData[] {
  return participants.map((participant) => ({
    ...participant,
    emergencyContactName: emergency.name.trim(),
    emergencyContactPhone: emergency.phone.trim(),
  }));
}

export function createEmptyParticipant(): RegistrationFormData {
  return {
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
  };
}

export function compactParticipant(data: RegistrationFormData): CompactParticipant {
  return {
    fn: data.firstName.trim(),
    ln: data.lastName.trim(),
    dob: data.dateOfBirth,
    ...(data.gender.trim() ? { gen: data.gender.trim() } : {}),
    em: data.email.trim().toLowerCase(),
    mob: data.mobile.trim(),
    ecn: data.emergencyContactName.trim(),
    ecp: data.emergencyContactPhone.trim(),
    ...(data.medicalNotes.trim() ? { med: data.medicalNotes.trim().slice(0, MAX_MEDICAL_NOTES_LENGTH) } : {}),
    ...(parseFinishToMinutes(data.estimatedFinish) != null ? { eft: parseFinishToMinutes(data.estimatedFinish)! } : {}),
  };
}

export function expandCompactParticipant(compact: CompactParticipant): RegistrationFormData {
  return {
    firstName: compact.fn,
    lastName: compact.ln,
    dateOfBirth: compact.dob,
    gender: compact.gen ?? "",
    email: compact.em,
    mobile: compact.mob,
    emergencyContactName: compact.ecn,
    emergencyContactPhone: compact.ecp,
    medicalNotes: compact.med ?? "",
    estimatedFinish: formatFinishMinutes(compact.eft),
    waiverAccepted: true,
  };
}

export function athleteNameFromParticipant(data: RegistrationFormData | CompactParticipant): string {
  if ("fn" in data) return `${data.fn} ${data.ln}`.trim();
  return `${data.firstName.trim()} ${data.lastName.trim()}`.trim();
}

export function validateParticipants(
  participants: RegistrationFormData[],
  options?: ValidateParticipantsOptions
): {
  errors: ParticipantFormErrors;
  emergencyContactErrors: EmergencyContactErrors;
  firstMessage: string | null;
} {
  const errors: ParticipantFormErrors = {};
  let emergencyContactErrors: EmergencyContactErrors = {};
  let firstMessage: string | null = null;
  const groupRegistration = options?.groupRegistration === true;

  participants.forEach((participant, index) => {
    const fieldErrors = getRegistrationFormErrors(participant, {
      includeEmergencyContact: !groupRegistration,
      includeWaiver: options?.includeWaiver,
    });
    if (Object.keys(fieldErrors).length === 0) return;

    errors[index] = fieldErrors;
    if (!firstMessage) {
      firstMessage = Object.values(fieldErrors)[0] ?? null;
    }
  });

  if (groupRegistration && options?.sharedEmergencyContact) {
    emergencyContactErrors = getEmergencyContactErrors(
      options.sharedEmergencyContact,
      participants
    );
    if (!firstMessage) {
      firstMessage =
        emergencyContactErrors.emergencyContactName ??
        emergencyContactErrors.emergencyContactPhone ??
        null;
    }
  }

  return { errors, emergencyContactErrors, firstMessage };
}

export function validateRegistrationForm(data: RegistrationFormData): string | null {
  return validateParticipants([data]).firstMessage;
}

export function normalizeGuestEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getEmailsRequiringVerification(
  participantEmails: string[],
  authenticatedEmail?: string | null
): string[] {
  const unique = [...new Set(
    participantEmails
      .map(normalizeGuestEmail)
      .filter((email) => email.length > 0)
  )];

  if (!authenticatedEmail) return unique;

  const accountEmail = normalizeGuestEmail(authenticatedEmail);
  return unique.filter((email) => email !== accountEmail);
}
