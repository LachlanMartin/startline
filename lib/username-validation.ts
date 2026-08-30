import { containsProfanity } from "@/lib/profanity";

const RESERVED = new Set([
  "admin", "api", "events", "organiser", "organizer", "profile", "about",
  "customer", "verify", "forgot", "terms", "privacy", "help", "support",
  "settings", "dashboard", "listings", "payments", "onboarding", "register",
  "signin", "signup", "login", "logout", "auth", "health", "static",
  "images", "favicon", "robots", "sitemap", "_next", "null", "undefined",
  "organiser-setup", "organiser-landing", "profile-settings",
]);

const VALID_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export type UsernameValidation =
  | { valid: true }
  | { valid: false; reason: string };

export function validateUsername(username: string): UsernameValidation {
  if (!username || !username.trim()) {
    return { valid: false, reason: "Username is required." };
  }

  const trimmed = username.trim().toLowerCase();

  if (trimmed.length < 3) {
    return { valid: false, reason: "Username must be at least 3 characters." };
  }

  if (trimmed.length > 30) {
    return { valid: false, reason: "Username must be 30 characters or less." };
  }

  if (!VALID_PATTERN.test(trimmed)) {
    return { valid: false, reason: "Only lowercase letters, numbers, and hyphens are allowed. Must start and end with a letter or number." };
  }

  if (RESERVED.has(trimmed)) {
    return { valid: false, reason: "This username is reserved." };
  }

  // Profanity is checked on the trimmed username as-is; containsProfanity also
  // tests the separator-stripped form, so "b-a-d-word" cannot slip through.
  if (containsProfanity(trimmed)) {
    return { valid: false, reason: "That username isn't allowed. Please choose another." };
  }

  return { valid: true };
}
