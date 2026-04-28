// Runtime platform detection — tells the app whether it's running as
// a PWA in a browser, or wrapped inside Capacitor on iOS / Android.
//
// Use these helpers to gate behaviour that needs to differ between
// web and native — most importantly: hide all subscription / upgrade
// UI when running on iOS or Android (App Store guideline 3.1.3(b),
// no IAP per Trade PA's web-only-signup decision). Anything that
// would charge the user or upsell them must be web-only.
//
// Capacitor.isNativePlatform() returns false in the browser even when
// @capacitor/core is loaded, so importing this module is safe in any
// context — web or native — and tree-shakes cleanly.

import { Capacitor } from "@capacitor/core";

/** True if running inside the Capacitor native shell (iOS or Android). */
export function isNative() {
  return Capacitor.isNativePlatform();
}

/** True if running in a regular web browser (PWA or desktop). */
export function isWeb() {
  return !Capacitor.isNativePlatform();
}

/** Platform string: "ios" | "android" | "web" */
export function getPlatform() {
  return Capacitor.getPlatform();
}

/** True if running on iOS specifically. */
export function isIOS() {
  return Capacitor.getPlatform() === "ios";
}

/** True if running on Android specifically. */
export function isAndroid() {
  return Capacitor.getPlatform() === "android";
}
