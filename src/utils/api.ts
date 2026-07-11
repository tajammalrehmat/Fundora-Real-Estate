/**
 * Utility to resolve API URLs, especially for hybrid environments (e.g. mobile APKs).
 */

export const getApiUrl = (path: string): string => {
  // Ensure path starts with a slash
  const formattedPath = path.startsWith('/') ? path : `/${path}`;

  // 1. Check if there's a VITE_API_URL environment variable baked in
  const envApiUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (envApiUrl) {
    return `${envApiUrl.replace(/\/$/, '')}${formattedPath}`;
  }

  // 2. Check systemSettings for a configured API URL saved in localStorage
  const savedSettings = localStorage.getItem('inv_system_settings');
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      if (parsed.apiUrl) {
        return `${parsed.apiUrl.trim().replace(/\/$/, '')}${formattedPath}`;
      }
    } catch (_) {}
  }

  // 3. If running on a web origin that is NOT localhost inside a native webview,
  // we can use the current browser's origin.
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    const isCapacitor = !!((window as any).Capacitor && (
      (window as any).Capacitor.isNative || 
      ((window as any).Capacitor.getPlatform && (window as any).Capacitor.getPlatform() !== 'web')
    ));
    
    if (!isCapacitor && !origin.includes('localhost') && origin.startsWith('http')) {
      // Save this origin as a cached fallback so the APK has it if needed later
      localStorage.setItem('inv_last_known_web_origin', origin);
      return `${origin}${formattedPath}`;
    }
  }

  // 4. Fallback to last known web origin saved in localStorage
  const lastKnown = localStorage.getItem('inv_last_known_web_origin');
  if (lastKnown) {
    return `${lastKnown.trim().replace(/\/$/, '')}${formattedPath}`;
  }

  // 5. Ultimate fallback to the current live URL of the platform
  return `https://ais-pre-hb5de275kkaohqffdp2qfz-614235734610.asia-southeast1.run.app${formattedPath}`;
};

/**
 * Smart fetch helper that automatically retries with the alternative workspace environment
 * (e.g. falls back from preview to dev, or vice versa) if the primary fetch fails or is unreachable.
 * This ensures the mobile APK can communicate with whichever server (dev or pre) is actively hosting the APIs.
 */
export const fetchWithFallback = async (path: string, options: RequestInit = {}): Promise<Response> => {
  const primaryUrl = getApiUrl(path);
  const formattedPath = path.startsWith('/') ? path : `/${path}`;

  try {
    console.log(`[API Proxy] Primary fetch attempt to: ${primaryUrl}`);
    const response = await fetch(primaryUrl, options);
    
    // If it's a gateway/server offline error or 404/502/503/504, we failover
    if (!response.ok && response.status >= 500) {
      throw new Error(`Server returned error status: ${response.status}`);
    }
    return response;
  } catch (err: any) {
    console.warn(`[API Proxy] Primary URL (${primaryUrl}) unreachable or failed: ${err.message || err}. Initiating smart environment failover...`);

    const devUrl = 'https://ais-dev-hb5de275kkaohqffdp2qfz-614235734610.asia-southeast1.run.app';
    const preUrl = 'https://ais-pre-hb5de275kkaohqffdp2qfz-614235734610.asia-southeast1.run.app';

    let fallbackUrl = '';
    if (primaryUrl.includes('ais-pre-')) {
      fallbackUrl = `${devUrl}${formattedPath}`;
    } else if (primaryUrl.includes('ais-dev-')) {
      fallbackUrl = `${preUrl}${formattedPath}`;
    } else {
      fallbackUrl = `${devUrl}${formattedPath}`;
    }

    console.log(`[API Proxy] Failover fetch attempt to: ${fallbackUrl}`);
    try {
      const fallbackResponse = await fetch(fallbackUrl, options);
      if (!fallbackResponse.ok) {
        console.warn(`[API Proxy] Fallback URL (${fallbackUrl}) returned status: ${fallbackResponse.status}`);
      }
      return fallbackResponse;
    } catch (fallbackErr: any) {
      console.error(`[API Proxy] Fallback URL (${fallbackUrl}) also failed:`, fallbackErr);
      // Re-throw to propagate back to caller
      throw fallbackErr;
    }
  }
};

