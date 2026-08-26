"use client";

import React, { useState, useEffect } from "react";

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_BASE = RAW_BASE.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      setToken(savedToken);
      fetchAssets(savedToken);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const endpoint =
      authMode === "login"
        ? `${API_BASE}/api/v1/auth/login`
        : `${API_BASE}/api/v1/auth/signup`;
    const payload =
      authMode === "login"
        ? { email, password }
        : { email, password, full_name: fullName };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Authentication failed");
      }

      if (authMode === "signup") {
        setAuthMode("login");
        setStatusMessage("Account created! You can now log in.");
        return;
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      fetchAssets(data.access_token);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("token");
    setToken(null);
    setAssets([]);
  };

  const fetchAssets = async (authToken?: string) => {
    const currentToken = authToken || token;
    if (!currentToken) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/assets/`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const assetList = Array.isArray(data) ? data : data.assets || [];
        setAssets(assetList);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleUpload = async () => {
    if (!file || !token) return;
    setUploading(true);
    setStatusMessage("Requesting upload ticket...");

    try {
      const presignedRes = await fetch(
        `${API_BASE}/api/v1/assets/presigned-upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            file_name: file.name,
            content_type: file.type || "application/octet-stream",
            file_size: file.size,
          }),
        }
      );

      if (!presignedRes.ok) {
        const err = await presignedRes.json().catch(() => ({}));
        throw new Error(err.detail || "Presigned URL generation failed");
      }

      const { upload_url } = await presignedRes.json();
      setStatusMessage("Uploading directly to Amazon S3...");

      const s3Res = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!s3Res.ok) throw new Error("S3 direct upload failed");

      setStatusMessage("Upload complete!");
      setFile(null);
      await fetchAssets(token);
    } catch (error: any) {
      alert(`Upload Error: ${error.message}`);
    } finally {
      setUploading(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleDownload = async (asset: any) => {
    if (asset.download_url) {
      window.open(asset.download_url, "_blank");
      return;
    }

    const assetId = asset.asset_id || asset.id;
    if (!token || !assetId) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/assets/${assetId}/download-url`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("Failed to generate download URL");
      const data = await res.json();
      const downloadUrl = data.download_url || data.url;
      if (downloadUrl) {
        window.open(downloadUrl, "_blank");
      }
    } catch (err: any) {
      alert(`Download Error: ${err.message}`);
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this asset?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/assets/${assetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to delete asset");
      }

      setAssets((prev) =>
        prev.filter((item) => (item.asset_id || item.id) !== assetId)
      );
    } catch (err: any) {
      alert(`Delete Error: ${err.message}`);
    }
  };

  if (!token) {
    return (
      <main className="min-h-screen bg-[#070b19] flex items-center justify-center p-4 text-white">
        <div className="bg-[#0d1527] border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <h1 className="text-2xl font-bold text-[#38bdf8] mb-2 text-center">
            CloudVault
          </h1>
          <p className="text-slate-400 text-sm mb-6 text-center">
            {authMode === "login"
              ? "Sign in to access your assets"
              : "Create an account to get started"}
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === "signup" && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#111c35] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#111c35] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#111c35] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition text-sm mt-2"
            >
              {authMode === "login" ? "Sign In" : "Sign Up"}
            </button>
          </form>

          {statusMessage && (
            <p className="mt-4 text-center text-xs text-emerald-400">
              {statusMessage}
            </p>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setAuthMode(authMode === "login" ? "signup" : "login");
                setStatusMessage(null);
              }}
              className="text-xs text-blue-400 hover:underline"
            >
              {authMode === "login"
                ? "Need an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b19] text-white p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-[#38bdf8] tracking-tight">
            CloudVault Asset Hub
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Direct S3 Ingestion • Event Worker • CloudFront OAC
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 border border-slate-700 bg-slate-900 rounded-lg text-sm hover:bg-slate-800 transition"
        >
          Sign Out
        </button>
      </div>

      {/* Upload Box */}
      <div className="max-w-6xl mx-auto bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 mb-8 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4">Upload Files</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 rounded-xl transition shadow">
            Choose File
            <input
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <span className="text-slate-400 text-sm">
            {file ? file.name : "No file chosen"}
          </span>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className={`px-6 py-2.5 rounded-xl font-medium transition ml-auto ${
              !file || uploading
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow"
            }`}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
        {statusMessage && (
          <p className="mt-3 text-xs text-blue-400 animate-pulse">
            {statusMessage}
          </p>
        )}
      </div>

      {/* Assets Table */}
      <div className="max-w-6xl mx-auto bg-[#0d1527] border border-slate-800/80 rounded-2xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white">My Assets</h2>
          <button
            onClick={() => fetchAssets(token)}
            className="text-xs text-blue-400 hover:text-blue-300 transition font-medium"
          >
            Refresh Table
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 px-4">File Name</th>
                <th className="pb-3 px-4">Type</th>
                <th className="pb-3 px-4">Status</th>
                <th className="pb-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500">
                    No assets uploaded yet.
                  </td>
                </tr>
              ) : (
                assets.map((asset: any) => {
                  const assetId = asset.asset_id || asset.id;
                  return (
                    <tr
                      key={assetId || Math.random()}
                      className="hover:bg-slate-800/20 transition"
                    >
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {asset.file_name || asset.filename || "Untitled"}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {asset.content_type || "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {asset.status || "COMPLETED"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-3">
                        <button
                          onClick={() => handleDownload(asset)}
                          className="text-blue-400 hover:text-blue-300 text-xs font-semibold transition"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDelete(assetId)}
                          className="text-rose-400 hover:text-rose-300 text-xs font-semibold transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}