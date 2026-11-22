
import { useCallback, useEffect, useState } from "react";
import {
  GraduationCap,
  Search,
  UserCheck,
  Clock,
  ShieldCheck,
  Users,
  Eye,
  CheckCircle,
  XCircle,
  Ban,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  Loader2,
  Mail,
  Phone,
  CalendarDays,
} from "lucide-react";

import "./Students.css";

const API_URL = "http://localhost:5000/api";

type StudentStatus =
  | "Pending Review"
  | "Approved"
  | "Rejected"
  | "Suspended";

interface Student {
  id: number;
  full_name: string;
  mobile: string;
  email: string;
  status: StudentStatus;
  application_data?: Record<string, unknown>;
  legal_acceptance?: Record<string, unknown>;
  profile_photo_name?: string | null;
  education_proof_name?: string | null;
  submitted_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface StudentStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  suspended: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const emptyStats: StudentStats = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  suspended: 0,
};

const statuses = [
  "All",
  "Pending Review",
  "Approved",
  "Rejected",
  "Suspended",
];

const formatDate = (value?: string) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
};

const getStatusClass = (status: string) => {
  switch (status) {
    case "Approved":
      return "approved";

    case "Rejected":
      return "rejected";

    case "Suspended":
      return "suspended";

    default:
      return "pending";
  }
};

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<StudentStats>(emptyStats);

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // ================================================
  // FETCH STUDENT STATISTICS
  // ================================================

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);

      const response = await fetch(
        `${API_URL}/admin/students/stats`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to fetch student statistics."
        );
      }

      setStats({
        total: Number(data.stats.total) || 0,
        pending: Number(data.stats.pending) || 0,
        approved: Number(data.stats.approved) || 0,
        rejected: Number(data.stats.rejected) || 0,
        suspended: Number(data.stats.suspended) || 0,
      });
    } catch (err) {
      console.error("Student statistics error:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ================================================
  // FETCH STUDENT RECORDS
  // ================================================

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        search: search.trim(),
        status: status === "All" ? "" : status,
        page: String(page),
        limit: "20",
      });

      const response = await fetch(
        `${API_URL}/admin/students?${params.toString()}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to fetch student records."
        );
      }

      setStudents(data.students || []);
      setPagination(
        data.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        }
      );
    } catch (err) {
      console.error("Student records error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading students."
      );

      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // ================================================
  // STATUS UPDATE
  // ================================================

  const updateStudentStatus = async (
    student: Student,
    newStatus: StudentStatus
  ) => {
    const confirmed = window.confirm(
      `Are you sure you want to change ${student.full_name}'s status to ${newStatus}?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(student.id);
      setActionMessage("");
      setError("");

      const response = await fetch(
        `${API_URL}/admin/students/${student.id}/status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to update student status."
        );
      }

      setActionMessage(
        `${student.full_name}'s status was updated to ${newStatus}.`
      );

      if (selectedStudent?.id === student.id) {
        setSelectedStudent(data.student);
      }

      await Promise.all([
        fetchStudents(),
        fetchStats(),
      ]);
    } catch (err) {
      console.error("Student status update error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update student status."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // ================================================
  // VIEW FULL STUDENT PROFILE
  // ================================================

  const viewStudent = async (student: Student) => {
    try {
      setError("");

      const response = await fetch(
        `${API_URL}/admin/students/${student.id}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load student profile."
        );
      }

      setSelectedStudent(data.student);
    } catch (err) {
      console.error("Student profile error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to open student profile."
      );
    }
  };

  // ================================================
  // SEARCH AND FILTER
  // ================================================

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  // ================================================
  // RENDER
  // ================================================

  return (
    <div className="admin-module-page">

      {/* HEADER */}

      <div className="admin-module-header">
        <div>
          <span className="admin-module-eyebrow">
            STUDENT MANAGEMENT
          </span>

          <h1>Students</h1>

          <p>
            Manage student registrations, profiles,
            verification and account approvals.
          </p>
        </div>

        <button
          type="button"
          className="admin-students-refresh"
          onClick={() => {
            fetchStudents();
            fetchStats();
          }}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="admin-students-alert error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* SUCCESS MESSAGE */}

      {actionMessage && (
        <div className="admin-students-alert success">
          <CheckCircle size={18} />
          <span>{actionMessage}</span>
          <button
            type="button"
            onClick={() => setActionMessage("")}
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* STATISTICS */}

      <div className="admin-module-stats">

        <div className="admin-module-stat">
          <GraduationCap />
          <span>Total Students</span>
          <strong>
            {statsLoading ? "—" : stats.total}
          </strong>
        </div>

        <div className="admin-module-stat">
          <Clock />
          <span>Pending Reviews</span>
          <strong>
            {statsLoading ? "—" : stats.pending}
          </strong>
        </div>

        <div className="admin-module-stat">
          <UserCheck />
          <span>Approved Students</span>
          <strong>
            {statsLoading ? "—" : stats.approved}
          </strong>
        </div>

        <div className="admin-module-stat">
          <ShieldCheck />
          <span>Rejected / Suspended</span>
          <strong>
            {statsLoading
              ? "—"
              : stats.rejected + stats.suspended}
          </strong>
        </div>

      </div>

      {/* STUDENT RECORDS */}

      <section className="admin-module-card">

        <div className="admin-module-card-header">
          <div>
            <h2>Student Registrations</h2>
            <p>
              Review and manage registered student accounts.
            </p>
          </div>

          <div className="admin-students-total">
            <Users size={16} />
            {pagination.total} Records
          </div>
        </div>

        {/* TOOLBAR */}

        <div className="admin-module-toolbar">

          <div className="admin-module-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search by name, mobile or email..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <select
            value={status}
            onChange={(e) => handleStatusFilter(e.target.value)}
          >
            {statuses.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item === "All" ? "All Statuses" : item}
              </option>
            ))}
          </select>

        </div>

        {/* STUDENT TABLE */}

        <div className="admin-students-table-wrapper">

          <table className="admin-students-table">

            <thead>
              <tr>
                <th>Student</th>
                <th>Contact</th>
                <th>Registration Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td colSpan={5}>
                    <div className="admin-students-loading">
                      <Loader2 className="admin-students-spinner" />
                      <span>Loading student records...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="admin-module-empty">
                      <GraduationCap size={38} />

                      <h3>No student records found</h3>

                      <p>
                        {search || status !== "All"
                          ? "Try changing your search or status filter."
                          : "Student registrations will appear here once students submit their applications."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id}>

                    <td>
                      <div className="admin-student-name">
                        <div className="admin-student-avatar">
                          {student.full_name
                            ?.charAt(0)
                            .toUpperCase() || "S"}
                        </div>

                        <div>
                          <strong>{student.full_name}</strong>
                          <span>Student ID: #{student.id}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="admin-student-contact">
                        <span>
                          <Mail size={13} />
                          {student.email}
                        </span>

                        <span>
                          <Phone size={13} />
                          {student.mobile}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="admin-student-date">
                        <CalendarDays size={14} />
                        {formatDate(
                          student.submitted_at || student.created_at
                        )}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`admin-student-status ${getStatusClass(
                          student.status
                        )}`}
                      >
                        {student.status}
                      </span>
                    </td>

                    <td>
                      <div className="admin-student-actions">

                        <button
                          type="button"
                          className="admin-student-action view"
                          title="View full profile"
                          onClick={() => viewStudent(student)}
                        >
                          <Eye size={16} />
                        </button>

                        {student.status !== "Approved" && (
                          <button
                            type="button"
                            className="admin-student-action approve"
                            title="Approve student"
                            disabled={actionLoading === student.id}
                            onClick={() =>
                              updateStudentStatus(student, "Approved")
                            }
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}

                        {student.status !== "Rejected" && (
                          <button
                            type="button"
                            className="admin-student-action reject"
                            title="Reject application"
                            disabled={actionLoading === student.id}
                            onClick={() =>
                              updateStudentStatus(student, "Rejected")
                            }
                          >
                            <XCircle size={16} />
                          </button>
                        )}

                        {student.status !== "Suspended" && (
                          <button
                            type="button"
                            className="admin-student-action suspend"
                            title="Suspend student"
                            disabled={actionLoading === student.id}
                            onClick={() =>
                              updateStudentStatus(student, "Suspended")
                            }
                          >
                            <Ban size={16} />
                          </button>
                        )}

                        {(student.status === "Rejected" ||
                          student.status === "Suspended") && (
                          <button
                            type="button"
                            className="admin-student-action restore"
                            title="Restore to pending review"
                            disabled={actionLoading === student.id}
                            onClick={() =>
                              updateStudentStatus(
                                student,
                                "Pending Review"
                              )
                            }
                          >
                            <RefreshCw size={16} />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))
              )}

            </tbody>

          </table>

        </div>

        {/* PAGINATION */}

        {!loading && pagination.totalPages > 0 && (
          <div className="admin-students-pagination">

            <span>
              Showing{" "}
              {pagination.total === 0
                ? 0
                : (page - 1) * pagination.limit + 1}
              {" "}–{" "}
              {Math.min(
                page * pagination.limit,
                pagination.total
              )}
              {" "}of {pagination.total} students
            </span>

            <div>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft size={17} />
                Previous
              </button>

              <span>
                Page {page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight size={17} />
              </button>
            </div>

          </div>
        )}

      </section>

      {/* STUDENT PROFILE MODAL */}

      {selectedStudent && (
        <div
          className="admin-student-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedStudent(null);
            }
          }}
        >
          <div
            className="admin-student-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-student-modal-title"
          >

            <div className="admin-student-modal-header">
              <div>
                <span className="admin-module-eyebrow">
                  STUDENT PROFILE
                </span>

                <h2 id="admin-student-modal-title">
                  {selectedStudent.full_name}
                </h2>

                <span>
                  Student ID: #{selectedStudent.id}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                aria-label="Close profile"
              >
                <X size={21} />
              </button>
            </div>

            <div className="admin-student-modal-body">

              {/* BASIC INFORMATION */}

              <section className="admin-student-detail-section">
                <h3>Personal Information</h3>

                <div className="admin-student-detail-grid">

                  <div>
                    <span>Full Name</span>
                    <strong>{selectedStudent.full_name}</strong>
                  </div>

                  <div>
                    <span>Email Address</span>
                    <strong>{selectedStudent.email}</strong>
                  </div>

                  <div>
                    <span>Mobile Number</span>
                    <strong>{selectedStudent.mobile}</strong>
                  </div>

                  <div>
                    <span>Application Status</span>
                    <strong>
                      <span
                        className={`admin-student-status ${getStatusClass(
                          selectedStudent.status
                        )}`}
                      >
                        {selectedStudent.status}
                      </span>
                    </strong>
                  </div>

                  <div>
                    <span>Submitted Date</span>
                    <strong>
                      {formatDate(selectedStudent.submitted_at)}
                    </strong>
                  </div>

                  <div>
                    <span>Last Updated</span>
                    <strong>
                      {formatDate(selectedStudent.updated_at)}
                    </strong>
                  </div>

                </div>
              </section>

              {/* REGISTRATION DATA */}

              <section className="admin-student-detail-section">
                <h3>Registration Details</h3>

                {selectedStudent.application_data &&
                Object.keys(selectedStudent.application_data).length > 0 ? (
                  <div className="admin-student-detail-grid">
                    {Object.entries(
                      selectedStudent.application_data
                    ).map(([key, value]) => (
                      <div key={key}>
                        <span>
                          {key
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (letter) =>
                              letter.toUpperCase()
                            )}
                        </span>

                        <strong>
                          {formatValue(value)}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="admin-student-no-data">
                    No additional registration details available.
                  </p>
                )}
              </section>

              {/* DOCUMENTS */}

              <section className="admin-student-detail-section">
                <h3>Uploaded Documents</h3>

                <div className="admin-student-detail-grid">

                  <div>
                    <span>Profile Photo</span>
                    <strong>
                      {selectedStudent.profile_photo_name || "Not uploaded"}
                    </strong>
                  </div>

                  <div>
                    <span>Education Proof</span>
                    <strong>
                      {selectedStudent.education_proof_name || "Not uploaded"}
                    </strong>
                  </div>

                </div>

                <p className="admin-student-no-data">
                  File names are shown here. Actual document viewing and
                  download will be connected when secure file storage is implemented.
                </p>
              </section>

              {/* LEGAL ACCEPTANCE */}

              <section className="admin-student-detail-section">
                <h3>Legal Acceptance</h3>

                {selectedStudent.legal_acceptance &&
                Object.keys(selectedStudent.legal_acceptance).length > 0 ? (
                  <div className="admin-student-detail-grid">
                    {Object.entries(
                      selectedStudent.legal_acceptance
                    ).map(([key, value]) => (
                      <div key={key}>
                        <span>
                          {key
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (letter) =>
                              letter.toUpperCase()
                            )}
                        </span>

                        <strong>
                          {formatValue(value)}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="admin-student-no-data">
                    No legal acceptance details available.
                  </p>
                )}
              </section>

            </div>

            {/* PROFILE ACTIONS */}

            <div className="admin-student-modal-footer">

              {selectedStudent.status !== "Approved" && (
                <button
                  type="button"
                  className="admin-student-modal-button approve"
                  disabled={actionLoading === selectedStudent.id}
                  onClick={() =>
                    updateStudentStatus(
                      selectedStudent,
                      "Approved"
                    )
                  }
                >
                  <CheckCircle size={16} />
                  Approve Student
                </button>
              )}

              {selectedStudent.status !== "Rejected" && (
                <button
                  type="button"
                  className="admin-student-modal-button reject"
                  disabled={actionLoading === selectedStudent.id}
                  onClick={() =>
                    updateStudentStatus(
                      selectedStudent,
                      "Rejected"
                    )
                  }
                >
                  <XCircle size={16} />
                  Reject
                </button>
              )}

              <button
                type="button"
                className="admin-student-modal-button close"
                onClick={() => setSelectedStudent(null)}
              >
                Close
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
