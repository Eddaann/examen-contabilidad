# Examen de Contabilidad

Aplicación en desarrollo para responder un examen y consultar el resultado de un único intento por estudiante y examen.

## Inicio con Docker

Requisitos: Git y Docker con Docker Compose v2 (incluido en Docker Desktop). No necesitas instalar Node.js ni PostgreSQL en tu equipo.

Después de clonar el repositorio, copia `.env.example` a `.env` y sustituye el valor de ejemplo de `JWT_SECRET` por una clave privada aleatoria. Configura también `TEST_STUDENT_PASSWORD` y `TEST_TEACHER_PASSWORD` con valores privados de entre 12 y 128 caracteres. No la publiques ni la incluyas en Git. Después ejecuta desde la raíz:

```bash
docker compose up --build -d --wait
```

Abre http://localhost:8080. Compose construye el backend y el frontend, prepara PostgreSQL y espera a que los servicios estén disponibles. Las credenciales de PostgreSQL tienen valores locales predeterminados; `JWT_SECRET` es obligatoria y Compose detiene el arranque si falta o está vacía.

El frontend contiene únicamente la estructura mínima de React, sin interfaz (la página se muestra en blanco). La API implementa acceso con correo y contraseña, consulta y envío del examen, resultados y consultas de profesores protegidas por permisos.

- Frontend: http://localhost:8080
- API: http://localhost:8080/api/health
- Base de datos desde la API: http://localhost:8080/api/health/db
- PostgreSQL desde tu equipo: `localhost:5432`

En una instalación nueva, las credenciales locales predeterminadas son usuario `examen`, contraseña `examen_local` y base `examen_contabilidad`. Son exclusivamente para desarrollo local.

### Configuración

Además de configurar `JWT_SECRET` en `.env`, puedes ajustar puertos o credenciales antes del primer arranque. Si ya tienes un `.env`, Compose utiliza sus valores. `DB_HOST` y `DB_PORT` solo configuran la ejecución del backend fuera de Docker: dentro de Compose utiliza `db:5432`.

Cambiar las credenciales del archivo no cambia las de una base ya inicializada. Para un volumen existente, utiliza sus credenciales actuales.

### Comandos habituales

```bash
# Estado de los tres servicios
docker compose ps

# Registros
docker compose logs -f

# Apagar y conservar los datos
docker compose down

# Iniciar de nuevo o reconstruir tras cambiar código
docker compose up --build -d --wait

# Abrir PostgreSQL
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Para borrar completamente la base local y volver a cargar los datos iniciales, ejecuta `docker compose down -v` y después el comando de inicio. **Esto elimina todos los intentos y datos del volumen del proyecto.**

## Base de datos

PostgreSQL ejecuta los seis SQL de `database/migrations/` y después los dos de `database/seeds/`, en orden, al inicializar un volumen vacío. Se crean las tablas, roles, permisos, tres estudiantes y el examen con sus cinco preguntas y veinte opciones.

Cuentas de prueba:

- `alumno1@ejemplo.com`
- `alumno2@ejemplo.com`
- `alumno3@ejemplo.com`
- `profesor1@ejemplo.com` (rol `TEACHER`)

El backend prepara estas cuentas automáticamente antes de iniciar en Docker. Los alumnos utilizan el valor privado de `TEST_STUDENT_PASSWORD` y el profesor el de `TEST_TEACHER_PASSWORD`, definidos en `.env`. Las contraseñas no se incluyen en el repositorio ni se imprimen; en PostgreSQL solo se guardan hashes Argon2id. La carga puede repetirse y no reemplaza contraseñas ya configuradas ni borra intentos. Solo asigna el rol inicial a las cuentas que crea; no restaura roles retirados ni modifica los de cuentas existentes. Para los alumnos iniciales del SQL sin contraseña, únicamente configura su contraseña inicial y conserva sus roles. Cambiar estas variables no cambia contraseñas existentes.

En una base existente con las tablas y roles creados, puedes cargar las cuentas desde `backend/` con `npm run seed:users`. El arranque local con `npm run dev` no ejecuta esa carga automáticamente.

El único acceso es `POST /api/auth/login` con un cuerpo JSON que contenga `email` y `password`. La sesión se guarda en la cookie HTTP-only `auth_session`. Ya no existe `/api/students/access` y las sesiones anteriores de demostración se rechazan. Las consultas del examen también requieren sesión. El registro público crea únicamente estudiantes; no permite elegir rol de profesor.

Por decisión del proyecto, todos los usuarios entran con correo y contraseña, aunque el enunciado original solicita entrada únicamente por correo. La interfaz del examen sigue pendiente.

Los scripts de inicialización no se repiten al reiniciar ni se aplican sobre volúmenes existentes. Si agregas migraciones durante el desarrollo, debes aplicarlas explícitamente a la base existente; este proyecto aún no tiene un gestor incremental de migraciones.

## Tecnologías y estructura

- PostgreSQL 17: persistencia y restricciones de integridad.
- Node.js 24 LTS, TypeScript y Express: backend compilado en una imagen de varias etapas, ejecutado con usuario sin privilegios.
- React + TypeScript y Vite: compilación del frontend. Nginx sirve el resultado y redirige `/api/` al backend por la red interna de Docker.
- Docker Compose: tres servicios (`db`, `backend`, `frontend`), comprobaciones de salud y volumen persistente.

`backend/src/` contiene la configuración, aplicación y las carpetas previstas para rutas, controladores, servicios y repositorios. `database/` contiene las migraciones y datos iniciales. `frontend/src/` contiene el punto de entrada de React y un componente App vacío. Su Dockerfile ya compila la aplicación con Vite y sirve `dist/` mediante Nginx; la interfaz del examen queda pendiente. Los recursos estáticos pueden colocarse en `frontend/public/`.

El navegador llama a `/api` en el mismo origen del frontend. El backend se conecta a `db:5432`; el backend no publica un puerto directamente en el equipo. Los puertos publicados del frontend y PostgreSQL solo escuchan en la interfaz local.

## Backend sin Docker

Con Node.js 24 y una base preparada, copia `.env.example` a `.env` y configura sus credenciales. Desde `backend/`:

```bash
npm ci
npm run dev
```

Para compilar y ejecutar:

```bash
npm run build
npm start
```

## Frontend sin Docker

Con Node.js 24, desde `frontend/`:

```bash
npm ci
npm run dev
```

Vite indica la URL local y redirige `/api` a `http://localhost:3000`, donde debe estar ejecutándose el backend. Para comprobar la compilación: `npm run build`.

## Comprobación de autenticación

Desde `backend/`, ejecuta `npm run test:integration`. Requiere PostgreSQL accesible con las credenciales de `.env` y permiso para crear una base temporal. La prueba crea y elimina su propia base sin modificar la del proyecto; comprueba la carga repetible de cuentas, rechazo del acceso por correo sin contraseña y sesiones antiguas, acceso de alumnos y profesores, envío único y recuperación del resultado.

## Permisos del examen

Los permisos se consultan en la base en cada petición; retirarlos tiene efecto sobre sesiones ya iniciadas.

| Operación | Requisito |
| --- | --- |
| `GET /api/exams/:examId` | Sesión y `exam:read` |
| `POST /api/exams/:examId/submit` | Sesión de estudiante y `exam:submit` |
| `GET /api/students/me/exams/:examId/status` | Sesión de estudiante y `result:read:own` |
| `GET /api/students/me/exams/:examId/result` | Sesión de estudiante y `result:read:own` |

El identificador del estudiante procede de su sesión. Una petición sin sesión recibe 401; una sesión sin el permiso requerido recibe 403. Los permisos de profesor siguen siendo `student:read:all` y `result:read:all`; no conceden por sí solos acceso a contestar o consultar el examen. Las pruebas de integración comprueban la revocación y restitución de los tres permisos de estudiante sin volver a iniciar sesión y verifican que un envío rechazado no registre intentos ni respuestas.

## Conservación de resultados históricos

Al enviar se guardan `score` y `total_questions` en `exam_attempts`, y la opción correcta original (`correct_option_code`) y su evaluación (`is_correct`) en cada `attempt_answers`, junto con la opción elegida. El cálculo y guardado usan una sola transacción y una vista consistente de los datos. Los resultados de alumnos y profesores leen los valores guardados; cambiar la clave o agregar preguntas no recalifica intentos anteriores. Los siguientes envíos usan el examen vigente.

La migración `database/migrations/004_preserve_attempt_results.sql` se ejecuta automáticamente al crear un volumen nuevo. En una instalación existente, aplícala una sola vez antes de iniciar la versión nueva del backend, desde la raíz:

```bash
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/004_preserve_attempt_results.sql
```

La migración conserva intentos y respuestas existentes y reconstruye su corrección con la clave disponible al migrar. No puede recuperar una clave histórica que ya haya sido modificada. Si faltan respuestas correctas para reconstruir los datos, la migración falla y revierte sus cambios. La base local de esta revisión ya fue migrada.

Las pruebas de integración cubren la migración de un intento previo con respuestas correctas e incorrectas, la conservación del resultado del estudiante y profesor tras editar la clave y agregar una pregunta, y el cálculo de envíos nuevos con la configuración actualizada.

## Revocación de sesiones

Cada login crea una sesión independiente en `auth_sessions` y un JWT con identificador aleatorio (`jti`), válido durante dos horas. La base no almacena el JWT ni contraseñas de sesión. Cada petición protegida comprueba firma, expiración, dueño, existencia de la sesión y versión vigente del usuario.

`POST /api/auth/logout` elimina la sesión del servidor y la cookie del navegador. Reutilizar una copia del token devuelve 401. Cerrar una sesión no cierra las demás del usuario; cambiar `users.password_hash` incrementa automáticamente `session_version` mediante un trigger de PostgreSQL e invalida todas las anteriores. No se añadió un endpoint para cambiar contraseñas en este cambio. Los roles y permisos se siguen consultando en la base en cada petición.

La migración `005_create_auth_sessions.sql` se aplica automáticamente al crear una base nueva. En una instalación existente, ejecútala una sola vez antes de iniciar el backend actualizado:

```bash
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/005_create_auth_sessions.sql
```

La base local ya fue migrada. Los JWT emitidos antes de este cambio dejan de autorizar: debes iniciar sesión de nuevo. Las sesiones vencidas se rechazan aunque sus registros sigan en la tabla.

## Límites de login y registro

Se verifican antes del controlador y de Argon2. Se cuentan todas las solicitudes que llegan a esos endpoints, incluidas las exitosas y las dirigidas a cuentas inexistentes. El correo se normaliza con espacios externos eliminados y minúsculas. Las solicitudes bloqueadas reciben 429 en JSON con un mensaje genérico y `Retry-After`, sin revelar si la cuenta existe.

| Ruta | Por IP | Por cuenta | Ventana |
| --- | --- | --- | --- |
| `/api/auth/login` | 30 | 10 | 15 minutos |
| `/api/auth/register` | 10 | 3 | 1 hora |

Los contadores son atómicos y se guardan en PostgreSQL para conservarse tras reinicios y compartirse entre instancias. Se almacenan identificadores HMAC usando `JWT_SECRET`, sin correos, IP, cuerpos ni contraseñas en claro. Rotar esa clave cambia los identificadores de los contadores. Si la base falla, se rechaza la operación con un error genérico y no se ejecuta el controlador. Los contadores vencidos se reinician al recibir una nueva solicitud; sus registros pueden limpiarse con `DELETE FROM auth_rate_limits WHERE expires_at <= NOW()`.

En Docker, Nginx reemplaza `X-Forwarded-For` con la IP que observa y el backend confía en un único salto mediante `TRUST_PROXY=1`. El puerto del backend no se publica. En ejecución directa, `TRUST_PROXY=0` (valor predeterminado) ignora las cabeceras enviadas por el cliente. IPv6 se agrupa por subred /56 para evitar eludir el límite rotando direcciones de esa subred.

La migración `006_create_auth_rate_limits.sql` se aplica automáticamente en una base nueva. En una instalación existente, ejecútala una sola vez antes de actualizar el backend:

```bash
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/006_create_auth_rate_limits.sql
```

La base local ya fue migrada. Las pruebas comprueban límites por IP y cuenta, normalización, concurrencia, persistencia entre instancias, recuperación al vencer la ventana, IPv6, cabeceras falsificadas en ejecución directa y ausencia de datos de petición en logs.
