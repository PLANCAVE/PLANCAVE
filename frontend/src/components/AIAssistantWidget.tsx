import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Send, X } from 'lucide-react';
import { aiChat } from '../api';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export default function AIAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Tell me what you want to build (budget, bedrooms, floors, and whether you need BOQ/MEP/Structural). I will recommend plans that fit.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement | null>(null);

  const pageContext = useMemo(() => {
    const path = location.pathname || '';
    const m = path.match(/^\/plans\/(.+)$/);
    return {
      page: path,
      plan_id: m?.[1] || null,
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages, loading]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const resp = await aiChat({
        message: trimmed,
        page: pageContext.page,
        plan_id: pageContext.plan_id,
      });

      const reply = String(resp.data?.reply || '').trim();
      const suggested = Array.isArray(resp.data?.suggested_plans) ? resp.data.suggested_plans : [];

      let suffix = '';
      if (suggested.length) {
        const top = suggested.slice(0, 5);
        const lines = top
          .map((p: any, idx: number) => {
            const name = p?.name ? String(p.name) : 'Plan';
            const id = p?.id ? String(p.id) : '';
            const price = p?.price !== undefined && p?.price !== null ? Number(p.price) : null;
            const priceText = price !== null && Number.isFinite(price) ? `$ ${price.toLocaleString()}` : '';
            const link = id ? `\nOpen: /plans/${id}` : '';
            return `${idx + 1}. ${name}${priceText ? ` (${priceText})` : ''}${link}`;
          })
          .join('\n');
        suffix = `\n\nSuggested plans:\n${lines}`;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: (reply || 'I can help you find a plan. Tell me your budget, bedrooms, floors, and must-have deliverables.') + suffix,
        },
      ]);

      if (suggested.length && suggested[0]?.id) {
        const id = String(suggested[0].id);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `If you want, I can open the top match now: /plans/${id}`,
          },
        ]);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'AI request failed';
      setError(String(msg));
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I could not respond right now. Please try again in a moment.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  };

  const handleMaybeOpenPlanLink = (text: string) => {
    const m = text.match(/\/plans\/[a-zA-Z0-9-]+/);
    if (!m) return;
    const url = m[0];
    navigate(url);
    setOpen(false);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[70]">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 shadow-xl"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-semibold">Ask AI</span>
        </button>
      ) : (
        <div className="w-[340px] max-w-[90vw] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-700 to-cyan-700 text-white">
            <div className="text-sm font-semibold">Plan Assistant</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-md hover:bg-white/10"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div ref={listRef} className="max-h-[360px] overflow-y-auto p-3 space-y-3">
            {messages.map((m, idx) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={idx}
                  className={
                    'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ' +
                    (isUser ? 'bg-slate-900 text-white ml-10' : 'bg-slate-100 text-slate-900 mr-10')
                  }
                  onDoubleClick={() => {
                    if (!isUser) handleMaybeOpenPlanLink(m.content);
                  }}
                >
                  {m.content}
                </div>
              );
            })}
            {loading ? (
              <div className="rounded-2xl px-3 py-2 text-sm bg-slate-100 text-slate-700 mr-10">Thinking…</div>
            ) : null}
            {error ? (
              <div className="rounded-2xl px-3 py-2 text-xs bg-rose-50 text-rose-700 border border-rose-200">
                {error}
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200 p-3 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Budget, bedrooms, floors, deliverables…"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={loading}
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              className="inline-flex items-center justify-center rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white px-3 py-2"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 pb-3 text-[11px] text-slate-500">
            Double-click an assistant message containing a /plans/... link to open it.
          </div>
        </div>
      )}
    </div>
  );
}
