# Soft Deletes and Append-Only Activity

Wasiy will soft delete most core operational records so accidental removal does not destroy business history. Activity log entries should be append-only and not casually deleted, preserving an operational audit trail for role changes, resident/unit changes, visitor records, reservation decisions, and other sensitive events.
