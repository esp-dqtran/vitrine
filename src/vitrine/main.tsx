import { createRoot } from 'react-dom/client';
import { Button, EmptyState, Spinner, Theme, defineTheme } from '@astryxdesign/core';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import { navigate, useRoute } from './router';
import { ThemeModeProvider, useThemeMode } from './theme';
import { decideRootRoute } from './routeDecision.ts';
import type { Route } from './router.ts';
import './styles.css';
import './referenceDiscovery.css';

// No token overrides — @astryxdesign/core/astryx.css already ships Vitrine's palette at :root.
// This theme object exists only so <Theme> can drive data-theme (and thus color-scheme) from `mode`.
const appTheme = defineTheme({ name: 'neutral' });

const App = lazy(() => import('./App').then((module) => ({ default: module.App })));
const AdminDashboard = lazy(() => import('./AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const Home = lazy(() => import('./Home').then((module) => ({ default: module.Home })));
const BuildInPublicPage = lazy(() => import('./BuildInPublic').then((module) => ({ default: module.BuildInPublicPage })));
const Pricing = lazy(() => import('./Pricing').then((module) => ({ default: module.Pricing })));
const BillingSuccess = lazy(() => import('./components/BillingSuccess').then((module) => ({ default: module.BillingSuccess })));
const SignIn = lazy(() => import('./SignIn').then((module) => ({ default: module.SignIn })));
const FeatureDocumentSharePage = lazy(() => import('./components/FeatureDocumentSharePage.tsx').then((module) => ({ default: module.FeatureDocumentSharePage })));

const goApps = () => navigate({ name: 'apps' });
const goHome = () => navigate({ name: 'landing' });
const goBuildInPublic = () => navigate({ name: 'build-in-public' });
const goPricing = () => navigate({ name: 'pricing' });
const goSignIn = () => navigate({ name: 'signin' });

function Root() {
  const { user, loading, authenticate, register, completeLogin, logout } = useAuth();
  const route = useRoute();
  const advancedSearchEnabled =
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_ADVANCED_SEARCH_ENABLED === 'true';
  const researchProjectsEnabled =
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_RESEARCH_PROJECTS_ENABLED === 'true';
  const decision = decideRootRoute(route, {
    auth: loading ? 'loading' : user?.role === 'admin' ? 'admin' : user ? 'member' : 'guest',
    advancedSearchEnabled,
    researchProjectsEnabled,
  });

  switch (decision.kind) {
    case 'loading':
      return <FullPageSpinner />;
    case 'redirect':
      return <RouteRedirect route={decision.route} />;
    case 'signin':
      return <SignIn authenticate={authenticate} register={register} onSignedIn={completeLogin} />;
    case 'application':
      return <App />;
    case 'admin-dashboard':
      return user?.role === 'admin'
        ? <AdminDashboard user={user} onLogout={logout} />
        : <RouteStatusPage title="Admin access required" onBack={goApps} />;
    case 'denied':
    case 'unavailable':
      return <RouteStatusPage title={decision.title} onBack={goApps} />;
    case 'public':
      switch (decision.page) {
        case 'pricing':
          return <Pricing user={user} onBrowse={goApps} onSignIn={goSignIn} />;
        case 'feature-document-share':
          return route.name === 'feature-document-share'
            ? <FeatureDocumentSharePage token={route.token} />
            : <RouteStatusPage title="Share not found" onBack={goHome} />;
        case 'build-in-public':
          return <BuildInPublicPage onHome={goHome} onBrowse={goApps} onPricing={goPricing} />;
        case 'billing-success':
          return <BillingSuccess onContinue={goApps} />;
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

function ThemedRoot() {
  const { mode } = useThemeMode();
  return (
    <Theme theme={appTheme} mode={mode}>
      <AuthProvider>
        <Suspense fallback={<FullPageSpinner />}>
          <Root />
        </Suspense>
      </AuthProvider>
    </Theme>
  );
}

createRoot(document.getElementById('root')!).render(
  <ThemeModeProvider>
    <ThemedRoot />
  </ThemeModeProvider>,
);
