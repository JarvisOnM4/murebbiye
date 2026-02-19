import { spawn } from "node:child_process"
import path from "node:path"

const PORT = Number(process.env.PHASE8_SMOKE_PORT ?? "3108")
const BASE_URL = `http://localhost:${PORT}`
const START_TIMEOUT_MS = 120000

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

function createCookieClient() {
  const cookies = new Map()

  function setCookieFromHeader(cookieHeader) {
    if (!cookieHeader) {
      return
    }

    const [pair] = cookieHeader.split(";")
    const separator = pair.indexOf("=")

    if (separator < 1) {
      return
    }

    const key = pair.slice(0, separator).trim()
    const value = pair.slice(separator + 1).trim()
    cookies.set(key, value)
  }

  function captureResponseCookies(response) {
    if (typeof response.headers.getSetCookie === "function") {
      for (const cookie of response.headers.getSetCookie()) {
        setCookieFromHeader(cookie)
      }
      return
    }

    const single = response.headers.get("set-cookie")

    if (single) {
      setCookieFromHeader(single)
    }
  }

  function cookieHeaderValue() {
    return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ")
  }

  async function request(url, init = {}) {
    const headers = new Headers(init.headers ?? {})
    const cookieHeader = cookieHeaderValue()

    if (cookieHeader) {
      headers.set("cookie", cookieHeader)
    }

    const response = await fetch(url, {
      ...init,
      headers
    })

    captureResponseCookies(response)
    return response
  }

  return {
    request
  }
}

async function assertJson(response) {
  const text = await response.text()

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Expected JSON response, got: ${text.slice(0, 220)}`)
  }
}

async function waitForServer(logLines) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, {
        redirect: "manual"
      })

      if (response.ok) {
        return
      }
    } catch {
      // keep waiting
    }

    await wait(1000)
  }

  throw new Error(`Server did not start within timeout. Recent logs:\n${logLines.slice(-40).join("")}`)
}

async function stopServer(server) {
  if (server.exitCode !== null) {
    return
  }

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      server.kill("SIGKILL")
      resolve(undefined)
    }, 5000)

    server.once("exit", () => {
      clearTimeout(timeout)
      resolve(undefined)
    })

    server.kill("SIGTERM")
  })
}

async function startServer() {
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next")
  const logLines = []

  const server = spawn(process.execPath, [nextBin, "start", "--port", String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXTAUTH_URL: BASE_URL,
      APP_BASE_URL: BASE_URL,
      ALLOW_ADMIN_RESET: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })

  server.stdout.on("data", (chunk) => {
    logLines.push(chunk.toString())
  })

  server.stderr.on("data", (chunk) => {
    logLines.push(chunk.toString())
  })

  await waitForServer(logLines)
  return { server }
}

async function login(client, role) {
  const csrfResponse = await client.request(`${BASE_URL}/api/auth/csrf`)
  const csrfPayload = await assertJson(csrfResponse)

  if (!csrfPayload.csrfToken) {
    throw new Error("CSRF token could not be retrieved.")
  }

  const credentials =
    role === "admin"
      ? {
          email: process.env.SEED_ADMIN_EMAIL ?? "admin@murebbiye.local",
          password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!",
          callbackUrl: `${BASE_URL}/admin`
        }
      : {
          email: process.env.SEED_STUDENT_EMAIL ?? "student@murebbiye.local",
          password: process.env.SEED_STUDENT_PASSWORD ?? "ChangeMe123!",
          callbackUrl: `${BASE_URL}/student`
        }

  const loginBody = new URLSearchParams({
    csrfToken: csrfPayload.csrfToken,
    email: credentials.email,
    password: credentials.password,
    callbackUrl: credentials.callbackUrl,
    json: "true"
  })

  const loginResponse = await client.request(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: loginBody.toString(),
    redirect: "manual"
  })

  if (loginResponse.status >= 400) {
    throw new Error(`${role} login failed: ${loginResponse.status}`)
  }
}

async function run() {
  const { server } = await startServer()

  try {
    const adminClient = createCookieClient()
    const studentClient = createCookieClient()

    await login(adminClient, "admin")
    await login(studentClient, "student")

    // 1. List enrichment jobs (should return empty array)
    const listJobsResponse = await adminClient.request(
      `${BASE_URL}/api/admin/media-agent/jobs`,
      { method: "GET" }
    )
    const listJobsPayload = await assertJson(listJobsResponse)

    if (listJobsResponse.status !== 200 || !Array.isArray(listJobsPayload.jobs)) {
      throw new Error(`List jobs failed: ${JSON.stringify(listJobsPayload).slice(0, 300)}`)
    }

    console.log(`list-jobs status=${listJobsResponse.status} count=${listJobsPayload.jobs.length}`)

    // 2. List media assets (should return empty array)
    const listAssetsResponse = await adminClient.request(
      `${BASE_URL}/api/admin/media-agent/assets`,
      { method: "GET" }
    )
    const listAssetsPayload = await assertJson(listAssetsResponse)

    if (listAssetsResponse.status !== 200 || !Array.isArray(listAssetsPayload.assets)) {
      throw new Error(`List assets failed: ${JSON.stringify(listAssetsPayload).slice(0, 300)}`)
    }

    console.log(`list-assets status=${listAssetsResponse.status} count=${listAssetsPayload.assets.length}`)

    // 3. Enrich with invalid body (missing documentId) -> 400
    const invalidEnrichResponse = await adminClient.request(
      `${BASE_URL}/api/admin/media-agent/enrich`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      }
    )
    const invalidEnrichPayload = await assertJson(invalidEnrichResponse)

    if (invalidEnrichResponse.status !== 400 || !Array.isArray(invalidEnrichPayload.errors)) {
      throw new Error(`Invalid enrich should return 400: ${JSON.stringify(invalidEnrichPayload).slice(0, 300)}`)
    }

    console.log(`enrich-invalid-body status=${invalidEnrichResponse.status} errors=${invalidEnrichPayload.errors.length}`)

    // 4. Enrich with non-existent document -> 422 (service error)
    const missingDocEnrichResponse = await adminClient.request(
      `${BASE_URL}/api/admin/media-agent/enrich`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId: "nonexistent-doc-id" })
      }
    )
    const missingDocPayload = await assertJson(missingDocEnrichResponse)

    if (missingDocEnrichResponse.status !== 422 || !Array.isArray(missingDocPayload.errors)) {
      throw new Error(`Enrich missing doc should return 422: ${JSON.stringify(missingDocPayload).slice(0, 300)}`)
    }

    console.log(`enrich-missing-doc status=${missingDocEnrichResponse.status} error="${missingDocPayload.errors[0]}"`)

    // 5. Get non-existent job -> 404
    const missingJobResponse = await adminClient.request(
      `${BASE_URL}/api/admin/media-agent/jobs/nonexistent-job-id`,
      { method: "GET" }
    )

    if (missingJobResponse.status !== 404) {
      throw new Error(`Get missing job should return 404, got ${missingJobResponse.status}`)
    }

    console.log(`get-missing-job status=${missingJobResponse.status}`)

    // 6. Get non-existent asset -> 404
    const missingAssetResponse = await adminClient.request(
      `${BASE_URL}/api/admin/media-agent/assets/nonexistent-asset-id`,
      { method: "GET" }
    )

    if (missingAssetResponse.status !== 404) {
      throw new Error(`Get missing asset should return 404, got ${missingAssetResponse.status}`)
    }

    console.log(`get-missing-asset status=${missingAssetResponse.status}`)

    // 7. Generate with non-existent job -> 422
    const badGenerateResponse = await adminClient.request(
      `${BASE_URL}/api/admin/media-agent/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: "nonexistent-job-id" })
      }
    )
    const badGeneratePayload = await assertJson(badGenerateResponse)

    if (badGenerateResponse.status !== 422 || !Array.isArray(badGeneratePayload.errors)) {
      throw new Error(`Generate bad job should return 422: ${JSON.stringify(badGeneratePayload).slice(0, 300)}`)
    }

    console.log(`generate-bad-job status=${badGenerateResponse.status} error="${badGeneratePayload.errors[0]}"`)

    // 8. Student media endpoint for a lesson (should return empty array)
    const studentMediaResponse = await studentClient.request(
      `${BASE_URL}/api/student/lessons/demo-lesson/media`,
      { method: "GET" }
    )
    const studentMediaPayload = await assertJson(studentMediaResponse)

    if (studentMediaResponse.status !== 200 || !Array.isArray(studentMediaPayload.assets)) {
      throw new Error(`Student media endpoint failed: ${JSON.stringify(studentMediaPayload).slice(0, 300)}`)
    }

    console.log(`student-media status=${studentMediaResponse.status} count=${studentMediaPayload.assets.length}`)

    // 9. Auth guard: student cannot access admin media-agent endpoints
    const studentEnrichResponse = await studentClient.request(
      `${BASE_URL}/api/admin/media-agent/enrich`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId: "test" })
      }
    )

    if (studentEnrichResponse.status !== 403) {
      throw new Error(`Student access to admin enrich should be 403, got ${studentEnrichResponse.status}`)
    }

    const studentJobsResponse = await studentClient.request(
      `${BASE_URL}/api/admin/media-agent/jobs`,
      { method: "GET" }
    )

    if (studentJobsResponse.status !== 403) {
      throw new Error(`Student access to admin jobs should be 403, got ${studentJobsResponse.status}`)
    }

    console.log(`auth-guard enrich=${studentEnrichResponse.status} jobs=${studentJobsResponse.status}`)

    // 10. Review storyboard for non-existent asset -> 422
    const reviewMissingResponse = await adminClient.request(
      `${BASE_URL}/api/admin/media-agent/assets/nonexistent-asset-id/review`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve" })
      }
    )
    const reviewMissingPayload = await assertJson(reviewMissingResponse)

    if (reviewMissingResponse.status !== 422 || !Array.isArray(reviewMissingPayload.errors)) {
      throw new Error(`Review missing asset should return 422: ${JSON.stringify(reviewMissingPayload).slice(0, 300)}`)
    }

    console.log(`review-missing-asset status=${reviewMissingResponse.status} error="${reviewMissingPayload.errors[0]}"`)

    console.log("\n--- Phase 8 Smoke Test: ALL PASSED ---")
  } finally {
    await stopServer(server)
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
