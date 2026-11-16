/**
 * Cloudflare Turnstile token verification.
 */

export interface TurnstileVerificationResult {
  success: boolean;
  challengeTs?: string;
  hostname?: string;
  errorCodes?: string[];
}

export async function verifyTurnstileToken(
  token: string | undefined,
  secretKey: string,
  remoteIp?: string
): Promise<TurnstileVerificationResult> {
  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] };
  }

  if (!secretKey) {
    return { success: false, errorCodes: ['missing-secret'] };
  }

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const data = (await response.json()) as {
      success: boolean;
      'challenge_ts'?: string;
      hostname?: string;
      'error-codes'?: string[];
    };

    return {
      success: data.success,
      challengeTs: data.challenge_ts,
      hostname: data.hostname,
      errorCodes: data['error-codes'],
    };
  } catch {
    return {
      success: false,
      errorCodes: ['turnstile-verification-network-error'],
    };
  }
}
