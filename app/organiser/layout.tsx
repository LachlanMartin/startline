import type { Metadata } from "next";
import OrganiserNavBar from "@/components/organiser/OrganiserNavBar";
import AmplifyProvider from "./AmplifyProvider";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import SettingsModal from "@/components/organiser/SettingsModal";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: { template: "%s | Startline Organiser", default: "Organiser Portal | Startline" },
};

export default function OrganiserLayout({ children }: { children: React.ReactNode }) {
  return (
    <AmplifyProvider>
      <AuthProvider>
        <SettingsProvider>
          <OrganiserNavBar />
          {children}
          <SettingsModal />
        </SettingsProvider>
      </AuthProvider>
    </AmplifyProvider>
  );
}
