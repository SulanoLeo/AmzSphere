import asyncio

from sqlalchemy import select

from backend.app.config import get_settings
from backend.app.db import SessionLocal
from backend.app.models import Seller
from backend.app.services.encryption import encrypt_refresh_token


async def bootstrap_seller() -> str:
    settings = get_settings()
    if settings.sp_api_refresh_token is None or not settings.sp_api_refresh_token.get_secret_value():
        raise RuntimeError("SP_API_REFRESH_TOKEN must contain an already-authorized seller refresh token")
    if not settings.sp_api_seller_id or not settings.bootstrap_tenant_id:
        raise RuntimeError("SP_API_SELLER_ID and BOOTSTRAP_TENANT_ID are required")

    encrypted_token = encrypt_refresh_token(settings.sp_api_refresh_token.get_secret_value())
    async with SessionLocal() as session:
        seller = await session.scalar(select(Seller).where(
            Seller.tenant_id == settings.bootstrap_tenant_id.strip().lower(),
            Seller.merchant_id == settings.sp_api_seller_id,
            Seller.marketplace_id == settings.sp_api_marketplace_id,
        ))
        if seller:
            seller.lwa_refresh_token_encrypted = encrypted_token
        else:
            seller = Seller(
                tenant_id=settings.bootstrap_tenant_id.strip().lower(),
                merchant_id=settings.sp_api_seller_id,
                marketplace_id=settings.sp_api_marketplace_id,
                region=settings.sp_api_aws_region,
                endpoint=settings.sp_api_endpoint,
                lwa_refresh_token_encrypted=encrypted_token,
            )
            session.add(seller)
            await session.flush()
        await session.commit()
        return str(seller.id)


if __name__ == "__main__":
    print(asyncio.run(bootstrap_seller()))