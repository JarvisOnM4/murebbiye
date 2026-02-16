import { spawn } from "node:child_process";
import path from "node:path";

const PORT = Number(process.env.PHASE6_SMOKE_PORT ?? "3103");
const BASE_URL = `http://localhost:${PORT}`;
const START_TIMEOUT_MS = 120000;
const RETRY_WAIT_MS = 1200;

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

  throw new Error(`Server did not start in time. Recent logs:\n${logLines.slice(-40).join("")}`);
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
      APP_BASE_URL: BASE_URL,
      EMAIL_SIMULATE_FAILURE_PATTERN: "force-fail"
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

async function createLessonDraft(adminClient, studentId, focusTopic) {
  const response = await adminClient.request(`${BASE_URL}/api/admin/lessons/draft`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      track: "ENGLISH",
      locale: "en",
      studentId,
      focusTopic
    })
  });

  const payload = await assertJson(response);

  if (response.status !== 200 || !payload.draft?.id) {
    throw new Error(`Draft creation failed: ${JSON.stringify(payload).slice(0, 280)}`);
  }

  return payload.draft.id;
}

async function completeLesson(studentClient, lessonId, parentEmail) {
  const response = await studentClient.request(`${BASE_URL}/api/student/lessons/complete`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      lessonId,
      locale: "en",
      parentEmail,
      interactions: [
        {
          promptText: "Describe your daily routine in present simple.",
          responseText: "I wake up at seven, I eat breakfast, and I go to school.",
          usedHint: false,
          isCorrect: true,
          responseMs: 38000
        },
        {
          promptText: "Describe your daily routine in present simple.",
          responseText: "She study every day.",
          usedHint: true,
          isCorrect: false,
          responseMs: 52000
        },
        {
          promptText: "Fix the sentence: She study every day.",
          responseText: "She studies every day.",
          usedHint: false,
          isCorrect: true,
          responseMs: 29000
        }
      ]
    })
  });

  const payload = await assertJson(response);

  if (response.status !== 200 || !payload.result?.parentSummary?.id || !payload.result?.queueJob?.id) {
    throw new Error(`Lesson completion failed: ${JSON.stringify(payload).slice(0, 320)}`);
  }

  const metrics = payload.result.metrics;

  if (
    typeof metrics.accuracyRatio !== "number" ||
    typeof metrics.hintDependency !== "number" ||
    typeof metrics.repetitionPerformance !== "number" ||
    typeof metrics.interactionQuality !== "number" ||
    typeof metrics.timeManagement !== "number"
  ) {
    throw new Error(`Metrics payload invalid: ${JSON.stringify(metrics).slice(0, 240)}`);
  }

  return payload.result;
}

async function listParentSummaries(adminClient) {
  const response = await adminClient.request(`${BASE_URL}/api/admin/reports/parent-summaries?limit=40`, {
    method: "GET"
  });
  const payload = await assertJson(response);

  if (response.status !== 200 || !Array.isArray(payload.summaries)) {
    throw new Error(`List parent summaries failed: ${JSON.stringify(payload).slice(0, 280)}`);
  }

  return payload.summaries;
}

async function dispatchQueue(adminClient) {
  const response = await adminClient.request(`${BASE_URL}/api/admin/reports/parent-summaries/dispatch`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ limit: 20 })
  });

  const payload = await assertJson(response);

  if (response.status !== 200 || !payload.result) {
    throw new Error(`Queue dispatch failed: ${JSON.stringify(payload).slice(0, 280)}`);
  }

  return payload.result;
}

function requireSummaryStatus(summaries, summaryId, expectedStatus) {
  const found = summaries.find((summary) => summary.id === summaryId);

  if (!found) {
    throw new Error(`Parent summary ${summaryId} not found in list endpoint.`);
  }

  if (found.status !== expectedStatus) {
    throw new Error(`Parent summary ${summaryId} expected status ${expectedStatus}, got ${found.status}.`);
  }

  return found;
}

async function run() {
  const { server } = await startServer();

  try {
    const adminClient = createCookieClient();
    const studentClient = createCookieClient();
    const studentId = "env-student";

    await login(adminClient, "admin");
    await login(studentClient, "student");

    const lessonIdSuccess = await createLessonDraft(
      adminClient,
      studentId,
      `Phase 6 success topic ${Date.now()}`
    );

    const completionSuccess = await completeLesson(
      studentClient,
      lessonIdSuccess,
      `parent-ok-${Date.now()}@example.com`
    );

    const beforeDispatch = await listParentSummaries(adminClient);
    requireSummaryStatus(beforeDispatch, completionSuccess.parentSummary.id, "QUEUED");

    const successDispatch = await dispatchQueue(adminClient);
    const afterSuccessDispatch = await listParentSummaries(adminClient);
    requireSummaryStatus(afterSuccessDispatch, completionSuccess.parentSummary.id, "SENT");

    const lessonIdFail = await createLessonDraft(
      adminClient,
      studentId,
      `Phase 6 retry topic ${Date.now()}`
    );

    const completionFail = await completeLesson(
      studentClient,
      lessonIdFail,
      `force-fail-parent-${Date.now()}@example.com`
    );

    const retryDispatch1 = await dispatchQueue(adminClient);
    const retryItem1 = retryDispatch1.items.find(
      (item) => item.parentSummaryId === completionFail.parentSummary.id
    );

    if (!retryItem1 || retryItem1.status !== "RETRY_SCHEDULED") {
      throw new Error(`Retry attempt 1 not scheduled: ${JSON.stringify(retryDispatch1).slice(0, 340)}`);
    }

    await wait(RETRY_WAIT_MS);
    const retryDispatch2 = await dispatchQueue(adminClient);
    const retryItem2 = retryDispatch2.items.find(
      (item) => item.parentSummaryId === completionFail.parentSummary.id
    );

    if (!retryItem2 || retryItem2.status !== "RETRY_SCHEDULED") {
      throw new Error(`Retry attempt 2 not scheduled: ${JSON.stringify(retryDispatch2).slice(0, 340)}`);
    }

    await wait(RETRY_WAIT_MS);
    const retryDispatch3 = await dispatchQueue(adminClient);
    const retryItem3 = retryDispatch3.items.find(
      (item) => item.parentSummaryId === completionFail.parentSummary.id
    );

    if (!retryItem3 || retryItem3.status !== "FAILED") {
      throw new Error(`Retry attempt 3 should fail permanently: ${JSON.stringify(retryDispatch3).slice(0, 340)}`);
    }

    const afterRetryDispatch = await listParentSummaries(adminClient);
    const failedSummary = requireSummaryStatus(
      afterRetryDispatch,
      completionFail.parentSummary.id,
      "FAILED"
    );

    if ((failedSummary.attempts ?? 0) < 3) {
      throw new Error(`Expected failed summary attempts >= 3, got ${failedSummary.attempts}.`);
    }

    console.log(
      `lesson-complete status=200 metrics accuracy=${completionSuccess.metrics.accuracyRatio} hint=${completionSuccess.metrics.hintDependency} time=${completionSuccess.metrics.timeManagement}`
    );
    console.log(
      `dispatch-success processed=${successDispatch.processed} sent=${successDispatch.sent} retried=${successDispatch.retried} failed=${successDispatch.failed}`
    );
    console.log(
      `retry-cycle statuses=${retryItem1.status},${retryItem2.status},${retryItem3.status} finalSummary=${failedSummary.status} attempts=${failedSummary.attempts}`
    );
  } finally {
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
