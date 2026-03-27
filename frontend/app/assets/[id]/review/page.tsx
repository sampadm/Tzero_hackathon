"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Nav from "@/components/Nav";
import {
  getAsset,
  getExtraction,
  confirmField,
  overrideField,
  submitAsset,
  AssetOut,
  ExtractionOut,
  FieldOut,
} from "@/lib/api";

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH: "var(--emerald)",
  MEDIUM: "var(--amber)",
  LOW: "var(--danger)",
};

function FieldRow({
  field,
  onConfirm,
  onOverride,
}: {
  field: FieldOut;
  onConfirm: (id: string) => void;
  onOverride: (id: string, val: string, reason: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(field.display_value);
  const [editReason, setEditReason] = useState("");

  return (
    <div
      style={{
        padding: "14px 20px",
        borderBottom: "1px solid var(--border)",
        background: field.confirmed ? "rgba(32,245,84,0.03)" : "transparent",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "var(--text-dim)",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {field.display_label}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: CONFIDENCE_COLOR[field.confidence] ?? "var(--text-dim)",
                background: "var(--surface)",
                border: `1px solid ${CONFIDENCE_COLOR[field.confidence] ?? "var(--border)"}`,
                padding: "1px 6px",
                borderRadius: 10,
                letterSpacing: "0.04em",
              }}
            >
              {field.confidence}
            </span>
            {field.confirmed && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--emerald)",
                  background: "var(--emerald-dim)",
                  border: "1px solid var(--emerald-border)",
                  padding: "1px 6px",
                  borderRadius: 10,
                }}
              >
                CONFIRMED
              </span>
            )}
          </div>

          {editing ? (
            <div style={{ marginTop: 8 }}>
              <input
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--emerald)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  marginBottom: 8,
                  outline: "none",
                }}
              />
              <input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Reason for change (required)"
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => {
                    if (!editReason.trim()) return;
                    onOverride(field.id, editVal, editReason);
                    setEditing(false);
                  }}
                  style={{
                    background: "var(--emerald)",
                    color: "var(--void)",
                    border: "none",
                    borderRadius: 6,
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditVal(field.display_value);
                  }}
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                    borderRadius: 6,
                    padding: "5px 14px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                fontSize: 15,
                color:
                  field.display_value && field.display_value !== "N/A"
                    ? "var(--text-primary)"
                    : "var(--text-dim)",
                fontWeight: 500,
              }}
            >
              {field.display_value || "—"}
            </div>
          )}

          {field.source_quote && !editing && (
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "var(--text-dim)",
                fontStyle: "italic",
                paddingLeft: 8,
                borderLeft: "2px solid var(--border)",
              }}
            >
              "{field.source_quote}"
            </div>
          )}
        </div>

        {!editing && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {!field.confirmed && (
              <button
                onClick={() => onConfirm(field.id)}
                style={{
                  background: "var(--emerald-dim)",
                  border: "1px solid var(--emerald-border)",
                  color: "var(--emerald)",
                  borderRadius: 6,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Confirm
              </button>
            )}
            <button
              onClick={() => {
                setEditing(true);
                setEditVal(field.display_value);
              }}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams();
  const assetId = String(params.id);

  const [asset, setAsset] = useState<AssetOut | null>(null);
  const [extraction, setExtraction] = useState<ExtractionOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, e] = await Promise.all([
        getAsset(assetId),
        getExtraction(assetId).catch(() => null),
      ]);
      setAsset(a);
      setExtraction(e);

      const active = ["extracting", "pdf_uploaded"].includes(a.status);
      setPolling(active);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [polling, load]);

  async function handleConfirm(fieldId: string) {
    try {
      await confirmField(fieldId);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to confirm");
    }
  }

  async function handleOverride(
    fieldId: string,
    val: string,
    reason: string
  ) {
    try {
      await overrideField(fieldId, val, reason);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to override");
    }
  }

  async function handleProceed() {
    setSubmitting(true);
    setError("");
    try {
      await submitAsset(assetId);
      router.push(`/assets/${assetId}/contract`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Nav />
        <div
          style={{
            textAlign: "center",
            padding: 80,
            color: "var(--text-dim)",
          }}
        >
          Loading…
        </div>
      </>
    );
  }

  const status = asset?.status ?? "";
  const isExtracting = ["extracting", "pdf_uploaded"].includes(status);
  const hasExtraction = extraction && extraction.sections;
  const canProceed =
    hasExtraction &&
    extraction.counts.needs_review === 0 &&
    ["extraction_complete", "awaiting_intermediary_review"].includes(status);

  return (
    <>
      <Nav />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 24 }}>
          <span
            style={{ cursor: "pointer", color: "var(--emerald)" }}
            onClick={() => router.push("/dashboard")}
          >
            Dashboard
          </span>
          {" / "}
          <span>{asset?.name}</span>
          {" / "}
          <span>Review</span>
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              {asset?.name}
            </h1>
            <span
              style={{
                fontSize: 13,
                color: "var(--emerald)",
                fontFamily: "monospace",
                fontWeight: 600,
              }}
            >
              {asset?.ref_number}
            </span>
          </div>

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 12,
              color: "var(--text-dim)",
            }}
          >
            Status:{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {status.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Extracting state */}
        {isExtracting && (
          <div
            style={{
              background: "var(--amber-dim)",
              border: "1px solid var(--amber)",
              borderRadius: 10,
              padding: 24,
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 24,
                color: "var(--amber)",
                marginBottom: 8,
              }}
            >
              ⟳
            </div>
            <div
              style={{
                fontWeight: 600,
                color: "var(--amber)",
                marginBottom: 4,
              }}
            >
              AI Extraction in Progress
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Claude is analyzing your term sheet… this takes ~30 seconds
            </div>
          </div>
        )}

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

        {/* Compliance flags */}
        {extraction?.compliance_flags && extraction.compliance_flags.length > 0 && (
          <div
            style={{
              background: "var(--amber-dim)",
              border: "1px solid var(--amber)",
              borderRadius: 10,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--amber)",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Compliance Flags
            </div>
            {extraction.compliance_flags.map((f) => (
              <div key={f.id} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: "var(--amber)", fontWeight: 600 }}>
                  ⚠ {f.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {f.description}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Progress summary */}
        {hasExtraction && (
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {[
              {
                label: "Total Fields",
                value: extraction.counts.total,
                color: "var(--text-primary)",
              },
              {
                label: "Confirmed",
                value: extraction.counts.total - extraction.counts.needs_review,
                color: "var(--emerald)",
              },
              {
                label: "Needs Review",
                value: extraction.counts.needs_review,
                color: extraction.counts.needs_review > 0 ? "var(--danger)" : "var(--text-dim)",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "12px 20px",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: s.color,
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Field sections */}
        {hasExtraction &&
          Object.entries(extraction.sections).map(([section, fields]) => (
            <div
              key={section}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                marginBottom: 16,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 20px",
                  background: "var(--surface)",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {section.replace(/_/g, " ")}
              </div>
              {fields.map((f) => (
                <FieldRow
                  key={f.id}
                  field={f}
                  onConfirm={handleConfirm}
                  onOverride={handleOverride}
                />
              ))}
            </div>
          ))}

        {/* Proceed button */}
        {canProceed && (
          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={handleProceed}
              disabled={submitting}
              style={{
                background: submitting ? "var(--muted)" : "var(--emerald)",
                color: "var(--void)",
                border: "none",
                borderRadius: 8,
                padding: "12px 28px",
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Submitting…" : "Submit for Compliance Review →"}
            </button>
          </div>
        )}

        {extraction && extraction.counts.needs_review > 0 && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 16px",
              background: "var(--danger-dim)",
              border: "1px solid var(--danger)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--danger)",
              textAlign: "center",
            }}
          >
            {extraction.counts.needs_review} field(s) have LOW confidence — please
            confirm or edit them before proceeding
          </div>
        )}
      </div>
    </>
  );
}
