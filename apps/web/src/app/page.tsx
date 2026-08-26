"use client";

import React, { useState, useEffect } from "react";
import {
  directS3Upload,
  fetchUserAssets,
  getAssetDownloadUrl,
  loginUser,
  registerUser,
  AssetRecord,
  UserSession,
} from "./api";

export default function Dashboard() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [authName, setAuthName] = useState<string>("");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>("");

  useEffect(() => {
    const saved = localStorage.getItem("cloudvault_session");
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem("cloudvault_session");
      }
    }
  }, []);

  const loadAssets = async () => {
    if (!session?.access_token) return;
    try {
      const data = await fetchUserAssets(session.access_token);
      setAssets(data);
    } catch (err: unknown) {
      console.error("Failed to load assets", err);
    }
  };

  useEffect(() => {
    if (session) {
      loadAssets();
    }
  }, [session]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      let data: UserSession;
      if (isRegister) {
        data = await registerUser(authName, authEmail, authPassword);
      } else {
        data = await loginUser(authEmail, authPassword);
      }
      setSession(data);
      localStorage.setItem("cloudvault_session", JSON.stringify(data));
      setAuthPassword("");
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  const handleLogout = () => {
    setSession(null);
    setAssets([]);
    localStorage.removeItem("cloudvault_session");
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file || !session) return;

    try {
      setUploading(true);
      setStatusMsg("Acquiring signed ticket & streaming directly to Amazon S3...");

      await directS3Upload(file, session.access_token);

      setStatusMsg("Upload complete! SQS event dispatched to Lambda worker.");
      setFile(null);

      setTimeout(() => loadAssets(), 2000);
      setTimeout(() => loadAssets(), 5000);
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? `Upload failed: ${err.message}` : "Upload error");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (assetId: string) => {
    if (!session) return;
    try {
      const downloadUrl = await getAssetDownloadUrl(assetId, session.access_token);
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      alert("Failed to acquire secure download link.");
    }
  };

  // 1. Unauthenticated: Show Login / Signup Screen
  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-indigo-400">CloudVault</h1>
            <p className="text-xs text-slate-400 mt-1">
              {isRegister ? "Create your secure account" : "Sign in to access your assets"}
            </p>
          </div>

          {authError && (
            <div className="bg-rose-950 border border-rose-800 text-rose-300 px-3 py-2 rounded-lg text-xs">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Password</label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-lg text-sm transition"
            >
              {isRegister ? "Create Account" : "Sign In"}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setAuthError("");
              }}
              className="text-xs text-indigo-400 hover:underline"
            >
              {isRegister ? "Already have an account? Sign In" : "Need an account? Sign Up"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 2. Authenticated Dashboard
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="border-b border-slate-800 pb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-indigo-400">CloudVault Asset Hub</h1>
            <p className="text-sm text-slate-400 mt-1">Logged in as {session.name} ({session.email})</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-xs rounded-lg transition"
          >
            Sign Out
          </button>
        </div>

        {/* Ingestion Section */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Direct S3 Asset Ingestion</h2>
          <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-4 items-center">
            <input
              type="file"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 text-sm text-slate-400 w-full cursor-pointer"
            />
            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium rounded-lg text-sm transition shrink-0"
            >
              {uploading ? "Streaming to S3..." : "Upload"}
            </button>
          </form>
          {statusMsg && <p className="text-xs text-indigo-300 mt-3 font-mono">{statusMsg}</p>}
        </section>

        {/* Asset Catalog */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-200">My Assets</h2>
            <button onClick={loadAssets} className="text-xs text-indigo-400 hover:text-indigo-300 transition">
              Refresh Table
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/50 text-xs uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">File Name</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">S3 Key</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No assets found. Upload an image, PDF, or video above.
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset.assetId} className="hover:bg-slate-800/50 transition">
                      <td className="px-6 py-4 font-medium text-slate-200">{asset.fileName}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">{asset.mimeType}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            asset.status === "COMPLETED"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-amber-950 text-amber-400 border border-amber-800"
                          }`}
                        >
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500 truncate max-w-xs">
                        {asset.s3KeyRaw}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {asset.status === "COMPLETED" ? (
                          <button
                            onClick={() => handleDownload(asset.assetId)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline"
                          >
                            Download (CDN)
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Processing...</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}