import { Run } from '../src/lib/ericchase/Platform/Bun/Process.js';

await Run('bun update');
await Run('bun run format');
await Run('bun run build');
await Run('bun run format');
