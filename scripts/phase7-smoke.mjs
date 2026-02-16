import { spawn } from "node:child_process";
import path from "node:path";

const PORT = Number(process.env.PHASE7_SMOKE_PORT ?? "3104");
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
      APP_BASE_URL: BASE_URL,
      ALLOW_ADMIN_RESET: "true"
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

async function uploadCurriculumFixture(adminClient) {
  const form = new FormData();
  const markdown =
    "Simple present describes daily routines. Use do/does for questions and add one clear example from student life.";

  form.set(
    "file",
    new File([Buffer.from(markdown, "utf-8")], `phase7-source-${Date.now()}.md`, {
      type: "text/markdown"
    })
  );
  form.set("track", "ENGLISH");
  form.set("sourceLanguage", "en");
  form.set("title", `Phase 7 Source ${Date.now()}`);

  const response = await adminClient.request(`${BASE_URL}/api/admin/curriculum/upload`, {
    method: "POST",
    body: form
  });

  const payload = await assertJson(response);

  if (response.status !== 200 || payload.document?.status !== "READY") {
    throw new Error(`Curriculum upload fixture failed: ${JSON.stringify(payload).slice(0, 320)}`);
  }
}

async function resetOps(adminClient) {
  const budgetReset = await adminClient.request(`${BASE_URL}/api/admin/budget/reset`, {
    method: "POST"
  });

  if (budgetReset.status !== 200) {
    throw new Error(`Budget reset failed with status ${budgetReset.status}`);
  }

  const perfReset = await adminClient.request(`${BASE_URL}/api/admin/performance/reset`, {
    method: "POST"
  });

  if (perfReset.status !== 200) {
    throw new Error(`Performance reset failed with status ${perfReset.status}`);
  }
}

async function resetPerformanceOnly(adminClient) {
  const response = await adminClient.request(`${BASE_URL}/api/admin/performance/reset`, {
    method: "POST"
  });

  if (response.status !== 200) {
    throw new Error(`Performance reset failed with status ${response.status}`);
  }
}

async function getBudgetStatus(adminClient) {
  const response = await adminClient.request(
    `${BASE_URL}/api/admin/budget/status?perLessonEstimateUsd=0.05`,
    {
      method: "GET"
    }
  );

  const payload = await assertJson(response);

  if (response.status !== 200 || !payload.status) {
    throw new Error(`Budget status failed: ${JSON.stringify(payload).slice(0, 300)}`);
  }

  return payload.status;
}

async function simulateSpend(adminClient, totalCostUsd) {
  const response = await adminClient.request(`${BASE_URL}/api/admin/budget/simulate`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      totalCostUsd,
      count: 1,
      requestType: "phase7_simulation"
    })
  });

  const payload = await assertJson(response);

  if (response.status !== 200 || !payload.status) {
    throw new Error(`Budget simulate failed: ${JSON.stringify(payload).slice(0, 300)}`);
  }

  return payload.status;
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
  return {
    status: response.status,
    payload
  };
}

async function runPerformanceProbe(adminClient, iterations = 20) {
  for (let index = 0; index < iterations; index += 1) {
    const response = await adminClient.request(
      `${BASE_URL}/api/admin/budget/status?perLessonEstimateUsd=0.05`,
      {
        method: "GET"
      }
    );

    if (response.status !== 200) {
      throw new Error(`Performance probe budget/status failed at iteration ${index + 1}`);
    }
  }
}

async function getPerformanceSummary(adminClient) {
  const response = await adminClient.request(
    `${BASE_URL}/api/admin/performance/summary?windowMinutes=30&targetMs=3000`,
    {
      method: "GET"
    }
  );

  const payload = await assertJson(response);

  if (response.status !== 200 || !payload.summary) {
    throw new Error(`Performance summary failed: ${JSON.stringify(payload).slice(0, 300)}`);
  }

  return payload.summary;
}

async function run() {
  const { server } = await startServer();

  try {
    const adminClient = createCookieClient();
    const studentClient = createCookieClient();

    await login(adminClient, "admin");
    await login(studentClient, "student");

    await resetOps(adminClient);
    await uploadCurriculumFixture(adminClient);

    const studentId = "env-student";

    const baseline = await getBudgetStatus(adminClient);

    if (baseline.mode !== "normal") {
      throw new Error(`Expected baseline mode=normal, got ${baseline.mode}`);
    }

    const normalDraft = await createLessonDraft(
      adminClient,
      studentId,
      `Phase 7 normal mode ${Date.now()}`
    );

    if (normalDraft.status !== 200 || normalDraft.payload.draft?.budgetModeAtStart !== "NORMAL") {
      throw new Error(`Normal mode draft failed: ${JSON.stringify(normalDraft.payload).slice(0, 320)}`);
    }

    const statusAfterNormal = await getBudgetStatus(adminClient);
    const target80Spend = 8.2;
    const additionalFor80 = Math.max(0, Number((target80Spend - statusAfterNormal.monthlySpentUsd).toFixed(4)));

    if (additionalFor80 > 0) {
      await simulateSpend(adminClient, additionalFor80);
    }

    const status80 = await getBudgetStatus(adminClient);

    if (status80.mode !== "short_response_low_cost_model") {
      throw new Error(`Expected 80% mode short_response_low_cost_model, got ${status80.mode}`);
    }

    const shortDraft = await createLessonDraft(
      adminClient,
      studentId,
      `Phase 7 short mode ${Date.now()}`
    );

    if (
      shortDraft.status !== 200 ||
      shortDraft.payload.draft?.budgetModeAtStart !== "SHORT_RESPONSE_LOW_COST"
    ) {
      throw new Error(`Short mode draft failed: ${JSON.stringify(shortDraft.payload).slice(0, 320)}`);
    }

    const shortActivityCount =
      shortDraft.payload.draft?.draft?.sections?.guidedPractice?.activities?.length ?? 0;

    if (shortActivityCount > 3) {
      throw new Error(`Short mode should compact guided activities (<=3), got ${shortActivityCount}.`);
    }

    const statusBefore100 = await getBudgetStatus(adminClient);
    const target100Spend = 10.2;
    const additionalFor100 = Math.max(
      0,
      Number((target100Spend - statusBefore100.monthlySpentUsd).toFixed(4))
    );

    if (additionalFor100 > 0) {
      await simulateSpend(adminClient, additionalFor100);
    }

    const status100 = await getBudgetStatus(adminClient);

    if (status100.mode !== "review_only" || status100.shouldBlockNewGeneration !== true) {
      throw new Error(
        `Expected 100% mode review_only with generation block, got mode=${status100.mode}`
      );
    }

    const blockedDraft = await createLessonDraft(
      adminClient,
      studentId,
      `Phase 7 blocked mode ${Date.now()}`
    );

    if (blockedDraft.status !== 422) {
      throw new Error(`Expected blocked generation status=422, got ${blockedDraft.status}`);
    }

    const blockedErrorText = JSON.stringify(blockedDraft.payload.errors ?? []);

    if (!blockedErrorText.includes("Budget cap reached")) {
      throw new Error(`Blocked generation error mismatch: ${blockedErrorText}`);
    }

    const reviewAssistResponse = await studentClient.request(
      `${BASE_URL}/api/student/assistant/respond`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          track: "ENGLISH",
          locale: "en",
          question: "How do we form questions with do and does in simple present?"
        })
      }
    );

    const reviewAssistPayload = await assertJson(reviewAssistResponse);

    if (reviewAssistResponse.status !== 200 || !reviewAssistPayload.reply) {
      throw new Error(`Review mode assistant should remain available: ${JSON.stringify(reviewAssistPayload).slice(0, 320)}`);
    }

    await resetPerformanceOnly(adminClient);
    await runPerformanceProbe(adminClient, 20);
    const performanceSummary = await getPerformanceSummary(adminClient);

    if (!performanceSummary.passesTarget || performanceSummary.medianMs > 3000) {
      throw new Error(
        `Median API latency target failed: median=${performanceSummary.medianMs} target=3000`
      );
    }

    if (performanceSummary.count < 20) {
      throw new Error(`Expected at least 20 performance records, got ${performanceSummary.count}`);
    }

    console.log(
      `budget modes baseline=${baseline.mode} at80=${status80.mode} at100=${status100.mode} blockedDraft=${blockedDraft.status}`
    );
    console.log(
      `short-mode draft budgetMode=${shortDraft.payload.draft.budgetModeAtStart} guidedActivities=${shortActivityCount}`
    );
    console.log(
      `review-mode assistant status=${reviewAssistResponse.status} decision=${reviewAssistPayload.reply.status}`
    );
    console.log(
      `performance summary count=${performanceSummary.count} median=${performanceSummary.medianMs} p95=${performanceSummary.p95Ms} target=${performanceSummary.targetMs}`
    );

    await resetOps(adminClient);
  } finally {
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
