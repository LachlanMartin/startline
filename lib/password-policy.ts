/**
 * Single source of truth for the password rules shown to users and enforced in
 * the browser.
 *
 * These must stay in step with the Cognito user pool policy in
 * `terraform/modules/environment/main.tf` (`password_policy`). If that policy
 * changes, change this list in the same PR: anything Cognito rejects but this
 * list allows surfaces to the user as a raw `InvalidPasswordException` instead
 * of a readable message, which is the problem issue #286 reported.
 */

export interface PasswordRule {
  /** Stable key, used as the React list key and in tests. */
  id: string;
  /** Requirement as shown in the checklist. Phrased as a rule, not an error. */
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "uppercase", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "number", label: "One number", test: (p) => /[0-9]/.test(p) },
];

export interface PasswordRuleResult extends PasswordRule {
  met: boolean;
}

export interface PasswordCheck {
  results: PasswordRuleResult[];
  valid: boolean;
  /** The first unmet rule, for surfaces that can only show a single message. */
  firstFailure: PasswordRule | null;
}

export function checkPassword(password: string): PasswordCheck {
  const results = PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(password) }));
  const firstFailure = results.find((r) => !r.met) ?? null;
  return {
    results,
    valid: firstFailure === null,
    firstFailure: firstFailure ? { id: firstFailure.id, label: firstFailure.label, test: firstFailure.test } : null,
  };
}

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

/**
 * One-line summary of the policy, for placeholders and for the fallback message
 * when Cognito rejects a password the client thought was fine.
 */
export const PASSWORD_POLICY_SUMMARY =
  "8+ characters with an uppercase letter, a lowercase letter and a number.";
