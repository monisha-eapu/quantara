const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';

// 1. Node version check
const [maj] = process.versions.node.split('.').map(Number);
if (maj < 24) {
  console.error('Node >= 24 required (for native ML-DSA via OpenSSL 3.5)');
  process.exit(1);
}

// 2. npm install
console.log('> Running npm install...');
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const npmRes = spawnSync(npmCmd, ['install'], { cwd: rootDir, stdio: 'inherit', shell: isWin });
if (npmRes.status !== 0) {
  process.exit(npmRes.status || 1);
}

// 3. Setup Python venv
const venvDir = path.join(rootDir, 'quantum-service', '.venv');
const venvPython = isWin 
  ? path.join(venvDir, 'Scripts', 'python.exe')
  : path.join(venvDir, 'bin', 'python');

if (!fs.existsSync(venvPython)) {
  console.log('> Creating Python virtualenv in quantum-service/.venv...');
  const sysPython = process.env.PYTHON || (isWin ? 'python' : 'python3');
  // Avoid shell: true for python so paths with spaces (e.g. C:\Users\E M S MONISHA\...) aren't split by cmd.exe
  const venvRes = spawnSync(sysPython, ['-m', 'venv', venvDir], { stdio: 'inherit', shell: false });
  if (venvRes.status !== 0) {
    console.error('Failed to create Python virtual environment with ' + sysPython);
    process.exit(venvRes.status || 1);
  }
}

// 4. Install Python requirements
console.log('> Installing Python dependencies...');
const reqFile = path.join(rootDir, 'quantum-service', 'requirements.txt');

const pipUpgrade = spawnSync(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', '-q'], { stdio: 'inherit', shell: false });
if (pipUpgrade.status !== 0) {
  console.warn('Warning: pip upgrade exited with non-zero code');
}

const pipReq = spawnSync(venvPython, ['-m', 'pip', 'install', '-r', reqFile, '-q'], { stdio: 'inherit', shell: false });
if (pipReq.status !== 0) {
  console.error('Failed to install Python requirements');
  process.exit(pipReq.status || 1);
}

// 5. Create .env if missing
const envFile = path.join(rootDir, '.env');
const envExample = path.join(rootDir, '.env.example');
if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envFile);
  console.log('> Created .env from .env.example');
}

console.log('Setup complete. Run: npm run dev');
