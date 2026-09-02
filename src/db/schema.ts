import { pgTable, uuid, varchar, timestamp, integer, pgEnum, date, jsonb, index, unique } from 'drizzle-orm/pg-core';

// Role and Status Enums
export const userRoleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'ADMIN', 'DRIVER']);
export const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'LEAVE', 'INACTIVE']);
export const vehicleStatusEnum = pgEnum('vehicle_status', ['ACTIVE', 'BREAKDOWN', 'INACTIVE']);
export const verificationStatusEnum = pgEnum('verification_status', ['UNVERIFIED', 'VERIFIED']);

// 1. Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  usernameOrEmail: varchar('username_or_email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  status: userStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Vehicles Table
export const vehicles = pgTable('vehicles', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleNumber: varchar('vehicle_number', { length: 100 }).unique().notNull(),
  status: vehicleStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Vehicle Driver Assignments Table (Historical assignment log)
export const vehicleDriverAssignments = pgTable('vehicle_driver_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }).notNull(),
  driverId: uuid('driver_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  slot: integer('slot').notNull(), // 1 or 2
  startAt: timestamp('start_at', { withTimezone: true }).defaultNow().notNull(),
  endAt: timestamp('end_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. Admin Vehicle Assignments Table (Many-to-Many)
export const adminVehicleAssignments = pgTable('admin_vehicle_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  adminId: uuid('admin_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique().on(table.adminId, table.vehicleId)
]);

// 5. Trips Table
export const trips = pgTable('trips', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'restrict' }).notNull(),
  driverId: uuid('driver_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).unique().notNull(),
}, (table) => [
  index('idx_trips_completed_at').on(table.completedAt),
  index('idx_trips_driver_completed_at').on(table.driverId, table.completedAt),
  index('idx_trips_vehicle_completed_at').on(table.vehicleId, table.completedAt),
]);

// 6. Trip Adjustments Table
export const tripAdjustments = pgTable('trip_adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'restrict' }).notNull(),
  date: date('date').notNull(), // Format YYYY-MM-DD
  driverId: uuid('driver_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  adminId: uuid('admin_id').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  adjustment: integer('adjustment').notNull(), // e.g. +2, -2
  reason: varchar('reason', { length: 1000 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_adjustments_vehicle_date').on(table.vehicleId, table.date),
  index('idx_adjustments_driver_date').on(table.driverId, table.date),
]);

// 7. Trip Adjustment Acknowledgements Table
export const tripAdjustmentAcknowledgements = pgTable('trip_adjustment_acknowledgements', {
  id: uuid('id').defaultRandom().primaryKey(),
  adjustmentId: uuid('adjustment_id').references(() => tripAdjustments.id, { onDelete: 'cascade' }).notNull(),
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique().on(table.adjustmentId, table.acknowledgedBy)
]);

// 8. Daily Vehicle Verifications Table
export const dailyVehicleVerifications = pgTable('daily_vehicle_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'restrict' }).notNull(),
  date: date('date').notNull(),
  reportedTripCount: integer('reported_trip_count').default(0).notNull(),
  adjustmentTotal: integer('adjustment_total').default(0).notNull(),
  verifiedTripCount: integer('verified_trip_count').default(0).notNull(),
  status: verificationStatusEnum('status').default('UNVERIFIED').notNull(),
  verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'restrict' }).notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).defaultNow().notNull(),
  note: varchar('note', { length: 1000 }),
}, (table) => [
  unique().on(table.vehicleId, table.date),
  index('idx_verifications_vehicle_date').on(table.vehicleId, table.date),
]);

// 9. Notifications Table
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 100 }).notNull(), // e.g., 'TRIP_ADJUSTMENT'
  title: varchar('title', { length: 255 }).notNull(),
  message: varchar('message', { length: 1000 }).notNull(),
  relatedEntityId: uuid('related_entity_id'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 10. Audit Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
