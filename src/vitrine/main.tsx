import { Spinner } from './components/Spinner.tsx';
import { createRoot } from 'react-dom/client';
import {
  Button,
  EmptyState,
  Theme,
  defineTheme,
} from '@astryxdesign/core';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import { collectionsEnabled } from './featureFlags.ts';
import { navigate, useLocationKey, useRoute } from './router';
import { ThemeModeProvider, useThemeMode } from './theme';
import { ApplicationToastProvider } from './components/ApplicationToast.tsx';
import { initializeAnalytics, trackPageView } from './analytics.ts';
import { decideRootRoute } from './routeDecision.ts';
import { WorkspaceChromeProvider } from './components/WorkspaceChromeContext.tsx';
import type { Route } from './router.ts';
import { applyRouteSeo } from './seo.ts';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/fraunces';
import './styles.css';
import './referenceDiscovery.css';
import './flowPreviewDialog.css';
import './motionPrompts.css';
import './projectsWorkspace.css';
import './collectionsWorkspace.css';
import './catalogSidebar.css';
import './componentLibrary.css';
import './generated-components/overlap-transition/overlapTransition.css';
import './settingsWorkspace.css';
import './components/AstryxDropdown.css';
import './components/AstryxModal.css';
import './productTypography.css';
import './productSpacing.css';
import './productShape.css';
import './productIconography.css';
import './productMotion.css';
import './productResponsive.css';
import './productDataDisplay.css';
import './productTables.css';
import './productForms.css';
import './threadsMarketing.css';
import './components/ColorPackStack.css';
import './colorGallery.css';
import './colorPostStudio.css';
import './Pricing.css';
import './legalPages.css';
import '../../artifacts/reverse-engineering/palmer-dinnerware/prototype/src/styles.css';
// @ts-expect-error The source-audited Explore artifact is authored in JavaScript.
import { preloadInitialAppCatalogPage } from '../../artifacts/reverse-engineering/palmer-dinnerware/prototype/src/data/appCatalogApi.js';

if (window.location.pathname === '/explore') {
  void preloadInitialAppCatalogPage().catch(() => undefined);
}

// No token overrides — @astryxdesign/core/astryx.css already ships Vitrines' palette at :root.
// This theme object exists only so <Theme> can drive data-theme (and thus color-scheme) from `mode`.
const appTheme = defineTheme({ name: 'neutral' });

const App = lazy(() => import('./App').then((module) => ({ default: module.App })));
const AdminDashboard = lazy(() => import('./AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const Home = lazy(() => import('./Home').then((module) => ({ default: module.Home })));
const BuildInPublicPage = lazy(() => import('./BuildInPublic').then((module) => ({ default: module.BuildInPublicPage })));
const Pricing = lazy(() => import('./Pricing').then((module) => ({ default: module.Pricing })));
const LegalPage = lazy(() => import('./LegalPages.tsx').then((module) => ({ default: module.LegalPage })));
const CatalogBuildInPublicPage = lazy(() => import('./components/CatalogStaticPages.tsx')
  .then((module) => ({ default: module.CatalogBuildInPublicPage })));
const CatalogBillingSuccessPage = lazy(() => import('./components/CatalogStaticPages.tsx')
  .then((module) => ({ default: module.CatalogBillingSuccessPage })));
const CatalogNotFoundPage = lazy(() => import('./components/CatalogStaticPages.tsx')
  .then((module) => ({ default: module.CatalogNotFoundPage })));
const CatalogForgotPasswordPage = lazy(() => import('./components/CatalogPasswordPages.tsx')
  .then((module) => ({ default: module.CatalogForgotPasswordPage })));
const CatalogResetPasswordPage = lazy(() => import('./components/CatalogPasswordPages.tsx')
  .then((module) => ({ default: module.CatalogResetPasswordPage })));
const BillingSuccess = lazy(() => import('./components/BillingSuccess').then((module) => ({ default: module.BillingSuccess })));
const SignIn = lazy(() => import('./SignIn').then((module) => ({ default: module.SignIn })));
const PasswordRecovery = lazy(() => import('./PasswordRecovery').then((module) => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import('./PasswordRecovery').then((module) => ({ default: module.ResetPassword })));
const FeatureDocumentSharePage = lazy(() => import('./components/FeatureDocumentSharePage.tsx').then((module) => ({ default: module.FeatureDocumentSharePage })));

const goApps = () => navigate({ name: 'apps' });
const goHome = () => navigate({ name: 'landing' });
const goBuildInPublic = () => navigate({ name: 'build-in-public' });
const goPricing = () => navigate({ name: 'pricing' });
const goSignIn = () => navigate({ name: 'signin' });
const goForgotPassword = () => navigate({ name: 'forgot-password' });

function Root() {
  const { user, loading, authenticate, register, completeLogin } = useAuth();
  const route = useRoute();
  const advancedSearchEnabled =
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_ADVANCED_SEARCH_ENABLED === 'true';
  const researchProjectsEnabled =
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_RESEARCH_PROJECTS_ENABLED === 'true';
  const decision = decideRootRoute(route, {
    auth: loading ? 'loading' : user?.role === 'admin' ? 'admin' : user ? 'member' : 'guest',
    advancedSearchEnabled,
    collectionsEnabled,
    researchProjectsEnabled,
  });

  switch (decision.kind) {
    case 'loading':
      return <FullPageSpinner />;
    case 'redirect':
      return <RouteRedirect route={decision.route} />;
    case 'signin':
      return <SignIn authenticate={authenticate} register={register} onSignedIn={completeLogin} onForgotPassword={goForgotPassword} />;
    case 'application':
      return <App />;
    case 'admin-dashboard':
      return user?.role === 'admin'
        ? (
          // Admin is its own root branch, so it gets its own chrome provider —
          // never nested with the one App mounts for the workspace routes.
          <WorkspaceChromeProvider>
            <AdminDashboard />
          </WorkspaceChromeProvider>
        )
        : <RouteStatusPage title="Admin access required" onBack={goApps} />;
    case 'denied':
    case 'unavailable':
      return <RouteStatusPage title={decision.title} onBack={goApps} />;
    case 'public':
      switch (decision.page) {
        case 'browse-forgot-password':
          return <CatalogForgotPasswordPage onBack={goSignIn} />;
        case 'browse-reset-password':
          return (
            <CatalogResetPasswordPage
              token={route.name === 'browse-reset-password' ? route.token : undefined}
              onBack={goSignIn}
            />
          );
        case 'browse-build-in-public':
          return <CatalogBuildInPublicPage onSignIn={goSignIn} />;
        case 'browse-billing-success':
          return <CatalogBillingSuccessPage onSignIn={goSignIn} />;
        case 'browse-not-found':
          return (
            <CatalogNotFoundPage
              pathname={route.name === 'browse-not-found' ? route.pathname : undefined}
              onSignIn={goSignIn}
            />
          );
        case 'browse-pricing':
          return <Pricing user={user} onBrowse={() => navigate({ name: 'browse' })} onSignIn={goSignIn} />;
        case 'pricing':
          return <Pricing user={user} onBrowse={goApps} onSignIn={goSignIn} />;
        case 'terms':
        case 'privacy':
        case 'refunds':
          return <LegalPage page={decision.page} onBrowse={goApps} onSignIn={goSignIn} />;
        case 'feature-document-share':
          return route.name === 'feature-document-share'
            ? <FeatureDocumentSharePage token={route.token} />
            : <RouteStatusPage title="Share not found" onBack={goHome} />;
        case 'build-in-public':
          return <BuildInPublicPage onHome={goHome} onBrowse={goApps} onPricing={goPricing} />;
        case 'billing-success':
          return <BillingSuccess onContinue={goApps} />;
        case 'forgot-password':
          return <PasswordRecovery onBack={goSignIn} />;
        case 'reset-password':
          return <ResetPassword token={route.name === 'reset-password' ? route.token : undefined} onBack={goSignIn} />;
        case 'not-found':
          return <RouteStatusPage title="Page not found" onBack={user ? goApps : goHome} />;
        case 'landing':
          return (
            <Home
              onBrowse={goApps}
              onPricing={goPricing}
              onBuildInPublic={goBuildInPublic}
              onLogin={goSignIn}
            />
          );
      }
  }
}

function FullPageSpinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Spinner size="lg" />
    </div>
  );
}

function RouteRedirect({ route }: { route: Route }) {
  useEffect(() => navigate(route), [route]);
  return <FullPageSpinner />;
}

function RouteStatusPage({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <main className="vitrine-page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <EmptyState
        title={title}
        actions={<Button variant="primary" label="Browse Apps" onClick={onBack} />}
      />
    </main>
  );
}

function PublicLegalFooter() {
  const route = useRoute();
  if (
    route.name === 'terms'
    || route.name === 'privacy'
    || route.name === 'refunds'
    || route.name === 'color-compose'
    || route.name === 'explore'
  ) return null;
  return (
    <footer className="site-legal-footer">
      <nav aria-label="Legal information">
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/refunds">Refunds</a>
      </nav>
    </footer>
  );
}

function ThemedRoot() {
  const { mode } = useThemeMode();
  const locationKey = useLocationKey();
  const pathname = locationKey.split('?', 1)[0];

  useEffect(() => {
    initializeAnalytics();
  }, []);

  useEffect(() => {
    trackPageView();
  }, [pathname]);

  useEffect(() => {
    const split = locationKey.indexOf('?');
    applyRouteSeo(
      split < 0 ? locationKey : locationKey.slice(0, split),
      split < 0 ? '' : locationKey.slice(split),
    );
  }, [locationKey]);

  return (
    <Theme theme={appTheme} mode={mode}>
      <ApplicationToastProvider>
        <AuthProvider>
          <Suspense fallback={<FullPageSpinner />}>
            <Root />
            <PublicLegalFooter />
          </Suspense>
        </AuthProvider>
      </ApplicationToastProvider>
    </Theme>
  );
}

createRoot(document.getElementById('root')!).render(
  <ThemeModeProvider>
    <ThemedRoot />
  </ThemeModeProvider>,
);
