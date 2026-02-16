import { spawn } from "node:child_process";
import path from "node:path";

const PORT = Number(process.env.PHASE4_SMOKE_PORT ?? "3101");
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

  const recentLogs = logLines.slice(-30).join("");
  throw new Error(`Server did not start within timeout. Recent logs:\n${recentLogs}`);
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

  server.on("exit", (code) => {
    if (code && code !== 0) {
      logLines.push(`next start exited with code ${code}\n`);
    }
  });

  await waitForServer(logLines);
  return { server, logLines };
}

async function loginAsAdmin(client) {
  const csrfResponse = await client.request(`${BASE_URL}/api/auth/csrf`);
  const csrfPayload = await assertJson(csrfResponse);

  if (!csrfPayload.csrfToken) {
    throw new Error("CSRF token could not be retrieved.");
  }

  const loginBody = new URLSearchParams({
    csrfToken: csrfPayload.csrfToken,
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@murebbiye.local",
    password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!",
    callbackUrl: `${BASE_URL}/admin`,
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
    throw new Error(`Admin login failed: ${loginResponse.status}`);
  }

  const adminProbe = await client.request(`${BASE_URL}/admin`, {
    method: "GET",
    redirect: "manual"
  });

  if (adminProbe.status >= 300 && adminProbe.status < 400) {
    throw new Error(`Admin session was not established. Redirected with status ${adminProbe.status}.`);
  }
}

async function uploadCurriculumFixture(client) {
  const form = new FormData();
  const markdown = `# Daily routines\n\nStudents describe what they do every day.\n\nThey answer using complete sentences with one extra example.`;

  form.set("file", new File([Buffer.from(markdown, "utf-8")], "phase4-source.md", { type: "text/markdown" }));
  form.set("track", "ENGLISH");
  form.set("sourceLanguage", "en");
  form.set("title", `Phase 4 Source ${Date.now()}`);

  const response = await client.request(`${BASE_URL}/api/admin/curriculum/upload`, {
    method: "POST",
    body: form
  });

  const payload = await assertJson(response);

  if (response.status !== 200 || payload.document?.status !== "READY") {
    throw new Error(`Curriculum upload fixture failed: ${JSON.stringify(payload).slice(0, 280)}`);
  }

  return payload.document.id;
}

async function run() {
  const { server } = await startServer();

  try {
    const adminClient = createCookieClient();
    await loginAsAdmin(adminClient);
    await uploadCurriculumFixture(adminClient);

    const englishDraftResponse = await adminClient.request(`${BASE_URL}/api/admin/lessons/draft`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        track: "ENGLISH",
        locale: "en",
        focusTopic: "daily routines"
      })
    });

    const englishDraftPayload = await assertJson(englishDraftResponse);

    if (englishDraftResponse.status !== 200) {
      throw new Error(`ENGLISH draft request failed: ${JSON.stringify(englishDraftPayload).slice(0, 280)}`);
    }

    const englishRecord = englishDraftPayload.draft;
    const englishTemplate = englishRecord?.draft;

    if (
      englishTemplate?.ratio?.explainPercent !== 30 ||
      englishTemplate?.ratio?.practicePercent !== 70
    ) {
      throw new Error(`ENGLISH ratio check failed: ${JSON.stringify(englishTemplate?.ratio)}`);
    }

    if (
      englishTemplate?.schedule?.totalMinutes !== 35 ||
      englishTemplate?.schedule?.explainMinutes !== 7 ||
      englishTemplate?.schedule?.guidedPracticeMinutes !== 20 ||
      englishTemplate?.schedule?.independentTaskMinutes !== 8
    ) {
      throw new Error(`Micro-lesson schedule check failed: ${JSON.stringify(englishTemplate?.schedule)}`);
    }

    const aiDraftResponse = await adminClient.request(`${BASE_URL}/api/admin/lessons/draft`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        track: "AI_MODULE",
        locale: "tr",
        focusTopic: "sinif ici uygulama"
      })
    });

    const aiDraftPayload = await assertJson(aiDraftResponse);

    if (aiDraftResponse.status !== 200) {
      throw new Error(`AI_MODULE draft request failed: ${JSON.stringify(aiDraftPayload).slice(0, 280)}`);
    }

    const aiTemplate = aiDraftPayload.draft?.draft;

    if (aiTemplate?.ratio?.explainPercent !== 20 || aiTemplate?.ratio?.practicePercent !== 80) {
      throw new Error(`AI_MODULE ratio check failed: ${JSON.stringify(aiTemplate?.ratio)}`);
    }

    const listResponse = await adminClient.request(`${BASE_URL}/api/admin/lessons/draft?limit=10`, {
      method: "GET"
    });
    const listPayload = await assertJson(listResponse);

    if (listResponse.status !== 200 || !Array.isArray(listPayload.drafts)) {
      throw new Error(`Draft list request failed: ${JSON.stringify(listPayload).slice(0, 280)}`);
    }

    const generatedIds = [englishRecord.id, aiDraftPayload.draft.id];

    for (const lessonId of generatedIds) {
      if (!listPayload.drafts.some((draft) => draft.id === lessonId)) {
        throw new Error(`Draft ${lessonId} not found in list response.`);
      }
    }

    const detailResponse = await adminClient.request(
      `${BASE_URL}/api/admin/lessons/draft/${englishRecord.id}`,
      {
        method: "GET"
      }
    );
    const detailPayload = await assertJson(detailResponse);

    if (detailResponse.status !== 200 || detailPayload.draft?.id !== englishRecord.id) {
      throw new Error(`Draft detail response failed: ${JSON.stringify(detailPayload).slice(0, 280)}`);
    }

    const quizQuestions = detailPayload.draft?.draft?.sections?.miniAssessment?.questions;

    if (!Array.isArray(quizQuestions) || quizQuestions.length < 3) {
      throw new Error(`Mini assessment questions missing: ${JSON.stringify(quizQuestions)}`);
    }

    console.log(
      `english draft status=${englishDraftResponse.status} ratio=${englishTemplate.ratio.explainPercent}/${englishTemplate.ratio.practicePercent} schedule=${englishTemplate.schedule.totalMinutes}-${englishTemplate.schedule.explainMinutes}-${englishTemplate.schedule.guidedPracticeMinutes}-${englishTemplate.schedule.independentTaskMinutes}`
    );
    console.log(
      `ai draft status=${aiDraftResponse.status} ratio=${aiTemplate.ratio.explainPercent}/${aiTemplate.ratio.practicePercent}`
    );
    console.log(`list draft count=${listPayload.count}`);
    console.log(
      `detail draft id=${detailPayload.draft.id} miniAssessmentQuestions=${quizQuestions.length} persistence=${detailPayload.draft.persistence}`
    );
  } finally {
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
