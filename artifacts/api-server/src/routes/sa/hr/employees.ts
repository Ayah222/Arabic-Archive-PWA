// HR — Employee digital files: employee records, categorized documents
// (personal / contract / qualifications / performance), and leave records.
import { Router, type IRouter } from "express";
import {
  listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee,
  listEmployeeDocuments, createEmployeeDocument, deleteEmployeeDocument,
  listEmployeeLeaves, createEmployeeLeave, deleteEmployeeLeave,
} from "../hrDb";
import { addAuditLog } from "../archiveDb";
import { suggestDocumentCategory } from "../../../lib/ai";
import { hrActorFrom } from "./permissions";

const router: IRouter = Router();

function userInfo(_req: import("express").Request, res: import("express").Response) {
  // hrActorFrom reads the verified sa_hr_session actor set by requireHrAccess
  // — never trust client-supplied x-user-id/x-user-label headers here.
  const actor = hrActorFrom(res);
  return {
    userId: actor?.id ?? "system",
    userLabel: actor?.name ?? "مستخدم",
  };
}

/* ─── Employees ─── */

router.get("/sa/hr/employees", async (_req, res): Promise<void> => {
  res.json(await listEmployees());
});

router.get("/sa/hr/employees/:id", async (req, res): Promise<void> => {
  const employee = await getEmployee(req.params.id);
  if (!employee) {
    res.status(404).json({ error: "الموظف غير موجود" });
    return;
  }
  res.json(employee);
});

router.post("/sa/hr/employees", async (req, res): Promise<void> => {
  const { name, nationalId, position, department, phone, email, hireDate, employmentType, status, probationDays, notes } = req.body as {
    name?: string; nationalId?: string; position?: string; department?: string; phone?: string; email?: string;
    hireDate?: string; employmentType?: string; status?: string; probationDays?: number; notes?: string;
  };
  if (!name) {
    res.status(400).json({ error: "الاسم مطلوب" });
    return;
  }
  const employee = await createEmployee({ name, nationalId, position, department, phone, email, hireDate, employmentType, status, probationDays, notes });
  const { userId, userLabel } = userInfo(req, res);
  await addAuditLog(userId, userLabel, "create", "موظف", employee.id, `إضافة موظف: ${name}`);
  res.status(201).json(employee);
});

router.patch("/sa/hr/employees/:id", async (req, res): Promise<void> => {
  const patch = req.body as Record<string, unknown>;
  const employee = await updateEmployee(req.params.id, patch);
  if (!employee) {
    res.status(404).json({ error: "الموظف غير موجود" });
    return;
  }
  const { userId, userLabel } = userInfo(req, res);
  await addAuditLog(userId, userLabel, "update", "موظف", employee.id, `تحديث بيانات موظف: ${employee.name}`);
  res.json(employee);
});

router.delete("/sa/hr/employees/:id", async (req, res): Promise<void> => {
  const employee = await getEmployee(req.params.id);
  const deleted = await deleteEmployee(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "الموظف غير موجود" });
    return;
  }
  const { userId, userLabel } = userInfo(req, res);
  await addAuditLog(userId, userLabel, "delete", "موظف", req.params.id, `حذف موظف: ${employee?.name ?? ""}`);
  res.sendStatus(204);
});

/* ─── Employee documents ─── */

router.get("/sa/hr/employees/:id/documents", async (req, res): Promise<void> => {
  res.json(await listEmployeeDocuments(req.params.id));
});

// Suggests a category (personal/contract/qualifications/performance) from a
// filename + optional description before the client submits the document.
router.post("/sa/hr/documents/suggest-category", async (req, res): Promise<void> => {
  const { filename, description } = req.body as { filename?: string; description?: string };
  if (!filename) {
    res.status(400).json({ error: "اسم الملف مطلوب" });
    return;
  }
  const category = await suggestDocumentCategory(filename, description);
  res.json({ category });
});

router.post("/sa/hr/employees/:id/documents", async (req, res): Promise<void> => {
  const { category, name, url, mimeType, size, description, expiryDate } = req.body as {
    category?: string; name?: string; url?: string; mimeType?: string; size?: number; description?: string; expiryDate?: string;
  };
  if (!name || !url) {
    res.status(400).json({ error: "اسم المستند ورابط الملف مطلوبان" });
    return;
  }
  const doc = await createEmployeeDocument(req.params.id, {
    category: category ?? "personal", name, url, mimeType, size, description, expiryDate,
  });
  const { userId, userLabel } = userInfo(req, res);
  await addAuditLog(userId, userLabel, "create", "مستند موظف", doc.id, `رفع مستند: ${name}`);
  res.status(201).json(doc);
});

router.delete("/sa/hr/employees/:id/documents/:did", async (req, res): Promise<void> => {
  const deleted = await deleteEmployeeDocument(req.params.id, req.params.did);
  if (!deleted) {
    res.status(404).json({ error: "المستند غير موجود" });
    return;
  }
  const { userId, userLabel } = userInfo(req, res);
  await addAuditLog(userId, userLabel, "delete", "مستند موظف", req.params.did, "حذف مستند موظف");
  res.sendStatus(204);
});

/* ─── Employee leaves ─── */

router.get("/sa/hr/employees/:id/leaves", async (req, res): Promise<void> => {
  res.json(await listEmployeeLeaves(req.params.id));
});

router.post("/sa/hr/employees/:id/leaves", async (req, res): Promise<void> => {
  const { leaveType, startDate, endDate, notes } = req.body as { leaveType?: string; startDate?: string; endDate?: string; notes?: string };
  if (!startDate || !endDate) {
    res.status(400).json({ error: "تاريخ بداية ونهاية الإجازة مطلوبان" });
    return;
  }
  const leave = await createEmployeeLeave(req.params.id, { leaveType: leaveType ?? "annual", startDate, endDate, notes });
  const { userId, userLabel } = userInfo(req, res);
  await addAuditLog(userId, userLabel, "create", "إجازة", leave.id, "إضافة إجازة موظف");
  res.status(201).json(leave);
});

router.delete("/sa/hr/employees/:id/leaves/:lid", async (req, res): Promise<void> => {
  const deleted = await deleteEmployeeLeave(req.params.id, req.params.lid);
  if (!deleted) {
    res.status(404).json({ error: "سجل الإجازة غير موجود" });
    return;
  }
  const { userId, userLabel } = userInfo(req, res);
  await addAuditLog(userId, userLabel, "delete", "إجازة", req.params.lid, "حذف إجازة موظف");
  res.sendStatus(204);
});

export default router;
