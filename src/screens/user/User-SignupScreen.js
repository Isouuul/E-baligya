import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  TextInput
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/* ------------------------- PROGRESS STEPS UI ------------------------- */
const ProgressSteps = ({ currentStep = 1 }) => {
  const steps = ['Step 1', 'Step 2', 'Step 3', 'Review'];

  return (
    <View style={styles.progressContainer}>
      {steps.map((label, idx) => {
        const step = idx + 1;
        const completed = step < currentStep;
        const active = step === currentStep;
        const circleColor = active || completed ? '#1E40AF' : '#CBD5E1';
        const lineColor = completed ? '#1E40AF' : '#E2E8F0';

        return (
          <React.Fragment key={idx}>
            <View style={styles.stepWrapper}>
              <View style={[styles.circle, { backgroundColor: circleColor }]}>
                <Text style={styles.circleText}>{step}</Text>
              </View>
              <Text style={styles.stepLabel}>{label}</Text>
            </View>

            {idx < steps.length - 1 && (
              <View style={[styles.line, { backgroundColor: lineColor }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

/* ------------------------- MAIN COMPONENT ------------------------- */
const UserSignupStep1 = ({ route, navigation }) => {
  const [govIDFront, setGovIDFront] = useState(null);
  const [govIDBack, setGovIDBack] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [ocrFields, setOcrFields] = useState({
    idNumber: '',
  });

  const currentStep = route?.params?.currentStep || 1;

  const pickImage = async (setter, scanFunc) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow gallery access.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });

      if (!result.canceled) {
        let uri = result.assets[0].uri;

        const manipulatedResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        uri = manipulatedResult.uri;

        setter(uri);
        if (scanFunc) scanFunc(uri);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const scanGovIDFront = async (imageUri) => {
    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append('image', { uri: imageUri, name: 'govid-front.jpg', type: 'image/jpeg' });

      const response = await fetch('http://192.168.8.116:3000/api/ocr/scan-id', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (data?.text) {
        setOcrText(data.text);
        const parsed = parseOCRText(data.text);
        setOcrFields(parsed);
      }
    } catch (err) {
      console.log('❌ OCR ERROR:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const scanGovIDBack = async (imageUri) => {
    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append('image', { uri: imageUri, name: 'govid-back.jpg', type: 'image/jpeg' });

      const response = await fetch('http://192.168.8.116:3000/api/ocr/scan-id', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (data?.text) {
        const idMatch = data.text.match(/\d{12,}/);
        if (idMatch) setOcrFields((prev) => ({ ...prev, idNumber: idMatch[0] }));
      }
    } catch (err) {
      console.log('❌ OCR Back ERROR:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const parseOCRText = (text) => {
    const result = { idNumber: '' };
    if (!text) return result;
    const idMatch = text.match(/\d{4}-\d{4}-\d{4}-\d{4}/);
    if (idMatch) result.idNumber = idMatch[0];
    return result;
  };

  const handleNext = async () => {
    if (!govIDFront || !govIDBack) {
      return Alert.alert('Missing Photos', 'Upload both front and back of your government ID.');
    }

    navigation.navigate('UserSignupStep2', {
      govIDFront,
      govIDBack,
      ocrFields,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>◀ </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Registration</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <ProgressSteps currentStep={currentStep} />

        <Text style={styles.title}>Identity Verification</Text>

        <Text style={styles.label}>Upload Government ID (Front)</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickImage(setGovIDFront, scanGovIDFront)}
        >
          <Text style={styles.uploadText}>{govIDFront ? 'Change File' : 'Choose File'}</Text>
        </TouchableOpacity>
        {govIDFront && <Image source={{ uri: govIDFront }} style={styles.imagePreview} />}

        {isScanning && <ActivityIndicator size="small" />}

        {ocrText !== '' && (
          <View style={{ marginTop: 15, padding: 15, borderRadius: 10, backgroundColor: '#E0F2FE' }}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Scanned ID Type</Text>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>ID Type</Text>
              <TextInput style={styles.fieldInput} value="PhilID" editable={false} />
              <Text style={styles.fieldLabel}>ID #</Text>
              <TextInput style={styles.fieldInput} value={ocrFields.idNumber} editable={false} />
            </View>
          </View>
        )}

        <Text style={styles.label}>Upload Government ID (Back)</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickImage(setGovIDBack, scanGovIDBack)}
        >
          <Text style={styles.uploadText}>{govIDBack ? 'Change File' : 'Choose File'}</Text>
        </TouchableOpacity>
        {govIDBack && <Image source={{ uri: govIDBack }} style={styles.imagePreview} />}
      </ScrollView>

      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextText}>Next Step</Text>
      </TouchableOpacity>
    </View>
  );
};

export default UserSignupStep1;

/* ------------------------- STYLES ------------------------- */
const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 140 },
  header: { backgroundColor: '#1E40AF', paddingTop: 50, paddingBottom: 15, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center' },
  backText: { backgroundColor: '#113be5ff', padding: 5, borderRadius: 5, color: '#fff', fontSize: 16, marginRight: 15 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20, textAlign: 'center', color: '#0F172A' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 15, color: '#1E293B' },
  uploadButton: { backgroundColor: '#2563EB', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  uploadText: { color: '#fff', fontWeight: '600' },
  imagePreview: { width: '100%', height: 200, borderRadius: 10, marginTop: 10, marginBottom: 10, resizeMode: 'cover' },
  nextButton: { position: 'absolute', bottom: 15, left: 20, right: 20, backgroundColor: '#1D4ED8', padding: 15, borderRadius: 12, alignItems: 'center' },
  nextText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, paddingTop: 10 },
  stepWrapper: { alignItems: 'center', width: 70 },
  circle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  circleText: { color: '#fff', fontWeight: '700' },
  stepLabel: { marginTop: 6, fontSize: 12, color: '#475569', textAlign: 'center' },
  line: { height: 3, flex: 1, marginHorizontal: 6, borderRadius: 2 },
  fieldWrapper: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, color: '#1E293B' },
  fieldInput: { backgroundColor: '#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', color: '#0F172A' },
});
