import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = "http://localhost:3000";

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

async function assertJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON response, got: ${text.slice(0, 220)}`);
  }
}

async function run() {
  const tempDir = path.join(process.cwd(), "tmp-phase3");
  await mkdir(tempDir, { recursive: true });

  const markdownPath = path.join(tempDir, "sample.md");
  const pdfPath = path.join(tempDir, "dummy.pdf");
  const brokenPdfPath = path.join(tempDir, "broken.pdf");

  await writeFile(
    markdownPath,
    "# Present Simple\n\nI study English every day.\n\nShe plays basketball every week.",
    "utf-8"
  );

  const pdfDownload = await fetch(
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  );

  if (!pdfDownload.ok) {
    throw new Error(`Could not download PDF fixture: ${pdfDownload.status}`);
  }

  await writeFile(pdfPath, Buffer.from(await pdfDownload.arrayBuffer()));
  await writeFile(brokenPdfPath, Buffer.from("not-a-valid-pdf", "utf-8"));

  const csrfResponse = await request(`${BASE_URL}/api/auth/csrf`);
  const csrfPayload = await assertJson(csrfResponse);

  if (!csrfPayload.csrfToken) {
    throw new Error("CSRF token could not be retrieved.");
  }

  const loginBody = new URLSearchParams({
    csrfToken: csrfPayload.csrfToken,
    email: "admin@murebbiye.local",
    password: "ChangeMe123!",
    callbackUrl: `${BASE_URL}/admin`,
    json: "true"
  });

  const loginResponse = await request(`${BASE_URL}/api/auth/callback/credentials`, {
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

  const adminProbe = await request(`${BASE_URL}/admin`, {
    method: "GET",
    redirect: "manual"
  });

  if (adminProbe.status >= 300 && adminProbe.status < 400) {
    throw new Error(`Admin session was not established. Redirected with status ${adminProbe.status}.`);
  }

  async function uploadFile(filePath, fileName, mimeType, title) {
    const form = new FormData();
    const fileBuffer = await readFile(filePath);

    form.set("file", new File([fileBuffer], fileName, { type: mimeType }));
    form.set("track", "ENGLISH");
    form.set("sourceLanguage", "en");
    form.set("title", title);

    const response = await request(`${BASE_URL}/api/admin/curriculum/upload`, {
      method: "POST",
      body: form
    });

    return {
      status: response.status,
      body: await assertJson(response)
    };
  }

  const markdownUpload = await uploadFile(markdownPath, "sample.md", "text/markdown", "MD Fixture");
  const pdfUpload = await uploadFile(pdfPath, "dummy.pdf", "application/pdf", "PDF Fixture");
  const brokenUpload = await uploadFile(
    brokenPdfPath,
    "broken.pdf",
    "application/pdf",
    "Broken Fixture"
  );

  const listResponse = await request(`${BASE_URL}/api/admin/curriculum/list`);
  const listPayload = await assertJson(listResponse);

  if (!Array.isArray(listPayload.documents)) {
    throw new Error(`Unexpected list payload: ${JSON.stringify(listPayload).slice(0, 220)}`);
  }

  const failed = listPayload.documents.find((document) => document.status === "FAILED");

  if (!failed) {
    throw new Error("Expected at least one FAILED upload record.");
  }

  const retryResponse = await request(`${BASE_URL}/api/admin/curriculum/retry`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ documentId: failed.id })
  });

  const retryPayload = await assertJson(retryResponse);

  if (markdownUpload.status !== 200 || markdownUpload.body.document?.status !== "READY") {
    throw new Error(`Markdown upload failed: ${JSON.stringify(markdownUpload)}`);
  }

  if (pdfUpload.status !== 200 || pdfUpload.body.document?.status !== "READY") {
    throw new Error(`PDF upload failed: ${JSON.stringify(pdfUpload)}`);
  }

  if (brokenUpload.status !== 422 || brokenUpload.body.document?.status !== "FAILED") {
    throw new Error(`Broken PDF should fail with 422: ${JSON.stringify(brokenUpload)}`);
  }

  if (retryResponse.status !== 422 || retryPayload.document?.status !== "FAILED") {
    throw new Error(`Retry response should keep failed state: ${JSON.stringify(retryPayload)}`);
  }

  console.log(
    `markdown upload status=${markdownUpload.status} documentStatus=${markdownUpload.body.document.status} chunks=${markdownUpload.body.document.chunkCount}`
  );
  console.log(
    `pdf upload status=${pdfUpload.status} documentStatus=${pdfUpload.body.document.status} chunks=${pdfUpload.body.document.chunkCount}`
  );
  console.log(
    `broken pdf upload status=${brokenUpload.status} documentStatus=${brokenUpload.body.document.status} error=${brokenUpload.body.errors?.[0] ?? "n/a"}`
  );
  console.log(
    `list counts total=${listPayload.counts.total} ready=${listPayload.counts.ready} failed=${listPayload.counts.failed}`
  );
  console.log(
    `retry failed doc status=${retryResponse.status} result=${retryPayload.document.status} error=${retryPayload.errors?.[0] ?? "n/a"}`
  );

  await rm(tempDir, { recursive: true, force: true });
}

run().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
