import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  Award,
  CheckSquare,
  MessageSquare,
  Link2,
  Clock,
  Printer,
  UserPlus,
  Send
} from 'lucide-react';
import { erpApi, type ErpAgencyHrSnapshot } from '../../../lib/erpApi';
import { ErpTableExportBar } from './ErpUniversalExportModal';

interface Props {
  onParentRefresh: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

const INTERN_TRACKS = [
  {
    code: 'SALES',
    label: 'Sales & Concierge Intern',
    focus: 'Lead qualification notes, Perfume Bar inquiry prep, corporate gift catalog deck assembly.',
    restrictedNote: 'Pricing overrides & wholesale margin ledgers hidden.'
  },
  {
    code: 'DIGITAL_MARKETING',
    label: 'Digital Marketing Intern',
    focus: 'Creator seeding unboxing audit, UTM hygiene, editorial scent-note captions, non-discount copy checks.',
    restrictedNote: 'Agency retainer contracts & bank payouts hidden.'
  },
  {
    code: 'OPERATIONS',
    label: 'Operations & Fulfillment Intern',
    focus: 'Order dispatch SLA checks, luxury coffret packing QA, courier AWB exception tracking.',
    restrictedNote: 'Payment gateway settlement & refund bank ledgers hidden.'
  },
  {
    code: 'PROCUREMENT',
    label: 'Procurement & Packaging Intern',
    focus: 'Flacon/atomizer MOQ tracking, vendor lead-time logs, GRN carton count verification.',
    restrictedNote: 'Supplier bank details & AP payout approvals hidden.'
  },
  {
    code: 'PRODUCTION',
    label: 'Production & Lab Support Intern',
    focus: '2ML discovery vial fill-weight logs, maceration tank temperature logs, filtration checklist.',
    restrictedNote: 'Proprietary fragrance concentrate formulas & oil ratios strictly redacted.'
  },
  {
    code: 'HR',
    label: 'HR & Cohort Operations Intern',
    focus: 'Intern attendance coordination, campus onboarding schedules, cross-team task follow-ups.',
    restrictedNote: 'Permanent employee CTC salaries & payroll registers hidden.'
  },
  {
    code: 'FINANCE',
    label: 'Finance Documentation Intern',
    focus: 'HSN/SAC invoice voucher filing, expense receipt indexing, petty cash bill verification prep.',
    restrictedNote: 'Statutory sign-offs, journal reversals & Balance Sheet restricted unless authorized.'
  }
] as const;

const KANBAN_COLUMNS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE'] as const;

export const ErpHrInternTaskWorkspace: React.FC<Props> = ({ onParentRefresh, notify }) => {
  const [snap, setSnap] = useState<ErpAgencyHrSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'kanban' | 'interns' | 'evaluations' | 'employees'>('kanban');
  const [selectedDeptTrack, setSelectedDeptTrack] = useState<string>('DIGITAL_MARKETING');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [certificateIntern, setCertificateIntern] = useState<any | null>(null);

  // Task Creation Form
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    sourceModule: 'marketing',
    priority: 'HIGH',
    assignedToEmail: 'growth@fragmore.shop',
    dueDate: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
    reminderAt: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    dependsOnTaskIds: [] as string[],
    checklistLine1: 'Verify alignment with FRAGMORÉ luxury SOP',
    checklistLine2: 'Attach deliverable proof & request supervisor review'
  });
  const [commentText, setCommentText] = useState('');
  const [commentAttachmentUrl, setCommentAttachmentUrl] = useState('');

  // Intern Profile Form
  const [internForm, setInternForm] = useState({
    fullName: '',
    email: '',
    phone: '+91 98200 14000',
    university: '',
    departmentTrack: 'DIGITAL_MARKETING',
    mentorEmail: 'growth@fragmore.shop',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    stipendMonthlyInr: 18000,
    projectTitle: ''
  });

  // Attendance, Submission & Evaluation Forms
  const [attForm, setAttForm] = useState({
    internId: '',
    attendanceDate: new Date().toISOString().slice(0, 10),
    workMode: 'ATELIER_ONSITE',
    checkInTime: '09:30',
    checkOutTime: '18:00',
    hoursLogged: 8.5,
    status: 'PRESENT',
    notes: ''
  });

  const [subForm, setSubForm] = useState({
    internId: '',
    title: '',
    summary: '',
    deliverableUrl: ''
  });

  const [evalForm, setEvalForm] = useState({
    internId: '',
    executionScore: 4.8,
    storytellingCraftScore: 4.7,
    reliabilityScore: 4.9,
    strengths: 'High attention to luxury presentation and timely execution.',
    growthAreas: 'Expand cross-functional documentation depth.',
    recommendation: 'ENDORSE_FOR_CERTIFICATE',
    issueCertificateNow: true
  });

  // Employee Form
  const [empForm, setEmpForm] = useState({
    fullName: '',
    email: '',
    phone: '+91 98200 19000',
    designation: '',
    monthlySalaryInr: 72000,
    departmentId: 'dept-exec'
  });

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const data = await erpApi.getAgencyHrSnapshot();
      setSnap(data);
      if (data.interns.length) {
        const firstId = data.interns[0].id;
        setAttForm((p) => (p.internId ? p : { ...p, internId: firstId }));
        setSubForm((p) => (p.internId ? p : { ...p, internId: firstId }));
        setEvalForm((p) => (p.internId ? p : { ...p, internId: firstId }));
      }
      if (data.tasks.length && !selectedTaskId) {
        setSelectedTaskId(data.tasks[0].id);
      }
    } catch (e: any) {
      notify(e?.message || 'Failed to load HR, Internship & Kanban Workspace', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const runMutation = async (fn: () => Promise<void>, okMessage: string) => {
    setBusy(true);
    try {
      await fn();
      await loadSnapshot();
      await onParentRefresh();
      notify(okMessage, 'success');
    } catch (e: any) {
      notify(e?.message || 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !snap) {
    return (
      <div className="p-10 text-center text-xs font-mono text-[#686158]">
        Loading FRAGMORÉ HR, Internship &amp; Kanban Operations...
      </div>
    );
  }
  if (!snap) return null;

  const canApproveHr = snap.actor.isSuperAdmin || Boolean(snap.actor.permissions?.hr?.canApprove);
  const canSeeFinancials = snap.securityBoundary.canSeeSensitiveFinancials;

  const selectedTask = snap.tasks.find((t) => t.id === selectedTaskId) || snap.tasks[0] || null;
  const selectedTaskComments = selectedTask
    ? snap.taskComments.filter((c) => c.taskId === selectedTask.id)
    : [];

  const activeTrackMeta = INTERN_TRACKS.find((t) => t.code === selectedDeptTrack) || INTERN_TRACKS[0];
  const trackInterns = snap.interns.filter(
    (i) => (i.departmentTrack || i.track) === selectedDeptTrack
  );
  const trackSubmissions = snap.internSubmissions.filter(
    (s) => s.departmentTrack === selectedDeptTrack
  );
  const trackTasks = snap.tasks.filter(
    (t) =>
      t.sourceModule?.toUpperCase().includes(selectedDeptTrack.slice(0, 4)) ||
      trackInterns.some((i) => i.email?.toLowerCase() === t.assignedToEmail?.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Confidentiality & Sensitivity Shield Banner for Interns */}
      {snap.securityBoundary.isInternRestricted && (
        <div className="p-3.5 bg-[#FAF8F4] border border-[#9A783E] rounded-lg flex items-center gap-3 text-xs text-[#24211D]">
          <ShieldAlert className="w-4 h-4 text-[#9A783E] shrink-0" />
          <span>
            <strong>Intern Confidentiality Boundary Active:</strong> Sensitive company financials, payroll CTCs, statutory GST ledgers, and confidential perfume formulations are automatically redacted on the server for role <code className="font-mono">{snap.actor.roleCode}</code>.
          </span>
        </div>
      )}

      {/* Header & Universal Export */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
            Module 14 · People, 7-Department Internships &amp; Kanban Execution
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
            HR, Internship Cohort &amp; Collaborative Task Board
          </h2>
        </div>
        <ErpTableExportBar
          reportKey="tasks_productivity"
          title="FRAGMORÉ Cross-Department Kanban & Productivity Register"
          notify={notify}
        />
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 border border-[#DED7CC] bg-[#FFFFFF] divide-y sm:divide-y-0 sm:divide-x divide-[#DED7CC] rounded-lg">
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Permanent Team</span>
          <span className="text-xl font-mono font-bold tabular-nums">{snap.employees.length}</span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Active Intern Cohort</span>
          <span className="text-xl font-mono font-bold tabular-nums text-[#9A783E]">{snap.interns.length}</span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Attendance Logs</span>
          <span className="text-xl font-mono font-bold tabular-nums">{snap.internAttendance.length}</span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Open Kanban Tasks</span>
          <span className="text-xl font-mono font-bold tabular-nums">
            {snap.tasks.filter((t) => t.status !== 'DONE').length}
          </span>
        </div>
        <div className="p-4">
          <span className="text-[10px] font-mono uppercase text-[#686158] block">Completed Tasks</span>
          <span className="text-xl font-mono font-bold tabular-nums text-emerald-700">
            {snap.tasks.filter((t) => t.status === 'DONE').length}
          </span>
        </div>
      </div>

      {/* Section Switcher */}
      <div className="flex flex-wrap gap-2 border-b border-[#DED7CC] pb-3">
        {[
          { id: 'kanban', label: `Kanban Board & Dependencies (${snap.tasks.length})` },
          { id: 'interns', label: `7-Dept Intern Dashboards (${snap.interns.length})` },
          { id: 'evaluations', label: `Attendance, Submissions & Certificates (${snap.internSubmissions.length})` },
          { id: 'employees', label: `Employees & Dept Productivity (${snap.employees.length})` }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3.5 py-2 rounded text-xs font-mono uppercase cursor-pointer ${
              activeTab === t.id
                ? 'bg-[#24211D] text-[#FAF8F4]'
                : 'bg-[#FFFFFF] border border-[#DED7CC] text-[#24211D] hover:border-[#9A783E]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: COLLABORATIVE KANBAN BOARD, DEPENDENCIES, CHECKLISTS, COMMENTS & APPROVAL FLOW */}
      {activeTab === 'kanban' && (
        <div className="space-y-6">
          {/* 5-Column Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {KANBAN_COLUMNS.map((colStatus) => {
              const colTasks = snap.tasks.filter((t) => t.status === colStatus);
              return (
                <div
                  key={colStatus}
                  className="border border-[#DED7CC] bg-[#FAF8F4] rounded-lg p-3 flex flex-col space-y-2.5 min-h-[280px]"
                >
                  <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                    <span className="text-[11px] font-mono uppercase font-bold text-[#24211D]">
                      {colStatus.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] font-mono text-[#686158] tabular-nums">{colTasks.length}</span>
                  </div>

                  {colTasks.map((task) => {
                    const deps: string[] = Array.isArray(task.dependsOnTaskIds) ? task.dependsOnTaskIds : [];
                    const unresolvedDeps = deps.filter((depId) => {
                      const dt = snap.tasks.find((x) => x.id === depId);
                      return dt && dt.status !== 'DONE';
                    });
                    const checklists: any[] = Array.isArray(task.checklists) ? task.checklists : [];
                    const doneChk = checklists.filter((c) => c.done).length;
                    const isSelected = selectedTask?.id === task.id;

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`p-3 rounded border bg-[#FFFFFF] cursor-pointer space-y-2 transition-colors ${
                          isSelected ? 'border-[#9A783E] ring-1 ring-[#9A783E]/40' : 'border-[#DED7CC] hover:border-[#24211D]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-[#9A783E] font-bold">{task.taskNumber}</span>
                          <span className="text-[#686158]">{task.priority}</span>
                        </div>
                        <p className="text-xs font-semibold text-[#24211D] leading-snug">{task.title}</p>
                        <div className="text-[10px] font-mono text-[#686158] space-y-0.5">
                          <div className="truncate">{task.assignedToEmail}</div>
                          {task.dueDate && <div className="tabular-nums">Due: {task.dueDate}</div>}
                        </div>

                        {unresolvedDeps.length > 0 && (
                          <div className="text-[10px] font-mono text-amber-800 flex items-center gap-1">
                            <Link2 className="w-3 h-3 shrink-0" />
                            <span>Blocked by {unresolvedDeps.length} prerequisite(s)</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-[#DED7CC]/60 text-[10px] font-mono text-[#686158]">
                          <span>
                            Chk {doneChk}/{checklists.length}
                          </span>
                          <span>{task.approvalStage || 'DRAFT'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Task Detail Drawer (Checklists, Dependencies, Approval Stage, Comments & Activity Log) + Create Task Form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {selectedTask && (
              <div className="lg:col-span-7 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#DED7CC] pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#9A783E]">
                      {selectedTask.taskNumber} · Dept: {selectedTask.sourceModule} · Assignee: {selectedTask.assignedToEmail}
                    </span>
                    <h3 className="font-serif text-lg text-[#24211D] mt-0.5">{selectedTask.title}</h3>
                    {selectedTask.description && (
                      <p className="text-xs text-[#686158] mt-1">{selectedTask.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedTask.status}
                      onChange={(e) =>
                        runMutation(
                          () =>
                            erpApi.saveCollabTask({
                              id: selectedTask.id,
                              title: selectedTask.title,
                              status: e.target.value
                            }),
                          `Moved ${selectedTask.taskNumber} to ${e.target.value}`
                        )
                      }
                      className="px-2.5 py-1.5 bg-[#FAF8F4] border border-[#DED7CC] rounded text-xs font-mono"
                    >
                      {KANBAN_COLUMNS.map((st) => (
                        <option key={st} value={st}>
                          Column: {st}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedTask.approvalStage || 'DRAFT'}
                      onChange={(e) =>
                        runMutation(
                          () =>
                            erpApi.saveCollabTask({
                              id: selectedTask.id,
                              title: selectedTask.title,
                              approvalStage: e.target.value
                            }),
                          `Updated approval stage to ${e.target.value}`
                        )
                      }
                      className="px-2.5 py-1.5 bg-[#FAF8F4] border border-[#DED7CC] rounded text-xs font-mono"
                    >
                      {['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'COMPLETED'].map(
                        (ap) => (
                          <option key={ap} value={ap}>
                            Stage: {ap}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                {/* Interactive Checklist */}
                <div>
                  <h4 className="text-[11px] font-mono uppercase font-semibold text-[#24211D] mb-2 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-[#9A783E]" />
                    <span>Execution Checklist</span>
                  </h4>
                  <div className="space-y-1.5">
                    {(Array.isArray(selectedTask.checklists) ? selectedTask.checklists : []).map(
                      (chk: any, idx: number) => (
                        <label
                          key={chk.id || idx}
                          className="flex items-center gap-2 text-xs p-2 bg-[#FAF8F4] border border-[#DED7CC] rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(chk.done)}
                            onChange={() => {
                              const nextList = [...(selectedTask.checklists || [])];
                              nextList[idx] = { ...chk, done: !chk.done };
                              runMutation(
                                () =>
                                  erpApi.saveCollabTask({
                                    id: selectedTask.id,
                                    title: selectedTask.title,
                                    checklists: nextList
                                  }),
                                'Checklist updated.'
                              );
                            }}
                            className="accent-[#9A783E]"
                          />
                          <span className={chk.done ? 'line-through text-[#686158]' : 'text-[#24211D]'}>
                            {chk.text}
                          </span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                {/* Comments & Attachments Thread */}
                <div className="border-t border-[#DED7CC] pt-3 space-y-3">
                  <h4 className="text-[11px] font-mono uppercase font-semibold text-[#24211D] flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#9A783E]" />
                    <span>Task Comments &amp; File Proof ({selectedTaskComments.length})</span>
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedTaskComments.map((c) => (
                      <div key={c.id} className="p-2.5 bg-[#FAF8F4] border border-[#DED7CC] rounded text-xs">
                        <div className="flex justify-between text-[10px] font-mono text-[#686158]">
                          <span>
                            {c.authorEmail} ({c.authorRole})
                          </span>
                          <span className="tabular-nums">{String(c.createdAt || '').slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <p className="text-[#24211D] mt-1">{c.commentText}</p>
                        {c.attachmentUrl && (
                          <p className="text-[11px] font-mono text-[#9A783E] mt-0.5 truncate">
                            Attachment: {c.attachmentUrl}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!commentText.trim()) return;
                      runMutation(async () => {
                        await erpApi.addTaskComment(selectedTask.id, {
                          commentText,
                          attachmentUrl: commentAttachmentUrl || undefined
                        });
                        setCommentText('');
                        setCommentAttachmentUrl('');
                      }, 'Comment & proof logged on task.');
                    }}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                  >
                    <input
                      required
                      placeholder="Write comment or status update..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="sm:col-span-2 px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                    />
                    <input
                      placeholder="Optional Attachment URL"
                      value={commentAttachmentUrl}
                      onChange={(e) => setCommentAttachmentUrl(e.target.value)}
                      className="px-3 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
                    />
                    <button
                      disabled={busy}
                      type="submit"
                      className="sm:col-span-3 py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
                    >
                      Post Task Comment
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Create Collaborative Kanban Task Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runMutation(async () => {
                  await erpApi.saveCollabTask({
                    title: taskForm.title,
                    description: taskForm.description,
                    sourceModule: taskForm.sourceModule,
                    priority: taskForm.priority,
                    assignedToEmail: taskForm.assignedToEmail,
                    dueDate: taskForm.dueDate,
                    reminderAt: taskForm.reminderAt,
                    dependsOnTaskIds: taskForm.dependsOnTaskIds,
                    checklists: [
                      { id: 'chk-1', text: taskForm.checklistLine1, done: false },
                      { id: 'chk-2', text: taskForm.checklistLine2, done: false }
                    ].filter((c) => c.text.trim())
                  });
                  setTaskForm({ ...taskForm, title: '', description: '', dependsOnTaskIds: [] });
                }, 'Kanban task created with checklists & dependencies.');
              }}
              className="lg:col-span-5 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-5 space-y-3 h-fit"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Create Kanban Task &amp; Dependencies
              </h3>
              <input
                required
                placeholder="Task Title"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <textarea
                rows={2}
                placeholder="Scope, deliverable acceptance criteria & context..."
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={taskForm.sourceModule}
                  onChange={(e) => setTaskForm({ ...taskForm, sourceModule: e.target.value })}
                  className="px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="marketing">Marketing &amp; Agency</option>
                  <option value="sales">Sales &amp; CRM</option>
                  <option value="procurement">Procurement</option>
                  <option value="batches">Production &amp; Lab</option>
                  <option value="quality">Sampling &amp; QC</option>
                  <option value="hr">HR &amp; Cohort</option>
                  <option value="accounting">Finance &amp; GST</option>
                </select>
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                  className="px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="URGENT">URGENT</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
              <input
                required
                placeholder="Assignee Email"
                value={taskForm.assignedToEmail}
                onChange={(e) => setTaskForm({ ...taskForm, assignedToEmail: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4] tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">Reminder Date</label>
                  <input
                    type="date"
                    value={taskForm.reminderAt}
                    onChange={(e) => setTaskForm({ ...taskForm, reminderAt: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4] tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#686158] block mb-1">
                  Prerequisite Task Dependency (Blocks DONE until resolved)
                </label>
                <select
                  value={taskForm.dependsOnTaskIds[0] || ''}
                  onChange={(e) =>
                    setTaskForm({
                      ...taskForm,
                      dependsOnTaskIds: e.target.value ? [e.target.value] : []
                    })
                  }
                  className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
                >
                  <option value="">None (Independent Task)</option>
                  {snap.tasks
                    .filter((t) => t.status !== 'DONE')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.taskNumber} — {t.title} ({t.status})
                      </option>
                    ))}
                </select>
              </div>

              <button
                disabled={busy}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Assign Kanban Task
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: 7 DEPARTMENT-SPECIFIC INTERN DASHBOARDS & INTERN PROFILES */}
      {activeTab === 'interns' && (
        <div className="space-y-6">
          {/* 7-Department Intern Track Switcher */}
          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#9A783E]">
                Department-Specific Intern Workspaces (7 Specialized Tracks)
              </span>
              <ErpTableExportBar reportKey="internship_cohort" notify={notify} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {INTERN_TRACKS.map((trk) => {
                const count = snap.interns.filter((i) => (i.departmentTrack || i.track) === trk.code).length;
                const active = selectedDeptTrack === trk.code;
                return (
                  <button
                    key={trk.code}
                    onClick={() => setSelectedDeptTrack(trk.code)}
                    className={`p-2.5 rounded border text-left cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#24211D] text-[#FAF8F4] border-[#24211D]'
                        : 'bg-[#FAF8F4] text-[#24211D] border-[#DED7CC] hover:border-[#9A783E]'
                    }`}
                  >
                    <span className="text-[10px] font-mono uppercase block opacity-80">{trk.code.replace('_', ' ')}</span>
                    <span className="text-sm font-mono font-bold tabular-nums mt-0.5 block">{count} Intern(s)</span>
                  </button>
                );
              })}
            </div>

            {/* Active Department Intern Dashboard */}
            <div className="p-4 bg-[#FAF8F4] border border-[#DED7CC] rounded-lg grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-1.5">
                <h4 className="font-serif text-lg text-[#24211D]">{activeTrackMeta.label}</h4>
                <p className="text-xs text-[#24211D]">
                  <strong>Authorized Scope:</strong> {activeTrackMeta.focus}
                </p>
                <p className="text-[11px] font-mono text-[#686158]">
                  Confidentiality Guard: {activeTrackMeta.restrictedNote}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t lg:border-t-0 lg:border-l border-[#DED7CC] pt-3 lg:pt-0 lg:pl-4 text-center">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#686158] block">Interns</span>
                  <span className="text-lg font-mono font-bold tabular-nums">{trackInterns.length}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#686158] block">Tasks</span>
                  <span className="text-lg font-mono font-bold tabular-nums">{trackTasks.length}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#686158] block">Submissions</span>
                  <span className="text-lg font-mono font-bold tabular-nums text-[#9A783E]">
                    {trackSubmissions.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2.5 px-3">Intern # / Name</th>
                    <th className="py-2.5 px-3">Department / College</th>
                    <th className="py-2.5 px-3">Tenure &amp; Supervisor</th>
                    <th className="py-2.5 px-3 text-right">Stipend / Score</th>
                    <th className="py-2.5 px-3 text-right">Certificate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snap.interns.map((i) => (
                    <tr key={i.id}>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-[#9A783E] block">{i.internCode}</span>
                        <span className="font-semibold text-[#24211D]">{i.fullName}</span>
                        <span className="block text-[10px] text-[#686158]">{i.email}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[11px] font-semibold block">
                          {i.departmentTrack || i.track}
                        </span>
                        <span className="text-[#686158]">{i.university}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] tabular-nums">
                        <span className="block">
                          {i.startDate} to {i.endDate}
                        </span>
                        <span className="text-[10px] text-[#686158]">Mentor: {i.mentorEmail}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                        {i.stipendMonthlyInr !== null && i.stipendMonthlyInr !== undefined
                          ? `₹${Number(i.stipendMonthlyInr).toLocaleString('en-IN')}`
                          : 'Redacted'}{' '}
                        · {i.evaluationScore}/5
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {i.certificateIssued ? (
                          <button
                            type="button"
                            onClick={() => setCertificateIntern(i)}
                            className="px-2.5 py-1 bg-[#24211D] text-[#FAF8F4] rounded text-[10px] font-mono uppercase cursor-pointer"
                          >
                            View Cert
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-[#686158]">In Cohort</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runMutation(async () => {
                  await erpApi.saveInternProfile(internForm);
                  setInternForm({ ...internForm, fullName: '', email: '', university: '', projectTitle: '' });
                }, 'Intern profile & NDA access boundary registered.');
              }}
              className="lg:col-span-4 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3 h-fit"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-[#9A783E]" />
                <span>Onboard Intern Profile</span>
              </h3>
              <input
                required
                placeholder="Intern Full Name"
                value={internForm.fullName}
                onChange={(e) => setInternForm({ ...internForm, fullName: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <input
                required
                type="email"
                placeholder="Intern Email"
                value={internForm.email}
                onChange={(e) => setInternForm({ ...internForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <input
                required
                placeholder="College / University"
                value={internForm.university}
                onChange={(e) => setInternForm({ ...internForm, university: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <select
                value={internForm.departmentTrack}
                onChange={(e) => setInternForm({ ...internForm, departmentTrack: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                {INTERN_TRACKS.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={internForm.startDate}
                  onChange={(e) => setInternForm({ ...internForm, startDate: e.target.value })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4] tabular-nums"
                />
                <input
                  type="date"
                  value={internForm.endDate}
                  onChange={(e) => setInternForm({ ...internForm, endDate: e.target.value })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4] tabular-nums"
                />
              </div>
              <input
                type="number"
                placeholder="Monthly Stipend ₹"
                value={internForm.stipendMonthlyInr}
                onChange={(e) => setInternForm({ ...internForm, stipendMonthlyInr: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4] tabular-nums"
              />
              <input
                required
                placeholder="Assigned Capstone Project"
                value={internForm.projectTitle}
                onChange={(e) => setInternForm({ ...internForm, projectTitle: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Register Intern
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: ATTENDANCE, WORK SUBMISSIONS, EVALUATIONS & COMPLETION CERTIFICATES */}
      {activeTab === 'evaluations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Attendance Logger */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runMutation(async () => {
                  await erpApi.recordInternAttendance(attForm);
                  setAttForm({ ...attForm, notes: '' });
                }, 'Intern attendance recorded.');
              }}
              className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[#DED7CC] pb-2">
                <h3 className="text-xs font-mono uppercase font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#9A783E]" />
                  <span>Log Intern Attendance</span>
                </h3>
              </div>
              <select
                required
                value={attForm.internId}
                onChange={(e) => setAttForm({ ...attForm, internId: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                {snap.interns.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.internCode} — {i.fullName}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={attForm.attendanceDate}
                  onChange={(e) => setAttForm({ ...attForm, attendanceDate: e.target.value })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4] tabular-nums"
                />
                <select
                  value={attForm.workMode}
                  onChange={(e) => setAttForm({ ...attForm, workMode: e.target.value })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  <option value="ATELIER_ONSITE">Atelier Onsite</option>
                  <option value="LAB">Perfume Lab</option>
                  <option value="REMOTE">Remote</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={attForm.checkInTime}
                  onChange={(e) => setAttForm({ ...attForm, checkInTime: e.target.value })}
                  placeholder="09:30"
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
                />
                <input
                  value={attForm.checkOutTime}
                  onChange={(e) => setAttForm({ ...attForm, checkOutTime: e.target.value })}
                  placeholder="18:00"
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
                />
                <input
                  type="number"
                  step="0.5"
                  value={attForm.hoursLogged}
                  onChange={(e) => setAttForm({ ...attForm, hoursLogged: Number(e.target.value) })}
                  className="px-2 py-1.5 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4] tabular-nums"
                />
              </div>
              <input
                placeholder="Daily summary notes..."
                value={attForm.notes}
                onChange={(e) => setAttForm({ ...attForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Save Attendance
              </button>
            </form>

            {/* 2. Intern Work Submission */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runMutation(async () => {
                  await erpApi.submitInternWork(subForm);
                  setSubForm({ ...subForm, title: '', summary: '', deliverableUrl: '' });
                }, 'Work submission sent to mentor approval queue.');
              }}
              className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-[#9A783E]" />
                <span>Submit Work for Approval</span>
              </h3>
              <select
                required
                value={subForm.internId}
                onChange={(e) => setSubForm({ ...subForm, internId: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                {snap.interns.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.internCode} — {i.fullName}
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Submission Title"
                value={subForm.title}
                onChange={(e) => setSubForm({ ...subForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <textarea
                required
                rows={2}
                placeholder="Deliverable summary & findings..."
                value={subForm.summary}
                onChange={(e) => setSubForm({ ...subForm, summary: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <input
                placeholder="Deliverable File / Sheet URL"
                value={subForm.deliverableUrl}
                onChange={(e) => setSubForm({ ...subForm, deliverableUrl: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs font-mono bg-[#FAF8F4]"
              />
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Submit Deliverable
              </button>
            </form>

            {/* 3. Mentor Evaluation & Certificate Issuance */}
            {canApproveHr && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runMutation(async () => {
                    await erpApi.recordInternEvaluation(evalForm);
                  }, 'Evaluation saved & completion certificate updated.');
                }}
                className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3"
              >
                <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#9A783E]" />
                  <span>Evaluate &amp; Issue Certificate</span>
                </h3>
                <select
                  required
                  value={evalForm.internId}
                  onChange={(e) => setEvalForm({ ...evalForm, internId: e.target.value })}
                  className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                >
                  {snap.interns.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.internCode} — {i.fullName}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-mono text-[#686158] block">Exec /5</label>
                    <input
                      type="number"
                      step="0.1"
                      max="5"
                      min="1"
                      value={evalForm.executionScore}
                      onChange={(e) => setEvalForm({ ...evalForm, executionScore: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#686158] block">Craft /5</label>
                    <input
                      type="number"
                      step="0.1"
                      max="5"
                      min="1"
                      value={evalForm.storytellingCraftScore}
                      onChange={(e) => setEvalForm({ ...evalForm, storytellingCraftScore: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#686158] block">Reliab /5</label>
                    <input
                      type="number"
                      step="0.1"
                      max="5"
                      min="1"
                      value={evalForm.reliabilityScore}
                      onChange={(e) => setEvalForm({ ...evalForm, reliabilityScore: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
                    />
                  </div>
                </div>
                <input
                  required
                  placeholder="Key Strengths"
                  value={evalForm.strengths}
                  onChange={(e) => setEvalForm({ ...evalForm, strengths: e.target.value })}
                  className="w-full px-3 py-1.5 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                />
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evalForm.issueCertificateNow}
                    onChange={(e) => setEvalForm({ ...evalForm, issueCertificateNow: e.target.checked })}
                    className="accent-[#9A783E]"
                  />
                  <span>Issue Official FRAGMORÉ Completion Certificate</span>
                </label>
                <button
                  disabled={busy}
                  type="submit"
                  className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
                >
                  Record Evaluation
                </button>
              </form>
            )}
          </div>

          {/* Submissions Review Queue & Attendance Export */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
              <div className="px-4 py-3 bg-[#FAF8F4] border-b border-[#DED7CC]">
                <h4 className="text-xs font-mono uppercase font-semibold">Intern Work Submissions &amp; Mentor Approvals</h4>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2 px-3">Sub # / Title</th>
                    <th className="py-2 px-3">Stage</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snap.internSubmissions.map((sub) => (
                    <tr key={sub.id}>
                      <td className="py-2 px-3">
                        <span className="font-mono text-[#9A783E] font-bold block">{sub.submissionNumber}</span>
                        <span className="font-semibold">{sub.title}</span>
                        <span className="block text-[11px] text-[#686158]">{sub.summary}</span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px]">{sub.approvalStage}</td>
                      <td className="py-2 px-3 text-right space-x-1">
                        {canApproveHr && sub.approvalStage !== 'APPROVED' && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() =>
                                runMutation(
                                  () =>
                                    erpApi.reviewInternSubmission(sub.id, {
                                      decision: 'APPROVED',
                                      feedback: 'Mentor verified deliverable quality.'
                                    }),
                                  'Intern submission approved.'
                                )
                              }
                              className="px-2 py-1 bg-emerald-800 text-white rounded text-[10px] font-mono uppercase cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                runMutation(
                                  () =>
                                    erpApi.reviewInternSubmission(sub.id, {
                                      decision: 'CHANGES_REQUESTED',
                                      feedback: 'Please refine formatting and attach source sheet.'
                                    }),
                                  'Requested changes on submission.'
                                )
                              }
                              className="px-2 py-1 border border-amber-700 text-amber-800 rounded text-[10px] font-mono uppercase cursor-pointer"
                            >
                              Revise
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
              <div className="px-4 py-3 bg-[#FAF8F4] border-b border-[#DED7CC] flex items-center justify-between">
                <h4 className="text-xs font-mono uppercase font-semibold">Attendance Ledger</h4>
                <ErpTableExportBar reportKey="intern_attendance" notify={notify} />
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Intern</th>
                    <th className="py-2 px-3">Mode</th>
                    <th className="py-2 px-3 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snap.internAttendance.slice(0, 12).map((a) => {
                    const intr = snap.interns.find((x) => x.id === a.internId);
                    return (
                      <tr key={a.id}>
                        <td className="py-2 px-3 font-mono tabular-nums">{a.attendanceDate}</td>
                        <td className="py-2 px-3 font-medium">{intr?.fullName || a.internId}</td>
                        <td className="py-2 px-3 font-mono text-[11px]">{a.workMode}</td>
                        <td className="py-2 px-3 font-mono text-right tabular-nums">{a.hoursLogged}h</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EMPLOYEES & DEPARTMENT PRODUCTIVITY */}
      {activeTab === 'employees' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
              <div className="px-4 py-3 bg-[#FAF8F4] border-b border-[#DED7CC] flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase font-semibold">Permanent Employees Directory</h3>
                <ErpTableExportBar reportKey="employee_performance" notify={notify} />
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                  <tr>
                    <th className="py-2.5 px-3">Code / Name</th>
                    <th className="py-2.5 px-3">Designation</th>
                    <th className="py-2.5 px-3 text-right">Monthly CTC</th>
                    <th className="py-2.5 px-3 text-right">Leaves</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DED7CC]">
                  {snap.employees.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-[#9A783E] block">{e.employeeCode}</span>
                        <span className="font-semibold">{e.fullName}</span>
                        <span className="block text-[10px] text-[#686158]">{e.email}</span>
                      </td>
                      <td className="py-2.5 px-3">{e.designation}</td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                        {canSeeFinancials && e.monthlySalaryInr !== null
                          ? `₹${Number(e.monthlySalaryInr).toLocaleString('en-IN')}`
                          : 'Restricted'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums">{e.leaveBalanceDays}d</td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canApproveHr && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runMutation(async () => {
                    await erpApi.createEmployee(empForm);
                    setEmpForm({ ...empForm, fullName: '', email: '', designation: '' });
                  }, 'Permanent employee onboarded.');
                }}
                className="lg:col-span-4 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3 h-fit"
              >
                <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                  Onboard Permanent Employee
                </h3>
                <input
                  required
                  placeholder="Full Name"
                  value={empForm.fullName}
                  onChange={(e) => setEmpForm({ ...empForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                />
                <input
                  required
                  type="email"
                  placeholder="Work Email"
                  value={empForm.email}
                  onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                />
                <input
                  required
                  placeholder="Designation"
                  value={empForm.designation}
                  onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
                />
                <input
                  type="number"
                  placeholder="Monthly CTC ₹"
                  value={empForm.monthlySalaryInr}
                  onChange={(e) => setEmpForm({ ...empForm, monthlySalaryInr: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4] tabular-nums"
                />
                <button
                  disabled={busy}
                  type="submit"
                  className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
                >
                  Save Employee
                </button>
              </form>
            )}
          </div>

          {/* Department Productivity Table */}
          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
            <div className="px-4 py-3 bg-[#FAF8F4] border-b border-[#DED7CC] flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase font-semibold">Department Productivity &amp; Velocity</h3>
              <ErpTableExportBar reportKey="department_productivity" notify={notify} />
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <tr>
                  <th className="py-2 px-3">Department</th>
                  <th className="py-2 px-3 text-right">Total Tasks</th>
                  <th className="py-2 px-3 text-right">Completed</th>
                  <th className="py-2 px-3 text-right">Completion Rate</th>
                  <th className="py-2 px-3 text-right">Active Interns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {snap.reports.departmentProductivityReport.map((d: any) => (
                  <tr key={d.departmentCode}>
                    <td className="py-2 px-3 font-semibold">{d.departmentName}</td>
                    <td className="py-2 px-3 font-mono text-right tabular-nums">{d.totalTasks}</td>
                    <td className="py-2 px-3 font-mono text-right tabular-nums text-emerald-700">
                      {d.completedTasks}
                    </td>
                    <td className="py-2 px-3 font-mono text-right tabular-nums">{d.completionRatePct}%</td>
                    <td className="py-2 px-3 font-mono text-right tabular-nums">{d.activeInterns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Official Branded Internship Completion Certificate Modal */}
      {certificateIntern && (
        <div className="fixed inset-0 z-50 bg-[#24211D]/65 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-[#FAF8F4] border-2 border-[#9A783E] rounded-lg p-8 shadow-2xl space-y-6 text-center">
            <div className="border-b border-[#DED7CC] pb-4">
              <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-[#9A783E]">
                FRAGMORÉ HAUTE PARFUMERIE PRIVATE LIMITED
              </p>
              <h3 className="font-serif text-3xl text-[#24211D] uppercase tracking-widest mt-2">
                Certificate of Internship Completion
              </h3>
              <p className="text-xs font-mono text-[#686158] mt-1">
                Certificate Ref: {certificateIntern.certificateNumber || 'CERT-FRAGMORE'}
              </p>
            </div>
            <div className="space-y-3 text-sm text-[#24211D] leading-relaxed">
              <p>This is to certify that</p>
              <p className="font-serif text-2xl text-[#9A783E] font-semibold">{certificateIntern.fullName}</p>
              <p>
                from <strong>{certificateIntern.university}</strong> has successfully completed the{' '}
                <strong>{certificateIntern.departmentTrack || certificateIntern.track}</strong> Internship Cohort at{' '}
                <strong>FRAGMORÉ</strong> from <span className="font-mono">{certificateIntern.startDate}</span> to{' '}
                <span className="font-mono">{certificateIntern.endDate}</span> on capstone project{' '}
                <em>“{certificateIntern.projectTitle}”</em> with an evaluation rating of{' '}
                <strong className="font-mono">{certificateIntern.evaluationScore} / 5.0</strong>.
              </p>
            </div>
            <div className="flex items-center justify-between pt-6 border-t border-[#DED7CC] text-xs font-mono text-[#686158]">
              <span>Supervisor: {certificateIntern.mentorEmail}</span>
              <span>Authorized Signatory · FRAGMORÉ</span>
            </div>
            <div className="flex justify-center gap-3 pt-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#24211D] text-[#FAF8F4] rounded text-xs font-mono uppercase flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Certificate</span>
              </button>
              <button
                onClick={() => setCertificateIntern(null)}
                className="px-4 py-2 border border-[#DED7CC] bg-[#FFFFFF] rounded text-xs font-mono uppercase cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
