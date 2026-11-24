/**
 * Security Service for ClientVault
 * Handles SHA-256 PIN hashing via Web Crypto API, verification, and inactivity lock tracking.
 */

const PIN_SALT = 'clientvault-applock-salt-v1:';

/**
 * Hash a user's 4-to-8 digit PIN using standard SHA-256 with salt via Web Crypto API.
 */
export async function hashPin(pin: string): Promise<string> {
  if (!pin || pin.length < 4) {
    throw new Error('PIN must be at least 4 digits');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(`${PIN_SALT}${pin}`);
  
  // Web Crypto is standard in modern browsers and Node 15+
  const subtle = typeof window !== 'undefined' && window.crypto?.subtle 
    ? window.crypto.subtle 
    : (globalThis as any).crypto?.subtle;

  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is not supported in this environment');
  }

  const hashBuffer = await subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a raw PIN against a stored SHA-256 hash.
 */
export async function verifyPin(rawPin: string, hashedPin: string): Promise<boolean> {
  try {
    const hashed = await hashPin(rawPin);
    return hashed === hashedPin;
  } catch {
    return false;
  }
}
