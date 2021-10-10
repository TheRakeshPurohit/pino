'use strict'

const os = require('os')
const { join } = require('path')
const { readFile, symlink, unlink, mkdir, writeFile } = require('fs').promises
const { test } = require('tap')
const { isWin, isYarnPnp, watchFileCreated } = require('../helper')
const { once } = require('events')
const execa = require('execa')
const pino = require('../../')

const { pid } = process
const hostname = os.hostname()

async function installTransportModule (target) {
  if (isYarnPnp) {
    return
  }
  try {
    await uninstallTransportModule()
  } catch {}

  if (!target) {
    target = join(__dirname, '..', '..')
  }

  await symlink(
    join(__dirname, '..', 'fixtures', 'transport'),
    join(target, 'node_modules', 'transport')
  )
}

async function uninstallTransportModule () {
  if (isYarnPnp) {
    return
  }
  await unlink(join(__dirname, '..', '..', 'node_modules', 'transport'))
}

// TODO make this test pass on Windows
test('pino.transport with package', { skip: isWin }, async ({ same, teardown }) => {
  const destination = join(
    os.tmpdir(),
    '_' + Math.random().toString(36).substr(2, 9)
  )

  await installTransportModule()

  const transport = pino.transport({
    target: 'transport',
    options: { destination }
  })
  teardown(async () => {
    await uninstallTransportModule()
    transport.end()
  })
  const instance = pino(transport)
  instance.info('hello')
  await watchFileCreated(destination)
  const result = JSON.parse(await readFile(destination))
  delete result.time
  same(result, {
    pid,
    hostname,
    level: 30,
    msg: 'hello'
  })
})

// TODO make this test pass on Windows
test('pino.transport with package as a target', { skip: isWin }, async ({ same, teardown }) => {
  const destination = join(
    os.tmpdir(),
    '_' + Math.random().toString(36).substr(2, 9)
  )

  await installTransportModule()

  const transport = pino.transport({
    targets: [{
      target: 'transport',
      options: { destination }
    }]
  })
  teardown(async () => {
    await uninstallTransportModule()
    transport.end()
  })
  const instance = pino(transport)
  instance.info('hello')
  await watchFileCreated(destination)
  const result = JSON.parse(await readFile(destination))
  delete result.time
  same(result, {
    pid,
    hostname,
    level: 30,
    msg: 'hello'
  })
})

// TODO make this test pass on Windows
test('pino({ transport })', { skip: isWin || isYarnPnp }, async ({ same, teardown }) => {
  const folder = join(
    os.tmpdir(),
    '_' + Math.random().toString(36).substr(2, 9)
  )

  const destination = join(folder, 'output')

  await mkdir(join(folder, 'node_modules'), { recursive: true })

  // Link pino
  await symlink(
    join(__dirname, '..', '..'),
    join(folder, 'node_modules', 'pino')
  )

  await installTransportModule(folder)

  const toRun = join(folder, 'index.js')

  const toRunContent = `
    const pino = require('pino')
    const logger = pino({
      transport: {
        target: 'transport',
        options: { destination: '${destination}' }
      }
    })
    logger.info('hello')
  `

  await writeFile(toRun, toRunContent)

  const child = execa(process.argv[0], [toRun])

  await once(child, 'close')

  const result = JSON.parse(await readFile(destination))
  delete result.time
  same(result, {
    pid: child.pid,
    hostname,
    level: 30,
    msg: 'hello'
  })
})