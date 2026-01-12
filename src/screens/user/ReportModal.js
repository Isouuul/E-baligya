// src/components/ReportModal.js
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { db, auth } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function ReportModal({ visible, onClose, productId, productName, product }) {
  
  const [selectedReason, setSelectedReason] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);



  const reasons = [
    "Spoiled Seafood",
    "Expired Products",
    "Mislabeling / Wrong Information",
    "Poor Quality",
    "Others",
  ];

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].base64); // store base64 for Firestore
    }
  };

  const handleSubmit = async () => {
    if (!selectedReason) return Alert.alert('Notice!', 'Please select a reason');

    setLoading(true);
    try {
      const reportData = {
        userId: auth.currentUser.uid,
        productId,
        productName,
        vendorId: product.uploadedBy.uid,
        productImage: product.imageBase64 ? `data:image/jpeg;base64,${product.imageBase64}` : null,
        vendorEmail: product.uploadedBy.email,
        businessName: product.uploadedBy.businessName,
        reason: selectedReason,
        details: reasonText,
        evidenceImage: image ? `data:image/jpeg;base64,${image}` : null,
        createdAt: serverTimestamp(),
        status: 'pending',
      };

      await addDoc(collection(db, 'Reports_Products'), reportData);

      setLoading(false);
      setSuccessModal(true);
      setSelectedReason(null);
      setReasonText('');
      setImage(null);
    } catch (err) {
      setLoading(false);
      console.log('Report submission failed:', err);
      Alert.alert('Error', 'Failed to submit report');
    }
  };

  return (
    <>
      {/* Report Modal */}
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Report Product</Text>
            <ScrollView style={{ flex: 1 }}>
              <Text style={styles.label}>Select Reason:</Text>
              {reasons.map((r, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.optionRow, selectedReason === r && styles.selectedOption]}
                  onPress={() => setSelectedReason(r)}
                >
                  <View style={[styles.radioOuter, selectedReason === r && styles.radioSelectedOuter]}>
                    {selectedReason === r && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.optionText}>{r}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.label}>Additional Details:</Text>
              <TextInput
                placeholder="Describe the issue..."
                style={styles.textInput}
                multiline
                value={reasonText}
                onChangeText={setReasonText}
              />

              <Text style={styles.label}>Upload Evidence (Optional):</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                <Text style={styles.uploadText}>Choose Image</Text>
              </TouchableOpacity>
              {image && <Image source={{ uri: `data:image/jpeg;base64,${image}` }} style={styles.previewImage} />}
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Report</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={successModal} animationType="fade" transparent onRequestClose={() => setSuccessModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.successContainer}>
            <Image source={require('../../../assets/Success.png')} style={styles.successImage} />
            <Text style={styles.successText}>Report Submitted Successfully!</Text>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => {
                setSuccessModal(false);
                onClose();
              }}
            >
              <Text style={styles.submitText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: '#fff', borderRadius: 16, padding: 16, height: 600 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12, color: '#111827', textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 12, marginBottom: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, marginBottom: 8 },
  selectedOption: { borderColor: '#3B82F6', backgroundColor: '#DBEAFE' },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#9CA3AF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioSelectedOuter: { borderColor: '#3B82F6' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' },
  optionText: { fontSize: 14, color: '#111827' },
  textInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 10, minHeight: 80, textAlignVertical: 'top' },
  uploadButton: { backgroundColor: '#3B82F6', padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 6, marginBottom: 12 },
  uploadText: { color: '#fff', fontWeight: '700' },
  previewImage: { width: '100%', height: 150, borderRadius: 12, marginBottom: 12 },
  submitButton: { backgroundColor: '#15803D', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeButton: { position: 'absolute', top: 12, right: 12, backgroundColor: '#3B82F6', padding: 6, borderRadius: 12 },
  successContainer: { width: '80%', backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center' },
  successImage: { width: 100, height: 100, marginBottom: 12 },
  successText: { fontSize: 18, fontWeight: '700', color: '#15803D', marginBottom: 12, textAlign: 'center' },
});
