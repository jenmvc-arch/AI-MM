import { workspaceSchema } from "@/lib/validation";
import { currentUser } from "@/lib/server-auth";
import { errorResponse } from "@/lib/api";

export async function GET() {
  const { supabase, user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, organization_id, name, default_currency, timezone, created_at")
    .order("created_at", { ascending: true });
  if (error)
    return errorResponse(
      "DATABASE_ERROR",
      "Could not load workspaces.",
      error.message,
    );
  return Response.json({ data });
}

export async function POST(request: Request) {
  const { supabase, user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const parsed = workspaceSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return errorResponse(
      "VALIDATION_ERROR",
      "Workspace details are invalid.",
      parsed.error.flatten(),
    );
  const rpc = parsed.data.organizationId
    ? await supabase.rpc("create_workspace_for_org", {
        target_org: parsed.data.organizationId,
        workspace_name: parsed.data.name,
        workspace_currency: parsed.data.defaultCurrency,
        workspace_timezone: parsed.data.timezone,
        brand_name: parsed.data.brandName,
      })
    : await supabase.rpc("create_workspace_with_brand", {
        workspace_name: parsed.data.name,
        workspace_currency: parsed.data.defaultCurrency,
        workspace_timezone: parsed.data.timezone,
        brand_name: parsed.data.brandName,
      });
  const { data, error } = rpc;
  if (error)
    return errorResponse(
      "DATABASE_ERROR",
      "Could not create workspace.",
      error.message,
    );
  return Response.json({ data }, { status: 201 });
}
