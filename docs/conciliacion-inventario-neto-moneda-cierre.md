# Inventario y desvalorización en moneda de cierre

La conciliación INT-CI ahora incorpora tanto el costo bruto como la pérdida acumulada por artículo, depósito y sucursal. Ambos componentes se enlazan con el ajuste anual INT-AI y sus antigüedades; la conciliación no agrega otro asiento ni modifica cantidades, comprobantes, valuaciones o comparaciones anteriores.

## Referencia y alcance

La referencia consultada es la [RT 54, texto ordenado por RT 59 y modificaciones posteriores](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf), párrafos 185–191 y 296–304. La expresión en moneda de cierre considera el origen de cada partida; para resultados provenientes de comparaciones se expresan sus magnitudes antes de volver a compararlas. El CMV basado en costo considera las pérdidas reconocidas. La aplicación no determina por sí sola la norma profesional aplicable a cada entidad ni su adopción jurisdiccional.

Este paso concilia una pérdida ya registrada y reexpresada en INT-AI. No reemplaza una nueva comparación con el VNR actual de la fecha de cierre. Tampoco habilita otros modelos de medición ni certifica estados profesionales o impuestos.

## Fuente, revisión y contabilización

La preparación anual requiere una valuación exactamente en su corte. Si existe una pérdida vigente, existencias y cuenta regularizadora requieren clasificación no monetaria y orígenes documentados en INT-MC. Las magnitudes de la comparación de VNR y de su resultado se revisan en esa preparación. El asiento anual incorpora sus diferencias en una única contabilización; se conservan la pérdida original INT-VI y su asiento.

INT-CI presenta dos repartos: costo y desvalorización. Se incluyen todos los propietarios —también pérdidas cero— y se conserva cada importe anterior, signo, fuente y antigüedad. Los importes positivos de la pérdida representan Haber menos Debe de la cuenta regularizadora. Cada fuente debe asignarse completamente y una vez; las sumas por sucursal deben coincidir con los mayores antes y después del ajuste. La pérdida reexpresada no puede ser negativa, superar el costo bruto ni subsistir sin unidades.

El perfil de inventario recibe la fuente necesaria de ambos componentes y sus antecedentes, sin los estados completos ni la preparación completa INT-MC. El servidor verifica permisos, actor, revisión, versión y reintentos. La restauración rechaza fuentes, repartos, saldos o constancias alterados. Las conciliaciones anteriores sin desvalorización conservan exactamente su estructura y revisión.

## CPP posterior y conservación

El CPP versión 7 parte de costo bruto y pérdida conciliados. La venta descarga bruto y consume pérdida proporcional; el CMV corresponde al costo neto. La devolución de una venta posterior restituye sus mismos valores. Una devolución de una entrega anterior a la base requiere importes y respaldo en la moneda de esa base. Los traslados y la fabricación mantienen la pérdida atribuible junto con su costo.

Las nuevas evaluaciones INT-VI toman la cuenta regularizadora y el costo bruto de la base vigente. Dos ajustes anuales sucesivos conservan sus fuentes, cierres y aperturas; el segundo continúa desde la primera moneda de cierre. Los registros nominales anteriores y la comparación original siguen consultables. La conversión de datos para calcular la base de CPP no persiste una apertura contable adicional.

## Ejemplo y evidencia

El ejemplo usa una empresa textil Responsable Inscripto en Tucumán y una serie de índices **sintética** septiembre 100/octubre 150:

1. Diez unidades tenían costo bruto $1.000 y pérdida $400, neto $600, en moneda de septiembre.
2. El ajuste anual deja costo bruto $1.500 y pérdida $600, neto $900. INT-CI conserva esos valores por artículo y depósito, sin otro asiento. La comparación inicial y los cortes nominales conservan $1.000/$400.
3. La entrega posterior de tres unidades consume bruto $450 y pérdida $180: CMV neto $270. El CPP conserva siete unidades, bruto $1.050, pérdida $420 y neto $630.

La interfaz conservó ambas operaciones y las recuperó desde SQLite. La suite cubre también dos monedas anuales sucesivas, nuevas comparaciones después de la conciliación, devoluciones, pérdida completamente revertida, límites por propietario, repartos inválidos, permisos, idempotencia y copias alteradas. Se verificaron **451 pruebas**: 350 de dominio, 28 de archivos, 51 HTTP y 22 fiscales. **25 bases** conservaron validación completa, integridad SQLite y auditoría HMAC. Las catorce hojas XLSX conservan importes numéricos, cantidades, coeficientes y referencias; las catorce páginas PDF fueron revisadas visualmente.

Evidencia: [verificación completa](../output/verification-inventory-reserve-currency-2026-10-12.json), [recorrido de pantalla](../output/inventory-reserve-currency-browser-2026-10-12.txt), [conciliación recuperada](../output/inventory-reserve-currency-2026-10-12.jpg), [CPP recuperado](../output/inventory-reserve-currency-costing-2026-10-12.jpg), [XLSX](../output/conciliacion-inventario-neto-2026-10-12.xlsx) y [PDF](../output/pdf/conciliacion-inventario-neto-2026-10-12.pdf). Los botones de exportación se activaron; los bytes verificados proceden del mismo constructor aplicado al registro persistido, sin acreditar una descarga del navegador.

## Pendientes del objetivo integral

Siguen pendientes el circuito completo de una comparación con VNR actual después de expresar a moneda de cierre, costos completos de conversión, conciliación de pasivos estimados reexpresados, otros modelos de medición y revelaciones, correcciones de períodos cerrados, reapertura, fiscalidad real y emisión profesional. El ajuste por inflación contable no equivale al ajuste impositivo. Este avance resuelve la conciliación de la cuenta regularizadora; el objetivo integral del PPTX sigue abierto.

La comparación posterior con el VNR actual al cierre se incorporó en [vnr-actual-inventario-cierre.md](vnr-actual-inventario-cierre.md). Esta evidencia de conciliación conserva su fecha, cantidades y alcance originales.
