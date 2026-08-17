// This bundle includes only PostHog's core event client. Autocapture, replay,
// surveys, and other extensions must be explicitly added, which keeps this
// initial anonymous implementation small and intentionally limited.
import posthog from 'posthog-js/dist/module.slim.no-external.js';
import { analyticsPageUrl, analyticsPathname } from './analyticsEvents.ts';

type AnalyticsProperties = Record<string, boolean | number | string | undefined>;

interface AnalyticsEnvironment {
  VITE_POSTHOG_ENABLED?: string;
  VITE_POSTHOG_HOST?: string;
  VITE_POSTHOG_KEY?: string;
}

let initialized = false;

export function shouldTrackAnalyticsForHost(hostname: string): boolean {
  return !['localhost', '127.0.0.1', '::1'].includes(hostname);
}

export function getPostHogConfig(environment: AnalyticsEnvironment): {
  apiHost: string;
  projectToken: string;
} | null {
  const projectToken = environment.VITE_POSTHOG_KEY?.trim();
  if (environment.VITE_POSTHOG_ENABLED !== 'true' || !projectToken) return null;

  return {
    projectToken,
    apiHost: environment.VITE_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com',
  };
}

export function initializeAnalytics() {
  if (initialized || typeof window === 'undefined') return initialized;
  if (!shouldTrackAnalyticsForHost(window.location.hostname)) return false;
  const environment = (import.meta as ImportMeta & { env?: AnalyticsEnvironment }).env ?? {};
  const config = getPostHogConfig(environment);
  if (!config) return false;

  posthog.init(config.projectToken, {
    api_host: config.apiHost,
    defaults: '2026-05-30',
    autocapture: false,
    capture_pageleave: false,
    capture_pageview: false,
    disable_session_recording: true,
    person_profiles: 'never',
    persistence: 'memory',
    property_denylist: ['$referrer', '$referring_domain'],
  });
  initialized = true;
  return true;
}

export function trackAnalyticsEvent(name: string, properties?: AnalyticsProperties) {
  if (!initialized) return;
  const url = globalThis.location.href;
  posthog.capture(name, {
    path: analyticsPathname(url),
    $current_url: analyticsPageUrl(url),
    ...properties,
  });
}

export function trackPageView(url = globalThis.location.href) {
  trackAnalyticsEvent('$pageview', {
    path: analyticsPathname(url),
    $current_url: analyticsPageUrl(url),
  });
}
