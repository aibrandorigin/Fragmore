import React from 'react';
import { type ErpWorkspaceSnapshot } from '../../../lib/erpApi';
import { ErpCommercialCrmWorkspace } from './ErpCommercialCrmWorkspace';
import { ErpGstBillingWorkspace } from './ErpGstBillingWorkspace';
import { ErpAccountingWorkspace } from './ErpAccountingWorkspace';

interface Props {
  snapshot: ErpWorkspaceSnapshot;
  activeModule: 'ERP_CRM' | 'ERP_PROPOSALS' | 'ERP_GST_BILLING' | 'ERP_ACCOUNTING';
  orders: any[];
  onRefresh: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error') => void;
  onPrintInvoice: (invoice: any) => void;
}

export const ErpCommercialFinanceModules: React.FC<Props> = ({
  snapshot,
  activeModule,
  onRefresh,
  notify,
  onPrintInvoice
}) => {
  if (activeModule === 'ERP_CRM' || activeModule === 'ERP_PROPOSALS') {
    return (
      <ErpCommercialCrmWorkspace
        workspaceSnapshot={snapshot}
        activeModule={activeModule}
        onRefreshParent={onRefresh}
        notify={notify}
        onPrintInvoice={onPrintInvoice}
      />
    );
  }

  if (activeModule === 'ERP_GST_BILLING') {
    return <ErpGstBillingWorkspace onRefreshParent={onRefresh} notify={notify} />;
  }

  return <ErpAccountingWorkspace onRefreshParent={onRefresh} notify={notify} />;
};

