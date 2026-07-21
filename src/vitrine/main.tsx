import { createRoot } from 'react-dom/client';
import { Spinner, Theme, defineTheme } from '@astryxdesign/core';
import { App } from './App';
import { AuthProvider, useAuth } from './AuthProvider';
import { Home } from './Home';
import { Pricing } from './Pricing';
import { BillingSuccess } from './components/BillingSuccess';
import { SignIn } from './SignIn';
import { navigate, useRoute } from './router';
import { ThemeModeProvider, useThemeMode } from './theme';
import './styles.css';

// No token overrides — @astryxdesign/core/astryx.css already ships Vitrine's palette at :root.
// This theme object exists only so <Theme> can drive data-theme (and thus color-scheme) from `mode`.
const appTheme = defineTheme({ name: 'neutral' });

const goApps = () => navigate({ name: 'apps' });
const goPricing = () => navigate({ name: 'pricing' });
const goSignIn = () => navigate({ name: 'signin' });

function Root() {
  const { user, loading, authenticate, register, completeLogin } = useAuth();
  const route = useRoute();

  if (route.name === 'pricing') {
    return <Pricing user={user} onBrowse={user ? goApps : goSignIn} onSignIn={goSignIn} />;
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

  // Logged-in users always land in the catalog; the marketing pages are the logged-out front door.
  if (user) return <App />;
  // A deep link into the catalog (e.g. someone shared an app's URL) needs an account too —
  // send it through sign-in rather than the marketing page, path intact for App to pick up.
  if (route.name === 'signin' || route.name === 'billing-success' || route.name === 'settings-billing' || route.name === 'apps' || route.name === 'app' || route.name === 'projects' || route.name === 'project' || route.name === 'admin') {
    return <SignIn authenticate={authenticate} register={register} onSignedIn={completeLogin} />;
  }
  return (
    <Home
      onBrowse={goSignIn}
      onPricing={goPricing}
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
