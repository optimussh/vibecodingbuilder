#!/usr/bin/env node
/** wait-http.mjs <url> [timeoutMs] — exit 0 when HTTP responds */
const url = process.argv[2];
const timeoutMs = Number(process.argv[3] ?? 120000);
if (!url) {
  console.error("usage: wait-http.mjs <url> [timeoutMs]");
  process.exit(2);
}
const deadline = Date.now() + timeoutMs;
while (Date.now() < deadline) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (res.status > 0) {
      console.log(`[wait] ok ${url} → ${res.status}`);
      process.exit(0);
    }
  } catch {
    // retry
  }
  await new Promise((r) => setTimeout(r, 700));
}
console.error(`[wait] timeout ${url}`);
process.exit(1);
