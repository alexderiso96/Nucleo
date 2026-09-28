export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new Error('token refresh failed');
  return data.access_token;
}

export async function listNewFiles(
  accessToken: string,
  folderId: string | null,
  since: string | null,
): Promise<DriveFile[]> {
  const mimeFilter = [
    "mimeType='text/csv'",
    "mimeType='text/plain'",
    "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
    "mimeType='application/vnd.ms-excel'",
  ].join(' or ');

  const parts = [`(${mimeFilter})`, 'trashed=false'];
  if (folderId) parts.push(`'${folderId}' in parents`);
  const cutoff = since
    ? new Date(since)
    : (() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d; })();
  parts.push(`modifiedTime > '${cutoff.toISOString()}'`);

  const params = new URLSearchParams({
    q: parts.join(' and '),
    fields: 'files(id,name,modifiedTime,webViewLink)',
    pageSize: '20',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json() as { files?: DriveFile[] };
  return data.files ?? [];
}

export async function downloadFile(accessToken: string, fileId: string): Promise<ArrayBuffer> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`drive download failed: ${res.status}`);
  return res.arrayBuffer();
}
