# Sesiones y terminales

En modo compartido, el Administrador General dispone de **Administración → Sesiones y terminales**. Puede consultar usuario, perfil, nombre de terminal, inicio, última consulta y vencimiento, distinguir su sesión actual y cerrar otra sesión con un motivo obligatorio.

El nombre de terminal se indica opcionalmente al ingresar, con hasta 80 caracteres. Es una referencia declarada, no una identificación física del equipo. Varias sesiones pueden pertenecer al mismo equipo. La lista cuenta sesiones vigentes y usuarios con sesiones; excluye credenciales vencidas, usuarios inactivos y sesiones invalidadas por cambio de contraseña. La última consulta se actualiza como máximo una vez por minuto.

Las sesiones conservan la duración existente: ocho horas o treinta días al elegir mantener sesión. Consultar datos no renueva el vencimiento. Las fechas de esta pantalla se muestran en horario de Tucumán, con formato de 24 horas.

## Cerrar otra sesión

1. Actualizar la lista y verificar nombre de terminal y usuario.
2. Pulsar «Cerrar sesión» en la fila correspondiente.
3. Revisar la terminal afectada e indicar un motivo.
4. Confirmar «Cerrar esta sesión». La sesión desaparece de la lista y su próxima consulta u operación requiere ingresar nuevamente.

El usuario conserva su acceso y los comprobantes registrados. La sesión actual se cierra con la opción habitual de salida; esta pantalla impide revocarla por error. El cierre administrado exige Administrador General también en el servidor y conserva responsable y motivo en la auditoría HMAC, con una nueva revisión. Una solicitud repetida conserva el resultado sin registrar otro cierre. Una lista desactualizada exige actualizar antes de operar.

La respuesta contiene identificadores de consulta independientes de las credenciales. No incluye tokens, CSRF de otras sesiones, hashes de contraseña ni claves. Las sesiones de otras empresas quedan fuera de la lista y no pueden cerrarse desde este contexto. Las copias operativas JSON no incorporan la lista ni credenciales de sesiones; el respaldo SQLite mantiene la tabla del servidor.

## Bases anteriores y ensayo

La migración agrega los datos de consulta sin cambiar las credenciales vigentes ni los registros contables. Cuando una sesión anterior no tiene fecha de inicio conocida, se muestra «Sin registro anterior» y terminal «Sesión anterior». No se infiere su antigüedad. La próxima consulta conserva una nueva fecha de actividad. Al actualizar la instalación deben reiniciarse las instancias del servidor para usar el esquema actualizado.

Las pruebas HTTP verifican permisos, CSRF, revocación inmediata, repetición, sesión actual protegida, credenciales vencidas, aislamiento de empresa, persistencia, auditoría y migración desde la tabla anterior. El navegador de ensayo consulta «Administración de ensayo» y cierra «Caja de ensayo», manteniendo los registros de la empresa.

## Alcance del PPTX

La diapositiva 26 propone instalación por máquina, abono fijo de tres bocas y bocas adicionales. Esta función incorpora administración de accesos y prepara ese circuito. Permanecen pendientes identificación y registro de terminales físicas, licencia/activación, cantidades contratadas, precios, vigencias comerciales, facturación y cobro del servicio. La lista de sesiones no acredita una licencia ni establece un límite de máquinas.

Evidencia: `output/verification-sessions-2026-10-13.json`, captura `output/sessions-review-2026-10-13.jpg` y recorrido `output/sessions-browser-2026-10-13.txt`. El objetivo integral permanece activo.
