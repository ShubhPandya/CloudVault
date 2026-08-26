const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Asset {
  asset_id: string;
  file_name: string;
  content_type: string;
  status: string;
  raw_s3_key: string;
  download_url?: string;
  thumbnail_url?: string;
}

export async function fetchUserAssets(token: string): Promise<Asset[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/assets/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch assets");
  return res.json();
}

export async function deleteAsset(assetId: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/assets/${assetId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to delete asset");
  }
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