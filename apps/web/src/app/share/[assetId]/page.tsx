"use client";

import React, { useEffect, useState, use } from "react";
import { fetchSharedAsset, Asset } from "../../api";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SharedAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const resolvedParams = use(params);
  const assetId = resolvedParams.assetId;

  const [token, setToken] = useState<string | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authentication states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      setToken(savedToken);
      loadAsset(savedToken);
    } else {
      setLoading(false);
    }
  }, [assetId]);

  const loadAsset = async (authToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSharedAsset(assetId, authToken);
      setAsset(data);
    } catch (err: any) {
      setError(err.message || "Failed to load shared asset.");
    } finally {
      setLoading(false);
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
        setAuthError("Account created! Please sign in to view the file.");
      } else {
        localStorage.setItem("token", data.access_token);
        setToken(data.access_token);
        await loadAsset(data.access_token);
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b19] flex items-center justify-center text-white">
        <p className="text-gray-400 text-sm">Verifying access to shared vault asset...</p>
      </div>
    );
  }

  // Auth gate
  if (!token) {
    return (
      <div className="min-h-screen bg-[#070b19] flex items-center justify-center p-4 text-white">
        <div className="bg-[#0e162f] border border-blue-900/40 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <h1 className="text-2xl font-bold text-center text-blue-400 mb-1">Shared Vault File</h1>
          <p className="text-gray-400 text-xs text-center mb-6">
            Sign in or create a CloudVault account to view this file.
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
                  className="w-full mt-1 bg-[#162244] border border-blue-800/40 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
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
                className="w-full mt-1 bg-[#162244] border border-blue-800/40 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 bg-[#162244] border border-blue-800/40 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 transition py-2.5 rounded-lg font-semibold text-sm shadow-lg shadow-blue-600/30"
            >
              {isSignUp ? "Create Account & View" : "Sign In & View"}
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

  // Authenticated file view
  return (
    <div className="min-h-screen bg-[#070b19] text-white p-6 md:p-12 flex flex-col items-center justify-center">
      <div className="bg-[#0e162f] border border-blue-900/40 rounded-2xl p-8 max-w-xl w-full shadow-2xl space-y-6">
        <div className="flex justify-between items-center border-b border-blue-900/30 pb-4">
          <div>
            <h1 className="text-xl font-bold text-blue-400">Shared Vault Asset</h1>
            <p className="text-xs text-gray-400">Authenticated Access Verified</p>
          </div>
          <Link
            href="/"
            className="text-xs text-blue-400 hover:underline border border-blue-800/50 px-3 py-1.5 rounded-lg bg-blue-950/30"
          >
            Go to My Vault
          </Link>
        </div>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-4 rounded-lg">
            {error}
          </div>
        ) : asset ? (
          <div className="space-y-6">
            <div className="bg-[#162244] p-4 rounded-xl border border-blue-800/30 space-y-2">
              <p className="text-sm font-semibold text-gray-200 truncate">{asset.file_name}</p>
              <div className="flex justify-between items-center text-xs text-gray-400 font-mono">
                <span>{asset.content_type}</span>
                <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                  {asset.status}
                </span>
              </div>
            </div>

            {/* Image Preview */}
            {asset.content_type.startsWith("image/") && asset.download_url && (
              <div className="rounded-xl overflow-hidden border border-blue-900/40 max-h-72 flex justify-center bg-black/40">
                <img
                  src={asset.download_url}
                  alt={asset.file_name}
                  className="object-contain max-h-72"
                />
              </div>
            )}

            {/* Video Preview */}
            {asset.content_type.startsWith("video/") && asset.download_url && (
              <div className="rounded-xl overflow-hidden border border-blue-900/40 bg-black/40">
                <video src={asset.download_url} controls className="w-full max-h-72" />
              </div>
            )}

            <div className="flex gap-4">
              <a
                href={asset.download_url}
                target="_blank"
                rel="noreferrer"
                download={asset.file_name}
                className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-600/30"
              >
                Download File
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}