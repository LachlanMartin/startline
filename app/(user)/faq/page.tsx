import type { Metadata } from "next";
import FaqContent, { type FaqItem } from "@/components/faq/FaqContent";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about Startline — how to register, manage your account, and more.",
  openGraph: {
    title: "FAQ | Startline",
    description:
      "Frequently asked questions about using Startline.",
    url: "/faq",
  },
  alternates: {
    canonical: "/faq",
  },
};

const faqs: FaqItem[] = [
  {
    q: "What is Startline?",
    a: "Startline is Australia's fitness event calendar. We help athletes discover, filter and register for races, competitions and fitness events across the country.",
  },
  {
    q: "What is my Startline profile?",
    a: "Your Startline profile is your personal fitness event history. It can show the events you've completed, your results and the disciplines you've competed in, helping you build a record of your fitness journey. Create an account via the sign in button.",
  },
  {
    q: "How do I register for an event?",
    a: "Browse events on the platform, select one you're interested in and click Register. You'll complete payment and receive a confirmation email with your event details.",
  },
  {
    q: "Where can I see my past results?",
    a: "Your completed events and results can be displayed on your profile, helping you keep track of your racing history and performance over time.",
  },
  {
    q: "Can I get a refund if I can't attend?",
    a: "Refund policies are set by each event organiser. Check the event listing for their specific policy before registering. Contact the organiser directly for refund requests.",
  },
  {
    q: "How do I create an account?",
    a: "Click Sign In at the top of any page and select Create Account. You'll need an email address and a password.",
  },
  {
    q: "How do I become an organiser?",
    a: "Visit the Become an Organiser page and follow the setup process. You'll need to provide your organisation details and agree to our Terms of Service.",
  },
  {
    q: "Is my payment information secure?",
    a: "Yes. All payments are processed securely through Stripe, a PCI-compliant payment processor. We never store your full payment details on our servers.",
  },
  {
    q: "How do I contact support?",
    a: "Send us a message through the Contact page or email admin@startlineau.com. We aim to respond within 24 hours.",
  },
];

export default function FAQPage() {
  return <FaqContent faqs={faqs} />;
}
