# Costos de conversión de producción

SICA incorpora INT-PC para revisar gastos reconocidos e imputar su parte correspondiente a producción en proceso. El CPP versión 8 incorpora la conversión al ingresar cada lote terminado y conserva las órdenes que siguen en proceso. No utiliza el costo de referencia editable del catálogo como costo contable del lote.

## Preparación y seguimiento

1. Registrar primero mano de obra, servicios, depreciaciones y otras cargas en sus circuitos o en el diario. INT-PC no crea una segunda deuda ni un nuevo pago.
2. En **Contabilidad → Valuación de inventario**, preparar la imputación de producción como administrador. Elegir período fuente, fecha de imputación, sucursal y órdenes aún sin corte valorizado.
3. Separar grupos directos, variables, fijos y excluidos. Seleccionar líneas del gasto original y, si corresponde, una parte de su importe; no exceder el disponible ni duplicar una imputación anterior.
4. Documentar la base de cada orden, su unidad y el respaldo. Los fijos requieren actividad normal positiva y su evidencia; pueden tener actividad real cero. Las bases de un mismo grupo deben ser comparables.
5. Revisar el asiento, el costo asignado por orden y lo que permanece en resultados. Confirmar conjunto completo, moneda homogénea y exclusión de ineficiencias/ociosidad. Si la orden no tiene conversión adicional, conservar un respaldo explícito de ausencia de costos.
6. Finalizar la fabricación y conservar su valuación. El primer CPP que incluye el lote exige una revisión de conversión, incluso si su importe es cero. No admite optar por un cálculo anterior para omitirla.

La capacidad repartida se obtiene de las bases declaradas de las órdenes. El grupo fijo activa su costo neto multiplicado por `actividad real / máximo(actividad normal, actividad real)`, redondeado a centavos. Por debajo del nivel normal, la parte no absorbida queda en gastos; por encima, nunca se activa más que el gasto real. Directos y variables distribuyen el costo del grupo por las bases revisadas. Un grupo excluido no activa importes. Los repartos conservan exactamente los centavos, incluso con cantidades fraccionarias y notas previas que reduzcan un servicio.

El asiento reclasifica gastos a la cuenta configurada de producción en proceso. La valuación del lote transfiere sus materiales y conversión a existencias; la conversión de las órdenes pendientes conserva su saldo en proceso. Las ventas posteriores usan ese costo en el CPP. La cuenta de proceso no puede cambiar mientras conserve conversión pendiente; una referencia de importe cero no inmoviliza una cuenta sin saldo.

## Fuentes e integridad

Las compras físicas tienen su propio circuito de inventario o bienes de uso y no son una segunda fuente de conversión. Una factura mixta sólo ofrece su parte de servicios, con el tratamiento de IVA del asiento original. Los gastos de ventas no se toman como conversión.

Cuando existe un devengamiento de servicios, la factura no vuelve a sumar el gasto de los artículos devengados. Son elegibles el gasto inicial, las reestimaciones que precedieron a la conversión y la verdadera diferencia de la conciliación. Las líneas que sólo cancelan el gasto duplicado de la factura no se toman como nuevos costos. Una selección parcial de servicios conserva la parte no devengada de la factura.

El presupuesto de un servicio facturado considera sus notas vigentes y las partes ya imputadas. Una nota conocida no puede quedar ignorada para crear un activo y un resultado ficticios. Las fuentes, el diario anterior y los cortes anteriores quedan vinculados a la revisión. No se añade una imputación detrás de un lote ya valorizado. Se protege la reversión manual de sus gastos fuente.

Después de transformar un gasto en costo, cambiarlo requiere una corrección vinculada, todavía pendiente: se rechazan notas de servicios incorporados, anulaciones y diferencias/reestimaciones del servicio que afecten cuentas convertidas. Una factura con los mismos importes se concilia normalmente. La validación de una restauración también detecta cambios posteriores no conciliados. Las notas de compras físicas conservan su circuito existente.

La API exige administrador para INT-PC, sesión y CSRF; controla versión e idempotencia. Un operador de inventario recibe sólo referencias, órdenes, cuenta de proceso e importes asignados, con una revisión segura reproducible. No recibe los gastos, sus conceptos, el diario fuente completo ni la revisión financiera privada.

## Ensayo del 12/10/2026

| Concepto | Fuente ARS | Activado ARS | Gasto ARS |
|---|---:|---:|---:|
| Directo | 30 | 30 | 0 |
| Variable | 12 | 12 | 0 |
| Fijo: actividad 3 / normal 10 | 60 | 18 | 42 |
| Administración excluida | 5 | 0 | 5 |
| Total | 107 | 60 | 47 |

El lote A recibe $40 de conversión y el B $20. El navegador conservó INT-PC-00000001 y luego INT-VC-00000002: tres materiales por $30 más conversión de $40, dos productos terminados por $70. Las siete unidades de materia prima conservan $70; la orden B mantiene $20 en proceso. La deuda original y los gastos fuente permanecen registrados. La base separada `var/qa-production-conversion.sqlite` conserva revisión 3.

Dominio y HTTP verifican el segundo lote y las ventas posteriores. Se probaron límites, fuentes duplicadas, compras mixtas, servicios devengados/facturados, notas previas, cambios no conciliados, ociosidad total, actividad superior a la normal, cantidades de seis decimales, cuenta de proceso, conservación de cortes y copias alteradas.

Evidencia: `output/verification-production-conversion-2026-10-12.json`, transcripción `output/production-conversion-browser-2026-10-12.txt` y captura `output/production-conversion-review-2026-10-12.jpg`. Se activaron los botones PDF/XLSX; los bytes verificados proceden de los mismos constructores sobre la constancia persistida, sin acreditar descarga del navegador. El PDF tiene siete páginas revisadas visualmente y el XLSX siete hojas con importes numéricos, fuentes, bases y asiento.

## Marco y pendientes

La diapositiva 65 del PPTX distingue materias primas, gastos de producción, servicios, sueldos y administración. La referencia técnica consultada es [RT 54, texto ordenado con RT 59 y modificaciones](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf), párrafos 104–110: componentes de producción, exclusión de ineficiencias y ociosidad, y determinación razonable de actividad normal. No se declara adopción jurisdiccional ni cumplimiento integral.

Permanecen pendientes materiales anormales, merma/improductividad física, consumos parciales en proceso, costos adicionales de adquisición, costos financieros o de puesta en marcha, repartos entre sucursales y correcciones vinculadas de conversión. La conversión de órdenes sin terminar requiere un puente anual de moneda y comparación de recuperable; INT-AI se bloquea mientras esa base no pueda conciliarse. No se completa con esto el cierre normativo, la fiscalidad real ni la emisión profesional. El objetivo general continúa activo.


## Ampliación de reestimaciones en proceso

La [corrección vinculada INT-RPC](correcciones-conversion-produccion.md) permite revisar nueva información de servicios devengados que siguen íntegramente en proceso, manteniendo su parte asignada y las bases originales. Conserva el cambio del pasivo y de conversión en una transacción y alimenta el CPP al terminar la orden. Las notas, diferencias de factura/anulaciones, productos terminados y bases reexpresadas requieren ampliar la conciliación.


La revisión de nueva información también alcanza [lotes terminados y vendidos](correcciones-conversion-lotes-terminados.md), mediante INT-RPC versión 2 y un CPP9 vinculado. Se conservan las valuaciones anteriores y se registra la diferencia en proceso, existencias y costo de ventas en la fecha de la nueva evidencia. Los puentes de VNR y moneda, notas y conciliaciones siguen pendientes.
