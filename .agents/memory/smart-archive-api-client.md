---
name: smart-archive api-client-react broken imports
description: All smart-archive controllers must NOT import from @workspace/api-client-react — that package exists but lacks the SA-specific hooks, causing runtime crashes and blank pages.
---

## The Rule
Never use `@workspace/api-client-react` in `artifacts/smart-archive/src/` for hooks like `useListProjects`, `useGetDashboard`, `useListContracts`, etc. These do not exist in the package.

**Why:** The api-client-react package is shared across the workspace but only has generic OpenAPI-generated hooks. The smart-archive added new endpoints (dashboard, notifications, projects, contracts, etc.) that were never added to the OpenAPI spec, so the hooks don't exist. Calling undefined functions causes silent TypeError crashes that show a blank white page with no console errors.

**How to apply:** Any new controller in smart-archive must use `src/lib/apiClient.ts` (apiGet, apiPost, apiPatch, apiDel) with direct fetch calls. The shared helper handles auth headers (demo token + Supabase JWT) automatically.

## Fixed files (all now use apiClient.ts directly):
- `controllers/useNotifications.ts`
- `controllers/useProjects.ts`
- `controllers/useProjectDetails.ts`
- `controllers/useVoice.ts`
- `views/pages/Dashboard.tsx`

## Calling convention (matches existing pages):
- createProject: `{ data: ProjectInput }`
- updateProject: `{ id, data: ProjectUpdate }`
- deleteProject: `{ id }`
- contracts create: `{ id: projectId, data: Partial<SAContract> }`
- contracts update: `{ id: projectId, cid: contractId, data: ... }`
- contracts remove: `{ id: projectId, cid: contractId }`
- documents remove: `{ id: projectId, did: docId }`
- meetings remove: `{ id: projectId, mid: meetingId }`
- letters remove: `{ id: projectId, lid: letterId }`
