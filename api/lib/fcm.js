// api/lib/fcm.js
// Firebase Admin SDK helper — sends push notifications via FCM
// to native Android (and future iOS) clients registered through
// the Capacitor PushNotifications plugin.
//
// Setup:
//   1. npm install firebase-admin (in repo root)
//   2. Set Vercel env var FIREBASE_ADMIN_CREDENTIALS_BASE64
//      (base64-encoded service account JSON from Firebase Console)
//
// The Admin SDK is initialized lazily on first call so cold starts
// of unrelated routes don't pay the cost.

import admin from 'firebase-admin';

let initialized = false;

function ensureInit() {
  if (initialized) return;

  const b64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64;
  if (!b64) {
    throw new Error('FIREBASE_ADMIN_CREDENTIALS_BASE64 env var not set');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  } catch (e) {
    throw new Error('FIREBASE_ADMIN_CREDENTIALS_BASE64 is not valid base64-encoded JSON: ' + e.message);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  initialized = true;
}

/**
 * Send a push notification via FCM.
 * @param {string} token - The FCM registration token for the device.
 * @param {object} payload - { title, body, url, type, tag }
 * @returns {Promise<{ success: boolean, messageId?: string, stale?: boolean, error?: string }>}
 *          stale=true when token is invalid (caller should delete the row).
 */
export async function sendFcm(token, payload) {
  try {
    ensureInit();
  } catch (e) {
    return { success: false, error: e.message };
  }

  const message = {
    token,
    // Notification block — drives the system tray notification on Android
    notification: {
      title: payload.title || 'Trade PA',
      body: payload.body || '',
    },
    // Data block — passed to the Capacitor pushNotificationActionPerformed handler
    // so the app can navigate to the right URL when the user taps it.
    data: {
      url: payload.url || '/',
      type: payload.type || 'general',
      tag: payload.tag || 'trade-pa',
    },
    android: {
      priority: 'high',
      notification: {
        // Channel must exist in the Android app — Capacitor plugin creates
        // a default channel automatically if we don't specify one.
        channelId: 'tradepa_default',
        // Tag allows replacing previous notifications of the same type
        // (e.g. only one "incoming call" notification at a time).
        tag: payload.tag || 'trade-pa',
        // High-importance categories should bypass do-not-disturb where allowed.
        ...(payload.type === 'call' && {
          priority: 'max',
          defaultSound: true,
          defaultVibrateTimings: true,
        }),
      },
    },
  };

  try {
    const messageId = await admin.messaging().send(message);
    return { success: true, messageId };
  } catch (err) {
    // FCM errors that mean the token is dead and should be removed from DB
    const STALE_CODES = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument', // sometimes reported for malformed/expired tokens
    ];
    const stale = STALE_CODES.includes(err.code);
    return { success: false, stale, error: err.message, code: err.code };
  }
}
