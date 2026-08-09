import type { Metadata } from "next";
import FeedbackForm from "@/components/feedback/FeedbackForm";

export const metadata: Metadata = {
  title: "Feedback",
  description:
    "Report a bug, request a feature, or send feedback to the Startline team.",
  openGraph: {
    title: "Feedback | Startline",
    description:
      "Report a bug, request a feature, or send feedback to the Startline team.",
    url: "/feedback",
  },
  alternates: {
    canonical: "/feedback",
  },
};

export default function FeedbackPage() {
  return <FeedbackForm />;
}
