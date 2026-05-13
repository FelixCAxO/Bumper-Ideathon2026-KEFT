import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useConversations } from "@/hooks/use-conversations";

export const Route = createFileRoute("/_app/conversations/$conversationId")({
  head: () => ({
    meta: [
      { title: "Conversation - Bumper" },
      { name: "description", content: "Chat with your child about a recent alert." },
    ],
  }),
  component: ConversationDetailPage,
});

function ConversationDetailPage() {
  const { conversationId } = Route.useParams();
  const { getById, sendMessage } = useConversations();
  const navigate = useNavigate();
  const conv = getById(conversationId);

  const [text, setText] = useState("");
  const [promptDismissed, setPromptDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conv?.messages.length]);

  if (!conv) {
    return (
      <div className="min-h-screen bg-[#f6f7ff] p-3 text-[#09113b]">
        <div className="mx-auto max-w-[720px] rounded-[28px] bg-white p-10 text-center shadow-[0_30px_90px_rgba(31,43,108,0.12)] ring-1 ring-[#e7e9f8]">
          <p className="text-lg font-black text-[#07103d]">Conversation not found</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/conversations" })}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#5e48ed] px-4 py-2 text-sm font-bold text-white"
          >
            Back to conversations
          </button>
        </div>
      </div>
    );
  }

  const showPrompt = !promptDismissed && conv.messages.length === 0;

  const handleSend = (override?: string) => {
    const value = (override ?? text).trim();
    if (!value) return;
    sendMessage(conv.id, value, "parent");
    setText("");
    setPromptDismissed(true);
    // simulate a child reply for the demo
    setTimeout(() => {
      sendMessage(conv.id, "ok thanks for telling me, i'll be careful 🙂", "child");
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7ff] p-3 text-[#09113b]">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[720px] flex-col rounded-[28px] bg-white shadow-[0_30px_90px_rgba(31,43,108,0.12)] ring-1 ring-[#e7e9f8]">
        <div className="flex items-center justify-between gap-4 border-b border-[#edf0fa] px-6 py-4">
          <Link
            to="/conversations"
            className="inline-flex items-center gap-2 rounded-xl bg-[#f0edff] px-3 py-2 text-sm font-bold text-[#5e48ed] transition hover:bg-[#e7e1ff]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-sm font-bold text-[#07103d]">
              {conv.child} - {conv.platform}
            </p>
            <p className="truncate text-xs font-medium text-[#7b83a8]">{conv.alertTitle}</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-6 py-6">
          {conv.messages.length === 0 ? (
            <p className="py-10 text-center text-sm font-medium text-[#7b83a8]">
              No messages yet. Send the first one to start the conversation.
            </p>
          ) : (
            conv.messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "parent" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm font-medium ${
                    m.role === "parent"
                      ? "bg-[#5e48ed] text-white"
                      : "bg-[#f0edff] text-[#07103d]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-[#edf0fa] px-6 py-4">
          <div className="flex items-center gap-2 rounded-2xl border border-[#e7e9f6] bg-white px-3 py-2 shadow-[0_8px_24px_rgba(31,43,108,0.06)]">
            <input
              type="text"
              value={showPrompt ? "" : text}
              placeholder={showPrompt ? conv.suggestedPrompt : "Type a message..."}
              onChange={(e) => {
                setPromptDismissed(true);
                setText(e.target.value);
              }}
              onFocus={() => setPromptDismissed(true)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent px-2 py-2 text-sm text-[#07103d] placeholder:text-[#7b83a8] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleSend(showPrompt ? conv.suggestedPrompt : undefined)}
              className="grid h-10 w-10 place-items-center rounded-full bg-[#5e48ed] text-white transition hover:bg-[#4a36d1] disabled:opacity-40"
              disabled={!showPrompt && !text.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
