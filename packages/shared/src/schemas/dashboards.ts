import { z } from 'zod';
import { WIDGET_TYPES } from '../constants';

export const widgetLayoutItemSchema = z.object({
  widgetId: z.string().uuid(),
  widgetCode: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(12),
  minW: z.number().int().optional(),
  minH: z.number().int().optional(),
  config: z.record(z.unknown()).optional(),
});

export type WidgetLayoutItem = z.infer<typeof widgetLayoutItemSchema>;

export const dashboardLayoutSaveSchema = z.object({
  dashboardId: z.string().uuid().optional(),
  name: z.string().max(100).default('Mi Dashboard Principal'),
  items: z.array(widgetLayoutItemSchema),
});

export type DashboardLayoutSaveInput = z.infer<typeof dashboardLayoutSaveSchema>;

export const widgetCatalogItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  module: z.string(),
  title: z.string(),
  description: z.string().optional(),
  type: z.nativeEnum(WIDGET_TYPES),
  configJson: z.record(z.unknown()).optional(),
  defaultWidth: z.number().int().default(4),
  defaultHeight: z.number().int().default(3),
  requiredPermission: z.string(), // Ej: sales.read, inventory.read, treasury.read
  isDefault: z.boolean().default(false),
});

export type WidgetCatalogItem = z.infer<typeof widgetCatalogItemSchema>;
