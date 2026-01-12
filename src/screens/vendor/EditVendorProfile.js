import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { getFirestore, collection, query, where, getDocs, setDoc, doc, Timestamp, updateDoc} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const EditVendorProfile = ({ navigation }) => {
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    phone: '',
    businessAddress: '',
    businessType: '',
    profileImage: null,
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const auth = getAuth();
  const db = getFirestore();
  const user = auth.currentUser;

  // Fetch vendor data from ApprovedVendors
  useEffect(() => {
    const fetchVendor = async () => {
      if (!user) return;
      try {
        const vendorQuery = query(collection(db, 'ApprovedVendors'), where('userId', '==', user.uid));
        const snapshot = await getDocs(vendorQuery);
        if (!snapshot.empty) {
          setFormData(snapshot.docs[0].data());
        }
      } catch (err) {
        console.error('Error fetching vendor data:', err);
        Alert.alert('Error', 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, []);

  // Pick profile image and convert to Base64
// Pick profile image and convert to Base64
const pickImage = async () => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

      // Update local state
      setFormData(prev => ({ ...prev, profileImage: `data:image/jpeg;base64,${base64}` }));
    }
  } catch (err) {
    console.error('Image pick error:', err);
    Alert.alert('Error', 'Failed to pick image.');
  }
};


  const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  
const handleSave = async () => {
  if (!formData.businessName || !formData.ownerName || !formData.phone) {
    Alert.alert('Validation Error', 'Please fill all required fields.');
    return;
  }

  setSaving(true);

  try {
    const sanitizedEmail = formData.email.replace(/\./g, '_');

    // 1️⃣ Submit to PendingVendors for admin approval
    const pendingPayload = {
      userId: user.uid,
      email: formData.email ?? null,
      businessName: formData.businessName ?? null,
      ownerName: formData.ownerName ?? null,
      status: 'Pending',
      createdAt: Timestamp.now(),
      hasFullData: true,
    };

    await setDoc(doc(db, 'PendingVendors', sanitizedEmail), pendingPayload);

    await setDoc(doc(db, 'PendingVendors', sanitizedEmail, 'fullData', 'vendorData'), {
      ...formData,
      updatedAt: Timestamp.now(),
    });

    if (formData.profileImage) {
      await setDoc(
        doc(db, 'PendingVendors', sanitizedEmail, 'images', 'profileImage'),
        {
          image: formData.profileImage,
          type: 'profileImage',
          createdAt: Timestamp.now(),
        }
      );
    }

    // 2️⃣ Update the live ApprovedVendors document
    const approvedQuery = query(
      collection(db, 'ApprovedVendors'),
      where('userId', '==', user.uid)
    );
    const snapshot = await getDocs(approvedQuery);

    if (!snapshot.empty) {
      const docRef = doc(db, 'ApprovedVendors', snapshot.docs[0].id);
      await updateDoc(docRef, {
        ...formData,
        profileImage: formData.profileImage ?? snapshot.docs[0].data().profileImage,
        updatedAt: Timestamp.now(),
      });
    } else {
      console.warn('Approved vendor document not found.');
    }

    Alert.alert('Success', 'Profile updated and submitted for approval!');
    navigation.goBack();
  } catch (err) {
    console.error('Error submitting edit:', err);
    Alert.alert('Error', 'Failed to submit changes.');
  } finally {
    setSaving(false);
  }
};


  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Profile Picture */}
        <View style={styles.profileContainer}>
          <TouchableOpacity onPress={pickImage}>
            {formData.profileImage ? (
              <Image source={{ uri: formData.profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera" size={32} color="#888" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={{ marginTop: 8, fontWeight: '600' }}>Profile Picture</Text>
        </View>

        {/* Business Info */}
        <Text style={styles.sectionTitle}>Business Information</Text>

        <Text style={styles.label}>
          Business Name <Text style={{ color: 'red' }}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={formData.businessName}
          onChangeText={text => handleChange('businessName', text)}
          placeholder="Enter business name"
        />

        <Text style={styles.label}>Business Address (Market)</Text>
        <TextInput style={[styles.input, styles.readOnlyInput]} value={formData.businessAddress} editable={false} />

        <Text style={styles.label}>Business Type</Text>
        <TextInput style={[styles.input, styles.readOnlyInput]} value={formData.businessType} editable={false} />

        {/* Contact Info */}
        <Text style={styles.sectionTitle}>Contact Information</Text>

        <Text style={styles.label}>
          Owner Name <Text style={{ color: 'red' }}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={formData.ownerName}
          onChangeText={text => handleChange('ownerName', text)}
          placeholder="Enter owner name"
        />

        <Text style={styles.label}>
          Phone <Text style={{ color: 'red' }}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={formData.phone}
          onChangeText={text => handleChange('phone', text)}
          keyboardType="phone-pad"
          placeholder="Enter phone number"
        />

        {/* Save Button */}
        <TouchableOpacity style={[styles.saveButton, saving && { backgroundColor: '#aaa' }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Submit Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default EditVendorProfile;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 14, backgroundColor: '#1e3a8a', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  backButton: { padding: 5, marginRight: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  container: { padding: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileContainer: { alignItems: 'center', marginBottom: 20 },
  profileImage: { width: 100, height: 100, borderRadius: 50 },
  imagePlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 15, marginBottom: 10, color: '#2563eb' },
  label: { fontSize: 14, fontWeight: '600', marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#aaa', borderRadius: 10, padding: 10, marginTop: 5, backgroundColor: '#fff' },
  readOnlyInput: { backgroundColor: '#f2f2f2', color: '#555' },
  saveButton: { backgroundColor: '#1e3a8a', paddingVertical: 14, borderRadius: 10, marginTop: 30, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
