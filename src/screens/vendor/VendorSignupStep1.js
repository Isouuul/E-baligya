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
  Platform,
  TextInput
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { storage } from '../../firebase';
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
const VendorSignupStep1 = ({ route, navigation }) => {
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [govIDFront, setGovIDFront] = useState(null);
  const [govIDBack, setGovIDBack] = useState(null);
const [businessPermit, setBusinessPermit] = useState(null);
const [businessPermitNumber, setBusinessPermitNumber] = useState('');
const [isScanningBP, setIsScanningBP] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [ocrFields, setOcrFields] = useState({
  idNumber: '',
});


  const [isScanning, setIsScanning] = useState(false);

  const businessType = 'Seafood';
  const currentStep = route?.params?.currentStep || 1;

  const marketOptions = [
    { name: 'Bacolod Central Market', latitude: 10.66761, longitude: 122.94719 },
    { name: 'Libertad Public Market', latitude: 10.66012, longitude: 122.94971 },
    { name: 'Bacolod North (Burgos) Market', latitude: 10.66891, longitude: 122.95498 },
    { name: 'Sum-ag Public Market', latitude: 10.60353, longitude: 122.92110 },
    { name: 'Granada Public Market', latitude: 10.66576, longitude: 123.03425 },
    { name: 'Mansilingan Public Market', latitude: 10.63160, longitude: 122.97520 },
    { name: 'Villamonte Public Market', latitude: 10.66879, longitude: 122.96470 },
    { name: 'North Capitol Road (Pala-Pala Market)', latitude: 10.66369, longitude: 122.93918 },
  ];




const pickImage = async (setter) => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow gallery access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaType.Images,
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
      scanGovIDFront(uri); // ✅ OCR + business number extraction happens here
    }
  } catch (err) {
    console.error('Image picker error:', err);
    Alert.alert('Error', 'Failed to pick image.');
  }
};

const PickImageBack = async () => {
  try {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow gallery access.');
      return;
    }
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images, // correct!
  quality: 0.7,
  allowsEditing: true,
});

    if (!result.canceled) {
      let uri = result.assets[0].uri;

      // Resize & compress image for OCR
      const manipulatedResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      uri = manipulatedResult.uri;

      // Set state
      setGovIDBack(uri);

      // Trigger back OCR
      scanGovIDBack(uri);
    }
  } catch (err) {
    console.error('PickImageBack error:', err);
    Alert.alert('Error', 'Failed to pick back image.');
  }
};

const pickBusinessPermit = async () => {
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
      setBusinessPermit(uri);

      // Scan the image
      scanBusinessPermit(uri);
    }
  } catch (err) {
    console.error('Business Permit pick error:', err);
    Alert.alert('Error', 'Failed to pick Business Permit image.');
  }
};



const scanGovIDFront = async (imageUri) => {
  console.log('📸 OCR started');
  console.log('Image URI:', imageUri);

  setIsScanning(true);

  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    name: 'govid-front.jpg',
    type: 'image/jpeg',
  });

  try {
    console.log('📡 Sending image to OCR backend...');

    const response = await fetch('http://192.168.8.116:3000/api/ocr/scan-id', {
      method: 'POST',
      body: formData,
    });

    console.log('📥 Response status:', response.status);

    const data = await response.json();
    console.log('📄 OCR response:', data);

    if (data?.text) {
      setOcrText(data.text);

      // Parse ID fields
      const parsed = parseOCRText(data.text);

      // Extract Business Name Number
      const businessNumber = extractBusinessNumber(data.text);

      setOcrFields({
        ...parsed,
        businessNumber: businessNumber, // ✅ add to state
        idType: 'PhilID', // optional
      });
    } else {
      console.log('⚠️ No text returned from OCR');
    }
  } catch (err) {
    console.log('❌ OCR ERROR:', err);
  } finally {
    setIsScanning(false);
    console.log('🛑 OCR finished');
  }
};


const scanGovIDBack = async (imageUri) => {
  console.log('📸 OCR (Back) started');
  console.log('Image URI:', imageUri);

  setIsScanning(true);

  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    name: 'govid-back.jpg',
    type: 'image/jpeg',
  });

  try {
    const response = await fetch('http://192.168.8.116:3000/api/ocr/scan-id', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    console.log('📄 OCR Back response:', data);

    if (data?.text) {
      // Extract ID number from back (usually below barcode)
const idMatch = data.text.match(/\d{12,}/); // match 12 or more digits
if (idMatch) {
  setOcrFields((prev) => ({
    ...prev,
    idNumber: idMatch[0],
  }));
}


      // Optionally set ID type (if backend detects it)
      setOcrFields((prev) => ({
        ...prev,
        idType: 'PhilID', // or dynamically detect from backend
      }));
    }
  } catch (err) {
    console.log('❌ OCR Back ERROR:', err);
  } finally {
    setIsScanning(false);
    console.log('🛑 OCR Back finished');
  }
};

const scanBusinessPermit = async (imageUri) => {
  setIsScanningBP(true);
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    name: 'business-permit.jpg',
    type: 'image/jpeg',
  });

  try {
    const response = await fetch('http://192.168.8.116:3000/api/ocr/scan-id', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    console.log('📄 Business Permit OCR:', data);

    if (data?.text) {
      const businessNumber = extractBusinessNumber(data.text);
      setBusinessPermitNumber(businessNumber);
    }
  } catch (err) {
    console.error('❌ OCR Business Permit ERROR:', err);
    Alert.alert('Error', 'Failed to scan Business Permit.');
  } finally {
    setIsScanningBP(false);
  }
};




const parseOCRText = (text) => {
  const result = {
    idNumber: '',
  };

  if (!text) return result;

  // ------------------------ ID NUMBER ------------------------
  const idMatch = text.match(/\d{4}-\d{4}-\d{4}-\d{4}/);
  if (idMatch) result.idNumber = idMatch[0];

  return result;
};


const extractBusinessNumber = (text) => {
  const match = text.match(/Business Name No\.\s*(\d+)/i);
  return match ? match[1] : '';
};








  /* ------------------------- NEXT STEP ------------------------- */
const handleNext = async () => {
  if (isLoading) return;

  if (!selectedMarket)
    return Alert.alert('Missing Field', 'Please select your market.');

  if (!govIDFront || !govIDBack || !businessPermit)
    return Alert.alert('Missing Photos', 'Upload all required images.');

  setIsLoading(true);

  try {
    navigation.navigate('VendorSignupStep2', {
      businessType,
      marketName: selectedMarket.name,
      latitude: selectedMarket.latitude,
      longitude: selectedMarket.longitude,
      govIDFront,
      govIDBack,
      businessPermit,
      ocrFields,           // ✅ PhilID OCR info
      businessPermitNumber, // ✅ Business Name Number
    });
  } catch (err) {
    console.error('Navigation failed:', err);
    Alert.alert('Error', 'Please try again.');
  } finally {
    setIsLoading(false);
  }
};


  

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      
      {/* ---------- HEADER WITH BACK BUTTON ---------- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>◀ </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendor Registration</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <ProgressSteps currentStep={currentStep} />

        <Text style={styles.title}>Vendor Identity Verification</Text>

        <Text style={styles.label}>Business Type</Text>
        <Text style={styles.fixedValue}>{businessType}</Text>

        <Text style={styles.label}>Choose Your Market</Text>

        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedMarket?.name ?? ""}
            onValueChange={(value) => {
              const market = marketOptions.find((m) => m.name === value);
              setSelectedMarket(market || null);
            }}
          >
            <Picker.Item label="-- Select Market --" value="" />
            {marketOptions.map((market, i) => (
              <Picker.Item key={i} label={market.name} value={market.name} />
            ))}
          </Picker>
        </View>

        {selectedMarket && (
          <View style={styles.coordBox}>
            <Text style={styles.coordText}>
              Latitude: {selectedMarket.latitude}
            </Text>
            <Text style={styles.coordText}>
              Longitude: {selectedMarket.longitude}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Upload Government ID (Front)</Text>
        <TouchableOpacity
          style={styles.uploadButton}
onPress={async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: true,
  });

  if (!result.canceled) {
    const uri = result.assets[0].uri;
    setGovIDFront(uri);
    scanGovIDFront(uri); // 👈 OCR applied HERE
  }
}}          
disabled={isLoading}
        >
          <Text style={styles.uploadText}>
            {govIDFront ? 'Change File' : 'Choose File'}
          </Text>
        </TouchableOpacity>
        {govIDFront && <Image source={{ uri: govIDFront }} style={styles.imagePreview} />}

{isScanning && <ActivityIndicator size="small" />}

{ocrText !== '' && (
  <View style={{ marginTop: 15, padding: 15, borderRadius: 10, backgroundColor: '#E0F2FE' }}>
    <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Scanned ID Type</Text>

    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>ID Type</Text>
      <TextInput
        style={styles.fieldInput}
        value="PhilID"
        editable={false}
      />

      <View style={styles.fieldWrapper}>
         <Text style={styles.fieldLabel}>ID #</Text> 
         <TextInput style={styles.fieldInput} value={ocrFields.idNumber} editable={false} /> 
      </View>
    </View>
  </View>
)}





        <Text style={styles.label}>Upload Government ID (Back)</Text>
<TouchableOpacity
  style={styles.uploadButton}
  onPress={PickImageBack}
  disabled={isLoading}
>
  <Text style={styles.uploadText}>
    {govIDBack ? 'Change File' : 'Choose File'}
  </Text>
</TouchableOpacity>

        {govIDBack && <Image source={{ uri: govIDBack }} style={styles.imagePreview} />}

{govIDBack && ocrFields.idNumber !== '' && (
  <View style={{ marginTop: 15, padding: 15, borderRadius: 10, backgroundColor: '#FEF3C7' }}>
    <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>PhilID Barcode Number</Text>
    <Text style={{ fontSize: 16, color: '#92400E' }}>
      {ocrFields.idNumber}
    </Text>
  </View>
)}

       <Text style={styles.label}>Upload Business Permit</Text>
<TouchableOpacity
  style={styles.uploadButton}
  onPress={pickBusinessPermit}
  disabled={isLoading}
>
  <Text style={styles.uploadText}>
    {businessPermit ? 'Change File' : 'Choose File'}
  </Text>
</TouchableOpacity>

{businessPermit && <Image source={{ uri: businessPermit }} style={styles.imagePreview} />}

{businessPermitNumber !== '' && (
  <View style={{ marginTop: 15, padding: 15, borderRadius: 10, backgroundColor: '#D1FAE5' }}>
    <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 6 }}>Business Name Number</Text>
    <Text style={{ fontSize: 16, color: '#065F46' }}>
      {businessPermitNumber}
    </Text>
  </View>
)}

{isScanningBP && <ActivityIndicator size="small" />}


      </ScrollView>

      <TouchableOpacity
        style={[styles.nextButton, isLoading && styles.nextButtonDisabled]}
        onPress={handleNext}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.nextText}>Next Step</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default VendorSignupStep1;

/* ------------------------- STYLES ------------------------- */
const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 140 },

  /* HEADER */
  header: {
    backgroundColor: '#1E40AF',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    backgroundColor: '#113be5ff',
    padding: 5,
    borderRadius: 5,
    color: '#fff',
    fontSize: 16,
    marginRight: 15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: '#0F172A',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 15,
    color: '#1E293B',
  },
  fixedValue: {
    padding: 12,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 14,
    overflow: 'hidden',
  },
  coordBox: {
    backgroundColor: '#E0F2FE',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  coordText: {
    color: '#0F172A',
    fontWeight: '500',
  },
  uploadButton: {
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  uploadText: {
    color: '#fff',
    fontWeight: '600',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 10,
    resizeMode: 'cover',
  },
  nextButton: {
    position: 'absolute',
    bottom: 15,
    left: 20,
    right: 20,
    backgroundColor: '#1D4ED8',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  nextText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  stepWrapper: {
    alignItems: 'center',
    width: 70,
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    color: '#fff',
    fontWeight: '700',
  },
  stepLabel: {
    marginTop: 6,
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
  },
  line: {
    height: 3,
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 2,
  },

    fieldWrapper: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1E293B',
  },
  fieldInput: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    color: '#0F172A',
  },
});
