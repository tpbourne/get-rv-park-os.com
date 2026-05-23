import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.18.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { name, email, parkName, sites, quantity, pedestalImageUrl } = await req.json()

    if (!email || !quantity || quantity < 1) {
      throw new Error('Invalid request parameters')
    }

    const priceCents = 29900; // $299.00 deposit
    
    // Total order value (for database tracking)
    const totalOrderCents = priceCents * quantity;

    // 1. Create or find customer in Stripe
    const customers = await stripe.customers.list({ email: email, limit: 1 })
    let customerId = customers.data[0]?.id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          parkName,
          sites: sites?.toString() || ''
        }
      })
      customerId = customer.id
    }

    // 2. Setup Payment Methods (Cards only for deposit)
    let paymentMethodTypes = ['card'];

    let originUrl = req.headers.get('origin');
    if (!originUrl || originUrl === 'null' || originUrl === '') {
      originUrl = 'https://getrvparkos.com';
    }

    // 3. Create Checkout Session (Always strictly 1 unit of $299 for deposit)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: paymentMethodTypes as any,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'RV Park OS Submeter - Deposit',
              description: `Hardware deposit for ${parkName}. Remaining balance for ${quantity} meters will be invoiced.`,
            },
            unit_amount: priceCents,
          },
          quantity: 1, // Only charge 1 deposit regardless of how many they order
        },
      ],
      mode: 'payment',
      success_url: `${originUrl}/?success=true`,
      cancel_url: `${originUrl}/?canceled=true`,
      metadata: {
        parkName,
        sites: sites?.toString(),
        quantity: quantity.toString(),
        pedestalImageUrl: pedestalImageUrl || ''
      }
    })

    // 4. Insert pending order into Supabase
    const { error: dbError } = await supabase.from('orders').insert({
      stripe_customer_id: customerId,
      stripe_checkout_session_id: session.id,
      customer_email: email,
      customer_name: name,
      quantity: quantity,
      amount_cents: totalOrderCents,
      pedestal_image_url: pedestalImageUrl,
      status: 'pending',
    })

    if (dbError) {
      console.error('Database Error:', dbError)
      throw new Error('Failed to create order record')
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Checkout Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

