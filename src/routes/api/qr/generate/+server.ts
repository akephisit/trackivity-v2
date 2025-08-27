import { json, type RequestHandler } from '@sveltejs/kit';
import { getAuthenticatedUser } from '$lib/server/auth-utils';

function iso(ts: number) { return new Date(ts).toISOString(); }
function randomId() { return crypto.randomUUID(); }
function randomHex(len = 32) { return Array.from(crypto.getRandomValues(new Uint8Array(len))).map(b => b.toString(16).padStart(2, '0')).join(''); }

export const POST: RequestHandler = async (event) => {
  try {
    const user = getAuthenticatedUser(event);
    if (!user) {
      return json({ success: false, error: { code: 'NO_SESSION', message: 'Authentication required' } }, { status: 401 });
    }

    // Generate a short-lived QR token for the user (valid 5 minutes)
    const now = Date.now();
    const expiresInMs = 5 * 60 * 1000;
    const id = randomId();
    const payload = {
      uid: user.user_id,
      sid: user.session_id,
      ts: now,
      exp: now + expiresInMs
    };
    const qr_data = btoa(JSON.stringify(payload));
    const signature = randomHex(16);

    return json({
      success: true,
      data: {
        id,
        user_id: user.user_id,
        qr_data,
        signature,
        created_at: iso(now),
        expires_at: iso(now + expiresInMs),
        is_active: true,
        usage_count: 0
      }
    });
  } catch (error) {
    console.error('[QR] Generate error:', error);
    return json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate QR code' } }, { status: 500 });
  }
};

