import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { dbConnect } from "@/lib/db";

export async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  await dbConnect();
  return user;
}
