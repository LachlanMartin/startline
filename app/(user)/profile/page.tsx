"use client";

import { useState, useEffect } from "react";
import { Edit2 } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import UserEditProfileModal from "@/components/UserEditProfileModal";
import UserProfileView, {
  type ProfileRaceHistory,
} from "@/components/profile/UserProfileView";

type UserData = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  profilePicUrl: string | null;
  coverImageUrl: string | null;
  coverPosition: string | null;
  isPublic: boolean;
  city: string | null;
  state: string | null;
  mobile: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  createdAt: string;
  organiser: { id: string; orgName: string | null; logoUrl: string | null; verified: boolean } | null;
};

export default function ProfilePage() {
  const { user, status } = useAuthContext();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [history, setHistory] = useState<ProfileRaceHistory | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileLoading(false);
      return;
    }
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setUserData(data);
        setHistory(data.history ?? null);
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [status]);

  const displayHandle = userData?.username ?? user?.email?.split("@")[0] ?? "Athlete";

  if (status !== "authenticated") {
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

  return (
    <>
      <UserProfileView
        username={displayHandle}
        bio={userData?.bio ?? null}
        profilePicUrl={userData?.profilePicUrl ?? null}
        coverImageUrl={userData?.coverImageUrl ?? null}
        coverPosition={userData?.coverPosition ?? null}
        history={history}
        loading={profileLoading}
        headerActions={
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 shrink-0 bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
          >
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </button>
        }
      />

      {userData && (
        <UserEditProfileModal
          open={editing}
          initial={{
            name: userData.name ?? "",
            username: userData.username ?? "",
            bio: userData.bio ?? "",
            isPublic: userData.isPublic,
            city: userData.city ?? "",
            state: userData.state ?? "",
            profilePicUrl: userData.profilePicUrl ?? "",
            coverImageUrl: userData.coverImageUrl ?? "",
            coverPosition: userData.coverPosition ?? "50% 50%",
            mobile: userData.mobile ?? "",
            dateOfBirth: userData.dateOfBirth ?? "",
            gender: userData.gender ?? "",
            emergencyContactName: userData.emergencyContactName ?? "",
            emergencyContactPhone: userData.emergencyContactPhone ?? "",
            currentUsername: userData.username,
          }}
          onClose={() => setEditing(false)}
          onSaved={(data) => {
            setUserData((prev) =>
              prev
                ? {
                    ...prev,
                    name: data.name || null,
                    username: data.username || null,
                    bio: data.bio || null,
                    isPublic: data.isPublic,
                    city: data.city || null,
                    state: data.state || null,
                    profilePicUrl: data.profilePicUrl || null,
                    coverImageUrl: data.coverImageUrl || null,
                    coverPosition: data.coverPosition || "50% 50%",
                    mobile: data.mobile || null,
                    dateOfBirth: data.dateOfBirth || null,
                    gender: data.gender || null,
                    emergencyContactName: data.emergencyContactName || null,
                    emergencyContactPhone: data.emergencyContactPhone || null,
                  }
                : prev
            );
          }}
        />
      )}
    </>
  );
}
