import Link from "next/link";
import { User } from "lucide-react";
import prisma from "@/lib/prisma";
import { getServerSession } from "@/lib/amplify-server";
import ProfileServerView, {
  PROFILE_USER_SELECT,
  type ProfileUser,
} from "@/components/profile/ProfileServerView";

interface PublicProfilePageProps {
  params: Promise<{ username: string }>;
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: PROFILE_USER_SELECT,
  });

  if (!user) {
    return <ProfileNotFound />;
  }

  const session = await getServerSession();
  const isOwner = session?.sub === user.id || (!!session?.email && session.email === user.email);

  // Private profiles are only visible to their owner.
  if (!isOwner && !user.isPublic) {
    return <ProfileNotFound />;
  }

  return <ProfileServerView user={user as ProfileUser} isOwner={isOwner} />;
}

function ProfileNotFound() {
  return (
    <main className="min-h-screen bg-dark-darker flex items-center justify-center pt-20">
      <div className="text-center">
        <User className="w-16 h-16 text-muted mx-auto mb-4" />
        <h1 className="font-headline text-3xl font-black italic tracking-tighter text-light mb-2">
          Profile not found
        </h1>
        <p className="text-muted text-sm mb-6">
          This user doesn&apos;t exist or their profile is private.
        </p>
        <Link
          href="/"
          className="font-headline text-xs font-bold uppercase tracking-widest text-primary hover:underline"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
