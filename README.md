# Examen de Contabilidad

Muestra práctica para el puesto de Diseñador Programador. Aplicación web para responder un examen de cinco preguntas, registrar un único intento por estudiante y consultar la calificación y las respuestas al volver a entrar.

Incluye registro de estudiantes, sesión persistente al recargar y una interfaz adaptable a móvil, tablet y escritorio con scroll interno en el examen y header siempre visible.

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

Si algo impide el arranque:

- **Docker no responde:** abre Docker Desktop y espera a que el motor esté listo. Comprueba `docker info`.
- **Compose no reconoce `--wait`:** actualiza Docker Desktop o el plugin Docker Compose.
- **Puerto ocupado:** cambia `FRONTEND_PORT` o `DB_PUBLISHED_PORT` en `.env` (por ejemplo, `8081` y `5433`) y repite el arranque. Si usas `8081`, abre `http://localhost:8081`. Para desarrollo fuera de Docker, ajusta también `DB_PORT` al puerto publicado.
- **Variables obligatorias vacías:** el generador conserva cualquier `.env` existente, aunque esté incompleto. Completa sus valores siguiendo [Configuración opcional](docs/guia-tecnica.md#configuración-opcional).
- **Un servicio no arranca:** consulta `docker compose ps` y `docker compose logs --tail=100 backend frontend db`. No compartas archivos de configuración ni logs sin revisar si contienen información privada.
- **Error de autenticación de PostgreSQL:** las credenciales de `.env` deben coincidir con las que crearon el volumen. Borrar contenedores no borra esa base ni actualiza sus credenciales. Recupera la configuración original o, si no necesitas los datos, sigue [Reiniciar completamente los datos de desarrollo](docs/guia-tecnica.md#reiniciar-completamente-los-datos-de-desarrollo).
- **Esquema incompleto:** si actualizaste una base anterior, aplica las migraciones pendientes como se explica en [Base de datos y migraciones](docs/guia-tecnica.md#base-de-datos-y-migraciones).

Si solo vas a evaluar la prueba en una instalación nueva, con estos pasos es suficiente.

## Servicios y comandos de Docker

| Servicio | Responsabilidad | Acceso desde el equipo |
| --- | --- | --- |
| `db` | PostgreSQL y volumen persistente | `localhost:5432` o `DB_PUBLISHED_PORT` |
| `backend` | API, sesiones, permisos y calificación | Mediante `/api` en el frontend; no publica un puerto propio |
| `frontend` | React compilado, servido por Nginx | `http://localhost:8080` o `FRONTEND_PORT` |

Nginx redirige `/api/` al backend. El backend se conecta a `db:5432` dentro de la red de Compose. Los puertos publicados solo escuchan en `127.0.0.1`.

### Comprobar que está listo

```bash
docker compose ps
```

Los tres servicios deben aparecer como `healthy`. También puedes abrir [salud de la API](http://localhost:8080/api/health) y [conexión con la base](http://localhost:8080/api/health/db); ambos deben responder con HTTP 200. Ajusta `8080` si cambiaste `FRONTEND_PORT`.

El backend comprueba las tablas y columnas requeridas antes de iniciar. Si falta parte del esquema, no arranca e indica que deben aplicarse las migraciones pendientes; no las ejecuta automáticamente.

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

## Decisión de diseño

Se decidió que el modelo de datos y el backend contemplaran más alcance que la interfaz solicitada en la prueba. La base separa usuarios, roles y permisos mediante relaciones, y organiza exámenes, preguntas, opciones e intentos por entidades. Esto permite incorporar más exámenes y ampliar los accesos de estudiantes y profesores sin rehacer el modelo central. Las sesiones persistidas y los resultados históricos también forman parte de esa base.

El frontend se enfoca en el registro, login, examen y resultado del estudiante. El backend ya ofrece consultas para docentes; las ampliaciones pendientes se enumeran al final. Esta preparación permite ampliar funcionalidades, pero no equivale a una validación de rendimiento bajo grandes volúmenes de usuarios.

## Documentación técnica

La [guía técnica](docs/guia-tecnica.md) contiene los detalles que no necesitas para levantar y probar la aplicación:

- [Variables de entorno y selección del examen](docs/guia-tecnica.md#configuración-opcional).
- [Desarrollo local](docs/guia-tecnica.md#desarrollo-local-con-postgresql-en-docker).
- [Migraciones y reinicio de la base](docs/guia-tecnica.md#base-de-datos-y-migraciones).
- [Pruebas y compilación](docs/guia-tecnica.md#pruebas).
- [Estructura de carpetas](docs/guia-tecnica.md#estructura-y-arquitectura).
- [Cómo consultar el JWT, permisos y resultados históricos](docs/guia-tecnica.md#sesiones-permisos-y-resultados).

## Supuestos, alcance y pendientes

- Por decisión del proyecto, se utiliza correo y contraseña, aunque el enunciado original propone acceso solo por correo.
- El examen se selecciona mediante la constante `EXAM_ID`, fijada en `"1"`; no existe todavía un catálogo de exámenes.
- Roles y permisos permiten ampliar el proyecto; la administración visual de usuarios y permisos, el panel de profesores y la integración LTI quedan pendientes.
- No hay interfaz para cambiar contraseñas ni gestor incremental de migraciones.

Otras mejoras futuras: pruebas E2E automatizadas y mantenimiento de sesiones y contadores vencidos.

## Uso de IA

Se utilizó asistencia de IA mediante Codex para revisar y desarrollar partes del backend y frontend, configurar Docker, añadir pruebas y preparar documentación.
