/**
 * Shared UI kit for the admin dashboard. Theme tokens only.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../../styles/theme';

export const PillTabs = ({ tabs, active, onChange }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
    <View style={styles.tabsRow}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab}
          style={[styles.pill, active === tab && styles.pillActive]}
          onPress={() => onChange(tab)}
        >
          <Text style={[styles.pillText, active === tab && styles.pillTextActive]}>{tab}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </ScrollView>
);

export const KpiGrid = ({ children }) => <View style={styles.kpiGrid}>{children}</View>;

export const KpiTile = ({ label, value, accent }) => (
  <View style={[styles.kpiTile, accent && styles.kpiTileAccent]}>
    <Text style={styles.kpiValue}>{value ?? '—'}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </View>
);

/** Tiny dependency-free bar chart for 14-day series. */
export const MiniBars = ({ data = [], height = 48 }) => {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <View style={[styles.barsRow, { height }]}>
      {data.map(point => (
        <View key={point.day} style={styles.barSlot}>
          <View style={[styles.bar, { height: Math.max(2, (point.count / max) * height) }]} />
        </View>
      ))}
    </View>
  );
};

export const SectionHeader = ({ title, subtitle }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
  </View>
);

export const AdminListRow = ({ title, subtitle, right, onPress }) => (
  <TouchableOpacity style={styles.listRow} onPress={onPress} disabled={!onPress}>
    <View style={styles.listRowText}>
      <Text style={styles.listRowTitle} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.listRowSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {right ? <View style={styles.listRowRight}>{right}</View> : null}
  </TouchableOpacity>
);

export const Pill = ({ label, tone = 'neutral' }) => (
  <View style={[styles.badge, styles[`badge_${tone}`]]}>
    <Text style={styles.badgeText}>{label}</Text>
  </View>
);

export const CapNotice = ({ shown, total }) =>
  total > shown ? (
    <Text style={styles.capNotice}>
      Showing first {shown} of {total}
    </Text>
  ) : null;

export const EmptyState = ({ message }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  tabsScroll: { flexGrow: 0 },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  pill: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.background.tertiary,
    marginRight: theme.spacing.sm,
  },
  pillActive: { backgroundColor: theme.colors.primary },
  pillText: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.secondary,
  },
  pillTextActive: { color: theme.colors.text.white },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.md,
  },
  kpiTile: {
    width: '30%',
    margin: '1.5%',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  kpiTileAccent: { backgroundColor: theme.colors.primaryTint },
  kpiValue: {
    fontSize: theme.typography.sizes.xxl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
  },
  kpiLabel: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: 2,
    textAlign: 'center',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  barSlot: { flex: 1, alignItems: 'center' },
  bar: {
    width: '55%',
    backgroundColor: theme.colors.secondaryLight,
    borderRadius: 2,
  },
  sectionHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
  },
  sectionSubtitle: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.light,
  },
  listRowText: { flex: 1 },
  listRowTitle: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
  },
  listRowSubtitle: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: 1,
  },
  listRowRight: { marginLeft: theme.spacing.md },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.round,
  },
  badge_neutral: { backgroundColor: theme.colors.background.tertiary },
  badge_success: { backgroundColor: theme.colors.secondaryTint },
  badge_danger: { backgroundColor: theme.colors.primaryTint },
  badge_premium: { backgroundColor: theme.colors.accentTint },
  badgeText: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
  },
  capNotice: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.muted,
    textAlign: 'center',
    padding: theme.spacing.md,
  },
  empty: { padding: theme.spacing.xxl, alignItems: 'center' },
  emptyText: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
  },
});
