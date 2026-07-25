import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Startline Privacy Policy — how we collect, use, and protect your personal information.",
  openGraph: {
    title: "Privacy Policy | Startline",
    description:
      "How we collect, use, and protect your personal information.",
    url: "/privacy",
  },
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-dark-darker">
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-3xl">
          <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-3.5">
            Legal
          </p>
          <h1 className="font-headline text-[32px] sm:text-4xl font-black italic leading-none tracking-tighter text-light mb-4">
            Privacy <span className="text-primary">Policy</span>
          </h1>
          <p className="text-[13px] text-muted-dark font-headline uppercase tracking-widest mb-10">
            Last updated: 1 July 2026
          </p>

          <div className="space-y-8 text-[15px] text-muted leading-relaxed">
            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                1. Information We Collect
              </h2>
              <p>
                We collect information you provide directly to us, including your name,
                email address, phone number, and billing information when you register
                for an account or purchase event entries. We also collect information
                about your use of the platform, including events viewed, registrations,
                and preferences.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                2. How We Use Your Information
              </h2>
              <p>
                We use your information to provide and improve our services, process
                registrations and payments, send event confirmations and reminders,
                communicate with you about your account, and personalise your
                experience on Startline. We may also use aggregated data for analytics
                and platform improvement.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                3. Information Sharing
              </h2>
              <p>
                We share your information with event organisers when you register for
                their events, with payment processors to complete transactions, and
                with service providers who help us operate the platform. We do not sell
                your personal information to third parties.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                4. Data Security
              </h2>
              <p>
                We implement industry-standard security measures including encryption
                in transit and at rest, access controls, and regular security audits.
                However, no method of transmission over the internet is completely
                secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                5. Your Rights
              </h2>
              <p>
                You may access, update, or delete your account information at any time
                through your profile settings. You may also contact us to request a
                copy of the data we hold about you or to request its deletion, subject
                to legal obligations.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                6. Contact
              </h2>
              <p>
                For privacy-related inquiries, contact us at{" "}
                <a href="mailto:privacy@startline.com.au" className="text-primary hover:underline">
                  privacy@startline.com.au
                </a>.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
