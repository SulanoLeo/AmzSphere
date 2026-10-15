import asyncio
import json
import random
import time
from urllib.parse import quote, urlencode

import boto3
import httpx
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.credentials import Credentials

from backend.app.config import Settings, get_settings
from backend.app.services.lwa import LwaTokenProvider
from backend.app.services.rate_limiter import RedisTokenBucket, retry_delay


TRANSIENT_STATUSES = {429, 500, 502, 503, 504}
FEED_TYPE_JSON_LISTINGS = "JSON_LISTINGS_FEED"


class SpApiDisabled(RuntimeError):
    pass


class SpApiClient:
    def __init__(
        self,
        seller_id: str,
        marketplace_id: str,
        region: str,
        endpoint: str,
        refresh_token: str,
        redis,
        token_provider: LwaTokenProvider,
        limiter: RedisTokenBucket,
        settings: Settings | None = None,
        http_client: httpx.AsyncClient | None = None,
    ):
        self.seller_id = seller_id
        self.marketplace_id = marketplace_id
        self.region = region
        self.endpoint = endpoint.rstrip("/")
        self.refresh_token = refresh_token
        self.redis = redis
        self.token_provider = token_provider
        self.limiter = limiter
        self.settings = settings or get_settings()
        self.http_client = http_client
        self._assumed_credentials: Credentials | None = None
        self._assumed_credentials_expiry = 0.0

    def _ensure_live_enabled(self, write: bool = False) -> None:
        if not self.settings.sp_api_enabled:
            raise SpApiDisabled("SP-API integration is disabled")
        if write and self.settings.sp_api_dry_run:
            raise SpApiDisabled("SP-API writes are disabled in dry-run mode")

    def _aws_credentials(self):
        session = boto3.Session()
        if self.settings.sp_api_role_arn:
            if self._assumed_credentials and time.time() < self._assumed_credentials_expiry - 60:
                return self._assumed_credentials
            source_credentials = session.get_credentials()
            if source_credentials is None:
                raise RuntimeError("No source AWS credentials found for STS role assumption")
            assumed = session.client("sts", region_name=self.settings.sp_api_aws_region).assume_role(
                RoleArn=self.settings.sp_api_role_arn,
                RoleSessionName="AmzSphereSpApi",
                DurationSeconds=3600,
            )["Credentials"]
            self._assumed_credentials = Credentials(
                assumed["AccessKeyId"],
                assumed["SecretAccessKey"],
                assumed["SessionToken"],
            )
            self._assumed_credentials_expiry = assumed["Expiration"].timestamp()
            return self._assumed_credentials
        return session.get_credentials()

    def _sign(self, method: str, url: str, body: bytes, access_token: str, credentials) -> dict[str, str]:
        if credentials is None:
            raise RuntimeError("No AWS credentials found in the workload identity chain")
        headers = {
            "host": httpx.URL(url).host,
            "user-agent": self.settings.sp_api_user_agent,
            "x-amz-access-token": access_token,
            "content-type": "application/json; charset=utf-8",
        }
        request = AWSRequest(method=method, url=url, data=body or None, headers=headers)
        SigV4Auth(credentials.get_frozen_credentials(), "execute-api", self.region).add_auth(request)
        return dict(request.headers.items())

    async def request(
        self,
        method: str,
        path: str,
        operation: str,
        params: dict | None = None,
        json_body: dict | None = None,
    ) -> dict:
        self._ensure_live_enabled(write=method.upper() != "GET")
        query = f"?{urlencode(params, doseq=True)}" if params else ""
        url = f"{self.endpoint}{path}{query}"
        body = json.dumps(json_body, separators=(",", ":")).encode("utf-8") if json_body is not None else b""
        access_token = await self.token_provider.get_access_token(self.seller_id, self.refresh_token)
        client = self.http_client or httpx.AsyncClient(timeout=httpx.Timeout(40))
        try:
            for attempt in range(self.settings.sp_api_max_retries + 1):
                await self.limiter.acquire(self.seller_id, operation)
                credentials = await asyncio.to_thread(self._aws_credentials)
                headers = self._sign(method, url, body, access_token, credentials)
                response = await client.request(method, url, headers=headers, content=body or None)
                if response.status_code not in TRANSIENT_STATUSES or attempt >= self.settings.sp_api_max_retries:
                    response.raise_for_status()
                    return response.json() if response.content else {}
                delay = retry_delay(attempt, response.headers.get("Retry-After"))
                await asyncio.sleep(delay + random.uniform(0, 0.35))
            raise RuntimeError("SP-API retry loop exhausted unexpectedly")
        finally:
            if self.http_client is None:
                await client.aclose()

    async def get_listing_item(self, sku: str) -> dict:
        path = f"/listings/2021-08-01/items/{quote(self.seller_id, safe='')}/{quote(sku, safe='')}"
        return await self.request(
            "GET",
            path,
            "listings.getListingsItem",
            params={"marketplaceIds": self.marketplace_id, "includedData": "summaries,attributes,issues"},
        )

    async def search_listing_items(self, page_token: str | None = None) -> dict:
        params = {"pageSize": 20}
        if page_token:
            params = {"pageToken": page_token}
        else:
            params.update({
                "marketplaceIds": self.marketplace_id,
                "includedData": "summaries,attributes,fulfillmentAvailability,productTypes",
                "sortBy": "sku",
                "sortOrder": "ASC",
            })
        return await self.request(
            "GET",
            f"/listings/2021-08-01/items/{quote(self.seller_id, safe='')}",
            "listings.searchListingsItems",
            params=params,
        )

    async def get_fba_inventory_summaries(self, seller_skus: list[str]) -> dict:
        return await self.request(
            "GET",
            "/fba/inventory/v1/summaries",
            "fba.getInventorySummaries",
            params={
                "details": "true",
                "granularityType": "Marketplace",
                "granularityId": self.marketplace_id,
                "marketplaceIds": self.marketplace_id,
                "sellerSkus": seller_skus,
            },
        )

    async def get_order_metrics(self, sku: str, interval: str) -> dict:
        return await self.request(
            "GET",
            "/sales/v1/orderMetrics",
            "sales.getOrderMetrics",
            params={
                "marketplaceIds": self.marketplace_id,
                "interval": interval,
                "granularity": "Day",
                "granularityTimeZone": "UTC",
                "buyerType": "All",
                "sku": sku,
            },
        )

    async def submit_json_listings_feed(self, feed_document: dict) -> dict:
        self._ensure_live_enabled(write=True)
        await self.limiter.acquire(self.seller_id, "feeds.JSON_LISTINGS_FEED")
        document = await self.request(
            "POST",
            "/feeds/2021-06-30/documents",
            "feeds.createFeedDocument",
            json_body={"contentType": "application/json; charset=UTF-8"},
        )
        document_bytes = json.dumps(feed_document, separators=(",", ":")).encode("utf-8")
        upload_client = self.http_client or httpx.AsyncClient(timeout=httpx.Timeout(60))
        try:
            upload_response = await upload_client.put(
                document["url"],
                content=document_bytes,
                headers={"Content-Type": "application/json; charset=UTF-8"},
            )
            upload_response.raise_for_status()
        finally:
            if self.http_client is None:
                await upload_client.aclose()

        return await self.request(
            "POST",
            "/feeds/2021-06-30/feeds",
            "feeds.createFeed",
            json_body={
                "feedType": FEED_TYPE_JSON_LISTINGS,
                "marketplaceIds": [self.marketplace_id],
                "inputFeedDocumentId": document["feedDocumentId"],
            },
        )

    async def get_feed_document(self, feed_document_id: str) -> dict:
        return await self.request(
            "GET",
            f"/feeds/2021-06-30/documents/{quote(feed_document_id, safe='')}",
            "feeds.getFeedDocument",
        )