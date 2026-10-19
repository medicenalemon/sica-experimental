# ARCA · Homologación

Implementación basada en el [manual oficial WSFEv1 v4.7](https://www.arca.gob.ar/ws/documentacion/manuales/manual-desarrollador-ARCA-COMPG.pdf), revisión del 1 de septiembre de 2026, y [WSAA](https://arca.gob.ar/ws/documentacion/wsaa.asp). Se comprobó también su WSDL público. Las pruebas simulan las respuestas remotas y verifican una firma CMS real con un certificado generado exclusivamente para la prueba. No equivalen a una homologación real.

## Preparar el servidor

Usar Node 24 y OpenSSL disponible en el PATH. Obtener el certificado de homologación mediante WSASS, asociado a `wsfe`, con la cuenta fiscal autorizada. Conservar certificado y clave privada fuera del directorio público y del repositorio. En Linux, la clave necesita permisos 600; el firmador comprueba correspondencia con el certificado y vigencia. No introducir secretos en formularios del navegador.

Completar en `.env` privado:

```ini
SICA_ARCA_MODE=homologacion
SICA_ARCA_CUIT=<CUIT representado autorizado>
SICA_ARCA_CERTIFICATE=<ruta absoluta al certificado PEM>
SICA_ARCA_PRIVATE_KEY=<ruta absoluta a la clave PEM>
SICA_ARCA_KEY_PASSWORD=<contraseña de la clave si está cifrada>
```

El CUIT configurado debe coincidir con el de la empresa en SICA. El punto de venta de la sucursal debe estar habilitado en el ambiente. La presencia de rutas no demuestra habilitación ni conectividad. No se hacen solicitudes al arrancar: las inicia el operador desde cada comprobante. No existe opción de producción en el adaptador actual.

Los endpoints HTTPS oficiales están fijados en el código; no se acepta una URL desde el navegador. Se valida TLS normalmente y no se siguen redirecciones. Los tickets WSAA se conservan cifrados AES-GCM en SQLite, ligados a empresa, ambiente y CUIT. La clave de auditoría del servidor protege también ese almacenamiento. No se envían tokens, firmas ni claves privadas al navegador.

## Circuito

1. Registrar la factura o nota interna. Esto conserva el comportamiento contable existente.
2. Desde Ventas o Notas, abrir ARCA y revisar la solicitud. Verificar emisor, receptor, clase, alícuotas e importes. Servicios requieren período de prestación y vencimiento. Las percepciones IIBB requieren base, alícuota, jurisdicción y referencia con un importe que coincida con el registrado.
3. Solicitar CAE de prueba. La revisión debe corresponder a la versión actual de la base; si otra sesión cambió datos, se exige revisar nuevamente antes de reservar. El servidor guarda la solicitud, consulta el último número, reserva el siguiente y guarda esa reserva antes de enviar. El registro interno `INT-...` no cambia.
4. Ante una respuesta incierta, consultar. Un resultado aprobado debe coincidir en tipo, punto, número, receptor, concepto, fecha, moneda, cotización, período de servicios, importes, desglose de IVA, tributos y referencias asociadas antes de asociar su CAE. Si ARCA confirma que no existe, una consulta sola no lo emite; el operador puede reintentar la misma solicitud y el mismo número.
5. Una serie con solicitud incierta o en conflicto queda bloqueada para nuevas solicitudes hasta resolverla. Una respuesta incompatible requiere revisión; no se reintenta automáticamente. Un rechazo confirmado conserva el motivo y no se cambia silenciosamente el documento ni su contabilidad.

La solicitud reservada conserva una copia de los datos originales del emisor, receptor y renglones. Corregir el catálogo del cliente no reconstruye esa solicitud. Las notas requieren factura asociada aprobada en el mismo emisor y ambiente, con el mismo CUIT receptor. Las llamadas no crean nuevos asientos, cuentas corrientes ni stock. Los estados se agregan al registro de auditoría. Repetir una solicitud ya aprobada no envía otra factura. Se rechazan copias de restauración que borren o cambien comprobantes con solicitudes pendientes/aprobadas o sus datos de emisor y punto de venta.

La reserva y el resultado se guardan en `fiscal_jobs`; son parte del backup SQLite. Los JSON de operaciones no reinstalan autorizaciones ni tickets. El cierre del servidor espera sus operaciones en curso; después de un corte, el estado guardado permite consultar antes de reenviar.

## Casos cubiertos y pendientes

Cubiertos en pruebas: facturas A/B/C en pesos, receptor con CUIT según la regla del PPTX, condiciones de IVA actuales de los casos generales del prototipo, IVA por alícuota, exento/no gravado, productos/servicios/mixto, percepción provincial explicitada y notas asociadas. No se consultan todavía parámetros/padrones de ARCA ni se verifica automáticamente la condición de agente provincial. Una alícuota registrada no acredita por sí sola su aplicación legal.

Pendientes: completar la validación real WSASS; tipos y leyendas excepcionales, M/A con leyenda, FCE MiPyMEs, divisas, CAEA, exportación, anulaciones/reemplazos y representación legal productiva. Hay un PDF de homologación con QR; los reportes generales siguen siendo internos. El comprobante y el CAE de homologación no deben presentarse como factura fiscal válida. La habilitación productiva requerirá pruebas, datos registrales y revisión profesional de la empresa concreta.

Verificar con `npm run test:fiscal` y `npm run test:server`, usando Node 24. Las pruebas no contactan ARCA y no requieren certificados fiscales reales.

## PDF de homologación con QR

Desde **Clientes → Facturas/Notas → ARCA**, un resultado aprobado habilita **PDF de homologación con QR**. El servidor devuelve la solicitud conservada con la reserva, incluyendo emisor, receptor y líneas originales. El PDF no toma los nombres, domicilios ni precios del catálogo actual. No reconstruye una solicitud ni vuelve a pedir un CAE. El resultado incierto, rechazado, en curso o con conflicto no permite generar este PDF.

Se controlan ambiente, estado, tipo/letra, punto y número, CUIT, fechas, CAE, importes en centavos, bases, IVA, tributos y correspondencia del detalle. Sólo se admite PES con cotización 1. Se muestran encabezados, receptor, líneas, descuentos, total, IVA discriminado para A o contenido para B, tributos, período de servicios, referencia de factura asociada en notas, CAE y vencimiento. Las páginas conservan numeración y la leyenda **HOMOLOGACIÓN - SIN VALIDEZ FISCAL**. El QR se dibuja como vectores y se puede escanear; no se envían datos a ARCA al generarlo.

El contenido del QR sigue [las especificaciones oficiales de ARCA](https://arca.gob.ar/fe/qr/documentos/QRespecificaciones.pdf): URL oficial, parámetro `p` con JSON en Base64, fecha, CUIT, punto, tipo, número, importe en unidades de moneda, moneda, cotización, documento del receptor, tipo de autorización `E` y CAE numérico. La leyenda de prueba sigue siendo obligatoria en esta versión: un CAE de homologación no habilita el uso fiscal del PDF.

La representación legal productiva sigue pendiente: validación de los datos registrales, distribución legal del encabezado, ejemplares, leyendas y regímenes aplicables, cálculo de los impuestos nacionales indirectos según la actividad y revisión profesional. La aplicación no habilita producción ni garantiza cumplimiento de esas exigencias por tener un QR. Los reportes internos existentes conservan su formato y no incorporan CAE.

## Datos registrales y transparencia en B

La [RG 1415, texto actualizado](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-1415-2003-81316/actualizacion), Anexo II, contempla inscripción/condición en IIBB, inicio de actividades del establecimiento y el apartado de transparencia fiscal. Esta versión incorpora esos datos al PDF de homologación; no representa una validación de cumplimiento legal productivo.

En **Configuración** se informan inscripción o condición en IIBB y fecha de inicio. **Administración → Sucursales** permite una fecha específica por establecimiento. La solicitud usa el domicilio comercial de la sucursal si está informado, y su fecha específica; en ausencia, usa los valores de la empresa. No se inventan inscripciones ni fechas. Las fechas deben existir y la emisión no puede ser anterior al inicio informado. Los respaldos anteriores sin estos campos siguen siendo compatibles.

En el panel ARCA de comprobantes **B**, el operador puede declarar los **otros impuestos nacionales indirectos contenidos**, en ARS y con referencia obligatoria. El importe se guarda en centavos y debe ser no negativo, sin fracciones de centavo y no superar la parte del total restante después de IVA y tributos explicitados. Este componente ya está dentro del precio: no agrega cargos, no modifica totales, asientos ni la solicitud monetaria WSFE. IIBB no pertenece a este dato nacional. No se calcula automáticamente por alícuota ni se presume su aplicabilidad a la actividad.

Un campo vacío se imprime como no informado en la solicitud original. Un cero sólo se muestra si el operador lo declaró expresamente con referencia. El PDF B incluye el título del régimen, IVA contenido y los otros impuestos nacionales indirectos con su valor o advertencia. La referencia se conserva y se muestra al revisar la solicitud. Para datos faltantes o solicitudes anteriores se informa la ausencia; cambiar Configuración después de aprobar no completa ni altera el comprobante original.

Las pruebas verifican fechas imposibles, inicio posterior a emisión, permisos y rollback HTTP/restauración, valores omitidos/cero/positivos, rechazo de fracciones y conservación después de editar maestros y reiniciar SQLite. No se emiten CAE reales ni se habilita producción.

Para generar un ejemplo B sintético de dos páginas, sin conexión ni base compartida:

```sh
npm run build:server
node scripts/preview-fiscal-pdf.mjs
```

El ejemplo se guarda en `output/pdf/sica-comprobante-homologacion.pdf`. El CAE es ficticio y está identificado como prueba. `scripts/preview-fiscal-ui.mjs`, ejecutado con Node 24, crea una base temporal nueva y un servidor exclusivamente en `127.0.0.1:3003`, usando un cliente simulado sin red para verificar el botón. No usar ese servidor como instalación operativa. Detenerlo con Ctrl+C al terminar.

Se verificaron PDFs A/B/C y una nota de crédito, paginación de 70 artículos, rechazo de datos inconsistentes y lectura del QR a partir de la imagen renderizada del PDF. La prueba fiscal adicional confirma conservación después de editar emisor/receptor y reiniciar SQLite, sin repetir la autorización. Las pruebas de archivos requieren Poppler (`pdftotext`, `pdftoppm`) para inspección y `jsqr` para decodificar el QR; este último es una dependencia de desarrollo.
