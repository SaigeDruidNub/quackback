"use client";
import React, { useState, useEffect } from "react";
import type { Message } from "../types/message";
import Image from "next/image";
import { askGemini } from "./gemini";

export default function Home() {
  type LocalMessage = Message | { user: string; ai: string[] };

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/conversations");
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
        const res = await fetch(`/api/conversations/${activeConv}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages ?? []);
        }
      } catch (err) {
        console.error("Failed to load conversation messages", err);
      }
    })();
  }, [activeConv]);

  const createConversation = async () => {
    try {
      const res = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New conversation' }) });
      const body = await res.json();
      if (body.insertedId) {
        const cRes = await fetch(`/api/conversations/${body.insertedId}`);
        const conv = await cRes.json();
        setConversations((prev) => [conv, ...prev]);
        setActiveConv(body.insertedId);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to create conversation', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!activeConv) {
      await createConversation();
    }
    if (!activeConv) return;

    setLoading(true);
    setError(null);
    try {
      const aiResponse = await askGemini(input);
      const newMsg = { user: input, ai: aiResponse, createdAt: new Date().toISOString() };
      // optimistic update
      setMessages((prev) => [...prev, newMsg]);

      await fetch(`/api/conversations/${activeConv}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: input, ai: aiResponse }),
      });

      // refresh conversations list updatedAt
      const convs = await (await fetch('/api/conversations')).json();
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
      <div style={{ maxWidth: 960, margin: "0 auto", display: 'flex', gap: 24 }}>
        <aside style={{ width: 260, background: 'var(--color-surface)', borderRadius: 12, padding: 16, boxShadow: '0 4px 24px #0002' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>Conversations</strong>
            <button onClick={createConversation} style={{ background: 'var(--color-primary-yellow)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>New</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {conversations.map((c) => (
              <button key={c._id} onClick={() => setActiveConv(c._id)} style={{ textAlign: 'left', background: activeConv === c._id ? 'rgba(255, 223, 99, 0.15)' : 'transparent', border: 'none', padding: '8px 6px', borderRadius: 6, cursor: 'pointer' }}>
                <div style={{ fontWeight: 600 }}>{c.title ?? 'Conversation'}</div>
                <div style={{ fontSize: 12, color: 'var(--color-secondary-text)' }}>{new Date(c.updatedAt ?? c.createdAt).toLocaleString()}</div>
                <div style={{ marginTop: 6 }}>
                  <button onClick={async (e) => { e.stopPropagation(); if (!confirm('Delete this conversation?')) return; try { const res = await fetch(`/api/conversations/${c._id}`, { method: 'DELETE' }); if (!res.ok) throw new Error('Delete failed'); setConversations((prev) => prev.filter((x) => x._id !== c._id)); if (activeConv === c._id) setActiveConv(conversations.length ? conversations[0]._id : null); } catch (err) { console.error(err); alert('Failed to delete conversation'); } }} style={{ background: 'transparent', border: 'none', color: 'var(--color-warning)', cursor: 'pointer' }}>Delete</button>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section style={{ flex: 1, background: 'var(--color-surface)', borderRadius: 12, padding: 24, boxShadow: '0 4px 24px #0002' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>{conversations.find((c) => c._id === activeConv)?.title ?? 'New Chat'}</h2>
            <div style={{ color: 'var(--color-secondary-text)', fontSize: 13 }}>{messages.length} messages</div>
          </div>
        <Image
          src="/DuckTypeLogo.png"
          alt="DuckType Logo"
          width={500}
          height={500}
          style={{ marginBottom: 12 }}
          priority
        />

        <p style={{ color: "var(--color-secondary-text)", marginBottom: 24 }}>
          Ask a question or post a comment. The Duck will only respond with
          questions to help you think deeper!
        </p>
        {error && (
          <div style={{ color: "var(--color-warning)", marginBottom: 16 }}>
            {error}
          </div>
        )}
          <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: 520, width: '100%', marginBottom: 24, paddingRight: 8 }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: 24 }}>
                <div style={{ color: 'var(--color-primary-yellow)', fontWeight: 600, marginBottom: 4 }}>You:</div>
                <div style={{ color: 'var(--color-primary-text)', marginBottom: 8 }}>{msg.user}</div>
                <div style={{ color: 'var(--color-insight-accent)', fontWeight: 500, marginBottom: 4 }}>Duck:</div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {msg.ai.map((q, i) => (
                    <li key={i} style={{ color: i === 2 ? 'var(--color-warning)' : 'var(--color-insight-accent)', marginBottom: 2 }}>{q}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder='Type your question or comment...' style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: 'var(--color-bg)', color: 'var(--color-primary-text)' }} disabled={loading} />
            <button type='submit' style={{ background: 'var(--color-primary-yellow)', color: '#151C2F', border: 'none', borderRadius: 8, padding: '0 20px', fontWeight: 700, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }} disabled={loading}>{loading ? 'Thinking...' : 'Ask'}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
