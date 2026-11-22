
import { useState } from "react";
import {
  Headset,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

import "./QueriesSupport.css";

export default function QueriesSupportPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const statuses = [
    "All",
    "Open",
    "In Progress",
    "Resolved",
    "Closed",
  ];

  return (
    <div className="admin-module-page">
      <div className="admin-module-header">
        <div>
          <span className="admin-module-eyebrow">
            CUSTOMER RELATIONSHIP MANAGEMENT
          </span>

          <h1>Queries & Support</h1>

          <p>
            Manage customer queries, partner requests,
            complaints and support tickets.
          </p>
        </div>
      </div>

      {/* STATISTICS */}
      <div className="admin-module-stats">
        <div className="admin-module-stat">
          <MessageSquare />
          <span>Total Queries</span>
          <strong>—</strong>
        </div>

        <div className="admin-module-stat">
          <AlertCircle />
          <span>Open Tickets</span>
          <strong>—</strong>
        </div>

        <div className="admin-module-stat">
          <Clock />
          <span>In Progress</span>
          <strong>—</strong>
        </div>

        <div className="admin-module-stat">
          <CheckCircle />
          <span>Resolved Tickets</span>
          <strong>—</strong>
        </div>
      </div>

      {/* SUPPORT TICKETS */}
      <section className="admin-module-card">
        <div className="admin-module-card-header">
          <div>
            <h2>Support Tickets</h2>
            <p>
              Track, review and manage incoming support requests.
            </p>
          </div>
        </div>

        <div className="admin-module-toolbar">
          <div className="admin-module-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-module-empty">
          <Headset size={38} />

          <h3>No support tickets available</h3>

          <p>
            Customer complaints, service queries,
            professional requests, vendor enquiries and
            ticket resolution history will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}
