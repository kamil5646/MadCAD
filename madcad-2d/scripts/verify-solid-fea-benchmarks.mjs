import process from 'node:process';
import { runSolidFeaBenchmarks } from '../src/cad-core/solid-fea-benchmarks.js';

const report = runSolidFeaBenchmarks();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
