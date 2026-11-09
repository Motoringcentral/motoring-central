// Platform prices, in pence. Launch prices are 50% off the usual price.
// Partner commission is in basis points (100 bps = 1%).

export const LAUNCH_OFFER = true;

export const PRICES = {
  bookingFee: { usual: 499, launch: 250 },
  paygCommissionBps: { usual: 1000, launch: 500 },
  proMonthly: { usual: 14900, launch: 7450 },
  tradeListing: { usual: 999, launch: 999 },
  premiumAd: { usual: 999, launch: 500 },
} as const;

export const DEALER_FREE_TRADE_LISTINGS_PER_MONTH = 5;
export const DEALER_FREE_TRIAL_MONTHS = 3;
export const PREMIUM_AD_DAYS = 14;

// Dealer plans are chosen by stock size. Not discounted at launch; the
// first 3 months are free instead. `maxListings: null` means no limit.
export const DEALER_PLANS = {
  STARTER: { name: "Starter", monthlyPence: 14900, maxListings: 10, freePremiumAds: 0 },
  STANDARD: { name: "Standard", monthlyPence: 19900, maxListings: 20, freePremiumAds: 1 },
  PLUS: { name: "Plus", monthlyPence: 24900, maxListings: 30, freePremiumAds: 3 },
  PRO: { name: "Pro", monthlyPence: 29900, maxListings: 50, freePremiumAds: 4 },
  PREMIER: { name: "Premier", monthlyPence: 39900, maxListings: null, freePremiumAds: 5 },
} as const;

export function current(price: { usual: number; launch: number }) {
  return LAUNCH_OFFER ? price.launch : price.usual;
}

export function formatPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}
