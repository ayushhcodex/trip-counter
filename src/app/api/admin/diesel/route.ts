import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDieselTable } from '@/db';
import { dieselEntries, vehicles, users, notifications, adminVehicleAssignments } from '@/db/schema';
import { eq, and, desc, gte, lte, inArray } from 'drizzle-orm';
import { checkAuth } from '@/lib/api-middlewares';
import { logAudit } from '@/lib/audit';
import { getLocalDateString } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['ADMIN', 'SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    await ensureDieselTable();
    const url = new URL(req.url);
    const driverId = url.searchParams.get('driverId');
    const vehicleId = url.searchParams.get('vehicleId');
    const date = url.searchParams.get('date');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // 1. Fetch available vehicles for this admin
    let accessibleVehicles;
    if (actor!.role === 'SUPER_ADMIN') {
      accessibleVehicles = await db.select().from(vehicles);
    } else {
      accessibleVehicles = await db
        .select({
          id: vehicles.id,
          vehicleNumber: vehicles.vehicleNumber,
          status: vehicles.status,
          createdAt: vehicles.createdAt,
          updatedAt: vehicles.updatedAt,
        })
        .from(vehicles)
        .innerJoin(adminVehicleAssignments, eq(vehicles.id, adminVehicleAssignments.vehicleId))
        .where(eq(adminVehicleAssignments.adminId, actor!.userId));
    }

    const vehicleIds = accessibleVehicles.map((v) => v.id);

    // Fetch list of drivers for admin options
    const driverUsers = await db
      .select({
        id: users.id,
        name: users.name,
        usernameOrEmail: users.usernameOrEmail,
      })
      .from(users)
      .where(eq(users.role, 'DRIVER'));

    // If an ADMIN has no assigned vehicles, return empty list safely
    if (actor!.role === 'ADMIN' && vehicleIds.length === 0) {
      return NextResponse.json({
        success: true,
        entries: [],
        vehicles: [],
        drivers: driverUsers,
      });
    }

    // If an ADMIN specifies a vehicleId they are not assigned to, reject access
    if (actor!.role === 'ADMIN' && vehicleId && !vehicleIds.includes(vehicleId)) {
      return NextResponse.json({
        success: true,
        entries: [],
        vehicles: accessibleVehicles,
        drivers: driverUsers,
      });
    }

    // 2. Query diesel entries with SQL-level constraints
    let query = db
      .select({
        id: dieselEntries.id,
        driverId: dieselEntries.driverId,
        vehicleId: dieselEntries.vehicleId,
        adminId: dieselEntries.adminId,
        date: dieselEntries.date,
        litres: dieselEntries.litres,
        notes: dieselEntries.notes,
        createdAt: dieselEntries.createdAt,
        updatedAt: dieselEntries.updatedAt,
        driverName: users.name,
        driverUsername: users.usernameOrEmail,
        vehicleNumber: vehicles.vehicleNumber,
      })
      .from(dieselEntries)
      .innerJoin(users, eq(dieselEntries.driverId, users.id))
      .leftJoin(vehicles, eq(dieselEntries.vehicleId, vehicles.id))
      .$dynamic();

    const conditions = [];

    // Push vehicle authorization into SQL query
    if (actor!.role === 'ADMIN') {
      if (vehicleId) {
        conditions.push(eq(dieselEntries.vehicleId, vehicleId));
      } else {
        conditions.push(inArray(dieselEntries.vehicleId, vehicleIds));
      }
    } else if (vehicleId) {
      conditions.push(eq(dieselEntries.vehicleId, vehicleId));
    }

    if (driverId) {
      conditions.push(eq(dieselEntries.driverId, driverId));
    }
    if (date) {
      conditions.push(eq(dieselEntries.date, date));
    } else {
      if (startDate) conditions.push(gte(dieselEntries.date, startDate));
      if (endDate) conditions.push(lte(dieselEntries.date, endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const entries = await query.orderBy(desc(dieselEntries.date), desc(dieselEntries.createdAt));

    return NextResponse.json({
      success: true,
      entries,
      vehicles: accessibleVehicles,
      drivers: driverUsers,
    });
  } catch (error) {
    console.error('[ADMIN_DIESEL_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to retrieve diesel entries.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['ADMIN', 'SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    await ensureDieselTable();
    const body = await req.json().catch(() => ({}));
    const { driverId, vehicleId, date, litres, notes, id: entryId } = body;

    const parsedLitres = parseFloat(litres);
    if (!driverId || isNaN(parsedLitres) || parsedLitres <= 0 || parsedLitres > 1500) {
      return NextResponse.json(
        { error: 'Driver ID and a valid positive litres amount (up to 1,500 L) are required.' },
        { status: 400 }
      );
    }

    const entryDate = date || getLocalDateString(new Date());
    const litresVal = parsedLitres.toFixed(2);

    // Verify target driver exists
    const [driver] = await db.select().from(users).where(eq(users.id, driverId)).limit(1);
    if (!driver || driver.role !== 'DRIVER') {
      return NextResponse.json({ error: 'Target driver not found.' }, { status: 404 });
    }

    // Verify vehicle if provided
    let vehicleNum = '';
    if (vehicleId) {
      const [v] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
      if (!v) {
        return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
      }
      vehicleNum = v.vehicleNumber;

      // Ensure ADMIN has assignment to this vehicle
      if (actor!.role === 'ADMIN') {
        const [assigned] = await db
          .select()
          .from(adminVehicleAssignments)
          .where(
            and(
              eq(adminVehicleAssignments.adminId, actor!.userId),
              eq(adminVehicleAssignments.vehicleId, vehicleId)
            )
          )
          .limit(1);

        if (!assigned) {
          return NextResponse.json(
            { error: 'You are not authorized to record diesel for this vehicle.' },
            { status: 403 }
          );
        }
      }
    }

    let savedEntry;

    if (entryId) {
      // Fetch existing entry to verify ownership
      const [existing] = await db
        .select()
        .from(dieselEntries)
        .where(eq(dieselEntries.id, entryId))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: 'Diesel entry not found.' }, { status: 404 });
      }

      // Check if ADMIN was assigned to the existing vehicle
      if (actor!.role === 'ADMIN' && existing.vehicleId) {
        const [assignedExisting] = await db
          .select()
          .from(adminVehicleAssignments)
          .where(
            and(
              eq(adminVehicleAssignments.adminId, actor!.userId),
              eq(adminVehicleAssignments.vehicleId, existing.vehicleId)
            )
          )
          .limit(1);

        if (!assignedExisting) {
          return NextResponse.json(
            { error: 'You do not have permission to modify this diesel entry.' },
            { status: 403 }
          );
        }
      }

      // Update existing entry
      const [updated] = await db
        .update(dieselEntries)
        .set({
          driverId,
          vehicleId: vehicleId || null,
          date: entryDate,
          litres: litresVal,
          notes: notes || null,
          adminId: actor!.userId,
          updatedAt: new Date(),
        })
        .where(eq(dieselEntries.id, entryId))
        .returning();
      savedEntry = updated;
    } else {
      // Create new entry
      const [inserted] = await db
        .insert(dieselEntries)
        .values({
          driverId,
          vehicleId: vehicleId || null,
          adminId: actor!.userId,
          date: entryDate,
          litres: litresVal,
          notes: notes || null,
        })
        .returning();
      savedEntry = inserted;
    }

    // Notify driver about the diesel update
    await db.insert(notifications).values({
      userId: driverId,
      type: 'DIESEL_UPDATE',
      title: 'Diesel Log Updated',
      message: `Admin recorded ${litresVal} Litres of diesel for ${entryDate}${vehicleNum ? ` (${vehicleNum})` : ''}.`,
      relatedEntityId: savedEntry.id,
    });

    // Audit log
    await logAudit({
      actorUserId: actor!.userId,
      action: entryId ? 'DIESEL_ENTRY_UPDATED' : 'DIESEL_ENTRY_CREATED',
      entityType: 'diesel_entries',
      entityId: savedEntry.id,
      metadata: { driverId, date: entryDate, litres: litresVal, vehicleId, notes },
    });

    return NextResponse.json({
      success: true,
      entry: savedEntry,
      message: `Diesel entry of ${litresVal} Litres recorded for ${driver.name}.`,
    });
  } catch (error) {
    console.error('[ADMIN_DIESEL_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to record diesel entry.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { user: actor, errorResponse } = await checkAuth(['ADMIN', 'SUPER_ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    await ensureDieselTable();
    const body = await req.json().catch(() => ({}));
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Entry ID is required.' }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(dieselEntries)
      .where(eq(dieselEntries.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Diesel entry not found.' }, { status: 404 });
    }

    // Verify ADMIN vehicle assignment
    if (actor!.role === 'ADMIN' && existing.vehicleId) {
      const [assigned] = await db
        .select()
        .from(adminVehicleAssignments)
        .where(
          and(
            eq(adminVehicleAssignments.adminId, actor!.userId),
            eq(adminVehicleAssignments.vehicleId, existing.vehicleId)
          )
        )
        .limit(1);

      if (!assigned) {
        return NextResponse.json(
          { error: 'You do not have permission to delete this diesel entry.' },
          { status: 403 }
        );
      }
    }

    const [deleted] = await db
      .delete(dieselEntries)
      .where(eq(dieselEntries.id, id))
      .returning();

    // Notify driver about the deletion
    await db.insert(notifications).values({
      userId: existing.driverId,
      type: 'DIESEL_DELETED',
      title: 'Diesel Entry Removed',
      message: `Admin removed the diesel record of ${existing.litres} Litres for ${existing.date}.`,
      relatedEntityId: existing.id,
    });

    await logAudit({
      actorUserId: actor!.userId,
      action: 'DIESEL_ENTRY_DELETED',
      entityType: 'diesel_entries',
      entityId: id,
      metadata: { deleted },
    });

    return NextResponse.json({
      success: true,
      message: 'Diesel entry removed successfully.',
    });
  } catch (error) {
    console.error('[ADMIN_DIESEL_DELETE_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to delete diesel entry.' },
      { status: 500 }
    );
  }
}

