import json
import time

import boto3

from backend.app.config import get_settings
from backend.app.tasks.notifications import handle_feed_processing_finished


def unwrap_sqs_body(body: str) -> dict:
    payload = json.loads(body)
    if isinstance(payload, dict) and "Message" in payload and isinstance(payload["Message"], str):
        return json.loads(payload["Message"])
    return payload


def consume() -> None:
    settings = get_settings()
    queue_url = settings.amazon_notifications_sqs_url
    if not queue_url:
        raise RuntimeError("AMAZON_NOTIFICATIONS_SQS_URL must point to the configured SP-API notification queue")
    client = boto3.client("sqs", region_name=settings.sp_api_aws_region)
    while True:
        response = client.receive_message(
            QueueUrl=queue_url,
            MaxNumberOfMessages=10,
            WaitTimeSeconds=20,
            VisibilityTimeout=120,
        )
        for message in response.get("Messages", []):
            try:
                event = unwrap_sqs_body(message["Body"])
                if event.get("notificationType") == "FEED_PROCESSING_FINISHED":
                    handle_feed_processing_finished.delay(event)
                client.delete_message(QueueUrl=queue_url, ReceiptHandle=message["ReceiptHandle"])
            except Exception:
                # Leave poison/unavailable messages for visibility-timeout retry and DLQ redrive.
                continue
        if not response.get("Messages"):
            time.sleep(0.1)


if __name__ == "__main__":
    consume()