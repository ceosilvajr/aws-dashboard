"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ProfileContextType {
  profile: string | null;
  setProfile: (p: string | null) => void;
}

const ProfileContext = createContext<ProfileContextType>({ profile: null, setProfile: () => {} });

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<string | null>(null);
  return <ProfileContext.Provider value={{ profile, setProfile }}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}
