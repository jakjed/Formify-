import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { RequestUser } from '../modules/identity/domain/identity.types';

type Bucket = { count: number; resetAt: number };

/**
 * Simple per-principal sliding window rate limit (PRD A-04).
 * Keyed by API key id or user id + tenant. In-memory is enough for Phase 1 single-node.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: RequestUser;
      ip?: string;
      headers: Record<string, string | undefined>;
    }>();

    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
    const max = Number(process.env.RATE_LIMIT_MAX ?? 120);
    if (!Number.isFinite(max) || max <= 0) return true;

    const user = req.user;
    const key = user
      ? `${user.tenantId}:${user.apiKeyId ?? user.id}`
      : `ip:${req.ip ?? req.headers['x-forwarded-for'] ?? 'anon'}`;

    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
