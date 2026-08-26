const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface AssetRecord {
  assetId: string;
  userId: string;
  fileName: string;
  s3KeyRaw: string;
  s3KeyThumb?: string;
  mimeType: string;
  status: "PENDING_UPLOAD" | "COMPLETED" | "FAILED";
  createdAt: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}

export interface UserSession {
  access_token: string;
  user_id: string;
  name: string;
  email: string;
}

export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<UserSession> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
}

export async function loginUser(
  email: string,
  password: string
): Promise<UserSession> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Invalid login credentials");
  }
  return res.json();
}

export async function directS3Upload(file: File, token: string): Promise<string> {
  const contentType = file.type || "application/octet-stream";

  const presignedRes = await fetch(`${API_BASE_URL}/api/v1/assets/presigned-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      file_name: file.name,
      content_type: contentType,
    }),
  });

  if (!presignedRes.ok) {
    const err = await presignedRes.json();
    throw new Error(err.detail || "Failed to get upload authorization");
  }

  const { upload_url, asset_id } = await presignedRes.json();

  // Stream binary directly to S3
  const uploadRes = await fetch(upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`Direct S3 upload failed with status ${uploadRes.status}`);
  }

  return asset_id;
}

export async function fetchUserAssets(token: string): Promise<AssetRecord[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/assets/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getAssetDownloadUrl(
  assetId: string,
  token: string
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/v1/assets/${assetId}/download-url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to generate download URL");
  const data = await res.json();
  return data.download_url;
}