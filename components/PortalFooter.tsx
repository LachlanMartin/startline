import Link from "next/link";
import Image from "next/image";

export default function PortalFooter() {
  return (
    <footer className="bg-dark border-t border-dark-lighter mt-auto">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center">
            <Image src="/images/logo-title.svg" alt="Startline" width={110} height={28} className="h-6 w-auto" />
          </Link>

          <div className="flex items-center gap-5">
            {[
              { href: "/about", label: "About" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
              { href: "/contact", label: "Contact" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted">
            &copy; {new Date().getFullYear()} Startline. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
