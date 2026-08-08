import type { Metadata } from "next";
import FeedbackForm from "@/components/feedback/FeedbackForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Report a bug, request a feature, or send feedback to the Startline team.",
  openGraph: {
    title: "Contact | Startline",
    description:
      "Report a bug, request a feature, or send feedback to the Startline team.",
    url: "/contact",
  },
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return <FeedbackForm />;
}
