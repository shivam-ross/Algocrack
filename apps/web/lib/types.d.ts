import { DefaultSession, DefaultUser, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"]; // Keep default fields (name, email, image)
  }

  interface User extends DefaultUser {
    id: string;
    password?: string; // Only for credentials sign-in (not stored in session)
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
  }
}