"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { createAsset, uploadPdf, submitAsset } from "@/lib/api";

const STEPS = [
  { n: 1, label: "Asset Details" },
  { n: 2, label: "Upload Term Sheet" },
  { n: 3, label: "Submit for Review" },
];

export default function NewAssetPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [assetId, setAssetId] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Step 2
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const asset = await createAsset({ name, company_name: companyName });
      setAssetId(asset.id);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create asset");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !assetId) return;
    setError("");
    setLoading(true);
    try {
      await uploadPdf(assetId, file);
      router.push(`/assets/${assetId}/review`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep3() {
    if (!assetId) return;
    setError("");
    setLoading(true);
    try {
      await submitAsset(assetId);
      router.push(`/assets/${assetId}/review`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") setFile(f);
    else setError("Please upload a PDF file");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "var(--text-primary)",
    fontSize: 14,
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-secondary)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  return (
    <>
      <Nav />
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px" }}>
        {/* Breadcrumb */}
        <div
          style={{
            fontSize: 13,
            color: "var(--text-dim)",
            marginBottom: 28,
          }}
        >
          <span
            style={{ cursor: "pointer", color: "var(--emerald)" }}
            onClick={() => router.push("/dashboard")}
          >
            Dashboard
          </span>
          {" / "}
          <span>New Asset</span>
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 32,
            color: "var(--text-primary)",
          }}
        >
          Tokenize New Asset
        </h1>

        {/* Step indicators */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 40,
            gap: 0,
          }}
        >
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              style={{ display: "flex", alignItems: "center", flex: 1 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                    background:
                      step > s.n
                        ? "var(--emerald)"
                        : step === s.n
                          ? "var(--emerald-dim)"
                          : "var(--surface)",
                    border:
                      step >= s.n
                        ? "2px solid var(--emerald)"
                        : "2px solid var(--border)",
                    color:
                      step > s.n
                        ? "var(--void)"
                        : step === s.n
                          ? "var(--emerald)"
                          : "var(--text-dim)",
                  }}
                >
                  {step > s.n ? "✓" : s.n}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: step === s.n ? 600 : 400,
                    color:
                      step >= s.n ? "var(--text-primary)" : "var(--text-dim)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background:
                      step > s.n ? "var(--emerald)" : "var(--border)",
                    margin: "0 12px",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 32,
          }}
        >
          {/* ── Step 1 ── */}
          {step === 1 && (
            <form onSubmit={handleStep1}>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 24,
                  color: "var(--text-primary)",
                }}
              >
                Asset Details
              </h2>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Asset Name</label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Acme Series B Preferred"
                />
              </div>

              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>Company Name</label>
                <input
                  style={inputStyle}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  placeholder="e.g. Acme Inc."
                />
              </div>

              {error && (
                <div
                  style={{
                    background: "var(--danger-dim)",
                    border: "1px solid var(--danger)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "var(--danger)",
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading ? "var(--muted)" : "var(--emerald)",
                  color: "var(--void)",
                  border: "none",
                  borderRadius: 8,
                  padding: "11px 24px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Creating…" : "Continue →"}
              </button>
            </form>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <form onSubmit={handleStep2}>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "var(--text-primary)",
                }}
              >
                Upload Term Sheet
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-dim)",
                  marginBottom: 24,
                }}
              >
                Upload the equity term sheet PDF. Our AI will extract all
                relevant parameters.
              </p>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onClick={() =>
                  document.getElementById("pdf-input")?.click()
                }
                style={{
                  border: `2px dashed ${dragOver ? "var(--emerald)" : file ? "var(--emerald-border)" : "var(--border)"}`,
                  borderRadius: 10,
                  padding: "48px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver
                    ? "var(--emerald-dim)"
                    : file
                      ? "rgba(32,245,84,0.05)"
                      : "var(--surface)",
                  transition: "all 0.15s",
                  marginBottom: 24,
                }}
              >
                <input
                  id="pdf-input"
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setFile(f);
                  }}
                />
                {file ? (
                  <>
                    <div
                      style={{
                        fontSize: 28,
                        marginBottom: 8,
                        color: "var(--emerald)",
                      }}
                    >
                      ✓
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "var(--emerald)",
                        marginBottom: 4,
                      }}
                    >
                      {file.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {(file.size / 1024).toFixed(1)} KB · Click to change
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        fontSize: 32,
                        marginBottom: 12,
                        color: "var(--text-dim)",
                      }}
                    >
                      ↑
                    </div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        marginBottom: 4,
                      }}
                    >
                      Drop PDF here or click to browse
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      Term sheet, investment agreement, or SAFE
                    </div>
                  </>
                )}
              </div>

              {error && (
                <div
                  style={{
                    background: "var(--danger-dim)",
                    border: "1px solid var(--danger)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "var(--danger)",
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    borderRadius: 8,
                    padding: "11px 20px",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={!file || loading}
                  style={{
                    background:
                      !file || loading ? "var(--muted)" : "var(--emerald)",
                    color: "var(--void)",
                    border: "none",
                    borderRadius: 8,
                    padding: "11px 24px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: !file || loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Uploading…" : "Upload & Continue →"}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <div>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "var(--text-primary)",
                }}
              >
                Ready to Submit
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-dim)",
                  marginBottom: 28,
                }}
              >
                Your asset and term sheet are ready. Submitting will start AI
                extraction and queue for compliance review.
              </p>

              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 20,
                  marginBottom: 24,
                }}
              >
                {[
                  ["Asset Name", name],
                  ["Company", companyName],
                  ["PDF", file?.name ?? "—"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: "var(--text-dim)" }}>{k}</span>
                    <span
                      style={{
                        color: "var(--text-primary)",
                        fontWeight: 500,
                        textTransform: "capitalize",
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>

              {error && (
                <div
                  style={{
                    background: "var(--danger-dim)",
                    border: "1px solid var(--danger)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "var(--danger)",
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    borderRadius: 8,
                    padding: "11px 20px",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleStep3}
                  disabled={loading}
                  style={{
                    background: loading ? "var(--muted)" : "var(--emerald)",
                    color: "var(--void)",
                    border: "none",
                    borderRadius: 8,
                    padding: "11px 24px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Submitting…" : "Submit for Tokenization →"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
