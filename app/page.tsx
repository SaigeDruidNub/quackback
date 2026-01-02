"use client";
import React, { useState, useEffect } from "react";
import type { Message } from "../types/message";
import Image from "next/image";
import { askGemini, GeminiMessage } from "./gemini";

export default function Home() {
  const [ahaModal, setAhaModal] = useState(false);
  const [ahaInput, setAhaInput] = useState("");
  const [ahaMoment, setAhaMoment] = useState<any>(null);
  // User ID for per-user conversations
  function getUserId() {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem("userId");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("userId", id);
    }
    return id;
  }
  const userId = typeof window !== "undefined" ? getUserId() : "";
  type LocalMessage = Message | { user: string; ai: string | string[] };

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/conversations?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
          if (data.length) setActiveConv(data[0]._id);
        }
      } catch (err) {
        console.error("Failed to load conversations", err);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!activeConv) return;
      try {
        const res = await fetch(
          `/api/conversations/${activeConv}?userId=${userId}`
        );
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages ?? []);
          setAhaMoment(data.ahaMoment ?? null);
        }
      } catch (err) {
        console.error("Failed to load conversation messages", err);
      }
    })();
  }, [activeConv]);
  const handleAhaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ahaInput.trim() || !activeConv) return;
    try {
      const res = await fetch(
        `/api/conversations/${activeConv}?userId=${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: ahaInput.trim() }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setAhaMoment(data.ahaMoment);
        setAhaModal(false);
        setAhaInput("");
      }
    } catch (err) {
      alert("Failed to save Aha Moment");
    }
  };

  const createConversation = async (title: string) => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "New conversation", userId }),
      });
      const body = await res.json();
      if (body.insertedId) {
        const cRes = await fetch(
          `/api/conversations/${body.insertedId}?userId=${userId}`
        );
        const conv = await cRes.json();
        setConversations((prev) => [conv, ...prev]);
        setActiveConv(body.insertedId);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to create conversation", err);
    }
  };

  const handleNewConversation = () => {
    setNewTitle("");
    setShowModal(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowModal(false);
    await createConversation(newTitle.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!activeConv) {
      await createConversation("");
    }
    if (!activeConv) return;

    setLoading(true);
    setError(null);
    try {
      // Build conversation history for Gemini
      const conversation: GeminiMessage[] = [
        ...messages.flatMap((msg) => {
          const aiArr = Array.isArray(msg.ai)
            ? msg.ai
            : typeof msg.ai === "string"
            ? msg.ai.split(/\n+/)
            : [];
          return [
            { role: "user" as const, parts: [{ text: msg.user }] },
            ...aiArr.map((a) => ({
              role: "model" as const,
              parts: [{ text: a }],
            })),
          ];
        }),
        { role: "user" as const, parts: [{ text: input }] },
      ];

      const aiResponse = await askGemini(conversation);
      const newMsg = {
        user: input,
        ai: aiResponse,
        createdAt: new Date().toISOString(),
      };
      // optimistic update
      setMessages((prev) => [...prev, newMsg]);

      await fetch(`/api/conversations/${activeConv}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: input, ai: aiResponse, userId }),
      });

      // refresh conversations list updatedAt
      const convs = await (
        await fetch(`/api/conversations?userId=${userId}`)
      ).json();
      setConversations(convs);
    } catch (err: any) {
      setError("Failed to get response from Gemini.");
      console.error(err);
    }
    setInput("");
    setLoading(false);
  };

  return (
    <main
      style={{ background: "var(--color-bg)", minHeight: "100vh", padding: 24 }}
    >
      <div
        style={{ maxWidth: 960, margin: "0 auto", display: "flex", gap: 24 }}
      >
        <aside
          style={{
            width: 260,
            background: "var(--color-surface)",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 4px 24px #0002",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <strong>Conversations</strong>
            <button
              onClick={handleNewConversation}
              style={{
                background: "var(--color-primary-yellow)",
                border: "none",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              New
            </button>
            {showModal && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  background: "rgba(0,0,0,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
              >
                <form
                  onSubmit={handleModalSubmit}
                  style={{
                    background: "#23283a",
                    padding: 32,
                    borderRadius: 16,
                    boxShadow: "0 8px 32px #0006",
                    minWidth: 320,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    alignItems: "stretch",
                  }}
                >
                  <label
                    style={{ color: "#fff", fontWeight: 600, fontSize: 18 }}
                  >
                    Conversation Title
                  </label>
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Enter a title..."
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: "none",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                    maxLength={60}
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      style={{
                        background: "#444a",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 18px",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{
                        background: "var(--color-primary-yellow)",
                        color: "#151C2F",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 18px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      disabled={!newTitle.trim()}
                    >
                      Create
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {conversations.map((c) => (
              <div
                key={c._id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveConv(c._id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setActiveConv(c._id);
                }}
                style={{
                  textAlign: "left",
                  background:
                    activeConv === c._id
                      ? "rgba(255, 223, 99, 0.15)"
                      : "transparent",
                  border: "none",
                  padding: "8px 6px",
                  borderRadius: 6,
                  cursor: "pointer",
                  outline: "none",
                  userSelect: "none",
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {c.title ?? "Conversation"}
                </div>
                <div
                  style={{ fontSize: 12, color: "var(--color-secondary-text)" }}
                >
                  {new Date(c.updatedAt ?? c.createdAt).toLocaleString()}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (
                        !confirm(
                          "Delete this conversation? The duck will no longer remember anything from this conversation once it's deleted."
                        )
                      )
                        return;
                      try {
                        const res = await fetch(`/api/conversations/${c._id}`, {
                          method: "DELETE",
                        });
                        if (!res.ok) throw new Error("Delete failed");
                        setConversations((prev) =>
                          prev.filter((x) => x._id !== c._id)
                        );
                        if (activeConv === c._id)
                          setActiveConv(
                            conversations.length ? conversations[0]._id : null
                          );
                      } catch (err) {
                        console.error(err);
                        alert("Failed to delete conversation");
                      }
                    }}
                    onKeyDown={async (e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.stopPropagation();
                      if (
                        !confirm(
                          "Delete this conversation? The duck will no longer remember anything from this conversation once it's deleted."
                        )
                      )
                        return;
                      try {
                        const res = await fetch(`/api/conversations/${c._id}`, {
                          method: "DELETE",
                        });
                        if (!res.ok) throw new Error("Delete failed");
                        setConversations((prev) =>
                          prev.filter((x) => x._id !== c._id)
                        );
                        if (activeConv === c._id)
                          setActiveConv(
                            conversations.length ? conversations[0]._id : null
                          );
                      } catch (err) {
                        console.error(err);
                        alert("Failed to delete conversation");
                      }
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--color-warning)",
                      cursor: "pointer",
                      padding: 0,
                      font: "inherit",
                      outline: "none",
                      textDecoration: "underline",
                      display: "inline-block",
                    }}
                  >
                    Delete
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section
          style={{
            flex: 1,
            background: "var(--color-surface)",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 4px 24px #0002",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <h2 style={{ margin: 0 }}>
                {conversations.find((c) => c._id === activeConv)?.title ??
                  "New Chat"}
              </h2>
              <button
                onClick={() => setAhaModal(true)}
                style={{
                  background: "var(--color-primary-yellow)",
                  color: "#151C2F",
                  border: "none",
                  borderRadius: 8,
                  padding: "4px 14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 15,
                }}
              >
                🎉 Aha Moment
              </button>
            </div>
            <div style={{ color: "var(--color-secondary-text)", fontSize: 13 }}>
              {messages.length} messages
            </div>
          </div>
          {ahaMoment && (
            <div
              style={{
                background: "#fffbe6",
                border: "2px solid var(--color-primary-yellow)",
                borderRadius: 10,
                padding: 18,
                marginBottom: 18,
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                boxShadow: "0 2px 12px #0001",
              }}
            >
              <Image
                src="/DTFavIcon.png"
                alt="DuckType Icon"
                width={40}
                height={40}
                style={{ marginRight: 8, borderRadius: 8 }}
                priority
              />
              <div>
                <div
                  style={{ fontWeight: 700, color: "#bfa100", marginBottom: 4 }}
                >
                  Duck says: "Quack! That's an Aha Moment!"
                </div>
                <div style={{ fontSize: 16, color: "#333" }}>
                  <strong>What clicked for you?</strong> <br />
                  <span>{ahaMoment.text}</span>
                </div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                  {ahaMoment.createdAt &&
                    new Date(ahaMoment.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
          {ahaModal && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2000,
              }}
            >
              <form
                onSubmit={handleAhaSubmit}
                style={{
                  background: "#23283a",
                  padding: 32,
                  borderRadius: 16,
                  boxShadow: "0 8px 32px #0006",
                  minWidth: 340,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  alignItems: "stretch",
                }}
              >
                <label style={{ color: "#fff", fontWeight: 600, fontSize: 18 }}>
                  What clicked for you?
                </label>
                <textarea
                  autoFocus
                  value={ahaInput}
                  onChange={(e) => setAhaInput(e.target.value)}
                  placeholder="Describe your Aha Moment..."
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: "none",
                    fontSize: 16,
                    marginBottom: 8,
                    minHeight: 60,
                    resize: "vertical",
                  }}
                  maxLength={300}
                />
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setAhaModal(false)}
                    style={{
                      background: "#444a",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 18px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      background: "var(--color-primary-yellow)",
                      color: "#151C2F",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 18px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    disabled={!ahaInput.trim()}
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          )}
          <Image
            src="/DuckTypeLogo.png"
            alt="DuckType Logo"
            width={500}
            height={500}
            style={{
              marginBottom: 12,
              height: "auto",
              display: "block",
              marginLeft: "auto",
              marginRight: "auto",
            }}
            priority
          />

          <p
            style={{
              color: "var(--color-secondary-text)",
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            Ask the duck a question or post a comment. The Duck will reply with
            questions to help you think deeper!
          </p>
          {error && (
            <div style={{ color: "var(--color-warning)", marginBottom: 16 }}>
              {error}
            </div>
          )}
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: 8, marginBottom: 24 }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question or comment..."
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                border: "none",
                background: "var(--color-bg)",
                color: "var(--color-primary-text)",
              }}
              disabled={loading}
            />
            <button
              type="submit"
              style={{
                background: "var(--color-primary-yellow)",
                color: "#151C2F",
                border: "none",
                borderRadius: 8,
                padding: "0 20px",
                fontWeight: 700,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
              disabled={loading}
            >
              {loading ? "Thinking..." : "Ask"}
            </button>
          </form>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              maxHeight: 520,
              width: "100%",
              paddingRight: 8,
            }}
          >
            {[...messages].reverse().map((msg, idx) => (
              <div key={idx} style={{ marginBottom: 24 }}>
                <div
                  style={{
                    color: "var(--color-insight-accent)",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  You:
                </div>
                <div
                  style={{
                    color: "var(--color-primary-text)",
                    marginBottom: 8,
                  }}
                >
                  {msg.user}
                </div>
                <div
                  style={{
                    color: "var(--color-primary-yellow)",
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  Duck:
                </div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {Array.isArray(msg.ai)
                    ? msg.ai.map((q, i) => (
                        <li
                          key={i}
                          style={{
                            color:
                              i === 2
                                ? "var(--color-warning)"
                                : "var(--color-insight-accent)",
                            marginBottom: 2,
                          }}
                        >
                          {q}
                        </li>
                      ))
                    : String(msg.ai)
                        .split(/\n+/)
                        .map((q, i) => (
                          <li
                            key={i}
                            style={{
                              color:
                                i === 2
                                  ? "var(--color-warning)"
                                  : "var(--color-insight-accent)",
                              marginBottom: 2,
                            }}
                          >
                            {q}
                          </li>
                        ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        {/* Removed duplicate conversation scroll area */}
      </div>
    </main>
  );
}
