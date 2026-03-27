"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Nav from "@/components/Nav";
import {
  getComplianceItem,
  submitComplianceDecision,
  ComplianceDetail,
  FieldOut,
} from "@/lib/api";

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH: "var(--emerald)",
  MEDIUM: "var(--amber)",
  LOW: "var(--danger)",
};

export default function ReviewDetailPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = Number(params.id);

  const [item, setItem] = useState<ComplianceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<"approved" | "rejected" | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    getComplianceItem(itemId)
      .then(setItem)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [itemId]);

  async function handleSubmit() {
    if (!decision) return;
    setSubmitting(true);
    setError("");
    try {
      await submitComplianceDecision(itemId, decision, notes);
      router.push("/admin/queue");
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
        <div style={{ textAlign: "center", padding: 80, color: "var(--text-dim)" }}>
          Loading…
        </div>
      </>
    );
  }

  const isPending = item?.status === "pending";

  return (
    <>
      <Nav />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 24 }}>
          <span
            style={{ cursor: "pointer", color: "var(--emerald)" }}
            onClick={() => router.push("/admin/queue")}
          >
            Review Queue
          </span>
          {" / "}
          <span>{item?.asset_name}</span>
        </div>

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
              {item?.asset_name}
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
              {item?.review_type === "extraction_review"
                ? "AI Extraction Review"
                : "Contract Approval Review"}
            </div>
          </div>

          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color:
                item?.status === "pending"
                  ? "var(--amber)"
                  : item?.status === "approved"
                    ? "var(--emerald)"
                    : "var(--danger)",
              background: "var(--surface)",
              border: `1px solid ${
                item?.status === "pending"
                  ? "var(--amber)"
                  : item?.status === "approved"
                    ? "var(--emerald)"
                    : "var(--danger)"
              }`,
              padding: "5px 14px",
              borderRadius: 20,
            }}
          >
            {item?.status?.toUpperCase()}
          </span>
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

        {/* Compliance flags */}
        {item?.compliance_flags && item.compliance_flags.length > 0 && (
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
            {item.compliance_flags.map((f, i) => (
              <div key={i} style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                ⚠ {f}
              </div>
            ))}
          </div>
        )}

        {/* Extracted fields */}
        {item?.fields && Object.keys(item.fields).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            {Object.entries(item.fields).map(([section, fields]) => (
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
                    padding: "10px 20px",
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
                {(fields as FieldOut[]).map((f) => (
                  <div
                    key={f.id}
                    style={{
                      padding: "12px 20px",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-dim)",
                          marginBottom: 3,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {f.display_label}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--text-primary)",
                          fontWeight: 500,
                        }}
                      >
                        {f.display_value || "—"}
                      </div>
                      {f.source_quote && (
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
                          "{f.source_quote}"
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: CONFIDENCE_COLOR[f.confidence] ?? "var(--text-dim)",
                          background: "var(--surface)",
                          border: `1px solid ${CONFIDENCE_COLOR[f.confidence] ?? "var(--border)"}`,
                          padding: "2px 7px",
                          borderRadius: 10,
                        }}
                      >
                        {f.confidence}
                      </span>
                      {f.confirmed && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--emerald)",
                            background: "var(--emerald-dim)",
                            border: "1px solid var(--emerald-border)",
                            padding: "2px 7px",
                            borderRadius: 10,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Contract details */}
        {item?.contract && (
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 24,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 12,
                }}
              >
                Contract Summary
              </div>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {item.contract.human_summary}
              </p>
            </div>

            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setShowCode(!showCode)}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <span>Solidity Source</span>
                <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
                  {showCode ? "▲ Hide" : "▼ Show"}
                </span>
              </button>
              {showCode && (
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    padding: 20,
                    background: "var(--surface)",
                    overflowX: "auto",
                  }}
                >
                  <pre
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      lineHeight: 1.6,
                      fontFamily: "monospace",
                      margin: 0,
                    }}
                  >
                    {item.contract.solidity_source}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Decision form */}
        {isPending && (
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 24,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 16,
              }}
            >
              Your Decision
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {(["approved", "rejected"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDecision(d)}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: 8,
                    border: `2px solid ${
                      decision === d
                        ? d === "approved"
                          ? "var(--emerald)"
                          : "var(--danger)"
                        : "var(--border)"
                    }`,
                    background:
                      decision === d
                        ? d === "approved"
                          ? "var(--emerald-dim)"
                          : "var(--danger-dim)"
                        : "var(--surface)",
                    color:
                      decision === d
                        ? d === "approved"
                          ? "var(--emerald)"
                          : "var(--danger)"
                        : "var(--text-secondary)",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {d === "approved" ? "✓ Approve" : "✗ Reject"}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Notes {decision === "rejected" ? "(required)" : "(optional)"}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add review notes or rejection reason…"
                style={{
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={() => router.push("/admin/queue")}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  borderRadius: 8,
                  padding: "10px 20px",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!decision || submitting || (decision === "rejected" && !notes.trim())}
                style={{
                  background:
                    !decision || submitting
                      ? "var(--muted)"
                      : decision === "approved"
                        ? "var(--emerald)"
                        : "var(--danger)",
                  color:
                    decision === "rejected" ? "var(--text-primary)" : "var(--void)",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 24px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: !decision || submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting
                  ? "Submitting…"
                  : decision === "approved"
                    ? "Approve"
                    : decision === "rejected"
                      ? "Reject"
                      : "Submit Decision"}
              </button>
            </div>
          </div>
        )}

        {!isPending && item?.status && (
          <div
            style={{
              background:
                item.status === "approved"
                  ? "var(--emerald-dim)"
                  : "var(--danger-dim)",
              border: `1px solid ${item.status === "approved" ? "var(--emerald)" : "var(--danger)"}`,
              borderRadius: 10,
              padding: 20,
              textAlign: "center",
              fontSize: 14,
              fontWeight: 600,
              color: item.status === "approved" ? "var(--emerald)" : "var(--danger)",
            }}
          >
            {item.status === "approved"
              ? "✓ This item was approved"
              : "✗ This item was rejected"}
          </div>
        )}
      </div>
    </>
  );
}
