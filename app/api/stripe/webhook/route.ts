import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { notifyOnce, WELCOME_TITLE, WELCOME_MESSAGE } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e: any) {
    return Response.json({ error: `Webhook error: ${e.message}` }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Subscription activée / renouvelée ──
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.user_id;
    if (!userId) return Response.json({ ok: true });

    const isActive = sub.status === "active" || sub.status === "trialing";

    await supabase.from("profiles").update({
      role:                    isActive ? "pro" : "public",
      stripe_customer_id:      sub.customer as string,
      stripe_subscription_id:  sub.id,
      stripe_status:           sub.status,
      pro_since:               isActive ? new Date().toISOString() : null,
      ...(isActive ? { plan_selected_at: new Date().toISOString() } : {}),
    }).eq("id", userId);

    if (isActive) {
      await notifyOnce(supabase, userId, "welcome", WELCOME_MESSAGE, WELCOME_TITLE).catch(() => {});
      await notifyOnce(supabase, userId, "pro_welcome",
        "Upload your IDs, unlock the full unreleased chart and see how your tracks move.",
        "You're now BANGER PRO ✦").catch(() => {});
    }
  }

  // ── Subscription annulée / expirée ──
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.user_id;
    if (!userId) return Response.json({ ok: true });

    await supabase.from("profiles").update({
      role:           "public",
      stripe_status:  "canceled",
      pro_since:      null,
    }).eq("id", userId);
  }

  // ── Paiement échoué ──
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : (invoice.customer as any)?.id;

    // Retrouver le user via le customer ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (profile?.id) {
      await supabase.from("profiles").update({
        stripe_status: "past_due",
      }).eq("id", profile.id);
    }
  }

  return Response.json({ ok: true });
}
