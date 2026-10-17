# Criterios fiscales y contables de la versión experimental

Caso configurado: comercio textil, responsable inscripto, Tucumán. Los valores predeterminados son editables. No se asignó CUIT real a la empresa.

## Comprobantes y cálculo

La clase sugerida se basa en condición del emisor y receptor: responsable inscripto a responsable inscripto/monotributista A, a consumidor final/exento B; emisor monotributista/exento C. Son casos generales, sin habilitación de tipos excepcionales. [ARCA, clases de comprobantes](https://www.arca.gob.ar/facturacion/regimen-general/comprobantes.asp), [ARCA, monotributo](https://www.arca.gob.ar/facturacion/monotributo/comprobantes.asp).

A discrimina IVA adicional; B interpreta precios finales y separa IVA contenido para los registros; C no discrimina; X registra importes internos sin tratamiento fiscal. Las alícuotas disponibles incluyen 0, 2,5, 5, 10,5, 21 y 27. Su presencia no significa que puedan aplicarse indistintamente al negocio: debe seleccionarse la correspondiente a cada producto y operación. Las compras de una empresa no responsable inscripta incorporan el IVA al gasto de referencia.

El PPTX exige CUIT en A/B/C, incluso para consumidor final. Se mantuvo esta restricción de producto; no se afirma que sea una obligación legal universal. Las condiciones históricas «No responsable», «No categorizado» y «Responsable no inscripto» se conservan para migración, pero no permiten preparar A/B/C hasta actualizarse.

La numeración `INT-...` identifica registros internos. La opción de remito oficial no autoriza emisión. PDF y XLSX son reportes de gestión. Los libros incluyen borradores; no deben presentarse como libros fiscales ni declaraciones juradas.

## Integración fiscal de homologación

El servidor implementa WSAA/WSFEv1 en homologación, solicitudes persistidas y consulta de resultados inciertos. Requiere CUIT, certificado WSASS asociado a wsfe y punto de venta del ambiente. No se ha probado una conexión real con esas credenciales. Producción permanece deshabilitada. [ARCA, manuales de webservices](https://www.arca.gob.ar/fe/ayuda/webservice.asp).

La representación legal, QR, CAE y leyendas específicas, incluida transparencia fiscal, debe implementarse y revisarse antes de emitir. Las fuentes consultadas contienen reglas posteriores al material de referencia. [RG 5614/2024](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-5614-2024-407183), [ARCA, clases y leyendas](https://www.arca.gob.ar/facturacion/regimen-general/comprobantes.asp).

Retenciones y percepciones se registran por importe manual, impuesto, referencia y jurisdicción. El catálogo de regímenes no calcula automáticamente mínimos, padrones o vigencias. Para Tucumán hay que definir actividad, inscripción y condición de agente y consultar normativa, nomenclador y padrones. [DGR Tucumán](https://www.rentastucuman.gob.ar/nomina/rentastuc2/).

## Contabilidad

El motor exige partida doble y genera asientos de ventas, compras, notas, recibos, comisiones, cheques, saldos iniciales y transferencias. Se ofrece un plan de referencia modificable. Los remitos conservan cantidades. El módulo de inventario valorizado agrega apertura/cierres CPP revisados y asientos por sucursal en la fecha de corte: reclasificación de recepciones, costo de ventas por entregas, traslados, diferencias y materiales de fabricación. No contabiliza cada movimiento en su fecha individual. Incorpora correcciones de precio por notas de crédito/débito: reproducción desde la recepción o asignación revisada entre saldos y resultados para compras anteriores a la apertura, con ajustes al corte y conservación de los asientos anteriores. Las devoluciones físicas vinculadas a remito y nota recuperan costo histórico de clientes y descargan CPP a proveedores con diferencia explícita revisada; [reglas y política](devoluciones-stock.md). Incorpora recepciones de mercadería sin factura con estimación revisada, deuda contable y conciliación de facturas posteriores; [reglas y límites](recepciones-sin-factura.md). El devengamiento de servicios consumidos como gasto, su reestimación por información nueva y su conciliación revisada se implementan en un módulo separado; [reglas y límites](servicios-devengados.md). No incluye servicios capitalizables, reestimaciones de mercadería, anulaciones completas de servicios, reclasificación de notas posteriores, corrección de migraciones antiguas que omitieron esa deuda, costos completos de conversión, valor recuperable ni inflación. Los costos editables del catálogo y de gestión de órdenes permanecen separados. Reglas en [inventario-valorizado.md](inventario-valorizado.md).

RT 54/NUA aparece como referencia a revisar. Su adopción, aplicación y alcance dependen de la entidad y jurisdicción. La valuación histórica CPP está incorporada con límites; faltan su ampliación, inflación y estados contables completos, entre otros procesos de cierre. [FACPCE, normas argentinas](https://normasweb.facpce.org.ar/normas-argentinas/normas/), [Consejo, RT 54/NUA](https://www.consejo.org.ar/micrositios-profesionales/rt-54-norma-unificada-argentina-de-contabilidad).

Se verificó además el manual WSFEv1 v4.7, revisión 1 de septiembre de 2026, y la definición WSDL pública de WSAA. [Manual oficial WSFEv1](https://www.arca.gob.ar/ws/documentacion/manuales/manual-desarrollador-ARCA-COMPG.pdf), [Documentación WSAA](https://arca.gob.ar/ws/documentacion/wsaa.asp).

Fuentes consultadas el 7 de octubre de 2026. Esta revisión fundamenta las decisiones del prototipo y no acredita cumplimiento integral ni sustituye revisión profesional para la empresa concreta.

## Tarjetas y cheques endosados

Los nuevos cobros con tarjeta generan un activo «Cupones de tarjetas a cobrar», no efectivo disponible en banco. La fecha estimada se conserva con el cupón al registrar el cobro. Una liquidación cancela el bruto seleccionado contra banco por el neto, cargos y retenciones con certificado. Permite parciales y controla referencia y saldo para evitar duplicaciones. Las operaciones antiguas ya registradas como caja/banco no se recapturan.

Los cargos se imputan por su importe bruto, sin generar automáticamente crédito fiscal de IVA. La factura del servicio necesita identificación y conciliación contable para evitar duplicar el gasto. La liquidación no emite certificados oficiales ni consulta el agente; sólo registra referencias proporcionadas por el operador. [ARCA, certificados SIRE](https://arca.gob.ar/sire/percepciones-retenciones/certificados.asp), [ARCA, Mis retenciones](https://www.arca.gob.ar/genericos/retenciones.asp).

Un cheque de terceros puede entregarse a un proveedor desde Pagos. Se conserva el recibo original y se vincula la entrega al pago. El cobro confirmado por el proveedor no genera movimientos en el banco propio. Un rechazo posterior agrega cargos internos al cliente y al proveedor y registra Debe Clientes / Haber Proveedores, sin volver a acreditar o descontar fondos. Es el tratamiento operativo elegido para registrar la devolución de un cheque entregado, sujeto a revisar la obligación concreta; no gestiona acuerdos legales ni ejecuta endosos externos. [BCRA, emisión y uso de cheques](https://www.bcra.gob.ar/emitir-un-cheque-y-usar-echeq/), [BCRA, ECHEQ y devolución](https://www.bcra.gob.ar/echeq-o-cheque-electronico/).

Los débitos internos por rechazo de cheques se incluyen en las cuentas corrientes, pero se excluyen de ventas, compras y libros IVA: reabren deudas y no representan nuevas operaciones comerciales. Los cargos de tarjetas sí se incorporan como gastos brutos en los indicadores y en compras/gastos, separados como «Cargos de tarjetas».

## Revisión y bloqueo de períodos

El balance de comprobación arrastra saldos anteriores al rango seleccionado y distingue sus movimientos y saldos finales. Los cierres operativos exigen revisión del administrador, valuación de inventario en la fecha exacta cuando hubo mercadería y reconocimiento de observaciones. Conservan balance y fuentes; no generan el cierre anual de resultados, estados contables ni declaraciones fiscales. Los servicios consumidos como gasto admiten devengamiento y conciliación revisados; las entregas sin factura y otros tratamientos todavía requieren el ajuste manual que corresponda. Reglas en [cierres-contables.md](cierres-contables.md).

El cierre de cuentas de resultados conserva balances y fuentes y cancela Ingresos/Gastos por sucursal contra una cuenta de Patrimonio neto, con bloqueo asociado en una operación. Reglas en [cierre-resultados.md](cierre-resultados.md). No registra por sí solo los ajustes normativos ni prepara o legaliza estados contables; la apertura de otro ejercicio y la reapertura controlada siguen pendientes.
