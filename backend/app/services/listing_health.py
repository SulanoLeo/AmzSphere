"""Amazon SP-API listing health notification parsing.

Handles LISTING_ITEM_STATUS_CHANGE notifications and extracts the fields the
Listing Suppression Guard needs to stage a review. Heavy handling is
intentionally deferred: this module only parses and validates the envelope.

Amazon notification signature verification is placeholder-stubbed. Wire real
SP-API / SNS signature validation (certificate chain + x-amz-sns-*) before
accepting production webhook traffic.
"""

from __future__ import annotations

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from typing import Any

# Heuristic whitelist of Amazon issue codes that indicate listing suppression,
# search suppression, or pricing errors. SP-API codes are not version-stable;
# unknown codes surface as raw strings for manual review.
SUPPRESSION_ERROR_CODES = {
    "PriceTooHigh",
    "PriceTooLow",
    "PricingError",
    "PriceViolation",
    "PriceBelowMinimum",
    "PriceAboveMaximum",
    "InvalidPrice",
    "ListingSuppressed",
    "CatalogListingSuppressed",
    "SearchSuppressed",
    "SearchSuppressedByPrice",
    "BuyBoxEligibilityError",
    "BuyableSuppressed",
    "DiscoverableSuppressed",
    "MissingRequiredAttribute",
    "ListingQualityIssue",
}

SUPPRESSION_KEYWORDS = ("suppress", "suppressed", "pricing", "price", "buyable", "discoverable")


class ListingHealthParseError(ValueError):
    """Raised when a notification envelope cannot be parsed."""


@dataclass(frozen=True)
class ParsedListingHealthEvent:
    notification_id: str
    notification_type: str
    seller_id: str
    marketplace_id: str
    asin: str
    sku: str
    listing_status: str
    error_codes: list[str]
    error_messages: list[str]
    is_suppressed: bool
    raw_payload: dict[str, Any]


def _first_string(value: Any) -> str | None:
    if isinstance(value, str):
        return value or None
    if isinstance(value, dict):
        for key in ("value", "id", "code", "asin", "sku", "status"):
            nested = value.get(key)
            if isinstance(nested, str) and nested:
                return nested
    return None


def _collect_strings(node: Any) -> list[str]:
    found: list[str] = []
    if isinstance(node, str):
        found.append(node)
    elif isinstance(node, dict):
        for value in node.values():
            found.extend(_collect_strings(value))
    elif isinstance(node, list):
        for item in node:
            found.extend(_collect_strings(item))
    return found


def _is_suppression_error(error_code: str | None) -> bool:
    if not error_code:
        return False
    if error_code in SUPPRESSION_ERROR_CODES:
        return True
    lowered = error_code.lower()
    return any(keyword in lowered for keyword in SUPPRESSION_KEYWORDS)


def parse_listing_item_status_change(envelope: dict[str, Any]) -> ParsedListingHealthEvent:
    """Parse a LISTING_ITEM_STATUS_CHANGE SP-API notification envelope.

    Accepts the SP-API notifications wrapper (top-level
    ``notificationId``/``notificationType``/``payload``) and a flattened
    payload used by test fixtures.
    """
    if not isinstance(envelope, dict):
        raise ListingHealthParseError("notification envelope must be a JSON object")

    notification_id = envelope.get("notificationId") or str(uuid.uuid4())
    notification_type = envelope.get("notificationType") or "LISTING_ITEM_STATUS_CHANGE"
    if notification_type != "LISTING_ITEM_STATUS_CHANGE":
        raise ListingHealthParseError(f"unsupported notification type: {notification_type!r}")

    payload = envelope.get("payload") or envelope

    seller_id = (
        payload.get("sellerId")
        or payload.get("seller_id")
        or _first_string(payload.get("seller"))
    )
    if not seller_id:
        raise ListingHealthParseError("notification payload is missing sellerId")

    marketplace_id = payload.get("marketplaceId") or payload.get("marketplace_id")
    if not marketplace_id:
        marketplace_ids = payload.get("marketplaceIds") or []
        if isinstance(marketplace_ids, list) and marketplace_ids:
            marketplace_id = str(marketplace_ids[0])
    if not marketplace_id:
        raise ListingHealthParseError("notification payload is missing marketplaceId")

    notifications = payload.get("notifications") or []
    if isinstance(notifications, dict):
        notifications = [notifications]
    if not isinstance(notifications, list) or not notifications:
        notifications = [payload]

    item = notifications[0]
    if not isinstance(item, dict):
        raise ListingHealthParseError("notification item must be a JSON object")

    item_status_change = item.get("itemStatusChange") or {}
    if not isinstance(item_status_change, dict):
        item_status_change = {}

    asin = item.get("asin") or _first_string(item.get("asin"))
    sku = item.get("sku") or _first_string(item.get("sku"))
    listing_status = (
        item.get("status")
        or item.get("listingStatus")
        or item.get("itemStatus")
        or item_status_change.get("itemStatus")
        or item_status_change.get("status")
        or ""
    )

    if not asin or not sku:
        raise ListingHealthParseError("notification item is missing asin or sku")

    asin = str(asin).strip().upper()
    sku = str(sku).strip()
    listing_status = str(listing_status).strip().upper()

    issues = item.get("issues") or item.get("errors") or []
    if isinstance(issues, dict):
        issues = [issues]
    if not isinstance(issues, list):
        issues = []

    error_codes: list[str] = []
    error_messages: list[str] = []
    for issue in issues:
        if not isinstance(issue, dict):
            continue
        code = issue.get("errorCode") or issue.get("error_code") or issue.get("code")
        message = issue.get("errorMessage") or issue.get("error_message") or issue.get("message")
        if code:
            error_codes.append(str(code))
        if message:
            error_messages.append(str(message))

    is_suppressed = any(_is_suppression_error(code) for code in error_codes) or listing_status in {
        "SUPPRESSED",
        "INACTIVE",
        "NOT_BUYABLE",
    }

    return ParsedListingHealthEvent(
        notification_id=str(notification_id),
        notification_type=str(notification_type),
        seller_id=str(seller_id),
        marketplace_id=str(marketplace_id),
        asin=asin,
        sku=sku,
        listing_status=listing_status,
        error_codes=error_codes,
        error_messages=error_messages,
        is_suppressed=is_suppressed,
        raw_payload=envelope,
    )


def validate_amazon_signature(
    *,
    body: bytes,
    signature: str | None,
    secret: str | None,
) -> bool:
    """Placeholder for Amazon SP-API notification signature validation.

    Returns True when no secret is configured (trust the caller). Replace with
    real SP-API / SNS signature verification before production use.
    """
    if not secret:
        return True
    if not signature:
        return False
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)
