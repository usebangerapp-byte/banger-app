import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get user from auth header
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = req.headers.get("origin") || "https://usebanger.com";
  const body = await req.json().catch(() => ({}));
  const yearly = body?.plan === "yearly" && !!process.env.STRIPE_PRICE_ID_YEARLY;
  const price = yearly ? process.env.STRIPE_PRICE_ID_YEARLY! : process.env.STRIPE_PRICE_ID!;

  // 3-day free trial — only for people who never had a subscription
  const { data: prof } = await supabase.from("profiles")
    .select("stripe_customer_id,stripe_subscription_id").eq("id", user.id).maybeSingle();
  const firstTime = !prof?.stripe_subscription_id;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      ...(prof?.stripe_customer_id ? { customer: prof.stripe_customer_id } : { customer_email: user.email }),
      metadata: { user_id: user.id, plan: yearly ? "yearly" : "monthly" },
      success_url: `${origin}/home?pro=success`,
      cancel_url:  `${origin}/upgrade?cancelled=1`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { user_id: user.id },
        ...(firstTime ? { trial_period_days: 3 } : {}),
      },
    });

    return Response.json({ url: session.url });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
