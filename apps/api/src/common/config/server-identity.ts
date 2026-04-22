import type { Env } from './env.schema';

let serverHostname = 'api-local';

export function initServerIdentity(env: Env): void {
  serverHostname = env.SERVER_HOSTNAME;
}

export function getServerHostname(): string {
  return serverHostname;
}
