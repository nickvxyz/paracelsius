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

  if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(receivedSig))) {
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
  const userId = context?.externalRef;

  console.log(`[suby-webhook] Event: ${eventType}, Payment: ${payment?.id}, User: ${userId}`);

  // ── Handle events ──
  switch (eventType) {
    case "PAYMENT_SUCCESS":
    case "CHECKOUT_SUCCESS": {
      if (!userId) {
        console.error("[suby-webhook] No externalRef in payment context");
        return Response.json({ ok: true });
      }

      try {
        // Update subscriptions table
        const { error: subError } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            suby_subscription_id: payment?.subscriptionId || null,
            suby_payment_id: payment?.id || null,
            activated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (subError) {
          console.error("[suby-webhook] Subscriptions update failed:", subError);
          return Response.json({ error: "DB update failed" }, { status: 500 });
        }

        // Set exam_purchased on patient_profiles
        const { error: profileError } = await supabase
          .from("patient_profiles")
          .update({ exam_purchased: true })
          .eq("user_id", userId);

        if (profileError) {
          console.error("[suby-webhook] Profile update failed:", profileError);
          return Response.json({ error: "DB update failed" }, { status: 500 });
        }

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
