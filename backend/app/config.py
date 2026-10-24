from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://amzsphere:amzsphere@localhost:5432/amzsphere"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None
    sp_api_enabled: bool = False
    sp_api_dry_run: bool = True
    sp_api_endpoint: str = "https://sellingpartnerapi-na.amazon.com"
    sp_api_aws_region: str = "us-east-1"
    sp_api_marketplace_id: str = "ATVPDKIKX0DER"
    sp_api_seller_id: str = ""
    sp_api_application_id: str = ""
    sp_api_application_version: str | None = None
    sp_api_role_arn: str | None = None
    sp_api_refresh_token: SecretStr | None = None
    bootstrap_tenant_id: str | None = None
    lwa_client_id: SecretStr | None = None
    lwa_client_secret: SecretStr | None = None
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-4o"
    serpapi_api_key: SecretStr | None = None
    helium10_api_key: SecretStr | None = None
    fernet_key: SecretStr | None = None
    platform_api_key: SecretStr | None = None
    amazon_notifications_secret: SecretStr | None = None
    oauth_redirect_uri: str = "http://localhost:8001/api/v1/auth/amazon/callback"
    web_app_url: str = "http://localhost:3000"
    oauth_state_ttl_seconds: int = 600
    access_token_skew_seconds: int = 120
    po_output_dir: str = "./var/purchase-orders"
    amazon_notifications_sqs_url: str | None = None
    sp_api_user_agent: str = "AmzSphere/1.0 (Language=Python/3.13; Platform=Linux)"
    sp_api_max_retries: int = 5
    seller_sync_interval_seconds: int = 900
    sp_api_listings_api_version: str = "2021-08-01"
    amazon_write_outbox_batch_limit: int = 50
    amazon_write_outbox_max_attempts: int = 10
    amazon_write_outbox_base_backoff_seconds: int = 60
    amazon_write_outbox_max_backoff_seconds: int = 3600
    sp_api_access_token: SecretStr | None = None
    aws_access_key_id: SecretStr | None = None
    aws_secret_access_key: SecretStr | None = None
    admin_webhook_secret: SecretStr | None = None
    celery_listing_health_queue: str = "amzsphere.listing_health"
    celery_listing_health_interval_seconds: int = 60
    celery_task_acks_late: bool = True
    celery_worker_prefetch_multiplier: int = 1

    @property
    def celery_broker(self) -> str:
        return self.celery_broker_url or self.redis_url

    @property
    def celery_backend(self) -> str:
        return self.celery_result_backend or self.redis_url


@lru_cache
def get_settings() -> Settings:
    return Settings()