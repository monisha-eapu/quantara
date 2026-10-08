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
  console.error("Run 'npm run setup' first.");
  process.exit(1);
}

const args = ['-W', 'ignore', 'qml_demo.py', ...process.argv.slice(2)];

const env = {
  ...process.env,
  PYTHONIOENCODING: 'utf-8',
};

const child = spawn(venvPython, args, {
  cwd: path.join(rootDir, 'quantum-service'),
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
