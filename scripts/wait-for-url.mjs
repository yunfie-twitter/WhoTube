const url = process.argv[2];
const timeoutMs = Number(process.argv[3] || 30_000);
const intervalMs = 500;
const startedAt = Date.now();

if (!url) {
  console.error('Usage: node scripts/wait-for-url.mjs <url> [timeoutMs]');
  process.exit(1);
}

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (response.ok) {
      process.exit(0);
    }
  } catch {
    // Server is not accepting connections yet.
  }

  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

console.error(`Timed out waiting for ${url}`);
process.exit(1);
