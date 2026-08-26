// Prompt 5: Contact persons per project
import { Router, type IRouter } from "express";
import { listContacts, createContact, updateContact, deleteContact, addAuditLog } from "./archiveDb";

const router: IRouter = Router();

const VALID_ROLES = ["owner", "consultant", "contractor", "technical_office", "other"];

// GET contacts for a project
router.get("/sa/projects/:id/contacts", async (req, res): Promise<void> => {
  const { id } = req.params;
  res.json(await listContacts(id));
});

// POST create a contact
router.post("/sa/projects/:id/contacts", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { name, role, phone, email, notes } = req.body as {
    name?: string; role?: string; phone?: string; email?: string; notes?: string;
  };

  if (!name || !role) {
    res.status(400).json({ error: "name and role are required" });
    return;
  }
  if (!VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
    return;
  }

  const contact = await createContact(id, { name, role, phone: phone ?? null, email: email ?? null, notes: notes ?? null });

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  await addAuditLog(userId, userLabel, "create", "contact", contact.id, `إضافة جهة اتصال: ${name}`);

  res.status(201).json(contact);
});

// PATCH update a contact
router.patch("/sa/projects/:id/contacts/:cid", async (req, res): Promise<void> => {
  const { id, cid } = req.params;
  const { name, role, phone, email, notes } = req.body as {
    name?: string; role?: string; phone?: string; email?: string; notes?: string;
  };
  const patch: Record<string, unknown> = {};
  if (name) patch.name = name;
  if (role && VALID_ROLES.includes(role)) patch.role = role;
  if (phone !== undefined) patch.phone = phone ?? null;
  if (email !== undefined) patch.email = email ?? null;
  if (notes !== undefined) patch.notes = notes ?? null;

  const contact = await updateContact(id, cid, patch);
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  await addAuditLog(userId, userLabel, "update", "contact", cid, `تحديث جهة اتصال: ${contact.name}`);

  res.json(contact);
});

// DELETE a contact
router.delete("/sa/projects/:id/contacts/:cid", async (req, res): Promise<void> => {
  const { id, cid } = req.params;
  const contacts = await listContacts(id);
  const contact = contacts.find((c) => c.id === cid);
  const deleted = await deleteContact(id, cid);
  if (!deleted) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  await addAuditLog(userId, userLabel, "delete", "contact", cid, `حذف جهة اتصال: ${contact?.name ?? ""}`);

  res.sendStatus(204);
});

export default router;
