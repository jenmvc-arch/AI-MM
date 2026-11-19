import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/supabase/types";

export async function currentUser() {
  const supabase = await createClient(); const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null, error: error?.message ?? "Authentication required" };
  return { supabase, user: data.user, error: null };
}

export async function canAccessWorkspace(workspaceId: string, allowed: Role[]) {
  const { supabase, user, error } = await currentUser(); if (!user) return { supabase, user: null, role: null, error };
  const { data: membership, error: memberError } = await supabase.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (memberError) return { supabase, user, role: null, error: memberError.message };
  const role = membership?.role as Role | undefined;
  return { supabase, user, role: role ?? null, error: role && allowed.includes(role) ? null : "You do not have permission for this workspace." };
}
