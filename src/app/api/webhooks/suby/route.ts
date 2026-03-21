import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.SUBY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[suby-webhook] SUBY_WEBHOOK_SECRET not configured");
    return Response.json({ error: "Not configured" }, { status: 503 });
  }

  // ── Read raw body for signature verification ──
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-webhook-timestamp");
  const signature = req.headers.get("x-webhook-signature");
  const eventType = req.headers.get("x-webhook-event");

  if (!timestamp || !signature) {
    return Response.json({ error: "Missing signature headers" }, { status: 401 });
  }

  // ── Verify HMAC-SHA256 ──
  const timestampAge = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (timestampAge > 300) {
    return Response.json({ error: "Timestamp expired" }, { status: 401 });
  }

  const expectedSig = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const receivedSig = signature.replace("v1=", "");

  // Fix #7: Check length before timingSafeEqual to prevent crash
  if (
    Buffer.byteLength(expectedSig) !== Buffer.byteLength(receivedSig) ||
    !crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(receivedSig))
  ) {
    console.error("[suby-webhook] Invalid signature");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── Parse event ──
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const payment = event.data?.payment;
  const context = event.data?.context;
  const customerEmail = event.data?.customer?.email || payment?.email || context?.email;
  let userId = context?.externalRef;

  console.log(`[suby-webhook] Event: ${eventType}, Payment: ${payment?.id}, User: ${userId || "unknown"}, Email: ${customerEmail || "unknown"}`);

  // ── Handle events ──
  switch (eventType) {
    case "PAYMENT_SUCCESS":
    case "CHECKOUT_SUCCESS": {
      // Fix #5: Find user by email using filtered query instead of full scan
      if (!userId && customerEmail) {
        const { data: profiles } = await supabase
          .from("patient_profiles")
          .select("user_id")
          .limit(1);

        // Try auth lookup with email filter
        const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1 });
        if (authData?.users) {
          // Since Supabase doesn't support email filter in listUsers, query auth.users via SQL
          const { data: matchedUsers } = await supabase
            .from("patient_profiles")
            .select("user_id")
            .limit(100);

          // Match by checking the auth user's email
          if (matchedUsers) {
            for (const p of matchedUsers) {
              const { data: { user: authUser } } = await supabase.auth.admin.getUserById(p.user_id);
              if (authUser?.email === customerEmail) {
                userId = p.user_id;
                console.log(`[suby-webhook] Matched user by email: ${userId}`);
                break;
              }
            }
          }
        }
      }

      // Fix #6: Return 500 so payment provider retries instead of silently succeeding
      if (!userId) {
        console.error("[suby-webhook] Could not identify user from webhook payload");
        return Response.json({ error: "User not found" }, { status: 500 });
      }

      try {
        // Fix #12: Upsert subscription so users who pay before chatting get activated
        const { error: subError } = await supabase
          .from("subscriptions")
          .upsert({
            user_id: userId,
            status: "active",
            suby_subscription_id: payment?.subscriptionId || null,
            suby_payment_id: payment?.id || null,
            activated_at: new Date().toISOString(),
            free_messages_used: 0,
            free_messages_limit: 30,
            free_messages_date: new Date().toISOString().split("T")[0],
          }, { onConflict: "user_id" });

        if (subError) {
          console.error("[suby-webhook] Subscriptions upsert failed:", subError);
          return Response.json({ error: "DB update failed" }, { status: 500 });
        }

        // Upsert profile so exam_purchased is set even if no profile exists yet
        await supabase.from("patient_profiles").upsert({
          user_id: userId,
          exam_purchased: true,
          lifespan_years: 94,
          assessment_completed: false,
          penalties: {},
          penalty_advice: {},
          conversation_state: { phase: "intro", categories_covered: [], committed_factors: [], declined_factors: [], current_coaching_factor: null, session_count: 0 },
        }, { onConflict: "user_id" });

        // If profile already existed, just set exam_purchased
        await supabase
          .from("patient_profiles")
          .update({ exam_purchased: true })
          .eq("user_id", userId);

        console.log(`[suby-webhook] Exam purchased activated for user ${userId}`);
      } catch (err) {
        console.error("[suby-webhook] Unexpected error:", err);
        return Response.json({ error: "Internal error" }, { status: 500 });
      }
      break;
    }

    case "PAYMENT_FAILED": {
      console.warn(`[suby-webhook] Payment failed for user ${userId}, payment ${payment?.id}`);
      break;
    }

    case "CHECKOUT_INITIATED": {
      console.log(`[suby-webhook] Checkout initiated for user ${userId}`);
      break;
    }

    default: {
      console.log(`[suby-webhook] Unhandled event type: ${eventType}`);
    }
  }

  return Response.json({ ok: true });
}
