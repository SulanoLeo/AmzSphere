from cryptography.fernet import Fernet

from backend.app.config import get_settings


def _fernet() -> Fernet:
    key = get_settings().fernet_key
    if key is None:
        raise RuntimeError("FERNET_KEY is required before storing seller refresh tokens")
    return Fernet(key.get_secret_value().encode("ascii"))


def encrypt_refresh_token(refresh_token: str) -> str:
    return _fernet().encrypt(refresh_token.encode("utf-8")).decode("ascii")


def decrypt_refresh_token(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")