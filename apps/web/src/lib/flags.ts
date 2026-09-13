// NEXT_PUBLIC_* is inlined into the client bundle at build time, so flipping a
// flag here is a rebuild with a new build arg, not a runtime config edit.
// Read inside the function, never into a module-level const: the value is a
// literal after inlining either way, and this keeps it stubbable in tests.

/**
 * Apple sign-in needs a Firebase provider config (Service ID + key) that does
 * not exist yet. Off unless explicitly enabled — a missing flag must never
 * ship a button that throws on click.
 */
export function isAppleSignInEnabled(): boolean {
  return process.env.NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true'
}
