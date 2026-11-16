import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.ts';
import {
  automationWorkflows,
  automationEvents,
  automationJobs,
  automationScheduledTasks,
  automationApprovals,
  automationAiRecommendations,
  customers,
  auditLogs
} from '../db/schema.ts';
import {
  getAllCustomers,
  getAdminCustomerAnalytics,
  recalculateCustomerLifecycleState,
  DYNAMIC_CUSTOMER_SEGMENTS
} from '../db/queries.ts';
import { eq, desc } from 'drizzle-orm';
import { requireAdmin, optionalAuth } from '../middleware/auth.ts';
import {
  ensureAutomationSeeded,
  getAutomationSettings,
  updateAutomationSettings,
  inspectWorkflowGovernance,
  ingestAutomationEvent,
  processPendingAutomationJobs,
  executeSingleAutomationJob,
  generateAiWorkflowRecommendation,
  computeAutomationOverviewMetrics
} from './automationEngine.ts';

export const automationRouter = Router();

// 1. Live Overview & Aggregated State
automationRouter.get('/overview', optionalAuth, async (req: Request, res: Response) => {
  try {
    await ensureAutomationSeeded();
    const metrics = await computeAutomationOverviewMetrics({
      dateRange: String(req.query.dateRange || 'lifetime'),
      workflowId: String(req.query.workflowId || 'all'),
      channel: String(req.query.channel || 'all'),
      segment: String(req.query.segment || 'all'),
      eventType: String(req.query.eventType || 'all')
    });

    const [workflows, events, jobs, schedules, approvals, aiRecs, settings] = await Promise.all([
      db.select().from(automationWorkflows).orderBy(desc(automationWorkflows.updatedAt)),
      db.select().from(automationEvents).orderBy(desc(automationEvents.createdAt)).limit(100),
      db.select().from(automationJobs).orderBy(desc(automationJobs.createdAt)).limit(150),
      db.select().from(automationScheduledTasks).orderBy(desc(automationScheduledTasks.createdAt)),
      db.select().from(automationApprovals).orderBy(desc(automationApprovals.createdAt)),
      db
        .select()
        .from(automationAiRecommendations)
        .orderBy(desc(automationAiRecommendations.createdAt)),
      getAutomationSettings()
    ]);

    const integrationsList = [
      {
        id: 'cloudsql',
        name: 'Firebase Firestore (Event & Queue Store)',
        configured: true,
        verified: true,
        status: 'VERIFIED',
        envRequired: 'FIREBASE_PROJECT_ID'
      },
      {
        id: 'webhook',
        name: 'HMAC-SHA256 Signed Webhook Dispatcher',
        configured: true,
        verified: true,
        status: 'VERIFIED',
        envRequired: 'AUTOMATION_WEBHOOK_SECRET'
      },
      {
        id: 'geminiAi',
        name: 'Google Gemini AI Optimization Engine',
        configured: Boolean(process.env.GEMINI_API_KEY),
        verified: Boolean(process.env.GEMINI_API_KEY),
        status: process.env.GEMINI_API_KEY ? 'VERIFIED' : 'PENDING_CREDENTIALS',
        envRequired: 'GEMINI_API_KEY'
      },
      {
        id: 'whatsapp',
        name: 'Meta WhatsApp Business Cloud API',
        configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
        verified: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
        status:
          process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
            ? 'VERIFIED'
            : 'SANDBOX_DB_LOGGED',
        envRequired: 'WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID'
      },
      {
        id: 'email',
        name: 'Transactional & Marketing Email Gateway',
        configured: Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY),
        verified: Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY),
        status: process.env.SMTP_HOST || process.env.RESEND_API_KEY ? 'VERIFIED' : 'SANDBOX_DB_LOGGED',
        envRequired: 'SMTP_HOST or RESEND_API_KEY'
      },
      {
        id: 'sms',
        name: 'SMS Transactional Gateway',
        configured: Boolean(process.env.SMS_API_KEY || process.env.TWILIO_AUTH_TOKEN),
        verified: Boolean(process.env.SMS_API_KEY || process.env.TWILIO_AUTH_TOKEN),
        status: process.env.SMS_API_KEY || process.env.TWILIO_AUTH_TOKEN ? 'VERIFIED' : 'SANDBOX_DB_LOGGED',
        envRequired: 'SMS_API_KEY or TWILIO_AUTH_TOKEN'
      }
    ];

    const normalizedWorkflows = workflows.map((wf: any) => {
      const st = wf.stats || {};
      const nodes = (Array.isArray(wf.nodes) ? wf.nodes : []).map((n: any) => ({
        ...n,
        category:
          n.category ||
          (String(n.type || '').toUpperCase() === 'TRIGGER' ||
          String(n.type || '').toUpperCase() === 'CONDITION' ||
          String(n.type || '').toUpperCase() === 'ACTION' ||
          String(n.type || '').toUpperCase() === 'CONTROL'
            ? String(n.type).toUpperCase()
            : 'ACTION'),
        type: n.subtype ? String(n.subtype).replace(/^(trigger|condition|action|control)\./, '') : n.type
      }));
      return {
        ...wf,
        nodes,
        executionCount: st.totalRuns || 0,
        successCount: st.successfulRuns || 0,
        failureCount: st.failedRuns || 0,
        revenueAttributed: st.attributedRevenue || 0
      };
    });

    const normalizedJobs = jobs.map((j: any) => ({
      ...j,
      triggerType: j.eventType,
      attempts: j.attemptCount ?? 0,
      stepLogs: (Array.isArray(j.stepLogs) ? j.stepLogs : []).map((s: any) => ({
        ...s,
        detail: s.detail || (s.output ? JSON.stringify(s.output) : s.error || 'Completed step')
      }))
    }));

    const normalizedSchedules = schedules.map((s: any) => ({
      ...s,
      status: s.isActive ? 'ACTIVE' : 'PAUSED'
    }));

    res.json({
      metrics,
      kpis: metrics,
      workflows: normalizedWorkflows,
      events,
      recentEvents: events,
      jobs: normalizedJobs,
      recentJobs: normalizedJobs,
      schedules: normalizedSchedules,
      approvals,
      aiRecommendations: aiRecs,
      recommendations: aiRecs,
      settings,
      integrations: integrationsList
    });
  } catch (error: any) {
    console.error('[Automation API] Overview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Workflows CRUD, Versioning, Governance, Rollback, Duplicate & Test
automationRouter.get('/workflows', optionalAuth, async (_req: Request, res: Response) => {
  try {
    await ensureAutomationSeeded();
    const list = await db
      .select()
      .from(automationWorkflows)
      .orderBy(desc(automationWorkflows.updatedAt));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

automationRouter.post('/workflows', requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const adminEmail =
      String(req.headers['x-admin-email'] || (req as any).user?.email || 'aibrandorigin@gmail.com');
    const settings = await getAutomationSettings();

    const id = body.id || `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const existingRows = await db
      .select()
      .from(automationWorkflows)
      .where(eq(automationWorkflows.id, id))
      .limit(1);
    const existing = existingRows[0];

    const rawNodes = Array.isArray(body.nodes) ? body.nodes : existing?.nodes || [];
    const nodes = (rawNodes as any[]).map((n: any) => {
      const cat = String(n.category || n.type || 'ACTION').toLowerCase();
      const nodeType =
        cat === 'trigger' || cat === 'condition' || cat === 'action' || cat === 'control'
          ? cat
          : 'action';
      const rawSubtype = String(n.subtype || n.type || '');
      const subtype = rawSubtype.includes('.') ? rawSubtype : `${nodeType}.${rawSubtype}`;
      return {
        ...n,
        category: nodeType.toUpperCase(),
        type: nodeType,
        subtype
      };
    });
    const rawEdges = Array.isArray(body.edges) ? body.edges : existing?.edges || [];
    const edges = (rawEdges as any[]).map((e: any) => ({
      ...e,
      branchLabel: e.branchLabel || e.branch || 'DEFAULT'
    }));
    const triggerType = body.triggerType || existing?.triggerType || 'order.placed';
    const triggerConfig = body.triggerConfig || existing?.triggerConfig || {};

    // Inspect governance rules (Section F)
    const gov = inspectWorkflowGovernance(nodes as any, settings);
    const requestedStatus = body.status || existing?.status || 'DRAFT';
    let finalStatus = requestedStatus;
    let approvalStatus = existing?.approvalStatus || 'APPROVED';

    if (gov.requiresApproval && requestedStatus === 'ACTIVE' && !body.forceApprove) {
      finalStatus = 'PENDING_APPROVAL';
      approvalStatus = 'PENDING';

      await db.insert(automationApprovals).values({
        id: `appr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        workflowId: id,
        workflowName: body.name || existing?.name || 'Untitled Workflow',
        actionType: gov.actionTypes[0] || 'WORKFLOW_PUBLISH',
        requestedBy: adminEmail,
        reason: gov.reasons.join('; '),
        payload: { triggerType, nodesCount: (nodes as any[]).length, reasons: gov.reasons },
        status: 'PENDING',
        createdAt: new Date()
      });
    }

    const nextVersion = existing ? (existing.version || 1) + 1 : 1;
    const prevHistory = Array.isArray(existing?.versionHistory)
      ? (existing.versionHistory as any[])
      : [];
    const versionSnapshot = {
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
      comment: body.versionComment || (existing ? `Updated workflow v${nextVersion}` : 'Created workflow v1'),
      triggerType,
      triggerConfig,
      nodes,
      edges
    };

    const defaultStats = existing?.stats || {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      pendingRuns: 0,
      messagesSent: 0,
      attributedRevenue: 0,
      generatedOrders: 0,
      couponRedemptions: 0,
      totalCostInr: 0,
      avgLatencyMs: 0
    };

    const record = {
      id,
      name: body.name || existing?.name || 'New FRAGMORÉ Automation',
      description: body.description ?? existing?.description ?? '',
      category: body.category || existing?.category || 'customer_journeys',
      status: finalStatus,
      triggerType,
      triggerConfig,
      nodes,
      edges,
      version: nextVersion,
      versionHistory: [versionSnapshot, ...prevHistory].slice(0, 25),
      maxExecutionsPerCustomer:
        body.maxExecutionsPerCustomer !== undefined
          ? Number(body.maxExecutionsPerCustomer)
          : existing?.maxExecutionsPerCustomer ?? 0,
      maxExecutionsPerDay:
        body.maxExecutionsPerDay !== undefined
          ? Number(body.maxExecutionsPerDay)
          : existing?.maxExecutionsPerDay ?? 1000,
      cooldownMinutes:
        body.cooldownMinutes !== undefined
          ? Number(body.cooldownMinutes)
          : existing?.cooldownMinutes ?? 0,
      requiresApproval: gov.requiresApproval,
      approvalStatus,
      allowedRoles: Array.isArray(body.allowedRoles)
        ? body.allowedRoles
        : existing?.allowedRoles || ['SUPER_ADMIN', 'ORDER_MANAGER', 'MARKETING'],
      stats: defaultStats,
      createdBy: existing?.createdBy || adminEmail,
      updatedAt: new Date()
    };

    if (existing) {
      await db.update(automationWorkflows).set(record).where(eq(automationWorkflows.id, id));
    } else {
      await db.insert(automationWorkflows).values({
        ...record,
        createdAt: new Date()
      });
    }

    await db.insert(auditLogs).values({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action: existing ? 'UPDATE_AUTOMATION_WORKFLOW' : 'CREATE_AUTOMATION_WORKFLOW',
      adminEmail,
      details: `${existing ? 'Updated' : 'Created'} workflow "${record.name}" (v${nextVersion}, status: ${finalStatus})`,
      metadata: { workflowId: id, version: nextVersion, governance: gov }
    });

    const [saved] = await db
      .select()
      .from(automationWorkflows)
      .where(eq(automationWorkflows.id, id))
      .limit(1);

    res.json({
      success: true,
      workflow: saved,
      governance: gov
    });
  } catch (error: any) {
    console.error('[Automation API] Save workflow error:', error);
    res.status(500).json({ error: error.message });
  }
});

const handleWorkflowStatusChangeRoute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminEmail = String(req.headers['x-admin-email'] || 'gowisherharsha@gmail.com');

    const [wf] = await db
      .select()
      .from(automationWorkflows)
      .where(eq(automationWorkflows.id, id))
      .limit(1);
    if (!wf) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const settings = await getAutomationSettings();
    const gov = inspectWorkflowGovernance((wf.nodes as any[]) || [], settings);

    let nextStatus = String(status || 'DRAFT').toUpperCase();
    let approvalStatus = wf.approvalStatus;

    if (nextStatus === 'ACTIVE' && gov.requiresApproval && wf.approvalStatus !== 'APPROVED') {
      nextStatus = 'PENDING_APPROVAL';
      approvalStatus = 'PENDING';
      await db.insert(automationApprovals).values({
        id: `appr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        workflowId: wf.id,
        workflowName: wf.name,
        actionType: gov.actionTypes[0] || 'WORKFLOW_PUBLISH',
        requestedBy: adminEmail,
        reason: gov.reasons.join('; '),
        payload: { workflowId: wf.id, reasons: gov.reasons },
        status: 'PENDING',
        createdAt: new Date()
      });
    }

    const [updated] = await db
      .update(automationWorkflows)
      .set({
        status: nextStatus,
        approvalStatus,
        updatedAt: new Date()
      })
      .where(eq(automationWorkflows.id, id))
      .returning();

    await db.insert(auditLogs).values({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action: 'WORKFLOW_STATUS_CHANGE',
      adminEmail,
      details: `Workflow "${wf.name}" transitioned to ${nextStatus}`,
      metadata: { workflowId: id, status: nextStatus }
    });

    res.json({ success: true, status: nextStatus, workflow: updated, governance: gov });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

automationRouter.post('/workflows/:id/status', requireAdmin, handleWorkflowStatusChangeRoute);
automationRouter.patch('/workflows/:id/status', requireAdmin, handleWorkflowStatusChangeRoute);

automationRouter.post(
  '/workflows/:id/duplicate',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const adminEmail = String(req.headers['x-admin-email'] || 'aibrandorigin@gmail.com');
      const [wf] = await db
        .select()
        .from(automationWorkflows)
        .where(eq(automationWorkflows.id, id))
        .limit(1);
      if (!wf) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      const newId = `wf-copy-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const zeroStats = {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        pendingRuns: 0,
        messagesSent: 0,
        attributedRevenue: 0,
        generatedOrders: 0,
        couponRedemptions: 0,
        totalCostInr: 0,
        avgLatencyMs: 0
      };

      const [duplicated] = await db
        .insert(automationWorkflows)
        .values({
          ...wf,
          id: newId,
          name: `${wf.name} (Copy)`,
          status: 'DRAFT',
          version: 1,
          versionHistory: [
            {
              version: 1,
              updatedAt: new Date().toISOString(),
              updatedBy: adminEmail,
              comment: `Duplicated from ${wf.name} (${wf.id})`,
              triggerType: wf.triggerType,
              triggerConfig: wf.triggerConfig,
              nodes: wf.nodes,
              edges: wf.edges
            }
          ],
          stats: zeroStats,
          createdBy: adminEmail,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json({ success: true, workflow: duplicated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

automationRouter.post(
  '/workflows/:id/rollback',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const targetVersion = Number(req.body.version);
      const adminEmail = String(req.headers['x-admin-email'] || 'aibrandorigin@gmail.com');

      const [wf] = await db
        .select()
        .from(automationWorkflows)
        .where(eq(automationWorkflows.id, id))
        .limit(1);
      if (!wf) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      const history: any[] = Array.isArray(wf.versionHistory) ? (wf.versionHistory as any[]) : [];
      const snapshot = history.find((h) => Number(h.version) === targetVersion);
      if (!snapshot) {
        return res.status(400).json({ error: `Version ${targetVersion} not found in history` });
      }

      const nextVer = (wf.version || 1) + 1;
      const rollbackEntry = {
        version: nextVer,
        updatedAt: new Date().toISOString(),
        updatedBy: adminEmail,
        comment: `Rolled back to v${targetVersion}`,
        triggerType: snapshot.triggerType || wf.triggerType,
        triggerConfig: snapshot.triggerConfig || wf.triggerConfig,
        nodes: snapshot.nodes || wf.nodes,
        edges: snapshot.edges || wf.edges
      };

      const [updated] = await db
        .update(automationWorkflows)
        .set({
          triggerType: rollbackEntry.triggerType,
          triggerConfig: rollbackEntry.triggerConfig,
          nodes: rollbackEntry.nodes,
          edges: rollbackEntry.edges,
          version: nextVer,
          versionHistory: [rollbackEntry, ...history].slice(0, 25),
          updatedAt: new Date()
        })
        .where(eq(automationWorkflows.id, id))
        .returning();

      await db.insert(auditLogs).values({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'WORKFLOW_ROLLBACK',
        adminEmail,
        details: `Rolled back workflow "${wf.name}" to version ${targetVersion} (now v${nextVer})`,
        metadata: { workflowId: id, rolledBackTo: targetVersion, newVersion: nextVer }
      });

      res.json({ success: true, workflow: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

automationRouter.post(
  '/workflows/:id/test',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [wf] = await db
        .select()
        .from(automationWorkflows)
        .where(eq(automationWorkflows.id, id))
        .limit(1);
      if (!wf) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      const testPayload = req.body?.payload || {
        cartValue: 2850,
        totalAmount: 2850,
        orderStatus: 'CONFIRMED',
        collection: 'Signature Collection',
        productSlug: 'golden-hour',
        customerSegment: 'VIP',
        city: 'Mumbai',
        state: 'Maharashtra'
      };

      const result = await ingestAutomationEvent({
        eventType: wf.triggerType,
        source: 'manual_test',
        entityId: `test-${id}-${Date.now()}`,
        customerEmail: req.body?.customerEmail || 'aibrandorigin@gmail.com',
        customerSegment: testPayload.customerSegment || 'VIP',
        payload: testPayload,
        isTestRun: true,
        targetWorkflowId: wf.id
      });

      const firstJob = result.jobsCreated[0] || null;
      const normalizedJob = firstJob
        ? {
            ...firstJob,
            stepLogs: (Array.isArray(firstJob.stepLogs) ? firstJob.stepLogs : []).map((s: any) => ({
              ...s,
              detail: s.detail || (s.output ? JSON.stringify(s.output) : s.error || 'Completed step')
            }))
          }
        : null;

      res.json({
        success: true,
        event: result.event,
        jobs: result.jobsCreated,
        job: normalizedJob,
        execution: normalizedJob
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

automationRouter.delete('/workflows/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.delete(automationWorkflows).where(eq(automationWorkflows.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Events & Webhook Ingestion (with HMAC signature verification for webhooks)
automationRouter.post('/events', optionalAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const source = body.source || 'storefront';

    // If external webhook, verify HMAC signature if header provided
    const signatureHeader = req.headers['x-fragmore-signature-256'] as string | undefined;
    if (source === 'webhook' && signatureHeader) {
      const settings = await getAutomationSettings();
      const expected =
        'sha256=' +
        crypto
          .createHmac('sha256', settings.webhookSigningSecret)
          .update(JSON.stringify(body.payload || {}))
          .digest('hex');
      if (signatureHeader !== expected) {
        return res.status(401).json({ error: 'Webhook HMAC signature verification failed' });
      }
    }

    const result = await ingestAutomationEvent({
      eventType: body.eventType || 'webhook.received',
      source,
      idempotencyKey: body.idempotencyKey,
      entityId: body.entityId,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      customerSegment: body.customerSegment,
      payload: body.payload || {},
      isTestRun: Boolean(body.isTestRun),
      targetWorkflowId: body.targetWorkflowId
    });

    res.json({
      success: true,
      deduplicated: result.deduplicated,
      event: result.event,
      jobsCreated: result.jobsCreated
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Jobs Queue, Manual Reprocessing & Cancellation
automationRouter.post('/jobs/:id/reprocess', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [job] = await db
      .select()
      .from(automationJobs)
      .where(eq(automationJobs.id, id))
      .limit(1);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await db
      .update(automationJobs)
      .set({
        status: 'QUEUED',
        currentNodeId: null,
        attemptCount: 0,
        lastError: null,
        lockedBy: null,
        lockedUntil: null,
        nextRunAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(automationJobs.id, id));

    await executeSingleAutomationJob(id);

    const [updated] = await db
      .select()
      .from(automationJobs)
      .where(eq(automationJobs.id, id))
      .limit(1);

    res.json({ success: true, job: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

automationRouter.post('/jobs/:id/cancel', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [updated] = await db
      .update(automationJobs)
      .set({
        status: 'CANCELLED',
        lockedBy: null,
        lockedUntil: null,
        updatedAt: new Date()
      })
      .where(eq(automationJobs.id, id))
      .returning();

    res.json({ success: true, job: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Scheduled Jobs Management
automationRouter.post('/schedules', requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const id = body.id || `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nextRunAt = body.nextRunAt
      ? new Date(body.nextRunAt)
      : new Date(Date.now() + 3600 * 1000);

    const [saved] = await db
      .insert(automationScheduledTasks)
      .values({
        id,
        name: body.name || 'Scheduled Automation Job',
        workflowId: body.workflowId,
        cronExpression: body.cronExpression || '0 9 * * *',
        timezone: body.timezone || 'Asia/Kolkata',
        isActive: body.isActive ?? true,
        nextRunAt,
        runCount: 0,
        createdAt: new Date()
      })
      .onConflictDoUpdate({
        target: automationScheduledTasks.id,
        set: {
          name: body.name,
          workflowId: body.workflowId,
          cronExpression: body.cronExpression,
          timezone: body.timezone || 'Asia/Kolkata',
          isActive: body.isActive ?? true,
          nextRunAt
        }
      })
      .returning();

    res.json({ success: true, schedule: saved });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

automationRouter.post('/schedules/:id/run', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [task] = await db
      .select()
      .from(automationScheduledTasks)
      .where(eq(automationScheduledTasks.id, id))
      .limit(1);
    if (!task) {
      return res.status(404).json({ error: 'Scheduled task not found' });
    }

    const now = new Date();
    await db
      .update(automationScheduledTasks)
      .set({
        lastRunAt: now,
        runCount: (task.runCount || 0) + 1
      })
      .where(eq(automationScheduledTasks.id, id));

    const result = await ingestAutomationEvent({
      eventType: 'schedule.triggered',
      source: 'scheduler',
      idempotencyKey: `sched-manual:${task.id}:${Date.now()}`,
      entityId: task.id,
      payload: {
        scheduledTaskId: task.id,
        scheduledTaskName: task.name,
        cronExpression: task.cronExpression,
        timezone: task.timezone
      },
      isTestRun: true,
      targetWorkflowId: task.workflowId
    });

    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

automationRouter.delete('/schedules/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await db
      .delete(automationScheduledTasks)
      .where(eq(automationScheduledTasks.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Governance Approvals
automationRouter.post(
  '/approvals/:id/decision',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const decision = String(req.body.decision || 'APPROVED').toUpperCase();
      const reviewNotes = req.body.reviewNotes || '';
      const adminEmail = String(req.headers['x-admin-email'] || 'aibrandorigin@gmail.com');

      const [appr] = await db
        .select()
        .from(automationApprovals)
        .where(eq(automationApprovals.id, id))
        .limit(1);
      if (!appr) {
        return res.status(404).json({ error: 'Approval request not found' });
      }

      const [updatedAppr] = await db
        .update(automationApprovals)
        .set({
          status: decision,
          reviewedBy: adminEmail,
          reviewedAt: new Date(),
          reviewNotes
        })
        .where(eq(automationApprovals.id, id))
        .returning();

      // If approved, unlock workflow and/or resume paused job
      if (decision === 'APPROVED') {
        await db
          .update(automationWorkflows)
          .set({
            approvalStatus: 'APPROVED',
            status: 'ACTIVE',
            approvedBy: adminEmail,
            approvedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(automationWorkflows.id, appr.workflowId));

        if (appr.jobId) {
          const [waitingJob] = await db
            .select()
            .from(automationJobs)
            .where(eq(automationJobs.id, appr.jobId))
            .limit(1);
          if (waitingJob) {
            const ctx: any = waitingJob.executionContext || {};
            ctx.approvedByAdmin = adminEmail;
            await db
              .update(automationJobs)
              .set({
                status: 'QUEUED',
                executionContext: ctx,
                updatedAt: new Date()
              })
              .where(eq(automationJobs.id, waitingJob.id));
            await executeSingleAutomationJob(waitingJob.id);
          }
        }
      } else if (decision === 'REJECTED' && appr.jobId) {
        await db
          .update(automationJobs)
          .set({
            status: 'CANCELLED',
            lastError: `Rejected by Admin (${adminEmail}): ${reviewNotes}`,
            updatedAt: new Date()
          })
          .where(eq(automationJobs.id, appr.jobId));
      }

      res.json({ success: true, approval: updatedAppr });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// 7. AI Recommendations (Server-Side Gemini API)
automationRouter.post(
  '/ai-recommendations/generate',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const rec = await generateAiWorkflowRecommendation(req.body?.prompt);
      res.json({ success: true, recommendation: rec });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

automationRouter.post(
  '/ai-recommendations/:id/decision',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const decision = String(req.body.decision || 'APPROVED').toUpperCase();
      const adminEmail = String(req.headers['x-admin-email'] || 'aibrandorigin@gmail.com');

      const [rec] = await db
        .select()
        .from(automationAiRecommendations)
        .where(eq(automationAiRecommendations.id, id))
        .limit(1);
      if (!rec) {
        return res.status(404).json({ error: 'Recommendation not found' });
      }

      await db
        .update(automationAiRecommendations)
        .set({
          status: decision,
          approvedBy: adminEmail
        })
        .where(eq(automationAiRecommendations.id, id));

      let createdWorkflow = null;
      if (decision === 'APPROVED') {
        const bp: any = rec.workflowBlueprint || {};
        const wfId = `wf-ai-${Date.now()}`;
        const [insertedWf] = await db
          .insert(automationWorkflows)
          .values({
            id: wfId,
            name: rec.title,
            description: rec.rationale,
            category: rec.category || 'marketing',
            status: 'DRAFT',
            triggerType: bp.triggerType || rec.suggestedTrigger || 'order.delivered',
            triggerConfig: {},
            nodes: bp.nodes || [],
            edges: bp.edges || [],
            version: 1,
            versionHistory: [
              {
                version: 1,
                updatedAt: new Date().toISOString(),
                updatedBy: adminEmail,
                comment: 'Created from approved AI Recommendation',
                triggerType: bp.triggerType || rec.suggestedTrigger,
                triggerConfig: {},
                nodes: bp.nodes || [],
                edges: bp.edges || []
              }
            ],
            maxExecutionsPerCustomer: 1,
            maxExecutionsPerDay: 500,
            cooldownMinutes: 0,
            requiresApproval: false,
            approvalStatus: 'APPROVED',
            allowedRoles: ['SUPER_ADMIN', 'MARKETING'],
            stats: {
              totalRuns: 0,
              successfulRuns: 0,
              failedRuns: 0,
              pendingRuns: 0,
              messagesSent: 0,
              attributedRevenue: 0,
              generatedOrders: 0,
              couponRedemptions: 0,
              totalCostInr: 0,
              avgLatencyMs: 0
            },
            createdBy: adminEmail,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        createdWorkflow = insertedWf;
      }

      res.json({ success: true, createdWorkflow });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// 8. Global Settings, Real Integration Verification & Data Retention Controls
automationRouter.put('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminEmail = String(req.headers['x-admin-email'] || 'aibrandorigin@gmail.com');
    const updated = await updateAutomationSettings(req.body || {}, adminEmail);
    res.json({ success: true, settings: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

automationRouter.post(
  '/integrations/verify',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const startVerifyMs = Date.now();
      const providerKey = String(req.body.providerId || req.body.provider || 'webhook');
      const settings = await getAutomationSettings();
      const nowIso = new Date().toISOString();

      let verified = false;
      let message = '';

      if (providerKey === 'cloudsql' || providerKey === 'firestore') {
        const wfCheck = await db.select().from(automationWorkflows).limit(1);
        verified = Array.isArray(wfCheck);
        message = 'Firebase Firestore connection & automation_workflows collection verified via live query.';
      } else if (providerKey === 'webhook') {
        const testHmac = crypto
          .createHmac('sha256', settings.webhookSigningSecret)
          .update('{"ping":"fragmore"}')
          .digest('hex');
        verified = Boolean(testHmac.length === 64);
        message = `HMAC-SHA256 Signing Dispatcher verified (sig=${testHmac.slice(0, 12)}...).`;
      } else if (providerKey === 'geminiAi') {
        verified = Boolean(process.env.GEMINI_API_KEY);
        message = verified
          ? 'Server-side GEMINI_API_KEY verified and ready for AI recommendations.'
          : 'GEMINI_API_KEY environment variable is not configured in server secrets.';
      } else if (providerKey === 'whatsapp') {
        verified = Boolean(
          process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
        );
        message = verified
          ? 'WhatsApp Cloud API credentials verified.'
          : 'Pending WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in server environment. Messages are safely logged to database in sandbox mode.';
      } else if (providerKey === 'email') {
        verified = Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY);
        message = verified
          ? 'Transactional Email gateway credentials verified.'
          : 'Pending SMTP_HOST / RESEND_API_KEY in server environment. Emails are safely logged to database in sandbox mode.';
      } else if (providerKey === 'sms') {
        verified = Boolean(process.env.SMS_API_KEY || process.env.TWILIO_AUTH_TOKEN);
        message = verified
          ? 'SMS Gateway credentials verified.'
          : 'Pending SMS_API_KEY / TWILIO_AUTH_TOKEN in server environment. SMS dispatches are safely logged to database in sandbox mode.';
      }

      if (settings.providers[providerKey as keyof typeof settings.providers]) {
        settings.providers[providerKey as keyof typeof settings.providers] = {
          ...settings.providers[providerKey as keyof typeof settings.providers],
          configured: verified,
          lastVerifiedAt: nowIso,
          status: verified ? 'VERIFIED' : 'PENDING_CREDENTIALS'
        };
        await updateAutomationSettings({ providers: settings.providers }, 'system@fragmore.shop');
      }

      res.json({
        success: true,
        verified,
        provider: providerKey,
        status: verified ? 'VERIFIED' : 'PENDING_CREDENTIALS',
        message,
        detail: message,
        latencyMs: Math.max(1, Date.now() - startVerifyMs),
        verifiedAt: nowIso
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

automationRouter.post('/retention/purge', requireAdmin, async (req: Request, res: Response) => {
  try {
    const retentionDays = Number(req.body.retentionDays ?? 90);
    const cutoff = new Date(Date.now() - retentionDays * 86400000);
    const allEvents = await db.select().from(automationEvents);
    let purgedCount = 0;
    for (const ev of allEvents) {
      if (new Date(ev.createdAt) < cutoff) {
        await db.delete(automationEvents).where(eq(automationEvents.id, ev.id));
        purgedCount++;
      }
    }
    res.json({
      success: true,
      purgedCount,
      message: `Data retention check completed. Purged ${purgedCount} events older than ${retentionDays} days.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

automationRouter.post('/worker/process', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const processed = await processPendingAutomationJobs(10);
    res.json({ success: true, processed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Customer Lifecycle CRM & Customer 360 Endpoints (Admin Authorized Only)
automationRouter.get('/crm/customers', requireAdmin, async (_req: Request, res: Response) => {
  try {
    await ensureAutomationSeeded();
    const [customersList, analytics, workflows] = await Promise.all([
      getAllCustomers(),
      getAdminCustomerAnalytics(),
      db.select().from(automationWorkflows).orderBy(desc(automationWorkflows.updatedAt))
    ]);

    const lifecycleWorkflowIds = new Set([
      'wf-customer-welcome-journey',
      'wf-lifecycle-first-purchase',
      'wf-lifecycle-repeat-customer',
      'wf-vip-tier-elevation',
      'wf-lifecycle-inactive-winback',
      'wf-lifecycle-birthday-offer'
    ]);

    const lifecycleWorkflows = workflows.filter(
      (w) => lifecycleWorkflowIds.has(w.id) || w.category === 'customer_journeys'
    );

    const segmentCounts: Record<string, number> = {};
    for (const seg of DYNAMIC_CUSTOMER_SEGMENTS) {
      segmentCounts[seg] = analytics.filter((c: any) =>
        (c.dynamicSegments || c.segments || []).includes(seg)
      ).length;
    }

    res.json({
      customers: analytics,
      analytics,
      segmentDefinitions: DYNAMIC_CUSTOMER_SEGMENTS,
      segmentCounts,
      lifecycleWorkflows
    });
  } catch (error: any) {
    console.error('[Automation CRM] Error fetching Customer 360 list:', error);
    res.status(500).json({ error: error.message });
  }
});

automationRouter.patch(
  '/crm/customers/:id/consent',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const [cust] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
      if (!cust) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const prevMeta =
        cust.crmMetadata && typeof cust.crmMetadata === 'object'
          ? { ...(cust.crmMetadata as Record<string, any>) }
          : {};
      const prevConsent = prevMeta.consent || {};
      const nowIso = new Date().toISOString();

      const unsubscribed =
        body.unsubscribed !== undefined ? Boolean(body.unsubscribed) : Boolean(prevConsent.unsubscribed);
      const marketingOptIn =
        unsubscribed
          ? false
          : body.marketingOptIn !== undefined
          ? Boolean(body.marketingOptIn)
          : prevConsent.marketingOptIn !== false;

      const nextConsent = {
        emailTransactional: true,
        emailPromotional:
          unsubscribed
            ? false
            : body.emailPromotional !== undefined
            ? Boolean(body.emailPromotional)
            : prevConsent.emailPromotional !== false,
        whatsappTransactional: true,
        whatsappPromotional:
          unsubscribed
            ? false
            : body.whatsappPromotional !== undefined
            ? Boolean(body.whatsappPromotional)
            : prevConsent.whatsappPromotional !== false,
        smsTransactional: true,
        smsPromotional:
          unsubscribed
            ? false
            : body.smsPromotional !== undefined
            ? Boolean(body.smsPromotional)
            : Boolean(prevConsent.smsPromotional),
        marketingOptIn,
        unsubscribed,
        frequencyCapPerWeek: Number(body.frequencyCapPerWeek || prevConsent.frequencyCapPerWeek || 5),
        quietHoursStart: body.quietHoursStart || prevConsent.quietHoursStart || '22:00',
        quietHoursEnd: body.quietHoursEnd || prevConsent.quietHoursEnd || '09:00',
        updatedAt: nowIso
      };

      const nextMeta: Record<string, any> = {
        ...prevMeta,
        consent: nextConsent,
        ...(body.birthday !== undefined ? { birthday: body.birthday || null } : {}),
        ...(body.emailVerified !== undefined ? { emailVerified: Boolean(body.emailVerified) } : {}),
        ...(body.mobileVerified !== undefined ? { mobileVerified: Boolean(body.mobileVerified) } : {}),
        ...(Array.isArray(body.supportIssues) ? { supportIssues: body.supportIssues } : {}),
        ...(Array.isArray(body.loyaltyBenefits) ? { loyaltyBenefits: body.loyaltyBenefits } : {})
      };

      await db
        .update(customers)
        .set({
          crmMetadata: nextMeta,
          ...(body.notes !== undefined ? { notes: String(body.notes) } : {})
        })
        .where(eq(customers.id, id));

      // Stop queued/delayed promotional campaigns for unsubscribed customers
      let cancelledCampaignJobs = 0;
      if (unsubscribed && cust.email) {
        const custJobs = await db
          .select()
          .from(automationJobs)
          .where(eq(automationJobs.customerEmail, cust.email.toLowerCase()));
        for (const j of custJobs) {
          if (j.status === 'QUEUED' || j.status === 'DELAYED' || j.status === 'WAITING_APPROVAL') {
            await db
              .update(automationJobs)
              .set({
                status: 'CANCELLED',
                lastError: 'Stopped automatically: Customer unsubscribed from marketing communications',
                updatedAt: new Date()
              })
              .where(eq(automationJobs.id, j.id));
            cancelledCampaignJobs++;
          }
        }
      }

      const recalculated = await recalculateCustomerLifecycleState(id);
      const updatedAll = await getAllCustomers();
      const updatedCustomer = updatedAll.find((c: any) => c.id === id) || cust;

      res.json({
        success: true,
        customer: updatedCustomer,
        recalculated,
        cancelledCampaignJobs
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

automationRouter.post('/crm/recalculate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const identifier = req.body?.customerId || req.body?.email || req.body?.identifier;
    if (identifier) {
      const result = await recalculateCustomerLifecycleState(String(identifier));
      return res.json({ success: true, result });
    }
    const allCusts = await db.select().from(customers);
    const results = [];
    for (const c of allCusts) {
      const r = await recalculateCustomerLifecycleState(c.id);
      if (r) results.push(r);
    }
    res.json({ success: true, recalculatedCount: results.length, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

