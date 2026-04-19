import { createRequire } from 'module'
import prettier from 'eslint-config-prettier'

const require = createRequire(import.meta.url)
const nextCoreWebVitals = require('eslint-config-next/core-web-vitals')

export default [
  ...nextCoreWebVitals,
  prettier,
]
