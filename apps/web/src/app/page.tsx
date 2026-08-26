"use client";

import React, { useState, useEffect } from "react";
import {
  fetchUserAssets,
  directS3Upload,
  deleteAsset,
  fetchDirectDownloadUrl,
  Asset,
} from "./api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) setToken(savedToken);
  }, []);

  useEffect(() => {
    if (token) {
      loadAssets();
      const interval = setInterval(loadAssets, 5000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const loadAssets = async () => {
    if (!token) return;
    try {
      const data = await fetchUserAssets(token);
      setAssets(data);
    } catch (err) {
      console.error("Error loading assets:", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const endpoint = isSignUp ? "/api/v1/auth/signup" : "/api/v1/auth/login";
    const body = isSignUp
      ? { email, password, full_name: fullName }
      : { email, password };

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");

      if (isSignUp) {
        setIsSignUp(false);
        setAuthError("Account created! Please log in.");
      } else {
        localStorage.setItem("token", data.access_token);
        setToken(data.access_token);
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("token");
    setToken(null);
    setAssets([]);
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;
    setUploading(true);
    setUploadStatus("Ingesting to S3...");
    try {
      await directS3Upload(selectedFile, token);
      setUploadStatus("Upload complete! SQS event dispatched to Lambda worker.");
      setSelectedFile(null);
      await loadAssets();
    } catch (err: any) {
      setUploadStatus(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (asset: Asset) => {
    if (!token) return;
    setDownloadingId(asset.asset_id);
    try {
      const downloadUrl = await fetchDirectDownloadUrl(asset.asset_id, token);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", asset.file_name);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShare = async (asset: Asset) => {
    const shareUrl = `${window.location.origin}/share/${asset.asset_id}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedId(asset.asset_id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  const handleDelete = async (assetId: string) => {
    if (!token || !assetId) return;
    setDeletingId(assetId);
    try {
      await deleteAsset(assetId, token);
      setAssets((prev) => prev.filter((a) => a.asset_id !== assetId));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#070b19] flex items-center justify-center p-4 text-white">
        <div className="bg-[#0e162f] border border-blue-900/40 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <h1 className="text-3xl font-bold text-center text-blue-400 mb-2">CloudVault</h1>
          <p className="text-gray-400 text-sm text-center mb-6">
            {isSignUp ? "Create a secure account" : "Sign in to your private vault"}
          </p>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg mb-4">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="text-xs font-semibold text-gray-300">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full mt-1 bg-[#162244] border border-blue-800/40 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-300">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 bg-[#162244] border border-blue-800/40 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 bg-[#162244] border border-blue-800/40 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 transition py-2.5 rounded-lg font-semibold text-sm shadow-lg shadow-blue-600/30"
            >
              {isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>

          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-center text-xs text-blue-400 hover:underline mt-6"
          >
            {isSignUp ? "Already have an account? Log in" : "Need an account? Sign up"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b19] text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center border-b border-blue-900/30 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-400">CloudVault Asset Hub</h1>
            <p className="text-xs text-gray-400 mt-1">Direct S3 Ingestion &bull; Event Worker &bull; CloudFront OAC</p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-700 bg-gray-900/50 hover:bg-gray-800 transition"
          >
            Sign Out
          </button>
        </header>

        {/* Upload Card */}
        <div className="bg-[#0e162f] border border-blue-900/40 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Direct S3 Asset Ingestion</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 text-sm text-gray-400 cursor-pointer"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition shadow-lg shadow-blue-600/30"
            >
              {uploading ? "Ingesting..." : "Upload"}
            </button>
          </div>
          {uploadStatus && (
            <p className="text-xs font-mono mt-3 text-blue-300">{uploadStatus}</p>
          )}
        </div>

        {/* Assets Catalog */}
        <div className="bg-[#0e162f] border border-blue-900/40 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-200">My Assets</h2>
            <button
              onClick={loadAssets}
              className="text-xs text-blue-400 hover:underline"
            >
              Refresh Table
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-blue-900/40 text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">S3 Key</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-900/20 font-medium">
                {assets.length === 0 ? (
                  <tr key="empty-row">
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No assets uploaded yet.
                    </td>
                  </tr>
                ) : (
                  assets.map((asset, idx) => {
                    const rowKey = asset.asset_id || `asset-${idx}`;
                    return (
                      <tr key={rowKey} className="hover:bg-blue-950/20 transition">
                        <td className="py-3.5 px-4 font-semibold text-gray-200">
                          {asset.file_name}
                        </td>
                        <td className="py-3.5 px-4 text-gray-400 font-mono">
                          {asset.content_type}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              asset.status === "COMPLETED"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {asset.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-400 font-mono truncate max-w-[200px]">
                          {asset.raw_s3_key || "-"}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => handleDownload(asset)}
                            disabled={downloadingId === asset.asset_id}
                            className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                          >
                            {downloadingId === asset.asset_id ? "Downloading..." : "Download"}
                          </button>

                          <button
                            onClick={() => handleShare(asset)}
                            className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-300 rounded-lg text-xs font-semibold transition"
                          >
                            {copiedId === asset.asset_id ? "Copied Link!" : "Share"}
                          </button>

                          <button
                            onClick={() => handleDelete(asset.asset_id)}
                            disabled={deletingId === asset.asset_id}
                            className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 text-rose-300 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                          >
                            {deletingId === asset.asset_id ? "Deleting..." : "Delete"}
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
      </div>
    </div>
  );
}