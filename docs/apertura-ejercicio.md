# Apertura del siguiente ejercicio

Contabilidad → Apertura de ejercicio permite continuar después del cierre de resultados, conservando saldos patrimoniales, fuentes y operaciones pendientes. Complementa las diapositivas 76–77 del PPTX y el [cierre de resultados](cierre-resultados.md). La constancia es interna y los saldos se trasladan en sus importes registrados. Si el cierre incorpora [INT-AI](contabilizacion-moneda-cierre.md), se conservan los saldos ajustados, su enlace y el aviso de usar Continuidad sin duplicar la reexpresión.

## Circuito

1. Revisar los hechos, imputaciones y ajustes del ejercicio anterior. Si hubo stock, requiere valuación exactamente al fin del ejercicio. Registrar el cierre de resultados y su bloqueo asociado.
2. El Administrador General prepara la apertura. El inicio es el día siguiente al cierre; se indica el fin del nuevo ejercicio, una referencia única y el fundamento. El proceso incluye todas las sucursales con asientos, aunque el encabezado filtre una sola.
3. Revisar los saldos iniciales consolidados y por sucursal, comprobantes con saldo, remitos sin factura, servicios devengados pendientes, saldos operativos de tesorería y referencia de la última valuación. Los créditos y anticipos sin aplicar se muestran negativos. Esta revisión conserva la posición al cierre anterior; los módulos muestran su evolución posterior.
4. Reconocer las observaciones sobre la moneda de los saldos y la continuidad de operaciones. La revisión queda ligada al cierre de resultados, al bloqueo y a sus fuentes. Si cambian los datos o parámetros relevantes, debe prepararse otra vez.
5. Registrar la apertura `INT-AE-...`. Constancia, fechas activas e historial de ejercicios se guardan juntos; se conserva el último bloqueo. El siguiente ejercicio sólo puede abrirse después de cerrar el actual.

No se genera un segundo asiento por los saldos patrimoniales: el diario conserva los asientos originales y el balance los incluye en su columna inicial. Duplicar una apertura sobre ese mismo historial duplicaría los saldos. La revisión comprueba que cada saldo inicial coincide con el final anterior y que Ingresos/Gastos tienen saldo inicial cero. No cancela ni reemplaza documentos, existencias, dinero, cheques, cupones o planes de producción. La numeración continúa desde el historial completo.

## Continuidad e informes

Las facturas anteriores pueden cobrarse o pagarse con documentos del ejercicio activo; permanecen sus aplicaciones y saldos. Los servicios sin factura pueden reestimarse por nueva información y conciliarse con facturas nuevas: en el nuevo ejercicio se registra sólo la diferencia contra el gasto estimado anterior. La valuación CPP sigue desde el último corte, incluidas recepciones sin factura y su deuda estimada; no solicita otra apertura de cantidades y valores. Las tarjetas pendientes pueden liquidarse y los cheques pueden acreditar/debitar tesorería una sola vez. Los planes preparados conservan sus reservas y pueden ejecutarse con fechas reales del ejercicio activo.

Los extractos anteriores y sus vínculos siguen validándose. Un extracto del ejercicio activo puede conciliar movimientos históricos pendientes de la misma cuenta, sucursal, signo e importe. Conciliar conserva las fuentes monetarias: no crea asientos ni modifica importes del período cerrado.

Diario, Mayor y Sumas y saldos incorporan un selector de ejercicio para consultar el actual y los anteriores conservados, con rango personalizado dentro de un ejercicio. Los asientos anteriores a Desde integran el saldo inicial. El bloqueo histórico impide registrar nuevos movimientos en esos ejercicios. Las fechas de ejercicios abiertos o cerrados se conservan y no pueden cambiarse desde Configuración; los datos descriptivos de la empresa siguen editables.

## Integridad y permisos

Sólo el Administrador General registra la apertura. Administración y perfiles autorizados pueden consultar el módulo; ese permiso no concede escritura. La respuesta para un perfil exclusivo de apertura contiene las fuentes financieras necesarias para reproducir la revisión, sin identidades privadas de contrapartes, precios comerciales o credenciales. Otros módulos reciben sólo el calendario de ejercicios que necesitan; no reciben la constancia de apertura si carecen de acceso a ella.

SQLite guarda la operación con control de versión, idempotencia y auditoría HMAC. Un rechazo no modifica la versión ni los saldos; un reintento identificado no abre dos veces. La recuperación reconstruye la secuencia de ejercicios, vínculos de cierres, saldos iniciales y pendientes; rechaza aperturas o calendarios faltantes, alterados, repetidos o con saltos. Conserva compatibilidad con las bases anteriores que no tenían aperturas. El modo local mantiene los límites del navegador de [servidor-y-recuperacion.md](servidor-y-recuperacion.md).

## Alcance normativo y pendientes

La [RT 54, texto ordenado con RT 59 y modificatorias publicado por el Consejo](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf), párrafo 646, relaciona el saldo inicial del patrimonio neto con el final anterior, expresado en moneda de cierre, y distingue ajustes anteriores y variaciones del período. Este módulo conserva la continuidad nominal del registro; todavía no implementa esa presentación profesional ni la reexpresión. La fuente consultada el 11/10/2026 contiene RT 59, RT 62 y JG 656/2025 y no acredita la adopción jurisdiccional para una entidad en Tucumán.

Siguen pendientes ajuste por inflación, estados contables completos y comparativos, anexos/notas, amortizaciones, impuesto a las ganancias corriente y diferido, deterioros, conversión completa y reapertura/corrección controlada de ejercicios. Tampoco migra registros antiguos que omitieron saldos o deudas. Las facturas nuevas se cargan con fechas del ejercicio activo: falta ampliar el circuito para conservar una fecha de emisión de un ejercicio ya cerrado con registro posterior cuando corresponda. Abrir un ejercicio no hace válidos fiscalmente los comprobantes ni presenta declaraciones.

## Evidencia sintética del 11/10/2026

La interfaz de `var/qa-exercise-opening.sqlite` registró `INT-AE-00000001` con Casa Central seleccionada y ambas sucursales incluidas. Activó 01/01–31/12/2027 y conservó el bloqueo del 31/12/2026. Saldos iniciales: Caja $650 deudores, Proveedores $100 acreedores, Servicios sin factura $150 acreedores y Resultado $400 acreedores. La apertura no agregó asientos; quedaron los seis históricos. Constancia, balances y servicio pendiente siguieron visibles después de recargar.

La interfaz rechazó un asiento del 31/12/2026 y aceptó un ingreso nominal de $50 del 05/01/2027. La base terminó en versión 3 con siete asientos: el balance de 2027 muestra Caja inicial $650, movimiento $50 y final $700; Ventas tiene inicial cero y $50 acreedores. El selector permitió volver a 2026, con Caja final $650 y resultados cancelados. Ningún pago, emisión fiscal o presentación profesional se ejecutó.

Las [capturas del ejercicio activo](../output/exercise-opening-2026-10-11.png) y [constancia con saldos iniciales](../output/exercise-opening-balances-2026-10-11.png) son imágenes reales del navegador. La [verificación persistida](../output/verification-exercise-opening-2026-10-11.json) comprueba referencias, revisión, actor, balances, asientos, integridad SQLite y auditoría de once bases de ejemplo. Pasaron **270 pruebas**: 199 de dominio, 13 de archivos/QR, 36 HTTP y 22 fiscales, además de lint y compilación compartida. Los casos cubren secuencia 2026→2027→2028, lectura histórica, nuevos cobros, servicios, reestimaciones, mercadería sin factura, inventario CPP, producción, bancos, cajas, tarjetas, cheques, permisos, reintentos y recuperación.
