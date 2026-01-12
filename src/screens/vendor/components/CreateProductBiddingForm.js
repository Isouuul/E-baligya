import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase';
import { collection, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker';
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
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { classifyFish } from '../../../utils/nyckel';

const CreateProductBiddingForm = ({onCancel }) => {
  const auth = getAuth();
  const user = auth.currentUser;

  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [prediction, setPrediction] = useState(null);
const [isClassifying, setIsClassifying] = useState(false);
const [freshness, setFreshness] = useState(null); 
  const [imageUri, setImageUri] = useState(null);
const [imageBase64, setImageBase64] = useState(null);
const [newVariation, setNewVariation] = useState('');

const addNewVariation = () => {
  if (!newVariation || isNaN(newVariation)) return Alert.alert('Invalid Input', 'Enter a valid number for kg.');
  const key = `${parseFloat(newVariation)}kg`;
  if (variations[key]) return Alert.alert('Exists', 'This variation already exists.');
  
  setVariations(prev => ({
    ...prev,
    [key]: { enabled: false, price: '' },
  }));
  setNewVariation('');
};


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

  const [startingPrice, setStartingPrice] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState('');
  const [customDuration, setCustomDuration] = useState('');

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
setImageBase64(dataUri); // now this works
        
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


  const handleVariationChange = (key, price) => {
    setVariations(prev => ({ ...prev, [key]: { ...prev[key], price } }));
    const prices = Object.values({ ...variations, [key]: { ...variations[key], price } })
      .filter(v => v.enabled && v.price)
      .map(v => parseFloat(v.price));
    if (prices.length > 0) setStartingPrice(Math.min(...prices) - 20);
    else setStartingPrice(null);
  };

  const handleSubmit = async () => {
    if (!user) return Alert.alert('Auth Required', 'You must be logged in.');
    if (!productName || !category) return Alert.alert('Missing Info', 'Fill out Product Name and Category.');
    if (!quantity || parseFloat(quantity) <= 0) return Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
if (!imageBase64) return Alert.alert('Missing Image', 'Please upload an image of the product.');

    const cleanedVariations = Object.fromEntries(
      Object.entries(variations)
        .filter(([_, v]) => v.enabled && v.price)
        .map(([k, v]) => [k, { price: parseFloat(v.price) }])
    );

    setShowSuccessModal(true);
// automatically close after 2 seconds
setTimeout(() => {
  setShowSuccessModal(false);
  resetForm();
  onCancel?.();
}, 2000); // 2000ms = 2 seconds

    const cleanedServices = Object.fromEntries(
      Object.entries(services).map(([k, v]) => [k, { ...v, price: v.price ? parseFloat(v.price) : null }])
    );

    const durationMinutes = selectedDuration === 'other' ? parseInt(customDuration) : parseInt(selectedDuration);
    if (!durationMinutes) return Alert.alert('Missing Duration', 'Please set auction duration.');

    setIsSubmitting(true);

    try {
      const vendorQuery = query(collection(db, 'ApprovedVendors'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(vendorQuery);
      if (querySnapshot.empty) throw new Error('Vendor info not found.');

      const vendorDoc = querySnapshot.docs[0];
      const vendorData = vendorDoc.data();
      const businessName = vendorData.businessName || 'Unknown';
      const latitude = vendorData.latitude || null;
      const longitude = vendorData.longitude || null;

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

      const productData = {
        category,
        productName: productName.trim(),
        quantity: parseFloat(quantity),
        startingPrice,
        variations: cleanedVariations,
        services: cleanedServices,
        imageBase64,
        durationMinutes,
        location: { latitude, longitude },
        createdAt: new Date(),
        startTime,
        endTime,
        status: 'active',
        freshness: freshness || 'Unknown', // ✅ ADDED

        uploadedBy: {
          uid: user.uid,
          email: user.email,
          businessName,
          vendorProfileImage: vendorData.profileImage || null, // ✅ this line
        },
      };

      const productRef = doc(collection(db, 'Bidding_Products'));
      await setDoc(productRef, productData);

      setShowSuccessModal(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setProductName('');
    setQuantity('');
    setImageBase64(null);
    setCategory('');
    setVariations({
      '1kg': { enabled: false, price: '' },
      '2kg': { enabled: false, price: '' },
      '3kg': { enabled: false, price: '' },
      '4kg': { enabled: false, price: '' },
      '5kg': { enabled: false, price: '' },
    });
    setServices({
      cleaned: { label: 'Cleaned & Gutted', enabled: false, price: '' },
      filleted: { label: 'Filleted', enabled: false, price: '' },
      vacuum: { label: 'Vacuum Packed', enabled: false, price: '' },
    });
    setStartingPrice(null);
    setSelectedDuration('');
    setCustomDuration('');
    setImageUri(null);
setPrediction(null);
setFreshness(null);
  };

  const renderVariationRow = key => {
    const isSelected = variations[key].enabled;
    return (
      <View key={key} style={styles.row}>
        <TouchableOpacity
          style={styles.radioCircle}
          onPress={() => setVariations(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }))}
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
            onChangeText={txt => handleVariationChange(key, txt)}
          />
        )}
      </View>
    );
  };

  const renderServiceRow = serviceKey => (
    <View key={serviceKey} style={styles.row}>
      <View style={styles.rowLeft}>
        <TouchableOpacity
          style={styles.radioCircle}
          onPress={() => setServices(prev => ({ ...prev, [serviceKey]: { ...prev[serviceKey], enabled: !prev[serviceKey].enabled } }))}
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
          onChangeText={txt => setServices(prev => ({ ...prev, [serviceKey]: { ...prev[serviceKey], price: txt } }))}
        />
      )}
    </View>
  );

  const renderDurationOptions = () => {
    const options = ['20', '40', '60', 'other'];
    return options.map(opt => {
      const isSelected = selectedDuration === opt;
      return (
        <View key={opt} style={styles.durationRow}>
          <TouchableOpacity
            style={styles.radioCircle}
            onPress={() => setSelectedDuration(opt)}
          >
            {isSelected && <View style={styles.selectedRb} />}
          </TouchableOpacity>
          <Text style={styles.durationLabel}>
            {opt === 'other' ? 'Other' : `${opt} mins`}
          </Text>
          {opt === 'other' && isSelected && (
            <TextInput
              style={styles.otherDurationInput}
              placeholder="Enter minutes"
              keyboardType="numeric"
              value={customDuration}
              onChangeText={setCustomDuration}
            />
          )}
        </View>
      );
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      
      <Text style={styles.title}>Create Product</Text>

      <Text style={styles.sectionTitle}>Category</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={category} onValueChange={setCategory} style={styles.picker}>
          <Picker.Item label="Select Category" value="" />
          <Picker.Item label="Fish" value="Fish" />
          <Picker.Item label="Mollusk" value="Mollusk" />
          <Picker.Item label="Crustacean" value="Crustacean" />
          <Picker.Item label="Trend" value="Trend" />
        </Picker>
      </View>

      <Text style={styles.sectionTitle}>Product Name</Text>
      <TextInput style={styles.input} placeholder="Product Name" value={productName} onChangeText={setProductName} />

      <Text style={styles.sectionTitle}>Quantity (kg)</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter quantity in kg"
        keyboardType="numeric"
        value={quantity}
        onChangeText={setQuantity}
      />

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
      <Text style={styles.sectionTitle}>Starting Price</Text>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{startingPrice ? `₱${startingPrice}` : 'Set The Price on 1Kg'}</Text>

      <Text style={styles.sectionTitle}>Weight Variations</Text>
      {Object.keys(variations).map(renderVariationRow)}

      <View style={{ flexDirection: 'row', marginBottom: 10, width: '100%', maxWidth: 300 }}>
  <TextInput
    style={[styles.smallInput, { flex: 1 }]}
    placeholder="Add weight (kg)"
    keyboardType="numeric"
    value={newVariation}
    onChangeText={setNewVariation}
  />
  <TouchableOpacity
    style={[styles.addWeightButton, { flex: 0.4, marginLeft: 8 }]}
    onPress={addNewVariation}
  >
    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add</Text>
  </TouchableOpacity>
</View>


      <Text style={styles.sectionTitle}>Optional Services</Text>
      {Object.keys(services).map(renderServiceRow)}

      <View style={styles.durationContainer}>
        <Text style={styles.durationTitle}>Set Time for Bidding</Text>
        {renderDurationOptions()}
      </View>



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

      <Modal visible={showSuccessModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 15 }}>Product Uploaded Successfully!</Text>
            <Pressable
              style={[styles.submitButton, { backgroundColor: '#1e3a8a', marginTop: 0 }]}
              onPress={() => {
                setShowSuccessModal(false);
                resetForm();
                onCancel?.();
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default CreateProductBiddingForm;



// ...styles remain the same

const styles = StyleSheet.create({
  container: { alignItems: 'center', backgroundColor: '#fff', paddingBottom: 30 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 15, color: '#1e3a8a' },
  input: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 0, fontSize: 16, width: '100%', maxWidth: 300 },
  imgButton: { backgroundColor: '#1e3a8a', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 5, width: '100%', maxWidth: 300, marginTop: 10},
  previewImage: { width: 290, height: 180, borderRadius: 12, marginBottom: 10, borderWidth: 2, borderColor: "#f0f0f0" },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 20, marginBottom: 5, color: '#444', alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0', width: '100%', maxWidth: 300 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  smallInput: { backgroundColor: '#f0f0f0', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ccc', width: 120, fontSize: 14, marginLeft: 8 },
  radioCircle: { height: 20, width: 20, borderRadius: 10, borderWidth: 2, borderColor: '#1e3a8a', alignItems: 'center', justifyContent: 'center' },
  selectedRb: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' },
  submitButton: { width: '100%', maxWidth: 300, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginVertical: 10, backgroundColor: '#1e3a8a' },
  addWeightButton: { backgroundColor: '#1e3a8a', paddingVertical: 12, borderRadius: 12, marginBottom: 12, width: '100%', maxWidth: 300, alignItems: 'center' },
  modalOverlay: { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor:'#fff', borderRadius:12, padding:20, width:300, alignItems:'center' },
  pickerWrapper: { borderWidth:1, borderColor:'#f0f0f0', borderRadius:12, width:'100%', maxWidth:300,  },
  picker: { height:50, width:'100%' },
  durationContainer: { marginVertical: 20, width:'100%', maxWidth: 300 },
  durationTitle: { fontWeight:'bold', fontSize:16, marginBottom:10,},
  durationRow: { flexDirection:'row', alignItems:'center', marginBottom:10, backgroundColor:'#fff', paddingVertical:10, paddingHorizontal:12, borderRadius:12, borderWidth:1, borderColor:'#f0f0f0' },
  durationLabel: { marginLeft:8, fontSize:15 },
  otherDurationInput: { backgroundColor:'#f0f0f0', padding:8, marginLeft:8, width:100, borderRadius:8, borderWidth:1, borderColor:'#ccc' },
});
