import { Application } from './application';
import { dailyFan } from './daily-fan';

export default {
  /**
   * Every request to a worker will start in the `fetch` method.
   * Verify the signature with the request, and dispatch to the router.
   */
  async fetch(request, env, executionContext): Promise<Response> {
    return new Application({ env, executionContext }).handleRequest(request);
  },
  async scheduled(event, env, ctx): Promise<void> {
    await dailyFan(env);
  }
} satisfies ExportedHandler<Env>;
