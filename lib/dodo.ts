import DodoPayments from 'dodopayments';

// Lazy-load DodoPayments client to avoid build-time errors
let _dodoClient: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
    if (!_dodoClient) {
        const apiKey = process.env.DODO_PAYMENTS_API_KEY;
        if (!apiKey) {
            throw new Error('DODO_PAYMENTS_API_KEY environment variable is not set');
        }
        _dodoClient = new DodoPayments({
            bearerToken: apiKey,
            environment: 'live_mode', // LIVE MODE - Real payments
        });
    }
    return _dodoClient;
}

// Credit package to DodoPayments product ID mapping
// These IDs must match products created in DodoPayments dashboard
export const DODO_PRODUCT_IDS: Record<string, string> = {
    starter: 'pdt_0NWHKzXSeImXNM6FkwHZK',  // Reven Starter - $19 (Live)
    pro: 'pdt_0NWYUSiqPOMyemAR4mWmd',      // Reven Pro - $39 (Live)
    studio: 'pdt_0NWYUXOKtXT9Tp6JrdV7Q',   // Reven Studio - $79 (Live)
    enterprise: 'pdt_enterprise_credits',   // TODO: Create in dashboard
};
