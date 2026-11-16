import React, { useState } from 'react';
import { Paperclip } from 'lucide-react';
import { erpApi, type ErpWorkspaceSnapshot } from '../../../lib/erpApi';
import { ErpAgencyMarketingWorkspace } from './ErpAgencyMarketingWorkspace';
import { ErpHrInternTaskWorkspace } from './ErpHrInternTaskWorkspace';
import { ErpReportsCenterWorkspace } from './ErpReportsCenterWorkspace';
import { ErpTableExportBar } from './ErpUniversalExportModal';
import { ErpAiBusinessAssistantWorkspace } from './ErpAiBusinessAssistantWorkspace';

interface Props {
  snapshot: ErpWorkspaceSnapshot;
  activeModule:
    | 'ERP_MARKETING_WS'
    | 'ERP_HR'
    | 'ERP_RBAC'
    | 'ERP_REPORTS'
    | 'ERP_ASSISTANT'
    | 'ERP_SETTINGS_ORG';
  onRefresh: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error') => void;
  onPrintReport: (title: string, rows: any[]) => void;
}

const MODULE_LABELS: Record<string, string> = {
  executive: 'Executive',
  procurement: 'Procurement',
  materials: 'Materials',
  formulations: 'Formulations',
  batches: 'Batches',
  quality: 'Quality/QC',
  warehouse: 'Warehouse',
  crm: 'CRM',
  sales: 'Sales',
  proposals: 'Proposals',
  gst_billing: 'GST Billing',
  accounting: 'Accounting',
  marketing: 'Marketing',
  hr: 'HR & Tasks',
  rbac: 'RBAC',
  reports: 'Reports',
  assistant: 'AI Analyst',
  settings: 'Settings'
};

export const ErpGrowthGovernanceModules: React.FC<Props> = ({
  snapshot,
  activeModule,
  onRefresh,
  notify
}) => {
  const [busy, setBusy] = useState(false);

  // Module 15: RBAC
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    snapshot.roles.find((r) => r.code !== 'SUPER_ADMIN')?.id || snapshot.roles[0]?.id || ''
  );
  const [accessForm, setAccessForm] = useState({
    email: '',
    displayName: '',
    roleId: snapshot.roles[1]?.id || 'role-sales-crm',
    departmentId: snapshot.departments[0]?.id || 'dept-crm'
  });

  // Module 18: Organization Settings & Attachments
  const org = snapshot.organization || {};
  const [orgForm, setOrgForm] = useState({
    legalName: org.legalName || '',
    gstin: org.gstin || '',
    stateName: org.stateName || 'Maharashtra',
    registeredAddress: org.registeredAddress || '',
    contactEmail: org.contactEmail || '',
    contactPhone: org.contactPhone || '',
    bankName: org.bankDetails?.bankName || '',
    ifsc: org.bankDetails?.ifsc || ''
  });
  const [attForm, setAttForm] = useState({
    entityType: 'ORGANIZATION',
    entityId: 'org-fragmore-hq',
    fileName: '',
    documentType: 'IFRA_COMPLIANCE_CERTIFICATE',
    storageUrlOrData: ''
  });

  const runAction = async (fn: () => Promise<void>, okMsg?: string) => {
    setBusy(true);
    try {
      await fn();
      await onRefresh();
      if (okMsg) notify(okMsg, 'success');
    } catch (e: any) {
      notify(e?.message || 'ERP request failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------------------------------
  // MODULE 13: COLLABORATIVE MARKETING AGENCY WORKSPACE
  // --------------------------------------------------------------------------
  if (activeModule === 'ERP_MARKETING_WS') {
    return <ErpAgencyMarketingWorkspace onParentRefresh={onRefresh} notify={notify} />;
  }

  // --------------------------------------------------------------------------
  // MODULE 14: HR, INTERNSHIP COHORTS & CROSS-DEPT KANBAN WORKSPACE
  // --------------------------------------------------------------------------
  if (activeModule === 'ERP_HR') {
    return <ErpHrInternTaskWorkspace onParentRefresh={onRefresh} notify={notify} />;
  }

  // --------------------------------------------------------------------------
  // MODULE 16: CENTRALIZED REPORTING & DOCUMENT EXPORT ENGINE
  // --------------------------------------------------------------------------
  if (activeModule === 'ERP_REPORTS') {
    return <ErpReportsCenterWorkspace notify={notify} />;
  }

  // --------------------------------------------------------------------------
  // MODULE 15: ROLE-BASED ACCESS CONTROL MATRIX & USER ASSIGNMENTS
  // --------------------------------------------------------------------------
  if (activeModule === 'ERP_RBAC') {
    const activeRole = snapshot.roles.find((r) => r.id === selectedRoleId) || snapshot.roles[0];
    const rolePerms = snapshot.permissions.filter((p) => p.roleId === activeRole?.id);

    const togglePerm = (
      perm: any,
      field: 'canView' | 'canCreate' | 'canEdit' | 'canApprove' | 'canDelete' | 'canExport'
    ) => {
      runAction(
        () =>
          erpApi.updatePermission({
            roleId: perm.roleId,
            moduleKey: perm.moduleKey,
            canView: field === 'canView' ? !perm.canView : perm.canView,
            canCreate: field === 'canCreate' ? !perm.canCreate : perm.canCreate,
            canEdit: field === 'canEdit' ? !perm.canEdit : perm.canEdit,
            canApprove: field === 'canApprove' ? !perm.canApprove : perm.canApprove,
            canDelete: field === 'canDelete' ? !perm.canDelete : perm.canDelete,
            canExport: field === 'canExport' ? !perm.canExport : perm.canExport
          }),
        `Saved ${perm.moduleKey} permission in PostgreSQL.`
      );
    };

    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#DED7CC] pb-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
              Module 15 · Governance &amp; Server Security
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
              Role-Based Access Control (RBAC) Matrix
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ErpTableExportBar
              reportKey="custom_table"
              title={`RBAC Permission Matrix — ${activeRole?.name || 'Role'}`}
              customRows={rolePerms}
              notify={notify}
            />
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="px-3 py-2 border border-[#DED7CC] bg-[#FFFFFF] rounded text-xs font-mono"
            >
              {snapshot.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 border border-[#DED7CC] bg-[#FFFFFF] rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b border-[#DED7CC] font-mono text-[10px] uppercase text-[#686158]">
                <tr>
                  <th className="py-2.5 px-3">ERP Module</th>
                  <th className="py-2.5 px-2 text-center">View</th>
                  <th className="py-2.5 px-2 text-center">Create</th>
                  <th className="py-2.5 px-2 text-center">Edit</th>
                  <th className="py-2.5 px-2 text-center">Approve</th>
                  <th className="py-2.5 px-2 text-center">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DED7CC]">
                {rolePerms.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 px-3 font-mono font-semibold text-[#24211D]">
                      {MODULE_LABELS[p.moduleKey] || p.moduleKey}
                    </td>
                    {(['canView', 'canCreate', 'canEdit', 'canApprove', 'canExport'] as const).map(
                      (field) => (
                        <td key={field} className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            disabled={busy || activeRole?.code === 'SUPER_ADMIN'}
                            checked={Boolean(p[field])}
                            onChange={() => togglePerm(p, field)}
                            className="cursor-pointer accent-[#9A783E]"
                          />
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction(async () => {
                  await erpApi.assignUserAccess(accessForm);
                  setAccessForm({ ...accessForm, email: '', displayName: '' });
                }, 'Staff access binding persisted.');
              }}
              className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-3"
            >
              <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
                Grant / Update Staff Access
              </h3>
              <input
                required
                type="email"
                placeholder="Staff Email"
                value={accessForm.email}
                onChange={(e) => setAccessForm({ ...accessForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <input
                required
                placeholder="Display Name"
                value={accessForm.displayName}
                onChange={(e) => setAccessForm({ ...accessForm, displayName: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
              <select
                value={accessForm.roleId}
                onChange={(e) => setAccessForm({ ...accessForm, roleId: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                {snapshot.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                disabled={busy}
                type="submit"
                className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
              >
                Assign Role
              </button>
            </form>

            <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-2 max-h-72 overflow-y-auto">
              <h4 className="text-[11px] font-mono uppercase text-[#686158] font-semibold">
                Staff User Access Bindings ({snapshot.userAccess.length})
              </h4>
              {snapshot.userAccess.map((u) => {
                const roleName =
                  snapshot.roles.find((r) => r.id === u.roleId)?.code || u.roleId;
                const active = Boolean(u.isActive);
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-2 text-xs border-b border-[#DED7CC]/60 py-2"
                  >
                    <div className="min-w-0">
                      <div className={`truncate font-medium ${active ? 'text-[#24211D]' : 'line-through text-[#686158]'}`}>
                        {u.email}
                      </div>
                      <div className="font-mono text-[10px] text-[#9A783E]">
                        {roleName} · {active ? 'ACTIVE' : 'REVOKED'}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          () =>
                            erpApi.assignUserAccess({
                              email: u.email,
                              displayName: u.displayName,
                              roleId: u.roleId,
                              departmentId: u.departmentId,
                              isActive: !active
                            }),
                          active
                            ? `Immediately revoked ERP access for ${u.email}.`
                            : `Restored ERP access for ${u.email}.`
                        )
                      }
                      className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded border whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'border-red-700 text-red-800 hover:bg-red-50'
                          : 'border-emerald-700 text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      {active ? 'Disable' : 'Restore'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MODULE 17: AI BUSINESS ASSISTANT, AUTOMATED ALERTS & E2E VERIFICATION
  // --------------------------------------------------------------------------
  if (activeModule === 'ERP_ASSISTANT') {
    return <ErpAiBusinessAssistantWorkspace notify={notify} onChanged={onRefresh} />;
  }

  // --------------------------------------------------------------------------
  // MODULE 18: ORGANIZATION SETTINGS, BANK DETAILS & DOCUMENT ATTACHMENTS
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="border-b border-[#DED7CC] pb-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-[#9A783E]">
          Module 18 · Legal Entity &amp; Attachments
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl text-[#24211D] uppercase tracking-wider mt-1">
          Organization Master, Statutory Info &amp; Documents
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAction(
              () =>
                erpApi.updateOrganization({
                  legalName: orgForm.legalName,
                  gstin: orgForm.gstin,
                  stateName: orgForm.stateName,
                  registeredAddress: orgForm.registeredAddress,
                  contactEmail: orgForm.contactEmail,
                  contactPhone: orgForm.contactPhone,
                  bankDetails: { bankName: orgForm.bankName, ifsc: orgForm.ifsc },
                  expectedVersion: org.version
                }),
              'Organization master & GSTIN configuration updated.'
            );
          }}
          className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-5 space-y-3"
        >
          <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2">
            Company &amp; Tax Settings
          </h3>
          <input
            value={orgForm.legalName}
            onChange={(e) => setOrgForm({ ...orgForm, legalName: e.target.value })}
            placeholder="Legal Name"
            className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={orgForm.gstin}
              onChange={(e) => setOrgForm({ ...orgForm, gstin: e.target.value })}
              placeholder="GSTIN"
              className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
            />
            <input
              value={orgForm.stateName}
              onChange={(e) => setOrgForm({ ...orgForm, stateName: e.target.value })}
              placeholder="Home State (GST)"
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
          </div>
          <input
            value={orgForm.registeredAddress}
            onChange={(e) => setOrgForm({ ...orgForm, registeredAddress: e.target.value })}
            placeholder="Registered Office Address"
            className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={orgForm.bankName}
              onChange={(e) => setOrgForm({ ...orgForm, bankName: e.target.value })}
              placeholder="Settlement Bank"
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
            <input
              value={orgForm.ifsc}
              onChange={(e) => setOrgForm({ ...orgForm, ifsc: e.target.value })}
              placeholder="IFSC Code"
              className="w-full px-3 py-2 border border-[#DED7CC] rounded font-mono text-xs bg-[#FAF8F4]"
            />
          </div>
          <button
            disabled={busy}
            type="submit"
            className="w-full py-2.5 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
          >
            Save Legal &amp; GST Profile
          </button>
        </form>

        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction(async () => {
                await erpApi.addAttachment(attForm);
                setAttForm({ ...attForm, fileName: '', storageUrlOrData: '' });
              }, 'Document attachment saved to ERP archive.');
            }}
            className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-5 space-y-3"
          >
            <h3 className="text-xs font-mono uppercase font-semibold border-b border-[#DED7CC] pb-2 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-[#9A783E]" />
              <span>Attach Compliance / Commercial Document</span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={attForm.entityType}
                onChange={(e) => setAttForm({ ...attForm, entityType: e.target.value })}
                className="w-full px-2.5 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              >
                <option value="ORGANIZATION">Organization / Statutory</option>
                <option value="FORMULATION">IFRA Certificate</option>
                <option value="PURCHASE_ORDER">Vendor Quotation / PO</option>
                <option value="INVOICE">Signed B2B Contract</option>
              </select>
              <input
                required
                placeholder="File Name (e.g. IFRA-51.pdf)"
                value={attForm.fileName}
                onChange={(e) => setAttForm({ ...attForm, fileName: e.target.value })}
                className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
              />
            </div>
            <input
              required
              placeholder="Document Reference URL or Base64 URI"
              value={attForm.storageUrlOrData}
              onChange={(e) => setAttForm({ ...attForm, storageUrlOrData: e.target.value })}
              className="w-full px-3 py-2 border border-[#DED7CC] rounded text-xs bg-[#FAF8F4]"
            />
            <button
              disabled={busy}
              type="submit"
              className="w-full py-2 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] text-xs font-mono uppercase rounded cursor-pointer"
            >
              Archive Attachment
            </button>
          </form>

          <div className="border border-[#DED7CC] bg-[#FFFFFF] rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-mono uppercase text-[#686158] font-semibold">
              Document Repository ({snapshot.attachments.length})
            </h4>
            {snapshot.attachments.length === 0 ? (
              <p className="text-xs text-[#686158] font-mono">No attachments archived yet.</p>
            ) : (
              snapshot.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex justify-between text-xs font-mono border-t border-[#DED7CC] pt-2"
                >
                  <span>
                    {att.fileName} ({att.entityType})
                  </span>
                  <span className="text-[#9A783E]">{att.uploadedByEmail}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
