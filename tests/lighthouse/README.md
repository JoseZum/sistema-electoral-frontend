# Lighthouse tests

Placeholder para auditorias Lighthouse del frontend.

Division:
- Se agrupan por modulo funcional.
- Dentro de cada modulo, cada archivo representa una pagina/ruta auditable.
- La razon es que Lighthouse evalua paginas completas, no componentes aislados.

Estructura:

```text
tests/lighthouse/
  admin/
  audit/
  auth/
  dashboard/
  elections/
  monitoring/
  padron/
  results/
  scrutiny/
  tags/
  voting/
```

Rutas cubiertas por placeholder:
- `auth/login-page.test.ts`: `/`
- `dashboard/dashboard-page.test.ts`: `/dashboard`
- `elections/elections-list-page.test.ts`: `/elecciones`
- `elections/create-election-page.test.ts`: `/elecciones/crear`
- `padron/padron-page.test.ts`: `/padron`
- `padron/upload-padron-page.test.ts`: `/padron/cargar`
- `tags/tags-page.test.ts`: `/tags`
- `scrutiny/scrutiny-page.test.ts`: `/escrutinio`
- `scrutiny/upload-scrutiny-page.test.ts`: `/escrutinio/subir`
- `voting/voter-elections-page.test.ts`: `/votaciones`
- `voting/election-voting-page.test.ts`: `/votaciones/:id`
- `monitoring/monitoring-page.test.ts`: `/monitoreo`
- `results/results-page.test.ts`: `/resultados`
- `audit/audit-page.test.ts`: `/auditoria`
- `admin/admin-manager-page.test.ts`: `/admin-manager`
- `admin/key-generation-page.test.ts`: `/generar-llaves`

Configuracion futura sugerida:
- Agregar Lighthouse CI o Playwright + Lighthouse.
- Levantar el frontend en modo produccion con `npm run build` y `npm run start`.
- Usar datos seed o autenticacion mockeada para rutas protegidas.
- Definir presupuestos para performance, accessibility, best practices y SEO.

