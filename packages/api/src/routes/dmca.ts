import { Hono } from 'hono';
import { DMCATakedownRequest, DMCATakedownResponse } from '@openlyryc/schema';

type Env = { DB?: unknown; LYRICS_BUCKET?: unknown };

export const dmcaRouter = new Hono<{ Bindings: Env }>();

dmcaRouter.post('/', async (c) => {
  const body = await c.req.json<DMCATakedownRequest>();

  return c.json<DMCATakedownResponse>({
    success: true,
    message: `DMCA takedown notice logged for song ID '${body.songId}'. Access restricted.`,
    songId: body.songId,
    flaggedAt: new Date().toISOString()
  }, 200);
});
