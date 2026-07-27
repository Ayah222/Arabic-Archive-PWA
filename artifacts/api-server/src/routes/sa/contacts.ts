// Prompt 5: Contact persons per project
import { Router, type IRouter } from "express";
import { store, newId, addAuditLog } from "./store";

const router: IRouter = Router();

const VALID_ROLES = ["owner", "consultant", "contractor", "technical_office", "other"];

// GET contacts for a project
router.get("/sa/projects/:id/contacts", async (req, res): Promise<void> => {
  const { id } = req.params;
  res.json(store.contacts.filter((c) => c.projectId === id));
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

  const contact = {
    id: newId(),
    projectId: id,
    name,
    role: role as "owner" | "consultant" | "contractor" | "technical_office" | "other",
    phone: phone ?? null,
    email: email ?? null,
    notes: notes ?? null,
    createdAt: new Date().toISOString(),
  };
  store.contacts.push(contact);

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  addAuditLog(userId, userLabel, "create", "contact", contact.id, `إضافة جهة اتصال: ${name}`);

  res.status(201).json(contact);
});

// PATCH update a contact
router.patch("/sa/projects/:id/contacts/:cid", async (req, res): Promise<void> => {
  const { id, cid } = req.params;
  const idx = store.contacts.findIndex((c) => c.id === cid && c.projectId === id);
  if (idx === -1) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  const { name, role, phone, email, notes } = req.body as {
    name?: string; role?: string; phone?: string; email?: string; notes?: string;
  };
  if (name) store.contacts[idx].name = name;
  if (role && VALID_ROLES.includes(role)) store.contacts[idx].role = role as "owner" | "consultant" | "contractor" | "technical_office" | "other";
  if (phone !== undefined) store.contacts[idx].phone = phone ?? null;
  if (email !== undefined) store.contacts[idx].email = email ?? null;
  if (notes !== undefined) store.contacts[idx].notes = notes ?? null;

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  addAuditLog(userId, userLabel, "update", "contact", cid, `تحديث جهة اتصال: ${store.contacts[idx].name}`);

  res.json(store.contacts[idx]);
});

// DELETE a contact
router.delete("/sa/projects/:id/contacts/:cid", async (req, res): Promise<void> => {
  const { id, cid } = req.params;
  const idx = store.contacts.findIndex((c) => c.id === cid && c.projectId === id);
  if (idx === -1) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  const name = store.contacts[idx].name;
  store.contacts.splice(idx, 1);

  const userId = (req.headers["x-user-id"] as string) ?? "system";
  const userLabel = (req.headers["x-user-label"] as string) ?? "مستخدم";
  addAuditLog(userId, userLabel, "delete", "contact", cid, `حذف جهة اتصال: ${name}`);

  res.sendStatus(204);
});

export default router;
