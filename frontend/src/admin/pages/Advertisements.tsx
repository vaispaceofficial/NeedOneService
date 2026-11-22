
import { useState } from "react";
import {
  Megaphone,
  Search,
  Clock,
  CheckCircle,
  PauseCircle,
  Plus,
  Image,
} from "lucide-react";

import "./Advertisements.css";

export default function AdvertisementsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const statuses = [
    "All",
    "Pending",
    "Approved",
    "Active",
    "Rejected",
    "Completed",
  ];

  return (
    <div className="admin-module-page">
      <div className="admin-module-header">
        <div>
          <span className="admin-module-eyebrow">
            ADVERTISEMENT MANAGEMENT
          </span>

          <h1>Advertisements</h1>

          <p>
            Manage advertising requests, campaigns,
            promotional banners and advertisement placements.
          </p>
        </div>

        <button
          type="button"
          className="admin-module-primary-button"
          disabled
          title="Available when advertisement creation is connected"
        >
          <Plus size={17} />
          Create Advertisement
        </button>
      </div>

      {/* STATISTICS */}
      <div className="admin-module-stats">
        <div className="admin-module-stat">
          <Megaphone />
          <span>Total Advertisements</span>
          <strong>—</strong>
        </div>

        <div className="admin-module-stat">
          <Clock />
          <span>Pending Requests</span>
          <strong>—</strong>
        </div>

        <div className="admin-module-stat">
          <CheckCircle />
          <span>Active Campaigns</span>
          <strong>—</strong>
        </div>

        <div className="admin-module-stat">
          <PauseCircle />
          <span>Completed Campaigns</span>
          <strong>—</strong>
        </div>
      </div>

      {/* ADVERTISEMENT LIST */}
      <section className="admin-module-card">
        <div className="admin-module-card-header">
          <div>
            <h2>Advertisement Requests</h2>
            <p>
              Review advertisement submissions and campaign details.
            </p>
          </div>
        </div>

        <div className="admin-module-toolbar">
          <div className="admin-module-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search advertisements..."
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
          <Image size={38} />

          <h3>No advertisement records available</h3>

          <p>
            Submitted advertising requests, campaign details,
            creative materials, payment information and
            approval statuses will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}
