import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Headset,
  History,
  MessageCircle,
  MessageSquare,
  Plus,
  Search,
  Send,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

import "./QueriesSupport.css";

/* =========================================================
   QUERIES & SUPPORT — FRONTEND-ONLY ADMIN WORKSPACE
   Shared customer conversation key:
   oneservice_support_conversations
========================================================= */

type MessageSender = "customer" | "admin";

type SupportMessage = {
  id?: string;
  sender?: MessageSender | string;
  role?: string;
  from?: string;
  author?: string;
  isAdmin?: boolean;
  text?: string;
  message?: string;
  content?: string;
  createdAt?: string;
  timestamp?: string;
};

type ConversationStatus =
  | "Open"
  | "In Progress"
  | "Resolved"
  | "Closed";

type SupportConversation = {
  id: string;
  customerName: string;
  customerMobile: string;
  status?: string;
  adminStatus?: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
  scheduledCall?: {
    date: string;
    time: string;
    note?: string;
    scheduledAt: string;
  };
};

type SavedReply = {
  id: string;
  title: string;
  message: string;
  category: string;
  createdAt: string;
};

type SupportHistoryItem = {
  id: string;
  conversationId: string;
  customerName: string;
  customerMobile: string;
  issue: string;
  action: string;
  status: ConversationStatus;
  createdAt: string;
  callDate?: string;
  callTime?: string;
};

const CONVERSATIONS_KEY = "oneservice_support_conversations";
const REPLIES_KEY = "oneservice_support_saved_replies";
const HISTORY_KEY = "oneservice_support_history";
const CHANGE_EVENT = "oneservice-support-conversations-change";
const TYPING_KEY_PREFIX = "oneservice_support_typing_";

function normalizeSender(message: SupportMessage): MessageSender {
  if (message.isAdmin === true) return "admin";
  const raw = String(message.sender ?? message.role ?? message.from ?? message.author ?? "")
    .trim()
    .toLowerCase();
  if (["admin", "support", "agent", "staff", "operator", "assistant"].includes(raw)) {
    return "admin";
  }
  return "customer";
}

function normalizeMessages(messages: SupportMessage[] = []): SupportMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const text = String(message.text ?? message.message ?? message.content ?? "").trim();
    const createdAt = String(message.createdAt ?? message.timestamp ?? "");
    const id = String(message.id ?? "");
    const identity = id || `${normalizeSender(message)}|${createdAt}|${text}`;
    if (!text || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function getMessageText(message: SupportMessage): string {
  return String(message.text ?? message.message ?? message.content ?? "");
}

function getMessageDate(message: SupportMessage): string {
  return String(message.createdAt ?? message.timestamp ?? "");
}

const DEFAULT_REPLIES: SavedReply[] = [
  {
    id: "default-booking-confirmation",
    title: "Booking assistance",
    category: "Booking",
    message:
      "Thank you for contacting NeedOneService. We are checking your booking details and will help you with the next steps shortly.",
    createdAt: "",
  },
  {
    id: "default-service-details",
    title: "Service details",
    category: "Service",
    message:
      "We would be happy to help. Please share a few more details about the service you requested so that we can guide you correctly.",
    createdAt: "",
  },
  {
    id: "default-payment",
    title: "Payment assistance",
    category: "Payment",
    message:
      "We understand your concern regarding the payment. Please allow us to review the transaction details and assist you.",
    createdAt: "",
  },
  {
    id: "default-delay",
    title: "Delay or rescheduling",
    category: "Scheduling",
    message:
      "We are sorry for the inconvenience. We are checking the schedule and will update you with the available options.",
    createdAt: "",
  },
  {
    id: "default-cancellation",
    title: "Cancellation or refund",
    category: "Cancellation",
    message:
      "We have received your cancellation or refund request. Our support team will review the details and get back to you.",
    createdAt: "",
  },
  {
    id: "default-more-info",
    title: "Request more information",
    category: "General",
    message:
      "To help us resolve this quickly, could you please share a little more information about the issue you are facing?",
    createdAt: "",
  },
];

const statusOptions: ConversationStatus[] = [
  "Open",
  "In Progress",
  "Resolved",
  "Closed",
];

function readArray<T,>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T,>(key: string, value: T[]): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function getConversationStatus(
  conversation: SupportConversation,
): ConversationStatus {
  const value = conversation.adminStatus ?? conversation.status;
  if (value === "In Progress" || value === "in-progress") return "In Progress";
  if (value === "Resolved" || value === "resolved") return "Resolved";
  if (value === "Closed" || value === "closed") return "Closed";
  return "Open";
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateTime(value?: string): string {
  if (!value) return "—";
  return `${formatDate(value)} · ${formatTime(value)}`;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getLatestCustomerIssue(conversation: SupportConversation): string {
  const customerMessage = [...normalizeMessages(conversation.messages ?? [])]
    .reverse()
    .find((message) => normalizeSender(message) === "customer");
  return customerMessage ? getMessageText(customerMessage) : "Customer support request";
}

export default function QueriesSupportPage() {
  const [view, setView] = useState<"panel" | "messages" | "history">("panel");
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [replySearch, setReplySearch] = useState("");
  const [replyCategory, setReplyCategory] = useState("All");
  const [messageDraft, setMessageDraft] = useState("");
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyTitle, setReplyTitle] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyCategoryInput, setReplyCategoryInput] = useState("General");
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callDate, setCallDate] = useState("");
  const [callTime, setCallTime] = useState("");
  const [callNote, setCallNote] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyChatOpen, setHistoryChatOpen] = useState(false);
  const [customerTyping, setCustomerTyping] = useState(false);

  const refreshData = useCallback(() => {
    setConversations(readArray<SupportConversation>(CONVERSATIONS_KEY));
    setSavedReplies(readArray<SavedReply>(REPLIES_KEY));
  }, []);

  useEffect(() => {
    refreshData();
    const onStorage = (event: StorageEvent) => {
      if (
        !event.key ||
        event.key === CONVERSATIONS_KEY ||
        event.key === REPLIES_KEY ||
        event.key === HISTORY_KEY
      ) {
        refreshData();
      }
    };
    const onSupportChange = () => refreshData();

    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, onSupportChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, onSupportChange);
    };
  }, [refreshData]);

  const allReplies = useMemo(
    () => [...DEFAULT_REPLIES, ...savedReplies],
    [savedReplies],
  );

  useEffect(() => {
    if (!selectedConversationId) {
      setCustomerTyping(false);
      return;
    }

    const key = `${TYPING_KEY_PREFIX}${selectedConversationId}`;
    const readTyping = () => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "{}") as {
          customer?: boolean;
          customerAt?: number;
        };
        const active = value.customer === true &&
          typeof value.customerAt === "number" &&
          Date.now() - value.customerAt < 4000;
        setCustomerTyping(active);
      } catch {
        setCustomerTyping(false);
      }
    };

    readTyping();
    const interval = window.setInterval(readTyping, 700);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) readTyping();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, [selectedConversationId]);

  const selectedConversation = useMemo(
    () =>
      conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const matchesStatus =
        statusFilter === "All" ||
        getConversationStatus(conversation) === statusFilter;
      const searchable = [
        conversation.customerName,
        conversation.customerMobile,
        conversation.id,
        getLatestCustomerIssue(conversation),
      ]
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [conversations, search, statusFilter]);

  const filteredReplies = useMemo(() => {
    const query = replySearch.trim().toLowerCase();
    return allReplies.filter((reply) => {
      const matchesCategory =
        replyCategory === "All" || reply.category === replyCategory;
      const searchable = `${reply.title} ${reply.message} ${reply.category}`.toLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
  }, [allReplies, replyCategory, replySearch]);

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return [...conversations]
      .sort((a, b) => {
        const aDate = a.updatedAt || a.createdAt;
        const bDate = b.updatedAt || b.createdAt;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .filter((conversation) =>
        `${conversation.customerName} ${conversation.customerMobile} ${getLatestCustomerIssue(conversation)}`
          .toLowerCase()
          .includes(query),
      );
  }, [conversations, historySearch]);

  const stats = useMemo(() => {
    const statuses = conversations.map(getConversationStatus);
    return {
      total: conversations.length,
      open: statuses.filter((item) => item === "Open").length,
      progress: statuses.filter((item) => item === "In Progress").length,
      resolved: statuses.filter(
        (item) => item === "Resolved" || item === "Closed",
      ).length,
    };
  }, [conversations]);

  const appendHistory = useCallback(
    (
      conversation: SupportConversation,
      action: string,
      statusValue = getConversationStatus(conversation),
      call?: { date: string; time: string },
    ) => {
      const current = readArray<SupportHistoryItem>(HISTORY_KEY);
      const entry: SupportHistoryItem = {
        id: createId("history"),
        conversationId: conversation.id,
        customerName: conversation.customerName || "Customer",
        customerMobile: conversation.customerMobile || "",
        issue: getLatestCustomerIssue(conversation),
        action,
        status: statusValue,
        createdAt: new Date().toISOString(),
        ...(call ? { callDate: call.date, callTime: call.time } : {}),
      };
      writeArray(HISTORY_KEY, [entry, ...current]);
    },
    [],
  );

  const updateConversation = useCallback(
    (updated: SupportConversation, action?: string) => {
      const current = readArray<SupportConversation>(CONVERSATIONS_KEY);
      const next = current.map((item) =>
        item.id === updated.id ? updated : item,
      );
      writeArray(CONVERSATIONS_KEY, next);
      setConversations(next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
      if (action) appendHistory(updated, action);
    },
    [appendHistory],
  );

  const handleAdminTyping = (value: string) => {
    setMessageDraft(value);
    if (!selectedConversationId) return;
    const key = `${TYPING_KEY_PREFIX}${selectedConversationId}`;
    try {
      const current = JSON.parse(localStorage.getItem(key) || "{}");
      localStorage.setItem(
        key,
        JSON.stringify({ ...current, admin: Boolean(value.trim()), adminAt: Date.now() }),
      );
    } catch {
      localStorage.setItem(
        key,
        JSON.stringify({ admin: Boolean(value.trim()), adminAt: Date.now() }),
      );
    }
  };

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedConversation || !messageDraft.trim()) return;

    const message: SupportMessage = {
      id: createId("admin-message"),
      sender: "admin",
      text: messageDraft.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated: SupportConversation = {
      ...selectedConversation,
      messages: [...normalizeMessages(selectedConversation.messages ?? []), message],
      updatedAt: message.createdAt ?? new Date().toISOString(),
    };

    updateConversation(updated, "Admin sent a message");
    setMessageDraft("");
    if (selectedConversationId) {
      localStorage.removeItem(`${TYPING_KEY_PREFIX}${selectedConversationId}`);
    }
  };

  const handleStatusChange = (
    conversation: SupportConversation,
    nextStatus: ConversationStatus,
  ) => {
    const updated: SupportConversation = {
      ...conversation,
      adminStatus: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    updateConversation(updated, `Status changed to ${nextStatus}`);
  };

  const handleSaveCustomReply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!replyTitle.trim() || !replyMessage.trim()) return;

    const nextReply: SavedReply = {
      id: createId("custom-reply"),
      title: replyTitle.trim(),
      message: replyMessage.trim(),
      category: replyCategoryInput.trim() || "General",
      createdAt: new Date().toISOString(),
    };
    const next = [nextReply, ...readArray<SavedReply>(REPLIES_KEY)];
    writeArray(REPLIES_KEY, next);
    setSavedReplies(next);
    setReplyTitle("");
    setReplyMessage("");
    setReplyCategoryInput("General");
    setReplyModalOpen(false);
  };

  const handleDeleteCustomReply = (replyId: string) => {
    const next = readArray<SavedReply>(REPLIES_KEY).filter(
      (reply) => reply.id !== replyId,
    );
    writeArray(REPLIES_KEY, next);
    setSavedReplies(next);
  };

  const handleScheduleCall = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedConversation || !callDate || !callTime) return;

    const scheduledAt = new Date(`${callDate}T${callTime}`).toISOString();
    const updated: SupportConversation = {
      ...selectedConversation,
      scheduledCall: {
        date: callDate,
        time: callTime,
        note: callNote.trim(),
        scheduledAt,
      },
      updatedAt: new Date().toISOString(),
    };

    updateConversation(updated);
    appendHistory(
      updated,
      "Call scheduled",
      getConversationStatus(updated),
      { date: callDate, time: callTime },
    );
    setCallModalOpen(false);
    setCallDate("");
    setCallTime("");
    setCallNote("");
  };

  const openConversation = (conversation: SupportConversation) => {
    setSelectedConversationId(conversation.id);
    setView("messages");
    setMessageDraft("");
  };

  const selectReply = (reply: SavedReply) => {
    setMessageDraft(reply.message);
  };

  const categories = useMemo(
    () => ["All", ...new Set(allReplies.map((reply) => reply.category))],
    [allReplies],
  );

  return (
    <div className="admin-module-page queries-support-page">
      <div className="admin-module-header queries-support-header">
        <div>
          <span className="admin-module-eyebrow">
            CUSTOMER RELATIONSHIP MANAGEMENT
          </span>
          <h1>Queries &amp; Support</h1>
          <p>
            Manage customer conversations, support requests, scheduled calls
            and resolution history.
          </p>
        </div>
        <div className="queries-support-view-switcher" aria-label="Support views">
          <button
            type="button"
            className={view === "panel" ? "is-active" : ""}
            onClick={() => setView("panel")}
          >
            <Settings2 size={16} /> Panel
          </button>
          <button
            type="button"
            className={view === "messages" ? "is-active" : ""}
            onClick={() => setView("messages")}
          >
            <MessageCircle size={16} /> Messages Pane
          </button>
          <button
            type="button"
            className={view === "history" ? "is-active" : ""}
            onClick={() => setView("history")}
          >
            <History size={16} /> History
          </button>
        </div>
      </div>

      {view === "panel" && (
        <>
          <div className="admin-module-stats">
            <div className="admin-module-stat">
              <MessageSquare />
              <span>Total Queries</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="admin-module-stat">
              <AlertCircle />
              <span>Open Tickets</span>
              <strong>{stats.open}</strong>
            </div>
            <div className="admin-module-stat">
              <Clock3 />
              <span>In Progress</span>
              <strong>{stats.progress}</strong>
            </div>
            <div className="admin-module-stat">
              <CheckCircle2 />
              <span>Resolved Tickets</span>
              <strong>{stats.resolved}</strong>
            </div>
          </div>

          <section className="admin-module-card queries-panel-card">
            <div className="admin-module-card-header">
              <div>
                <h2>Queries &amp; Support Panel</h2>
                <p>
                  Review customer messages, scheduled calls, issues and current
                  ticket status.
                </p>
              </div>
            </div>

            <div className="admin-module-toolbar">
              <div className="admin-module-search">
                <Search size={17} />
                <input
                  type="text"
                  placeholder="Search customer, mobile or issue..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by status"
              >
                {["All", ...statusOptions].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {filteredConversations.length > 0 ? (
              <div className="queries-table-wrap">
                <table className="queries-support-table">
                  <thead>
                    <tr>
                      <th>Messages</th>
                      <th>Slot Scheduled</th>
                      <th>Issue</th>
                      <th>Status with actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConversations.map((conversation) => {
                      const currentStatus = getConversationStatus(conversation);
                      return (
                        <tr key={conversation.id}>
                          <td>
                            <button
                              type="button"
                              className="queries-customer-link"
                              onClick={() => openConversation(conversation)}
                            >
                              <span className="queries-customer-avatar">
                                {(conversation.customerName || "C")
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                              <span>
                                <strong>
                                  {conversation.customerName || "Customer"}
                                </strong>
                                <small>{conversation.customerMobile}</small>
                                <small>
                                  {conversation.messages?.length ?? 0} messages
                                  · Open chat
                                </small>
                              </span>
                            </button>
                          </td>
                          <td>
                            {conversation.scheduledCall ? (
                              <span className="queries-slot-value">
                                <strong>
                                  {formatDate(conversation.scheduledCall.date)}
                                </strong>
                                <small>{conversation.scheduledCall.time}</small>
                              </span>
                            ) : (
                              <span className="queries-muted">Not scheduled</span>
                            )}
                          </td>
                          <td className="queries-issue-cell">
                            {getLatestCustomerIssue(conversation)}
                          </td>
                          <td>
                            <div className="queries-status-actions">
                              <select
                                value={currentStatus}
                                onChange={(event) =>
                                  handleStatusChange(
                                    conversation,
                                    event.target.value as ConversationStatus,
                                  )
                                }
                                aria-label={`Status for ${conversation.customerName}`}
                              >
                                {statusOptions.map((item) => (
                                  <option key={item} value={item}>
                                    {item}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="queries-small-action"
                                onClick={() => openConversation(conversation)}
                              >
                                Reply
                              </button>
                              <button
                                type="button"
                                className="queries-small-action is-outline"
                                onClick={() => openConversation(conversation)}
                              >
                                Open
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-module-empty queries-empty-state">
                <Headset size={38} />
                <h3>No support tickets available</h3>
                <p>
                  Customer messages submitted through Profile → Help &amp;
                  Support will appear here when the customer and admin use the
                  same browser storage.
                </p>
              </div>
            )}
          </section>
        </>
      )}

      {view === "messages" && (
        <section className="admin-module-card queries-messages-workspace">
          <div className="admin-module-card-header queries-workspace-heading">
            <div>
              <h2>Messages Workspace</h2>
              <p>
                Choose a saved reply, customize it and send it in the customer
                conversation.
              </p>
            </div>
            <button
              type="button"
              className="queries-back-button"
              onClick={() => setView("panel")}
            >
              <ArrowLeft size={16} /> Panel
            </button>
          </div>

          <div className="queries-two-column-layout">
            <aside className="queries-reply-library">
              <div className="queries-library-title">
                <div>
                  <h3>Message Library</h3>
                  <p>Default replies and your saved replies</p>
                </div>
                <button
                  type="button"
                  className="queries-add-reply-button"
                  onClick={() => setReplyModalOpen(true)}
                  aria-label="Add custom reply"
                >
                  <Plus size={17} />
                </button>
              </div>

              <div className="queries-library-filter">
                <div className="admin-module-search">
                  <Search size={15} />
                  <input
                    value={replySearch}
                    onChange={(event) => setReplySearch(event.target.value)}
                    placeholder="Search replies..."
                  />
                </div>
                <select
                  value={replyCategory}
                  onChange={(event) => setReplyCategory(event.target.value)}
                  aria-label="Filter reply category"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="queries-reply-section-label">DEFAULT MESSAGES</div>
              <div className="queries-reply-list">
                {filteredReplies
                  .filter((reply) =>
                    DEFAULT_REPLIES.some((item) => item.id === reply.id),
                  )
                  .map((reply) => (
                    <button
                      type="button"
                      className="queries-reply-card"
                      key={reply.id}
                      onClick={() => selectReply(reply)}
                    >
                      <span className="queries-reply-card-top">
                        <strong>{reply.title}</strong>
                        <small>{reply.category}</small>
                      </span>
                      <span>{reply.message}</span>
                      <small className="queries-use-reply">Use this reply</small>
                    </button>
                  ))}
              </div>

              <div className="queries-reply-section-label queries-custom-label">
                CUSTOM REPLIES
              </div>
              <div className="queries-reply-list">
                {filteredReplies
                  .filter(
                    (reply) =>
                      !DEFAULT_REPLIES.some((item) => item.id === reply.id),
                  )
                  .map((reply) => (
                    <div className="queries-custom-reply-row" key={reply.id}>
                      <button
                        type="button"
                        className="queries-reply-card"
                        onClick={() => selectReply(reply)}
                      >
                        <span className="queries-reply-card-top">
                          <strong>{reply.title}</strong>
                          <small>{reply.category}</small>
                        </span>
                        <span>{reply.message}</span>
                        <small className="queries-use-reply">Use this reply</small>
                      </button>
                      <button
                        type="button"
                        className="queries-delete-reply"
                        onClick={() => handleDeleteCustomReply(reply.id)}
                        aria-label={`Delete ${reply.title}`}
                        title="Delete saved reply"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                {savedReplies.length === 0 && (
                  <p className="queries-library-empty">
                    Your custom replies will appear here.
                  </p>
                )}
              </div>
            </aside>

            <section className="queries-chat-panel">
              <div className="queries-chat-header">
                <div className="queries-chat-heading-icon">
                  <MessageCircle size={19} />
                </div>
                <div>
                  <h3>
                    {selectedConversation
                      ? selectedConversation.customerName || "Customer"
                      : "Customer Chat"}
                  </h3>
                  <p>
                    {selectedConversation
                      ? `${selectedConversation.customerMobile} · ${selectedConversation.id}`
                      : "Select a customer conversation from Panel"}
                  </p>
                </div>
                {selectedConversation && (
                  <span
                    className={`queries-status-pill status-${getConversationStatus(
                      selectedConversation,
                    )
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    {getConversationStatus(selectedConversation)}
                  </span>
                )}
              </div>

              {selectedConversation ? (
                <>
                  <div className="queries-chat-messages" aria-live="polite">
                    {normalizeMessages(selectedConversation.messages ?? []).length ? (
                      normalizeMessages(selectedConversation.messages ?? []).map((message, index) => {
                        const sender = normalizeSender(message);
                        const messageDate = getMessageDate(message);
                        return (
                          <div
                            key={message.id || `${sender}-${messageDate}-${index}`}
                            className={`queries-chat-message ${sender === "admin" ? "is-admin" : "is-customer"}`}
                          >
                            <span className="queries-chat-sender">
                              {sender === "admin" ? "You · Support" : "Customer"}
                            </span>
                            <div className="queries-chat-bubble">{getMessageText(message)}</div>
                            <time>{formatDateTime(messageDate)}</time>
                          </div>
                        );
                      })
                    ) : (
                      <div className="queries-chat-empty">
                        <MessageSquare size={30} />
                        <strong>No messages in this conversation</strong>
                        <span>Send a message to start the conversation.</span>
                      </div>
                    )}
                    {customerTyping && (
                      <div className="queries-chat-message is-customer queries-typing-message">
                        <span className="queries-chat-sender">Customer is typing</span>
                        <div className="queries-typing-bubble" aria-label="Customer is typing">
                          <i /><i /><i />
                        </div>
                      </div>
                    )}
                  </div>

                  <form
                    className="queries-chat-compose"
                    onSubmit={handleSendMessage}
                  >
                    <textarea
                      value={messageDraft}
                      onChange={(event) => handleAdminTyping(event.target.value)}
                      placeholder="Write a reply to the customer..."
                      rows={3}
                    />
                    <div className="queries-compose-footer">
                      <span>
                        Select a library message to load it here as a draft.
                      </span>
                      <button type="submit" disabled={!messageDraft.trim()}>
                        <Send size={15} /> Send Reply
                      </button>
                    </div>
                  </form>

                  <div className="queries-chat-actions">
                    <button
                      type="button"
                      className="queries-call-button"
                      onClick={() => setCallModalOpen(true)}
                    >
                      <CalendarClock size={16} /> Convert to Call / Schedule
                    </button>
                    <label>
                      Update status
                      <select
                        value={getConversationStatus(selectedConversation)}
                        onChange={(event) =>
                          handleStatusChange(
                            selectedConversation,
                            event.target.value as ConversationStatus,
                          )
                        }
                      >
                        {statusOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              ) : (
                <div className="queries-chat-empty queries-chat-no-selection">
                  <MessageCircle size={36} />
                  <strong>No customer selected</strong>
                  <span>
                    Return to Panel and open a customer conversation. The
                    selected conversation will appear here.
                  </span>
                  <button type="button" onClick={() => setView("panel")}>
                    Go to Panel
                  </button>
                </div>
              )}
            </section>
          </div>
        </section>
      )}

      {view === "history" && (
        <section className="admin-module-card queries-history-card">
          <div className="admin-module-card-header queries-workspace-heading">
            <div>
              <h2>Support History</h2>
              <p>
                Date-wise record of customer queries, messages, calls and status
                updates.
              </p>
            </div>
            <button
              type="button"
              className="queries-back-button"
              onClick={() => setView("panel")}
            >
              <ArrowLeft size={16} /> Panel
            </button>
          </div>

          <div className="admin-module-toolbar">
            <div className="admin-module-search">
              <Search size={17} />
              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Search person, query or activity..."
              />
            </div>
          </div>

          {filteredHistory.length ? (
            <div className="queries-history-list">
              {filteredHistory.map((conversation) => {
                const lastMessage = normalizeMessages(conversation.messages ?? []).slice(-1)[0];
                const currentStatus = getConversationStatus(conversation);
                return (
                  <article className="queries-history-item" key={conversation.id}>
                    <div className="queries-history-date">
                      <strong>{formatDate(conversation.updatedAt || conversation.createdAt)}</strong>
                      <span>{formatTime(conversation.updatedAt || conversation.createdAt)}</span>
                    </div>
                    <div className="queries-history-person">
                      <strong>{conversation.customerName || "Customer"}</strong>
                      <span>{conversation.customerMobile || "Mobile not available"}</span>
                    </div>
                    <div className="queries-history-detail">
                      <strong>{getLatestCustomerIssue(conversation)}</strong>
                      <p>
                        {lastMessage
                          ? `${normalizeSender(lastMessage) === "admin" ? "Admin" : "Customer"}: ${getMessageText(lastMessage)}`
                          : "No messages yet"}
                      </p>
                      {conversation.scheduledCall && (
                        <span className="queries-history-call">
                          Call: {formatDate(conversation.scheduledCall.date)} at {conversation.scheduledCall.time}
                        </span>
                      )}
                    </div>
                    <div className="queries-history-status">
                      <span className={`queries-status-pill status-${currentStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                        {currentStatus}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedConversationId(conversation.id);
                          setHistoryChatOpen(true);
                        }}
                      >
                        Open chat
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="admin-module-empty queries-empty-state">
              <History size={38} />
              <h3>No support history yet</h3>
              <p>
                Customer conversations and their latest activity will appear here.
              </p>
            </div>
          )}
        </section>
      )}

      {historyChatOpen && selectedConversation && (
        <div
          className="queries-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHistoryChatOpen(false);
          }}
        >
          <section className="queries-modal queries-history-chat-modal">
            <div className="queries-modal-header">
              <div>
                <span>FULL CONVERSATION</span>
                <h2>{selectedConversation.customerName || "Customer"}</h2>
                <p>{selectedConversation.customerMobile} · {selectedConversation.id}</p>
              </div>
              <button type="button" onClick={() => setHistoryChatOpen(false)} aria-label="Close chat history">
                <X size={19} />
              </button>
            </div>
            <div className="queries-history-chat-transcript">
              {normalizeMessages(selectedConversation.messages ?? []).map((message, index) => {
                const sender = normalizeSender(message);
                const messageDate = getMessageDate(message);
                return (
                  <div
                    key={message.id || `${sender}-${messageDate}-${index}`}
                    className={`queries-chat-message ${sender === "admin" ? "is-admin" : "is-customer"}`}
                  >
                    <span className="queries-chat-sender">
                      {sender === "admin" ? "Admin · Support" : "Customer"}
                    </span>
                    <div className="queries-chat-bubble">{getMessageText(message)}</div>
                    <time>{formatDateTime(messageDate)}</time>
                  </div>
                );
              })}
            </div>
            <div className="queries-history-modal-footer">
              <span className={`queries-status-pill status-${getConversationStatus(selectedConversation).toLowerCase().replace(/\s+/g, "-")}`}>
                {getConversationStatus(selectedConversation)}
              </span>
              <button
                type="button"
                className="queries-modal-save"
                onClick={() => {
                  setHistoryChatOpen(false);
                  setView("messages");
                }}
              >
                Reply to customer
              </button>
            </div>
          </section>
        </div>
      )}

      {replyModalOpen && (
        <div
          className="queries-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReplyModalOpen(false);
          }}
        >
          <form className="queries-modal" onSubmit={handleSaveCustomReply}>
            <div className="queries-modal-header">
              <div>
                <span>MESSAGE LIBRARY</span>
                <h2>Add Custom Reply</h2>
              </div>
              <button
                type="button"
                onClick={() => setReplyModalOpen(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>
            <label>
              Message title
              <input
                value={replyTitle}
                onChange={(event) => setReplyTitle(event.target.value)}
                placeholder="e.g. Technician arrival update"
                required
              />
            </label>
            <label>
              Category
              <input
                value={replyCategoryInput}
                onChange={(event) => setReplyCategoryInput(event.target.value)}
                placeholder="e.g. Booking"
              />
            </label>
            <label>
              Reply message
              <textarea
                value={replyMessage}
                onChange={(event) => setReplyMessage(event.target.value)}
                placeholder="Write the reusable reply..."
                rows={5}
                required
              />
            </label>
            <div className="queries-modal-actions">
              <button
                type="button"
                className="queries-modal-cancel"
                onClick={() => setReplyModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="queries-modal-save">
                <Check size={16} /> Save Message
              </button>
            </div>
          </form>
        </div>
      )}

      {callModalOpen && selectedConversation && (
        <div
          className="queries-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCallModalOpen(false);
          }}
        >
          <form
            className="queries-modal queries-call-modal"
            onSubmit={handleScheduleCall}
          >
            <div className="queries-modal-header">
              <div>
                <span>CUSTOMER FOLLOW-UP</span>
                <h2>Schedule a Call</h2>
                <p>
                  {selectedConversation.customerName} ·{" "}
                  {selectedConversation.customerMobile}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCallModalOpen(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>
            <label>
              Call date
              <input
                type="date"
                value={callDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setCallDate(event.target.value)}
                required
              />
            </label>
            <label>
              Call time
              <input
                type="time"
                value={callTime}
                onChange={(event) => setCallTime(event.target.value)}
                required
              />
            </label>
            <label>
              Notes (optional)
              <textarea
                value={callNote}
                onChange={(event) => setCallNote(event.target.value)}
                rows={3}
                placeholder="Add a short note about the call..."
              />
            </label>
            <div className="queries-modal-actions">
              <button
                type="button"
                className="queries-modal-cancel"
                onClick={() => setCallModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="queries-modal-save">
                <CalendarClock size={16} /> Confirm Call
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
