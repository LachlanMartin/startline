import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Startline Terms of Service — the terms governing your use of the Startline platform.",
  openGraph: {
    title: "Terms of Service | Startline",
    description:
      "The terms governing your use of the Startline platform.",
    url: "/terms",
  },
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-dark-darker">
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-3xl">
          <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-3.5">
            Legal
          </p>
          <h1 className="font-headline text-[32px] sm:text-4xl font-black italic leading-none tracking-tighter text-light mb-4">
            Terms of <span className="text-primary">Service</span>
          </h1>
          <p className="text-[13px] text-muted-dark font-headline uppercase tracking-widest mb-10">
            Last updated: 1 July 2026
          </p>

          <div className="space-y-8 text-[15px] text-muted leading-relaxed">
            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using Startline, you agree to be bound by these Terms
                of Service. If you do not agree, you may not use the platform. We may
                update these terms from time to time, and continued use constitutes
                acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                2. Accounts
              </h2>
              <p>
                You are responsible for maintaining the confidentiality of your account
                credentials and for all activity under your account. You must provide
                accurate information and keep it up to date. Accounts may be suspended
                or terminated for violations of these terms.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                3. Event Listings and Registrations
              </h2>
              <p>
                Event organisers are responsible for the accuracy of their listings.
                Startline acts as a platform and is not a party to the transaction
                between organisers and participants. Registration fees are set by
                organisers and subject to their cancellation and refund policies.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                4. Payments
              </h2>
              <p>
                Payments are processed securely through our third-party payment
                processor. By making a purchase, you agree to the payment terms
                presented at checkout. Refunds are handled according to each event
                organiser&apos;s policy.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                5. Prohibited Conduct
              </h2>
              <p>
                You may not use Startline for any unlawful purpose, to harass or harm
                others, to distribute malware, to scrape or mine data, or to interfere
                with the platform&apos;s operation. Violations may result in account
                termination.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                6. Limitation of Liability
              </h2>
              <p>
                Startline is provided &quot;as is&quot; without warranties of any
                kind. To the maximum extent permitted by law, Startline shall not be
                liable for any indirect, incidental, or consequential damages arising
                from your use of the platform.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                7. Contact
              </h2>
              <p>
                For questions about these terms, contact us at{" "}
                <a href="mailto:legal@startline.com.au" className="text-primary hover:underline">
                  legal@startline.com.au
                </a>.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
