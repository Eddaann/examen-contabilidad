# Examen de Contabilidad

Muestra práctica para el puesto de Diseñador Programador. Aplicación web para responder un examen de cinco preguntas, registrar un único intento por estudiante y consultar la calificación y las respuestas al volver a entrar.

El frontend incluye login, recuperación de sesión al recargar, examen con confirmación de envío y resultados con preguntas, respuestas elegidas y corrección. La vista del examen tiene scroll interno y header siempre visible, con diseño adaptable a móvil, tablet y escritorio.

## Tecnologías

| Capa | Tecnologías |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7 y Sass |
| Backend | Node.js 24, TypeScript, Express 5 y PostgreSQL mediante `pg` |
| Autenticación | Argon2id, JWT en cookie HTTP-only y sesiones persistidas |
| Base de datos | PostgreSQL 17 |
| Contenedores | Docker Compose, imágenes de Node.js y Nginx |
| Pruebas | Node Test Runner; comprobaciones visuales con Playwright |

## Requisitos

Para ejecutar todo en contenedores necesitas Git y Docker con Docker Compose v2 o superior que admita `--wait`. Docker Desktop incluye Compose. No necesitas instalar Node.js ni PostgreSQL en tu equipo para esta modalidad.

Para desarrollar fuera de los contenedores necesitas además **Node.js 24.x con npm**. La compilación y las pruebas se han ejecutado con **Node.js 24.16.0**. Los Dockerfiles utilizan `node:24-alpine`.

## Instalación y configuración

Los siguientes comandos se ejecutan desde la raíz del repositorio, salvo que se indique otra carpeta.

### 1. Descargar el proyecto

```bash
git clone https://github.com/Eddaann/examen-contabilidad.git
cd examen-contabilidad
```

### 2. Preparar las variables de entorno

En una instalación nueva:

```bash
cp .env.example .env
```

Si ya tienes `.env`, conserva ese archivo. Edítalo localmente y configura:

| Variable | Configuración |
| --- | --- |
| `JWT_SECRET` | Reemplazar el texto de ejemplo por una clave privada aleatoria, de al menos 32 bytes de entropía |
| `TEST_STUDENT_PASSWORD` | Contraseña privada de entre 12 y 128 caracteres para los alumnos de prueba |
| `TEST_TEACHER_PASSWORD` | Contraseña privada de entre 12 y 128 caracteres para el profesor de prueba |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credenciales y nombre de la base; deben coincidir con el volumen si ya existe |
| `DB_PUBLISHED_PORT` | Puerto local de PostgreSQL; predeterminado `5432` |
| `FRONTEND_PORT` | Puerto de la web en Docker; predeterminado `8080` |
| `DB_HOST`, `DB_PORT` | Para Node fuera de Docker: `localhost` y el puerto publicado de PostgreSQL |
| `PORT` | Backend local: `3000`, que es el destino configurado en el proxy de Vite |
| `TRUST_PROXY` | Para Node directo: `0`. Compose configura `1` para su único proxy Nginx |

`.env` es obligatorio para los secretos de esta configuración y está excluido de Git. No publiques sus valores. Compose detiene el arranque si faltan `JWT_SECRET` o las contraseñas de prueba. Los valores predeterminados de PostgreSQL son para desarrollo local.

### 3. Comprobar el identificador del examen

El frontend utiliza `EXAM_ID = "1"` en `frontend/src/api/exam.api.ts`, que coincide con el examen creado por los seeds en una base nueva. Para una base existente con otro ID, ajusta esa constante antes de construir el frontend.

Para una base existente, puedes consultar el ID después de iniciar PostgreSQL:

```bash
docker compose up -d --wait db
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, title, is_active FROM exams ORDER BY id;"'
```

## Ejecución con Docker

Una vez configurado `.env` y el ID del examen:

```bash
docker compose config --quiet
docker compose up --build -d --wait
```

En el primer arranque se descargan las imágenes, se instalan dependencias, se compilan ambas aplicaciones y se prepara la base de datos. El backend espera a PostgreSQL y el frontend espera a que la API esté disponible.

Abre [http://localhost:8080](http://localhost:8080), o el puerto que hayas definido en `FRONTEND_PORT`.

| Servicio | Responsabilidad | Acceso desde el equipo |
| --- | --- | --- |
| `db` | PostgreSQL y volumen persistente | `localhost:5432` o `DB_PUBLISHED_PORT` |
| `backend` | API, sesiones, permisos y calificación | Mediante `/api` en el frontend; no publica un puerto propio |
| `frontend` | React compilado, servido por Nginx | `http://localhost:8080` o `FRONTEND_PORT` |

Nginx redirige `/api/` al backend. El backend se conecta a `db:5432` dentro de la red de Compose. Los puertos publicados solo escuchan en `127.0.0.1`.

### Verificar el arranque

```bash
docker compose ps
curl --fail http://localhost:8080/api/health
curl --fail http://localhost:8080/api/health/db
```

Sustituye `8080` si cambiaste el puerto del frontend. Los dos endpoints deben responder con HTTP 200. `/api/health/db` comprueba la conexión con PostgreSQL. Antes de escuchar peticiones, el backend valida las tablas y columnas requeridas; si faltan, termina con código 1 e indica qué tabla revisar y que deben aplicarse las migraciones pendientes. Esta validación no ejecuta migraciones ni comprueba todos los índices, restricciones o triggers.

### Apagar, reiniciar y actualizar

```bash
# Apagar conservando la base de datos
docker compose down

# Levantar de nuevo
docker compose up -d --wait

# Reconstruir después de cambiar código
docker compose up --build -d --wait

# Consultar registros de los servicios
docker compose logs -f backend frontend
```

Las imágenes de Docker sirven una compilación. Los cambios de código requieren reconstruirlas; para recarga automática utiliza la modalidad de desarrollo local.

## Desarrollo local con PostgreSQL en Docker

Completa primero la configuración anterior. Si prefieres un PostgreSQL 17 instalado por tu cuenta, prepara la base con las mismas migraciones y seeds en orden y ajusta sus credenciales en `.env`.

### 1. Iniciar y preparar la base

```bash
docker compose up -d --wait db
npm ci --prefix backend
npm run seed:users --prefix backend
```

En `.env`, `DB_HOST=localhost` y `DB_PORT` debe coincidir con `DB_PUBLISHED_PORT`. Las tablas y datos SQL se cargan automáticamente únicamente si el volumen está vacío. `seed:users` necesita que esas tablas y roles ya existan.

### 2. Iniciar el backend

En una terminal desde la raíz:

```bash
npm run dev --prefix backend
```

La API queda disponible en [http://localhost:3000](http://localhost:3000). `tsx watch` reinicia el servidor cuando cambia su código.

### 3. Iniciar el frontend

En otra terminal desde la raíz:

```bash
npm ci --prefix frontend
npm run dev --prefix frontend
```

Abre la URL que indique Vite, normalmente [http://localhost:5173](http://localhost:5173). Su proxy envía `/api` a `http://localhost:3000`; el backend local debe estar ejecutándose. Si modificas ese puerto, actualiza también `frontend/vite.config.ts`.

Usa `Ctrl+C` en cada terminal para detener los servidores.

### Compilar y ejecutar el backend sin modo watch

```bash
npm run build --prefix backend
npm start --prefix backend
```

Para comprobar la compilación del frontend y previsualizarla:

```bash
npm run build --prefix frontend
npm run preview --prefix frontend
```

`preview` sirve los archivos compilados; no sustituye el despliegue de Nginx. Para comprobar autenticación y examen en desarrollo, utiliza `npm run dev` con el backend local.

## Credenciales de prueba y configuración segura

| Correo | Rol | Contraseña configurada en |
| --- | --- | --- |
| `alumno1@ejemplo.com` | `STUDENT` | `TEST_STUDENT_PASSWORD` de tu `.env` |
| `alumno2@ejemplo.com` | `STUDENT` | `TEST_STUDENT_PASSWORD` de tu `.env` |
| `alumno3@ejemplo.com` | `STUDENT` | `TEST_STUDENT_PASSWORD` de tu `.env` |
| `profesor1@ejemplo.com` | `TEACHER` | `TEST_TEACHER_PASSWORD` de tu `.env` |

En Docker, el backend prepara las cuentas antes de iniciar. En desarrollo local se ejecuta `npm run seed:users --prefix backend` explícitamente. La carga conserva contraseñas configuradas, intentos y roles existentes; no restaura roles retirados. Para los alumnos iniciales del SQL sin contraseña, configura únicamente su contraseña inicial.

Cambiar las variables de prueba no cambia las contraseñas de cuentas ya creadas. La base solo almacena hashes Argon2id. El registro público crea únicamente estudiantes.

### Generar secretos locales sin mostrarlos

Después de copiar `.env.example` a `.env`, puedes ejecutar lo siguiente desde la raíz con Node.js 24 en Bash o zsh. Solo completa valores vacíos: conserva cualquier secreto que ya hayas configurado y no imprime contraseñas ni claves.

```bash
node <<'NODE'
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const file = '.env';
let text = fs.readFileSync(file, 'utf8');
for (const [key, bytes] of [
  ['JWT_SECRET', 32],
  ['TEST_STUDENT_PASSWORD', 24],
  ['TEST_TEACHER_PASSWORD', 24],
]) {
  const pattern = new RegExp('^' + key + '=.*$', 'm');
  const line = text.match(pattern)?.[0];
  const value = line?.slice(key.length + 1).trim();
  if (line && value && value !== '""' && value !== "''") continue;
  const replacement = key + '=' + randomBytes(bytes).toString('hex');
  text = line ? text.replace(pattern, replacement) : text + '\n' + replacement + '\n';
}
fs.writeFileSync(file, text, { mode: 0o600 });
fs.chmodSync(file, 0o600);
console.log('Secretos locales preparados. Valores ocultos.');
NODE
```

Para usar las cuentas, consulta los valores únicamente en tu editor local: los tres alumnos comparten el valor de `TEST_STUDENT_PASSWORD` y el profesor usa `TEST_TEACHER_PASSWORD`. Genera estos valores **antes de crear las cuentas**. El comando no cambia las contraseñas que ya estén guardadas en PostgreSQL.

Quien clone el repositorio debe configurar sus propios secretos; no necesita recibir tu `.env`. Si compartes una instancia ya preparada con una persona evaluadora, entrega las credenciales por un canal privado, sin publicarlas en el README, capturas, logs o historial de Git. No compartas `JWT_SECRET` como credencial de acceso.

Los valores de PostgreSQL incluidos como ejemplo son exclusivamente para desarrollo local y no son credenciales de un servicio externo. No reutilices contraseñas personales o de producción. `.env.example` mantiene vacíos los secretos de firma y de las cuentas de prueba; `.env` está ignorado y no debe añadirse con `git add -f`.


El profesor puede autenticarse y acceder a los endpoints autorizados de consulta; su panel web está pendiente.

## Base de datos y migraciones

En un volumen vacío, PostgreSQL ejecuta seis migraciones y dos seeds, en este orden:

1. Identidad: usuarios, roles y permisos.
2. Exámenes, preguntas y opciones.
3. Intentos y respuestas.
4. Calificación y corrección persistidas.
5. Sesiones y revocación al cambiar contraseña.
6. Contadores de límites de autenticación.
7. Roles y permisos iniciales.
8. Estudiantes y examen de cinco preguntas con veinte opciones.

Los scripts están en `database/migrations/` y `database/seeds/`. **Reiniciar un volumen existente no vuelve a ejecutarlos.** No hay un gestor incremental de migraciones: aplica solo los archivos pendientes, una vez y en orden, antes de ejecutar el backend actualizado. Por ejemplo, si la base ya tiene las migraciones 001–005:

```bash
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/006_create_auth_rate_limits.sql
```

No ejecutes de nuevo todas las migraciones sobre una base ya preparada. Modificar las credenciales en `.env` tampoco modifica las de un volumen existente.

### Reiniciar completamente los datos de desarrollo

**Este procedimiento borra todas las cuentas, intentos, sesiones y demás datos del volumen del proyecto.**

```bash
docker compose down -v
docker compose up --build -d --wait
```

En una base nueva el ID del examen vuelve a ser `1`; si habías cambiado `EXAM_ID`, restablécelo a `"1"` antes de reconstruir. Si solo necesitas liberar los intentos de alumnos de prueba, no es necesario borrar el volumen completo.

## Pruebas

Desde la raíz:

```bash
# Frontend: cliente API y tratamiento de errores
npm test --prefix frontend

# Backend: autenticación, permisos, sesiones, resultados y límites
npm run test:integration --prefix backend

# Solo manejo seguro de errores del backend
npm run test:errors --prefix backend

# Comprobar ambas compilaciones
npm run build --prefix backend
npm run build --prefix frontend
```

Ejecuta `npm ci` en cada carpeta antes de sus pruebas. La integración del backend requiere un PostgreSQL accesible con las credenciales de `.env` y permiso para crear bases temporales. Crea y elimina sus propias bases; no utiliza los intentos de la base del proyecto.

Los archivos de Playwright, reportes y capturas generadas están excluidos de Git. Las comprobaciones visuales realizadas no constituyen todavía una suite E2E automatizada del proyecto.

## Estructura y arquitectura

```text
backend/
  src/
    config/          Conexión con PostgreSQL
    controllers/     Entrada HTTP y respuestas
    middlewares/     Sesión, permisos, límites y errores seguros
    repositories/    Consultas SQL y persistencia
    routes/          Endpoints y controles de acceso
    scripts/         Carga de cuentas de prueba
    services/        Reglas del examen y autenticación
  tests/             Pruebas de integración y errores
frontend/
  src/
    api/             Cliente HTTP y validación de respuestas
    components/      Button, AppHeader, ConfirmDialog y ErrorBoundary
    pages/           Login, examen, resultados y coordinación del flujo
    styles/          Variables Sass y estilos globales
    types/           Tipos de examen y resultados
  tests/             Pruebas del cliente API
  nginx.conf         Servidor web y proxy de la API
database/            Migraciones y seeds SQL
compose.yaml         Servicios db, backend y frontend
.env.example         Variables de configuración sin secretos reales
```

El frontend consulta el estado del intento antes de mostrar el examen. Al enviar, el servidor valida las respuestas y guarda intento, respuestas, corrección y calificación en una transacción. La clave primaria por estudiante y examen impide repetir el intento, también ante envíos simultáneos.

## Sesiones, permisos y resultados

El acceso utiliza correo y contraseña y crea una cookie HTTP-only `auth_session`, sin guardar el token en `localStorage`. La sesión dura dos horas, persiste en PostgreSQL y se recupera visualmente mediante `/api/auth/me`. Logout revoca la sesión presentada; cambiar la contraseña invalida todas las anteriores.

| Operación | Permiso |
| --- | --- |
| Consultar examen | `exam:read` |
| Enviar examen | `exam:submit`, con rol `STUDENT` |
| Consultar estado y resultado propio | `result:read:own`, con rol `STUDENT` |
| Consultar estudiantes | `student:read:all` |
| Consultar resultados generales | `result:read:all` |

Los permisos se comprueban en cada petición. Sin sesión se devuelve 401; sin autorización, 403. Los usuarios no pueden seleccionar un rol privilegiado al registrarse.

Los aciertos, el total y la corrección de cada respuesta se guardan al enviar. Cambiar posteriormente la clave correcta o agregar preguntas no recalifica intentos anteriores. Los textos que acompañan el resultado se consultan de las preguntas y opciones existentes. La migración 004 reconstruye intentos antiguos con la clave disponible al migrar; no puede recuperar una clave histórica modificada previamente.

Login y registro tienen estos límites, persistidos por IP y cuenta:

| Ruta | Por IP | Por cuenta | Ventana |
| --- | --- | --- | --- |
| Login | 30 | 10 | 15 minutos |
| Registro | 10 | 3 | 1 hora |

Se cuentan también las solicitudes exitosas. Logout no reinicia los contadores. Al superar el límite se devuelve 429 y `Retry-After`; al vencer la ventana puede iniciarse otra. Se guardan identificadores HMAC, sin correos o IP en claro. Los errores de la API no registran cuerpos, contraseñas ni objetos de error completos.

## Supuestos, alcance y pendientes

- Por decisión del proyecto, se utiliza correo y contraseña, aunque el enunciado original propone acceso solo por correo.
- Se interpreta un intento por estudiante y examen. La calificación se presenta como aciertos sobre total, por ejemplo `4/5`.
- El examen se selecciona mediante la constante `EXAM_ID`, fijada en `"1"`; no existe todavía un catálogo de exámenes.
- Roles y permisos permiten ampliar el proyecto; la administración visual de usuarios y permisos, el panel de profesores y la integración LTI quedan pendientes.
- No hay interfaz para cambiar contraseñas ni gestor incremental de migraciones.

Con más tiempo: añadir el panel de profesores, configurar la selección del examen sin editar código, automatizar migraciones y pruebas E2E, y ampliar la gestión de usuarios y mantenimiento de sesiones y contadores vencidos.

## Uso de IA

Se utilizó asistencia de IA mediante Codex para revisar y desarrollar partes del backend y frontend, configurar Docker, añadir pruebas y preparar documentación.
