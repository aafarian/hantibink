/**
 * Admin dashboard service.
 *
 * Conventions (mirrored from the reference consoles this is modeled on):
 * - Every mutation writes an AdminAuditLog row, best-effort — an audit
 *   failure never fails the action.
 * - Every capped read reports whether it hit the cap so the UI can say
 *   "showing first N" instead of silently truncating.
 */

const { Prisma } = require('@prisma/client');
const { getPrismaClient } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const prisma = getPrismaClient();

const MAX_USERS_PAGE = 50;
const MAX_REPORTS_PAGE = 50;
const MAX_WAITLIST_PAGE = 100;
const MAX_AUDIT_PAGE = 100;
const MAX_WAITLIST_EXPORT = 5000;
const SERIES_DAYS = 14;

/**
 * Append-only audit trail; never throws.
 */
const auditLog = async (adminEmail, action, targetType = null, targetId = null, payload = null) => {
  try {
    await prisma.adminAuditLog.create({
      data: { adminEmail, action, targetType, targetId, payload },
    });
  } catch (error) {
    logger.error('Admin audit write failed (action still applied):', error);
  }
};

/**
 * Overview KPIs: totals, today/7d/30d rollups, and 14-day series.
 * DAU is a proxy (distinct users who messaged or swiped that day) because
 * lastActive is overwritten in place and carries no history.
 */
const getOverview = async () => {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const d1 = new Date(now.getTime() - dayMs);
  const d7 = new Date(now.getTime() - 7 * dayMs);
  const d30 = new Date(now.getTime() - 30 * dayMs);

  const [
    totalUsers,
    activeLast7d,
    premiumUsers,
    activeMatches,
    pendingReports,
    waitlistCount,
    signupsToday,
    signupsWeek,
    signupsMonth,
    matchesToday,
    matchesWeek,
    messagesToday,
    messagesWeek,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastActive: { gte: d7 } } }),
    prisma.user.count({ where: { isPremium: true } }),
    prisma.match.count({ where: { isActive: true } }),
    prisma.report.count({ where: { status: 'PENDING' } }),
    prisma.waitlist.count(),
    prisma.user.count({ where: { createdAt: { gte: d1 } } }),
    prisma.user.count({ where: { createdAt: { gte: d7 } } }),
    prisma.user.count({ where: { createdAt: { gte: d30 } } }),
    prisma.match.count({ where: { createdAt: { gte: d1 } } }),
    prisma.match.count({ where: { createdAt: { gte: d7 } } }),
    prisma.message.count({ where: { createdAt: { gte: d1 } } }),
    prisma.message.count({ where: { createdAt: { gte: d7 } } }),
  ]);

  // 14-day signup series + DAU proxy (messages ∪ actions), zero-filled
  const [signupRows, dauRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count
      FROM "users"
      WHERE "createdAt" >= now() - interval '14 days'
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw`
      SELECT to_char(day, 'YYYY-MM-DD') AS day, COUNT(DISTINCT uid)::int AS count
      FROM (
        SELECT date_trunc('day', "createdAt") AS day, "senderId" AS uid
        FROM "messages" WHERE "createdAt" >= now() - interval '14 days'
        UNION ALL
        SELECT date_trunc('day', "createdAt") AS day, "senderId" AS uid
        FROM "user_actions" WHERE "createdAt" >= now() - interval '14 days'
      ) t GROUP BY 1 ORDER BY 1`,
  ]);

  const zeroFill = (rows) => {
    const byDay = new Map(rows.map((r) => [r.day, r.count]));
    const series = [];
    for (let i = SERIES_DAYS - 1; i >= 0; i--) {
      const day = new Date(now.getTime() - i * dayMs).toISOString().slice(0, 10);
      series.push({ day, count: byDay.get(day) || 0 });
    }
    return series;
  };

  return {
    totals: {
      users: totalUsers,
      activeLast7d,
      premium: premiumUsers,
      activeMatches,
      pendingReports,
      waitlist: waitlistCount,
    },
    rollups: {
      today: { signups: signupsToday, matches: matchesToday, messages: messagesToday },
      week: { signups: signupsWeek, matches: matchesWeek, messages: messagesWeek },
      month: { signups: signupsMonth },
    },
    series: {
      signups: zeroFill(signupRows),
      // Labeled honestly in the UI: "active = messaged or swiped"
      activeUsers: zeroFill(dauRows),
    },
  };
};

const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  lastActive: true,
  isActive: true,
  isPremium: true,
  emailVerified: true,
  onboardingStage: true,
  mainPhotoUrl: true,
};

const listUsers = async ({ q = '', cursor = null, limit = MAX_USERS_PAGE } = {}) => {
  const take = Math.min(Number(limit) || MAX_USERS_PAGE, MAX_USERS_PAGE);
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    select: ADMIN_USER_SELECT,
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = users.length > take;
  const items = hasMore ? users.slice(0, take) : users;
  const total = await prisma.user.count({ where });

  return {
    items,
    total,
    capped: hasMore,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
};

const getUserDetail = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...ADMIN_USER_SELECT,
      bio: true,
      gender: true,
      birthDate: true,
      location: true,
      isDiscoverable: true,
      isProfilePaused: true,
      registrationMethod: true,
      _count: {
        select: {
          photos: true,
          matchesAsUser1: true,
          matchesAsUser2: true,
          sentMessages: true,
          reportsReceived: true,
          reportsFiled: true,
          actionsSent: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};

/**
 * Best-effort socket eviction after a ban — never fails the mutation.
 */
const forceLogoutUser = (userId, io) => {
  if (!io) {
    return;
  }
  try {
    io.to(`user:${userId}`).emit('force-logout', { code: 'ACCOUNT_DISABLED' });
    io.in(`user:${userId}`).disconnectSockets(true);
  } catch (error) {
    logger.warn('Could not disconnect banned user sockets:', error.message);
  }
};

/**
 * Ban / unban. Banning disconnects live sockets and emits force-logout;
 * authenticateJWT rejects inactive users on the next request either way.
 */
const setUserActive = async (userId, isActive, adminEmail, io = null) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: { id: true, email: true, isActive: true },
  });

  await auditLog(adminEmail, isActive ? 'user.unban' : 'user.ban', 'user', userId);

  if (!isActive) {
    forceLogoutUser(userId, io);
  }

  return user;
};

const setUserPremium = async (userId, isPremium, adminEmail) => {
  let user;
  if (isPremium) {
    // activatePremium flips the flag and resets the Super Like accrual
    // clock in one write — a concurrent quota read can never back-accrue
    // free-era days — then seeds the day-one bank
    const { activatePremium } = require('./premiumService');
    await activatePremium(userId);
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isPremium: true },
    });
  } else {
    user = await prisma.user.update({
      where: { id: userId },
      data: { isPremium: false },
      select: { id: true, email: true, isPremium: true },
    });
  }
  await auditLog(adminEmail, isPremium ? 'user.premium.grant' : 'user.premium.revoke', 'user', userId);
  return user;
};

const verifyUserEmail = async (userId, adminEmail) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    },
    select: { id: true, email: true, emailVerified: true },
  });
  await auditLog(adminEmail, 'user.email.verify', 'user', userId);
  return user;
};

const deleteUser = async (userId, adminEmail) => {
  // Same cascade semantics as DELETE /users/account
  await prisma.user.delete({ where: { id: userId } });
  await auditLog(adminEmail, 'user.delete', 'user', userId);
  return { deleted: true };
};

const REPORT_INCLUDE = {
  reporter: { select: { id: true, name: true, email: true } },
  reportedUser: { select: { id: true, name: true, email: true, isActive: true } },
};

const listReports = async ({ status = null, cursor = null, limit = MAX_REPORTS_PAGE } = {}) => {
  const take = Math.min(Number(limit) || MAX_REPORTS_PAGE, MAX_REPORTS_PAGE);
  const where = status ? { status } : {};

  const reports = await prisma.report.findMany({
    where,
    include: REPORT_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = reports.length > take;
  const items = hasMore ? reports.slice(0, take) : reports;
  const total = await prisma.report.count({ where });

  return { items, total, capped: hasMore, nextCursor: hasMore ? items[items.length - 1].id : null };
};

/**
 * v1 report lifecycle: PENDING -> RESOLVED | DISMISSED (no triage state
 * for a solo admin). Resolving with action=BAN chains the ban flow.
 */
const reviewReport = async (reportId, { outcome, action = 'NONE', adminNotes = null }, adminEmail, io = null) => {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new AppError('Report not found', 404);
  }

  const shouldBan = outcome === 'RESOLVED' && action === 'BAN';

  // The updateMany status guard makes concurrent reviews lose cleanly
  // instead of overwriting each other, and a failed ban rolls the report
  // back to PENDING rather than committing a resolution without the ban.
  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.report.updateMany({
      where: { id: reportId, status: 'PENDING' },
      data: {
        status: outcome,
        reviewedBy: adminEmail,
        reviewedAt: new Date(),
        adminNotes,
      },
    });
    if (claimed.count === 0) {
      throw new AppError('Report has already been reviewed', 409);
    }

    if (shouldBan) {
      await tx.user.update({
        where: { id: report.reportedId },
        data: { isActive: false },
      });
    }

    return tx.report.findUnique({ where: { id: reportId }, include: REPORT_INCLUDE });
  });

  await auditLog(adminEmail, `report.${outcome.toLowerCase()}`, 'report', reportId, {
    action,
    adminNotes,
  });

  if (shouldBan) {
    await auditLog(adminEmail, 'user.ban', 'user', report.reportedId);
    forceLogoutUser(report.reportedId, io);
  }

  return updated;
};

const listWaitlist = async ({ cursor = null, limit = MAX_WAITLIST_PAGE } = {}) => {
  const take = Math.min(Number(limit) || MAX_WAITLIST_PAGE, MAX_WAITLIST_PAGE);
  const rows = await prisma.waitlist.findMany({
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  const total = await prisma.waitlist.count();
  return { items, total, capped: hasMore, nextCursor: hasMore ? items[items.length - 1].id : null };
};

const exportWaitlistCsv = async () => {
  const rows = await prisma.waitlist.findMany({
    orderBy: { createdAt: 'asc' },
    take: MAX_WAITLIST_EXPORT,
  });
  const escape = (value) => {
    const s = value == null ? '' : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = 'email,name,source,createdAt';
  const lines = rows.map((r) =>
    [r.email, r.name, r.source, r.createdAt.toISOString()].map(escape).join(','),
  );
  const total = await prisma.waitlist.count();
  return {
    csv: [header, ...lines].join('\n'),
    capped: total > MAX_WAITLIST_EXPORT,
    count: rows.length,
  };
};

/** Tolerant dotted-numeric compare (mirror of the mobile util). */
const compareVersions = (a, b) => {
  const pa = String(a ?? '').split('.');
  const pb = String(b ?? '').split('.');
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = Number(pa[i] ?? '0');
    const nb = Number(pb[i] ?? '0');
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      if (na !== nb) {
        return na < nb ? -1 : 1;
      }
    } else if ((pa[i] ?? '0') !== (pb[i] ?? '0')) {
      return (pa[i] ?? '0') < (pb[i] ?? '0') ? -1 : 1;
    }
  }
  return 0;
};

const VERSION_REGEX = /^\d+(\.\d+){0,3}$/;

const getAppVersionConfig = async () => {
  const row = await prisma.appConfig.findUnique({ where: { key: 'app_version' } });
  return row?.value || null;
};

/**
 * Publish app-version config. Refuses to roll minVersion/latestVersion
 * backwards (a downgrade would nag or brick the whole fleet). Omitted
 * fields keep their current values — a minVersion-only publish must not
 * silently clear an active force-update policy or its message.
 */
const updateAppVersionConfig = async (input, adminEmail) => {
  const { minVersion, latestVersion, forceUpdate, updateMessage, storeUrls } = input;

  for (const [label, value] of [
    ['minVersion', minVersion],
    ['latestVersion', latestVersion],
  ]) {
    if (value && !VERSION_REGEX.test(value)) {
      throw new AppError(`Invalid ${label}: must be dotted-numeric (e.g. 1.2.3)`, 400);
    }
  }

  // Serializable so two overlapping publishes can't both validate against
  // the same stale row — the loser aborts (P2034) and retries against the
  // winner's committed state, keeping the no-downgrade guarantee.
  const publish = () =>
    prisma.$transaction(
      async (tx) => {
        const row = await tx.appConfig.findUnique({ where: { key: 'app_version' } });
        const current = row?.value || null;

        if (current) {
          if (minVersion && current.minVersion && compareVersions(minVersion, current.minVersion) < 0) {
            throw new AppError('Refusing version downgrade of minVersion', 400);
          }
          if (
            latestVersion &&
            current.latestVersion &&
            compareVersions(latestVersion, current.latestVersion) < 0
          ) {
            throw new AppError('Refusing version downgrade of latestVersion', 400);
          }
        }

        const value = {
          ...(current || {}),
          ...(minVersion ? { minVersion } : {}),
          ...(latestVersion ? { latestVersion } : {}),
          ...(Object.prototype.hasOwnProperty.call(input, 'forceUpdate')
            ? { forceUpdate: !!forceUpdate }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, 'updateMessage')
            ? { updateMessage }
            : {}),
          ...(storeUrls ? { storeUrls } : {}),
        };

        const saved = await tx.appConfig.upsert({
          where: { key: 'app_version' },
          update: { value },
          create: { key: 'app_version', value },
        });
        return saved.value;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

  let value;
  try {
    value = await publish();
  } catch (error) {
    if (error.code !== 'P2034') {
      throw error;
    }
    value = await publish();
  }

  await auditLog(adminEmail, 'config.appVersion.update', 'appConfig', 'app_version', value);
  return value;
};

const getFlags = async () => {
  const row = await prisma.appConfig.findUnique({ where: { key: 'feature_flags' } });
  return row?.value || {};
};

const updateFlags = async (flags, adminEmail) => {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    throw new AppError('Flags must be an object of key -> boolean', 400);
  }
  for (const [key, value] of Object.entries(flags)) {
    if (typeof value !== 'boolean') {
      throw new AppError(`Flag "${key}" must be a boolean`, 400);
    }
  }

  const row = await prisma.appConfig.upsert({
    where: { key: 'feature_flags' },
    update: { value: flags },
    create: { key: 'feature_flags', value: flags },
  });

  await auditLog(adminEmail, 'config.flags.update', 'appConfig', 'feature_flags', flags);
  return row.value;
};

const listAudit = async ({ cursor = null, limit = MAX_AUDIT_PAGE } = {}) => {
  const take = Math.min(Number(limit) || MAX_AUDIT_PAGE, MAX_AUDIT_PAGE);
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return { items, capped: hasMore, nextCursor: hasMore ? items[items.length - 1].id : null };
};

/**
 * Adds operation context to unexpected failures before they reach the
 * route-level handler. Expected AppErrors (404/409/400) pass through
 * silently — they're outcomes, not diagnostics.
 */
const withContext = (operation, fn) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error(`Admin ${operation} failed:`, error);
      }
      throw error;
    }
  };
};

module.exports = {
  auditLog,
  getOverview: withContext('overview read', getOverview),
  listUsers: withContext('user list', listUsers),
  getUserDetail: withContext('user detail read', getUserDetail),
  setUserActive: withContext('user ban/unban', setUserActive),
  setUserPremium: withContext('premium update', setUserPremium),
  verifyUserEmail: withContext('email verify', verifyUserEmail),
  deleteUser: withContext('user delete', deleteUser),
  listReports: withContext('report list', listReports),
  reviewReport: withContext('report review', reviewReport),
  listWaitlist: withContext('waitlist list', listWaitlist),
  exportWaitlistCsv: withContext('waitlist export', exportWaitlistCsv),
  getAppVersionConfig: withContext('app-version read', getAppVersionConfig),
  updateAppVersionConfig: withContext('app-version publish', updateAppVersionConfig),
  getFlags: withContext('flags read', getFlags),
  updateFlags: withContext('flags update', updateFlags),
  listAudit: withContext('audit list', listAudit),
};
