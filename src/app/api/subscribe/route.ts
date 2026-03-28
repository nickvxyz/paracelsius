import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  // ── Auth required ──
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  // ── Double-pay protection: check if already purchased ──
  const { data: profile } = await supabase
    .from("patient_profiles")
    .select("exam_purchased")
    .eq("user_id", user.id)
    .single();

  if (profile?.exam_purchased) {
    return Response.json({ error: "Examination already purchased" }, { status: 409 });
  }

  // ── Create Suby.fi payment session ──
  const apiKey = process.env.SUBY_API_KEY;
  const productId = process.env.SUBY_PRODUCT_ID;

  if (!apiKey || !productId) {
    return Response.json(
      { error: "Payment service not configured" },
      { status: 503 }
    );
  }

  // Build Suby.fi checkout URL with pre-filled email
  const paymentUrl = `https://app.suby.fi/pay/${productId}?email=${encodeURIComponent(user.email || "")}&ref=${encodeURIComponent(user.id)}`;

  return Response.json({ paymentUrl });
}
