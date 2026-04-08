const BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

// supportsAllDrives=true is required for any operation touching Shared Drives
const SHARED = { supportsAllDrives: "true", includeItemsFromAllDrives: "true" };

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

export async function readFile(token, fileId) {
  const params = new URLSearchParams({
    alt: "media",
    supportsAllDrives: "true",
  });
  const res = await fetch(`${BASE}/files/${fileId}?${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Read file failed: ${res.status}`);
  return res.text();
}

export async function saveFile(token, fileId, content) {
  const params = new URLSearchParams({
    uploadType: "media",
    supportsAllDrives: "true",
  });
  const res = await fetch(`${UPLOAD_BASE}/files/${fileId}?${params}`, {
    method: "PATCH",
    headers: authHeaders(token, { "Content-Type": "text/markdown" }),
    body: content,
  });
  if (!res.ok) throw new Error(`Save file failed: ${res.status}`);
  return res.json();
}

export async function createFile(token, name, content, folderId) {
  const boundary = "vcp_" + Math.random().toString(36).slice(2);
  const metadata = JSON.stringify({
    name,
    mimeType: "text/markdown",
    ...(folderId ? { parents: [folderId] } : {}),
  });
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: text/markdown",
    "",
    content,
    `--${boundary}--`,
  ].join("\r\n");
  const params = new URLSearchParams({
    uploadType: "multipart",
    supportsAllDrives: "true",
  });
  const res = await fetch(`${UPLOAD_BASE}/files?${params}`, {
    method: "POST",
    headers: authHeaders(token, {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    }),
    body,
  });
  if (!res.ok) throw new Error(`Create file failed: ${res.status}`);
  return res.json();
}

export async function getFileMetadata(token, fileId) {
  const params = new URLSearchParams({
    fields: "id,name,modifiedTime,parents",
    supportsAllDrives: "true",
  });
  const res = await fetch(`${BASE}/files/${fileId}?${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Get metadata failed: ${res.status}`);
  return res.json();
}

// List folders + .md files inside a folder (My Drive or Shared Drive subfolder)
export async function listFolderContents(token, folderId = "root") {
  const q = `'${folderId}' in parents and trashed=false and (mimeType='application/vnd.google-apps.folder' or mimeType='text/markdown' or mimeType='text/plain')`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,modifiedTime)",
    orderBy: "folder,name",
    pageSize: "200",
    ...SHARED,
  });
  const res = await fetch(`${BASE}/files?${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`List folder failed: ${res.status}`);
  const data = await res.json();
  return data.files;
}

// Find a folder by name inside a parent — case-insensitive client-side match.
// Drive API name queries are case-sensitive, so we fetch all folders and compare lowercased.
export async function findFolder(token, name, parentId = "root") {
  const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name)",
    pageSize: "200",
    ...SHARED,
  });
  const res = await fetch(`${BASE}/files?${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`findFolder failed: ${res.status}`);
  const data = await res.json();
  const lower = name.toLowerCase();
  return data.files?.find((f) => f.name.toLowerCase() === lower) || null;
}

// VCP folder structure:
//   /vcp/
//   ├── clients/       ← one folder per PE client; portcos live under clients/{client}/portcos/
//   ├── ops/
//   ├── brain/
//   ├── templates/
//   ├── seed/
//   └── inbox/         ← PWA capture lands here

// Resolve key VCP folder IDs.
// VCP is a Shared Drive — its root ID is the drive ID itself, not a subfolder.
export async function findVCPFolders(token) {
  const drives = await listSharedDrives(token);
  const vcp = drives.find((d) => d.name.toLowerCase() === "vcp");
  if (!vcp) throw new Error('Could not find a Shared Drive named "VCP"');
  // The drive ID itself is the parent of inbox, clients, etc.
  return resolveVCPSubfolders(token, { id: vcp.id, name: vcp.name }, vcp.name);
}

async function resolveVCPSubfolders(token, vcp, driveName) {
  const [inbox, clients, ops, brain] = await Promise.all([
    findFolder(token, "inbox", vcp.id),
    findFolder(token, "clients", vcp.id),
    findFolder(token, "ops", vcp.id),
    findFolder(token, "brain", vcp.id),
  ]);
  if (!inbox)
    throw new Error(`Found /vcp/ in "${driveName}" but no inbox subfolder`);
  return {
    vcpId: vcp.id,
    inboxId: inbox.id,
    clientsId: clients?.id || null,
    opsId: ops?.id || null,
    brainId: brain?.id || null,
    driveName,
  };
}

// List client folders under /vcp/clients/ (skip _archived)
export async function listClients(token, clientsFolderId) {
  if (!clientsFolderId) return [];
  const q = `'${clientsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name)",
    orderBy: "name",
    pageSize: "100",
    ...SHARED,
  });
  const res = await fetch(`${BASE}/files?${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`listClients failed: ${res.status}`);
  const data = await res.json();
  return (data.files || []).filter((f) => !f.name.startsWith("_"));
}

// List engagement folders under /vcp/clients/ (used by CaptureScreen for context chips)
export async function listEngagements(token, clientsFolderId) {
  return listClients(token, clientsFolderId);
}

// Save a file to a folder (used for inbox saves)
export async function saveToFolder(token, folderId, filename, content) {
  return createFile(token, filename, content, folderId);
}

// Search across all drives for files named board.md
export async function findBoardFiles(token) {
  const q = "name='board.md' and trashed=false";
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,parents,modifiedTime)",
    pageSize: "100",
    ...SHARED,
  });
  const res = await fetch(`${BASE}/files?${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`findBoardFiles failed: ${res.status}`);
  const data = await res.json();
  return data.files || [];
}

// Walk parent chain to build a human-readable folder path (for board labels).
// Returns the immediate parent folder name as the label (e.g. "ops", "clients > acme").
export async function getBoardLabel(token, fileId) {
  const meta = await getFileMetadata(token, fileId);
  const parentId = meta.parents?.[0];
  if (!parentId) return "unknown";
  try {
    const parent = await getFileMetadata(token, parentId);
    return parent.name;
  } catch {
    return "unknown";
  }
}

// List all Shared Drives the user is a member of
export async function listSharedDrives(token) {
  const params = new URLSearchParams({
    fields: "drives(id,name)",
    pageSize: "50",
  });
  const res = await fetch(`${BASE}/drives?${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`List shared drives failed: ${res.status}`);
  const data = await res.json();
  return data.drives || [];
}
