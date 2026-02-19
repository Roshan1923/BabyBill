import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { supabase } from '../config/supabase';

// Country → Currency / Tax mappings
const COUNTRY_DATA = {
  Canada: {
    currency: 'CAD',
    defaultTax: 'GST',
    taxOptions: [
      { value: 'GST', label: 'GST (5%)' },
      { value: 'HST', label: 'HST — ON, NB, NS, NL, PEI' },
      { value: 'GST + PST', label: 'GST + PST — BC, SK, MB' },
      { value: 'GST + QST', label: 'GST + QST — QC' },
    ],
  },
  'United States': {
    currency: 'USD',
    defaultTax: 'Sales Tax',
    taxOptions: [
      { value: 'Sales Tax', label: 'Sales Tax' },
      { value: 'No Tax', label: 'No Tax — OR, MT, NH, DE, AK' },
    ],
  },
  India: {
    currency: 'INR',
    defaultTax: 'GST',
    taxOptions: [
      { value: 'GST', label: 'GST' },
      { value: 'IGST', label: 'IGST — inter-state' },
      { value: 'CGST + SGST', label: 'CGST + SGST — intra-state' },
    ],
  },
};

const COUNTRIES = Object.keys(COUNTRY_DATA);
const CURRENCIES = ['CAD', 'USD', 'INR'];

// Dropdown component
const Dropdown = ({ label, value, options, onSelect, getLabel }) => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.dropdownText}>
          {getLabel ? getLabel(value) : value || 'Select...'}
        </Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => (typeof item === 'string' ? item : item.value)}
              renderItem={({ item }) => {
                const val = typeof item === 'string' ? item : item.value;
                const lab = typeof item === 'string' ? item : item.label;
                const isSelected = val === value;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => { onSelect(val); setVisible(false); }}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                      {lab}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const ProfileScreen = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('Canada');
  const [currency, setCurrency] = useState('CAD');
  const [taxSystem, setTaxSystem] = useState('GST');

  // Original values for cancel
  const [original, setOriginal] = useState({});

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        // Google sign-in users might not have a profile yet
        if (error.code === 'PGRST116') {
          setEmail(user.email || '');
          setFirstName(user.user_metadata?.full_name?.split(' ')[0] || '');
          setLastName(user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '');
          setUsername('');
        } else {
          console.log('Profile fetch error:', error);
        }
        return;
      }

      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setUsername(data.username || '');
      setEmail(data.email || user.email || '');
      setCountry(data.country || 'Canada');
      setCurrency(data.currency || 'CAD');
      setTaxSystem(data.tax_system || 'GST');

      setOriginal({
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        country: data.country || 'Canada',
        currency: data.currency || 'CAD',
        taxSystem: data.tax_system || 'GST',
      });
    } catch (err) {
      console.log('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleCountryChange = (newCountry) => {
    setCountry(newCountry);
    const data = COUNTRY_DATA[newCountry];
    if (data) {
      setCurrency(data.currency);
      setTaxSystem(data.defaultTax);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required', 'First name and last name are required.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          country,
          currency,
          tax_system: taxSystem,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Error', 'Failed to save profile. ' + error.message);
      } else {
        setOriginal({ firstName: firstName.trim(), lastName: lastName.trim(), country, currency, taxSystem });
        setEditing(false);
        Alert.alert('Saved', 'Your profile has been updated.');
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFirstName(original.firstName);
    setLastName(original.lastName);
    setCountry(original.country);
    setCurrency(original.currency);
    setTaxSystem(original.taxSystem);
    setEditing(false);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const taxOptions = COUNTRY_DATA[country]?.taxOptions || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchProfile(); }}
          tintColor="#3b82f6"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {firstName ? firstName[0].toUpperCase() : '?'}
            {lastName ? lastName[0].toUpperCase() : ''}
          </Text>
        </View>
        <Text style={styles.displayName}>
          {firstName} {lastName}
        </Text>
        {username ? <Text style={styles.usernameText}>@{username}</Text> : null}
        <Text style={styles.emailText}>{email}</Text>
      </View>

      {/* Edit / Cancel buttons */}
      <View style={styles.editRow}>
        {editing ? (
          <>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Profile Fields */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Info</Text>

        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>First Name</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholderTextColor="#555"
            />
          ) : (
            <Text style={styles.fieldValue}>{firstName || '—'}</Text>
          )}
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Last Name</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholderTextColor="#555"
            />
          ) : (
            <Text style={styles.fieldValue}>{lastName || '—'}</Text>
          )}
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Username</Text>
          <Text style={styles.fieldValueDim}>@{username || '—'}</Text>
          {editing && (
            <Text style={styles.fieldHint}>Username cannot be changed</Text>
          )}
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Email</Text>
          <Text style={styles.fieldValueDim}>{email || '—'}</Text>
          {editing && (
            <Text style={styles.fieldHint}>Email cannot be changed here</Text>
          )}
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>

        {editing ? (
          <>
            <Dropdown
              label="Country"
              value={country}
              options={COUNTRIES}
              onSelect={handleCountryChange}
            />
            <Dropdown
              label="Currency"
              value={currency}
              options={CURRENCIES}
              onSelect={setCurrency}
            />
            <Dropdown
              label="Tax System"
              value={taxSystem}
              options={taxOptions}
              onSelect={setTaxSystem}
              getLabel={(val) => {
                const found = taxOptions.find((o) => o.value === val);
                return found ? found.label : val;
              }}
            />
          </>
        ) : (
          <>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Country</Text>
              <Text style={styles.fieldValue}>{country}</Text>
            </View>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Currency</Text>
              <Text style={styles.fieldValue}>{currency}</Text>
            </View>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Tax System</Text>
              <Text style={styles.fieldValue}>{taxSystem}</Text>
            </View>
          </>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  displayName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  usernameText: {
    color: '#6b7280',
    fontSize: 15,
    marginTop: 2,
  },
  emailText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 2,
  },

  // Edit row
  editRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 28,
  },
  editBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  editBtnText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cancelBtnText: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Sections
  section: {
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },

  // Fields
  fieldWrapper: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldValue: {
    color: '#fff',
    fontSize: 16,
  },
  fieldValueDim: {
    color: '#9ca3af',
    fontSize: 16,
  },
  fieldHint: {
    color: '#4b5563',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },

  // Dropdown
  dropdown: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    color: '#fff',
    fontSize: 16,
  },
  dropdownArrow: {
    color: '#6b7280',
    fontSize: 12,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    maxHeight: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  modalItemSelected: {
    backgroundColor: '#3b82f620',
  },
  modalItemText: {
    color: '#d1d5db',
    fontSize: 16,
  },
  modalItemTextSelected: {
    color: '#3b82f6',
    fontWeight: '700',
  },

  // Logout
  logoutBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ProfileScreen;