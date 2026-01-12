import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RNPickerSelect from 'react-native-picker-select';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../../firebase';
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import phLocations from '../../data/ph_locations.json';

export default function AddAddress() {
  const navigation = useNavigation();
  const user = auth.currentUser;

  const [userData, setUserData] = useState({});
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [streetName, setStreetName] = useState('');
  const [postalCode, setPostalCode] = useState('6100');
  const [label, setLabel] = useState('Home');
  const [isDefault, setIsDefault] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  // Default location (Bacolod City, Western Visayas)
  const selectedRegion = 'Western Visayas';
  const selectedProvince = 'Negros Occidental';
  const selectedCity = 'Bacolod City';

  // ✅ Load user info from Firestore (for name)
  useEffect(() => {
    const fetchUser = async () => {
      if (!user) return;
      const userRef = doc(db, 'Users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
      }
    };
    fetchUser();
  }, [user]);

  // ✅ Get barangays for Bacolod City
  const barangays =
    phLocations?.regions?.[selectedRegion]?.[selectedProvince]?.[selectedCity]
      ?.barangays || [];

  // ✅ Strict validation and save logic
  const handleSaveAddress = async () => {
    if (!selectedBarangay) {
      Alert.alert('Missing Information', 'Please select a barangay.');
      return;
    }

    if (!streetName.trim()) {
      Alert.alert('Missing Information', 'Please enter your street name.');
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert('Missing Information', 'Please enter your phone number.');
      return;
    }

    if (!/^(09)\d{9}$/.test(phoneNumber)) {
      Alert.alert(
        'Invalid Number',
        'Please enter a valid 11-digit phone number starting with 09.'
      );
      return;
    }

    if (!auth.currentUser) {
      Alert.alert('Error', 'You must be logged in to save your address.');
      return;
    }

    try {
      setLoading(true);

      const userId = auth.currentUser.uid;
        const addressData = {
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        region: selectedRegion,
        province: selectedProvince,
        city: selectedCity,
        barangay: selectedBarangay,
        streetName,
        phoneNumber,
        postalCode,
        label,
        isDefault,
        createdAt: serverTimestamp(),
        };

      await addDoc(collection(db, 'Users-Address', userId, 'addresses'), addressData);

      Alert.alert('Success', 'Address saved successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Something went wrong while saving your address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ✅ Hide status bar */}
      <StatusBar hidden={true} />

{/* ✅ Header */}
<View style={styles.headerContainer}>
  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
    <Ionicons name="arrow-back" size={24} color="#fff" />
  </TouchableOpacity>
  <Text style={styles.headerTitle}>New Address</Text>
  {/* Placeholder for spacing on the right */}
  <View style={{ width: 24 }} />
</View>


      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.sectionTitle}>Contact Information</Text>

        {/* Full Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: '#E5E7EB' }]}
            value={`${userData.firstName || ''} ${userData.lastName || ''}`.trim()}
            editable={false}
          />
        </View>

        {/* ✅ Editable Phone Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="0912-345-6789"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            maxLength={11}
          />
        </View>

        <Text style={styles.sectionTitle}>Address Information</Text>

        {/* Static Fields */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Region</Text>
          <TextInput style={styles.input} value={selectedRegion} editable={false} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Province</Text>
          <TextInput style={styles.input} value={selectedProvince} editable={false} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>City</Text>
          <TextInput style={styles.input} value={selectedCity} editable={false} />
        </View>

        {/* ✅ Barangay Dropdown */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Barangay</Text>
          <RNPickerSelect
            onValueChange={(value) => setSelectedBarangay(value)}
            items={barangays.map((b) => ({
              label: b,
              value: b,
            }))}
            value={selectedBarangay}
            placeholder={{ label: 'Select Barangay...', value: null }}
            style={pickerSelectStyles}
            useNativeAndroidPickerStyle={false}
            Icon={() => (
              <Ionicons
                name="chevron-down"
                size={20}
                color="#6B7280"
                style={{ marginRight: 10 }}
              />
            )}
          />
        </View>

        {/* ✅ Show other fields after barangay selected */}
        {selectedBarangay ? (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Street Name / Building / House No.</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 123 Lopez Jaena St."
                value={streetName}
                onChangeText={setStreetName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Postal Code</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#E5E7EB' }]}
                value={postalCode}
                editable={false}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Set as Default Address</Text>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.labelButtons}>
              {['Home', 'Work'].map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.labelOption, label === l && styles.selectedLabel]}
                  onPress={() => setLabel(l)}
                >
                  <Text
                    style={{
                      color: label === l ? '#fff' : '#111827',
                      fontWeight: label === l ? '700' : '500',
                    }}
                  >
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveAddress}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Address</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  headerContainer: {
    margin: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6', // Blue theme
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    width:355,
  },
  backButton: { marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },


  sectionTitle: { fontSize: 16, fontWeight: '700', marginVertical: 8, color: '#111827' },
  inputGroup: { marginVertical: 6 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#374151' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  labelButtons: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 },
  labelOption: {
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 30,
  },
  selectedLabel: { backgroundColor: '#3B82F6' },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

// ✅ Dropdown Picker styles
const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    color: '#111827',
    backgroundColor: '#fff',
    paddingRight: 30,
  },
  inputAndroid: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    color: '#111827',
    backgroundColor: '#fff',
    paddingRight: 30,
  },
  iconContainer: {
    top: 10,
    right: 12,
  },
});
