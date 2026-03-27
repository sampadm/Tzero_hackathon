"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken, getUserEmail, getRole } from "@/lib/auth";

export default function Nav() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setEmail(getUserEmail());
    setRole(getRole());
  }, []);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <nav
      style={{
        background: "var(--deep)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
            <span style={{ color: "var(--emerald)" }}>t</span>
            <span style={{ color: "var(--text-primary)" }}>Zero</span>
            <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
              BYOA
            </span>
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {role === "compliance_reviewer" && (
            <Link
              href="/admin/queue"
              style={{ color: "var(--text-secondary)", fontSize: 14, textDecoration: "none" }}
            >
              Review Queue
            </Link>
          )}
          {email && (
            <span style={{ color: "var(--text-dim)", fontSize: 13 }}>{email}</span>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              padding: "5px 14px",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
