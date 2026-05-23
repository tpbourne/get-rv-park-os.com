import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.18.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    
    let event;
    if (endpointSecret) {
      event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret)
    } else {
      // Fallback if no secret is set
      event = JSON.parse(body)
    }

    // Handle bank transfer specific async payments
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      
      const { error } = await supabase
        .from('orders')
        .update({
          status: session.payment_status === 'paid' ? 'paid' : 'awaiting_payment',
          payment_method: session.payment_method_types?.[0] || 'unknown',
          paid_at: session.payment_status === 'paid' ? new Date().toISOString() : null
        })
        .eq('stripe_checkout_session_id', session.id)

      if (error) console.error('Supabase update error:', error)
    }

    // When ACH push transfer lands and payment completes
    if (event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session
      
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('stripe_checkout_session_id', session.id)

      if (error) console.error('Supabase update error:', error)
    }

    // When bank transfer fails or is canceled
    if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session
      
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'failed'
        })
        .eq('stripe_checkout_session_id', session.id)

      if (error) console.error('Supabase update error:', error)
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err: any) {
    console.error('Webhook error:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
