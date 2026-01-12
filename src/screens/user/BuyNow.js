// src/screens/Users/BuyNowModal.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import BasketIcon from '../../../assets/basket.png';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';

const screenHeight = Dimensions.get('window').height;

// ----------------- Base64Image Component -----------------
const Base64Image = ({ base64, productId, style }) => {
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    const saveToFile = async () => {
      if (!base64) return;
      const fileUri = FileSystem.cacheDirectory + `${productId}.jpg`;
      try {
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
        await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setLocalUri(fileUri);
      } catch (err) {
        console.error('Error saving base64 image:', err);
      }
    };
    saveToFile();
  }, [base64]);

  if (!localUri)
    return (
      <View style={[style, styles.noImage]}>
        <Text style={styles.noImageText}>No Image</Text>
      </View>
    );

  return <Image source={{ uri: localUri }} style={style} />;
};

// ----------------- BuyNow Modal -----------------
export default function BuyNowModal({ visible, onClose, product }) {
  const navigation = useNavigation();

  const [quantity, setQuantity] = useState(1);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);

  const variations = useMemo(() => {
    if (!product?.variations) return [];
    return Object.keys(product.variations)
      .map((key) => ({ label: key, price: product.variations[key].price }))
      .sort((a, b) => parseFloat(a.label) - parseFloat(b.label));
  }, [product]);

  const enabledServices = useMemo(() => {
    if (!product?.services) return [];
    return Object.keys(product.services)
      .map((key) => product.services[key])
      .filter((s) => s.enabled);
  }, [product]);

  useEffect(() => {
    if (variations.length > 0) {
      setSelectedVariation(variations[0].label);
    }
  }, [variations]);

  const toggleService = (label) => {
    if (selectedServices.some((s) => s.label === label)) {
      setSelectedServices(selectedServices.filter((s) => s.label !== label));
    } else {
      const serviceObj = enabledServices.find((s) => s.label === label);
      if (serviceObj)
        setSelectedServices([
          ...selectedServices,
          { label: serviceObj.label, price: serviceObj.price },
        ]);
    }
  };

  const totalPrice = () => {
    if (!selectedVariation) return 0;
    const variationPrice =
      product.variations?.[selectedVariation]?.price || product.basePrice;
    const servicesPrice = selectedServices.reduce(
      (sum, s) => sum + (s.price || 0),
      0
    );
    return (variationPrice * quantity + servicesPrice).toFixed(2);
  };

const handleBuyNow = async () => {
  if (!auth.currentUser) {
    Alert.alert(
      'Login Required',
      'Please login first to continue your purchase.'
    );
    return;
  }

  if (!selectedVariation) {
    Alert.alert('Select Variation', 'Please select a product variation.');
    return;
  }

  try {
    const user = auth.currentUser;

    const variationPrice =
      product.variations?.[selectedVariation]?.price || product.basePrice;

    // Prepare the product object for checkout screen
    const productForCheckout = {
      id: product.id,
      productName: product.productName,
      productImage: product.imageBase64 || null,
      category: product.category || 'Uncategorized',
      basePrice: parseFloat(variationPrice),
      selectedVariation,
      selectedVariationPrice: parseFloat(variationPrice),
      selectedServices,
      quantity,
      uploadedBy: {
        uid: product.uploadedBy.uid,
        businessName: product.uploadedBy.businessName,
        email: product.uploadedBy.email,
        profileImage: product.uploadedBy.profileImage || null,
      },
    };

    // Navigate to checkout screen
    navigation.navigate('BuyNowCheckedOut', {
      product: productForCheckout,
    });

    onClose();
  } catch (error) {
    console.log('BuyNow error:', error);
    Alert.alert('Error', 'Failed to complete purchase.');
  }
};



  if (!product) return null;

  return (
    <Modal
      animationType="slide"
      visible={visible}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
<View style={styles.modalHeader}>
  <Text style={styles.modalTitle}>Buy Now</Text>
  <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
    <Text style={styles.closeText}>X</Text>
  </TouchableOpacity>
</View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.productRow}>
              {product.imageBase64 ? (
                <Base64Image
                  base64={product.imageBase64}
                  productId={product.id}
                  style={styles.productImage}
                />
              ) : (
                <View style={[styles.productImage, styles.noImage]}>
                  <Text style={styles.noImageText}>No Image</Text>
                </View>
              )}

              <View style={styles.productDetails}>
                <Text style={styles.productName}>{product.productName}</Text>
                <Text style={styles.productPrice}>₱ {product.basePrice} / kg</Text>

                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setQuantity((prev) => Math.max(prev - 1, 1))}
                  >
                    <Ionicons name="remove" size={20} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setQuantity((prev) => prev + 1)}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.totalPrice}>Total: ₱ {totalPrice()}</Text>
              </View>
            </View>

            {variations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Variations</Text>
                {variations.map((v, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.optionRow,
                      selectedVariation === v.label && styles.activeOption,
                    ]}
                    onPress={() =>
                      setSelectedVariation(
                        selectedVariation === v.label ? null : v.label
                      )
                    }
                  >
                    <View style={styles.radioOuter}>
                      {selectedVariation === v.label && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text style={styles.optionText}>
                      {v.label} (₱{v.price})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {enabledServices.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Optional Services</Text>
                {enabledServices.map((s, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.optionRow,
                      selectedServices.some((sel) => sel.label === s.label) &&
                        styles.activeOption,
                    ]}
                    onPress={() => toggleService(s.label)}
                  >
<View style={styles.radioOuter}>
  {selectedServices.some(sel => sel.label === s.label) && (
    <View style={styles.radioInner} />
  )}
</View>
                    <Text style={styles.optionText}>
                      {s.label} (₱{s.price})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.buyBtn} onPress={handleBuyNow}>
            <Image source={BasketIcon} style={styles.buyIcon} />
            <Text style={styles.buyText}>Buy Now</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

// ----------------- Styles -----------------
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
height: 'auto',    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  productRow: { flexDirection: 'row', marginBottom: 16 },
  productImage: { width: 120, height: 120, borderRadius: 12, marginRight: 12 },
  noImage: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e0e0' },
  noImageText: { color: '#777' },
  productDetails: { flex: 1 },
  productName: { fontSize: 18, fontWeight: '700', color: '#333' },
  productPrice: { fontSize: 16, fontWeight: '700', color: '#000', marginVertical: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  qtyBtn: { backgroundColor: '#1e3a8a', padding: 8, borderRadius: 10 },
  qtyText: { fontSize: 16, fontWeight: '700' },
  totalPrice: { fontSize: 18, fontWeight: '700', color: '#1e3a8a', marginTop: 4 },
  section: { marginVertical: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#555' },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  activeOption: { backgroundColor: '#fff', shadowOpacity: 0.1 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#1e3a8a', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1e3a8a' },
  checkbox: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#1e3a8a', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  optionText: { fontSize: 15, color: '#333' },
  buyBtn: { flexDirection: 'row', backgroundColor: '#1e3a8a', paddingVertical: 14, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  buyIcon: { width: 24, height: 24, marginRight: 8 },
  buyText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingTop: 12,
  paddingBottom: 8,
  borderBottomWidth: 1,
  borderBottomColor: '#e2e8f0',
  marginBottom: 10
},

modalTitle: {
  fontSize: 18,
  fontWeight: '700',
  color: '#1e3a8a',
},

closeBtn: {
  marginTop: 10,
  alignSelf: 'center',
  backgroundColor: '#1e3a8a', // make button visible
  padding: 8, // slightly larger touch area
  borderRadius: 50,
  width: 30,
  height: 30,
  justifyContent: 'center',
  alignItems: 'center',
  elevation: 3,
  marginLeft: 230,
  marginTop: -5 // optional shadow for Android
},
closeText: {
  color: '#fff', // white text for contrast
  fontWeight: '700',
  fontSize: 16, // bigger X
  margin: -5
},

});
