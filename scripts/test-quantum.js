const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

const venvDir = path.join(rootDir, 'quantum-service', '.venv');
const venvPython = isWin 
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

const res = spawnSync(venvPython, ['-m', 'unittest', 'discover', '-s', 'tests', '-v'], {
  cwd: path.join(rootDir, 'quantum-service'),
  stdio: 'inherit',
});

process.exit(res.status ?? 0);
