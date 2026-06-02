import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { dbConnect } from "@/lib/db";
import { ActivityLog } from "@/lib/db/models/ActivityLog";
import { Station } from "@/lib/db/models/Station";
import { User } from "@/lib/db/models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        await dbConnect();
        const user = await User.findOne({
          email: credentials.email.toLowerCase().trim(),
          isActive: true,
        }).lean();
        if (!user) {
          await ActivityLog.create({
            type: "login",
            action: "login_failed",
            message: `Failed login attempt for ${credentials.email}`,
          });
          return null;
        }

        const validPassword = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!validPassword) {
          await ActivityLog.create({
            type: "login",
            action: "login_failed",
            message: `Invalid password for ${credentials.email}`,
            targetUserId: user._id,
          });
          return null;
        }

        const station = user.station ? await Station.findById(user.station).lean() : null;
        await ActivityLog.create({
          type: "login",
          action: "login_success",
          message: `User ${user.email} signed in`,
          actorUserId: user._id,
          targetUserId: user._id,
          metadata: { role: user.role, station: station?.code ?? null },
        });
        await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

        return {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          station: station?.code ?? null,
        } as any;
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).userId = user.id;
        (token as any).role = (user as any).role;
        (token as any).station = (user as any).station;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).userId;
        (session.user as any).role = (token as any).role;
        (session.user as any).station = (token as any).station;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/error",
  },
};
