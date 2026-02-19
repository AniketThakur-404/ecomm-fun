// Shiprocket API Integration

// NOTE: These requests are routed through a backend proxy to avoid exposing credentials
// and to handle CORS issues with the Shiprocket API.

const resolveApiBase = () => {
    const configured = import.meta.env.VITE_API_BASE_URL;
    if (configured) return configured.replace(/\/+$/, '');
    if (import.meta.env.PROD && typeof window !== 'undefined') {
        return window.location.origin;
    }
    return '';
};

const API_BASE = resolveApiBase();
const SHIPROCKET_API_BASE = API_BASE ? `${API_BASE}/api/shiprocket` : '/api/shiprocket';

/**
 * Check serviceability for a pincode
 * @param {string} pickupPostcode - Your warehouse pincode (defaulting to a common one or you need to configure this)
 * @param {string} deliveryPostcode - Customer's pincode
 * @param {number} weight - Weight in kg (default 0.5)
 * @param {number} cod - 1 for COD, 0 for Prepaid (default 1)
 */
export const checkServiceability = async (deliveryPostcode, pickupPostcode = '700001', weight = 0.5, cod = 1) => {
    try {
        const url = `${SHIPROCKET_API_BASE}/serviceability?pickup_postcode=${pickupPostcode}&delivery_postcode=${deliveryPostcode}&weight=${weight}&cod=${cod}`;

        const response = await fetch(url, { method: 'GET' });

        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || payload?.details || 'Serviceability API failed');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Shiprocket Serviceability Error:', error);
        throw error;
    }
};

/**
 * Track an order by AWB or Order ID
 * @param {string} awbCode 
 * @param {string} orderId
 */
export const trackOrder = async ({ awbCode, orderId }) => {
    try {
        let url = '';
        if (awbCode) {
            url = `${SHIPROCKET_API_BASE}/track?awb=${encodeURIComponent(awbCode)}`;
        } else if (orderId) {
            // Note: Tracking by Order ID typically requires looking up the AWB first via another endpoint
            // or using the specific channel order tracking endpoint.
            // For simplicity, we'll try the generic tracking endpoint if available or assume AWB is passed.
            // Shiprocket tracking by Order ID: /courier/track/order/{order_id}
            url = `${SHIPROCKET_API_BASE}/track?order_id=${encodeURIComponent(orderId)}`;
        } else {
            throw new Error('AWB Code or Order ID required');
        }

        const response = await fetch(url, { method: 'GET' });

        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || payload?.details || 'Tracking API failed');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Shiprocket Tracking Error:', error);
        throw error;
    }
};

/**
 * Format Shiprocket response for frontend use
 */
export const formatServiceabilityResponse = (data) => {
    // Shiprocket returns structure like data.data.available_courier_companies
    const companies = data?.data?.available_courier_companies || [];
    if (companies.length === 0) {
        return { serviceable: false };
    }

    // Find best courier (e.g., fastest or cheapest)
    // For now, take the first one or logic to pick likely one
    const courier = companies[0];

    return {
        serviceable: true,
        city: data?.data?.city || '',
        state: data?.data?.state || '',
        days: courier.etd || '3-5', // ETD is usually in hours or days, need to check specific response
        cod: courier.cod === 1,
        courierName: courier.courier_name,
        returnAvailable: true // Assuming policy
    };
};
