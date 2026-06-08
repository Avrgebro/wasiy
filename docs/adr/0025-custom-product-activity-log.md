# Custom Product-Facing Activity Log

Wasiy will implement a custom activity log service and table instead of relying on a generic model-diff audit package in v1. Activity entries should represent meaningful product events with actor, account, location, subject, event type, summary, metadata, and timestamp so managers can understand operational history.
