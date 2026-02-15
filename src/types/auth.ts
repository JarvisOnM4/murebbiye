import type { UserRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  role: UserRole;
  email: string;
  locale: "tr" | "en";
};
