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

  const origin = req.headers.get("origin") || req.nextUrl.origin;

  try {
    const res = await fetch("https://api.suby.fi/api/payment/initiate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Suby-Api-Key": apiKey,
      },
      body: JSON.stringify({
        productId,
        customerEmail: user.email,
        externalRef: user.id,
        metadata: { source: "paracelsus", userId: user.id, product: "l1_examination" },
        successUrl: `${origin}/profile?exam_purchased=true`,
        cancelUrl: `${origin}/profile`,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      const errMsg = data.error?.message || "Payment initiation failed";
      return Response.json({ error: errMsg }, { status: res.status || 500 });
    }

    return Response.json({
      paymentUrl: data.data.paymentUrl,
      paymentId: data.data.paymentId,
    });
  } catch {
    return Response.json(
      { error: "Payment service unavailable" },
      { status: 503 }
    );
  }
}
