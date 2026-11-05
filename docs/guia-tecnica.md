# Guía técnica

Para instalar y probar la aplicación, sigue el [inicio rápido del README](../README.md#inicio-rápido-para-evaluar-la-prueba). Esta guía es para configurar, desarrollar y mantener el proyecto. Todos los comandos se ejecutan desde la raíz del repositorio.

## Configuración opcional

El inicio rápido utiliza valores adecuados para una instalación local nueva. Solo necesitas editar `.env` si quieres cambiar puertos o reutilizar una base existente.

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

El generador también puede ejecutarse con `node scripts/setup-env.cjs` si ya tienes Node.js 24 instalado. Si prefieres configurar todo manualmente, copia `.env.example` a `.env` y completa los secretos de la tabla antes de arrancar. Usa una clave aleatoria de al menos 32 bytes para `JWT_SECRET` y contraseñas privadas de entre 12 y 128 caracteres para las cuentas de prueba. Compose rechaza el arranque si faltan estos valores.

La carga de cuentas conserva las contraseñas, los roles y los intentos existentes. Cambiar `TEST_STUDENT_PASSWORD` o `TEST_TEACHER_PASSWORD` no cambia las contraseñas que ya están guardadas en PostgreSQL.

### Selección del examen en una base existente

El frontend utiliza `EXAM_ID = "1"` en `frontend/src/api/exam.api.ts`, que coincide con el examen creado por los seeds en una base nueva. Para una base existente con otro ID, ajusta esa constante antes de construir el frontend.

Para una base existente, puedes consultar el ID después de iniciar PostgreSQL:

```bash
docker compose up -d --wait db
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, title, is_active FROM exams ORDER BY id;"'
```

## Desarrollo local con PostgreSQL en Docker

Esta modalidad es opcional. Requiere **Node.js 24.x con npm**, además de Docker para PostgreSQL. Prepara `.env` siguiendo el inicio rápido; si ya tienes los tres servicios en marcha, ejecuta `docker compose down` para liberar los puertos conservando los datos. Los comandos siguientes se ejecutan desde la raíz.

Si utilizas PostgreSQL 17 instalado por tu cuenta, aplica las migraciones y seeds en orden y ajusta sus credenciales en `.env`.

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
    pages/           Login, registro, examen, resultados y coordinación del flujo
    styles/          Variables Sass y estilos globales
    types/           Tipos de examen y resultados
  tests/             Pruebas del cliente API
  nginx.conf         Servidor web y proxy de la API
database/            Migraciones y seeds SQL
scripts/             Generación local de .env
compose.yaml         Servicios db, backend y frontend
.env.example         Variables de configuración sin secretos reales
```

El frontend consulta el estado del intento antes de mostrar el examen. Al enviar, el servidor valida las respuestas y guarda intento, respuestas, corrección y calificación en una transacción. La clave primaria por estudiante y examen impide repetir el intento, también ante envíos simultáneos.

## Sesiones, permisos y resultados

El acceso utiliza correo y contraseña y crea una cookie HTTP-only `auth_session`, sin guardar el token en `localStorage`. La sesión dura dos horas, persiste en PostgreSQL y se recupera visualmente mediante `/api/auth/me`. Logout revoca la sesión presentada; cambiar la contraseña invalida todas las anteriores.

### Consultar el JWT y probar la API

El JWT lo genera el backend al iniciar sesión; no se obtiene de un servicio externo ni se crea manualmente. `JWT_SECRET` es la clave privada para firmarlo, no el token de un usuario. El generador del [inicio rápido](../README.md#inicio-rápido-para-evaluar-la-prueba) configura esa clave automáticamente.

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

