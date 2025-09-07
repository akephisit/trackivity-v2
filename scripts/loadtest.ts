/*
  Simple HTTP load tester using Bun/Node fetch.
  Usage examples:
    bun run scripts/loadtest.ts --url http://localhost:8080 --path / --vus 100 --duration 60
    bun run scripts/loadtest.ts --url http://localhost:8080 --path /api/organizations --vus 50 --duration 30

  Notes:
  - For realistic results, run against a production build and a real DB.
  - Ensure the target URL is reachable from the machine running this test.
*/

type Args = {
	url: string;
	path?: string;
	method?: string;
	body?: string;
	headers?: string; // JSON string
	vus?: string | number; // number of concurrent workers
	duration?: string | number; // seconds
	timeout?: string | number; // per-request timeout ms
	insecure?: string; // allow self-signed TLS (not used here, Bun fetch ignores)
};

function parseArgs(argv: string[]): Args {
	const out: any = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith('--')) continue;
		const key = a.slice(2);
		const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
		out[key] = val;
	}
	return out as Args;
}

function hrtimeMs(start: bigint, end: bigint) {
	return Number(end - start) / 1e6;
}

function percentile(values: number[], p: number) {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
	return sorted[idx];
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const baseUrl = args.url;
	if (!baseUrl) {
		console.error('Missing --url e.g. --url http://localhost:8080');
		process.exit(1);
	}
	const path = args.path ?? '/';
	const vus = Number(args.vus ?? 20);
	const durationSec = Number(args.duration ?? 30);
	const method = (args.method ?? 'GET').toUpperCase();
	const body = args.body;
	const headers = args.headers ? (JSON.parse(args.headers) as Record<string, string>) : undefined;
	const timeoutMs = Number(args.timeout ?? 10000);

	const target = baseUrl.replace(/\/$/, '') + path;
	console.log(`Target: ${target} | VUs: ${vus} | Duration: ${durationSec}s | Method: ${method}`);

	let total = 0;
	let ok = 0;
	let fail = 0;
	let bytes = 0;
	const latencies: number[] = [];

	const abortPerRequest = () => new AbortController();

	async function worker() {
		const endAt = Date.now() + durationSec * 1000;
		while (Date.now() < endAt) {
			const start = process.hrtime.bigint();
			const ac = abortPerRequest();
			const to = setTimeout(() => ac.abort('timeout'), timeoutMs);
			try {
				const res = await fetch(target, {
					method,
					headers,
					body: body ? (method === 'GET' ? undefined : body) : undefined,
					signal: ac.signal as any
				});
				const text = await res.text();
				bytes += text.length;
				const end = process.hrtime.bigint();
				latencies.push(hrtimeMs(start, end));
				total++;
				if (res.ok) ok++;
				else fail++;
			} catch (e) {
				const end = process.hrtime.bigint();
				latencies.push(hrtimeMs(start, end));
				total++;
				fail++;
			} finally {
				clearTimeout(to);
			}
		}
	}

	const startAt = Date.now();
	await Promise.all(Array.from({ length: vus }, () => worker()));
	const elapsedSec = (Date.now() - startAt) / 1000;

	const rps = total / elapsedSec;
	const p50 = percentile(latencies, 50);
	const p90 = percentile(latencies, 90);
	const p95 = percentile(latencies, 95);
	const p99 = percentile(latencies, 99);
	const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
	const min = latencies.length ? Math.min(...latencies) : 0;
	const max = latencies.length ? Math.max(...latencies) : 0;

	console.log('\n==== Load Test Result ====');
	console.log(`Elapsed: ${elapsedSec.toFixed(2)}s`);
	console.log(`Requests: total=${total} ok=${ok} fail=${fail}`);
	console.log(`Throughput: ${rps.toFixed(2)} req/s`);
	console.log(
		`Latency (ms): p50=${p50.toFixed(1)} p90=${p90.toFixed(1)} p95=${p95.toFixed(1)} p99=${p99.toFixed(1)} avg=${avg.toFixed(1)} min=${min.toFixed(1)} max=${max.toFixed(1)}`
	);
	console.log(`Bandwidth: ${(bytes / elapsedSec / 1024).toFixed(2)} KiB/s`);

	// Simple guidance based on SLO: p95 < 300ms and fail rate < 1%
	const failRate = total ? (fail / total) * 100 : 0;
	const meetsSLO = p95 < 300 && failRate < 1;
	console.log(
		`SLO check (p95<300ms & fail<1%): ${meetsSLO ? 'PASS' : 'FAIL'} (fail=${failRate.toFixed(2)}%)`
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
