const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const target = path.join(root, '.env');
const secrets = {
  POSTGRES_PASSWORD: randomBytes(24).toString('hex'),
  JWT_SECRET: randomBytes(32).toString('hex'),
  TEST_STUDENT_PASSWORD: randomBytes(24).toString('hex'),
  TEST_TEACHER_PASSWORD: randomBytes(24).toString('hex'),
};

try {
  let text = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  for (const [key, value] of Object.entries(secrets)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    if (!pattern.test(text)) throw new Error('Configuración de ejemplo incompleta');
    text = text.replace(pattern, `${key}=${value}`);
  }
  fs.writeFileSync(target, text, { flag: 'wx', mode: 0o600 });
  if (process.getuid?.() === 0) {
    const owner = fs.statSync(root);
    fs.chownSync(target, owner.uid, owner.gid);
  }
  console.log('.env creado con secretos aleatorios propios de este equipo. Valores ocultos.');
  console.log('Para acceder: alumno1@ejemplo.com. Consulta TEST_STUDENT_PASSWORD en tu .env con un editor local.');
} catch (error) {
  if (error.code === 'EEXIST') {
    console.log('Ya existe .env: se conserva sin cambios.');
  } else {
    console.error('No se pudo crear .env. Revisa que .env.example exista y tengas permiso de escritura.');
    process.exitCode = 1;
  }
}
