import { useState } from "react";
import { Check, Folder, Search, Target, X, Zap } from "lucide-react";
import type { Session, Task, Project } from "../types";
import { Modal, Btn } from "./ui";

interface AssignTaskModalProps {
  session: Session | null;
  tasks: Task[];
  projects: Project[];
  onAssign: (sessionId: string, taskId: string | null, subtaskId?: string | null) => void;
  onClose: () => void;
}

export function AssignTaskModal({
  session,
  tasks,
  projects,
  onAssign,
  onClose,
}: AssignTaskModalProps) {
  const [query, setQuery] = useState("");

  if (!session) return null;

  const currentTask = tasks.find((t) => t.id === session.taskId);

  const filteredTasks = tasks.filter((t) => {
    if (t.done && t.id !== session.taskId) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const titleMatch = t.title.toLowerCase().includes(q);
    const tagMatch = t.tags.some((tag) => tag.toLowerCase().includes(q));
    const proj = projects.find((p) => p.id === t.projectId);
    const projMatch = proj?.name.toLowerCase().includes(q);
    return titleMatch || tagMatch || projMatch;
  });

  return (
    <Modal
      open={!!session}
      onClose={onClose}
      title="Assign Task to Focus Session"
      width={480}
    >
      <div className="flex flex-col gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--mut)" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks by title, project, or tag..."
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border font-medium focus:outline-none focus:ring-1"
            style={{
              background: "var(--panel2)",
              borderColor: "var(--line)",
              color: "var(--text)",
            }}
            autoFocus
          />
        </div>

        {/* Task List */}
        <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
          {/* Option: Leave as Quick Focus (No Task) */}
          <button
            onClick={() => {
              onAssign(session.id, null);
              onClose();
            }}
            className="flex items-center justify-between p-2.5 rounded-xl border text-left text-xs font-semibold hover:brightness-105 transition-all cursor-pointer"
            style={{
              background: !session.taskId ? "var(--accent-soft)" : "var(--bg)",
              borderColor: !session.taskId ? "var(--accent)" : "var(--line)",
            }}
          >
            <div className="flex items-center gap-2">
              <Zap size={14} style={{ color: "var(--accent)" }} />
              <div>
                <div className="font-bold">Quick Focus (No Task)</div>
                <div className="text-[10.5px]" style={{ color: "var(--mut)" }}>
                  General focus session without an assigned task
                </div>
              </div>
            </div>
            {!session.taskId && <Check size={14} style={{ color: "var(--accent)" }} />}
          </button>

          {filteredTasks.length === 0 ? (
            <div className="py-6 text-center text-xs" style={{ color: "var(--mut)" }}>
              No matching tasks found.
            </div>
          ) : (
            filteredTasks.map((t) => {
              const isSelected = t.id === session.taskId;
              const proj = projects.find((p) => p.id === t.projectId);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    onAssign(session.id, t.id);
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl border text-left text-xs font-medium hover:brightness-105 transition-all cursor-pointer"
                  style={{
                    background: isSelected ? "var(--accent-soft)" : "var(--bg)",
                    borderColor: isSelected ? "var(--accent)" : "var(--line)",
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0">{t.emoji ?? "🎯"}</span>
                    <div className="min-w-0">
                      <div className="font-bold truncate">{t.title}</div>
                      <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--mut)" }}>
                        {proj && (
                          <span className="flex items-center gap-1 font-semibold" style={{ color: proj.color }}>
                            #{proj.name}
                          </span>
                        )}
                        {t.estimateMin > 0 && <span>· Est: {t.estimateMin}m</span>}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="shrink-0" style={{ color: "var(--accent)" }} />}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
          <Btn variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
