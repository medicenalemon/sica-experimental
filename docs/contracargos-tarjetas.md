# Contracargos y resoluciones de tarjetas

Desde **Finanzas → Liquidaciones de tarjetas** se registra la notificación de una procesadora sobre un cupón original, pendiente o incluido en una liquidación. Los importes son ARS. Es una registración interna: no envía reclamos ni transfiere dinero.

## Tratamiento y revisión

Cada constancia INT-TC conserva recibo, cupón, asiento de origen, liquidación afectada, importe disponible, fecha, referencia y fundamento. El operador revisa las cuentas y los efectos antes de confirmar. «Ver constancia» permite consultar después el fundamento, tratamiento y asiento conservados. El servidor vuelve a calcularlos, usa al responsable autenticado y rechaza revisiones desactualizadas.

| Tratamiento | Registración inicial | Resolución |
| --- | --- | --- |
| Crédito cierto documentado | Debita el activo de reclamos y acredita el cupón o banco. Requiere confirmar evidencia de un crédito cierto, exigible y recuperable. | Reintegro contra el activo; saldo rechazado a pérdida. |
| Reclamo contingente | Debita pérdida y acredita el cupón o banco. Mantiene el reclamo pendiente como control separado, sin activar un derecho incierto. | Reintegro como ingreso por recupero; el rechazo cierra el control sin duplicar el gasto. |
| Pérdida definitiva | Debita pérdida y acredita el cupón o banco, sin pendiente de resolución. | Admite un recupero posterior documentado, limitado al importe perdido no recuperado. |

Las resoluciones INT-TR pueden ser parciales. Un recupero posterior de una porción cerrada no reduce otra porción que todavía esté pendiente. Las referencias repetidas y los importes superiores al disponible se rechazan. Las nuevas operaciones respetan los períodos abiertos y no pueden preceder a operaciones ya conservadas del cupón.

El tratamiento contingente es una decisión de diseño basada en la restricción para reconocer efectos favorables inciertos que resume FACPCE para RT 54, párrafos 143–144. La opción de crédito cierto exige una evaluación documentada; la casilla no reemplaza esa evaluación ni determina por sí sola la norma aplicable a la entidad. [FACPCE, Informe de Área Contabilidad 36, apartado de activos contingentes](https://www.facpce.org.ar/wp-content/uploads/2025/12/CONTABILIDAD-Informe-de-Area-N%C2%B0-36-Comparacion-NUA-NIIF.pdf).

## Cupón, banco y comprobantes

En un cupón pendiente, el importe afectado se descuenta de lo disponible para futuras liquidaciones. Un reintegro o recupero posterior restituye esa disponibilidad. La pérdida definitiva sigue excluida. En una liquidación acreditada, se registra el débito o crédito en su banco original; debe conciliarse con el extracto. Puede reflejar un saldo bancario negativo si la procesadora efectuó un débito real.

Se conservan la factura, el recibo, sus aplicaciones, stock, IVA, cargos y retenciones originales. Tampoco se revierte automáticamente la comisión del vendedor. Una devolución comercial, descuento o modificación de precio debe tratarse con el comprobante y vínculo que correspondan; el contracargo financiero no produce una nota fiscal automática. [ARCA, RG 4540, emisión y vinculación de notas de crédito y débito](https://biblioteca.arca.gob.ar/search/query/norma.aspx?p=t%3ARAG%7Cn%3A4540%7Co%3A3%7Ca%3A2019%7Cf%3A31%2F07%2F2019).

El circuito no reabre deuda del cliente. La exigibilidad al cliente, los cargos adicionales de la procesadora y cualquier ajuste fiscal necesitan su propio fundamento y registración revisada. El Administrador General puede preparar tres cuentas sugeridas; también pueden seleccionarse cuentas imputables propias de activo, gastos e ingresos. Los permisos de tarjetas no exponen el diario completo: reciben únicamente la prueba mínima del asiento del cupón necesaria para reproducir la revisión.

## Verificación del 14/10/2026

- **467 pruebas de dominio y 69 HTTP** aprobadas, incluyendo permisos, concurrencia, reintentos, revisiones alteradas, recuperación, tratamiento contingente y recuperos posteriores.
- Ensayo desde la interfaz: liquidación de $1.000 con cargos $30 y retenciones $20; banco $950. Contracargo contingente $400, reintegro $250 y rechazo $150: banco final $800, pendiente cero, pérdida $400 e ingreso por recupero $250, sin activo de reclamo ni asiento adicional por el cierre.
- Se preservaron comprobantes, IVA, stock y liquidación original; el saldo del cliente sigue en $210. **45 bases** conservaron validación completa después de JSON, integridad SQLite y auditoría HMAC.
- La captura nativa del navegador no estuvo disponible. Se conservaron el recorrido DOM de la revisión y del resultado y la comprobación de los datos persistentes en `output/verification-card-disputes-2026-10-14.json`.

Quedan pendientes la conexión con procesadoras, importación de notificaciones, gestión de adjuntos/plazos, reclasificación posterior de un reclamo contingente a crédito cierto, circuito de deuda exigible al cliente y tratamiento integrado de gastos adicionales. La cobertura del PPTX y la validación fiscal productiva continúan parciales.
