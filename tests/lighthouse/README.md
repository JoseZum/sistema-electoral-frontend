# Lighthouse tests

Guia corta para crear y probar auditorias Lighthouse del frontend.

## Como agregar un modulo

1. Crea un runner `.mjs` en `tests/lighthouse/<modulo>/`.
   Ejemplo: `tests/lighthouse/<modulo>/<modulo>-pages.test.mjs`

2. Dentro del runner:
   - define budgets para `performance`, `accessibility`, `best-practices` y `seo`
   - levanta el frontend en produccion con `next build --webpack` y `next start`
   - si la ruta necesita datos, monta un mock API local
   - si la ruta necesita sesion, prepara `localStorage` antes de correr Lighthouse
   - corre Lighthouse contra la ruta final esperada
   - guarda `lhr.json` y `report.html` en `.reports/`

3. Si la ruta protegida falla por build o filesystem en Windows:
   - usa variables de entorno para aislar el build o bajar workers
   - evita tocar el backend real

4. Agrega el script en `package.json`.
   Ejemplo:

```json
"test:lighthouse:<modulo>": "node tests/lighthouse/<modulo>/<archivo>.mjs"
```

5. Si aplica, agrega el script al agregador:

```json
"test:lighthouse": "npm run test:lighthouse:<modulo>"
```

## Como probar

1. Ejecuta el modulo:

```bash
npm.cmd run test:lighthouse:<modulo>
```

2. Revisa los reportes en:

```text
tests/lighthouse/<modulo>/.reports/
```

3. Si un score no da bien:
   - corrige la UI o el flujo de carga
   - vuelve a correr el mismo comando
   - no bajes el budget para esconder problemas reales

## Regla practica

- Usa mocks locales para datos inestables.
- Usa sesion mockeada para rutas admin.
- Audita paginas completas, no componentes aislados.
