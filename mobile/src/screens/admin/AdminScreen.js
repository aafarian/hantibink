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
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AdminApiService from '../../services/AdminApiService';
import useAdminCheck from '../../hooks/useAdminCheck';
import { useToast } from '../../contexts/ToastContext';
import Logger from '../../utils/logger';
import { getUserAge } from '../../utils/profileHelpers';
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

const TABS = ['Overview', 'Users', 'Reports', 'Verifications', 'Waitlist', 'Config', 'Audit'];

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

/* --------------------------- Verifications -------------------------- */

// Sort a verification item's photos main-first
const sortPhotosMainFirst = photos =>
  [...(photos || [])].sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));

const VerificationReviewModal = ({ item, actingOn, onReview, onClose }) => {
  if (!item) {
    return null;
  }

  const age = getUserAge(item);
  const allPhotos = sortPhotosMainFirst(item.photos);
  const details = [
    { label: 'Gender', value: item.gender },
    { label: 'Location', value: item.location },
    { label: 'Bio', value: item.bio },
    { label: 'Profession', value: item.profession },
    { label: 'Education', value: item.education },
    { label: 'Languages', value: item.languages?.length ? item.languages.join(', ') : null },
  ].filter(field => field.value);
  const acting = actingOn === item.id;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!acting) {
          onClose();
        }
      }}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop - sibling of the content, NOT a wrapper (keeps ScrollView scrollable) */}
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            if (!acting) {
              onClose();
            }
          }}
        />
        <View style={styles.modalContent}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            <Image source={{ uri: item.verificationPhotoUrl }} style={styles.modalSelfie} />
            <Text style={styles.modalSelfieLabel}>Verification selfie</Text>

            {allPhotos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modalPhotoStrip}
              >
                {allPhotos.map(photo => (
                  <View key={photo.url} style={styles.modalPhotoItem}>
                    <Image source={{ uri: photo.url }} style={styles.modalPhoto} />
                    <Text style={styles.verificationPhotoLabel}>
                      {photo.isMain ? 'Main photo' : 'Profile'}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <Text style={styles.modalName}>
              {item.name || '(no name)'}
              {age ? `, ${age}` : ''}
            </Text>
            {details.map(field => (
              <View key={field.label} style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>{field.label}</Text>
                <Text style={styles.modalDetailValue}>{field.value}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Pinned actions below the scroll */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.verificationButton, styles.approveButton]}
              onPress={() => onReview(item, 'APPROVE')}
              disabled={acting}
            >
              <Text style={styles.verificationButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.verificationButton, styles.rejectButton]}
              onPress={() => onReview(item, 'REJECT')}
              disabled={acting}
            >
              <Text style={styles.verificationButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.modalCancelButton} onPress={onClose} disabled={acting}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const VerificationsSection = ({ refreshKey }) => {
  const [result, setResult] = useState(null);
  const [actingOn, setActingOn] = useState(null); // userId currently being reviewed
  const [reviewItem, setReviewItem] = useState(null); // item open in the review modal
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    AdminApiService.listVerifications().then(setResult).catch(Logger.error);
  }, [refreshKey]);

  const review = async (item, action) => {
    setActingOn(item.id);
    try {
      await AdminApiService.reviewVerification(item.id, action);
      setResult(prev =>
        prev ? { ...prev, items: prev.items.filter(row => row.id !== item.id) } : prev
      );
      showSuccess(action === 'APPROVE' ? 'Verification approved' : 'Verification rejected');
      return true;
    } catch (error) {
      showError(error.message || 'Action failed');
      return false;
    } finally {
      setActingOn(null);
    }
  };

  const reviewFromModal = async (item, action) => {
    const ok = await review(item, action);
    if (ok) {
      setReviewItem(null);
    }
  };

  if (!result) {
    return <EmptyState message="Loading verifications…" />;
  }
  if (result.items.length === 0) {
    return <EmptyState message="No pending verifications 🎉" />;
  }
  return (
    <View>
      {result.items.map(item => {
        // Selfie first, then up to 2 profile photos (main photo leading)
        const profilePhotos = sortPhotosMainFirst(item.photos).slice(0, 2);
        return (
          <TouchableOpacity
            key={item.id}
            style={styles.verificationCard}
            onPress={() => setReviewItem(item)}
            activeOpacity={0.8}
          >
            <View style={styles.verificationPhotos}>
              <View>
                <Image
                  source={{ uri: item.verificationPhotoUrl }}
                  style={styles.verificationPhoto}
                />
                <Text style={styles.verificationPhotoLabel}>Selfie</Text>
              </View>
              {profilePhotos.map(photo => (
                <View key={photo.url}>
                  <Image source={{ uri: photo.url }} style={styles.verificationPhoto} />
                  <Text style={styles.verificationPhotoLabel}>
                    {photo.isMain ? 'Main photo' : 'Profile'}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.verificationName}>{item.name || '(no name)'}</Text>
            <Text style={styles.verificationMeta}>
              {item.email}
              {item.verificationSubmittedAt
                ? ` · ${new Date(item.verificationSubmittedAt).toLocaleString()}`
                : ''}
            </Text>
            <View style={styles.verificationActions}>
              <TouchableOpacity
                style={[styles.verificationButton, styles.approveButton]}
                onPress={() => review(item, 'APPROVE')}
                disabled={actingOn === item.id}
              >
                <Text style={styles.verificationButtonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.verificationButton, styles.rejectButton]}
                onPress={() => review(item, 'REJECT')}
                disabled={actingOn === item.id}
              >
                <Text style={styles.verificationButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}
      <VerificationReviewModal
        item={reviewItem}
        actingOn={actingOn}
        onReview={reviewFromModal}
        onClose={() => setReviewItem(null)}
      />
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
  const [iosLatest, setIosLatest] = useState('');
  const [androidLatest, setAndroidLatest] = useState('');
  const [loadedPlatformLatest, setLoadedPlatformLatest] = useState({ ios: '', android: '' });
  const [flags, setFlags] = useState({});
  const [freeLikes, setFreeLikes] = useState('');
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoTrialDays, setPromoTrialDays] = useState('');
  const [promoWaitlistOnly, setPromoWaitlistOnly] = useState(false);
  const { showSuccess, showError } = useToast();

  const applyVersionConfig = config => {
    setVersionConfig(config);
    setMinVersion(config?.minVersion || '');
    setLatestVersion(config?.latestVersion || '');
    setForceUpdate(!!config?.forceUpdate);
    const ios = config?.platforms?.ios?.latestVersion || '';
    const android = config?.platforms?.android?.latestVersion || '';
    setIosLatest(ios);
    setAndroidLatest(android);
    setLoadedPlatformLatest({ ios, android });
  };

  const applyQuotasConfig = config => {
    setFreeLikes(
      config?.freeLikesPerWindow !== null && config?.freeLikesPerWindow !== undefined
        ? String(config.freeLikesPerWindow)
        : ''
    );
  };

  const applyLaunchPromoConfig = config => {
    setPromoEnabled(!!config?.enabled);
    setPromoTrialDays(
      config?.trialDays !== null && config?.trialDays !== undefined ? String(config.trialDays) : ''
    );
    setPromoWaitlistOnly(!!config?.waitlistOnly);
  };

  useEffect(() => {
    AdminApiService.getAppVersionConfig().then(applyVersionConfig).catch(Logger.error);
    AdminApiService.getFlags().then(setFlags).catch(Logger.error);
    AdminApiService.getQuotasConfig().then(applyQuotasConfig).catch(Logger.error);
    AdminApiService.getLaunchPromoConfig().then(applyLaunchPromoConfig).catch(Logger.error);
  }, [refreshKey]);

  const publishQuotas = async () => {
    const parsed = parseInt(freeLikes, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      showError('Enter a valid number of free likes');
      return;
    }
    try {
      const published = await AdminApiService.publishQuotasConfig({ freeLikesPerWindow: parsed });
      applyQuotasConfig(published);
      showSuccess('Quotas published');
    } catch (error) {
      showError(error.message || 'Publish failed');
    }
  };

  const publishLaunchPromo = async () => {
    const parsedDays = parseInt(promoTrialDays, 10);
    if (Number.isNaN(parsedDays) || parsedDays < 0) {
      showError('Enter a valid number of trial days');
      return;
    }
    try {
      const published = await AdminApiService.publishLaunchPromoConfig({
        enabled: promoEnabled,
        trialDays: parsedDays,
        waitlistOnly: promoWaitlistOnly,
      });
      applyLaunchPromoConfig(published);
      showSuccess('Launch promo published');
    } catch (error) {
      showError(error.message || 'Publish failed');
    }
  };

  const publish = async () => {
    try {
      // Only platforms the admin actually edited are sent, and only the
      // edited field — the server merges it into the CURRENT block, so a
      // stale form can never revert or clear what another admin published
      // concurrently. An edited-to-empty field clears the override (null).
      const platformOverride = latest => (latest ? { latestVersion: latest } : null);
      const platforms = {};
      if (iosLatest.trim() !== loadedPlatformLatest.ios) {
        platforms.ios = platformOverride(iosLatest.trim());
      }
      if (androidLatest.trim() !== loadedPlatformLatest.android) {
        platforms.android = platformOverride(androidLatest.trim());
      }
      const published = await AdminApiService.publishAppVersion({
        minVersion: minVersion || undefined,
        latestVersion: latestVersion || undefined,
        forceUpdate,
        ...(Object.keys(platforms).length > 0 ? { platforms } : {}),
      });
      applyVersionConfig(published);
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
            ? `Published: min ${versionConfig.minVersion || '—'} · latest ${versionConfig.latestVersion || '—'}` +
              (versionConfig.platforms?.ios?.latestVersion
                ? ` · iOS ${versionConfig.platforms.ios.latestVersion}`
                : '') +
              (versionConfig.platforms?.android?.latestVersion
                ? ` · Android ${versionConfig.platforms.android.latestVersion}`
                : '')
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
        <Text style={styles.configLabel}>iOS latest override (empty = follow global)</Text>
        <TextInput
          style={styles.configInput}
          value={iosLatest}
          onChangeText={setIosLatest}
          placeholder="—"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.configLabel}>Android latest override (empty = follow global)</Text>
        <TextInput
          style={styles.configInput}
          value={androidLatest}
          onChangeText={setAndroidLatest}
          placeholder="—"
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

      <SectionHeader title="Launch levers" subtitle="Free-tier quota and launch promo" />
      <View style={styles.configForm}>
        <Text style={styles.configLabel}>Free likes per window</Text>
        <TextInput
          style={styles.configInput}
          value={freeLikes}
          onChangeText={setFreeLikes}
          placeholder="10"
          keyboardType="number-pad"
        />
        <TouchableOpacity style={styles.publishButton} onPress={publishQuotas}>
          <Text style={styles.publishButtonText}>Publish quotas</Text>
        </TouchableOpacity>

        <View style={styles.switchRow}>
          <Text style={styles.configLabel}>Launch promo enabled</Text>
          <Switch value={promoEnabled} onValueChange={setPromoEnabled} />
        </View>
        <Text style={styles.configLabel}>Trial days</Text>
        <TextInput
          style={styles.configInput}
          value={promoTrialDays}
          onChangeText={setPromoTrialDays}
          placeholder="7"
          keyboardType="number-pad"
        />
        <View style={styles.switchRow}>
          <Text style={styles.configLabel}>Waitlist only</Text>
          <Switch value={promoWaitlistOnly} onValueChange={setPromoWaitlistOnly} />
        </View>
        <TouchableOpacity style={styles.publishButton} onPress={publishLaunchPromo}>
          <Text style={styles.publishButtonText}>Publish launch promo</Text>
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
    Verifications: VerificationsSection,
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
  verificationCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.lg,
  },
  verificationPhotos: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  verificationPhoto: {
    width: 96,
    height: 96,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.tertiary,
  },
  verificationPhotoLabel: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  verificationName: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
  },
  verificationMeta: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  verificationActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  verificationButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: theme.colors.status.success,
  },
  rejectButton: {
    backgroundColor: theme.colors.status.error,
  },
  verificationButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.bold,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay.medium,
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    padding: theme.spacing.lg,
  },
  modalScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalScrollContent: {
    paddingBottom: theme.spacing.sm,
  },
  modalSelfie: {
    width: '55%',
    aspectRatio: 0.8,
    alignSelf: 'center',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background.tertiary,
  },
  modalSelfieLabel: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  modalPhotoStrip: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  modalPhotoItem: {
    alignItems: 'center',
  },
  modalPhoto: {
    width: 110,
    height: 110,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.tertiary,
  },
  modalName: {
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  modalDetailRow: {
    marginBottom: theme.spacing.sm,
  },
  modalDetailLabel: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  modalDetailValue: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  modalCancelButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  modalCancelText: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.secondary,
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
