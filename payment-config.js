// ELEV8MI booking payments. After a booking request is sent (or the email
// draft opens), the visitor is taken to the payment link for the reading
// they chose. Stripe Payment Links are preferred: in Stripe, create a
// Payment Link for each price, copy its https://buy.stripe.com/... URL and
// paste it below, replacing the placeholder. PayPal payment links
// (https://www.paypal.com/...) also work. Until a placeholder is replaced, the
// site does not redirect; it says the payment link is coming soon and that
// Allison will email the payment details.
window.Elev8PaymentConfig={
  links:{
    'one-card':'PASTE-STRIPE-LINK-1111',   // One Card Pull, $11.11
    'five-card':'PASTE-STRIPE-LINK-2222'   // 5 Card Story, $22.22
  }
};
