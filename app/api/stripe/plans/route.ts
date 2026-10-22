export const dynamic = "force-dynamic";
/** Which plans are available (the yearly one appears once its Stripe price is set in Vercel). */
export async function GET() {
  return Response.json({ monthly: !!process.env.STRIPE_PRICE_ID, yearly: !!process.env.STRIPE_PRICE_ID_YEARLY });
}
