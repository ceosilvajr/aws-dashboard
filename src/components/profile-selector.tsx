"use client";

import { useProfile } from "@/context/profile-context";
import { useAccounts } from "@/context/accounts-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

export function ProfileSelector() {
  const { profile, setProfile } = useProfile();
  const { accounts } = useAccounts();
  const current = accounts.find((a) => a.profile === profile);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background px-3 h-9 hover:bg-accent hover:text-accent-foreground">
        {current ? current.name : "All Accounts"}
        <ChevronDown className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setProfile(null)}>All Accounts</DropdownMenuItem>
        {accounts.map((a) => (
          <DropdownMenuItem key={a.profile} onClick={() => setProfile(a.profile)}>
            {a.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
