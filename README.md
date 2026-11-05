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

## Inicio rápido para evaluar la prueba

Necesitas **Git**, **Docker Desktop instalado y en ejecución** (o Docker Engine con Compose v2 compatible con `--wait`) y conexión a Internet para descargar las imágenes y dependencias la primera vez. En Windows utiliza contenedores Linux. Mantén libres los puertos locales **8080** y **5432**. No necesitas instalar Node.js, npm ni PostgreSQL en tu equipo.

Ejecuta estos comandos en Terminal (macOS/Linux) o PowerShell (Windows):

```bash
git clone https://github.com/Eddaann/examen-contabilidad.git
cd examen-contabilidad
docker run --rm --mount "type=bind,source=${PWD},target=/workspace" -w /workspace node:24-alpine node scripts/setup-env.cjs
docker compose up --build -d --wait
```

El tercer comando **crea `.env` automáticamente**, con claves y contraseñas aleatorias, diferentes para cada instalación. No imprime secretos ni necesita que el autor comparta sus credenciales. Si `.env` ya existe, lo conserva sin cambios. El cuarto comando construye y arranca los tres servicios; espera a que termine correctamente. La primera ejecución puede tardar varios minutos.

1. Abre [http://localhost:8080](http://localhost:8080).
2. Elige una de las cuentas de la tabla siguiente y abre el archivo `.env` de tu copia con un editor local.
3. Inicia sesión con el correo indicado y el valor de la variable correspondiente como contraseña, sin incluir el nombre de la variable.

### Cuentas para probar la aplicación

Las cuentas se preparan automáticamente al arrancar el backend; no necesitas registrarlas ni ejecutar comandos adicionales.

| Correo de acceso | Contraseña en tu archivo `.env` | Qué puedes probar |
| --- | --- | --- |
| `alumno1@ejemplo.com` | Valor de `TEST_STUDENT_PASSWORD` | Login, examen y consulta del resultado |
| `alumno2@ejemplo.com` | Valor de `TEST_STUDENT_PASSWORD` | Un segundo intento independiente con otro alumno |
| `alumno3@ejemplo.com` | Valor de `TEST_STUDENT_PASSWORD` | Un tercer intento independiente con otro alumno |
| `profesor1@ejemplo.com` | Valor de `TEST_TEACHER_PASSWORD` | Login docente y consultas autorizadas mediante la API; el panel visual está pendiente |

Para revisar el flujo principal, entra con `alumno1@ejemplo.com`, responde las cinco preguntas, pulsa **Finalizar examen** y confirma el envío. Verás la calificación y tus respuestas. Recarga la página o cierra sesión y vuelve a entrar: el resultado debe conservarse. Cada alumno puede enviar el examen una sola vez; utiliza otra cuenta de alumno para repetir la demostración sin borrar datos.

También puedes seleccionar **Crear cuenta** desde el login. Ingresa un correo válido y una contraseña de entre 12 y 128 caracteres, confirma la contraseña y envía el formulario. Al completarse el registro, vuelve al login con el correo precargado y un mensaje de confirmación. Inicia sesión con la contraseña que elegiste. El registro público crea únicamente estudiantes; cada cuenta nueva tiene su propio intento.

**No debes enviar ni subir tu `.env`.** Git lo excluye; `.env.example` y el generador no contienen secretos reales. La contraseña queda disponible únicamente en tu archivo local; no se muestra en la salida del generador. No hace falta obtener o configurar un JWT de usuario: el login lo genera automáticamente.

Para apagar y volver a ejecutar, conservando usuarios y resultados:

```bash
docker compose down
docker compose up -d --wait
```

Si algo impide el arranque:

- **Docker no responde:** abre Docker Desktop y espera a que el motor esté listo. Comprueba `docker info`.
- **Compose no reconoce `--wait`:** actualiza Docker Desktop o el plugin Docker Compose.
- **Puerto ocupado:** cambia `FRONTEND_PORT` o `DB_PUBLISHED_PORT` en `.env` (por ejemplo, `8081` y `5433`) y repite el arranque. Si usas `8081`, abre `http://localhost:8081`. Para desarrollo fuera de Docker, ajusta también `DB_PORT` al puerto publicado.
- **Variables obligatorias vacías:** si ya existía un `.env` incompleto, el generador no lo modifica. Completa sus valores con el procedimiento de generación de secretos de este README.
- **Un servicio no arranca:** consulta `docker compose ps` y `docker compose logs --tail=100 backend frontend db`. No compartas archivos de configuración ni logs sin revisar si contienen información privada.
- **Ya tenías una base de otra versión:** revisa la sección de migraciones antes de arrancar; los scripts de inicialización solo se aplican automáticamente a un volumen vacío. Regenerar contraseñas no actualiza las cuentas ni las credenciales de un volumen existente.

Con estos pasos termina la instalación para evaluar la prueba. Las secciones siguientes documentan la configuración manual, el desarrollo local y el mantenimiento.

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

El inicio rápido ya realiza este paso mediante `scripts/setup-env.cjs`. Si tienes Node.js 24 instalado, también puedes ejecutar `node scripts/setup-env.cjs` desde la raíz. La configuración manual siguiente es una alternativa.

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

En un volumen vacío, PostgreSQL ejecuta siete migraciones y dos seeds, en este orden:

1. Identidad: usuarios, roles y permisos.
2. Exámenes, preguntas y opciones.
3. Intentos y respuestas.
4. Calificación y corrección persistidas.
5. Sesiones y revocación al cambiar contraseña.
6. Contadores de límites de autenticación.
7. Textos históricos de preguntas y opciones.
8. Roles y permisos iniciales.
9. Estudiantes y examen de cinco preguntas con veinte opciones.

Los scripts están en `database/migrations/` y `database/seeds/`. **Reiniciar un volumen existente no vuelve a ejecutarlos.** No hay un gestor incremental de migraciones: aplica solo los archivos pendientes, una vez y en orden, antes de ejecutar el backend actualizado. Por ejemplo, si la base ya tiene las migraciones 001–006:

```bash
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/007_preserve_attempt_texts.sql
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

### Decisión de diseño: una base preparada para crecer

Se decidió que el modelo de datos y el backend contemplaran más alcance que la interfaz solicitada en la prueba. La base separa usuarios, roles y permisos mediante relaciones, y organiza exámenes, preguntas, opciones e intentos por entidades. Esto permite incorporar más exámenes y ampliar los accesos de estudiantes y profesores sin rehacer el modelo central. Las sesiones persistidas y los resultados históricos también forman parte de esa base.

El frontend se mantiene enfocado en lo necesario para presentar la prueba: iniciar sesión, responder el examen una sola vez y consultar la calificación con las respuestas del alumno. El backend ya ofrece consultas de estudiantes y resultados para docentes, pero su panel visual y la administración de usuarios, roles, permisos y exámenes quedan como ampliaciones pendientes. Esta preparación facilita evolucionar las funcionalidades; no implica que se haya validado el rendimiento bajo grandes volúmenes de usuarios.

## Sesiones, permisos y resultados

El acceso utiliza correo y contraseña y crea una cookie HTTP-only `auth_session`, sin guardar el token en `localStorage`. La sesión dura dos horas, persiste en PostgreSQL y se recupera visualmente mediante `/api/auth/me`. Logout revoca la sesión presentada; cambiar la contraseña invalida todas las anteriores.

### Cómo obtener y utilizar el JWT de sesión

El JWT lo genera el backend al iniciar sesión; no se obtiene de un servicio externo ni se crea manualmente. `JWT_SECRET` es la clave privada para firmarlo, no el token de un usuario. Para configurar esa clave utiliza el procedimiento de **Generar secretos locales sin mostrarlos** de este README.

Para obtener una sesión desde el navegador:

1. Abre `http://localhost:8080` e inicia sesión con una cuenta de prueba y la contraseña que configuraste localmente.
2. En las herramientas de desarrollo, abre **Application/Aplicación → Storage/Almacenamiento → Cookies → http://localhost:8080** y busca `auth_session`. Su valor es el JWT. También puedes identificar la cookie en la cabecera `Set-Cookie` de la respuesta a `POST /api/auth/login`, en **Network/Red**.
3. El navegador envía la cookie automáticamente en las peticiones a la API. Para comprobar la sesión, consulta `GET /api/auth/me` desde el mismo origen; no necesitas copiar el token al código del frontend.

En Postman o un cliente equivalente, envía `POST http://localhost:8080/api/auth/login` con un cuerpo JSON que contenga `email` y `password`, utilizando tus credenciales locales. Conserva la cookie `auth_session` del inicio de sesión y envíala en las siguientes peticiones. El login devuelve los datos del usuario en JSON; el JWT se entrega mediante la cookie, no en el cuerpo de la respuesta.

La API actual lee `Cookie: auth_session=<JWT_DE_LA_SESION>`; no acepta el token mediante `Authorization: Bearer`. La cookie es `HttpOnly`, por lo que JavaScript no puede leerla con `document.cookie`. No publiques su valor ni lo guardes en el repositorio, capturas o logs: permite usar esa sesión hasta que expire o sea revocada. Copiar o volver a firmar un JWT no sustituye el registro de sesión que valida el backend en PostgreSQL.

| Operación | Permiso |
| --- | --- |
| Consultar examen | `exam:read` |
| Enviar examen | `exam:submit`, con rol `STUDENT` |
| Consultar estado y resultado propio | `result:read:own`, con rol `STUDENT` |
| Consultar estudiantes | `student:read:all` |
| Consultar resultados generales | `result:read:all` |

Los permisos se comprueban en cada petición. Sin sesión se devuelve 401; sin autorización, 403. Los usuarios no pueden seleccionar un rol privilegiado al registrarse.

Los aciertos, el total y la corrección de cada respuesta se guardan al enviar. Cambiar posteriormente la clave correcta o agregar preguntas no recalifica intentos anteriores. Los enunciados y los textos de las opciones seleccionadas y correctas también se guardan al enviar y se consultan del intento, sin depender de ediciones posteriores. La migración 007 completa los intentos anteriores con los textos disponibles al migrar: no puede recuperar contenido que ya se hubiera modificado. Si una opción correcta histórica ya no existe, conserva su código como texto. La migración 004 reconstruye intentos antiguos con la clave disponible al migrar; no puede recuperar una clave histórica modificada previamente.

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
