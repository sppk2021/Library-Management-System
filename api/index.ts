/**
 * VERCEL ENTRY POINT
 * ----------------------------------------------------------------------------
 * On Vercel there is no always-running server. Instead, every request to /api/...
 * (see the "rewrites" in vercel.json) starts this small "serverless function",
 * which hands the request to the same Express app defined in server.ts.
 *
 * If the app cannot start (most often: DATABASE_URL is missing or wrong), we answer
 * with a readable JSON error instead of crashing, and log the details. They appear in
 * Vercel → project → Logs.
 */
import { getApp } from '../server.js'; // ".js" is required on Vercel (see note in server.ts)

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error: any) {
    console.error('Server start-up failed:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: `Server could not start (${error?.code || error?.name || 'unknown error'}). ` +
        'Check DATABASE_URL in the Vercel environment variables and the Vercel logs.',
    }));
  }
}
