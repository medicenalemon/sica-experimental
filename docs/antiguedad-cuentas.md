# Vencimientos y antigüedad de cuentas

**Finanzas → Cuentas por cobrar / pagar** permite consultar clientes, proveedores o ambos, por sucursal, contraparte y fecha de corte. Conserva el acceso al movimiento de cuenta corriente con el mismo corte para los perfiles que tienen ese permiso. El reporte es de consulta: no modifica comprobantes, aplicaciones, asientos, stock ni tesorería.

## Cálculo

Se consideran cargos y cancelaciones emitidos hasta el corte, incluso saldos iniciales de ejercicios anteriores. Un cobro, pago o nota posterior no cancela el saldo histórico consultado. Cada aplicación se verifica contra un cargo de la misma contraparte, tipo y sucursal. Si el cargo es posterior al corte, su cancelación se mantiene como saldo a favor hasta que el cargo entre en la consulta.

Los pendientes se agrupan por vencimiento en: a vencer o vence hoy, 1-30, 31-60, 61-90 y más de 90 días. El documento sin vencimiento queda en una columna separada; no se supone que esté vencido. Los días se calculan con fechas civiles y UTC, evitando diferencias por horario y contemplando los años bisiestos.

Los anticipos, notas y saldos iniciales negativos que no estén aplicados se muestran como **a favor sin aplicar**. No se distribuyen automáticamente por antigüedad ni se compensan entre sucursales. Para cada cuenta y para la selección completa se comprueba, a centavos:

`Pendientes de aplicación − Saldos a favor sin aplicar = Saldo neto de cuenta corriente`

El **vencido bruto** excluye lo que vence hoy y los documentos sin fecha. Puede coexistir con un saldo a favor no aplicado; antes de gestionar la cobranza se revisan ambos. Consultar ambos tipos suma los saldos sólo como información; no representa una compensación legal entre clientes y proveedores.

El detalle identifica comprobante, emisión, vencimiento, días, efecto original, importe aplicado al corte, pendiente y referencias de aplicaciones. Los cargos internos por cheques rechazados conservan su efecto en la cuenta corriente. Los pedidos y remitos no son deuda y quedan excluidos.

Si hay aplicaciones repetidas, destinos ausentes o importes inconsistentes, el cálculo informa el error y no muestra una conciliación ficticia. Los perfiles con permiso exclusivo de cuentas reciben los comprobantes necesarios, sin diario, stock ni movimientos de tesorería; se verificó que reproducen el mismo reporte que el administrador.

## Exportación y verificación

Las tablas de agrupación y detalle permiten buscar y exportar XLSX/PDF. La exportación respeta las filas visibles de su propia búsqueda; los indicadores corresponden a toda la selección de fecha, sucursal, tipo y contraparte. Los importes del XLSX mantienen el formato de moneda de las tablas.

El 14/10/2026 pasaron **474 pruebas de dominio y 70 HTTP**, lint y compilaciones compartida/servidor. Se verificaron cortes históricos, aplicaciones posteriores, notas, anticipos, saldos negativos, varias sucursales, proveedores, rechazos de cheques, fechas inválidas, centavos y límites de importe. **46 bases** conservaron validación después de JSON, integridad SQLite, HMAC y conciliación de antigüedad.

El navegador mostró al 14/10 pendientes $2.700, vencido bruto $1.700 y saldo a favor $50: neto $2.650. Al consultar el 20/10 incorporó otro cobro aplicado de $200: pendientes $2.500, vencido bruto $1.800 y neto $2.450. El aumento del vencido bruto se debe a que los $300 que vencían el 14 y 15 ya están vencidos el día 20. La base permaneció en revisión 1 y conservó íntegramente todas sus operaciones.

Se generaron y releyeron los archivos XLSX y PDF del ejemplo; el PDF de una página fue renderizado y revisado visualmente. La captura nativa del navegador no estuvo disponible y se conservó el recorrido DOM. Informe reproducible: `scripts/verify-accounts-aging-ui.mjs`, con resultado en `output/verification-accounts-aging-2026-10-14.json`.

La antigüedad no constituye una evaluación de incobrabilidad ni devenga intereses. Se incorporó la [aplicación posterior administrada de anticipos y créditos](aplicaciones-creditos.md), con revisión y reversión conservada. Quedan pendientes previsiones por recuperabilidad, convenios de pago e intereses. Las fechas de vencimiento son las informadas al cargar el documento; el reporte no interpreta contratos o plazos legales. Las restantes ampliaciones de la matriz continúan abiertas.
