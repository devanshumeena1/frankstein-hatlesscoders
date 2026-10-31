import { Router } from "express";
import type { FilterQuery } from "mongoose";
import { getSettings } from "../config";
import { currentUser, getProjectForUser, requireUser } from "../lib/auth";
import { asyncHandler, escapeRegex, HttpError, parseBody, parseId } from "../lib/http";
import { TaskIn, TaskQuery } from "../lib/schemas";
import { taskOut } from "../lib/serialize";
import { CreditLedger, Task, Workspace, WorkspaceMember } from "../models";

export const tasksRouter = Router();

tasksRouter.get(
  "/api/projects/:projectId/tasks",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const projectId = parseId(req.params.projectId, "Project");
    await getProjectForUser(projectId, user);
    const query = parseBody(TaskQuery, req.query);

    const filter: FilterQuery<unknown> = { project: projectId };
    if (query.q) filter.title = new RegExp(escapeRegex(query.q), "i");
    if (query.status) filter.status = query.status;

    const total = await Task.countDocuments(filter);
    const items = await Task.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.page_size)
      .limit(query.page_size)
      .lean();
    res.json({ items: items.map(taskOut), total, page: query.page, page_size: query.page_size });
  })
);

/** Creating a task costs credits. */
tasksRouter.post(
  "/api/projects/:projectId/tasks",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const projectId = parseId(req.params.projectId, "Project");
    const project = await getProjectForUser(projectId, user);
    const body = parseBody(TaskIn, req.body);
    const key = (req.headers["idempotency-key"] as string | undefined) ?? null;
    const cost = getSettings().TASK_CREDIT_COST;

    if (key) {
      const previous = await CreditLedger.findOne({ workspace: project.workspace, idempotencyKey: key }).lean();
      if (previous?.task) {
        const task = await Task.findById(previous.task).lean();
        if (task) {
          res.status(200).json(taskOut(task));
          return;
        }
      }
    }

    // Validate assignee before creating the task
    if (body.assignee_id) {
      const isMember = await WorkspaceMember.exists({ workspace: project.workspace, user: body.assignee_id });
      if (!isMember) throw new HttpError(422, "Assignee is not a workspace member");
    }

    // Atomically deduct credits — prevents race conditions where two requests both pass the balance check
    const ws = await Workspace.findOneAndUpdate(
      { _id: project.workspace, credits: { $gte: cost } },
      { $inc: { credits: -cost } },
      { new: true }
    );
    if (!ws) throw new HttpError(402, "Not enough credits");

    const task = await Task.create({
      project: projectId,
      title: body.title,
      status: body.status,
      createdBy: user._id,
      assignee: body.assignee_id,
    });

    await CreditLedger.create({
      workspace: ws._id, delta: -cost, reason: `task ${task._id}`, task: task._id, idempotencyKey: key ?? undefined,
    });
    res.status(201).json(taskOut(task));
  })
);
