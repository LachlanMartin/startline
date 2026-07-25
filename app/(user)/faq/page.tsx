import type { Metadata } from "next";

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

const faqs = [
  {
    q: "What is Startline?",
    a: "Startline is Australia's fitness event calendar. We help athletes discover, compare, and register for races, competitions, and fitness events across the country.",
  },
  {
    q: "How do I register for an event?",
    a: "Browse events on the platform, select one you're interested in, and click Register. You'll complete payment and receive a confirmation email with your event details.",
  },
  {
    q: "Can I get a refund if I can't attend?",
    a: "Refund policies are set by each event organiser. Check the event listing for their specific policy before registering. Contact the organiser directly for refund requests.",
  },
  {
    q: "How do I create an account?",
    a: "Click Sign In at the top of any page and select Create Account. You'll need an email address and a password. You can also sign in with passkeys on supported devices.",
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
    q: "Can I edit or cancel my registration?",
    a: "Contact the event organiser directly for changes to your registration. Their contact details are available on the event listing page.",
  },
  {
    q: "How do I contact support?",
    a: "Send us a message through the Feedback page or email support@startline.com.au. We aim to respond within 24 hours.",
  },
];

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-dark-darker">
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-3xl">
          <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-3.5">
            Help
          </p>
          <h1 className="font-headline text-[32px] sm:text-4xl font-black italic leading-none tracking-tighter text-light mb-10">
            Frequently Asked <span className="text-primary">Questions</span>
          </h1>

          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-dark-lighter rounded-xl p-6 bg-dark">
                <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                  {faq.q}
                </h2>
                <p className="text-[15px] text-muted leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
