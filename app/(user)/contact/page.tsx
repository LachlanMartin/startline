import type { Metadata } from "next";
import ContactForm from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the Startline team. Questions about events, your account, or the platform — we aim to reply within 24 hours.",
  openGraph: {
    title: "Contact | Startline",
    description:
      "Get in touch with the Startline team. We aim to reply within 24 hours.",
    url: "/contact",
  },
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return <ContactForm />;
}
