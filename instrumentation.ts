// runs once at server startup, before any request — checks required env vars

export async function register() {
  // node only — skip in edge runtime and build time
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnvVars } = await import("@/lib/env-assertions");
    assertEnvVars();
  }
}
