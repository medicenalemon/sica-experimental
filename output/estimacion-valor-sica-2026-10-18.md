# Estimación preliminar de valor de SICA

Fecha: 18 de octubre de 2026. Moneda: dólares estadounidenses, antes de impuestos.

**Referencia orientativa para negociar la cesión exclusiva del software actual: USD 40.000–120.000. Escenario central del modelo: aproximadamente USD 75.000.** Es una hipótesis de negociación con incertidumbre alta, no un precio de mercado comprobado ni una oferta de compra.

Los autores están evaluando tanto la venta total como las licencias de uso. No se informaron clientes, ingresos, rentabilidad, ofertas de compradores ni contratos. Por eso no se agrega valor por cartera comercial ni ingresos recurrentes; esto no significa que no existan. Tampoco se verificó la titularidad jurídica de todos los activos o sus condiciones de transferencia.

## Alcance de la revisión

Se revisaron el código actual del workspace, las rutas de la aplicación, las reglas de dominio, el servidor, la matriz de requisitos y documentación/evidencias de pruebas. La revisión incluye archivos modificados y nuevos aún no consolidados en Git. No equivale a una auditoría integral de seguridad, contabilidad o cumplimiento fiscal.

El sistema usa React/TypeScript y servidor Node/SQLite, con modo local y compartido. Se identificaron 85 archivos de dominio, 57 de páginas, 17 de componentes, 11 módulos de servidor, 162 scripts y 57 documentos Markdown. Estos conteos describen la evidencia inspeccionada; no se cobra ni se valúa por cantidad de archivos, pantallas o líneas de código.

La fuente funcional principal es [la matriz de alcance](../docs/requisitos-y-alcance.md). No se incluye la aplicación jurídica SIJ propuesta como desarrollo futuro.

## Costo estimado de reproducir lo construido

La siguiente descomposición asigna cada grupo una sola vez. Las horas son una estimación de ingeniería que incluye análisis, implementación, interfaz y verificación de ese grupo. No son horas registradas por los autores ni horas futuras para terminar el producto. Las funciones proyectadas no se incluyen como si estuvieran realizadas. El uso de herramientas modernas e IA puede reducir el esfuerzo; no se midió su efecto en una reconstrucción independiente, lo que amplía la incertidumbre.

| Grupo funcional actual | Complejidad y alcance observado | Horas estimadas |
| --- | --- | ---: |
| Plataforma y administración | Empresa, sucursales, perfiles, permisos, sesiones, multiempresa, API, persistencia, auditoría y recuperación | 300–500 |
| Gestión comercial | Clientes/proveedores, pedidos, remitos parciales, facturas internas, notas, cobros/pagos, cuentas corrientes, aplicaciones y antigüedad | 350–550 |
| Productos e inventario | SKU/variantes, listas, combos, depósitos, movimientos, traslados, devoluciones y reservas | 250–400 |
| Tesorería | Cajas y cierres, bancos, cheques, tarjetas, liquidaciones, contracargos y conciliación por extractos | 250–400 |
| Contabilidad operativa | Plan e imputaciones, asientos automáticos/manuales, reversión, diario/mayor/balances, cierres y apertura | 300–500 |
| Mediciones y estados contables | CPP, recepciones sin factura, devengamientos, bienes de uso, depreciación, deterioro, ajuste por inflación y papeles de preparación de estados | 400–700 |
| Producción | Órdenes, materiales, rutas, centros, turnos, capacidad, reservas, ejecución y costos de conversión | 250–400 |
| Fiscal e impuestos | Adaptadores ARCA, solicitudes conservadas, reintentos, CAE/QR simulados, IVA compras/ventas, conciliaciones, prorrateo y regímenes | 180–300 |
| Importaciones y salidas transversales | Plantillas, validación, historiales, reportes XLSX/PDF y exportaciones; sin repetir lógica de los grupos anteriores | 120–250 |
| **Total** | | **2.400–4.000** |

Se utiliza una tarifa combinada supuesta de **USD 35–50/hora**, como referencia de contratación externa. No es una tarifa salarial. El directorio de [proveedores de Argentina de Clutch](https://clutch.co/ar/developers) muestra bandas de USD 25–49 y USD 50–99/hora; su [guía de precios](https://clutch.co/developers/pricing) aporta contexto de contratación. Son tarifas publicadas, no comparables de compraventa de propiedad intelectual ni presupuestos específicos para SICA.

**Resultado: USD 84.000–200.000 de costo hipotético de reposición.** El punto central utilizado es 3.200 horas × USD 42/hora = USD 134.400. Una reconstrucción con mayor reutilización o IA podría costar menos. Estas cifras no representan el dinero efectivamente invertido, una inversión mínima recuperable ni una obligación del comprador.

## Venta total: modelo orientativo de negociación

Un comprador puede aprovechar las reglas, los circuitos y la documentación, pero asume el costo de revisar, completar, integrar y comercializar el producto. Para hacer explícito ese efecto se presenta una sensibilidad sobre el costo de reposición:

| Escenario | Reposición estimada | Fracción realizable supuesta | Valor resultante |
| --- | ---: | ---: | ---: |
| Conservador | USD 84.000 | 45% | USD 37.800 |
| Central | USD 134.400 | 55% | USD 73.920 |
| Comprador con fuerte encaje | USD 200.000 | 60% | USD 120.000 |

**Los porcentajes de 45–60% son supuestos de este análisis, no coeficientes estándar ni datos de operaciones comparables.** Representan conjuntamente incertidumbre técnica, madurez comercial, trabajo pendiente y utilidad para el comprador; no se agrega otro descuento por esos mismos motivos. No constituyen una valuación financiera formal.

De allí surge una banda redondeada de USD 40.000–120.000. Como propuesta inicial de negociación —no como precio de cierre pronosticado— puede plantearse una apertura de USD 100.000–120.000 y evaluar una zona de USD 60.000–90.000 si existe interés concreto, el alcance transferido está claro y la revisión del comprador confirma el estado descrito. No hay información suficiente para fijar un precio mínimo de aceptación. Un comprador sin encaje puede ofrecer bastante menos; uno con ventajas estratégicas podría pagar más, pero no se acreditó ese escenario.

Esta hipótesis supone entrega del código propio, documentación y artefactos reproducibles, y una cesión exclusiva de los derechos transferibles que finalmente se pacten. Marca, dominio, cartera, infraestructura, transición y obligaciones futuras deben identificarse por separado. Las dependencias de terceros mantienen sus respectivas licencias. No se incluye trabajo ilimitado de mantenimiento, soporte ni finalización.

## Licencias conservando la propiedad

Una licencia para una empresa se calcula por utilidad, usuarios, alcance, servicio y alternativas disponibles; no dividiendo el valor de todo el código entre clientes hipotéticos. Los precios que siguen son **propuestas comerciales para probar con clientes**, no valores de mercado verificados ni ventas aseguradas:

| Modalidad inicial | Propuesta orientativa | Alcance supuesto |
| --- | ---: | --- |
| Suscripción para una pyme | USD 100–300/mes | Una empresa, hasta cinco usuarios nominales, alcance operativo pactado, soporte acotado y capacidad validada previamente |
| Puesta en marcha | USD 800–2.500 por única vez | Configuración, capacitación y migración simple con límites escritos |
| Licencia perpetua de uso interno | USD 3.000–8.000 | Una empresa, hasta cinco usuarios, versión y módulos pactados, sin código fuente, exclusividad ni reventa |

La licencia perpetua es una alternativa a la suscripción, no un cargo adicional por el mismo derecho. Su instalación y los servicios posteriores se cotizan aparte. Los rangos requieren validar los costos propios de soporte/infraestructura y la disposición de pago del comprador. Un piloto experimental tendría condiciones y precio propios; estas cifras no presentan al producto como fiscalmente habilitado ni listo para cualquier uso productivo.

Como contexto competitivo, [Xubio publica planes por empresa](https://xubio.com/ar/precios-empresas?plan=empresas) con distintos usuarios y volúmenes, y [Odoo publica planes por usuario](https://www.odoo.com/es_ES/pricing). No son equivalentes funcionales exactos ni se convirtieron sus precios en pesos a dólares. Sus precios no respaldan por sí solos las cifras propuestas para SICA. Las personalizaciones grandes requieren presupuesto independiente.

## Factores que sostienen y limitan la estimación

La principal fortaleza es la integración entre operaciones comerciales, existencias, tesorería y contabilidad, con reglas para aplicaciones parciales, reversión y conservación de fuentes. Los módulos de inflación, valuación, activos y producción contienen conocimiento de dominio que un comprador podría reutilizar. Los scripts y documentos facilitan la transferencia.

Los principales límites observados son:

1. **Validación fiscal pendiente:** existe adaptador de producción, pero el ensayo documentado utilizó respuestas simuladas; no acredita emisión real. El documento específico [facturación por ambiente](../docs/facturacion-produccion.md) es más reciente que algunos textos generales que aún hablan sólo de homologación.
2. **Operación y escala pendientes:** no se acreditó despliegue productivo ni prueba de carga real. El servidor conserva estado JSON en SQLite y serializa escrituras; su capacidad debe medirse para el uso del comprador.
3. **Alcance funcional abierto:** producción avanzada, integraciones bancarias/procesadoras, multimoneda y varios tratamientos fiscales/contables siguen parciales o pendientes. El cierre normativo completo no está acreditado.
4. **Comercialización sin datos aportados:** no se conoce cartera, ingresos, retención, costos de soporte ni resultados económicos para valuar el negocio por sus flujos.
5. **Entrega pendiente de delimitar:** no se verificó la titularidad documental ni se fijó una versión de entrega. El workspace contiene numerosas modificaciones, por lo que la propuesta debe identificar una versión reproducible y sus exclusiones.

Las fuentes locales clave son [alcance](../docs/requisitos-y-alcance.md), [servidor](../docs/servidor-y-recuperacion.md), [recuperación](../docs/recuperacion-independiente.md) y [facturación](../docs/facturacion-produccion.md).

## Evidencia de verificación

Los informes históricos del 17/10/2026 registran 728 pruebas aprobadas en cuatro suites y verificaciones sobre 59 bases sintéticas. Se revisó el informe [retenciones y percepciones](verification-tax-movements-2026-10-17.json). Son evidencias históricas, no una validación independiente de producción ni cobertura total del producto.

En esta revisión se ejecutó nuevamente la suite de dominio: **587 pruebas aprobadas, cero fallos**. La suite de archivos/exportaciones no completó la ejecución y fue interrumpida; no se declara aprobada. No se ejecutaron nuevamente las suites HTTP, fiscal o de recuperación. El Node disponible en la consola fue 20.20.2, mientras que el servidor documenta Node 24.

## Preparación concreta de la negociación

La propuesta al comprador debería adjuntar una versión identificada, una demostración de sus circuitos prioritarios y una lista de funciones verificadas y pendientes. Conviene describir por separado el activo cedido o licenciado, el trabajo de instalación, la transición y el soporte. Una venta exclusiva transfiere la oportunidad de futuras licencias del alcance cedido; esa diferencia debe quedar reflejada en el precio y las condiciones.

Para estrechar la banda se necesita conocer el tipo de comprador, módulos que utilizará, número de usuarios/empresas, carga esperada, ingresos actuales si los hubiera y alcance exacto de la exclusividad. Las ofertas concretas y el costo de sus alternativas serán evidencia más fuerte que este modelo preliminar.
