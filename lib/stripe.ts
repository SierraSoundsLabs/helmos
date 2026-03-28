// Shared Stripe utilities

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY!;

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  return res.json();
}

export async function findStripeCustomer(
  email: string
): Promise<{ customerId: string; artistId: string } | null> {
  const customers = await stripeGet(
    `/customers?email=${encodeURIComponent(email)}&limit=5`
  );
  if (!customers.data?.length) return null;

  for (const customer of customers.data) {
    const sessions = await stripeGet(
      `/checkout/sessions?customer=${customer.id}&limit=10`
    );
    const paidSession = sessions.data?.find(
      (s: {
        payment_status: string;
        status: string;
        metadata?: { artist_id?: string };
      }) => s.payment_status === "paid" || s.status === "complete"
    );
    if (paidSession) {
      // Prefer artist_id from customer metadata (allows self-serve artist change)
      // Fall back to checkout session metadata (original signup)
      const artistId =
        customer.metadata?.artist_id ||
        paidSession.metadata?.artist_id ||
        "";
      return {
        customerId: customer.id,
        artistId,
      };
    }
  }
  return null;
}
