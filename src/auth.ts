import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

type AuthorizedUser = {
  id: string;
  email: string;
  role: UserRole;
  nickname: string | null;
};

type EnvFallbackAccount = {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  nickname: string | null;
};

function envFallbackEnabled() {
  if (process.env.AUTH_ALLOW_ENV_FALLBACK === "true") {
    return true;
  }

  return process.env.NODE_ENV !== "production";
}

function getEnvFallbackAccounts(): EnvFallbackAccount[] {
  const accounts: EnvFallbackAccount[] = [];

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const studentEmail = process.env.SEED_STUDENT_EMAIL?.toLowerCase().trim();
  const studentPassword = process.env.SEED_STUDENT_PASSWORD;

  if (adminEmail && adminPassword) {
    accounts.push({
      id: "env-admin",
      email: adminEmail,
      password: adminPassword,
      role: UserRole.ADMIN,
      nickname: "Pilot Admin"
    });
  }

  if (studentEmail && studentPassword) {
    accounts.push({
      id: "env-student",
      email: studentEmail,
      password: studentPassword,
      role: UserRole.STUDENT,
      nickname: process.env.SEED_STUDENT_NICKNAME ?? "Pilot Student"
    });
  }

  return accounts;
}

function toAuthorizedUser(user: {
  id: string;
  email: string;
  role: UserRole;
  nickname: string | null;
}): AuthorizedUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    nickname: user.nickname
  };
}

async function authorizeFromEnvFallback(
  email: string,
  password: string
): Promise<AuthorizedUser | null> {
  if (!envFallbackEnabled()) {
    return null;
  }

  const matched = getEnvFallbackAccounts().find((account) => account.email === email);

  if (!matched) {
    return null;
  }

  if (matched.password !== password) {
    return null;
  }

  return toAuthorizedUser(matched);
}

const authConfig: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      name: "EmailPassword",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.toLowerCase().trim();

        try {
          const user = await prisma.user.findUnique({
            where: { email }
          });

          if (!user) {
            return authorizeFromEnvFallback(email, parsed.data.password);
          }

          if (!user.passwordHash) {
            return null;
          }

          const isValidPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);

          if (!isValidPassword) {
            return null;
          }

          return toAuthorizedUser({
            id: user.id,
            email: user.email ?? email,
            role: user.role,
            nickname: user.nickname,
          });
        } catch (error) {
          console.warn("[auth] Database lookup failed, trying env fallback mode");
          return authorizeFromEnvFallback(email, parsed.data.password);
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.nickname = user.nickname ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user) {
        return session;
      }

      session.user.id = token.sub ?? "";
      session.user.role = (token.role as UserRole | undefined) ?? UserRole.STUDENT;
      session.user.nickname = (token.nickname as string | null | undefined) ?? null;

      return session;
    }
  }
};

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
