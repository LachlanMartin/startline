import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Startline Cookie Policy — how we use cookies and similar technologies on our platform.",
  openGraph: {
    title: "Cookie Policy | Startline",
    description:
      "How we use cookies and similar technologies on Startline.",
    url: "/cookies",
  },
  alternates: {
    canonical: "/cookies",
  },
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-dark-darker">
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-3xl">
          <p className="font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-3.5">
            Legal
          </p>
          <h1 className="font-headline text-[32px] sm:text-4xl font-black italic leading-none tracking-tighter text-light mb-4">
            Cookie <span className="text-primary">Policy</span>
          </h1>
          <p className="text-[13px] text-muted-dark font-headline uppercase tracking-widest mb-10">
            Last updated: 1 July 2026
          </p>

          <div className="space-y-8 text-[15px] text-muted leading-relaxed">
            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                1. What Are Cookies
              </h2>
              <p>
                Cookies are small text files stored on your device when you visit a
                website. They help us make the platform work, remember your
                preferences, and understand how you use Startline.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                2. How We Use Cookies
              </h2>
              <p>
                We use essential cookies required for platform operation and security.
                We also use functional cookies to remember your preferences, analytics
                cookies to understand usage patterns, and authentication cookies to
                keep you signed in.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                3. Third-Party Cookies
              </h2>
              <p>
                We may use third-party services such as analytics providers and payment
                processors that set their own cookies. These are governed by the
                respective third-party privacy policies.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                4. Managing Cookies
              </h2>
              <p>
                You can control cookies through your browser settings. Disabling
                essential cookies may prevent the platform from functioning correctly.
                Most browsers allow you to block or delete cookies through their
                preferences menu.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                5. Changes
              </h2>
              <p>
                We may update this Cookie Policy from time to time. Changes will be
                posted on this page with an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-[0.15em] text-light mb-3">
                6. Contact
              </h2>
              <p>
                For questions about our use of cookies, contact us at{" "}
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
