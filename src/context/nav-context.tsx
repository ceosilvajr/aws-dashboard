"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type Section =
  | "dashboard"
  | "ecs"
  | "ecr"
  | "networking"
  | "s3"
  | "security"
  | "cdn"
  | "api"
  | "stacks"
  | "accounts"
  | "cognito"
  | "secure-keys"
  | "dynamodb"
  | "lambda"
  | "amplify"
  | "cost-analysis"
  | "push-notifications"
  | "settings";

interface NavContextType {
  section: Section;
  setSection: (s: Section) => void;
}

const NavContext = createContext<NavContextType>({ section: "dashboard", setSection: () => {} });

export function NavProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<Section>("dashboard");
  return <NavContext.Provider value={{ section, setSection }}>{children}</NavContext.Provider>;
}

export function useNav() {
  return useContext(NavContext);
}
