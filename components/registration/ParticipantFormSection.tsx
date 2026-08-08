"use client";

import { ChevronDown, X } from "lucide-react";
import { RegisterField, registerInputCls } from "@/components/registration/RegisterField";
import {
  GENDER_OPTIONS,
  maxDateOfBirthForMinAge,
  MAX_MEDICAL_NOTES_LENGTH,
  type RegistrationFormData,
  type RegistrationFormErrors,
  type RegistrationFormField,
} from "@/lib/registration-form";

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-headline text-[9.5px] font-bold uppercase tracking-[0.2em] text-muted-dark pb-2.5 border-b border-dark-lighter mb-4">
      {children}
    </div>
  );
}

interface ParticipantFormSectionProps {
  index: number;
  title?: string;
  participant: RegistrationFormData;
  errors?: RegistrationFormErrors;
  showRemove?: boolean;
  hideEmergencyContact?: boolean;
  /** Render without the outer card chrome (for embedding in an accordion card). */
  frameless?: boolean;
  onRemove?: () => void;
  onChange: (field: keyof RegistrationFormData, value: string | boolean) => void;
}

export default function ParticipantFormSection({
  index,
  title,
  participant,
  errors = {},
  showRemove,
  hideEmergencyContact,
  frameless,
  onRemove,
  onChange,
}: ParticipantFormSectionProps) {
  const fieldKey = (field: RegistrationFormField) => `${index}-${field}`;
  const id = (field: string) => `p${index}-${field}`;

  return (
    <div className={frameless ? undefined : "bg-dark border border-dark-lighter rounded-[14px] p-6"}>
      {(title || showRemove) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-headline text-[13px] font-bold uppercase tracking-[0.15em] text-primary">
            {title}
          </h3>
          {showRemove && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1 font-headline text-[10px] font-bold uppercase tracking-widest text-muted hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" /> Remove
            </button>
          )}
        </div>
      )}

      {/* Contact */}
      <div className="mb-6">
        <SectionDivider>Contact</SectionDivider>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <RegisterField label="First name" required error={errors.firstName} fieldKey={fieldKey("firstName")} htmlFor={id("firstName")}>
            <input
              id={id("firstName")}
              type="text"
              value={participant.firstName}
              onChange={(e) => onChange("firstName", e.target.value)}
              placeholder="e.g. Jordan"
              className={registerInputCls(!!errors.firstName)}
            />
          </RegisterField>
          <RegisterField label="Last name" required error={errors.lastName} fieldKey={fieldKey("lastName")} htmlFor={id("lastName")}>
            <input
              id={id("lastName")}
              type="text"
              value={participant.lastName}
              onChange={(e) => onChange("lastName", e.target.value)}
              placeholder="e.g. Clarke"
              className={registerInputCls(!!errors.lastName)}
            />
          </RegisterField>
          <div className="sm:col-span-2">
            <RegisterField label="Email address" required error={errors.email} fieldKey={fieldKey("email")} htmlFor={id("email")}>
              <input
                id={id("email")}
                type="email"
                value={participant.email}
                onChange={(e) => onChange("email", e.target.value)}
                placeholder="e.g. jordan@example.com"
                className={registerInputCls(!!errors.email)}
              />
            </RegisterField>
          </div>
          <div className="sm:col-span-2">
            <RegisterField label="Phone number" error={errors.mobile} fieldKey={fieldKey("mobile")} htmlFor={id("mobile")}>
              <input
                id={id("mobile")}
                type="tel"
                value={participant.mobile}
                onChange={(e) => onChange("mobile", e.target.value)}
                placeholder="e.g. 0412 345 678"
                className={registerInputCls(!!errors.mobile)}
              />
            </RegisterField>
          </div>
        </div>
      </div>

      {/* Personal */}
      <div className="mb-6">
        <SectionDivider>Personal</SectionDivider>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <RegisterField label="Date of birth" required error={errors.dateOfBirth} fieldKey={fieldKey("dateOfBirth")} htmlFor={id("dob")}>
            <input
              id={id("dob")}
              type="date"
              value={participant.dateOfBirth}
              onChange={(e) => onChange("dateOfBirth", e.target.value)}
              max={maxDateOfBirthForMinAge()}
              className={registerInputCls(!!errors.dateOfBirth)}
            />
          </RegisterField>
          <RegisterField label="Gender" htmlFor={id("gender")}>
            <div className="relative">
              <select
                id={id("gender")}
                value={participant.gender}
                onChange={(e) => onChange("gender", e.target.value)}
                className={cnSelect(!!participant.gender)}
              >
                <option value="">Select…</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-muted-dark absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </RegisterField>
          <div className="sm:col-span-2">
            <RegisterField label="Estimated finish time" htmlFor={id("estFinish")}>
              <input
                id={id("estFinish")}
                type="text"
                inputMode="numeric"
                value={participant.estimatedFinish}
                onChange={(e) => onChange("estimatedFinish", e.target.value)}
                placeholder="e.g. 0:45 or 3:30"
                className={registerInputCls()}
              />
              <p className="mt-1.5 text-[11.5px] text-muted-dark leading-relaxed">
                Optional. Roughly how long you expect to take (hours:minutes). Organisers use this to seed start waves by pace.
              </p>
            </RegisterField>
          </div>
        </div>
      </div>

      {/* Safety */}
      <div>
        <SectionDivider>Safety</SectionDivider>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          {!hideEmergencyContact && (
            <>
              <RegisterField label="Emergency contact name" required error={errors.emergencyContactName} fieldKey={fieldKey("emergencyContactName")} htmlFor={id("ecName")}>
                <input
                  id={id("ecName")}
                  type="text"
                  value={participant.emergencyContactName}
                  onChange={(e) => onChange("emergencyContactName", e.target.value)}
                  placeholder="Full name"
                  className={registerInputCls(!!errors.emergencyContactName)}
                />
              </RegisterField>
              <RegisterField label="Emergency contact phone" required error={errors.emergencyContactPhone} fieldKey={fieldKey("emergencyContactPhone")} htmlFor={id("ecPhone")}>
                <input
                  id={id("ecPhone")}
                  type="tel"
                  value={participant.emergencyContactPhone}
                  onChange={(e) => onChange("emergencyContactPhone", e.target.value)}
                  placeholder="e.g. 0412 000 111"
                  className={registerInputCls(!!errors.emergencyContactPhone)}
                />
              </RegisterField>
            </>
          )}
          <div className="sm:col-span-2">
            <RegisterField label="Medical conditions / allergies" htmlFor={id("medical")}>
              <textarea
                id={id("medical")}
                rows={3}
                value={participant.medicalNotes}
                maxLength={MAX_MEDICAL_NOTES_LENGTH}
                onChange={(e) => onChange("medicalNotes", e.target.value)}
                placeholder="Any conditions we should know about? Leave blank if none."
                className={registerInputCls() + " resize-none"}
              />
            </RegisterField>
          </div>
        </div>
      </div>
    </div>
  );
}

function cnSelect(hasValue: boolean) {
  return (
    "w-full appearance-none cursor-pointer bg-dark-light border border-dark-lighter rounded-[10px] px-[13px] py-[11px] pr-9 text-[13.5px] font-headline focus:outline-none focus:border-primary transition-colors " +
    (hasValue ? "text-light" : "text-muted-dark")
  );
}
