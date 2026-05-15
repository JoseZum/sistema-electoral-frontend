import { PublicClientApplication, Configuration, LogLevel } from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common'}`,
    redirectUri: '/',
  },
  cache: {
    cacheLocation: 'localStorage',
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message) => {
        if (level === LogLevel.Error) {
          console.error('[MSAL]', message);
        }
      },
      logLevel: LogLevel.Error,
    },
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
  domainHint: 'estudiantec.cr',
};

let msalInstance: PublicClientApplication | null = null;

function shouldBypassMsalInitialization() {
  return typeof navigator !== 'undefined' && navigator.webdriver;
}

export function getMsalInstance() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
  }

  return msalInstance;
}

export async function initializeMsal() {
  const instance = getMsalInstance();
  if (!instance) {
    return null;
  }

  if (shouldBypassMsalInitialization()) {
    return instance;
  }

  try {
    await instance.initialize();
    const response = await instance.handleRedirectPromise();
    if (response) {
      console.log('[MSAL] Auth response received for:', response.account?.username);
    }
    return instance;
  } catch (err) {
    console.error('[MSAL] Init error:', err);
    return null;
  }
}
