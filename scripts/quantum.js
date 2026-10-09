const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

const venvDir = path.join(rootDir, 'quantum-service', '.venv');
const venvPython = isWin 
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

if (!fs.existsSync(venvPython)) {
  console.error('[quantum] Python venv missing — run: npm run setup');
  process.exit(1);
}

const env = {
  ...process.env,
  PYTHONWARNINGS: 'ignore::DeprecationWarning',
};

const port = process.env.QUANTUM_PORT || '8001';

const child = spawn(
  venvPython,
  ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', port, '--reload'],
  {
    cwd: path.join(rootDir, 'quantum-service'),
    stdio: 'inherit',
    env,
  }
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
