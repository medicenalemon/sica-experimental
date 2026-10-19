# Correcciones del diario con historial

El Libro diario permite al Administrador General revertir una vez un asiento identificado expresamente como manual. Conserva el asiento original y agrega exactamente sus líneas opuestas, con constancia `INT-RA`, referencia, motivo, fecha, revisión y responsable obtenido de la sesión. Después se puede cargar el asiento correcto mediante el formulario habitual.

## Condiciones y controles

- Original y reversión deben pertenecer al ejercicio activo y a fechas abiertas. La reversión no puede preceder al original; el original debe conservar cuentas imputables y una sucursal activa.
- Se revisan las cuentas y los importes antes de registrar. Un cambio en el original o en la versión de la base exige preparar otra revisión.
- Sólo se admite una reversión por original y referencias distintas. Los reintentos con el mismo identificador de solicitud recuperan el resultado sin volver a contabilizar.
- La API exige el permiso de escritura del diario y el rol Administrador General. Los perfiles contables lectores pueden consultar la constancia; los perfiles sin acceso contable no reciben sus datos.
- Al recuperar una copia se verifica la correspondencia entre original, revisión conservada, constancia y contrapartida. Quitar una constancia o alterar cualquiera de sus importes impide restaurarla. Las constancias se conservan al cerrar y abrir ejercicios.

Los nuevos asientos manuales guardan una marca explícita. Los registros anteriores sin esa marca se mantienen consultables, pero no se convierten automáticamente en manuales: algunos movimientos automáticos también carecen de un comprobante comercial asociado. La corrección de esos antecedentes necesita revisar su origen.

## Alcance contable

Esta herramienta corrige registros manuales de fechas abiertas. No modifica comprobantes, cuentas corrientes comerciales, tesorería ni stock. Un asiento manual contra Proveedores altera el saldo contable de esa cuenta, pero no crea una deuda comercial por tercero. Las correcciones de facturas, entregas, inventarios y devengamientos deben recorrer sus circuitos vinculados.

La reversión no resuelve por sí sola errores de períodos anteriores, reaperturas ni ajustes de estados contables ya emitidos. Los cambios de estimaciones por información nueva y las correcciones de errores tienen tratamientos distintos en los párrafos 90–92 de la [RT 54, texto ordenado con modificaciones](https://www.consejo.org.ar/storage/attachments/Resolucion%20Tecnica%20N%2054%20%28TO%20RT%2059%20y%20modi-7TbUsld18i.pdf), consultada el 11/10/2026. La norma adoptada por la jurisdicción y el criterio aplicable al caso deben definirse para el cierre normativo. Ese tratamiento y la reapertura controlada siguen pendientes.

## Ejemplo verificado

La empresa sintética textil, Responsable Inscripto en Tucumán, conservó tres asientos:

| Fecha | Registro | Compras y gastos | Proveedores |
| --- | --- | ---: | ---: |
| 03/10/2026 | Original equivocado | Debe $150 | Haber $150 |
| 04/10/2026 | INT-RA-00000001 | Haber $150 | Debe $150 |
| 04/10/2026 | Gasto correcto | Debe $100 | Haber $100 |

El saldo final es $100 de gasto y $100 acreedores en Proveedores. Los movimientos brutos del diario suman $400 al Debe y al Haber, con diferencia cero. La interfaz volvió a cargar desde SQLite y conservó el original, la contrapartida, el motivo, el responsable y el asiento corregido. No se emitieron comprobantes fiscales ni se movieron fondos reales.

Pasaron **291 pruebas**: 218 de dominio, 13 de archivos, 38 HTTP y 22 fiscales. También pasaron lint, compilación de la interfaz y compilación del dominio del servidor. La verificación incluye originales bloqueados, asientos automáticos, revisiones alteradas, permisos, reintentos, restauración y continuidad después del cierre/apertura.

Las trece bases sintéticas de los recorridos anteriores conservaron validación completa, integridad SQLite y auditoría HMAC. El informe reproducible está en [verification-journal-reversal-2026-10-11.json](../output/verification-journal-reversal-2026-10-11.json), generado por `scripts/verify-journal-reversal-ui.mjs`. El [texto obtenido de la interfaz](../output/journal-reversal-browser-2026-10-11.txt) conserva la consulta después de recargar y el detalle de la constancia. Las API documentadas del navegador fallaron al capturar una imagen, por lo que no se presenta una captura como evidencia.
