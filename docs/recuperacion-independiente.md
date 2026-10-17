# Recuperación independiente del servidor

El comando de recuperación funciona sin iniciar el servidor original. Verifica un respaldo SQLite y su clave, conserva usuarios y operaciones y publica una instalación recuperada en una carpeta nueva. No reemplaza archivos existentes ni modifica el respaldo seleccionado.

## Preparación del respaldo

Los respaldos nuevos contienen tres archivos que deben trasladarse juntos a almacenamiento privado e independiente:

- `COPIA.sqlite`: datos, usuarios, auditoría, recuperaciones y estado de solicitudes fiscales.
- `COPIA.sqlite.audit-key`: clave necesaria para verificar la auditoría y descifrar los tickets WSAA.
- `COPIA.sqlite.backup.json`: tamaño, SHA-256, empresas/versiones y sello HMAC del archivo completo.

La copia se genera mediante la [API de backup de SQLite de Node.js 24](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html). El sello adicional se calcula sobre el archivo terminado. La auditoría HMAC por sí sola no autentica todo el estado JSON: el sello de archivo también detecta cambios en datos válidos estructuralmente. Quien controle los datos y la clave puede reconstruir ambos sellos; deben conservarse en un entorno de confianza.

El proyecto requiere Node.js 24 y sus dependencias instaladas. `npm run recovery` compila las reglas de dominio antes de ejecutar el comando. No necesita las credenciales iniciales del administrador para verificar la copia.

## Verificar antes de recuperar

```bash
npm run recovery -- verify --source /ruta/privada/COPIA.sqlite --company textil
```

`--company` comprueba que el respaldo pertenece exclusivamente a ese código de empresa. Es recomendable para las instalaciones actuales con un archivo por empresa. Si se omite, se verifican todos los espacios de empresa presentes en un archivo histórico; no se eliminan ni fusionan.

El informe muestra empresas/versiones y cantidades de usuarios, comprobantes, asientos, movimientos, solicitudes fiscales y sesiones. No imprime contraseñas derivadas, sales, cookies ni tickets. Comprueba integridad SQLite, referencias de empresa, reglas completas del estado actual, cadena HMAC, fuentes de solicitudes fiscales pendientes/aprobadas y descifrado de los tickets conservados. Conserva las recuperaciones históricas; su compatibilidad contable se valida nuevamente si después se intenta restaurarlas como estado activo.

Para archivos antiguos sin `backup.json` se requiere `--legacy`. Esta opción conserva la advertencia de que no existe un sello del archivo completo; sigue verificando estructura, dominio, auditoría y tickets. No confirma una clave de auditoría a partir de una cadena vacía sin tickets. `--key /ruta/CLAVE` permite indicar una ubicación separada de la clave correspondiente.

Una fuente con WAL no vacío se rechaza. Usar un respaldo generado por SICA; no trasladar solamente el archivo principal de una base en uso. La inspección abre una copia temporal privada y comprueba que los bytes de la fuente no cambien durante su lectura.

## Publicar una recuperación

Elegir una carpeta que todavía no exista y cuyo directorio padre ya exista:

```bash
npm run recovery -- recover --source /ruta/privada/COPIA.sqlite --company textil --destination var/recuperado-textil-2026-10-14 --operator "Operador responsable" --reason "Recuperación después de falla del equipo"
```

El comando copia y verifica primero en una ubicación temporal. Conserva los estados de empresa y usuarios, solicitudes y tickets fiscales, historial de reintentos, recuperaciones anteriores y el prefijo original de auditoría. Revoca todas las sesiones copiadas, limpia los límites de intentos de ingreso y agrega una constancia HMAC por empresa con operador, motivo, SHA-256 de origen y versión original. El operador es un nombre declarado por quien ejecuta el comando, no una sesión autenticada del servidor. Cada empresa incrementa su versión una vez; no se agregan asientos, comprobantes ni movimientos.

El destino contiene `sica.sqlite`, su clave, un sello nuevo y `recovery-report.json`. Directorio y archivos se crean con permisos privados. El marcador `sica.sqlite.recovering` bloquea el inicio mientras no termine la publicación. Si ocurre un fallo, conservar el destino para revisión y elegir otra carpeta; no quitar el marcador para forzar el inicio.

## Iniciar y revisar la instalación recuperada

1. Conservar el respaldo original y el informe. Revisar empresa y versión indicadas.
2. Apuntar `SICA_DATABASE` al `sica.sqlite` recuperado y **conservar exactamente el código original** en `SICA_COMPANY_ID`. En modo multiempresa, actualizar sólo el archivo de esa empresa en la configuración. No reutilizar el destino para otra empresa.
3. Conservar los parámetros de red y las credenciales fiscales de esa empresa. Certificados y claves privadas ARCA externos no forman parte del archivo SQLite.
4. Iniciar SICA e ingresar con los usuarios y contraseñas originales. Las cookies anteriores no autorizan la base recuperada.
5. Revisar cuentas corrientes, stock, balances y solicitudes fiscales inciertas antes de retomar la operación. Reconciliar también las operaciones que pudieran haberse realizado después de la fecha del respaldo. Recuperar una copia no consulta ARCA ni emite comprobantes nuevos.
6. Generar un respaldo nuevo de la instalación activa. El sello publicado verifica el archivo recuperado antes de su uso; al operar sobre él cambian sus bytes y no debe reutilizarse como si siguiera siendo un respaldo intacto.

## Evidencia y alcance

Se verificaron recuperaciones independientes de las **44 bases sintéticas** anteriores. Se conservaron íntegramente usuarios, estados operativos y contables, reintentos y solicitudes/tickets fiscales, con auditoría original y nueva constancia verificadas. Las sesiones recuperadas quedaron revocadas. Informe: `output/verification-independent-recovery-2026-10-14.json`.

Las pruebas específicas incluyen manipulación del estado y sello, claves incorrectas, copias anteriores, credenciales originales, pedidos inciertos, tickets cifrados, espacios históricos de empresa, destinos existentes, WAL, publicación incompleta y ejecución del comando con la base original cerrada y retirada de su ruta. No se simula la destrucción física del equipo ni se verifica un almacenamiento externo contratado.

Siguen pendientes política de retención, supervisión externa de respaldos, despliegue real, migración entre formatos o separación de archivos históricos y las demás ampliaciones del objetivo integral.
