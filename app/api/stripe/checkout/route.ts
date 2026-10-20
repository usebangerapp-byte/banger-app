import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
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

  const origin = req.headers.get("origin") || "https://banger-app-zeta.vercel.app";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      customer_email: user.email,
      metadata: {
        user_id: user.id,
      },
      success_url: `${origin}/home?pro=success`,
      cancel_url:  `${origin}/onboarding?cancelled=1`,
      subscription_data: {
        metadata: { user_id: user.id },
      },
    });

    return Response.json({ url: session.url });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
