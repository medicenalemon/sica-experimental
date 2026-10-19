# Combos de mercadería

El catálogo de combos y su carga masiva corresponden al PPTX, especialmente a la diapositiva 81. El precio neto, su distribución y la conservación de los componentes en los comprobantes son decisiones de implementación que completan ese requisito.

## Cargar y utilizar

En Productos y servicios → Combos, ingresar un nombre, los componentes y el precio neto en pesos. Por ejemplo:

```text
Nombre: Combo textil
Componentes: REM-M-NEG:2, PANT-42-AZ:1
Precio: 50000.01
```

Cada componente debe identificar un SKU existente de tipo Producto. Las cantidades pueden ser decimales con punto y deben ser positivas. No se admiten SKU repetidos, servicios, combos anidados ni nombres duplicados sin distinguir mayúsculas. El precio admite hasta dos decimales. Para cambiar el SKU o convertir en servicio un producto utilizado por un combo, primero actualizar sus componentes.

En un pedido, remito o factura de venta nuevo, seleccionar el cliente, el combo y su cantidad entera. «Agregar combo» incorpora sus productos al detalle. Los artículos repetidos se agrupan si coinciden la unidad y la alícuota. Un remito generado desde un pedido o una factura generada desde un remito usan las líneas pendientes de ese origen; allí el selector de combos no agrega otras mercaderías.

Importaciones → Combos ofrece un modelo XLSX con Nombre, Componentes y Precio. La vista previa valida las referencias y nombres; las filas inválidas se rechazan y las válidas pueden incorporarse. El precio de este catálogo se conserva en pesos, compatible con los datos anteriores; los importes de los comprobantes se calculan en centavos.

## Precio, descuentos e IVA

El precio del combo es neto, antes del IVA y del descuento del cliente. Es un precio pactado del combo y no recibe el ajuste ni los precios particulares de una lista. Se reparte proporcionalmente a los precios netos de catálogo de sus componentes, asignando los centavos restantes en un orden determinista. Si todos los precios de referencia son cero y el combo tiene precio positivo, se exige corregir el catálogo.

Se distribuye primero el precio de un combo y luego se multiplica por la cantidad. El descuento del cliente reduce el total neto y se distribuye entre las líneas. Para conservar los importes asignados, las líneas mantienen precios unitarios en centavos y un descuento calculado con precisión completa; el detalle muestra ese porcentaje redondeado a seis decimales. La observación del documento registra el combo, su cantidad, precio y descuento.

Cada SKU conserva su propia alícuota. La clase A agrega IVA; la B lo incluye en el precio y conserva el neto al convertir las líneas; C y X no calculan IVA según las reglas internas existentes. Las entregas parciales se calculan por línea y pueden introducir diferencias de un centavo al fraccionar importes. Estos cálculos no confieren validez fiscal al documento.

## Stock y conservación

El combo se desglosa en productos cuando se agrega al borrador. No tiene existencias propias. Guardar el pedido conserva las cantidades y precios; editar luego el catálogo no recalcula esos documentos.

Solo el remito descuenta las existencias de sus componentes en el depósito elegido. Se comprueba la disponibilidad de todas las líneas antes de generar cualquier movimiento; si una falla, ninguna se descuenta. La factura vinculada genera deuda y contabilidad sin mover otra vez el stock. Se conserva la opción de stock negativo por producto.

## Verificación y alcance

Las pruebas cubren referencias inválidas, nombres repetidos, cantidades, precio, alícuotas mixtas, distribución a centavos, descuento, agrupación de SKU, conversión A/B, importaciones, entregas parciales y rechazo completo ante un faltante. Las pruebas HTTP comprueban la validación del servidor y que el usuario autorizado para ventas pueda consultar el catálogo sin obtener permiso para modificarlo.

En la base temporal del servidor se guardó «Combo textil de prueba» con dos remeras y un pantalón, a $50.000,01 netos. Un pedido de dos combos y su remito conservaron $100.000,02: cuatro remeras y dos pantalones. El inventario pasó de 40 a 36 remeras y de 20 a 18 pantalones. Son mercaderías y movimientos ficticios, sin envío real.

Quedan fuera de este comportamiento el ensamblado de kits, existencias de combos prearmados, combos anidados y sincronización de un SKU comercial de combo con e-commerce. Producción conserva su circuito independiente.
