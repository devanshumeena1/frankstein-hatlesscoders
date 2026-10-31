"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { api, ApiError, describeError } from "@/lib/api";
import type { Project, Task, TaskPage, TaskStatus } from "@/lib/types";

const PAGE_SIZE = 10;

function formatDate(iso: string) {
  return format(new Date(iso), "dd MMM yyyy, HH:mm");
}

function TaskBoard({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TaskPage | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    api<Project>(`/api/projects/${id}`).then(setProject);
  }, [id]);

  const fetchTasks = useCallback(
    async (q: string, s: TaskStatus | "", p: number) => {
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (s) params.set("status", s);
      try {
        const result = await api<TaskPage>(`/api/projects/${id}/tasks?${params}`);
        setData(result);
        setFetchError(null);
      } catch (err) {
        if (err instanceof ApiError && err.status !== 0) {
          setFetchError(describeError(err));
          setData({ items: [], total: 0, page: p, page_size: PAGE_SIZE });
        } else {
          setData({ items: [], total: 0, page: p, page_size: PAGE_SIZE });
        }
      }
    },
    [id]
  );

  // Reset page to 1 when search query or status filter changes
  useEffect(() => {
    setPage(1);
  }, [query, status]);

  // debounce search — uses latest query, status, page
  useEffect(() => {
    const t = setTimeout(() => fetchTasks(query, status, page), 300);
    return () => clearTimeout(t);
  }, [query, status, page, fetchTasks]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      {project && (
        <p>
          <Link href={`/workspaces/${project.workspace_id}`}>← Back to workspace</Link>
        </p>
      )}
      <h1>{project?.name ?? "Project"}</h1>
      <NewTaskForm projectId={id} onCreated={() => fetchTasks(query, status, page)} />
      <div className="row">
        <input
          placeholder="Search tasks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search tasks"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus | "")}
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          <option value="todo">To do</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </select>
      </div>

      {fetchError && <p className="error">{fetchError}</p>}
      {data === null && !fetchError && <p className="muted">Loading…</p>}
      {data?.items.length === 0 && !fetchError && <p className="muted">No tasks match.</p>}

      {data && data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t: Task) => (
              <tr key={t.id}>
                <td className="small">{t.id.slice(-6)}</td>
                <td>{t.title}</td>
                <td>
                  <span className={`badge ${t.status}`}>{t.status}</span>
                </td>
                <td className="small">{formatDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="row pager">
        <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages} {data && <span className="muted">({data.total} tasks)</span>}
        </span>
        <button
          className="secondary"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}

function NewTaskForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/tasks`, { method: "POST", body: { title } });
      setTitle("");
      onCreated();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="row">
      <input
        placeholder="New task title (costs 1 credit)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button disabled={busy}>{busy ? "Creating…" : "Create task"}</button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <TaskBoard id={id} />
    </RequireAuth>
  );
}
