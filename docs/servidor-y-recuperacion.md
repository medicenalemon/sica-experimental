# Servidor y recuperación

La configuración se explica en el README. El servidor usa Node 24 y SQLite. Una instancia puede habilitar varias empresas con archivos exclusivos; reglas en [multiempresa.md](multiempresa.md). Los scripts `build:server` generan `.server/domain`, reutilizando las mismas reglas de negocio que el modo local. Los clientes envían comandos tipados; nunca reemplazan el estado completo salvo la restauración exclusiva de administrador.

## Acceso de red

La configuración inicial escucha en loopback. Para varios equipos, usar un proxy HTTPS con el dominio definitivo, establecer `SICA_ORIGINS` con los orígenes HTTPS explícitos y `SICA_SECURE_COOKIE=true`. Mantener el servidor en loopback si el proxy corre en el mismo equipo. El servidor rechaza escuchar en una dirección de red sin esas condiciones. No habilitar CORS abierto. Los encabezados de proxy y TLS necesitan configuración propia del despliegue; todavía no se ha publicado una instalación.

El límite de ingreso se calcula por dirección vista por Node y usuario; detrás de un proxy la dirección puede ser la del proxy. Ajustar límites en el proxy y validar el flujo antes de ampliar el uso. No hay todavía segundo factor, recuperación de contraseña por correo, monitoreo externo. La selección multiempresa ya está disponible con configuración por empresa. Las bajas y los cambios de contraseña invalidan las sesiones; los cambios de perfil se leen en cada solicitud.

## Copias de seguridad

- JSON: Configuración → Descargar copia operativa JSON. Acceso exclusivo del administrador. Contiene operaciones y credenciales derivadas; conservar en un lugar privado. No conserva solicitudes ni tickets ARCA. Para recuperar esa información es indispensable el respaldo SQLite y su clave.
- SQLite: el servidor usa la API de backup de Node cada 24 horas de ejecución y guarda cada archivo junto con su `.audit-key` y sello `.backup.json` en `backups/` junto a la base. La copia y su clave deben trasladarse juntas a almacenamiento independiente y privado. El temporizador no reemplaza un servicio supervisado de respaldo.
- Restauración JSON: primero se revisa la empresa y el número de comprobantes. Al confirmar, se valida la copia, se conservan los usuarios actuales del servidor y se almacena la versión anterior. Configuración → Copias anteriores a restauraciones permite revisarlas y volver a restaurarlas.

Se rechaza una restauración que quite o modifique un comprobante con solicitud ARCA incierta o aprobada, su CUIT emisor o punto de venta. La restauración incrementa la versión; las otras sesiones deben actualizar antes de escribir. Una restauración antigua no reinstala contraseñas ni usuarios contenidos en el JSON sobre los accesos del servidor. Para importar usuarios nuevos, usar Usuarios y Perfiles.

## Recuperar un archivo SQLite

El [comando de recuperación independiente](recuperacion-independiente.md) verifica sello del archivo, integridad SQLite, reglas del estado actual, auditoría y fuentes/tickets fiscales. Recupera en una carpeta nueva, conserva usuarios y operaciones, revoca las sesiones copiadas y agrega una constancia por empresa. No reemplaza archivos existentes ni modifica la fuente. Los respaldos anteriores sin sello requieren la opción explícita `--legacy`, con el límite de integridad indicado en la guía.

Se ensayaron 44 recuperaciones completas sobre las bases sintéticas anteriores; se conservaron estados, usuarios, solicitudes y tickets fiscales, reintentos y prefijos de auditoría. El comando se probó con la base original cerrada y retirada de su ruta. Todavía falta validar el procedimiento con la infraestructura y almacenamiento independiente de una instalación real.

## Límites actuales

Los saldos y asientos son de trabajo. El adaptador ARCA sólo permite homologación; los comprobantes no tienen autorización fiscal productiva. El aislamiento por empresa está verificado en el repositorio y el selector compartido; la configuración actual exige un archivo exclusivo por empresa. La API devuelve los datos necesarios para cada módulo autorizado, incluidas referencias comerciales necesarias para formularios, y no implementa restricciones por sucursal. El selector de sucursal filtra la vista; no constituye una frontera de autorización.

La auditoría HMAC detecta modificaciones realizadas sin su clave; no puede impedir que quien controle el servidor y la clave reconstruya la cadena. La base conserva el estado JSON por revisión, con bloqueo transaccional y escrituras serializadas. No se ha evaluado escala de producción ni procesamiento distribuido.
