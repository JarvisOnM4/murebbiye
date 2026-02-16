import { spawn } from "node:child_process";
import path from "node:path";

const PORT = Number(process.env.PHASE5_SMOKE_PORT ?? "3102");
const BASE_URL = `http://localhost:${PORT}`;
const START_TIMEOUT_MS = 120000;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createCookieClient() {
  const cookies = new Map();

  function setCookieFromHeader(cookieHeader) {
    if (!cookieHeader) {
      return;
    }

    const [pair] = cookieHeader.split(";");
    const separator = pair.indexOf("=");

    if (separator < 1) {
      return;
    }

    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    cookies.set(key, value);
  }

  function captureResponseCookies(response) {
    if (typeof response.headers.getSetCookie === "function") {
      for (const cookie of response.headers.getSetCookie()) {
        setCookieFromHeader(cookie);
      }
      return;
    }

    const single = response.headers.get("set-cookie");

    if (single) {
      setCookieFromHeader(single);
    }
  }

  function cookieHeaderValue() {
    return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
  }

  async function request(url, init = {}) {
    const headers = new Headers(init.headers ?? {});
    const cookieHeader = cookieHeaderValue();

    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }

    const response = await fetch(url, {
      ...init,
      headers
    });

    captureResponseCookies(response);
    return response;
  }

  return {
    request
  };
}

async function assertJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON response, got: ${text.slice(0, 220)}`);
  }
}

async function waitForServer(logLines) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, {
        redirect: "manual"
      });

      if (response.ok) {
        return;
      }
    } catch {
      // keep waiting
    }

    await wait(1000);
  }

  throw new Error(`Server did not start within timeout. Recent logs:\n${logLines.slice(-40).join("")}`);
}

async function stopServer(server) {
  if (server.exitCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      server.kill("SIGKILL");
      resolve(undefined);
    }, 5000);

    server.once("exit", () => {
      clearTimeout(timeout);
      resolve(undefined);
    });

    server.kill("SIGTERM");
  });
}

async function startServer() {
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const logLines = [];

  const server = spawn(process.execPath, [nextBin, "start", "--port", String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXTAUTH_URL: BASE_URL,
      APP_BASE_URL: BASE_URL
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  server.stdout.on("data", (chunk) => {
    logLines.push(chunk.toString());
  });

  server.stderr.on("data", (chunk) => {
    logLines.push(chunk.toString());
  });

  await waitForServer(logLines);
  return { server };
}

async function login(client, role) {
  const csrfResponse = await client.request(`${BASE_URL}/api/auth/csrf`);
  const csrfPayload = await assertJson(csrfResponse);

  if (!csrfPayload.csrfToken) {
    throw new Error("CSRF token could not be retrieved.");
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
        };

  const loginBody = new URLSearchParams({
    csrfToken: csrfPayload.csrfToken,
    email: credentials.email,
    password: credentials.password,
    callbackUrl: credentials.callbackUrl,
    json: "true"
  });

  const loginResponse = await client.request(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: loginBody.toString(),
    redirect: "manual"
  });

  if (loginResponse.status >= 400) {
    throw new Error(`${role} login failed: ${loginResponse.status}`);
  }
}

async function uploadFixture(client, track, title, content) {
  const form = new FormData();
  form.set("file", new File([Buffer.from(content, "utf-8")], `${track.toLowerCase()}-fixture.md`, { type: "text/markdown" }));
  form.set("track", track);
  form.set("sourceLanguage", "en");
  form.set("title", title);

  const response = await client.request(`${BASE_URL}/api/admin/curriculum/upload`, {
    method: "POST",
    body: form
  });
  const payload = await assertJson(response);

  if (response.status !== 200 || payload.document?.status !== "READY") {
    throw new Error(`Upload fixture failed for ${track}: ${JSON.stringify(payload).slice(0, 300)}`);
  }
}

async function run() {
  const { server } = await startServer();

  try {
    const adminClient = createCookieClient();
    const studentClient = createCookieClient();

    await login(adminClient, "admin");
    await login(studentClient, "student");

    await uploadFixture(
      adminClient,
      "ENGLISH",
      `Phase 5 English ${Date.now()}`,
      "Simple present tense describes daily routines. Use do/does for questions and add one clear example."
    );

    await uploadFixture(
      adminClient,
      "AI_MODULE",
      `Phase 5 AI ${Date.now()}`,
      "AI module prompts should include explicit constraints, expected output format, and one realistic classroom context."
    );

    const inScopeResponse = await studentClient.request(`${BASE_URL}/api/student/assistant/respond`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        track: "ENGLISH",
        locale: "en",
        question: "How do we use simple present when talking about daily routines?"
      })
    });
    const inScopePayload = await assertJson(inScopeResponse);

    if (inScopeResponse.status !== 200 || inScopePayload.reply?.status !== "IN_SCOPE") {
      throw new Error(`In-scope response failed: ${JSON.stringify(inScopePayload).slice(0, 320)}`);
    }

    if (!Array.isArray(inScopePayload.reply.references) || inScopePayload.reply.references.length === 0) {
      throw new Error(`In-scope references missing: ${JSON.stringify(inScopePayload.reply).slice(0, 320)}`);
    }

    const outScopeResponse = await studentClient.request(`${BASE_URL}/api/student/assistant/respond`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        track: "ENGLISH",
        locale: "en",
        question: "How can I buy cryptocurrency safely this year?"
      })
    });
    const outScopePayload = await assertJson(outScopeResponse);

    if (outScopeResponse.status !== 200 || outScopePayload.reply?.status !== "OUT_OF_SCOPE") {
      throw new Error(`Out-of-scope guardrail failed: ${JSON.stringify(outScopePayload).slice(0, 320)}`);
    }

    const aiScopeResponse = await studentClient.request(`${BASE_URL}/api/student/assistant/respond`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        track: "AI_MODULE",
        locale: "en",
        question: "What should an AI module prompt include to keep output structured?"
      })
    });
    const aiScopePayload = await assertJson(aiScopeResponse);

    if (aiScopeResponse.status !== 200 || aiScopePayload.reply?.status !== "IN_SCOPE") {
      throw new Error(`AI track in-scope response failed: ${JSON.stringify(aiScopePayload).slice(0, 320)}`);
    }

    if (!aiScopePayload.reply.references.some((reference) => reference.track === "AI_MODULE")) {
      throw new Error(`AI response did not return AI_MODULE references: ${JSON.stringify(aiScopePayload.reply).slice(0, 320)}`);
    }

    const adminUnauthorized = await adminClient.request(`${BASE_URL}/api/student/assistant/respond`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        track: "ENGLISH",
        locale: "en",
        question: "Can admin ask this endpoint?"
      })
    });

    if (adminUnauthorized.status !== 403) {
      throw new Error(`Admin should not access student assistant endpoint: ${adminUnauthorized.status}`);
    }

    console.log(
      `in-scope status=${inScopeResponse.status} guardrail=${inScopePayload.reply.guardrail.sourcePolicy} matches=${inScopePayload.reply.guardrail.matchedTokenCount}`
    );
    console.log(
      `out-of-scope status=${outScopeResponse.status} decision=${outScopePayload.reply.status} redirect=${outScopePayload.reply.redirect.recommendedAction}`
    );
    console.log(
      `ai-track status=${aiScopeResponse.status} decision=${aiScopePayload.reply.status} references=${aiScopePayload.reply.references.length}`
    );
    console.log(`admin unauthorized status=${adminUnauthorized.status}`);
  } finally {
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
