---
name: Bulk deletion permissions
description: The archive modules do not all use the same existing permission flag for deletion.
---

Bulk-selection controls must keep the permission guard already used by the module: core archive and project lists use `canDelete`, while the HR screens currently use `canEdit` for their existing delete buttons.

**Why:** Changing the guard while adding bulk actions would silently change who can delete HR records, even if the new UI appears correct.

**How to apply:** When extending another list, inspect its current delete action first and reuse that exact role check for the checkbox, toolbar, and confirmation action.