# Facturación electrónica: ambientes y representación

SICA incorpora selección explícita de homologación o producción en el servidor. La configuración inicial sigue siendo `disabled`. Este avance implementa el adaptador; no acredita una conexión real, habilitación del contribuyente ni validación integral de la representación legal. Los ensayos conservados usan respuestas locales simuladas y no acceden a ARCA.

## Configuración por empresa

En una instalación simple se elige `SICA_ARCA_MODE=homologacion` o `SICA_ARCA_MODE=produccion`, junto con CUIT, certificado y clave privada del mismo ambiente. Consultar `.env.example` y `server/start.mjs` para los nombres exactos. En multiempresa cada entrada configura su propio objeto `arca` y su archivo de base independiente. No se cambia el ambiente desde el navegador. Un modo desconocido se rechaza; no hay sustitución automática de un servicio por otro.

WSAA utiliza `wsaa.homo.arca.gov.ar` en homologación y `wsaa.arca.gov.ar` en producción. WSFEv1 utiliza `wswhomo.afip.gov.ar` y `servicios1.afip.gov.ar`, respectivamente. El ticket se cifra con contexto de empresa, CUIT y ambiente; un ticket copiado al otro ambiente no se acepta. El firmador verifica vigencia del certificado, correspondencia de la clave y permisos privados. Faltan el ensayo real del intercambio, las delegaciones y los puntos habilitados de cada empresa.

## Revisión y conservación

Antes de operar se revisan el ambiente y la versión de los datos. Producción exige enviar explícitamente el ambiente revisado. La revisión y la autorización verifican denominación y domicilio de emisor/receptor, declaración de inscripción o condición de IIBB, inicio de actividades no posterior a la emisión y condición de venta. Estas declaraciones no se consultan ni validan contra padrones.

Para B se exige declarar otros impuestos nacionales indirectos contenidos: incluso la ausencia se informa como cero con referencia. No se agrega ese importe al total ni se mezcla con IIBB. La condición de venta y los datos registrales quedan congelados en la solicitud. El cálculo existente emite A de responsable inscripto a monotributista; su representación incluye la leyenda de la Ley 27.618 cuando corresponde a la condición y fecha conservadas.

La representación actual usa una tipografía latina. Antes de reservar número productivo se rechazan textos de cabecera y líneas con controles, saltos de línea o caracteres que no puede representar. Límites: emisor/receptor 300 caracteres, domicilios 500, IIBB 120, condición de venta 200, descripción de línea 1000 y unidad 80. Las observaciones de autorización se conservan completas en producción y se paginan en el PDF. El soporte tipográfico ampliado y la revisión de variantes legales siguen pendientes.

Cada comprobante tiene historia separada por ambiente. El selector permite consultar la solicitud y descargar el PDF del antecedente de otro ambiente; las operaciones nuevas usan el configurado. Las notas requieren la autorización del original en ese mismo ambiente. Cambiar datos o parámetros no reescribe la solicitud conservada. La autorización no crea otra factura comercial ni otro asiento.

Después de una respuesta interrumpida se conserva el número reservado y se consulta antes de reenviar. Una serie sin resolver bloquea otra reserva de esa serie. Si la consulta no encuentra el número, el reintento utiliza la misma solicitud. Una aprobación conserva CAE, vencimiento, observaciones y solicitud; la representación y el QR se derivan de esos datos. Aprobación de homologación y producción simulada llevan advertencias de prueba. El cliente simulado es exclusivo de scripts de ensayo, sin firma ni acceso externo.

## Evidencia del 17/10/2026

El recorrido de navegador utilizó dos documentos comerciales y dos asientos preexistentes. Una factura A conservó homologación 42 y obtuvo producción **simulada** 142 después de una interrupción y consulta. La nota A se asoció al 142 y obtuvo número simulado 1. Tras recargar se recuperaron los resultados. El informe `output/verification-fiscal-production-2026-10-17.json` registra comparación de fuentes financieras, reservas, historial anterior, auditoría, integridad, pruebas y límites. Las transcripciones de interfaz se guardan en `output/fiscal-production-*.txt`. La captura nativa de pantalla falló en este ensayo; no se presenta una imagen reconstruida como evidencia del navegador.

El ejemplo `output/pdf/sica-produccion-simulada.pdf` se genera desde la solicitud aprobada por el simulador y lleva advertencias de simulación. No es una factura real. Su imagen renderizada y lectura del QR quedan en `output/qa/`.

## Alcance pendiente

El adaptador cubre comprobantes ordinarios A/B/C y notas, moneda PES y receptores identificados por CUIT, con los conceptos y tributos explícitos ya admitidos. No cubre todas las variantes de comprobantes, identificaciones de consumidor final, regímenes especiales, CAEA, exportación, contingencias ni remitos autorizados. No se presentó una declaración ni se emitió un comprobante real. La habilitación y validación profesional por empresa y jurisdicción, los padrones, los tributos por actividad y demás requisitos del PPTX siguen abiertos.

Fuentes primarias consultadas:

- [Manual WSAA de ARCA](https://www.arca.gob.ar/ws/WSAA/WSAAmanualDev.pdf).
- [Entornos disponibles](https://arca.gob.ar/ws/programadores/entornos-disponibles.asp) y [certificados](https://www.arca.gob.ar/ws/documentacion/certificados.asp).
- [Manual WSFEv1](https://arca.gob.ar/fe/ayuda/documentos/wsfev1-RG-4291.pdf).
- [Datos de comprobantes](https://www.arca.gob.ar/fe/emision-autorizacion/datos-comprobantes.asp) y [consideraciones de autorización](https://www.arca.gob.ar/fe/emision-autorizacion/consideraciones.asp).
- [Comprobantes de régimen general](https://www.arca.gob.ar/facturacion/regimen-general/comprobantes.asp) y [RG 5003/2021](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-5003-2021-350574/texto).
