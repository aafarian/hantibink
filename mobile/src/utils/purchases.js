/**
 * Thin, always-safe wrapper around react-native-purchases. Every helper
 * no-ops when RevenueCat isn't configured (no API key in this build), so
 * callers never need to guard. The server webhook is the source of truth
 * for isPremium — purchases here only trigger it.
 */
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import Logger from './logger';

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_API_KEY_IOS,
  android: process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID,
});

let configured = false;

export const configurePurchases = () => {
  if (!apiKey || configured) {
    return;
  }
  try {
    Purchases.configure({ apiKey });
    configured = true;
    Logger.info('💎 RevenueCat configured');
  } catch (error) {
    Logger.warn('RevenueCat configure failed:', error.message);
  }
};

export const isPurchasesReady = () => configured;

/** Tie the RC customer to our user id so webhooks carry it as app_user_id. */
export const rcLogIn = async userId => {
  if (!configured || !userId) {
    return;
  }
  try {
    await Purchases.logIn(String(userId));
  } catch (error) {
    Logger.warn('RevenueCat logIn failed:', error.message);
  }
};

export const rcLogOut = async () => {
  if (!configured) {
    return;
  }
  try {
    await Purchases.logOut();
  } catch (error) {
    Logger.warn('RevenueCat logOut failed:', error.message);
  }
};

/** Current offering's packages, [] when unavailable. */
export const getPremiumPackages = async () => {
  if (!configured) {
    return [];
  }
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch (error) {
    Logger.warn('RevenueCat offerings failed:', error.message);
    return [];
  }
};

/**
 * Purchase a package. Returns { success, cancelled, active } — active is
 * the client-side read of the premium entitlement (optimistic UX only;
 * the webhook flips the server flag).
 */
export const purchasePremium = async pkg => {
  if (!configured) {
    return { success: false, cancelled: false, active: false };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const active = !!customerInfo?.entitlements?.active?.premium;
    return { success: true, cancelled: false, active };
  } catch (error) {
    if (error.userCancelled) {
      return { success: false, cancelled: true, active: false };
    }
    Logger.warn('RevenueCat purchase failed:', error.message);
    return { success: false, cancelled: false, active: false, message: error.message };
  }
};

/** App Store requirement: a visible restore path. */
export const restorePurchases = async () => {
  if (!configured) {
    return { active: false };
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { active: !!customerInfo?.entitlements?.active?.premium };
  } catch (error) {
    Logger.warn('RevenueCat restore failed:', error.message);
    return { active: false, message: error.message };
  }
};
