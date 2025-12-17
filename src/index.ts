import { Application } from './application';
import { dailyFan } from './fan/daily-fan';
import { weeklyFan } from './fan/weekly-fan';

export default {
  /**
   * Every request to a worker will start in the `fetch` method.
   * Verify the signature with the request, and dispatch to the router.
   */
  async fetch(request, env, executionContext): Promise<Response> {
    return new Application({ env, executionContext }).handleRequest(request);
  },
  async scheduled(event, env): Promise<void> {
    console.log(`Running scheduled event: ${event.cron}`);

    switch (event.cron) {
      case '0 17 * * *':
        await dailyFan({ env });
        break;
      case '5 17 * * 1':
        await weeklyFan({ env });
        break;
    }
  }
} satisfies ExportedHandler<Env>;
