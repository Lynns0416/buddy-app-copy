import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('@/lib/firebase', () => ({
  firebaseAuth: { currentUser: null },
}))
