// Shared user-facing error mapping for the forgot-password flow. Cognito
// rejects a reset password that matches the current/previous one with
// InvalidPasswordException — that case must be shown as a reuse error, not the
// generic complexity message. Used by all three reset handlers.
export function mapResetPasswordError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("codemismatch")) {
    return "That code is incorrect. Please check and try again.";
  }
  if (m.includes("expiredcode")) {
    return "That code has expired. Go back and request a new one.";
  }
  if (
    m.includes("invalidpassword") &&
    (m.includes("current") ||
      m.includes("previous") ||
      m.includes("same as") ||
      m.includes("history") ||
      m.includes("reuse") ||
      m.includes("used before"))
  ) {
    return "Your new password must be different from your current password.";
  }
  if (m.includes("invalidpassword")) {
    return "Password must be at least 8 characters with upper, lower and a number.";
  }
  return "Could not reset your password. Please try again.";
}