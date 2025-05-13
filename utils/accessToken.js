const axios = require('axios');

/**
 * Function to get an M-Pesa access token
 * @param {string} [customConsumerKey] - Optional Consumer Key
 * @param {string} [customConsumerSecret] - Optional Consumer Secret
 * @param {string} [customAuthUrl] - Optional Auth URL
 * @returns {Promise<string>} - Access Token
 */
const getAccessToken = async (customConsumerKey, customConsumerSecret, customAuthUrl) => {
    // Load values from environment variables or use defaults
    const consumerKey = customConsumerKey || process.env.MPESA_CONSUMER_KEY || "defaultConsumerKey";
    const consumerSecret = customConsumerSecret || process.env.MPESA_CONSUMER_SECRET || "defaultConsumerSecret";
    const authUrl = customAuthUrl || process.env.MPESA_AUTH_URL || "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

    // Construct Basic Authorization header
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    try {
        const response = await axios.get(authUrl, {
            headers: {
                Authorization: `Basic ${auth}`,
            },
        });

        // Log token for development purposes (remove in production)
        console.log('Access Token:', response.data.access_token);

        return response.data.access_token;
    } catch (error) {
        // Improved error logging
        console.error('Error fetching access token:', error.response?.data || error.message);
        throw new Error('Failed to generate M-Pesa access token. Check your credentials or network.');
    }
};

module.exports = { getAccessToken };

