import asyncio
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import math
import random

from redis.asyncio import Redis


TOKEN_BUCKET_SCRIPT = """
local redis_time = redis.call('TIME')
local now = tonumber(redis_time[1]) + tonumber(redis_time[2]) / 1000000
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])
local values = redis.call('HMGET', KEYS[1], 'tokens', 'updated_at')
local tokens = tonumber(values[1]) or capacity
local updated_at = tonumber(values[2]) or now
tokens = math.min(capacity, tokens + math.max(0, now - updated_at) * refill_rate)
local allowed = 0
local wait_seconds = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
else
  wait_seconds = (requested - tokens) / refill_rate
end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'updated_at', now)
redis.call('EXPIRE', KEYS[1], math.ceil(capacity / refill_rate * 2))
return {allowed, wait_seconds}
"""


DEFAULT_OPERATION_LIMITS = {
    "listings.getListingsItem": (5.0, 10),
    "listings.searchListingsItems": (5.0, 5),
    "fba.getInventorySummaries": (2.0, 2),
    "sales.getOrderMetrics": (0.5, 15),
    "feeds.createFeed": (0.0083, 15),
    "feeds.createFeedDocument": (0.5, 15),
    "feeds.getFeedDocument": (0.0222, 10),
    "feeds.JSON_LISTINGS_FEED": (1 / 120, 1),
}


class RateLimitTimeout(TimeoutError):
    pass


class RedisTokenBucket:
    """Distributed per-seller/per-operation limiter; Redis failure is fail-closed."""

    def __init__(self, redis: Redis, prefix: str = "amzsphere:spapi:bucket"):
        self.redis = redis
        self.prefix = prefix

    async def acquire(
        self,
        seller_key: str,
        operation: str,
        rate: float | None = None,
        capacity: int | None = None,
        timeout: float = 300,
    ) -> None:
        configured_rate, configured_capacity = DEFAULT_OPERATION_LIMITS.get(operation, (1.0, 1))
        rate = rate or configured_rate
        capacity = capacity or configured_capacity
        if rate <= 0 or capacity < 1:
            raise ValueError("Token bucket rate and capacity must be positive")

        key = f"{self.prefix}:{seller_key}:{operation}"
        deadline = asyncio.get_running_loop().time() + timeout
        while True:
            result = await self.redis.eval(
                TOKEN_BUCKET_SCRIPT,
                1,
                key,
                capacity,
                rate,
                1,
            )
            allowed, wait_seconds = int(result[0]), float(result[1])
            if allowed:
                return
            remaining = deadline - asyncio.get_running_loop().time()
            if remaining <= 0:
                raise RateLimitTimeout(f"Rate-limit wait timed out for {operation}")
            await asyncio.sleep(min(max(wait_seconds, 0.01), remaining, 5.0))


def retry_delay(attempt: int, retry_after: str | None = None, cap: float = 60) -> float:
    if retry_after:
        try:
            return min(max(float(retry_after), 0), cap)
        except ValueError:
            try:
                retry_at = parsedate_to_datetime(retry_after)
                if retry_at.tzinfo is None:
                    retry_at = retry_at.replace(tzinfo=timezone.utc)
                return min(max((retry_at - datetime.now(timezone.utc)).total_seconds(), 0), cap)
            except (TypeError, ValueError, OverflowError):
                pass
    return min(2**attempt + random.uniform(0, 0.5), cap)