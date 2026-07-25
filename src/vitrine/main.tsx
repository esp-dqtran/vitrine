import { createRoot } from 'react-dom/client';
import { Spinner, Theme, defineTheme } from '@astryxdesign/core';
import { App } from './App';
import { AuthProvider, useAuth } from './AuthProvider';
import { Home } from './Home';
import { BuildInPublicPage } from './BuildInPublic';
import { Pricing } from './Pricing';
import { BillingSuccess } from './components/BillingSuccess';
import { SignIn } from './SignIn';
import { navigate, useRoute } from './router';
import { requiresAuthentication } from './routeAccess.ts';
import { ThemeModeProvider, useThemeMode } from './theme';
import { FeatureDocumentSharePage } from './components/FeatureDocumentSharePage.tsx';
import './styles.css';

// No token overrides — @astryxdesign/core/astryx.css already ships Vitrine's palette at :root.
// This theme object exists only so <Theme> can drive data-theme (and thus color-scheme) from `mode`.
const appTheme = defineTheme({ name: 'neutral' });

const goApps = () => navigate({ name: 'apps' });
const goHome = () => navigate({ name: 'landing' });
const goBuildInPublic = () => navigate({ name: 'build-in-public' });
const goPricing = () => navigate({ name: 'pricing' });
const goSignIn = () => navigate({ name: 'signin' });

function Root() {
  const { user, loading, authenticate, register, completeLogin } = useAuth();
  const route = useRoute();

  if (route.name === 'pricing') {
    return <Pricing user={user} onBrowse={goApps} onSignIn={goSignIn} />;
  }

  if (route.name === 'feature-document-share') {
    return <FeatureDocumentSharePage token={route.token} />;
  }

  if (route.name === 'build-in-public') {
    return <BuildInPublicPage onHome={goHome} onBrowse={goApps} onPricing={goPricing} />;
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (route.name === 'billing-success' && user) {
    return <BillingSuccess onContinue={goApps} />;
  }

  // Logged-in users always land in the application.
  if (user) return <App />;
  // Published Apps and Sites catalogs are public. Detail and member routes remain private.
  if (route.name === 'apps' || route.name === 'sites') return <App />;
  if (requiresAuthentication(route)) {
    return <SignIn authenticate={authenticate} register={register} onSignedIn={completeLogin} />;
  }
  return (
    <Home
      onBrowse={goApps}
      onPricing={goPricing}
      onBuildInPublic={goBuildInPublic}
      onLogin={goSignIn}
    />
  );
}

function ThemedRoot() {
  const { mode } = useThemeMode();
  return (
    <Theme theme={appTheme} mode={mode}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </Theme>
  );
}

createRoot(document.getElementById('root')!).render(
  <ThemeModeProvider>
    <ThemedRoot />
  </ThemeModeProvider>,
);
