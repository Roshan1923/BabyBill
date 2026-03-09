import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '../config/supabase';

const DS = {
  bgPage: '#FAF8F4', bgSurface: '#FFFEFB', bgSurface2: '#F5F2EC',
  brandNavy: '#1A3A6B', brandBlue: '#2563C8', accentGold: '#E8A020',
  accentGoldSub: '#FEF3DC', textPrimary: '#1C1610', textSecondary: '#8A7E72',
  textMuted: '#B8B0A4', textInverse: '#FFFEFB', positive: '#2A8C5C',
  negative: '#C8402A', border: '#EDE8E0', shadow: 'rgba(26,58,107,0.10)',
};

const BACKEND_URL = 'https://babybill-backend.onrender.com';

// Configure Google Sign-In for Gmail scope
GoogleSignin.configure({
  webClientId: '841045886628-95d4qh7u3vfbi9cg7ssosublgmtoich1.apps.googleusercontent.com',
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  offlineAccess: true,
});

// ── Helper: format date for display ──
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Helper: format currency ──
function formatAmount(amount, currency = 'CAD') {
  if (!amount) return '—';
  return `$${parseFloat(amount).toFixed(2)} ${currency}`;
}

// ── Calendar (identical to ExportScreen) ──
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function Calendar({ startDate, endDate, onSelect, selecting }) {
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => {
    const next = new Date(year, month + 1, 1);
    if (next <= new Date(today.getFullYear(), today.getMonth() + 1, 1)) {
      setViewDate(next);
    }
  };

  const isSameDay = (a, b) => a && b &&
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const isInRange = (day) => {
    if (!startDate || !endDate) return false;
    const d = new Date(year, month, day);
    return d > startDate && d < endDate;
  };

  const isStart = (day) => startDate && isSameDay(new Date(year, month, day), startDate);
  const isEnd = (day) => endDate && isSameDay(new Date(year, month, day), endDate);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  if (rows[rows.length - 1]?.length < 7) {
    while (rows[rows.length - 1].length < 7) rows[rows.length - 1].push(null);
  }

  return (
    <View style={calStyles.container}>
      <View style={calStyles.header}>
        <TouchableOpacity onPress={prevMonth} activeOpacity={0.6} style={calStyles.navBtn}>
          <Icon name="chevron-left" size={20} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={calStyles.monthLabel}>{MONTHS_LONG[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} activeOpacity={0.6} style={calStyles.navBtn}>
          <Icon name="chevron-right" size={20} color={DS.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={calStyles.dayRow}>
        {DAYS.map((d) => <Text key={d} style={calStyles.dayLabel}>{d}</Text>)}
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={calStyles.dayRow}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={calStyles.dayCell} />;
            const dateObj = new Date(year, month, day);
            dateObj.setHours(0, 0, 0, 0);
            const isFuture = dateObj > today;
            const start = isStart(day);
            const end = isEnd(day);
            const inRange = isInRange(day);
            const isToday = isSameDay(dateObj, today);
            return (
              <TouchableOpacity
                key={ci}
                style={[
                  calStyles.dayCell,
                  inRange && calStyles.dayCellInRange,
                  (start || end) && calStyles.dayCellSelected,
                ]}
                onPress={() => !isFuture && onSelect(dateObj)}
                activeOpacity={isFuture ? 1 : 0.6}
                disabled={isFuture}
              >
                <Text style={[
                  calStyles.dayText,
                  isFuture && { color: DS.border },
                  inRange && { color: DS.brandNavy },
                  (start || end) && { color: DS.textInverse, fontWeight: '700' },
                  isToday && !start && !end && calStyles.dayTextToday,
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <Text style={calStyles.hint}>
        {selecting === 'start' ? 'Select start date' : selecting === 'end' ? 'Select end date' : 'Tap a date to change range'}
      </Text>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: { marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: DS.bgSurface2, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: DS.textPrimary },
  dayRow: { flexDirection: 'row' },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: DS.textSecondary, paddingVertical: 8 },
  dayCell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: 20 },
  dayCellInRange: { backgroundColor: DS.brandNavy + '10', borderRadius: 0 },
  dayCellSelected: { backgroundColor: DS.brandNavy, borderRadius: 20 },
  dayText: { fontSize: 14, fontWeight: '500', color: DS.textPrimary },
  dayTextToday: { color: DS.brandBlue, fontWeight: '700' },
  hint: { fontSize: 12, fontWeight: '400', color: DS.textSecondary, textAlign: 'center', marginTop: 8 },
});

// ── Pending Receipt Card ──
function PendingReceiptCard({ item, onApprove, onDismiss, approving, dismissing }) {
  return (
    <View style={cardStyles.container}>
      <View style={cardStyles.top}>
        <View style={cardStyles.iconWrap}>
          <Ionicons name="mail-outline" size={18} color={DS.accentGold} />
        </View>
        <View style={cardStyles.info}>
          <Text style={cardStyles.store} numberOfLines={1}>{item.store_name || 'Unknown Store'}</Text>
          <Text style={cardStyles.from} numberOfLines={1}>{item.raw_from || ''}</Text>
        </View>
        <Text style={cardStyles.amount}>{formatAmount(item.total_amount, item.currency)}</Text>
      </View>

      <View style={cardStyles.meta}>
        <View style={cardStyles.metaItem}>
          <Ionicons name="calendar-outline" size={12} color={DS.textMuted} />
          <Text style={cardStyles.metaText}>{formatDate(item.date)}</Text>
        </View>
        {item.category && (
          <View style={cardStyles.categoryBadge}>
            <Text style={cardStyles.categoryText}>{item.category}</Text>
          </View>
        )}
      </View>

      <View style={cardStyles.actions}>
        <TouchableOpacity
          style={cardStyles.dismissBtn}
          onPress={() => onDismiss(item.id)}
          activeOpacity={0.7}
          disabled={dismissing}
        >
          {dismissing ? <ActivityIndicator size="small" color={DS.textSecondary} /> :
            <Text style={cardStyles.dismissText}>Dismiss</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={cardStyles.approveBtn}
          onPress={() => onApprove(item.id)}
          activeOpacity={0.85}
          disabled={approving}
        >
          {approving ? <ActivityIndicator size="small" color={DS.textInverse} /> :
            <>
              <Ionicons name="checkmark" size={14} color={DS.textInverse} />
              <Text style={cardStyles.approveText}>Add to Receipts</Text>
            </>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: DS.bgSurface, borderRadius: 16, borderWidth: 1,
    borderColor: DS.border, padding: 14, marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: DS.accentGoldSub, alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1 },
  store: { fontSize: 14, fontWeight: '700', color: DS.textPrimary },
  from: { fontSize: 11, fontWeight: '400', color: DS.textMuted, marginTop: 1 },
  amount: { fontSize: 15, fontWeight: '700', color: DS.textPrimary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontWeight: '400', color: DS.textMuted },
  categoryBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: DS.bgSurface2,
  },
  categoryText: { fontSize: 11, fontWeight: '500', color: DS.textSecondary },
  actions: { flexDirection: 'row', gap: 8 },
  dismissBtn: {
    flex: 1, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    backgroundColor: DS.bgSurface2, borderWidth: 1, borderColor: DS.border,
  },
  dismissText: { fontSize: 13, fontWeight: '600', color: DS.textSecondary },
  approveBtn: {
    flex: 2, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6, backgroundColor: DS.brandNavy,
  },
  approveText: { fontSize: 13, fontWeight: '600', color: DS.textInverse },
});

// ── Main Screen ──────────────────────────────────────────────

export default function GmailReceiptsScreen({ navigation }) {
  const now = new Date();

  const [connected, setConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pendingReceipts, setPendingReceipts] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [actioningId, setActioningId] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [scanCount, setScanCount] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selecting, setSelecting] = useState('start');

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const loadStatus = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND_URL}/gmail/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConnected(data.connected);
      setGmailEmail(data.email || null);
      if (data.connected) loadPending(token);
    } catch (e) {
      console.error('Gmail status error:', e);
    }
  };

  const loadPending = async (token) => {
    try {
      setLoadingPending(true);
      const t = token || await getAuthToken();
      const res = await fetch(`${BACKEND_URL}/gmail/pending`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (data.success) setPendingReceipts(data.receipts || []);
    } catch (e) {
      console.error('Load pending error:', e);
    } finally {
      setLoadingPending(false);
    }
  };

  useFocusEffect(useCallback(() => { loadStatus(); }, []));

  const handleConnect = async () => {
    try {
      setConnecting(true);
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut(); // force fresh consent so user sees Gmail scope

      const userInfo = await GoogleSignin.signIn();
      console.log('userInfo keys:', JSON.stringify(Object.keys(userInfo)));
      console.log('serverAuthCode:', userInfo.data?.serverAuthCode || userInfo.serverAuthCode || 'NULL');

      const serverAuthCode = userInfo.data?.serverAuthCode || userInfo.serverAuthCode;
      if (!serverAuthCode) {
        Alert.alert('Connection Failed', 'Could not get authorization code from Google. Please try again.');
        setConnecting(false);
        return;
      }

      const token = await getAuthToken();
      const res = await fetch(`${BACKEND_URL}/gmail/connect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          server_auth_code: serverAuthCode,
          email: userInfo.data?.user?.email || userInfo.user?.email,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setConnected(true);
        setGmailEmail(data.email);
        loadPending();
      } else {
        Alert.alert('Connection Failed', 'Could not connect Gmail. Please try again.');
      }
    } catch (e) {
      if (e.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Error', 'Failed to connect Gmail. Please try again.');
        console.error('Gmail connect error:', e);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Gmail',
      'This will stop auto-detecting receipts from your inbox.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              setDisconnecting(true);
              const token = await getAuthToken();
              await fetch(`${BACKEND_URL}/gmail/disconnect`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              });
              await GoogleSignin.signOut();
              setConnected(false);
              setGmailEmail(null);
              setPendingReceipts([]);
              setScanCount(null);
            } catch (e) {
              console.error('Disconnect error:', e);
            } finally {
              setDisconnecting(false);
            }
          },
        },
      ]
    );
  };

  const handleDateSelect = (date) => {
    if (selecting === 'start') {
      setStartDate(date);
      setEndDate(null);
      setSelecting('end');
    } else {
      if (date < startDate) {
        setEndDate(startDate);
        setStartDate(date);
      } else {
        setEndDate(date);
      }
      setSelecting('done');
    }
  };

  const handleResetDates = () => {
    setStartDate(null);
    setEndDate(null);
    setSelecting('start');
    setScanCount(null);
  };

  const formatDateDisplay = (d) => {
    if (!d) return '—';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const toGmailDateStr = (d) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

  const handleScan = async () => {
    if (!startDate || !endDate) return;
    try {
      setScanning(true);
      setScanCount(null);
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND_URL}/gmail/scan-range`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_date: toGmailDateStr(startDate),
          end_date: toGmailDateStr(endDate),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScanCount(data.count);
        loadPending();
      } else {
        Alert.alert('Scan Failed', 'Could not scan Gmail. Please try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to scan Gmail.');
      console.error('Scan error:', e);
    } finally {
      setScanning(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      setActioningId(id);
      setActionType('approve');
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND_URL}/gmail/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_receipt_id: id }),
      });
      const data = await res.json();
      if (data.success) {
        setPendingReceipts(prev => prev.filter(r => r.id !== id));
      }
    } catch (e) {
      console.error('Approve error:', e);
    } finally {
      setActioningId(null);
      setActionType(null);
    }
  };

  const handleDismiss = async (id) => {
    try {
      setActioningId(id);
      setActionType('dismiss');
      const token = await getAuthToken();
      await fetch(`${BACKEND_URL}/gmail/dismiss`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_receipt_id: id }),
      });
      setPendingReceipts(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error('Dismiss error:', e);
    } finally {
      setActioningId(null);
      setActionType(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connect Gmail</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status Card ── */}
        <View style={styles.statusCard}>
          <View style={styles.statusIconWrap}>
            <Ionicons name="mail" size={28} color={DS.accentGold} />
          </View>
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>
              {connected ? 'Gmail Connected' : 'Connect Your Gmail'}
            </Text>
            <Text style={styles.statusSublabel}>
              {connected
                ? gmailEmail
                : 'Auto-detect receipts from your inbox. Free, no credits used.'}
            </Text>
          </View>
          {connected && (
            <View style={styles.connectedBadge}>
              <View style={styles.connectedDot} />
            </View>
          )}
        </View>

        {!connected ? (
          /* ── Not Connected State ── */
          <>
            {/* Feature bullets */}
            <View style={styles.featureCard}>
              {[
                { icon: 'search-outline', text: 'Scans your inbox for receipts automatically' },
                { icon: 'shield-checkmark-outline', text: 'You approve before anything is saved' },
                { icon: 'flash-outline', text: 'Free — no credits used for email scanning' },
              ].map((f, i) => (
                <View key={i} style={[styles.featureRow, i < 2 && styles.featureRowBorder]}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={f.icon} size={16} color={DS.brandNavy} />
                  </View>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>

            {/* Connect button */}
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={handleConnect}
              activeOpacity={0.85}
              disabled={connecting}
            >
              {connecting ? (
                <ActivityIndicator size="small" color={DS.textInverse} />
              ) : (
                <>
                  <Ionicons name="mail" size={18} color={DS.textInverse} />
                  <Text style={styles.connectBtnText}>Connect Gmail Account</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          /* ── Connected State ── */
          <>
            {/* Scan section */}
            <Text style={styles.sectionLabel}>SCAN FOR RECEIPTS</Text>

            {/* Date range display */}
            <View style={styles.dateRangeCard}>
              <View style={styles.dateRangeRow}>
                <TouchableOpacity
                  style={[styles.dateBox, selecting === 'start' && styles.dateBoxActive]}
                  onPress={() => setSelecting('start')} activeOpacity={0.7}
                >
                  <Text style={styles.dateBoxLabel}>FROM</Text>
                  <Text style={[styles.dateBoxValue, !startDate && { color: DS.textSecondary }]}>
                    {formatDateDisplay(startDate)}
                  </Text>
                </TouchableOpacity>
                <View style={styles.dateArrow}>
                  <Icon name="arrow-right" size={16} color={DS.textSecondary} />
                </View>
                <TouchableOpacity
                  style={[styles.dateBox, selecting === 'end' && styles.dateBoxActive]}
                  onPress={() => startDate && setSelecting('end')} activeOpacity={0.7}
                >
                  <Text style={styles.dateBoxLabel}>TO</Text>
                  <Text style={[styles.dateBoxValue, !endDate && { color: DS.textSecondary }]}>
                    {formatDateDisplay(endDate)}
                  </Text>
                </TouchableOpacity>
              </View>
              {(startDate || endDate) && (
                <TouchableOpacity onPress={handleResetDates} activeOpacity={0.6} style={styles.resetBtn}>
                  <Icon name="refresh-cw" size={12} color={DS.negative} />
                  <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Calendar */}
            <View style={styles.card}>
              <Calendar
                startDate={startDate}
                endDate={endDate}
                onSelect={handleDateSelect}
                selecting={selecting}
              />
              <TouchableOpacity
                style={[styles.scanBtn, (!startDate || !endDate || scanning) && { opacity: 0.4 }]}
                onPress={handleScan}
                activeOpacity={0.85}
                disabled={!startDate || !endDate || scanning}
              >
                {scanning ? (
                  <>
                    <ActivityIndicator size="small" color={DS.textInverse} />
                    <Text style={styles.scanBtnText}>Scanning your inbox...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="search" size={16} color={DS.textInverse} />
                    <Text style={styles.scanBtnText}>
                      {startDate && endDate ? 'Scan for Receipts' : 'Select Date Range'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {scanCount !== null && (
                <View style={styles.scanResult}>
                  <Ionicons
                    name={scanCount > 0 ? 'checkmark-circle' : 'information-circle'}
                    size={16}
                    color={scanCount > 0 ? DS.positive : DS.textMuted}
                  />
                  <Text style={[styles.scanResultText, { color: scanCount > 0 ? DS.positive : DS.textMuted }]}>
                    {scanCount > 0
                      ? `Found ${scanCount} new receipt${scanCount > 1 ? 's' : ''}`
                      : 'No new receipts found in this range'}
                  </Text>
                </View>
              )}
            </View>

            {/* Pending receipts */}
            {(loadingPending || pendingReceipts.length > 0) && (
              <>
                <View style={styles.pendingHeader}>
                  <Text style={styles.sectionLabel}>WAITING FOR APPROVAL</Text>
                  {pendingReceipts.length > 0 && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>{pendingReceipts.length}</Text>
                    </View>
                  )}
                </View>

                {loadingPending ? (
                  <ActivityIndicator size="small" color={DS.brandNavy} style={{ marginTop: 12 }} />
                ) : (
                  pendingReceipts.map(item => (
                    <PendingReceiptCard
                      key={item.id}
                      item={item}
                      onApprove={handleApprove}
                      onDismiss={handleDismiss}
                      approving={actioningId === item.id && actionType === 'approve'}
                      dismissing={actioningId === item.id && actionType === 'dismiss'}
                    />
                  ))
                )}
              </>
            )}

            {/* Disconnect */}
            <TouchableOpacity
              style={styles.disconnectBtn}
              onPress={handleDisconnect}
              activeOpacity={0.7}
              disabled={disconnecting}
            >
              {disconnecting
                ? <ActivityIndicator size="small" color={DS.negative} />
                : <Text style={styles.disconnectText}>Disconnect Gmail</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgPage },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 12,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: DS.bgSurface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: DS.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: DS.textPrimary },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  // Status card
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: DS.bgSurface, borderRadius: 20, borderWidth: 1,
    borderColor: DS.border, padding: 18, marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16 },
      android: { elevation: 2 },
    }),
  },
  statusIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: DS.accentGoldSub, alignItems: 'center', justifyContent: 'center',
  },
  statusText: { flex: 1 },
  statusTitle: { fontSize: 16, fontWeight: '700', color: DS.textPrimary, marginBottom: 3 },
  statusSublabel: { fontSize: 12, fontWeight: '400', color: DS.textSecondary, lineHeight: 16 },
  connectedBadge: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: DS.positive, borderWidth: 2, borderColor: DS.bgSurface,
  },
  connectedDot: { flex: 1, borderRadius: 4, backgroundColor: DS.positive },

  // Feature card
  featureCard: {
    backgroundColor: DS.bgSurface, borderRadius: 20, borderWidth: 1,
    borderColor: DS.border, paddingHorizontal: 16, marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16 },
      android: { elevation: 2 },
    }),
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  featureRowBorder: { borderBottomWidth: 1, borderBottomColor: DS.border },
  featureIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: DS.brandNavy + '10', alignItems: 'center', justifyContent: 'center',
  },
  featureText: { flex: 1, fontSize: 13, fontWeight: '500', color: DS.textPrimary, lineHeight: 18 },

  // Connect button
  connectBtn: {
    height: 52, borderRadius: 999, backgroundColor: DS.brandNavy,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    ...Platform.select({
      ios: { shadowColor: DS.brandNavy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  connectBtnText: { fontSize: 15, fontWeight: '700', color: DS.textInverse },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 1.2,
    textTransform: 'uppercase', color: DS.textSecondary, marginBottom: 10,
  },

  // Generic card
  card: {
    backgroundColor: DS.bgSurface, borderRadius: 20, borderWidth: 1,
    borderColor: DS.border, padding: 18, marginBottom: 24, gap: 16,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16 },
      android: { elevation: 2 },
    }),
  },

  // Date range display
  dateRangeCard: {
    backgroundColor: DS.bgSurface, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: DS.border, marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: DS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 20 },
      android: { elevation: 2 },
    }),
  },
  dateRangeRow: { flexDirection: 'row', alignItems: 'center' },
  dateBox: {
    flex: 1, backgroundColor: DS.bgSurface2, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  dateBoxActive: { borderColor: DS.brandNavy },
  dateBoxLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, color: DS.textSecondary, marginBottom: 4 },
  dateBoxValue: { fontSize: 15, fontWeight: '600', color: DS.textPrimary },
  dateArrow: { marginHorizontal: 10 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 },
  resetText: { fontSize: 12, fontWeight: '500', color: DS.negative },
  scanBtn: {
    height: 48, borderRadius: 999, backgroundColor: DS.brandNavy,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  scanBtnText: { fontSize: 14, fontWeight: '700', color: DS.textInverse },

  scanResult: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  scanResultText: { fontSize: 13, fontWeight: '500' },

  // Pending header
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  pendingBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: DS.brandNavy, alignItems: 'center', justifyContent: 'center',
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: DS.textInverse },

  // Disconnect
  disconnectBtn: {
    height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: DS.negative + '30', marginTop: 8,
  },
  disconnectText: { fontSize: 14, fontWeight: '600', color: DS.negative },
});
