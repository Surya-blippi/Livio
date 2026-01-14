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
    pro: 'pdt_pro_credits',                 // TODO: Create in dashboard
    studio: 'pdt_studio_credits',           // TODO: Create in dashboard
    enterprise: 'pdt_enterprise_credits',   // TODO: Create in dashboard
};
