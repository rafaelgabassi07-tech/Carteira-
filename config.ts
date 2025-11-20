// This function provides a robust way to access environment variables,
// supporting both Vite's `import.meta.env` (for client-side) and Node's `process.env`.
// It prioritizes Vite's `VITE_` prefixed variables but provides fallbacks.
const getConfig = () => {
    // Safely access the environment object, prioritizing Vite's `import.meta.env`.
    const env = (typeof (import.meta as any)?.env !== 'undefined') 
        ? (import.meta as any).env 
        : (typeof process !== 'undefined' ? process.env : {});

    return {
        // Prioritize VITE_API_KEY, but fall back to API_KEY
        geminiApiKey: env.VITE_API_KEY || env.API_KEY,
        // Prioritize VITE_BRAPI_TOKEN, but fall back to BRAPI_TOKEN
        brapiToken: env.VITE_BRAPI_TOKEN || env.BRAPI_TOKEN,
    };
};

export const config = getConfig();
