import json
import unittest
from pathlib import Path

from backend.app.services.listing_health import (
    ListingHealthParseError,
    parse_listing_item_status_change,
)

MOCK_PAYLOAD_PATH = Path(__file__).resolve().parent.parent / "backend" / "app" / "webhooks" / "mock_listing_suppressed_payload.json"


class ListingHealthParserTests(unittest.TestCase):
    def test_parses_suppressed_listing(self):
        envelope = json.loads(MOCK_PAYLOAD_PATH.read_text(encoding="utf-8"))
        event = parse_listing_item_status_change(envelope)

        self.assertEqual(event.notification_type, "LISTING_ITEM_STATUS_CHANGE")
        self.assertEqual(event.seller_id, "A1EXAMPLESELLERID")
        self.assertEqual(event.marketplace_id, "ATVPDKIKX0DER")
        self.assertEqual(event.asin, "B07XYZ1234")
        self.assertEqual(event.sku, "PROD-SKU-001")
        self.assertEqual(event.listing_status, "NOT_BUYABLE")
        self.assertIn("PriceTooHigh", event.error_codes)
        self.assertTrue(event.is_suppressed)
        self.assertIsNotNone(event.notification_id)

    def test_unsupported_type_raises(self):
        with self.assertRaises(ListingHealthParseError):
            parse_listing_item_status_change({
                "notificationId": "n1",
                "notificationType": "FEED_PROCESSING_FINISHED",
                "payload": {},
            })

    def test_missing_asin_raises(self):
        with self.assertRaises(ListingHealthParseError):
            parse_listing_item_status_change({
                "notificationId": "n2",
                "notificationType": "LISTING_ITEM_STATUS_CHANGE",
                "payload": {
                    "sellerId": "A1SELLER",
                    "marketplaceId": "ATVPDKIKX0DER",
                    "notifications": [{"sku": "SKU1"}],
                },
            })

    def test_flat_payload_supported(self):
        event = parse_listing_item_status_change({
            "notificationId": "n3",
            "notificationType": "LISTING_ITEM_STATUS_CHANGE",
            "sellerId": "A1SELLER",
            "marketplaceId": "ATVPDKIKX0DER",
            "asin": "B0FLAT1234",
            "sku": "FLAT-SKU",
            "status": "BUYABLE",
            "issues": [],
        })
        self.assertEqual(event.asin, "B0FLAT1234")
        self.assertEqual(event.listing_status, "BUYABLE")
        self.assertFalse(event.is_suppressed)


if __name__ == "__main__":
    unittest.main()
