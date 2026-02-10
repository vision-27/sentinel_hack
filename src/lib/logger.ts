/**
 * Logs an external API call with standardized formatting.
 * 
 * @param service - The name of the service being called (e.g., 'Google Maps', 'Supabase', 'Gemini')
 * @param method - The HTTP method or operation (e.g., 'GET', 'update', 'generateContent')
 * @param endpoint - The endpoint, target table, or model
 * @param payload - The data being sent
 */
export function logExternalCall(service: string, method: string, endpoint: string, payload?: any) {
    const timestamp = new Date().toISOString();
    console.log(`%c[EXTERNAL API CALL] [${timestamp}]`, 'color: #3b82f6; font-weight: bold;');
    console.log(`%cService: %c${service}`, 'font-weight: bold;', 'color: #10b981;');
    console.log(`%cMethod:  %c${method}`, 'font-weight: bold;', 'color: #f59e0b;');
    console.log(`%cTarget:  %c${endpoint}`, 'font-weight: bold;', 'color: #8b5cf6;');
    if (payload) {
        try {
            console.log('%cPayload:', 'font-weight: bold;', payload);
        } catch (e) {
            console.log('%cPayload: %c[Unserializable]', 'font-weight: bold;', 'color: #ef4444;');
        }
    }
    console.log('%c-----------------------------------', 'color: #3b82f6;');
}
