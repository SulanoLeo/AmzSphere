"""AWS Signature Version 4 (SigV4) signing utility for AmzSphere.

Pure-Python implementation using only ``hashlib`` and ``hmac``. Designed to
sign outbound SP-API / execute-api requests in the async outbox pipeline,
replacing placeholder credential headers with cryptographically valid
AWS4-HMAC-SHA256 signatures.

Reference: https://docs.aws.amazon.com/general/latest/gr/sigv4-signing.html
"""

from __future__ import annotations

import hashlib
import hmac
import urllib.parse
from datetime import datetime, timezone

from backend.app.config import Settings


class AWSSigV4Signer:
    """AWS Signature Version 4 request signer.

    Stateless utility that produces canonical requests, string-to-sign values,
    derived signing keys, and final Authorization headers without external
    dependencies beyond the Python standard library.
    """

    ALGORITHM = "AWS4-HMAC-SHA256"
    REQUEST_TYPE = "aws4_request"

    def __init__(
        self,
        *,
        access_key_id: str,
        secret_access_key: str,
        region: str,
        service: str,
    ) -> None:
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.region = region
        self.service = service

    @staticmethod
    def _hmac(key: bytes, message: str | bytes) -> bytes:
        if isinstance(message, str):
            message = message.encode("utf-8")
        return hmac.new(key, message, hashlib.sha256).digest()

    @staticmethod
    def _sha256_hex(data: str | bytes) -> str:
        if isinstance(data, str):
            data = data.encode("utf-8")
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def _iso8601_basic(dt: datetime) -> str:
        """Return AWS basic ISO8601 timestamp: YYYYMMDDTHHMMSSZ."""
        return dt.strftime("%Y%m%dT%H%M%SZ")

    @staticmethod
    def _iso8601_date(dt: datetime) -> str:
        """Return AWS scope date: YYYYMMDD."""
        return dt.strftime("%Y%m%d")

    def derive_signing_key(
        self,
        *,
        date_stamp: str,
    ) -> bytes:
        """Derive the multi-tier AWS SigV4 signing key.

        kDate    = HMAC-SHA256("AWS4" + SecretKey, Date)
        kRegion  = HMAC-SHA256(kDate, Region)
        kService = HMAC-SHA256(kRegion, Service)
        kSigning = HMAC-SHA256(kService, "aws4_request")
        """
        k_date = self._hmac(("AWS4" + self.secret_access_key).encode("utf-8"), date_stamp)
        k_region = self._hmac(k_date, self.region)
        k_service = self._hmac(k_region, self.service)
        return self._hmac(k_service, self.REQUEST_TYPE)

    def canonical_request(
        self,
        *,
        method: str,
        canonical_uri: str,
        canonical_query_string: str,
        canonical_headers: str,
        signed_headers: str,
        payload_hash: str,
    ) -> str:
        """Assemble the canonical request string."""
        return "\n".join(
            [
                method.upper(),
                canonical_uri,
                canonical_query_string,
                canonical_headers,
                signed_headers,
                payload_hash,
            ]
        )

    def string_to_sign(
        self,
        *,
        amz_date: str,
        credential_scope: str,
        hashed_canonical_request: str,
    ) -> str:
        """Assemble the string-to-sign for the final signature."""
        return "\n".join(
            [
                self.ALGORITHM,
                amz_date,
                credential_scope,
                hashed_canonical_request,
            ]
        )

    def signature(
        self,
        *,
        signing_key: bytes,
        string_to_sign: str,
    ) -> str:
        """Compute the hex-encoded HMAC-SHA256 signature."""
        return hmac.new(signing_key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    def authorization_header(
        self,
        *,
        amz_date: str,
        credential_scope: str,
        signed_headers: str,
        signature_hex: str,
    ) -> str:
        """Build the final Authorization header value."""
        return (
            f"{self.ALGORITHM} "
            f"Credential={self.access_key_id}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, "
            f"Signature={signature_hex}"
        )

    def sign(
        self,
        *,
        method: str,
        url: str,
        headers: dict[str, str],
        payload: str = "",
        amz_date: str | None = None,
    ) -> dict[str, str]:
        """Sign an arbitrary HTTP request and return the SigV4 header block.

        Returns a dictionary containing ``Authorization``, ``X-Amz-Date``, and
        any canonical headers that must be present on the wire. Callers merge
        these into the outgoing request.
        """
        now = datetime.now(timezone.utc)
        amz_date = amz_date or self._iso8601_basic(now)
        date_stamp = self._iso8601_date(now)

        parsed = urllib.parse.urlparse(url)
        canonical_uri = parsed.path or "/"
        canonical_query_string = self._canonical_query_string(parsed.query)

        # Normalize headers: lowercase keys, trimmed values, sorted order.
        normalized_headers = {k.lower().strip(): v.strip() for k, v in headers.items()}

        # Ensure host is present for canonicalization.
        host = parsed.hostname or ""
        if parsed.port:
            host = f"{host}:{parsed.port}"
        normalized_headers.setdefault("host", host)
        normalized_headers.setdefault("x-amz-date", amz_date)

        signed_headers = ";".join(sorted(normalized_headers.keys()))

        canonical_headers = "\n".join(
            f"{key}:{normalized_headers[key]}" for key in sorted(normalized_headers)
        ) + "\n"

        payload_hash = self._sha256_hex(payload)

        canonical = self.canonical_request(
            method=method,
            canonical_uri=canonical_uri,
            canonical_query_string=canonical_query_string,
            canonical_headers=canonical_headers,
            signed_headers=signed_headers,
            payload_hash=payload_hash,
        )

        credential_scope = f"{date_stamp}/{self.region}/{self.service}/{self.REQUEST_TYPE}"
        string_to_sign = self.string_to_sign(
            amz_date=amz_date,
            credential_scope=credential_scope,
            hashed_canonical_request=self._sha256_hex(canonical),
        )

        signing_key = self.derive_signing_key(date_stamp=date_stamp)
        signature_hex = self.signature(signing_key=signing_key, string_to_sign=string_to_sign)

        return {
            "Authorization": self.authorization_header(
                amz_date=amz_date,
                credential_scope=credential_scope,
                signed_headers=signed_headers,
                signature_hex=signature_hex,
            ),
            "X-Amz-Date": amz_date,
            "X-Amz-Content-SHA256": payload_hash,
        }

    @staticmethod
    def _canonical_query_string(raw_query: str) -> str:
        """Sort and percent-encode query parameters per SigV4 rules."""
        if not raw_query:
            return ""
        params = urllib.parse.parse_qsl(raw_query, keep_blank_values=True)
        encoded = [
            (
                urllib.parse.quote(k, safe="~"),
                urllib.parse.quote(v, safe="~"),
            )
            for k, v in params
        ]
        encoded.sort(key=lambda item: (item[0], item[1]))
        return "&".join(f"{k}={v}" for k, v in encoded)


def sign_httpx_request(
    *,
    request: httpx.Request,
    settings: Settings,
    access_token: str | None = None,
    service: str = "execute-api",
) -> httpx.Request:
    """Sign an :class:`httpx.Request` with AWS SigV4 and inject SP-API headers.

    Reads AWS credentials and region from the Pydantic-Settings object, derives
    the signing key, computes the Authorization header, and attaches
    ``X-Amz-Date``, ``X-Amz-Access-Token`` (LWA token placeholder), and
    ``Authorization`` directly to the request headers.

    The request body is read once for payload hashing; the returned request is
    safe to send through :class:`httpx.AsyncClient`.
    """
    access_key = (
        settings.aws_access_key_id.get_secret_value()
        if settings.aws_access_key_id
        else ""
    )
    secret_key = (
        settings.aws_secret_access_key.get_secret_value()
        if settings.aws_secret_access_key
        else ""
    )
    region = settings.sp_api_aws_region

    if not access_key or not secret_key:
        raise ValueError("AWS access key ID and secret access key must be configured")

    signer = AWSSigV4Signer(
        access_key_id=access_key,
        secret_access_key=secret_key,
        region=region,
        service=service,
    )

    # Read current headers into a plain dict for canonicalization.
    current_headers = dict(request.headers.items())

    # Read the body for payload hashing without consuming the request stream.
    body = request.content or b""
    payload = body.decode("utf-8", errors="replace") if body else ""

    url = str(request.url)

    signed = signer.sign(
        method=request.method,
        url=url,
        headers=current_headers,
        payload=payload,
    )

    # Merge SigV4 headers onto the httpx request.
    request.headers["Authorization"] = signed["Authorization"]
    request.headers["X-Amz-Date"] = signed["X-Amz-Date"]
    request.headers["X-Amz-Content-SHA256"] = signed["X-Amz-Content-SHA256"]

    # LWA access token placeholder injected per SP-API authorization profile.
    token = access_token or (
        settings.sp_api_access_token.get_secret_value()
        if settings.sp_api_access_token
        else ""
    )
    if token:
        request.headers["X-Amz-Access-Token"] = token

    return request
