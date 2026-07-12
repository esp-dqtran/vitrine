import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { Spinner } from '@astryxdesign/core';
import { App } from './App';
import { AuthProvider, useAuth } from './AuthProvider';
import { Home } from './Home';
import { Pricing } from './Pricing';
import { SignIn } from './SignIn';
import './styles.css';

document.documentElement.setAttribute('data-astryx-theme', 'neutral');
document.documentElement.style.colorScheme = 'light';

// ponytail: hash routing, swap for a router when there are more than a couple of pages
const subscribeHash = (fn: () => void) => {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
};

const goHome = () => { window.location.hash = ''; };
const goPricing = () => { window.location.hash = '#pricing'; };
const goSignIn = () => { window.location.hash = '#signin'; };

function Root() {
  const { user, loading, authenticate, completeLogin } = useAuth();
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash);

  if (hash === '#pricing') {
    return <Pricing onBrowse={user ? goHome : goSignIn} onSignIn={goSignIn} />;
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  // Logged-in users always land in the catalog; the marketing pages are the logged-out front door.
  if (user) return <App />;
  if (hash === '#signin') return <SignIn authenticate={authenticate} onSignedIn={completeLogin} />;
  return (
    <Home
      onBrowse={goSignIn}
      onPricing={goPricing}
      onLogin={goSignIn}
      onSearch={(q) => {
        // Browsing needs an account; carry the query across sign-in so it lands in the catalog search.
        if (q) sessionStorage.setItem('astryx:q', q);
        goSignIn();
      }}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
);
