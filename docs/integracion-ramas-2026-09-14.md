# Integración de ramas pendientes

El cambio del mensaje de sesión expirada ya estaba en `dev` (`9a673f3`), pero no en `main`: la auditoría de seguridad detenía la promoción. El PR de seguridad actualiza Next.js y sharp a versiones corregidas y corrige el mock de creación de tags para la comprobación de tipos.

`feature/emailsending` (`7ca4e95`) era la única rama remota del frontend con contenido pendiente. Se incorporó la página `/correos` y su entrada en el menú.

**Revertido el 19 de septiembre de 2026.** El envío masivo de correos nunca debió llegar a producción: es un botón que despacha correo real a miles de personas del padrón, sin que nadie lo hubiera aprobado. Se elimina la página, su entrada en el menú y su prueba. Que una rama exista no significa que su contenido esté aprobado para producción; esta se integró por estar pendiente, no por haberse pedido. No volver a incorporarla sin que el TEE la pida por escrito.

Las demás ramas remotas de funcionalidad y pruebas ya eran ancestros de `dev`. Una rama antigua puede tener muchos commits de atraso sin que falte integrarla. La integración por contenido conserva las ramas originales como referencia, sin reescribirlas.

Los PR apuntan a `dev`. Solo la pipeline puede promover el commit comprobado a `main` después de aprobar todos sus controles.
