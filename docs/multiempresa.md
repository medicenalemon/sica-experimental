# Selección de empresa en la instalación compartida

El ingreso compartido muestra las empresas habilitadas por el operador de la instalación. Cada una tiene sus usuarios, permisos, sesiones, parámetros, ejercicio, comprobantes, stock, auditoría, recuperación y adaptador fiscal. Los códigos y nombres visibles provienen de la configuración del servidor; no se publican credenciales, archivos ni datos contables en el selector.

## Uso

1. Seleccionar la empresa e ingresar con el usuario y contraseña asignados para ella.
2. Verificar el nombre y código de la empresa en el encabezado antes de registrar operaciones. El código también aparece junto al nombre del selector.
3. Para cambiar, pulsar **Cambiar empresa**. Se cierra la sesión actual; si hay una operación en curso o no se puede cerrar la sesión del servidor, el cambio no continúa.
4. Elegir la otra empresa e ingresar con sus credenciales. La contraseña del formulario se vacía al cambiar la selección.

La selección se conserva en el almacenamiento de sesión de la pestaña. Al recargar se recupera únicamente la sesión de esa empresa, si sigue vigente. Las pestañas pueden usar empresas diferentes. Dentro de una pestaña, cambiar de empresa reinicia los datos visibles, sucursal, versión y CSRF; las respuestas de la empresa anterior no se incorporan a la nueva vista. Los reintentos de una operación conservan la empresa y el CSRF originales.

Si una empresa previamente seleccionada ya no está habilitada, se solicita ingresar nuevamente. Las contraseñas no se guardan en el almacenamiento de la pestaña. La sesión usa una cookie HttpOnly y SameSite=Strict, con nombre y ámbito propios; la empresa predeterminada conserva la cookie y las rutas anteriores por compatibilidad.

## Configuración del servidor

El backend predeterminado es [PostgreSQL](postgresql.md). Para varias empresas PostgreSQL, copiar `server/companies.postgres.example.json`, referenciar las URL mediante `databaseUrlEnv` y elegir un `auditKeyFile` exclusivo por empresa. Pueden compartir una misma base; `company_id`, bloqueos, sesiones, fiscal y respaldos conservan la separación. Las instrucciones siguientes de archivos exclusivos corresponden al backend SQLite explícito (`SICA_DATABASE_DRIVER=sqlite`).

Se mantiene el modo de una sola empresa con `SICA_DATABASE`, `SICA_COMPANY_ID`, `SICA_ADMIN_PASSWORD` y las variables ARCA existentes. Para habilitar varias:

1. Copiar `server/companies.example.json` a `server/companies.local.json`, excluido del control de versiones.
2. Definir un código único, nombre público y archivo SQLite distinto por empresa. Los códigos admiten hasta 64 letras minúsculas, números, guiones o guiones bajos.
3. Referenciar las contraseñas iniciales por nombre de variable de entorno, sin escribirlas en el JSON. Cada base nueva requiere una contraseña de administrador de 12 a 1024 caracteres; una base existente conserva sus usuarios y contraseñas.
4. Definir `SICA_COMPANIES_FILE=server/companies.local.json` y `SICA_COMPANY_ID` con el código de la empresa predeterminada. Si este último se omite, se usa la primera empresa del archivo.
5. Iniciar el servidor con Node.js 24. Para acceso de red siguen siendo necesarios HTTPS, orígenes explícitos y cookies seguras.

El ejemplo contiene `textil` y `servicios`, con `SICA_TEXTIL_ADMIN_PASSWORD` y `SICA_SERVICIOS_ADMIN_PASSWORD`. El archivo permite hasta cincuenta empresas. Los campos ARCA por empresa son `mode`, `cuit`, `certificate`, `key` y `passwordEnv`; por defecto el adaptador está deshabilitado. La contraseña de la clave privada se referencia por variable de entorno. Habilitar el selector no habilita emisión productiva ni acredita una conexión real con ARCA.

La configuración rechaza códigos duplicados, rutas coincidentes —incluidos alias existentes— y bases que contengan otra empresa, antes de habilitar el servidor. Una base antigua con varios espacios de empresa debe separarse mediante una migración revisada; no se divide ni borra automáticamente.

## API, recuperación y respaldos

Las rutas de una empresa tienen forma `/api/company/{codigo}/...`; los recursos anteriores `/api/...` corresponden a la empresa predeterminada. Las respuestas de sesión, estado y comandos incluyen la identidad de empresa, que la interfaz comprueba antes de aceptarlas. Una cookie de otra empresa no autoriza consultas ni cambios, aunque ambas tengan un usuario con el mismo nombre. Los comandos siguen requiriendo permisos, CSRF, versión e idempotencia.

Las copias JSON incorporan el código de empresa en el nombre del archivo, por ejemplo `SICA-textil-copia-2026-10-13.json`. Las copias JSON y las recuperaciones están limitadas a la empresa autenticada y mantienen el permiso de Administrador General. La restauración conserva los usuarios de esa empresa. La tarea diaria genera respaldos por empresa: lógicos con HMAC y clave en PostgreSQL, o archivos SQLite con clave y sello en el backend anterior. Espera todos los resultados y comunica un fallo si alguna copia no se completa. El apagado espera las operaciones y colas fiscales de cada empresa. No hay consolidación contable entre empresas.

## Evidencia

El ensayo de navegador usa `var/qa-multi-textil.sqlite` y `var/qa-multi-servicios.sqlite`. Textil conserva su registro original y Servicios agrega una nota propia; ambas pestañas recuperan esos datos después de recargar, sin cambiar documentos, asientos, movimientos de stock o tesorería. La sesión Textil anterior al cambio se revoca.

Pasaron **68 pruebas HTTP** y la validación completa después de JSON, integridad SQLite y auditoría HMAC de **44 bases**. Lint y compilaciones compartida/servidor pasaron. La última suite de dominio de referencia conserva 456 pruebas; este avance no modifica el motor contable.

El recorrido se conserva en `output/multi-company-browser-2026-10-13.txt`; hay capturas del selector y de Textil antes del cambio. La captura final no estuvo disponible en el navegador: la recuperación simultánea se verificó mediante el DOM y los datos persistentes. El informe reproducible es `output/verification-multi-company-2026-10-13.json`.

Permanecen pendientes alta de empresas desde la interfaz, migración de bases que antes compartían archivo, consolidación contable, pruebas de carga y despliegue real, licencias y las demás ampliaciones del objetivo general.
