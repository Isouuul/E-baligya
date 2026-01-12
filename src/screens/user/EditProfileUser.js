import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Alert,
  ActivityIndicator, StatusBar, Platform, KeyboardAvoidingView
} from 'react-native';
import { auth, db } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Locations from './Locations.json';

export default function EditProfileUser({ navigation }) {
  const [userData, setUserData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    birthdate: '',
    gender: '',
    address: { street: '', barangay: '', city: '', region: 'Region VI - Western Visayas' },
    profileImage: null, // store as Base64 string
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId) return;
      try {
        const userRef = doc(db, 'Users', userId);
        const snapshot = await getDoc(userRef);
        if (snapshot.exists()) {
          setUserData(prev => ({
            ...prev,
            ...snapshot.data(),
            address: snapshot.data().address || prev.address,
          }));
        }
      } catch (error) {
        console.log('Error fetching user data:', error);
        Alert.alert('Error', 'Failed to fetch profile data.');
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [userId]);

  const handleChange = (field, value) => setUserData(prev => ({ ...prev, [field]: value }));
  const handleAddressChange = (field, value) =>
    setUserData(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));

  // Pick image and convert to Base64
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Permission to access gallery is required!');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const base64Image = `data:image/jpeg;base64,${base64}`;
        handleChange('profileImage', base64Image);

        // Save immediately
        if (userId) {
          try {
            const userRef = doc(db, 'Users', userId);
            await updateDoc(userRef, { profileImage: base64Image, updatedAt: new Date().toISOString() });
            Alert.alert('Success', 'Profile image updated!');
          } catch (err) {
            console.log('Error saving image:', err);
            Alert.alert('Error', 'Failed to save profile image.');
          }
        }
      }
    } catch (err) {
      console.log('Image pick error:', err);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const userRef = doc(db, 'Users', userId);
      await updateDoc(userRef, { ...userData, updatedAt: new Date().toISOString() });
      Alert.alert('Success', 'Profile updated successfully!');
      navigation.goBack();
    } catch (err) {
      console.log('Error updating profile:', err);
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const cities = Object.keys(Locations);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <StatusBar hidden />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Profile Picture */}
        <View style={styles.profileContainer}>
          <TouchableOpacity onPress={pickImage}>
            {userData.profileImage ? (
              <Image source={{ uri: userData.profileImage }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.profilePlaceholder]}>
                <Text style={styles.profilePlaceholderText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <InputField label="First Name" value={userData.firstName} onChange={text => handleChange('firstName', text)} />
          <InputField label="Middle Name" value={userData.middleName} onChange={text => handleChange('middleName', text)} />
          <InputField label="Last Name" value={userData.lastName} onChange={text => handleChange('lastName', text)} />
          <InputField label="Birthdate" value={userData.birthdate} placeholder="YYYY-MM-DD" onChange={text => handleChange('birthdate', text)} />
          <InputField label="Gender" value={userData.gender} onChange={text => handleChange('gender', text)} />

          {/* Address */}
          <Text style={styles.label}>Region:</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={userData.address.region} enabled={false}>
              <Picker.Item label={userData.address.region} value={userData.address.region} />
            </Picker>
          </View>

          <Text style={styles.label}>City:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={userData.address.city}
              onValueChange={val => {
                handleAddressChange('city', val);
                handleAddressChange('barangay', '');
                handleAddressChange('street', '');
              }}
            >
              <Picker.Item label="Select City" value="" />
              {cities.map(c => <Picker.Item key={c} label={c} value={c} />)}
            </Picker>
          </View>

          {userData.address.city && Locations[userData.address.city] && (
            <>
              <Text style={styles.label}>Barangay:</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={userData.address.barangay}
                  onValueChange={val => handleAddressChange('barangay', val)}
                >
                  <Picker.Item label="Select Barangay" value="" />
                  {Locations[userData.address.city].map(b => <Picker.Item key={b} label={b} value={b} />)}
                </Picker>
              </View>
            </>
          )}

          {userData.address.barangay && (
            <>
              <Text style={styles.label}>Street / House No:</Text>
              <TextInput
                style={styles.input}
                placeholder="Street / Block / House No"
                value={userData.address.street}
                onChangeText={text => handleAddressChange('street', text)}
              />
            </>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// InputField
const InputField = ({ label, value, onChange, placeholder }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} value={value ?? ''} placeholder={placeholder || ''} onChangeText={onChange} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8FC' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 15, paddingVertical: 15, justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  profileContainer: { alignItems: 'center', marginTop: 20, marginBottom: 20 },
  profileImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#3B82F6' },
  profilePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#DBEAFE' },
  profilePlaceholderText: { color: '#2563EB', fontWeight: '700' },
  form: { paddingHorizontal: 20 },
  inputContainer: { marginTop: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 5 },
  input: { height: 50, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#cbd5e1', fontSize: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  pickerWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, marginBottom: 12 },
  saveButton: { marginTop: 25, backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 15, alignItems: 'center', marginHorizontal: 20 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
