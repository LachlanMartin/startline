"use client";

import { Check, Circle } from "lucide-react";
import { checkPassword } from "@/lib/password-policy";

interface PasswordRequirementsProps {
  password: string;
  /**
   * Show the checklist even before the user types. Callers pass the field's
   * focus state so the rules appear the moment the field is focused rather than
   * after a failed submit.
   */
  visible?: boolean;
  className?: string;
}

/**
 * Live password rule checklist.
 *
 * Every rule is listed up front and ticks green as it is satisfied, so the
 * requirements are never discovered one failed submit at a time (issue #286).
 */
export default function PasswordRequirements({
  password,
  visible = true,
  className = "",
}: PasswordRequirementsProps) {
  const { results } = checkPassword(password);

  if (!visible) return null;

  return (
    <ul
      className={`mt-2 space-y-1 ${className}`}
      aria-label="Password requirements"
      data-testid="password-requirements"
    >
      {results.map((rule) => (
        <li
          key={rule.id}
          data-testid={`password-rule-${rule.id}`}
          data-met={rule.met}
          className={`flex items-center gap-1.5 font-headline text-[11px] tracking-wide transition-colors ${
            rule.met ? "text-primary" : "text-muted-dark"
          }`}
        >
          {rule.met
            ? <Check className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            : <Circle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />}
          <span>{rule.label}</span>
          <span className="sr-only">{rule.met ? " met" : " not met"}</span>
        </li>
      ))}
    </ul>
  );
}
