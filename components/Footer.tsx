import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-dark border-t border-dark-lighter">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-10 mb-8">
          <div className="flex-shrink-0">
            <Link href="/" className="inline-flex items-center mb-3">
              <Image
                src="/images/logo-title.svg"
                alt="Startline"
                width={130}
                height={34}
                className="h-7 w-auto"
              />
            </Link>
            <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted leading-relaxed">
              Australia&apos;s Fitness<br />Event Calendar
            </p>
          </div>

          <div className="flex gap-8 sm:gap-12 lg:gap-16 flex-wrap">
            <div>
              <h4 className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-3">
                Events
              </h4>
              <div className="space-y-2">
                {[
                  { href: "/events", label: "All Events" },
                  { href: "/events?type=running", label: "Running" },
                  { href: "/events?type=cycling", label: "Cycling" },
                  { href: "/events?type=swimming", label: "Swimming" },
                  { href: "/events?type=triathlon", label: "Triathlon" },
                  { href: "/events?type=crossfit", label: "CrossFit" },
                  { href: "/events?type=hybrid", label: "Hybrid" },

                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors py-0.5"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-3">
                Platform
              </h4>
              <div className="space-y-2">
                {[
                  { href: "/contact", label: "Contact" },
                  { href: "/organiser-setup", label: "Become an Organiser" },
                  { href: "/organiser", label: "Organiser Login" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors py-0.5"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-3">
                Company
              </h4>
              <div className="space-y-2">
                <Link
                  href="/about"
                  className="block font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors py-0.5"
                >
                  About
                </Link>
                <a
                  href="https://www.instagram.com/startlineau/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors py-0.5"
                >
                  Instagram
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-3">
                Help
              </h4>
              <div className="space-y-2">
                {[
                  { href: "/faq", label: "FAQ" },
                  { href: "/feedback", label: "Feedback" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors py-0.5"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted mb-3">
                Legal
              </h4>
              <div className="space-y-2">
                {[
                  { href: "/privacy", label: "Privacy Policy" },
                  { href: "/terms", label: "Terms of Service" },
                  { href: "/cookies", label: "Cookie Policy" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors py-0.5"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-dark-lighter pt-5">
          <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
            &copy; {new Date().getFullYear()} Startline. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
