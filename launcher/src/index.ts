import { spawn, execSync, type ChildProcess } from 'child_process'
import { createServer, type Server } from 'net'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const BACKEND_DIR = resolve(ROOT, 'backend')
const FRONTEND_DIR = resolve(ROOT, 'frontend')
const STATE_FILE = resolve(ROOT, '.resync-state.json')

const DEFAULT_PORT = 4000
const HEALTH_TIMEOUT = 30_000
const HEALTH_INTERVAL = 500
const MAX_RESTARTS = 1

interface State {
  pid: number | null
  port: number
  startedAt: number | null
  restarts: number
}

function readState(): State | null {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
  } catch {
    return null
  }
}

function writeState(state: State) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function clearState() {
  try { unlinkSync(STATE_FILE) } catch {}
}

function findFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server: Server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        server.close(() => resolvePort(port))
      } else {
        reject(new Error('Could not determine port'))
      }
    })
    server.on('error', reject)
  })
}

async function waitForHealth(port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      if (res.ok) {
        const body = await res.json()
        if (body.running) return true
      }
    } catch {}
    await new Promise(r => setTimeout(r, HEALTH_INTERVAL))
  }
  return false
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function openBrowser(url: string) {
  const platform = process.platform
  try {
    if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore' })
    } else if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' })
    } else {
      execSync(`xdg-open "${url}" || sensible-browser "${url}" || x-www-browser "${url}"`, { stdio: 'ignore' })
    }
  } catch {
    console.log(`Open ${url} in your browser`)
  }
}

function buildFrontend(): boolean {
  console.log('Building frontend...')
  try {
    execSync('npm run build', { cwd: FRONTEND_DIR, stdio: 'inherit' })
    return true
  } catch (err) {
    console.error('Frontend build failed:', err)
    return false
  }
}

async function startBackend(port: number): Promise<ChildProcess> {
  console.log(`Starting backend on port ${port}...`)
  const proc = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) },
  })
  return proc
}

async function start(port?: number) {
  const existing = readState()
  if (existing && existing.pid !== null && isRunning(existing.pid)) {
    const url = `http://localhost:${existing.port}`
    console.log(`ReSync already running at ${url}`)
    openBrowser(url)
    return
  }

  if (existing) {
    clearState()
  }

  const targetPort = port || DEFAULT_PORT

  const frontendDist = resolve(FRONTEND_DIR, 'dist')
  const hasFrontendBuild = existsSync(resolve(frontendDist, 'index.html'))

  if (!hasFrontendBuild) {
    console.log('No production frontend build found. Building...')
    if (!buildFrontend()) {
      console.error('Frontend build failed. Aborting.')
      process.exit(1)
    }
  }

  const proc = await startBackend(targetPort)

  const state: State = {
    pid: proc.pid,
    port: targetPort,
    startedAt: Date.now(),
    restarts: 0,
  }
  writeState(state)

  console.log('Waiting for backend to become healthy...')
  const healthy = await waitForHealth(targetPort, HEALTH_TIMEOUT)

  if (!healthy) {
    console.error('Backend failed to start within timeout.')
    if (proc.kill) proc.kill()
    clearState()
    process.exit(1)
  }

  const url = `http://localhost:${targetPort}`
  console.log(`ReSync is running at ${url}`)
  openBrowser(url)

  let restarted = false
  proc.on('exit', (code) => {
    if (code !== 0 && !restarted && state.restarts < MAX_RESTARTS) {
      restarted = true
      state.restarts++
      console.log(`Backend exited (code ${code}). Restarting...`)
      startBackend(targetPort).then(newProc => {
        state.pid = newProc.pid
        writeState(state)
        waitForHealth(targetPort, HEALTH_TIMEOUT).then(h => {
          if (h) console.log('Backend restarted successfully')
        })
        newProc.on('exit', () => {
          console.log('Backend stopped.')
          clearState()
        })
      })
    } else {
      console.log('Backend stopped.')
      clearState()
    }
  })
}

function stop() {
  const state = readState()
  if (!state || state.pid === null) {
    console.log('ReSync is not running.')
    return
  }

  if (isRunning(state.pid)) {
    try {
      process.kill(state.pid, 'SIGTERM')
      console.log(`Stopped backend (pid ${state.pid})`)
    } catch (err) {
      console.error('Failed to stop:', err)
    }
  }

  clearState()
}

function status() {
  const state = readState()
  if (!state || state.pid === null || !isRunning(state.pid)) {
    console.log('ReSync is not running.')
    return
  }

  const uptime = Math.floor((Date.now() - (state.startedAt || Date.now())) / 1000)
  console.log(`ReSync is running`)
  console.log(`  PID:    ${state.pid}`)
  console.log(`  Port:   ${state.port}`)
  console.log(`  Uptime: ${uptime}s`)
}

function main() {
  const cmd = process.argv[2] || 'start'

  switch (cmd) {
    case 'start':
      start().catch(err => {
        console.error('Start failed:', err)
        process.exit(1)
      })
      break
    case 'stop':
      stop()
      break
    case 'restart':
      stop()
      setTimeout(() => {
        start().catch(err => {
          console.error('Restart failed:', err)
          process.exit(1)
        })
      }, 1000)
      break
    case 'status':
      status()
      break
    default:
      console.log('Usage: resync-launcher <start|stop|restart|status>')
      process.exit(1)
  }
}

main()
