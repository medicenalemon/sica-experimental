# Extractos y conciliación bancaria

En **Finanzas → Extractos bancarios** se pueden cargar extractos ARS desde XLSX o CSV y vincular sus filas con movimientos ya registrados en SICA. La carga no ejecuta operaciones bancarias ni genera cobros, pagos, gastos o asientos. Las diferencias deben revisarse y registrarse en los módulos correspondientes.

## Preparar y cargar

1. Crear una cuenta de tipo Banco en Cajas y cuentas bancarias, con sucursal y cuenta contable. Los movimientos a conciliar deben usar esa cuenta.
2. Descargar el modelo XLSX desde Cargar extracto y adaptar el archivo del banco a estas columnas:

| Columna | Formato |
| --- | --- |
| Fecha | AAAA-MM-DD; también se leen celdas de fecha de Excel. |
| Referencia | Identificador único de la operación en esa cuenta, hasta 120 caracteres. |
| Descripcion | Concepto bancario, hasta 500 caracteres. |
| Importe | ARS con signo: positivo ingreso, negativo egreso; hasta dos decimales, sin separadores de miles. Se admite punto o coma decimal. |

Si el banco repite sus referencias, preparar un identificador que distinga las operaciones, conservando la referencia original en la descripción. No deduplicar por importe o concepto: dos operaciones iguales pueden ser legítimas.

3. Seleccionar cuenta, referencia del extracto y período dentro del ejercicio. Indicar saldos inicial y final con signo, en ARS. Se lee la primera hoja del XLSX, con hasta 5000 filas y menos de 10 MB; también se pueden pegar exactamente cuatro columnas separadas por tabulaciones. Los saltos de línea y tabulaciones dentro de celdas XLSX se convierten a espacios para la vista previa.
4. Revisar la vista previa. Todas las filas deben ser válidas, estar dentro del período y tener referencia única. No se redondean importes con más de dos decimales. El saldo inicial más la suma de los movimientos debe coincidir exactamente con el saldo final.
5. Guardar el extracto revisado. El servidor valida nuevamente los datos. No se admite incorporar sólo una parte de las filas: un error impide guardar todo el extracto.

Los extractos activos de una misma cuenta no pueden superponer períodos ni reutilizar referencias. Las cuentas diferentes se procesan por separado. No se requiere que los extractos cubran todos los días; los huecos no se interpretan como ausencia de operaciones.

### Archivos CSV

En «Leer archivo XLSX o CSV», seleccionar un CSV de hasta 10 MB y 5000 movimientos, codificado en UTF-8 (con o sin BOM). Debe contener exactamente las cuatro columnas del modelo; pueden cambiar de orden y escribirse con mayúsculas o con «Descripción» acentuada. Se detecta el separador por coma, punto y coma o tabulación a partir del encabezado.

Las celdas que contienen el separador deben estar entre comillas dobles; una comilla literal se escribe duplicada. Los saltos de línea dentro de las celdas se muestran como espacios, igual que en XLSX. Se conservan los números de línea originales al indicar errores. Las líneas vacías se omiten. En archivos separados por coma, un importe con coma decimal debe estar entre comillas, por ejemplo `"2000,00"`. Las fechas siguen siendo AAAA-MM-DD y los importes no admiten separadores de miles ni más de dos decimales.

Una celda sin comilla de cierre, columnas de más o de menos, encabezados repetidos, codificación incorrecta o límites excedidos impiden cargar el archivo. La lectura vacía la vista previa anterior; no puede guardarse mientras está en curso. Cerrar el formulario descarta cualquier lectura pendiente. Las filas válidas siguen pasando por la revisión de período, referencias, saldo inicial y final y controles del servidor antes de guardar el extracto completo.

## Vincular y revisar diferencias

Desde Revisar, seleccionar una fila pendiente y pulsar Vincular. SICA propone una selección únicamente si encuentra un solo movimiento pendiente de igual importe dentro de siete días de la fecha bancaria. La propuesta siempre requiere confirmación; no existe conciliación automática por similitud del concepto.

La selección manual admite entre uno y cien movimientos de la misma cuenta, sucursal y signo. Su suma debe coincidir a centavos con la fila bancaria. Se admiten fechas diferentes, como un cheque contabilizado antes de su débito en banco; revisar esas diferencias al confirmar. No se compensan ingresos y egresos para fabricar una coincidencia neta, ni se divide una fila entre conciliaciones parciales. Cada movimiento SICA sólo puede participar en un vínculo activo.

Para varias filas bancarias, marcar entre dos y cien filas pendientes del mismo signo y pulsar **Vincular filas seleccionadas**. Revisar las referencias y elegir entre uno y cien movimientos SICA: ambos totales deben coincidir exactamente. El fundamento es obligatorio. Esto permite, por ejemplo, conciliar un anticipo de $6.000 con acreditaciones de $2.000 y $4.000, o varios cobros con varias acreditaciones. El grupo pertenece a un único extracto, cuenta y sucursal; cada fila conserva su importe original y muestra las referencias del grupo. El movimiento compartido se cuenta una sola vez en el saldo de tesorería.

Los movimientos marcados manualmente como Conciliados no se vuelven a vincular. Primero revisar y retirar la marca manual desde Bancos y conciliación. Una vez vinculados a un extracto, la marca no puede quitarse desde esa pantalla: se desvincula desde el extracto, con un motivo. El historial conserva responsable, fecha, movimientos y observaciones. La identidad proviene de la sesión del servidor.

La revisión muestra:

- Saldo final bancario informado y saldo SICA de la cuenta hasta el fin del período.
- Diferencia sin ajustar: saldo final del banco menos saldo SICA.
- Neto de filas bancarias pendientes y neto de movimientos SICA sin conciliar hasta esa fecha, incluyendo movimientos anteriores pendientes.
- Diferencia por explicar: saldo bancario − pendientes bancarios + pendientes SICA − saldo SICA.

**Un neto cero no prueba que todas las filas estén conciliadas.** Ingresos y egresos pendientes pueden compensarse. Revisar el contador de filas vinculadas, cada movimiento y los saldos de apertura. El saldo SICA se recalcula con los registros existentes; no se congela al cargar el extracto y no presupone un saldo inicial bancario que no se haya registrado.

Las marcas y vínculos pueden revisarse después de cerrar un período porque no modifican importes contables. Registrar un ajuste o gasto sí requiere un período abierto en el módulo que corresponda.

## Deshacer o reemplazar

Para deshacer un vínculo, indicar el motivo. Los movimientos vuelven a Pendientes y se conserva el historial. Un extracto sólo se puede anular después de desvincular todas sus filas. La anulación conserva el documento y libera su período para cargar un reemplazo; no borra operaciones financieras ni reutiliza sus identificadores. Un extracto anulado queda disponible para consulta y no admite nuevos vínculos.

Desde cualquier fila agrupada, **Desvincular** muestra todas las referencias afectadas antes de confirmar. La operación libera el grupo completo y sus movimientos juntos. El historial conserva el identificador del grupo, todas sus filas, los movimientos, el motivo y el responsable de sesión. Los vínculos individuales anteriores mantienen su formato. La restauración comprueba miembros, totales, signo, marcas, historial y ausencia de participación duplicada.

La cuenta con extractos conserva tipo y sucursal. Los cambios de nombre no alteran el nombre de cuenta conservado en el extracto. Las copias JSON mantienen extractos e historial; la restauración rechaza saldos inconsistentes, períodos/referencias duplicados, vínculos perdidos, movimientos repetidos, importes que no concilien y marcas que no coincidan con sus filas. Las bases antiguas sin extractos siguen admitidas cuando no tienen marcadores de vínculo.

Los comandos requieren permiso para `/finanzas/bancos/extractos`, incluido en Administración y Administrador General. Un perfil personalizado puede recibir únicamente ese permiso. Los demás perfiles no reciben la colección de extractos. La auditoría general del servidor registra las operaciones; el historial guardado en una copia JSON no constituye por sí solo una certificación externa.

## Evidencia de prueba y límites

El 08/10/2026 se verificó en la base temporal compartida del puerto 3002:

- Dos anticipos sintéticos, de $6.000 y $4.000, registrados por Transferencia en Banco de prueba.
- Extracto con acreditación agrupada de $10.000 y cargo de −$100: saldo inicial $0, final $9.900.
- Vínculo de la acreditación con ambos recibos; responsable Administrador, historial con dos movimientos.
- Cargo de $100 todavía Pendiente, saldo SICA $10.000 y diferencia sin ajustar −$100. El vínculo no registró el cargo.
- Lectura de un XLSX real con las mismas dos filas y signos, confirmado en la vista previa; no se guardó una segunda copia del mismo extracto.

Siete pruebas de dominio cubren aritmética, importación atómica, vínculos agrupados, reversión, duplicados, recuperación y lectura de ARS. Una prueba de archivos genera y vuelve a leer el modelo y sus filas XLSX. Dos pruebas HTTP cubren permisos, identidad, idempotencia, conservación de asientos y carga concurrente del mismo período.

Se incorporó el vínculo de varias filas bancarias con uno o varios movimientos SICA. Las pruebas cubren agrupaciones de ingresos y débitos, importes exactos, rechazo atómico de selecciones inválidas, recuperación de copias y desvinculación completa. La prueba HTTP comprueba permisos, identidad de sesión, repetición segura, persistencia SQLite y conservación de operaciones contables. Evidencia del navegador: `output/bank-groups-review-2026-10-13.jpg`; informe: `output/verification-bank-groups-2026-10-13.json`.

La carga CSV fue incorporada al mismo circuito de revisión y guardado. Sus pruebas cubren separadores, comillas, UTF-8, encabezados, importes, números de línea, límites y errores que impiden importar parcialmente. Evidencia del navegador: `output/bank-csv-review-2026-10-13.jpg`; informe: `output/verification-bank-csv-2026-10-13.json`.

Pendientes: adaptadores para formatos propios de cada banco, importación de PDF/OFX, conexión autorizada con bancos, multimoneda, conciliación parcial de importes y contabilización asistida de cargos/intereses. El [catálogo BCRA incorporado](catalogo-bcra.md) conserva sus referencias; requiere futuras actualizaciones y no se actualiza automáticamente.
