import startServer from '../server';

// Vercel serverless function entrypoint
// We await the server bootstrap then pass the unhandled req/res to Express
let appInstance: any = null;

export default async function handler(req: any, res: any) {
  if (!appInstance) {
    appInstance = await startServer;
  }
  return appInstance(req, res);
}
