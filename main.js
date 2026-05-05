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

// Form Handling
document.getElementById('reserve-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Simulate form submission
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    
    btn.innerText = 'Reserving...';
    btn.disabled = true;
    
    setTimeout(() => {
        alert('Thank you! Your spot has been reserved. We will reach out to you shortly with shipping details.');
        btn.innerText = 'Spot Reserved!';
        e.target.reset();
    }, 1500);
});
