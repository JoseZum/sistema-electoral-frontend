Estructura base de pruebas para el frontend.

Convencion:
- `tests/unit`: pruebas unitarias y de componentes aislados.
- `tests/integration`: pruebas de integracion de UI en navegador con Playwright y mocks del backend.
- `tests/lighthouse`: auditorias de performance y accesibilidad por pantalla.
- `tests/manual`: pruebas no conectadas al gate del frontend, reservadas para validaciones backend-dependientes.

Estructura inicial:

```text
tests/
  integration/
    browser/
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
    flows/
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
- `flows`: formularios y recorridos de UI ejercitados con Testing Library y mocks
- `padron`: `src/components/padron`, `src/app/(dashboard)/padron`
- `scrutiny`: `src/app/(dashboard)/escrutinio`
- `shared`: `src/lib/api-client.ts`, `src/lib/export-results.ts`, `src/components/ui`, `src/components/Loader.tsx`
- `tags`: `src/components/tags`, `src/lib/tags-api.ts`, `src/lib/tag-colors.ts`
- `voting`: `src/app/(voter)/votaciones`

El gate del frontend valida primero la integración de UI con Playwright y mocks controlados. Como último gate antes de promover `dev` a `main`, el workflow obtiene la suite E2E canónica desde `JoseZum/sistema-electoral-backend@main`, inserta el commit actual del frontend en el entorno Docker del backend y ejecuta todos los recorridos contra frontend, backend y PostgreSQL reales.

La suite sistémica sigue siendo propiedad del backend: no se duplican archivos E2E en este repositorio. Así, cualquier prueba añadida o corregida en el backend se incorpora automáticamente al siguiente pipeline del frontend sin mantener dos copias divergentes.

Para `tests/lighthouse`, la division es por modulo funcional y cada archivo `*.test.ts` representa una pagina/ruta completa a auditar con Lighthouse. Esto facilita definir presupuestos por pantalla cuando se agregue Lighthouse CI o Playwright + Lighthouse.

Los archivos de prueba se pueden agregar despues con nombres `*.test.ts` o `*.test.tsx`.
