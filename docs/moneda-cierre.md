# Preparación en moneda de cierre y RECPAM

Contabilidad → Moneda de cierre y RECPAM prepara una constancia INT-MC a partir de un expediente nominal INT-EC vigente. Conserva índices, naturaleza monetaria, antigüedades, proceso secuencial, exposición monetaria mensual, cuatro estados, notas y comparativos. Incluye todas las sucursales de la entidad. Es un papel de trabajo revisado. Su [contabilización anual](contabilizacion-moneda-cierre.md) se realiza en un paso separado, con asientos, cierre/apertura ajustados y controles contra duplicación.

## Recorrido de preparación

1. Elegir el antecedente nominal vigente y fundamentar la preparación. La primera aplicación o reanudación reconstruye activo y pasivo iniciales, componentes patrimoniales y resultados acumulados por diferencia. La continuidad exige un cierre INT-MC inmediatamente anterior, de la misma entidad, con saldos nominales conciliados, procedencia de índices coherente y valores históricos coincidentes.
2. Cargar una serie mensual con mes `YYYY-MM` e índice decimal, referencia, URL y fecha de consulta. Confirmar su procedencia. FACPCE exige URL oficial HTTPS y meses anteriores al mes de consulta. El índice del cierre debe existir: no se extrapola ni se sustituye por el último disponible. También se requieren todos los meses del período y los orígenes históricos utilizados. La opción Ensayo se identifica como sintética y no sirve para una entidad real. La carga es manual; la aplicación no autentica automáticamente los valores contra la publicación.
3. Clasificar cada cuenta patrimonial con saldo o actividad como Monetaria, Histórica o Valor de cierre, con fundamento. El efectivo seleccionado debe ser monetario. Una cuenta conserva una naturaleza coherente durante el período; los cambios de naturaleza requieren cuentas separadas. Las mediciones ya expresadas en moneda de cierre no se multiplican nuevamente.
4. Descomponer las partidas iniciales y finales en importes y meses de origen respaldados. La suma debe conservar el importe nominal de la fuente. Los valores monetarios mantienen su moneda de medición; las partidas históricas utilizan su antigüedad. No se infiere el origen de bienes o inventario desde la fecha de consumo.
5. Revisar cada línea de resultados, incluso cuentas con movimiento y saldo neto cero. Transacciones usan moneda de medición; consumos usan origen del activo; una comparación descompone ambas magnitudes y admite signos opuestos fundamentados. El reparto por rubro debe conciliar con el expediente nominal.
6. Revisar aportes, distribuciones y demás variaciones patrimoniales. Las asignaciones y transferencias cualitativas usan moneda del cierre anterior y conservan total cero. Capital nominal y ajuste de capital se muestran separados. Revisar fechas de suscripción, aprobación y medición según la documentación del caso.
7. Actualizar todas las notas y agregar la de unidad de medida. Incorporar antecedentes comparativos INT-MC correspondientes a los INT-EC elegidos originalmente, de la misma entidad y serie coherente. Las cifras anteriores se llevan desde su moneda de cierre a la actual, con redondeos expuestos. Los comparativos faltantes quedan pendientes con fundamento; no se muestran nominales como ajustados ni se presume una dispensa normativa. Revisar la conciliación financiera y confirmar antes de conservar.

## Cálculo y conciliación

Los índices admiten hasta doce decimales y se operan como razones enteras exactas. Cada importe se redondea al centavo, también para valores negativos; el coeficiente visible no sustituye la razón utilizada. Se rechazan importes fuera del rango seguro y series repetidas, incompletas o inconsistentes.

El proceso secuencial obtiene el resultado global desde el patrimonio final, el inicial en moneda de cierre y las variaciones patrimoniales. El residuo después de reexpresar resultados se presenta en la línea agrupada de resultados financieros y por tenencia, incluido RECPAM. La exposición monetaria inicial y los movimientos netos mensuales permiten calcular por separado el RECPAM monetario. La diferencia entre ambos cálculos requiere explicación; no se atribuye automáticamente toda diferencia al RECPAM.

Efectivo conserva cobros y pagos externos brutos reexpresados por mes, transferencias internas separadas, RECPAM del efectivo y redondeo explícito. Situación patrimonial, evolución patrimonial y efectivo deben conciliar antes de guardar. Las decisiones y mediciones siguen requiriendo evidencia y revisión del operador.

## Conservación y permisos

La constancia conserva el responsable de sesión, antecedentes, índices, descomposición, notas y cálculos. Se valida al recuperar o restaurar, incluido el recorrido JSON. Una operación posterior no reescribe el expediente; para incorporarla se prepara otro antecedente nominal y un nuevo ajuste. El permiso propio del módulo permite leer las fuentes necesarias y guardar el ajuste, sin habilitar datos comerciales ajenos. Se protegen revisiones, versiones concurrentes y reintentos.

PDF y XLSX exportan el expediente completo, cuatro estados, notas, diario fuente, proceso, índices, naturaleza, antigüedad/coeficientes y exposición. El XLSX conserva importes numéricos y texto decimal de índices; los archivos identifican su base de preparación y las observaciones pendientes.

## Referencias y trabajo restante

Se consultaron el 11/10/2026 los §§176–200 del [texto ordenado RT 54 / RT 59 y modificaciones](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf) y la [publicación de índices FACPCE](https://www.facpce.org.ar/indices-facpce/?l=spanish). La referencia orienta coeficientes mensuales, reconstrucción inicial, proceso secuencial, consumo de activos, comparaciones, patrimonio y efectivo. No acredita adopción en Tucumán ni revisión profesional de una entidad concreta. No se descargó ni verificó una serie oficial actual en este ensayo.

Se incorporó la [contabilización anual revisada](contabilizacion-moneda-cierre.md), el cierre de resultados ajustado y la apertura siguiente con continuidad. Faltan conciliación detallada de submayores y anexos de la capa de reexpresión, mediciones y revelaciones adicionales, impuesto a las ganancias y diferido, ajuste por inflación impositivo, correcciones comparativas de errores, consolidación, modelos/anexos específicos, aprobación y certificación profesional. El circuito toma los saldos registrados: cuando hay INT-AI exige el resultado ajustado y su cuenta patrimonial revisada. El objetivo integral del PPTX permanece abierto.

## Evidencia reproducible

Pasaron 384 pruebas: 298 de dominio, 18 de archivos, 46 HTTP y 22 fiscales. Incluyen exactitud decimal, primera aplicación, continuidad, comparativos, comparación de magnitudes, orígenes de consumos, reservas, capital, flujos, notas, permisos, reintentos y rechazo de fuentes alteradas. Lint y compilaciones local, compartida y de servidor acompañan la verificación.

El recorrido de siete pasos guardó INT-MC-00000001 y lo recuperó después de recargar. Índices exclusivamente sintéticos: diciembre 2025 = 100, enero 2026 = 110, febrero–octubre = 150. Resultado $197,72; RECPAM monetario −$681,82; residuo financiero −$681,83 y diferencia explicada −$0,01. Activo $5.370,09, pasivo $536 y patrimonio $4.834,09. Efectivo inicial reexpresado $1.500 y final $1.700, variación $200; RECPAM de efectivo −$754,55 y redondeo −$0,01. Las tres conciliaciones son cero. Se conservan los once asientos originales, documentos, stock y tesorería.

El [informe de verificación](../output/verification-reexpression-2026-10-11.json) comprueba veinte bases con validación completa, integridad SQLite y HMAC. Se conserva la [transcripción observada de pantalla](../output/reexpression-browser-2026-10-11.txt). La captura falló inicialmente; después de recuperar la conexión se obtuvo la [imagen real del registro](../output/reexpression-2026-10-11.jpg) mediante observación conjunta de pantalla y accesibilidad. Se generaron el [XLSX](../output/moneda-cierre-2026-10-11.xlsx) y el [PDF](../output/pdf/moneda-cierre-2026-10-11.pdf) desde el registro guardado y las funciones del producto; el PDF se revisó visualmente en sus diecinueve páginas. La prueba de archivos lee ambos formatos; el evento del navegador no se usa para acreditar los bytes exportados.

Con Node 24, `scripts/preview-reexpression-ui.mjs` prepara la base de ensayo y `scripts/verify-reexpression-ui.mjs` comprueba y exporta lo guardado desde la pantalla. Los datos no corresponden a operaciones reales.
