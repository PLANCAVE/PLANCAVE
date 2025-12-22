import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Send, Trash2, X } from 'lucide-react';
import { aiChat } from '../api';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type SuggestedPlan = {
  id?: string | null;
  name?: string | null;
  price?: number | string | null;
  url?: string | null;
};

type ChatAction = {
  type?: string;
  label?: string;
  url?: string;
};

export default function AIAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Want the pros and cons of this plan, or help picking the best option? Tell me your budget, bedrooms, floors (single/two storey), and whether BOQ is required. You can also tap a Quick pick below.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [suggestedPlans, setSuggestedPlans] = useState<SuggestedPlan[]>([]);
  const [actions, setActions] = useState<ChatAction[]>([]);

  const resetChat = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          'Want the pros and cons of this plan, or help picking the best option? Tell me your budget, bedrooms, floors (single/two storey), and whether BOQ is required. You can also tap a Quick pick below.',
      },
    ]);
    setInput('');
    setError(null);
    setQuickReplies([]);
    setSuggestedPlans([]);
    setActions([]);
  };

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

  const openPrompts = useMemo(() => {
    if (pageContext.plan_id) {
      return [
        'Summarize this plan in 3 bullet points',
        'What is included in this plan?',
        'Is this plan suitable for a 3-bedroom family home?',
        'Does this plan include BOQ?',
        'What are the pros and cons of this plan?',
      ];
    }
    return [
      'Recommend 3 plans under $500 with BOQ',
      'I want a modern 3 bedroom house plan',
      '2 bedroom single-storey under $300',
      'Show top-selling plans',
      'Help me choose between 2 bedrooms vs 3 bedrooms',
    ];
  }, [pageContext.plan_id]);

  const shouldShowOpenPrompts = useMemo(() => {
    if (!open) return false;
    if (loading) return false;
    // Show prompts until the user starts chatting (beyond the initial assistant message).
    return messages.length <= 1;
  }, [open, loading, messages.length]);

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
    setQuickReplies([]);
    setSuggestedPlans([]);
    setActions([]);
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-10);
      const resp = await aiChat({
        message: trimmed,
        page: pageContext.page,
        plan_id: pageContext.plan_id,
        messages: history,
      });

      const reply = String(resp.data?.reply || '').trim();
      const suggested: SuggestedPlan[] = Array.isArray(resp.data?.suggested_plans) ? resp.data.suggested_plans : [];
      const qr: string[] = Array.isArray(resp.data?.quick_replies) ? resp.data.quick_replies : [];
      const act: ChatAction[] = Array.isArray(resp.data?.actions) ? resp.data.actions : [];
      setSuggestedPlans(suggested.slice(0, 5));
      setQuickReplies(qr.slice(0, 6));
      setActions(act.slice(0, 3));

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: reply || 'Tell me your budget, bedrooms, floors, and whether BOQ is required—or ask for pros and cons of a specific plan.',
        },
      ]);
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

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  };

  const handleOpenPlanUrl = (url?: string | null) => {
    if (!url) return;
    navigate(url);
    setOpen(false);
  };

  const sendQuickReply = async (text: string) => {
    setInput(text);
    await new Promise((r) => setTimeout(r, 0));
    await (async () => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setError(null);
      setQuickReplies([]);
      setSuggestedPlans([]);
      setActions([]);
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setInput('');
      setLoading(true);

      try {
        const history = messages.slice(-10);
        const resp = await aiChat({
          message: trimmed,
          page: pageContext.page,
          plan_id: pageContext.plan_id,
          messages: history,
        });
        const reply = String(resp.data?.reply || '').trim();
        const suggested: SuggestedPlan[] = Array.isArray(resp.data?.suggested_plans) ? resp.data.suggested_plans : [];
        const qr: string[] = Array.isArray(resp.data?.quick_replies) ? resp.data.quick_replies : [];
        const act: ChatAction[] = Array.isArray(resp.data?.actions) ? resp.data.actions : [];
        setSuggestedPlans(suggested.slice(0, 5));
        setQuickReplies(qr.slice(0, 6));
        setActions(act.slice(0, 3));
        setMessages((prev) => [...prev, { role: 'assistant', content: reply || 'OK.' }]);
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || 'AI request failed';
        setError(String(msg));
        setMessages((prev) => [...prev, { role: 'assistant', content: 'I could not respond right now. Please try again in a moment.' }]);
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="fixed z-[70] bottom-20 sm:bottom-4 right-4 left-4 sm:left-auto">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-4 py-3 shadow-xl w-full sm:w-auto justify-center sm:justify-start"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-semibold">Ramani AI</span>
        </button>
      ) : (
        <div className="w-full sm:w-[380px] sm:max-w-[94vw] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-700 to-cyan-700 text-white">
            <div>
              <div className="text-sm font-semibold leading-tight">Ramani AI</div>
              <div className="text-[11px] text-white/80 leading-tight">House plans assistant</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={resetChat}
                className="p-1 rounded-md hover:bg-white/10"
                aria-label="Clear chat"
                title="Clear chat"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-white/10"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div ref={listRef} className="max-h-[55vh] sm:max-h-[420px] overflow-y-auto p-3 space-y-3 bg-gradient-to-b from-white to-slate-50/60">
            {shouldShowOpenPrompts ? (
              <div className="mr-10 rounded-2xl bg-white border border-slate-200 p-2">
                <div className="text-xs font-semibold text-slate-700 mb-2">Try one of these</div>
                <div className="flex flex-wrap gap-2">
                  {openPrompts.map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendQuickReply(t)}
                      className="text-xs rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1"
                      disabled={loading}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((m, idx) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={idx}
                  className={
                    'rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ' +
                    (isUser ? 'bg-slate-900 text-white ml-10' : 'bg-slate-100 text-slate-900 mr-10')
                  }
                >
                  {m.content}
                </div>
              );
            })}

            {actions.length ? (
              <div className="mr-10 flex flex-wrap gap-2">
                {actions.map((a, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleOpenPlanUrl(a?.url)}
                    className="text-xs rounded-full bg-teal-600 hover:bg-teal-700 text-white px-3 py-1"
                    disabled={loading || !a?.url}
                  >
                    {a?.label || 'Open'}
                  </button>
                ))}
              </div>
            ) : null}

            {suggestedPlans.length ? (
              <div className="mr-10 rounded-2xl bg-slate-50 border border-slate-200 p-2">
                <div className="text-xs font-semibold text-slate-700 mb-2">Suggested plans</div>
                <div className="flex flex-col gap-2">
                  {suggestedPlans.map((p, idx) => {
                    const name = p?.name ? String(p.name) : `Plan ${idx + 1}`;
                    const priceNum = p?.price !== undefined && p?.price !== null ? Number(p.price) : null;
                    const priceText = priceNum !== null && Number.isFinite(priceNum) ? `$ ${priceNum.toLocaleString()}` : '';
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleOpenPlanUrl(p?.url)}
                        className="text-left rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {name}{priceText ? ` (${priceText})` : ''}
                        </div>
                        {p?.url ? <div className="text-[11px] text-slate-500">Open plan</div> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {quickReplies.length ? (
              <div className="mr-10 rounded-2xl bg-white border border-slate-200 p-2">
                <div className="text-xs font-semibold text-slate-700 mb-2">Quick picks</div>
                <div className="flex flex-wrap gap-2">
                  {quickReplies.map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendQuickReply(t)}
                      className="text-xs rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1"
                      disabled={loading}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

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
              placeholder="Ask for pros/cons, or tell me your budget + bedrooms…"
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
        </div>
      )}
    </div>
  );
}
