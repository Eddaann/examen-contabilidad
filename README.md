# Examen de Contabilidad

Aplicación en desarrollo para responder un examen y consultar el resultado de un único intento por estudiante y examen.

## Inicio con Docker

Requisitos: Git y Docker con Docker Compose v2 (incluido en Docker Desktop). No necesitas instalar Node.js ni PostgreSQL en tu equipo.

Después de clonar el repositorio, copia `.env.example` a `.env` y sustituye el valor de ejemplo de `JWT_SECRET` por una clave privada aleatoria. No la publiques ni la incluyas en Git. Después ejecuta desde la raíz:

```bash
docker compose up --build -d --wait
```

Abre http://localhost:8080. Compose construye el backend y el frontend, prepara PostgreSQL y espera a que los servicios estén disponibles. Las credenciales de PostgreSQL tienen valores locales predeterminados; `JWT_SECRET` es obligatoria y Compose detiene el arranque si falta o está vacía.

El frontend contiene únicamente la estructura mínima de React, sin interfaz (la página se muestra en blanco). La API implementada permite verificar el servidor y la conexión con la base; el flujo del examen sigue pendiente.

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

PostgreSQL ejecuta los tres SQL de `database/migrations/` y después los dos de `database/seeds/`, en orden, al inicializar un volumen vacío. Se crean las tablas, roles, permisos, tres estudiantes y el examen con sus cinco preguntas y veinte opciones.

Estudiantes de prueba:

- `alumno1@ejemplo.com`
- `alumno2@ejemplo.com`
- `alumno3@ejemplo.com`

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
