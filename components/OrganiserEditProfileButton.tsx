"use client";

import { Edit2 } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

export default function OrganiserEditProfileButton() {
  const { open } = useSettings();

  return (
    <button
      type="button"
      onClick={() => open("personal")}
      className="inline-flex items-center gap-2 shrink-0 bg-machined shadow-machined text-dark font-headline text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-md hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none transition-transform"
    >
      <Edit2 className="w-4 h-4" />
      Edit Profile
    </button>
  );
}
