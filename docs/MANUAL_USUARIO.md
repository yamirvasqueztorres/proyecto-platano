# Manual breve de usuario

## Acceso

Ingrese con el usuario asignado. La navegación se adapta automáticamente al rol. En el primer acceso productivo, cambie la contraseña temporal.

## Registrar una inspección

1. Seleccione **Nuevo registro**.
2. Elija uno de los ocho módulos.
3. Complete los campos del paso 1 y continúe al paso 2.
4. Revise alertas y valores calculados.
5. Seleccione **Guardar y enviar**. El estado inicial será **Pendiente**.

Cuando PostgreSQL está conectado, seleccione primero el proveedor y, en la inspección vehicular, el transportista registrado. El formulario completa sus códigos y conserva los identificadores maestros para los reportes y la trazabilidad.

El sistema registra la hora de inicio, finalización, usuario y duración. Los campos con asterisco son obligatorios. Los valores de defectos no pueden ser negativos y los totales deben ser coherentes con la muestra.

## Revisar y firmar

Los roles Coordinador y Administrador pueden entrar a **Validaciones**. Cada tarjeta muestra módulo, inspector, fecha, resultado y alertas.

- **Aprobar y firmar:** crea un código `VAL-...`, fecha, usuario y firma digital verificable.
- **Observar:** devuelve el registro para corrección, con una nota obligatoria en la operación productiva.
- **Rechazar:** cierra la revisión como no aceptada y conserva el historial.

## Consultar registros

En **Registros** se puede buscar por código, módulo o proveedor y filtrar por estado. El botón de vista abre el detalle completo, sus alertas y validaciones. El Revisor puede consultar y exportar, pero no modificar.

## Reportes

En **Reportes**, defina periodo, módulo y proveedor. Excel incluye campos estructurados y el payload completo; PDF presenta el resumen ejecutivo. La exportación no modifica los datos.

## No conformidades y PHVA

En **No conformidades**, registre el módulo, lote, categoría, severidad, cantidad y descripción. Para cerrar una desviación es obligatorio documentar la causa raíz y la disposición.

En **Acciones correctivas (PHVA)**, vincule la no conformidad, asigne responsable y plazo, y complete progresivamente:

1. **Planificar:** problema, causa y acción prevista.
2. **Hacer:** ejecución aplicada.
3. **Verificar:** evidencia del resultado.
4. **Actuar:** estandarización o nuevo ajuste.

Una acción solo puede completarse con resultado de verificación y eficacia porcentual.

## Análisis estadístico SPC

Seleccione módulo y variable. El sistema calcula media, desviación, límites naturales de control LCI/LCS y puntos fuera de control. Cuando se proporcionan límites de especificación, también calcula Cp y Cpk. Un punto fuera de control debe investigarse como causa especial; no significa por sí solo que el lote esté rechazado.

## Trazabilidad de lotes

Cree el lote al recibir materia prima y agregue eventos por etapa: Recepción, Selección, Pelado, Embolsado, Producto terminado y Despacho. Cada evento conserva fecha, usuario, descripción y registro relacionado. Use **Retener** cuando el lote no pueda avanzar y **Liberar** después de la decisión de calidad.

## Alertas

El centro de alertas reúne registros pendientes, no conformidades críticas, acciones próximas a vencer y decisiones de validación. Puede marcar una alerta o todas como leídas sin eliminar el historial que la originó.

## Datos maestros

Administrador y Coordinador pueden mantener proveedores y transportistas. Desactivar un registro maestro no borra su historial: deja de aparecer en nuevas selecciones, pero permanece asociado a las inspecciones anteriores.

## Usuarios, roles y permisos

Solo el Administrador puede crear, editar o desactivar cuentas. Un Administrador no puede desactivar su propia sesión. En **Roles y permisos** se configura la matriz de capacidades; los permisos se verifican nuevamente en la API, incluso si alguien intenta llamar una ruta directamente. El Administrador conserva obligatoriamente la gestión de usuarios y permisos para evitar el bloqueo total del sistema.

## Configuración de calidad

Los límites de °Brix, humedad, temperatura y peso se administran en **Parámetros de calidad**. Cualquier cambio queda auditado con valor anterior, valor nuevo, usuario, fecha e IP. Modifique rangos únicamente con aprobación del responsable de Control de Calidad.

## Perfil y contraseña

Abra el menú de usuario de la barra superior y seleccione **Mi perfil**. Puede actualizar nombre y correo o cambiar la contraseña. La nueva contraseña debe contener al menos diez caracteres.

## Respaldo y recuperación

La instalación Docker ejecuta un respaldo al iniciar y luego cada 24 horas. Compruebe mensualmente que el archivo se pueda restaurar. Mantenga una copia fuera del servidor principal y aplique la política institucional de retención.

## Uso desde tablet o smartphone

Conecte el dispositivo a la misma red que el servidor y abra su URL institucional. El menú se convierte en navegación inferior; los formularios pasan a una sola columna y mantienen tamaños táctiles. No comparta las credenciales del inspector entre personas, porque la trazabilidad depende del usuario real.
