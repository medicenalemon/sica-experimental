# Directorio de entidades financieras

SICA incluye la lista de **73 entidades** que devolvió el directorio público del BCRA el **8 de octubre de 2026**. La fuente declara actualización en **julio de 2026**. Incluye bancos y compañías financieras; no representa una consulta en tiempo real ni una comprobación de la aptitud de una entidad para una operación específica. Las denominaciones, algunas abreviadas por la fuente, se conservan tal como se recibieron.

- Página: https://www.bcra.gob.ar/entidades-financieras/
- Consulta pública usada por esa página: https://www.bcra.gob.ar/api/endpoints/entidades-financieras.php?action=list&lang=es
- Respuesta original: `bcra-entidades-2026-10-08.json`.
- SHA-256 de la respuesta: `37d830e03fcf13dd987ec2886769b58724161f513409939550958ea8e0c0093f`.

Las empresas nuevas reciben las 73 entidades con su código BCRA de cinco dígitos. Una base existente conserva su catálogo hasta que un usuario con permiso en **Finanzas → Entidades bancarias** revise y ejecute **Incorporar catálogo**. La vista previa muestra las altas y los registros que se completarán. La operación usa la copia incluida en el programa; no acepta una lista enviada por el navegador ni descarga información mientras modifica la base.

La incorporación busca primero el código normalizado; luego, para registros sin código, la denominación oficial o los nombres iniciales de Nación, Macro y Galicia. Conserva identificadores internos, nombres personalizados, sitios web, entidades históricas y referencias de cuentas y cheques. No genera movimientos, comprobantes ni asientos. Una coincidencia ambigua, un código repetido o un identificador ocupado por otra entidad detiene toda la operación. Las revisiones concurrentes y los reintentos se controlan mediante el mecanismo transaccional del servidor. El historial registra al usuario de la sesión.

El código puede ingresarse con uno a cinco dígitos y se completa con ceros a la izquierda. `285` y `00285` son el mismo código. Una entidad que ya tenga código y esté vinculada a cuentas o cheques conserva esa identidad; su nombre puede editarse. Un registro personalizado puede mantenerse sin código. La validación de copias también rechaza códigos duplicados y nombres o identificadores inválidos.

Los formularios de cuentas y cheques, y el filtro de cartera, permiten buscar por nombre o código sin distinguir mayúsculas ni tildes. Una búsqueda que excluya la opción seleccionada conserva esa selección hasta que el usuario la cambie. El catálogo general también se puede buscar y exportar a XLSX/PDF.

Las futuras versiones del directorio deben verificarse contra la fuente oficial, incorporarse como una nueva copia fechada y revisarse antes de aplicarse en cada empresa. No se borran entidades históricas que desaparezcan de una lista posterior. La elección del banco no sustituye la validación de una CBU ni establece una conexión con esa entidad.

Verificación: cuatro pruebas de dominio cubren copia de origen, códigos estables, conservación de referencias y datos financieros, ambigüedades, permisos, duplicados y protección del código vinculado. Una prueba HTTP verifica la incorporación de una base antigua, el rechazo de listas inyectadas, atribución por sesión, reintento único y permisos. La interfaz se revisó con la empresa textil de prueba.
