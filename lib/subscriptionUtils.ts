/**
 * Utility functions for subscription and trial management
 */

const TRIAL_DAYS = 14;

/**
 * Check if user is in trial period
 * Trial starts from account creation (profiles.created_at)
 */
export function isInTrialPeriod(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  
  const accountCreatedAt = new Date(createdAt);
  const now = new Date();
  const trialEndDate = new Date(accountCreatedAt);
  trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);
  
  return now < trialEndDate;
}

/**
 * Get trial end date from account creation date
 */
export function getTrialEndDate(createdAt: string | null | undefined): Date | null {
  if (!createdAt) return null;
  
  const accountCreatedAt = new Date(createdAt);
  const trialEndDate = new Date(accountCreatedAt);
  trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);
  
  return trialEndDate;
}

/**
 * Get remaining trial days
 */
export function getRemainingTrialDays(createdAt: string | null | undefined): number {
  if (!createdAt) return 0;
  
  const trialEndDate = getTrialEndDate(createdAt);
  if (!trialEndDate) return 0;
  
  const now = new Date();
  const diffTime = trialEndDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Check if subscription is active (not expired)
 */
export function isSubscriptionActive(
  endDate: string | null | undefined,
  status?: string
): boolean {
  if (!endDate) return false;
  
  // Check status first
  if (status && !['active', 'trial'].includes(status.toLowerCase())) {
    return false;
  }
  
  const end = new Date(endDate);
  const now = new Date();
  
  return now < end;
}

/**
 * Get remaining subscription days
 */
export function getRemainingSubscriptionDays(
  endDate: string | null | undefined
): number {
  if (!endDate) return 0;
  
  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Subscription state priority:
 * 1. Active Paid Subscription
 * 2. Active Trial (14 days from account creation)
 * 3. Expired / Locked
 */
export interface SubscriptionState {
  hasAccess: boolean;
  isTrial: boolean;
  isActivePaid: boolean;
  daysRemaining: number;
  trialEndDate: Date | null;
  subscriptionEndDate: string | null;
}

export function getSubscriptionState(
  createdAt: string | null | undefined,
  subscriptionEndDate: string | null | undefined,
  subscriptionStatus?: string
): SubscriptionState {
  const state: SubscriptionState = {
    hasAccess: false,
    isTrial: false,
    isActivePaid: false,
    daysRemaining: 0,
    trialEndDate: null,
    subscriptionEndDate: subscriptionEndDate || null,
  };

  // Check if user has active paid subscription
  if (subscriptionEndDate && isSubscriptionActive(subscriptionEndDate, subscriptionStatus)) {
    state.isActivePaid = true;
    state.hasAccess = true;
    state.daysRemaining = getRemainingSubscriptionDays(subscriptionEndDate);
    return state;
  }

  // Check if user is in trial period
  if (createdAt && isInTrialPeriod(createdAt)) {
    state.isTrial = true;
    state.hasAccess = true;
    state.trialEndDate = getTrialEndDate(createdAt);
    state.daysRemaining = getRemainingTrialDays(createdAt);
    return state;
  }

  // No access
  return state;
}

