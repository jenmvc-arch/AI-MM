import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function Home() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    redirect(user ? "/app" : "/login");
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_PUBLIC_SUPABASE")) redirect("/setup");
    throw error;
  }
}
