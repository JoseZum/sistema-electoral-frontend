Frontend - Sistema Electoral TEE

Aplicación web para votación electrónica con autenticación OAuth Microsoft.

Stack:
- Next.js 15+
- React 19+
- TypeScript
- MSAL (Microsoft Authentication Library)
- Tailwind CSS
- shadcn/ui para componentes

Configuración rápida

1. Instalar dependencias:
   npm install

2. Crear archivo .env.local basado en .env.example:
   cp .env.example .env.local

3. Configurar variables en .env.local:

   Credenciales Azure AD (mismas del backend):
   NEXT_PUBLIC_AZURE_CLIENT_ID=tu-client-id
   NEXT_PUBLIC_AZURE_TENANT_ID=tu-tenant-id

   Backend:
   NEXT_PUBLIC_API_URL=http://localhost:3001

4. Iniciar desarrollo:
   npm run dev

La aplicación estará en http://localhost:3000

Scripts disponibles

npm run dev - Inicia servidor de desarrollo
npm run build - Compila para producción
npm run start - Inicia servidor producción
npm run lint - Ejecuta linter

Autenticación

El flujo OAuth:
1. Usuario hace clic en "Continuar con Microsoft"
2. Se redirige a Azure AD para autenticación
3. Azure AD devuelve token de ID
4. El token se valida en el backend
5. Se crea sesión local con JWT
6. Usuario puede acceder a funcionalidades autenticadas

La sesión se guarda en localStorage y persiste entre recargas de página.

Troubleshooting

Error: "Failed to fetch" en login
- Verificar que el backend esté corriendo en http://localhost:3001
- Revisar que CORS esté configurado correctamente en el backend
- Ver la consola del navegador para más detalles

Error: "Only @estudiantec.cr accounts are allowed"
- La cuenta de Microsoft no tiene dominio @estudiantec.cr
- Usar una cuenta institucional del TEC

Error: "Student not found in the electoral registry"
- El usuario no está en la base de datos de estudiantes
- Contactar al TEE para ser agregado

Sesión se cierra inmediatamente:
- Revisar los logs del backend (error en validación del token)
- Confirmar que las credenciales AZURE_CLIENT_ID y AZURE_TENANT_ID sean correctas
- Verificar que el estudiante esté en la base de datos
