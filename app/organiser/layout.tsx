import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import AmplifyProvider from "./AmplifyProvider";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import SettingsModal from "@/components/organiser/SettingsModal";

// ── Portal-wide SEO directives ────────────────────────────────────────────────
// Every /organiser/** route inherits noindex so the login-protected portal
// is never crawled or indexed by any search engine.
export const metadata: Metadata = {
  robots: {
    index:     false,
    follow:    false,
    googleBot: { index: false, follow: false },
  },
  title: {
    template: "%s | Startline Organiser",
    default:  "Organiser Portal | Startline",
  },
};

export default function OrganiserLayout({ children }: { children: React.ReactNode }) {
  return (
    <AmplifyProvider>
      <AuthProvider>
        <SettingsProvider>
          <NavBar />
          {children}
          <Footer />
          <SettingsModal />
        </SettingsProvider>
      </AuthProvider>
    </AmplifyProvider>
  );
}
