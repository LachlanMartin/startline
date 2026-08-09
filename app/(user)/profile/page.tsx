import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/amplify-server";
import prisma from "@/lib/prisma";

export default async function ProfilePage() {
  const session = await getServerSession();

  if (!session) {
    return (
      <main className="min-h-screen bg-dark-darker pt-20">
        <section className="max-w-[1440px] mx-auto px-6 py-24 text-center">
          <h1 className="font-headline text-3xl font-black tracking-tighter text-light mb-4">
            Sign in to see your profile
          </h1>
          <p className="font-headline text-sm text-muted mb-8">
            Save events, track registrations, and manage your account.
          </p>
        </section>
      </main>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { username: true },
  });

  // Fallback: resolve by email (covers dev bypass + accounts without a
  // stable Cognito sub in the local DB).
  const userByEmail = !user && session.email
    ? await prisma.user.findUnique({
        where: { email: session.email },
        select: { username: true },
      })
    : null;

  const handle = user?.username ?? userByEmail?.username ?? session.email?.split("@")[0] ?? "athlete";
  redirect(`/profile/${handle}`);
}
