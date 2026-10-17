---
name: Bulk deletion permissions
description: The archive modules do not all use the same existing permission flag for deletion.
---

Bulk-selection controls must keep the permission guard already used by the module: core archive and project lists use `canDelete`, while the HR screens currently use `canEdit` for their existing delete buttons.

**Why:** Changing the guard while adding bulk actions would silently change who can delete HR records, even if the new UI appears correct.

**How to apply:** When extending another list, inspect its current delete action first and reuse that exact role check for the checkbox, toolbar, and confirmation action.

Data-entry staff may delete attachment files created by their own signed account, including a virtual folder only when every file beneath it is theirs. Mixed-owner folders and legacy files without uploader attribution remain administrator-only.

**Why:** The owner wants staff to correct their own mistaken uploads without gaining permission to remove a teammate's files or wait for an administrator.

**How to apply:** Record uploader identity on every attachment creation path, enforce file and whole-folder ownership in the API using the signed session (not browser headers), and show folder deletion only when all descendant files are owned by the current user.