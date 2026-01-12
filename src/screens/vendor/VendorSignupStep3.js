import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';


// ---------- Progress Circle UI ----------
const ProgressSteps = ({ currentStep = 3 }) => {
  const steps = ['Step 1', 'Step 2', 'Step 3', 'Review'];

  return (
    <View style={styles.progressContainer}>
      {steps.map((label, idx) => {
        const stepNumber = idx + 1;
        const active = stepNumber === currentStep;
        const completed = stepNumber < currentStep;

        return (
          <React.Fragment key={idx}>
            <View style={styles.stepWrapper}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: active || completed ? '#2563EB' : '#cbd5e1',
                    transform: [{ scale: active ? 1.15 : 1 }],
                  },
                ]}
              >
                <Text style={styles.circleText}>{stepNumber}</Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  { color: active ? '#2563EB' : '#64748b' },
                ]}
              >
                {label}
              </Text>
            </View>

            {idx !== steps.length - 1 && (
              <View
                style={[
                  styles.line,
                  { backgroundColor: completed ? '#2563EB' : '#e5e7eb' },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

// ---------- MAIN COMPONENT ----------
const VendorSignupStep3 = ({ route, navigation }) => {
  const {
    businessType,
    marketName,
    latitude,
    longitude,
    govIDFront,
    govIDBack,
    businessPermit,
    businessName,
    ownerName,
    email,
    phone,
    password,
    birthday,
    gender,
    selectedProvince,
    selectedCity,
    selectedBarangay,
    streetName,
    ocrFields,           // ✅ add OCR info (PhilID)
    businessPermitNumber, // ✅ add Business Number
  } = route.params;

  const currentStep = 3;
  const [selfie, setSelfie] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  const showAlert = (msg) => {
    setModalMessage(msg);
    setModalVisible(true);
  };
  
const pickSelfie = async () => {
  const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
  if (!permissionResult.granted)
    return showAlert('Camera permission is required!');

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (!result.canceled) {
    const uri = result.assets[0].uri;
    setSelfie(uri);

    // Prepare file for backend
    const fileInfo = await FileSystem.getInfoAsync(uri);
    console.log('File info for backend upload:', fileInfo);
    // You will send this file to your backend for Onfido verification
  }
};


  const handleNext = () => {
    if (!selfie) return showAlert('Please take a selfie before proceeding.');

    navigation.navigate('VendorSignupReview', {
      businessType,
      marketName,
      latitude,
      longitude,
      govIDFront,
      govIDBack,
      businessPermit,
      ocrFields,           // ✅ add OCR info (PhilID)
      businessPermitNumber, // ✅ add Business Number
      businessName,
      ownerName,
      email,
      phone,
      password,
      birthday,
      gender,
      selectedProvince,
      selectedCity,
      selectedBarangay,
      streetName,
      selfie,
      
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>

<View style={styles.header}>
  <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
    <Text style={styles.backButtonText}>◀ Back</Text>
  </TouchableOpacity>
  <Text style={styles.headerTitle}>Vendor Registration</Text>
</View>

      <ProgressSteps currentStep={currentStep} />

      <Text style={styles.title}>Take Your Selfie</Text>

      <View style={styles.card}>
        {selfie ? (
          <Image source={{ uri: selfie }} style={styles.selfiePreview} />
        ) : (
          <Text style={styles.placeholderText}>No selfie taken yet</Text>
        )}

        <TouchableOpacity style={styles.button} onPress={pickSelfie}>
          <Text style={styles.buttonText}>
            {selfie ? 'Retake Selfie' : 'Take Selfie'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextText}>Next Step</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>⚠️ Attention</Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default VendorSignupStep3;

// ---------- STYLES ----------
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f1f5f9',
  },

/* HEADER - SAME AS STEP 1 */
header: {
  backgroundColor: '#1E40AF', // dark blue
  paddingTop: 50,
  paddingBottom: 15,
  paddingHorizontal: 20,
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 20,
  width: 377,
  marginLeft: -20,
  marginTop: -40,

},
backButton: {
  backgroundColor: '#113be5ff',
  padding: 6,
  borderRadius: 6,
  marginRight: 15,
  marginTop: 20

},
backButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
headerTitle: {
  flex: 1,
  textAlign: 'center',
  color: '#fff',
  fontSize: 20,
  fontWeight: '700',
  marginTop: 20
},


  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 18,
    color: '#1e293b',
  },

  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    alignItems: 'center',
  },

  selfiePreview: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 20,
  },

  placeholderText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 20,
  },

  button: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  nextButton: {
    backgroundColor: '#16a34a',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  nextText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  // PROGRESS UI
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  stepWrapper: { alignItems: 'center', width: 90 },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  circleText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  stepLabel: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  line: { height: 3, flex: 1, marginHorizontal: 6, borderRadius: 2 },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 30,
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 22,
    alignItems: 'center',
    elevation: 7,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#d97706',
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 14,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
