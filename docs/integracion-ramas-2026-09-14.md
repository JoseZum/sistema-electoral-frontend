# Integración de ramas pendientes

El cambio del mensaje de sesión expirada ya estaba en `dev` (`9a673f3`), pero no en `main`: la auditoría de seguridad detenía la promoción. El PR de seguridad actualiza Next.js y sharp a versiones corregidas y corrige el mock de creación de tags para la comprobación de tipos.

`feature/emailsending` (`7ca4e95`) era la única rama remota del frontend con contenido pendiente. Se incorpora la página `/correos` y su entrada en el menú, conservando Postulaciones y el resto de la navegación actual. La página usa los contratos actuales, controles accesibles, mensajes de error y bloqueo durante el envío.

Los tipos de correo soportados por el backend son recordatorio, apertura y mensaje personalizado. La opción antigua de enviar tokens no tenía implementación en el backend y corresponde a un flujo de autenticación sustituido; no se presenta como una función disponible. Tampoco se muestra un historial vacío que no está conectado a ningún endpoint.

Las demás ramas remotas de funcionalidad y pruebas ya eran ancestros de `dev`. Una rama antigua puede tener muchos commits de atraso sin que falte integrarla. La integración por contenido conserva las ramas originales como referencia, sin reescribirlas.

Los PR apuntan a `dev`. Solo la pipeline puede promover el commit comprobado a `main` después de aprobar todos sus controles. El envío de correos requiere la configuración SMTP documentada en el backend. Las pruebas de esta integración simulan el API y no envían correos reales.
