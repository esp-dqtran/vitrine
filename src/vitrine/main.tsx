import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { Spinner } from '@astryxdesign/core';
import { App } from './App';
import { AuthProvider, useAuth } from './AuthProvider';
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

function Root() {
  const { user, loading, authenticate, completeLogin } = useAuth();
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash);

  if (hash === '#pricing') {
    return <Pricing onBrowse={() => { window.location.hash = ''; }} onSignIn={() => { window.location.hash = ''; }} />;
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spinner size="lg" />
      </div>
    );
  }
  return user ? <App /> : <SignIn authenticate={authenticate} onSignedIn={completeLogin} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
);
