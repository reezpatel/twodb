import { z } from "zod";
import { STATUS_CATEGORIES, PRIORITIES, EPIC_STATUSES, LINK_RELATIONS } from "../db/schema.js";

export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const nullableDate = date.nullable();
export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "#rrggbb");
export const priority = z.enum(PRIORITIES);
export const statusCategory = z.enum(STATUS_CATEGORIES);
export const epicStatus = z.enum(EPIC_STATUSES);
export const linkRelation = z.enum(LINK_RELATIONS);
export const ts = z.string();
export const ok = z.object({ ok: z.literal(true) });
export const anyObject = z.record(z.string(), z.any());
export const anyList = z.array(anyObject);

export const statusSchema = z.object({ id: z.string(), projectId: z.string(), name: z.string(), color: z.string(), category: statusCategory, position: z.number() });
export const ticketTypeSchema = z.object({ id: z.string(), projectId: z.string(), name: z.string(), icon: z.string(), color: z.string(), position: z.number() });
export const labelGroupSchema = z.object({ id: z.string(), projectId: z.string(), name: z.string(), position: z.number() });
export const labelSchema = z.object({ id: z.string(), projectId: z.string(), groupId: z.string().nullable(), name: z.string(), color: z.string() });
export const epicSchema = z.object({
  id: z.string(), projectId: z.string(), title: z.string(), description: z.string(), status: epicStatus,
  ownerUserId: z.string().nullable(), priority: priority.nullable(), startDate: z.string().nullable(), targetDate: z.string().nullable(),
  position: z.number(), createdAt: ts, updatedAt: ts,
});
export const milestoneSchema = z.object({
  id: z.string(), projectId: z.string(), name: z.string(), goal: z.string(), startDate: z.string(), endDate: z.string(),
  completedAt: z.string().nullable(), createdAt: ts, updatedAt: ts,
});
export const projectSchema = z.object({
  id: z.string(), workspaceId: z.string(), spaceId: z.string(), key: z.string(), name: z.string(), description: z.string(), icon: z.string().nullable(),
  pointsEstimateEnabled: z.boolean(), timeEstimateEnabled: z.boolean(), subtasksEnabled: z.boolean(), checklistsEnabled: z.boolean(),
  archivedAt: z.string().nullable(), createdAt: ts, updatedAt: ts,
});
export const ticketSchema = z.object({
  id: z.string(), projectId: z.string(), identifier: z.string(), sequenceNumber: z.number(), typeId: z.string().nullable(), epicId: z.string().nullable(),
  milestoneId: z.string().nullable(), statusId: z.string(), parentId: z.string().nullable(), assigneeUserId: z.string().nullable(),
  title: z.string(), description: z.string(), priority: priority.nullable(), estimatePoints: z.number().nullable(), estimateMinutes: z.number().nullable(),
  startDate: z.string().nullable(), dueDate: z.string().nullable(), position: z.number(), archivedAt: z.string().nullable(),
  labelIds: z.array(z.string()), subtaskCount: z.number(), subtaskDoneCount: z.number(), createdAt: ts, updatedAt: ts,
});
