import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Building2, ArrowRight } from "lucide-react";
import { getOrganiserSession } from "@/lib/amplify-server";

const CUSTOMER_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://startlineau.com"
).replace(/\/$/, "");

// `/organiser-setup` lives on the athlete site, which is a *different host*
// only when this page is being served from the organiser subdomain. Every
// other deployment — the Amplify branch domain, PR previews, local dev —
// serves all three portals from one host, and hardcoding the absolute customer
// URL there sent people to a hostname that doesn't resolve (issue #302).
async function organiserSetupHref(): Promise<string> {
  const host = (await headers()).get("host")?.toLowerCase() ?? "";
  return host.startsWith("organiser.") ? `${CUSTOMER_URL}/organiser-setup` : "/organiser-setup";
}

export default async function OrganiserLandingPage() {
  const session = await getOrganiserSession();
  if (session) redirect("/organiser/dashboard");

  const setupHref = await organiserSetupHref();

  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-headline text-4xl font-black italic tracking-tighter leading-[0.9] text-light mb-4">
          Become an<br /><span className="text-primary">Organiser.</span>
        </h1>
        <p className="text-muted text-[15px] leading-relaxed mb-8">
          Sign up for a free user account, then set up your organiser profile to start publishing events on Australia&apos;s fitness calendar.
        </p>
        <Link
          href={setupHref}
          className="bg-machined shadow-machined inline-flex items-center gap-2 text-dark font-headline text-sm font-bold uppercase tracking-widest py-4 px-8 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
        >
          Get started <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-6 font-headline text-[11px] uppercase tracking-widest text-muted">
          Already have an organiser profile?{" "}
          <Link href="/organiser/dashboard" className="text-primary hover:underline">Go to Dashboard</Link>
        </p>
      </div>
    </main>
  );
}
