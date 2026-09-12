import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const action = process.argv[2]
const services = ['services/ocr', 'services/anomaly']
const windows = process.platform === 'win32'

function systemPython() {
  const candidates = windows ? [['py', ['-3.10']], ['python', []]] : [['python3', []], ['python', []]]
  for (const [command, prefix] of candidates) {
    const probe = spawnSync(command, [...prefix, '--version'])
    if (probe.status === 0) return [command, prefix]
  }
  console.error('Python 3.10+ não encontrado no PATH.')
  process.exit(1)
}

for (const service of services) {
  const python = join(service, '.venv', windows ? 'Scripts/python.exe' : 'bin/python')
  if (action === 'setup') {
    const [command, prefix] = systemPython()
    let result = spawnSync(command, [...prefix, '-m', 'venv', join(service, '.venv')], { stdio: 'inherit' })
    if (result.status !== 0) process.exit(result.status ?? 1)
    result = spawnSync(
      python,
      [
        '-m', 'pip', 'install',
        '-r', join(service, 'requirements.lock'),
        '-r', join(service, 'requirements-dev.txt'),
      ],
      { stdio: 'inherit' },
    )
    if (result.status !== 0) process.exit(result.status ?? 1)
    continue
  }
  if (!existsSync(python)) {
    console.error(`${service}: .venv ausente; rode npm run python:setup`)
    process.exit(1)
  }
  const args = action === 'test'
    ? ['-m', 'pytest', join(service, 'tests')]
    : [
        '-m', 'ruff', 'check', '--select', 'E9,F63,F7,F82',
        join(service, 'src'), join(service, 'tests'),
      ]
  const result = spawnSync(python, args, { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
