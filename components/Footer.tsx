import Link from "next/link";
import Image from "next/image";

type FooterLink = { href: string; label: string; external?: boolean };

const LINK_GROUPS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Events",
    links: [
      { href: "/events", label: "All Events" },
      { href: "/events?type=running", label: "Running" },
      { href: "/events?type=cycling", label: "Cycling" },
      { href: "/events?type=swimming", label: "Swimming" },
      { href: "/events?type=triathlon", label: "Triathlon" },
      { href: "/events?type=crossfit", label: "CrossFit" },
      { href: "/events?type=hybrid", label: "Hybrid" },
    ],
  },
  {
    heading: "Platform",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/organiser-setup", label: "Become an Organiser" },
      { href: "/organiser", label: "Organiser Login" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "https://www.instagram.com/startlineau/", label: "Instagram", external: true },
    ],
  },
  {
    heading: "Help",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/feedback", label: "Feedback" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/cookies", label: "Cookie Policy" },
    ],
  },
];

const linkCls =
  "block font-headline text-[13px] sm:text-xs font-medium uppercase tracking-[0.12em] sm:tracking-widest text-muted hover:text-primary transition-colors py-1 sm:py-0.5";

export default function Footer() {
  return (
    <footer className="bg-dark border-t border-dark-lighter">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-start gap-8 sm:gap-10 mb-8">
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

          {/* Two even columns on phones — flex-wrap left ragged gaps and a
              seven-item Events column towering over its neighbours. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:flex sm:gap-12 lg:gap-16 sm:flex-wrap">
            {LINK_GROUPS.map(({ heading, links }) => (
              <div key={heading}>
                <h4 className="font-headline text-[11px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-light pb-2 mb-2.5 border-b border-dark-lighter sm:border-0 sm:pb-0 sm:mb-3">
                  {heading}
                </h4>
                <div className="space-y-1 sm:space-y-2">
                  {links.map((link) =>
                    link.external ? (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkCls}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link key={link.href} href={link.href} className={linkCls}>
                        {link.label}
                      </Link>
                    )
                  )}
                </div>
              </div>
            ))}
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
