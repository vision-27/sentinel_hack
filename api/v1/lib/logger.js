/**
 * Logs an external API call with standardized formatting.
 * 
 * @param {string} service - The name of the service being called (e.g., 'Google Maps', 'Supabase')
 * @param {string} method - The HTTP method or operation (e.g., 'GET', 'update', 'upsert')
 * @param {string} endpoint - The endpoint or target table
 * @param {any} payload - The data being sent (will be stringified)
 */
export function logExternalCall(service, method, endpoint, payload) {
    const timestamp = new Date().toISOString();
    console.log(`[EXTERNAL API CALL] [${timestamp}]`);
    console.log(`Service: ${service}`);
    console.log(`Method:  ${method}`);
    console.log(`Target:  ${endpoint}`);
    if (payload) {
        try {
            const sanitizedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
            console.log(`Payload: ${sanitizedPayload}`);
        } catch (e) {
            console.log(`Payload: [Unserializable ${typeof payload}]`);
        }
    }
    console.log('-----------------------------------');
}
