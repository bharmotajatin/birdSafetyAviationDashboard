import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { dbConnect } from "@/lib/db";
import { User } from "@/lib/db/models/User";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  await dbConnect();
  const user = await User.findById(userId).lean();
  return user ?? null;
}
