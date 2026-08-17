import { initializePaddle, type Paddle } from '@paddle/paddle-js';

type ViteEnvironment = { VITE_PADDLE_CLIENT_TOKEN?: string };

let paddlePromise: Promise<Paddle | undefined> | undefined;

function clientToken(): string {
  const token = (import.meta as ImportMeta & { env?: ViteEnvironment }).env?.VITE_PADDLE_CLIENT_TOKEN?.trim();
  if (!token) throw new Error('Paddle checkout is not configured');
  return token;
}

async function paddle(): Promise<Paddle> {
  const token = clientToken();
  paddlePromise ??= initializePaddle({
    token,
    environment: token.startsWith('test_') ? 'sandbox' : 'production',
  });
  const instance = await paddlePromise;
  if (instance) return instance;
  paddlePromise = undefined;
  throw new Error('Paddle checkout could not be initialized');
}

export async function openPaddleCheckout(transactionId: string): Promise<void> {
  if (!transactionId.startsWith('txn_')) throw new Error('Paddle returned an invalid checkout transaction');
  (await paddle()).Checkout.open({
    transactionId,
    settings: { successUrl: `${window.location.origin}/billing/success` },
  });
}
