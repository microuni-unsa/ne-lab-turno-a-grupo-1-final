Temas de Desarrollo de Aplicación Móvil – Negocios Electrónicos 2026

    • Funciones de cada mantenimiento para cada tabla: Adición, Modificación, Eliminación, Inactivar, Reactivar, Buscar, Cancelar, Guardar, Salir
Por Adición de un nuevo registro al archivo (tabla) se coloca por default  el valor de “A” en el dato Estado de Registro.
    • Todas las tablas tienen el dato: Estado de Registro cuyos valores pueden ser (A=activo, I=Inactivo, *=Eliminado)
    • Las tablas al momento de ser mostradas en la pantalla deben tener un default de ordenamiento y ser mostrado (por código o por Nombre/Descripción)
    • Al trabajar la tabla maestro u otra (transacción) que referencie a una o más tablas; al consultar cada tabla referencial, según sea el dato, al efectuar la consulta, la que se mostrará en otra pantalla los registros (sólo activos, A=Activo) de la tabla en orden alfabético del dato descripción/nombre; y así luego poder seleccionar el registro deseado para cargar el dato (código) en la tabla maestra u otra (transacción); o cancelar la consulta de selección, regresando en ambos casos a la pantalla de la tabla maestra o transacción.

Ejemplo:
Para la tabla Registro en EsSalud se tiene que el dato genero referencia a la tabla Genero (tiene valores masculino y femenino) se consulta, se muestra los registros de la tabla Genero, y selecciona una de las 2 entradas, la entrada seleccionada se carga el valor del código al elemento dato de genero de la tabla Registro de EsSalud.

Opcional:
- Es opcional que puedan ir más allá y mostrar los registros de la tabla maestra u otra en un orden diferente al default; seleccionado otro orden por ejemplo 1) Por código 2) por nombre/descripción.
- Búsqueda de un determinado registro por nombre u otro dato, y poder seleccionarlo para efectuar modificación, inactivar, reactivar o eliminar. 

1
Maestro de Personal		código, nombre, dni, fecha de nacimiento, País, Dependencia, Cargo, Estado de Registro
Países				código, nombre, Estado de Registro
Dependencia			código, nombre, Estado de Registro – (Sistemas, Contabilidad, Almacen)
Cargos				código, nombre, Estado de Registro
