import { PublicClientApplication, Configuration, LogLevel } from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common'}`,
    redirectUri: '/',
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
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

export const msalInstance = new PublicClientApplication(msalConfig);

export const msalReady = msalInstance
  .initialize()
  .then(() => msalInstance.handleRedirectPromise())
  .then((response) => {
    if (response) {
      console.log('[MSAL] Auth response received for:', response.account?.username);
    }
    return response;
  })
  .catch((err) => {
    console.error('[MSAL] Init error:', err);
    return null;
  });
