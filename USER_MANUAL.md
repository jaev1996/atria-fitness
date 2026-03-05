# Manual de Usuario - Plataforma Atria Fitness

Bienvenido al sistema de administración de **Atria Fitness**. Esta guía está diseñada para ayudar a administradores y personal de recepción a navegar por las funciones principales de la plataforma, desde la gestión de alumnos hasta la liquidación de instructores.

---

## 📅 1. Gestión del Calendario y Clases

El corazón de la operativa diaria. Aquí programas sesiones y controlas quién asiste.

### Programar una Nueva Clase
1. Dirígete a la sección de **Clases** en el menú principal.
2. Elige la sala en la que deseas programar la clase (cada sala permite inscribir diferentes disciplinas personalizables desde la sección de Ajustes).
3. Haz clic en el botón de **"+"** (selecciona el espacio deseado en la cuadrícula del calendario).
4. Completa la información solicitada:
   - **Instructor:** Selecciona al profesional a cargo.
   - **Fecha y Hora:** Define cuándo inicia y termina.
   - **Disciplina y Capacidad:** Especifica el tipo de clase y el aforo máximo (ej. 15 personas).
   - **Clase Privada:** Marca esta casilla si es una sesión particular.
5. Guarda los cambios. La clase aparecerá inmediatamente en la vista general.
6. Si necesitas reagendar una clase, puedes hacerlo haciendo clic en la clase, cambiando el estado a "Reagendada" y seleccionando la nueva fecha y hora.
7. Si necesitas cancelar una clase, puedes hacerlo haciendo clic en la clase y cambiando el estado a "Cancelada" o directamente a travez del boton "Eliminar clase" (se eliminara la clase del calendario).


![Formulario Nueva Clase](/public/docs/nueva-clase.png)

### Inscribir Alumnos en una Clase (Reservas)
1. En el Calendario, haz clic sobre una clase ya programada.
2. Se abrirá el panel de detalles de la clase. En la sección de **Alumnas Inscritas**, selecciona a una alumna de la lista desplegable.
3. El sistema evaluará automáticamente si la alumna tiene un plan activo y descontará un crédito cuando la clase se de por completada.
4. (Opcional) Puedes marcar la asistencia como "Cortesía" si no deseas deducir créditos en esa ocasión específica.
5. Si una alumna cancela su reserva, puedes eliminarla de la clase para que no le descuenten créditos (siempre y cuando la clase no se haya realizado).

## 👥 2. Gestión de Alumnas

Mantén el control total sobre la información de tus clientes, sus pagos y sus planes activos.

### Registrar una Nueva Alumna
1. Ve a la sección **Alumnas** en el panel lateral.
2. Haz clic en **"Nuevo Alumno"**.
3. Ingresa sus datos personales (Nombre, Email, Teléfono).
4. Es de vital importancia completar la **Información Médica**: Alergias, lesiones, condiciones especiales y contacto de emergencia.
5. Guarda el perfil para activarlo en el sistema.

![Lista de Alumnas](/public/docs/alumnas-list.png)
![Formulario Nueva Alumna](/public/docs/nueva-alumna.png)


### Venta de Planes / Paquetes
Para que un alumno pueda reservar clases, necesita créditos.
1. Entra al perfil del alumno haciendo clic en el icono de ver perfil (ojo).
2. Busca la seccion de **Planes**, haz clic en **"Nuevo Plan"**.
3. Selecciona la disciplina, la cantidad de clases (créditos) compradas.

![Lista de Planes](/public/docs/planes-list.png)
![Formulario Nuevo Plan](/public/docs/nuevo-plan.png)

## 🧘‍♂️ 3. Gestión de Instructores

Administra el personal, sus clases y procesa sus pagos de forma organizada.

### Lista y Perfil de Instructores
1. Accede a **Instructores** desde el menú principal.
2. En esta pantalla verás el listado de todos los instructores registrados en el sistema. Desde esta vista puedes:
   - **Ver Perfil (icono de ojo):** Acceder al detalle completo del instructor, sus clases, estadísticas y pagos.
   - **Editar:** Botones de acción rápida para modificar la información básica del instructor.

### Registrar un Nuevo Instructor
1. Desde la vista principal de Instructores, haz clic en **"Nuevo Instructor"**.
2. Deberás completar un formulario con sus datos básicos:
   - **Nombre completo** y **Teléfono**.
   - **Correo Electrónico:** *¡Vital e indispensable!* Este será el correo con el cual el instructor podrá iniciar sesión y acceder a la plataforma para ver sus clases asignadas.
   - **Especialidades:** Selecciona las disciplinas que este instructor está capacitado para impartir. Esta información es útil al momento de programar clases en el calendario.
   - **Biografía:** Pequeña descripción opcional del perfil del instructor.
3. Al guardar los cambios, el instructor es registrado y el sistema lo habilita para poder agendarse en las distintas disciplinas según sus especialidades.

![Formulario Nuevo Instructor](/public/docs/nuevo-instructor.png)

### Liquidación y Pagos
El sistema facilita calcular cuánto se le debe pagar a un instructor por un periodo de tiempo.
1. Ve al perfil del instructor y selecciona la pestaña **Historial**.
2. Al momento de generar un nuevo pago, el sistema permitirá seleccionar un **Rango de Fechas** (ej. "Del 1 al 15 del mes").
3. La plataforma calculará automáticamente las clases impartidas en ese periodo. Al aprobar, se registrará el pago efectuado.

![Liquidación de Instructores](/public/docs/liquidacion-instructor.png)

---

## ⚙️ 4. Ajustes Generales y Estadísticas

### Tarifas y Configuraciones
1. En la pestaña de **Ajustes (Settings)**, los administradores pueden gestionar variables que afectan a todo el negocio.
2. Configura los **Precios de las disciplinas** y las configuraciones de las salas (qué clase va en qué salón). Esta información es fundamental para los cálculos automáticos del sistema.

### Panel Principal (Dashboard)
Al iniciar sesión, la primera pantalla es el **Dashboard**. Esta pantalla está enfocada en la operativa inmediata del día. Aquí los administradores y el personal de recepción pueden ver de un solo vistazo:
- Las clases programadas para el día de hoy.
- Evaluar el índice de reservas, la ocupación de las salas y prepararse para la afluencia de alumnas en el día.

### Métricas (Stats)
Si necesitas revisar el estado financiero del centro, dirígete a la sección de **Métricas**.
- En esta pestaña es donde podrás hacer un análisis del negocio: ingresos, venta de planes y comparativas mensuales para la toma de decisiones.
