import { MiddlewareHandler } from 'hono';

interface TokenBucketRecord {
  tokens: number;
  lastRefillTime: number;
  queueUntil: number;
  consecutiveQueued: number;
}

// In-memory token bucket & queue tracking per Worker isolate (L1 cache)
const clientBuckets = new Map<string, TokenBucketRecord>();

// Cleanup stale in-memory records periodically
function cleanupStaleRecords(now: number) {
  if (clientBuckets.size > 5000) {
    for (const [key, record] of clientBuckets.entries()) {
      if (now - record.lastRefillTime > 30000 && record.queueUntil <= now) {
        clientBuckets.delete(key);
      }
    }
  }
}

/**
 * Extracts device or network client identifier.
 * Priority:
 * 1. Device / App Header: X-OpenLyryc-Device-Id, X-Device-Id, X-Client-Id, X-OpenLyryc-App
 *    (Allows multiple devices on the same WiFi / CGNAT to have independent rate limits)
 * 2. IP Address: CF-Connecting-IP, x-real-ip, x-forwarded-for
 */
export function extractClientIdentifier(c: any): { key: string; type: 'device' | 'ip'; id: string } {
  const rawDevId =
    c.req.header('X-OpenLyryc-Device-Id') ||
    c.req.header('X-Device-Id') ||
    c.req.header('X-Client-Id') ||
    c.req.header('X-OpenLyryc-App') ||
    c.req.query('deviceId') ||
    c.req.query('clientId');

  if (rawDevId) {
    const clean = String(rawDevId).trim().replace(/[^a-zA-Z0-9_\-\.:]/g, '').slice(0, 64);
    if (clean.length >= 3) {
      return { key: `dev:${clean}`, type: 'device', id: clean };
    }
  }

  const ip =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('x-real-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1';

  return { key: `ip:${ip}`, type: 'ip', id: ip };
}

export interface RateLimitOptions {
  /** Maximum sustained requests per second per client (default: 3) */
  requestsPerSecond?: number;
  /** Maximum burst tokens allowed to accumulate (default: 4) */
  burstCapacity?: number;
  /** Whether requests exceeding rate limit should enter a throttle queue (default: true) */
  enableQueue?: boolean;
  /** Maximum milliseconds a request can wait in the queue before returning HTTP 429 (default: 2500ms) */
  maxQueueWaitMs?: number;
  /** Maximum consecutive queue penalties allowed before triggering HTTP 429 and global KV block (default: 5) */
  maxConsecutivePenalties?: number;
  /** Legacy window compatibility */
  limit?: number;
  windowSeconds?: number;
}

/**
 * Strict 3 req/s Fair Queue Rate Limiter with:
 * 1. Global Multi-Datacenter Coordination (Cloudflare KV shared cooldown).
 * 2. App & Device Header isolation (prevents shared WiFi / cellular NAT locks).
 * 3. Progressive Backpressure (exponential latency penalty on sustained flooding).
 */
export function rateLimit(options: RateLimitOptions = {}): MiddlewareHandler {
  const requestsPerSecond =
    options.requestsPerSecond ??
    (options.limit && options.windowSeconds ? options.limit / options.windowSeconds : 3);

  const burstCapacity = options.burstCapacity ?? (options.limit ? Math.min(options.limit, 10) : 4);
  const enableQueue = options.enableQueue !== false;
  const maxQueueWaitMs = options.maxQueueWaitMs ?? 2500;
  const maxConsecutivePenalties = options.maxConsecutivePenalties ?? 5;
  const tokenIntervalMs = 1000 / Math.max(0.1, requestsPerSecond);

  return async (c, next) => {
    const client = extractClientIdentifier(c);
    const now = Date.now();
    cleanupStaleRecords(now);

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 1: Global Multi-Datacenter Coordination (Cloudflare KV L2 Check)
    // ─────────────────────────────────────────────────────────────────────────
    const kv = (c.env as any)?.RATE_LIMIT_KV;
    if (kv && typeof kv.get === 'function') {
      try {
        const isGloballyBlocked = await kv.get(`rl:block:${client.key}`);
        if (isGloballyBlocked) {
          c.header('X-RateLimit-Limit', requestsPerSecond.toString());
          c.header('X-RateLimit-Remaining', '0');
          c.header('X-RateLimit-Client-Key', client.key);
          c.header('X-RateLimit-Client-Type', client.type);
          c.header('Retry-After', '5');

          return c.json(
            {
              error: 'Too Many Requests',
              message: `Client ${client.key} is globally throttled across edge nodes. Please slow down.`,
              limit: requestsPerSecond,
              retryAfter: 5,
            },
            429
          );
        }
      } catch {
        // Fallback gracefully to local isolate if KV lookup times out or fails
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 2: Local Token Bucket & Progressive Queue Scheduling
    // ─────────────────────────────────────────────────────────────────────────
    let bucket = clientBuckets.get(client.key);

    if (!bucket) {
      bucket = {
        tokens: burstCapacity - 1,
        lastRefillTime: now,
        queueUntil: now,
        consecutiveQueued: 0,
      };
      clientBuckets.set(client.key, bucket);

      c.header('X-RateLimit-Limit', requestsPerSecond.toString());
      c.header('X-RateLimit-Remaining', Math.floor(bucket.tokens).toString());
      c.header('X-RateLimit-Reset', '1');
      c.header('X-RateLimit-Queue-Delay', '0ms');
      c.header('X-RateLimit-Client-Type', client.type);

      return await next();
    }

    // Refill tokens based on elapsed time since last refill
    const elapsed = Math.max(0, now - bucket.lastRefillTime);
    bucket.tokens = Math.min(burstCapacity, bucket.tokens + elapsed * (requestsPerSecond / 1000));
    bucket.lastRefillTime = now;

    // Check if client can be served immediately
    if (bucket.tokens >= 1 && bucket.queueUntil <= now) {
      bucket.tokens -= 1;
      bucket.queueUntil = now;
      bucket.consecutiveQueued = 0; // Reset consecutive penalty counter

      c.header('X-RateLimit-Limit', requestsPerSecond.toString());
      c.header('X-RateLimit-Remaining', Math.floor(bucket.tokens).toString());
      c.header('X-RateLimit-Reset', '1');
      c.header('X-RateLimit-Queue-Delay', '0ms');
      c.header('X-RateLimit-Client-Type', client.type);

      return await next();
    }

    // Rate limit exceeded: calculate required queue delay
    if (!enableQueue) {
      c.header('Retry-After', '1');
      return c.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit of ${requestsPerSecond} req/s exceeded. Please slow down.`,
          retryAfter: 1,
        },
        429
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 3: Progressive Backpressure (Exponential Latency Multiplier)
    // ─────────────────────────────────────────────────────────────────────────
    bucket.consecutiveQueued += 1;

    // Multiplier scales: 1st=1.0x (333ms), 2nd=1.5x (500ms), 3rd=2.3x (765ms), 4th=3.3x (1100ms)
    const penaltyMultiplier = Math.min(5.0, 1.0 + Math.pow(bucket.consecutiveQueued - 1, 1.4) * 0.5);

    const queueBase = Math.max(now, bucket.queueUntil);
    const deficitTokens = Math.max(0.5, 1 - bucket.tokens);
    const deficitWaitMs = Math.round(deficitTokens * tokenIntervalMs * penaltyMultiplier);
    const scheduledStartTime = Math.max(queueBase, now + deficitWaitMs);
    const waitMs = Math.max(0, scheduledStartTime - now);

    // If wait time exceeds the maximum tolerable queue delay OR consecutive offenses reach threshold, reject with HTTP 429
    if (waitMs > maxQueueWaitMs || bucket.consecutiveQueued >= maxConsecutivePenalties) {
      const retryAfterSec = Math.max(1, Math.ceil(waitMs / 1000));
      c.header('X-RateLimit-Limit', requestsPerSecond.toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', retryAfterSec.toString());
      c.header('X-RateLimit-Client-Type', client.type);
      c.header('Retry-After', retryAfterSec.toString());

      // Propagate global block to Cloudflare KV for 60s (Cloudflare KV minimum TTL) to shield all 300+ edge colos
      if (kv && typeof kv.put === 'function') {
        try {
          await kv.put(`rl:block:${client.key}`, '1', { expirationTtl: 60 });
        } catch (err) {
          console.warn('[RATE_LIMIT_KV] Global block write error:', err);
        }
      }

      return c.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit of ${requestsPerSecond} req/s exceeded. ${
            bucket.consecutiveQueued >= maxConsecutivePenalties
              ? `Exceeded maximum consecutive rate limit offenses (${bucket.consecutiveQueued}/${maxConsecutivePenalties}).`
              : `Progressive queue wait exceeded maximum threshold (${waitMs}ms > ${maxQueueWaitMs}ms).`
          } Cooldown active. Please slow down.`,
          limit: requestsPerSecond,
          retryAfter: retryAfterSec,
          queueWaitMs: waitMs,
          consecutivePenalties: bucket.consecutiveQueued,
        },
        429
      );
    }

    // Reserve slot in queue
    bucket.queueUntil = scheduledStartTime + tokenIntervalMs;
    bucket.tokens = Math.max(0, bucket.tokens - 1);

    c.header('X-RateLimit-Limit', requestsPerSecond.toString());
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-Reset', Math.max(1, Math.ceil(waitMs / 1000)).toString());
    c.header('X-RateLimit-Queue-Delay', `${waitMs}ms`);
    c.header('X-RateLimit-Client-Type', client.type);
    c.header('X-RateLimit-Consecutive-Penalties', bucket.consecutiveQueued.toString());

    // Artificial progressive queue delay ("compensate free tier with latency/loss")
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    return await next();
  };
}
