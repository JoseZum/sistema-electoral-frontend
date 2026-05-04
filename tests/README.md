Estructura base de pruebas para el frontend.

Convencion:
- `tests/unit`: pruebas unitarias y de componentes aislados.
- `tests/integration`: pruebas de integracion de flujos entre pagina, componentes y llamadas HTTP mockeadas.
- `tests/lighthouse`: placeholder para futuras auditorias Lighthouse del frontend.

Estructura inicial:

```text
tests/
  integration/
  lighthouse/
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
  unit/
    auth/
    dashboard/
    elections/
    padron/
    scrutiny/
    shared/
    tags/
    voting/
```

Mapeo sugerido:
- `auth`: `src/components/auth`, `src/lib/auth-context.tsx`, `src/lib/msal.ts`
- `dashboard`: `src/components/dashboard`, vistas del dashboard administrativo
- `elections`: `src/components/elections`, `src/app/(dashboard)/elecciones`
- `padron`: `src/components/padron`, `src/app/(dashboard)/padron`
- `scrutiny`: `src/app/(dashboard)/escrutinio`
- `shared`: `src/lib/api-client.ts`, `src/lib/export-results.ts`, `src/components/ui`, `src/components/Loader.tsx`
- `tags`: `src/components/tags`, `src/lib/tags-api.ts`, `src/lib/tag-colors.ts`
- `voting`: `src/app/(voter)/votaciones`

Para `tests/lighthouse`, la division es por modulo funcional y cada archivo `*.test.ts` representa una pagina/ruta completa a auditar con Lighthouse. Esto facilita definir presupuestos por pantalla cuando se agregue Lighthouse CI o Playwright + Lighthouse.

Los archivos de prueba se pueden agregar despues con nombres `*.test.ts` o `*.test.tsx`.
