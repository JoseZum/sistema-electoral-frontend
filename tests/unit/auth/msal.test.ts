/**
 * Suite objetivo: src/lib/msal.ts
 *
 * Casos de prueba:
 * - configuración base del cliente MSAL
 * - scopes y domainHint exportados en `loginRequest`
 * - valores mínimos cuando el entorno sí define variables públicas
 * - comportamiento cuando faltan variables públicas
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const originalClientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID;
const originalTenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID;

function mockMsalBrowser(onConstruct?: (config: unknown) => void) {
  vi.doMock('@azure/msal-browser', () => ({
    PublicClientApplication: class {
      constructor(config: unknown) {
        onConstruct?.(config);
      }
      async initialize() {
        return undefined;
      }
      async handleRedirectPromise() {
        return null;
      }
    },
    LogLevel: { Error: 2 },
  }));
}

async function importMsalModule() {
  return import('../../../src/lib/msal');
}

describe('msal module', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_AZURE_CLIENT_ID = originalClientId;
    process.env.NEXT_PUBLIC_AZURE_TENANT_ID = originalTenantId;
  });

  afterEach(() => {
    vi.doUnmock('@azure/msal-browser');
  });

  it('exporta loginRequest con scopes y domainHint esperados', async () => {
    mockMsalBrowser();

    const msal = await importMsalModule();

    expect(msal.loginRequest).toEqual({
      scopes: ['openid', 'profile', 'email'],
      domainHint: 'estudiantec.cr',
    });
  });

  it('usa la configuración base del cliente MSAL cuando hay variables públicas', async () => {
    process.env.NEXT_PUBLIC_AZURE_CLIENT_ID = 'client-id-123';
    process.env.NEXT_PUBLIC_AZURE_TENANT_ID = 'tenant-456';

    let capturedConfig: any = null;
    mockMsalBrowser((config) => {
      capturedConfig = config;
    });

    const msal = await importMsalModule();

    const instance = msal.getMsalInstance();

    expect(instance).not.toBeNull();
    expect(capturedConfig).toEqual({
      auth: {
        clientId: 'client-id-123',
        authority: 'https://login.microsoftonline.com/tenant-456',
        redirectUri: '/',
      },
      cache: {
        cacheLocation: 'localStorage',
      },
      system: {
        loggerOptions: {
          loggerCallback: expect.any(Function),
          logLevel: 2,
        },
      },
    });
  });

  it('aplica valores por defecto si faltan las variables públicas', async () => {
    delete process.env.NEXT_PUBLIC_AZURE_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_AZURE_TENANT_ID;

    let capturedConfig: any = null;
    mockMsalBrowser((config) => {
      capturedConfig = config;
    });

    const msal = await importMsalModule();

    msal.getMsalInstance();

    expect(capturedConfig).toEqual({
      auth: {
        clientId: '',
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: '/',
      },
      cache: {
        cacheLocation: 'localStorage',
      },
      system: {
        loggerOptions: {
          loggerCallback: expect.any(Function),
          logLevel: 2,
        },
      },
    });
  });
});

