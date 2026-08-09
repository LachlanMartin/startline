"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2 } from "lucide-react";
import UserProfileView, {
  type ProfileRaceHistory,
} from "@/components/profile/UserProfileView";
import UserEditProfileModal from "@/components/UserEditProfileModal";

export type PublicProfileData = {
  username: string;
  bio: string | null;
  profilePicUrl: string | null;
  history: ProfileRaceHistory;
};

export type OwnerProfileData = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  isPublic: boolean;
  city: string | null;
  state: string | null;
  profilePicUrl: string | null;
  mobile: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  createdAt: string | Date;
  organiser: { id: string; orgName: string | null; logoUrl: string | null; verified: boolean } | null;
};

type Props = {
  profile: PublicProfileData;
  isOwner: boolean;
  ownerData: OwnerProfileData | null;
};

export default function ProfilePageClient({ profile, isOwner, ownerData }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <>
      <UserProfileView
        username={profile.username}
        bio={profile.bio}
        profilePicUrl={profile.profilePicUrl}
        history={profile.history}
        headerActions={
          isOwner ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 shrink-0 bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
            >
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </button>
          ) : undefined
        }
      />

      {isOwner && ownerData && (
        <UserEditProfileModal
          open={editing}
          initial={{
            name: ownerData.name ?? "",
            username: ownerData.username ?? "",
            bio: ownerData.bio ?? "",
            isPublic: ownerData.isPublic,
            city: ownerData.city ?? "",
            state: ownerData.state ?? "",
            profilePicUrl: ownerData.profilePicUrl ?? "",
            mobile: ownerData.mobile ?? "",
            dateOfBirth: ownerData.dateOfBirth ?? "",
            gender: ownerData.gender ?? "",
            emergencyContactName: ownerData.emergencyContactName ?? "",
            emergencyContactPhone: ownerData.emergencyContactPhone ?? "",
            currentUsername: ownerData.username,
          }}
          onClose={() => setEditing(false)}
          onSaved={(data) => {
            if (data.username && data.username !== profile.username) {
              router.replace(`/profile/${data.username}`);
            } else {
              router.refresh();
            }
          }}
        />
      )}
    </>
  );
}
