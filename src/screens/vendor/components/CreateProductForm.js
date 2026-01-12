import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase';
import { collection, doc, setDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import { classifyFish } from '../../../utils/nyckel';



const CreateProductForm = ({ onCancel }) => {
  const auth = getAuth();
  const user = auth.currentUser;

  const [productName, setProductName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [category, setCategory] = useState('');
  const [prediction, setPrediction] = useState(null);
const [isClassifying, setIsClassifying] = useState(false);
const [freshness, setFreshness] = useState(null); // ✅ add this at the top


  const [variations, setVariations] = useState({
    '1kg': { enabled: false, price: '' },
    '2kg': { enabled: false, price: '' },
    '3kg': { enabled: false, price: '' },
    '4kg': { enabled: false, price: '' },
    '5kg': { enabled: false, price: '' },
  });

  const [services, setServices] = useState({
    cleaned: { label: 'Cleaned & Gutted', enabled: false, price: '' },
    filleted: { label: 'Filleted', enabled: false, price: '' },
    vacuum: { label: 'Vacuum Packed', enabled: false, price: '' },
  });

  const [vendorData, setVendorData] = useState(null);

  // Fetch vendor data
  useEffect(() => {
    const fetchVendor = async () => {
      if (!user) return;
      try {
        const vendorQuery = query(collection(db, 'ApprovedVendors'), where('userId', '==', user.uid));
        const snapshot = await getDocs(vendorQuery);
        if (!snapshot.empty) setVendorData(snapshot.docs[0].data());
      } catch (err) {
        console.error('Error fetching vendor data:', err);
      }
    };
    fetchVendor();
  }, []);

    // ✅ ADDED: function to detect freshness
  const detectFreshness = (label) => { // ✅ ADDED
    if (!label) return 'Unknown';
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('fresh')) return 'Fresh';
    if (lowerLabel.includes('rotten')) return 'Rotten';
    return 'Unknown';
  }; // ✅ ADDED


const pickImage = async () => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setImageUri(uri); // show image

      // -------------------------------
      // Nyckel classification starts here
      // -------------------------------
      setIsClassifying(true);
      try {
        // Convert image to Base64
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const dataUri = `data:image/jpeg;base64,${base64}`;

        console.log('Sending to Nyckel function:', dataUri.substring(0, 50) + '...');

        // Call Nyckel API
        const data = await classifyFish(dataUri);
        console.log('Nyckel function result:', data);
if (data) {
  setPrediction({               // ✅ ADD THIS
    label: data.labelName,
    confidence: data.confidence,
  });

  let freshnessResult = 'Unknown';

  // Check the returned label for "fresh" or "rotten"
  if (data.labelName?.toLowerCase().includes('fresh')) freshnessResult = 'Fresh';
  else if (data.labelName?.toLowerCase().includes('rotten')) freshnessResult = 'Rotten';

  setFreshness(`Freshness: ${freshnessResult}`);
  console.log('Detected freshness:', freshnessResult);

  // Auto-set category if it's a fish
  setCategory('Fish');

} else {
  console.log('No valid data returned by Nyckel function');
  setFreshness('Freshness: Unknown');
}


      } catch (err) {
        console.error('Nyckel API error:', err);
        Alert.alert('Error', 'Failed to classify fish.');
      } finally {
        setIsClassifying(false);
      }
      // -------------------------------
      // Nyckel classification ends here
      // -------------------------------
    }
  } catch (err) {
    console.error('Pick Image Error:', err);
    Alert.alert('Error', 'Failed to pick or process image.');
  }
};






  // Convert image to Base64
  const convertImageToBase64 = async (uri) => {
    if (!uri) return null;
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      return `data:image/jpeg;base64,${base64}`;
    } catch (err) {
      console.error('Base64 conversion error:', err);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!user) return Alert.alert('Auth Required', 'You must be logged in.');
    if (!productName || !category) return Alert.alert('Missing Info', 'Fill Product Name and Category.');
    if (!imageUri) return Alert.alert('Missing Image', 'Please select a product image.');

    const cleanedVariations = Object.fromEntries(
      Object.entries(variations)
        .filter(([_, v]) => v.enabled && v.price)
        .map(([k, v]) => [k, { price: parseFloat(v.price) }])
    );

    const cleanedServices = Object.fromEntries(
      Object.entries(services).map(([k, v]) => [
        k,
        { ...v, price: v.price ? parseFloat(v.price) : null },
      ])
    );

    setIsSubmitting(true);
    

    try {
      if (!vendorData) {
        Alert.alert('Error', 'Vendor info not loaded yet.');
        setIsSubmitting(false);
        return;
      }

      // Convert image to Base64
      const imageBase64 = await convertImageToBase64(imageUri);

      const productData = {
        category,
        productName: productName.trim(),
        basePrice: basePrice ? parseFloat(basePrice) : null,
        quantityKg: quantityKg ? parseFloat(quantityKg) : null,
        variations: cleanedVariations,
        services: cleanedServices,
        createdAt: Timestamp.now(),
        imageBase64, // ✅ Stored directly in Firestore
        location: {
          latitude: vendorData.latitude || null,
          longitude: vendorData.longitude || null,
        },
        uploadedBy: {
          uid: user.uid,
          email: user.email,
          businessName: vendorData.businessName || 'Unknown',
          vendorProfileImage: vendorData.profileImage || null, // ✅ this line
                  freshness: freshness || 'Unknown', // ✅ ADDED

        },
      };

      const productRef = doc(collection(db, 'Products'));
      await setDoc(productRef, productData);

      Alert.alert('Success ✅', `Product uploaded successfully by ${vendorData.businessName}`);
      onCancel?.();
    } catch (err) {
      console.error('Firestore error:', err);
      Alert.alert('Error', 'Something went wrong while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderVariationRow = (key) => {
    const isSelected = variations[key].enabled;
    return (
      <View key={key} style={styles.row}>
        <TouchableOpacity
          style={styles.radioCircle}
          onPress={() =>
            setVariations(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }))
          }
        >
          {isSelected && <View style={styles.selectedRb} />}
        </TouchableOpacity>
        <Text style={{ marginLeft: 8 }}>{key}</Text>
        {isSelected && (
          <TextInput
            style={[styles.smallInput, { marginLeft: 8 }]}
            placeholder="Price"
            keyboardType="numeric"
            value={variations[key].price}
            onChangeText={(txt) => setVariations(prev => ({ ...prev, [key]: { ...prev[key], price: txt } }))}
          />
        )}
      </View>
    );
  };

  const renderServiceRow = (serviceKey) => (
    <View key={serviceKey} style={styles.row}>
      <View style={styles.rowLeft}>
        <TouchableOpacity
          style={styles.radioCircle}
          onPress={() =>
            setServices(prev => ({ ...prev, [serviceKey]: { ...prev[serviceKey], enabled: !prev[serviceKey].enabled } }))
          }
        >
          {services[serviceKey].enabled && <View style={styles.selectedRb} />}
        </TouchableOpacity>
        <Text style={{ marginLeft: 8 }}>{services[serviceKey].label}</Text>
      </View>
      {services[serviceKey].enabled && (
        <TextInput
          style={[styles.smallInput, { marginLeft: 8 }]}
          placeholder="Addon Price"
          keyboardType="numeric"
          value={services[serviceKey].price}
          onChangeText={(txt) => setServices(prev => ({ ...prev, [serviceKey]: { ...prev[serviceKey], price: txt } }))}
        />
      )}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        onPress={onCancel}
        style={{ backgroundColor: '#B0BEC5', marginTop: 10, width: 30, borderRadius: 60, height: 30, marginLeft: 255, bottom:10}}
      >
        <Text style={{ color: '#fff', fontSize: 25, marginLeft:7.5}}>X</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Create Product</Text>

      <View style={styles.pickerWrapper}>
        <Picker selectedValue={category} onValueChange={setCategory} style={styles.picker}>
          <Picker.Item label="Select Category" value="" />
          <Picker.Item label="Fish" value="Fish" />
          <Picker.Item label="Mollusk" value="Mollusk" />
          <Picker.Item label="Crustacean" value="Crustacean" />
          <Picker.Item label="Trend" value="Trend" />
        </Picker>
      </View>

      <TextInput style={styles.input} placeholder="Product Name" value={productName} onChangeText={setProductName} />
      <TextInput style={styles.input} placeholder="Base Price" value={basePrice} onChangeText={setBasePrice} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="Stock Quantity (kg)" value={quantityKg} onChangeText={setQuantityKg} keyboardType="numeric" />

      <Pressable onPress={pickImage} style={styles.imgButton}>
        <Text style={{ color: '#fff' }}>Select Image</Text>
      </Pressable>

      {imageUri && <Image source={{ uri: imageUri }} style={styles.previewImage} />}
      {isClassifying && <Text style={{ marginTop: 10 }}>Classifying fish...</Text>}
      {prediction && (
        <Text style={{ marginTop: 10 }}>
          Prediction: {prediction.label} ({(prediction.confidence * 100).toFixed(1)}%)
        </Text>
      )}

      {/* ✅ ADDED: display freshness */}
      {freshness && (
        <Text style={{ marginTop: 10 }}>
         {freshness}
        </Text>
      )}
      <Text style={styles.sectionTitle}>Weight Variations</Text>
      {Object.keys(variations).map(renderVariationRow)}

      <Text style={styles.sectionTitle}>Optional Services</Text>
      {Object.keys(services).map(renderServiceRow)}

<Pressable
  onPress={handleSubmit}
  style={[
    styles.submitButton,
    {
      opacity: isSubmitting || freshness === 'Freshness: Rotten' ? 0.5 : 1,
      backgroundColor: freshness === 'Freshness: Rotten' ? '#9E9E9E' : '#1e3a8a', // optional color change
    },
  ]}
  disabled={isSubmitting || freshness === 'Freshness: Rotten'}
>
  <Text style={{ color: '#fff', fontWeight: 'bold' }}>
    {isSubmitting ? 'Submitting...' : 'Submit'}
  </Text>
</Pressable>

{/* Show warning if fish is rotten */}
{freshness === 'Freshness: Rotten' && (
  <Text style={{ color: 'red', marginTop: 10 }}>
    You need to upload a fresh fish to submit.
  </Text>
)}

    </ScrollView>
  );
};

export default CreateProductForm;

// Styles remain the same
const styles = StyleSheet.create({
  container: { alignItems: 'center', backgroundColor: '#fff', paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 15, color: '#1e3a8a' },
  input: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1e3a8a', marginBottom: 12, fontSize: 16, width: '100%', maxWidth: 300 },
  pickerWrapper: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#1e3a8a', marginBottom: 12, width: '100%', maxWidth: 300, overflow: 'hidden' },
  picker: { width: '100%', height: 50 },
  imgButton: { backgroundColor: '#1e3a8a', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 12, width: '100%', maxWidth: 300 },
  previewImage: { width: 300, height: 180, borderRadius: 12, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 20, marginBottom: 10, color: '#444', alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1e3a8a', width: '100%', maxWidth: 300 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  smallInput: { backgroundColor: '#f0f0f0', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#1e3a8a', width: 110, fontSize: 14 },
  radioCircle: { height: 20, width: 20, borderRadius: 10, borderWidth: 2, borderColor: '#1e3a8a', alignItems: 'center', justifyContent: 'center' },
  selectedRb: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' },
  submitButton: { width: '100%', maxWidth: 300, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#1e3a8a', marginTop: 15 },
});
