# Originales de comprobantes recibidos

Las compras y notas ordinarias A, B y C de proveedores pueden conservar su identidad externa: CUIT emisor/receptor, tipo de comprobante, punto de venta, número y autorización declarada CAE/CAEA/CAI, con vencimiento si está informado. La referencia interna de SICA permanece separada. Los datos son ARS y proceden de una carga manual; el sistema no constata su autorización ante ARCA.

## Carga y correcciones

El formulario de compra o nota ofrece **Identificar original al guardar**, activo inicialmente. El comprobante y su identificación se guardan en una sola operación. Se valida la identidad antes de publicar los nuevos movimientos: un original duplicado rechaza la compra completa, sin generar otro asiento ni deuda.

Puede desactivarse esa opción para registrar un borrador pendiente. También pueden completarse compras históricas o importadas desde **Identificar original** en su listado. Compras y el papel de trabajo de IVA muestran ese pendiente; los datos no se completan mediante suposiciones.

El tipo se deriva de clase y operación: factura A/B/C 001/006/011, débito 002/007/012 y crédito 003/008/013. Se comprueban CUIT y dígito verificador, punto 1–99999, número 1–99999999, formato del código declarado y fecha de vencimiento informada. El original debe corresponder a las partes configuradas o a las partes ya conservadas al corregir una identificación anterior. Un cambio posterior del catálogo no reescribe sus CUIT históricos.

La clave de duplicado es **CUIT emisor + tipo + punto + número**, normalizada y compartida entre sucursales. La fecha o sucursal no habilita a cargar de nuevo la misma identidad. Se comprueban las identificaciones vigentes; una corrección documentada puede liberar un número que se había transcripto incorrectamente.

Cada constancia INT-CO conserva fecha de registro, responsable de sesión, referencia, fundamento, importes del comprobante interno y antecedente. Corregir agrega otra constancia; conserva la anterior. Una revisión desactualizada o un antecedente incorrecto se rechaza. La identificación posterior no cambia fecha de emisión, partidas, deuda, stock, asientos ni IVA del comprobante registrado. También puede completarse en un ejercicio siguiente, sin reabrir el anterior.

## Consulta y permisos

Los listados distinguen referencia interna, original vigente y estado. El detalle y el historial permiten consultar correcciones; se pueden exportar las tablas con XLSX/PDF. En IVA de trabajo se muestra el original y, si está identificado, el CUIT emisor conservado. Un código cargado no cambia el estado a «autorizado»: permanece **Datos declarados · sin constatación ARCA**.

Identificar una factura exige permiso de compras; una nota exige permiso de notas. El servidor verifica la operación real para impedir suplantar el tipo en la solicitud. Los módulos sin acceso al comprobante no reciben su historial. Se verifican concurrencia, repetición de solicitudes, recuperación y revisión completa con perfiles restringidos.

## Criterio y fuentes

Las tablas oficiales identifican por separado los tipos de factura y nota; son la referencia del mapeo implementado. [ARCA, tablas del sistema](https://www.arca.gob.ar/libro-iva-digital/documentos/Libro-IVA-Digital-Tablas-del-Sistema.pdf).

La constatación de CAE es una consulta distinta, con datos del comprobante y del receptor. Se conserva esa distinción en la aplicación; registrar el código no acredita haberla realizado. [ARCA, constatación de comprobantes con CAE](https://servicioscf.arca.gob.ar/publico/comprobantes/cae.aspx).

IVA Simple requiere revisar y finalizar la registración de operaciones. La identificación aquí implementada aporta datos para esa preparación; la [preparación de compras ordinarias](iva-simple-compras.md) agrega TXT y crédito revisado por comprobante, sin envío ni finalización de la declaración. [ARCA, módulo de registración y especificaciones](https://www.arca.gob.ar/iva/iva-simple/especificaciones-especiales.asp). Fuentes consultadas el 15/10/2026.

## Verificación

Se verificaron **501 pruebas de dominio y 73 HTTP**, lint y compilaciones compartida/servidor. **49 bases** conservaron validación completa después de JSON, integridad SQLite y auditoría HMAC.

El navegador identificó una compra como `001 · 00004-00000042` y corrigió a `00000043`, conservando ambos antecedentes. Rechazó una nueva compra con ese número: la base siguió en revisión 3, con dos documentos y dos asientos. Con `00000044` guardó una compra de $100 netos más $21 IVA y su original juntos; la revisión 4 conservó tres documentos/asientos y tres constancias. Los dos documentos y asientos anteriores, existencias y tesorería permanecieron iguales. Se consultaron los originales y el pendiente restante en IVA de trabajo.

Las identidades y autorizaciones del ensayo son sintéticas, sin consulta registral ni emisión/constatación real. Se conservan captura nativa y recorrido DOM. El DOM del intento duplicado conserva el formulario con número 43; no retuvo el mensaje transitorio. La instantánea sin cambios y la prueba HTTP verifican el rechazo. Informe reproducible: `scripts/verify-supplier-originals-ui.mjs`, resultado `output/verification-supplier-originals-2026-10-15.json`.

Quedan pendientes constatación integrada con evidencia de respuesta, otros tipos como M, FCE, tiques y documentos especiales, adjuntos del original, carga masiva de esas identidades y completar la salida/reconciliación normativa de IVA Simple más allá de las compras ordinarias ya preparables. La fecha fiscal errónea o un importe incorrecto requiere su corrección comercial/contable, no cambiar la identificación. Los restantes pendientes del objetivo integral continúan abiertos.
