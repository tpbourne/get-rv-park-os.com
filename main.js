// Calculator Logic
const sitesRange = document.getElementById('sites-range');
const leakageRange = document.getElementById('leakage-range');
const capRange = document.getElementById('cap-range');

const sitesDisplay = document.getElementById('sites-display');
const leakageDisplay = document.getElementById('leakage-display');
const capDisplay = document.getElementById('cap-display');

const noiResult = document.getElementById('noi-result');
const valuationResult = document.getElementById('valuation-result');

function calculate() {
    const sites = parseInt(sitesRange.value);
    const leakage = parseInt(leakageRange.value);
    const cap = parseFloat(capRange.value);

    const annualNOI = (sites * leakage) * 12;
    const valuationBoost = annualNOI / (cap / 100);

    sitesDisplay.innerText = sites;
    leakageDisplay.innerText = leakage;
    capDisplay.innerText = cap.toFixed(1);

    noiResult.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(annualNOI);
    valuationResult.innerText = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(valuationBoost);
}

sitesRange.addEventListener('input', calculate);
leakageRange.addEventListener('input', calculate);
capRange.addEventListener('input', calculate);

// Checkout Form Logic
const checkoutForm = document.getElementById('checkout-form');
const quantityInput = document.getElementById('quantity');
const submitBtn = document.getElementById('submit-btn');
const btnText = document.getElementById('btn-text');
const btnLoader = document.getElementById('btn-loader');
const errorMessage = document.getElementById('error-message');

// Setup Supabase Client (For File Uploads)
// TODO: Replace these with your actual Supabase Project URL and Anon Key
const supabaseUrl = 'https://ylmjkgolgwxstnadhnsd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsbWprZ29sZ3d4c3RuYWRobnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDMxMTIsImV4cCI6MjA5NTAxOTExMn0.-REhiDSdJ32FTaF_CrD7CJ8bh8u9__tF8AYydyhFOOk';
const supabaseClient = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

// Price per meter
const PRICE_PER_UNIT = 299;

// Supabase Edge Function URL 
const SUPABASE_EDGE_FUNCTION_URL = 'https://ylmjkgolgwxstnadhnsd.supabase.co/functions/v1/create-checkout'; 

if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // UI Loading state
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
        errorMessage.style.display = 'none';

        const formData = new FormData(checkoutForm);
        const data = {
            name: formData.get('customerName'),
            email: formData.get('customerEmail'),
            parkName: formData.get('parkName'),
            sites: parseInt(formData.get('sites')),
            quantity: parseInt(formData.get('quantity')),
            pedestalImageUrl: null
        };

        try {
            // 1. Upload the image to Supabase Storage if a file was selected
            const file = formData.get('pedestalPic');
            if (file && file.size > 0 && supabaseClient) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `pedestal-images/${fileName}`;

                // Make sure you have created a public bucket named 'uploads' in Supabase!
                const { error: uploadError } = await supabaseClient.storage
                    .from('uploads')
                    .upload(filePath, file);

                if (uploadError) {
                    throw new Error(`Failed to upload image: ${uploadError.message}`);
                }

                // Get the public URL for the uploaded image
                const { data: urlData } = supabaseClient.storage
                    .from('uploads')
                    .getPublicUrl(filePath);
                
                data.pedestalImageUrl = urlData.publicUrl;
            }

            // 2. Initialize Checkout Session
            const response = await fetch(SUPABASE_EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to initialize checkout');
            }

            if (result.url) {
                window.location.href = result.url; // Redirect to Stripe Checkout
            }
        } catch (err) {
            console.error('Checkout error:', err);
            errorMessage.innerText = err.message;
            errorMessage.style.display = 'block';
            
            // Reset UI
            submitBtn.disabled = false;
            btnText.style.display = 'inline-block';
            btnLoader.style.display = 'none';
        }
    });
}

// Success / Cancel Messages from Stripe Return URLs
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success')) {
        alert('Payment successful! Your order has been placed. We will be in touch shortly.');
        window.history.replaceState(null, '', window.location.pathname);
    }
    if (urlParams.get('canceled')) {
        alert('Payment was canceled. You can try again whenever you are ready.');
        window.history.replaceState(null, '', window.location.pathname);
    }
});


