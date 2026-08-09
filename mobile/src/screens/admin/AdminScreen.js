import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AdminApiService from '../../services/AdminApiService';
import useAdminCheck from '../../hooks/useAdminCheck';
import { useToast } from '../../contexts/ToastContext';
import Logger from '../../utils/logger';
import {
  AdminTabs,
  KpiGrid,
  KpiTile,
  MiniBars,
  SectionHeader,
  AdminListRow,
  Pill,
  CapNotice,
  EmptyState,
} from '../../components/admin/AdminKit';
import { theme } from '../../styles/theme';

const TABS = ['Overview', 'Users', 'Reports', 'Waitlist', 'Config', 'Audit'];

/* ----------------------------- Overview ----------------------------- */

const OverviewSection = ({ refreshKey }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    AdminApiService.getOverview().then(setData).catch(Logger.error);
  }, [refreshKey]);

  if (!data) {
    return <EmptyState message="Loading overview…" />;
  }
  const { totals, rollups, series } = data;
  return (
    <View>
      <KpiGrid>
        <KpiTile label="Users" value={totals.users} />
        <KpiTile label="Active (7d)" value={totals.activeLast7d} />
        <KpiTile label="Premium" value={totals.premium} accent />
        <KpiTile label="Matches" value={totals.activeMatches} />
        <KpiTile label="Pending reports" value={totals.pendingReports} />
        <KpiTile label="Waitlist" value={totals.waitlist} />
      </KpiGrid>
      <SectionHeader
        title="Signups — last 14 days"
        subtitle={`Today ${rollups.today.signups} · Week ${rollups.week.signups} · Month ${rollups.month.signups}`}
      />
      <MiniBars data={series.signups} />
      <SectionHeader
        title="Active users — last 14 days"
        subtitle="Active = sent a message or swiped that day"
      />
      <MiniBars data={series.activeUsers} />
      <SectionHeader
        title="This week"
        subtitle={`${rollups.week.matches} matches · ${rollups.week.messages} messages`}
      />
    </View>
  );
};

/* ------------------------------- Users ------------------------------ */

const UsersSection = ({ refreshKey }) => {
  const [q, setQ] = useState('');
  const [result, setResult] = useState(null);
  const { showSuccess, showError } = useToast();

  const load = useCallback(() => {
    AdminApiService.listUsers({ q }).then(setResult).catch(Logger.error);
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load, refreshKey]);

  const actOn = user => {
    const actions = [
      {
        text: user.isActive ? 'Ban' : 'Unban',
        style: user.isActive ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await (user.isActive
              ? AdminApiService.banUser(user.id)
              : AdminApiService.unbanUser(user.id));
            showSuccess(user.isActive ? 'User banned' : 'User unbanned');
            load();
          } catch (error) {
            showError('Action failed');
          }
        },
      },
      {
        text: user.isPremium ? 'Revoke premium' : 'Grant premium',
        onPress: async () => {
          try {
            await AdminApiService.setPremium(user.id, !user.isPremium);
            showSuccess('Premium updated');
            load();
          } catch (error) {
            showError('Action failed');
          }
        },
      },
      ...(!user.emailVerified
        ? [
            {
              text: 'Mark email verified',
              onPress: async () => {
                try {
                  await AdminApiService.verifyEmail(user.id);
                  showSuccess('Email verified');
                  load();
                } catch (error) {
                  showError('Action failed');
                }
              },
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert(user.name || user.email, user.email, actions);
  };

  return (
    <View>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={theme.colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name or email"
          placeholderTextColor={theme.colors.text.muted}
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
        />
      </View>
      {!result ? (
        <EmptyState message="Loading users…" />
      ) : result.items.length === 0 ? (
        <EmptyState message="No users found" />
      ) : (
        <>
          {result.items.map(user => (
            <AdminListRow
              key={user.id}
              title={user.name || '(no name)'}
              subtitle={user.email}
              onPress={() => actOn(user)}
              right={
                <View style={styles.badgeRow}>
                  {!user.isActive && <Pill label="BANNED" tone="danger" />}
                  {user.isPremium && <Pill label="PRO" tone="premium" />}
                  {user.emailVerified && <Pill label="✓" tone="success" />}
                </View>
              }
            />
          ))}
          <CapNotice shown={result.items.length} total={result.total} />
        </>
      )}
    </View>
  );
};

/* ------------------------------ Reports ----------------------------- */

const ReportsSection = ({ refreshKey }) => {
  const [result, setResult] = useState(null);
  const { showSuccess, showError } = useToast();

  const load = useCallback(() => {
    AdminApiService.listReports('PENDING').then(setResult).catch(Logger.error);
  }, []);

  useEffect(load, [load, refreshKey]);

  const review = report => {
    Alert.alert(
      `Report: ${report.reason}`,
      `${report.reporter?.name || 'Someone'} reported ${report.reportedUser?.name || 'a user'}\n\n${report.description || 'No description'}`,
      [
        {
          text: 'Resolve + ban user',
          style: 'destructive',
          onPress: async () => {
            try {
              await AdminApiService.resolveReport(report.id, { action: 'BAN' });
              showSuccess('Resolved — user banned');
              load();
            } catch (error) {
              showError('Action failed');
            }
          },
        },
        {
          text: 'Resolve (no action)',
          onPress: async () => {
            try {
              await AdminApiService.resolveReport(report.id, { action: 'NONE' });
              showSuccess('Resolved');
              load();
            } catch (error) {
              showError('Action failed');
            }
          },
        },
        {
          text: 'Dismiss',
          onPress: async () => {
            try {
              await AdminApiService.dismissReport(report.id);
              showSuccess('Dismissed');
              load();
            } catch (error) {
              showError('Action failed');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (!result) {
    return <EmptyState message="Loading reports…" />;
  }
  if (result.items.length === 0) {
    return <EmptyState message="No pending reports 🎉" />;
  }
  return (
    <View>
      {result.items.map(report => (
        <AdminListRow
          key={report.id}
          title={`${report.reason} — ${report.reportedUser?.name || 'unknown'}`}
          subtitle={report.description || 'No description'}
          onPress={() => review(report)}
          right={<Pill label="PENDING" tone="danger" />}
        />
      ))}
      <CapNotice shown={result.items.length} total={result.total} />
    </View>
  );
};

/* ------------------------------ Waitlist ---------------------------- */

const WaitlistSection = ({ refreshKey }) => {
  const [result, setResult] = useState(null);

  useEffect(() => {
    AdminApiService.listWaitlist().then(setResult).catch(Logger.error);
  }, [refreshKey]);

  if (!result) {
    return <EmptyState message="Loading waitlist…" />;
  }
  if (result.items.length === 0) {
    return <EmptyState message="No signups yet — share the link!" />;
  }
  return (
    <View>
      <SectionHeader title={`${result.total} signups`} subtitle="Newest first" />
      {result.items.map(row => (
        <AdminListRow
          key={row.id}
          title={row.email}
          subtitle={`${row.name || '—'} · ${row.source || 'direct'} · ${new Date(row.createdAt).toLocaleDateString()}`}
        />
      ))}
      <CapNotice shown={result.items.length} total={result.total} />
    </View>
  );
};

/* ------------------------------- Config ----------------------------- */

const ConfigSection = ({ refreshKey }) => {
  const [versionConfig, setVersionConfig] = useState(null);
  const [minVersion, setMinVersion] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [flags, setFlags] = useState({});
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    AdminApiService.getAppVersionConfig()
      .then(config => {
        setVersionConfig(config);
        setMinVersion(config?.minVersion || '');
        setLatestVersion(config?.latestVersion || '');
        setForceUpdate(!!config?.forceUpdate);
      })
      .catch(Logger.error);
    AdminApiService.getFlags().then(setFlags).catch(Logger.error);
  }, [refreshKey]);

  const publish = async () => {
    try {
      const published = await AdminApiService.publishAppVersion({
        minVersion: minVersion || undefined,
        latestVersion: latestVersion || undefined,
        forceUpdate,
      });
      setVersionConfig(published);
      showSuccess('Version config published');
    } catch (error) {
      showError(error.message || 'Publish failed (downgrades are refused)');
    }
  };

  const toggleFlag = async key => {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next); // optimistic
    try {
      await AdminApiService.updateFlags(next);
      showSuccess('Flags updated');
    } catch (error) {
      setFlags(flags); // revert
      showError('Flag update failed');
    }
  };

  return (
    <View>
      <SectionHeader
        title="App version"
        subtitle={
          versionConfig
            ? `Published: min ${versionConfig.minVersion || '—'} · latest ${versionConfig.latestVersion || '—'}`
            : 'Nothing published yet (env/defaults serving)'
        }
      />
      <View style={styles.configForm}>
        <Text style={styles.configLabel}>Minimum version (force update below this)</Text>
        <TextInput
          style={styles.configInput}
          value={minVersion}
          onChangeText={setMinVersion}
          placeholder="1.0.0"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.configLabel}>Latest version (soft-update banner)</Text>
        <TextInput
          style={styles.configInput}
          value={latestVersion}
          onChangeText={setLatestVersion}
          placeholder="1.0.0"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <View style={styles.switchRow}>
          <Text style={styles.configLabel}>Force update (kill switch)</Text>
          <Switch value={forceUpdate} onValueChange={setForceUpdate} />
        </View>
        <TouchableOpacity style={styles.publishButton} onPress={publish}>
          <Text style={styles.publishButtonText}>Publish</Text>
        </TouchableOpacity>
      </View>

      <SectionHeader title="Feature flags" subtitle="Served to clients within ~60s" />
      {Object.keys(flags).length === 0 ? (
        <EmptyState message="No flags yet — they appear here once set" />
      ) : (
        Object.entries(flags).map(([key, value]) => (
          <View key={key} style={[styles.switchRow, styles.flagRow]}>
            <Text style={styles.flagName}>{key}</Text>
            <Switch value={value} onValueChange={() => toggleFlag(key)} />
          </View>
        ))
      )}
    </View>
  );
};

/* ------------------------------- Audit ------------------------------ */

const AuditSection = ({ refreshKey }) => {
  const [result, setResult] = useState(null);

  useEffect(() => {
    AdminApiService.listAudit().then(setResult).catch(Logger.error);
  }, [refreshKey]);

  if (!result) {
    return <EmptyState message="Loading audit trail…" />;
  }
  if (result.items.length === 0) {
    return <EmptyState message="No admin actions recorded yet" />;
  }
  return (
    <View>
      {result.items.map(row => (
        <AdminListRow
          key={row.id}
          title={row.action}
          subtitle={`${row.adminEmail} · ${new Date(row.createdAt).toLocaleString()}${row.targetId ? ` · ${row.targetType}:${row.targetId.slice(0, 8)}` : ''}`}
        />
      ))}
    </View>
  );
};

/* ------------------------------- Screen ----------------------------- */

const AdminScreen = ({ navigation }) => {
  const isAdmin = useAdminCheck();
  const [tab, setTab] = useState('Overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // Belt-and-braces: the server 404s anyway, but don't render for non-admins
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <EmptyState message="Nothing to see here." />
      </SafeAreaView>
    );
  }

  const sections = {
    Overview: OverviewSection,
    Users: UsersSection,
    Reports: ReportsSection,
    Waitlist: WaitlistSection,
    Config: ConfigSection,
    Audit: AuditSection,
  };
  const Section = sections[tab];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin</Text>
        <View style={styles.backButton} />
      </View>
      <AdminTabs tabs={TABS} active={tab} onChange={setTab} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        <Section refreshKey={refreshKey} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  backButton: { width: 40 },
  headerTitle: {
    fontSize: theme.typography.sizes.xl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
  },
  scrollContent: { paddingBottom: theme.spacing.huge },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
  },
  badgeRow: { flexDirection: 'row', gap: 4 },
  configForm: { paddingHorizontal: theme.spacing.lg },
  configLabel: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.md,
  },
  configInput: {
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  flagRow: {
    marginTop: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  flagName: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.text.primary,
  },
  publishButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  publishButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.bold,
  },
});

export default AdminScreen;
