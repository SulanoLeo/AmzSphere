import asyncio
import json
import secrets

import httpx
from redis.asyncio import Redis


LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token"


class LwaTokenProvider:
    def __init__(
        self,
        redis: Redis,
        client_id: str,
        client_secret: str,
        token_skew_seconds: int = 120,
        http_client: httpx.AsyncClient | None = None,
    ):
        self.redis = redis
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_skew_seconds = token_skew_seconds
        self.http_client = http_client

    async def get_access_token(self, seller_key: str, refresh_token: str) -> str:
        cache_key = f"amzsphere:lwa:access:{seller_key}"
        cached = await self.redis.get(cache_key)
        if cached:
            return cached.decode() if isinstance(cached, bytes) else str(cached)

        lock_key = f"{cache_key}:lock"
        lock_value = secrets.token_urlsafe(24)
        locked = await self.redis.set(lock_key, lock_value, nx=True, ex=30)
        if not locked:
            for _ in range(40):
                await asyncio.sleep(0.25)
                cached = await self.redis.get(cache_key)
                if cached:
                    return cached.decode() if isinstance(cached, bytes) else str(cached)
            raise TimeoutError("Timed out waiting for concurrent LWA token refresh")

        client = self.http_client or httpx.AsyncClient(timeout=httpx.Timeout(15))
        try:
            response = await client.post(
                LWA_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
            )
            response.raise_for_status()
            payload = response.json()
            access_token = payload.get("access_token")
            expires_in = int(payload.get("expires_in", 0))
            if not access_token or expires_in <= self.token_skew_seconds:
                raise ValueError("LWA returned an invalid access token lifetime")
            await self.redis.setex(cache_key, expires_in - self.token_skew_seconds, access_token)
            return access_token
        finally:
            if self.http_client is None:
                await client.aclose()
            current_lock = await self.redis.get(lock_key)
            if current_lock in (lock_value, lock_value.encode()):
                await self.redis.delete(lock_key)


def serialize_token_response(payload: dict) -> str:
    """Small helper useful for redacted tests; never log the returned token JSON."""
    return json.dumps({"expires_in": payload.get("expires_in"), "token_type": payload.get("token_type")})