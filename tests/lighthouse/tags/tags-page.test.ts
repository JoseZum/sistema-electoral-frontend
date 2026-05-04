/**
 * Auditoria Lighthouse objetivo: src/app/(dashboard)/tags/page.tsx
 *
 * Modulo:
 * - Tags
 *
 * Ruta objetivo:
 * - `/tags`
 *
 * Tipo de pagina:
 * - Ruta protegida para administradores.
 * - Pagina completa con listado de tags, formulario de creacion/edicion,
 *   selector de color y editor de miembros del padron.
 *
 * Datos necesarios:
 * - Sesion administrativa mockeada o seed.
 * - Al menos 3 tags seed para auditar listado con contenido.
 * - Catalogo seed de sedes y carreras.
 * - Estudiantes seed para busqueda y asignacion de miembros.
 *
 * Escenarios Lighthouse pendientes:
 * - estado con tags existentes cargadas.
 * - estado vacio sin tags creadas.
 * - formulario de nueva tag visible.
 * - formulario de edicion con una tag seleccionada.
 *
 * Presupuestos sugeridos:
 * - performance >= 80
 * - accessibility >= 90
 * - best practices >= 90
 * - SEO no critico por ser ruta protegida, pero debe mantenerse sin errores basicos.
 *
 * Pendiente de implementacion:
 * - configurar Lighthouse CI o Playwright + Lighthouse.
 * - levantar la app con `npm run build` y `npm run start`.
 * - autenticar la ruta protegida antes de ejecutar la auditoria.
 * - fijar URL base local estable para `/tags`.
 * - convertir estos escenarios en asserts reales del runner elegido.
 */
