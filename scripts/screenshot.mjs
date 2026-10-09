// Screenshot the built page, so the index can be reviewed without a browser.
//
// Builds web/dist if it is missing, serves it with `vite preview`, drives a
// headless Chrome over the DevTools protocol and writes docs/screenshots/*.png.
// Everything it starts is stopped again before the process exits.
//
//   node scripts/screenshot.mjs          (or: npm run screenshot, from web/)
//
// Set CHROME_PATH if Chrome or Edge lives somewhere unusual.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WEB = join(ROOT, 'web')
const DIST = join(WEB, 'dist')
const OUT = join(ROOT, 'docs', 'screenshots')

/** Viewports to capture: [file name, theme, width, height]. */
const SHOTS = [
  ['desktop-light', 'light', 1280, 900],
  ['desktop-dark', 'dark', 1280, 900],
  ['mobile-light', 'light', 390, 844],
]

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  // Forward slashes work on Windows too, and need no escaping here.
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const port = () => 40000 + Math.floor(Math.random() * 9000)
const children = []

function run(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'ignore', ...options })
  children.push(child)
  return child
}

function stopEverything() {
  for (const child of children) {
    try {
      child.kill()
    } catch {
      /* already gone */
    }
  }
}

/** Poll a URL until it answers, rather than guessing how long a start-up takes. */
async function waitForHttp(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) return true
    } catch {
      /* not listening yet */
    }
    await sleep(500)
  }
  return false
}

/** The bundle is built for /<repo>/, so read the prefix back out of index.html. */
function basePathFromBuild() {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8')
  const match = html.match(/(?:src|href)="([^"]*)\/assets\//)
  return match && match[1] ? `${match[1]}/` : '/'
}

/** A small promise wrapper around one CDP websocket connection. */
async function connect(debugPort) {
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()
  const target = targets.find((t) => t.type === 'page')
  if (!target) throw new Error('Chrome exposed no page target')

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve_, reject) => {
    ws.onopen = resolve_
    ws.onerror = () => reject(new Error('could not open the DevTools websocket'))
  })

  let id = 0
  const pending = new Map()
  ws.onmessage = (message) => {
    const data = JSON.parse(message.data)
    const entry = pending.get(data.id)
    if (!entry) return
    pending.delete(data.id)
    data.error ? entry.reject(new Error(JSON.stringify(data.error))) : entry.resolve(data.result)
  }

  const send = (method, params = {}) =>
    new Promise((resolve_, reject) => {
      const n = ++id
      pending.set(n, { resolve: resolve_, reject })
      ws.send(JSON.stringify({ id: n, method, params }))
    })

  return { send, close: () => ws.close() }
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.log('web/dist is missing - building it first')
    const build = run('npm', ['run', 'build'], { cwd: WEB, stdio: 'inherit', shell: process.platform === 'win32' })
    const code = await new Promise((r) => build.on('exit', r))
    if (code !== 0) throw new Error(`npm run build exited with ${code}`)
  }

  const chrome = CHROME_CANDIDATES.find((path) => existsSync(path))
  if (!chrome) throw new Error(`no Chrome found - set CHROME_PATH (looked in: ${CHROME_CANDIDATES.join(', ')})`)

  const previewPort = port()
  const debugPort = port()
  const base = basePathFromBuild()
  const url = `http://127.0.0.1:${previewPort}${base}`

  run(process.execPath, [
    join(WEB, 'node_modules', 'vite', 'bin', 'vite.js'),
    'preview',
    '--port', String(previewPort),
    '--strictPort',
    '--host', '127.0.0.1',
  ], { cwd: WEB })
  if (!(await waitForHttp(url))) throw new Error(`vite preview never answered on ${url}`)

  run(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${join(DIST, '..', 'dist-chrome-profile')}`,
    'about:blank',
  ])
  if (!(await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`))) {
    throw new Error('Chrome never opened its DevTools port')
  }

  const { send, close } = await connect(debugPort)
  await send('Page.enable')
  await send('Runtime.enable')
  const evaluate = async (expression) =>
    (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value

  mkdirSync(OUT, { recursive: true })
  for (const [name, theme, width, height] of SHOTS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: width < 600,
    })
    // Load once to get an origin, set the theme, then reload into it.
    await send('Page.navigate', { url })
    await sleep(600)
    await evaluate(`localStorage.setItem('project-index-theme', ${JSON.stringify(theme)})`)
    await send('Page.reload')
    for (let i = 0; i < 40; i++) {
      if (await evaluate(`document.querySelectorAll('li.project').length`)) break
      await sleep(250)
    }
    await sleep(600)

    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'))
    console.log(`docs/screenshots/${name}.png  ${width}x${height}  ${theme}`)
  }
  close()
}

// Never leave a browser or a server behind, however this ends.
const guard = setTimeout(() => {
  console.error('timed out after 3 minutes')
  stopEverything()
  process.exit(1)
}, 180_000)

try {
  await main()
  console.log('done')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  clearTimeout(guard)
  stopEverything()
  // Chrome and vite can take a moment to let go of their ports.
  await sleep(300)
  process.exit(process.exitCode ?? 0)
}
