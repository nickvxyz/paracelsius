import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const { email_subscribed } = await req.json();

  const { error } = await supabase
    .from("patient_profiles")
    .update({
      tos_accepted_at: new Date().toISOString(),
      email_subscribed: !!email_subscribed,
    })
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
