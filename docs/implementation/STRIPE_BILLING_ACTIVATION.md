# Stripe Billing Activation

ShipSeal sells Free and Pro publicly. Pro is configured as a recurring Stripe Price and synchronizes into ShipSeal's existing server-authoritative entitlement model. Stripe never replaces the entitlement or AI-usage ledgers.

## Trust flow

1. An authenticated user asks ShipSeal to create a Pro Checkout Session.
2. The server selects `SHIPSEAL_STRIPE_PRO_PRICE_ID`, reuses or creates the mapped Stripe Customer, and returns only Stripe's hosted Checkout URL.
3. Stripe sends signed subscription events to `/api/billing/webhook`.
4. ShipSeal verifies the signature against the raw request body, resolves the current Stripe Subscription, records the Stripe event ID, and synchronizes the subscription and entitlement in one database transaction.
5. The browser's `/payment/success` route polls the existing authoritative account usage endpoint. A Checkout redirect never grants access.

Active and trialing subscriptions enable Repository Futures and Executable Future Plans. `past_due` retains the Pro account identity and Portal access but blocks new paid AI execution through the existing inactive-entitlement guard. `cancel_at_period_end=true` keeps access while Stripe still reports `active` or `trialing`. Canceled, unpaid, paused, incomplete, and incomplete-expired states do not permit new paid AI execution.

## Stripe Test Mode founder setup

1. In Stripe Test Mode, create a Product named `ShipSeal Pro`.
2. Create one recurring monthly Price for USD 19. Copy its `price_...` ID.
3. Enable and configure the Stripe Customer Portal for payment-method updates, subscription viewing, cancellation, and resumption where supported by Stripe.
4. Apply database migration `0005_billing` with `npm run db:migrate`.
5. In Vercel, set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SHIPSEAL_STRIPE_PRO_PRICE_ID`, `SHIPSEAL_APP_ORIGIN`, and `DATABASE_URL`. Optionally set `SHIPSEAL_PRO_DEEP_ANALYSIS_LIMIT`; the default is 10.
6. Deploy before registering the endpoint so `/api/billing/webhook` exists.
7. Add a Stripe webhook endpoint at `https://YOUR_DOMAIN/api/billing/webhook` for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
8. Copy that endpoint's Test Mode signing secret into `STRIPE_WEBHOOK_SECRET`, then redeploy.
9. From an authenticated Free account, start Checkout from a locked Repository Futures surface and complete a Stripe test payment.
10. Confirm `/payment/success` waits for the webhook, the account reports Pro with the configured allowance, Repository Futures unlocks, and Customer Portal opens from the account page.
11. Schedule cancellation in the Portal and confirm access remains through the paid period. Use Stripe Test Clocks where practical to verify renewal, failed payment, and terminal cancellation transitions.

Test and live Stripe keys, Prices, and webhook signing secrets are distinct. Complete this checklist in Test Mode before separately reviewing any live-mode activation.
