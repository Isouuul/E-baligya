import React, { useState, useEffect, useMemo, useRef} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import BasketIcon from '../../../assets/basket.png';
import CheckOutSuccess from '../../../assets/CheckOutSuccess.png';
import * as FileSystem from "expo-file-system";

// Base64Image component for proper image rendering
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
        console.error("Error saving base64 image:", err);
      }
    };
    saveToFile();
  }, [base64]);

  if (!localUri) return (
    <View style={[style, styles.noImage]}>
      <Text style={styles.noImageText}>No Image</Text>
    </View>
  );

  return <Image source={{ uri: localUri }} style={style} />;
};

export default function AddingCartModal({
  visible,
  onClose,
  product,
  selectedVariation,
  setSelectedVariation,
  selectedServices,
  setSelectedServices,
  onAddToCart,
}) {
  const [quantity, setQuantity] = useState(1);
  const [successVisible, setSuccessVisible] = useState(false);

const slideAnim = useRef(new Animated.Value(300)).current;
const scaleAnim = useRef(new Animated.Value(0.5)).current;


  // Memoize variations to prevent infinite re-renders
  const variations = useMemo(() => {
    if (!product?.variations) return [];
    return Object.keys(product.variations)
      .map(key => ({ label: key, price: product.variations[key].price }))
      .sort((a, b) => parseFloat(a.label) - parseFloat(b.label));
  }, [product]);

  const enabledServices = useMemo(() => {
    if (!product?.services) return [];
    return Object.keys(product.services)
      .map(key => product.services[key])
      .filter(s => s.enabled);
  }, [product]);

  // Reset state / select first variation
  useEffect(() => {
    if (!visible) {
      setQuantity(1);
      setSelectedVariation(null);
      setSelectedServices([]);
    } else if (variations.length > 0) {
      setSelectedVariation(variations[0].label);
    }
  }, [visible, variations]);

  // Success animation
  useEffect(() => {
    if (successVisible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.2, friction: 3, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 300,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(() => setSuccessVisible(false));
      }, 1500);
    }
  }, [successVisible]);

  if (!product) return null;

  const toggleService = (label) => {
    if (selectedServices.some(s => s.label === label)) {
      setSelectedServices(selectedServices.filter(s => s.label !== label));
    } else {
      const serviceObj = enabledServices.find(s => s.label === label);
      if (serviceObj)
        setSelectedServices([...selectedServices, { label: serviceObj.label, price: serviceObj.price }]);
    }
  };

const handleAddToCart = async () => {
  if (!selectedVariation) return alert('Please select a variation');

  try {
const variationPrice = parseFloat(product.variations?.[selectedVariation]?.price) || parseFloat(product.basePrice) || 0;
const servicesPrice = selectedServices.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
const totalPriceValue = parseFloat((variationPrice * quantity + servicesPrice).toFixed(2));

const cartData = {
  userId: auth.currentUser?.uid || 'guest', // fallback
  productId: product.id,
  uploadedBy: {
    uid: product.uploadedBy?.uid || '',
    businessName: product.uploadedBy?.businessName || '',
    email: product.uploadedBy?.email || '',
    profileImage: product.uploadedBy?.profileImage || null,
  },
  productName: product.productName || 'Unnamed Product',
  basePrice: variationPrice,
  productImage: product.imageBase64 || null,
  category: product.category || 'Uncategorized',
  selectedVariation: selectedVariation || null,
  selectedServices: selectedServices || [],
  quantity: quantity || 1,
  totalPrice: totalPriceValue,
  createdAt: serverTimestamp(),
};


    await addDoc(collection(db, 'Carts', auth.currentUser.uid, 'items'), cartData);

    setSuccessVisible(true);
    onAddToCart && onAddToCart();
    onClose();
  } catch (err) {
    console.log(err);
    alert('Failed to add product to cart.');
  }
};

  const totalPrice = () => {
    if (!selectedVariation) return 0;
    const variationPrice = product.variations?.[selectedVariation]?.price || product.basePrice;
    const servicesPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
    return (variationPrice * quantity + servicesPrice).toFixed(2);
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent>
<StatusBar hidden />
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
<View style={styles.modalHeader}>
  <Text style={styles.modalTitle}>Add to Cart</Text>

  <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
    <Ionicons name="close" size={18} color="#fff" />
  </TouchableOpacity>
</View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.productRow}>
                <View style={{ position: 'relative' }}>
                  {product.imageBase64 ? (
                    <Base64Image base64={product.imageBase64} productId={product.id} style={styles.productImageRow} />
                  ) : (
                    <View style={[styles.productImageRow, styles.noImage]}>
                      <Text style={styles.noImageText}>No Image</Text>
                    </View>
                  )}

                  {product.category && (
                    <View style={styles.productCatgory}>
                      <Text style={styles.productCat}>{product.category}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.productDetailsRow}>
                  <Text style={styles.productName}>{product.productName}</Text>
                  <Text style={styles.productPrice}>₱ {product.basePrice} / kg</Text>

                  <View style={styles.qtyTotalRow}>
                    <View style={styles.quantityContainerRow}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => setQuantity(prev => Math.max(prev - 1, 1))}
                      >
                        <Ionicons name="remove" size={20} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{quantity}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => setQuantity(prev => prev + 1)}
                      >
                        <Ionicons name="add" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.totalTextRow}>₱ {totalPrice()}</Text>
                  </View>
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
                        setSelectedVariation(selectedVariation === v.label ? null : v.label)
                      }
                    >
                      <View style={styles.radioOuter}>
                        {selectedVariation === v.label && <View style={styles.radioInner} />}
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
                        selectedServices.some(sel => sel.label === s.label) && styles.activeOption,
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

            <TouchableOpacity style={styles.addBtn} onPress={handleAddToCart}>
              <Image source={BasketIcon} style={styles.addIcon} />
              <Text style={styles.addText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {successVisible && (
        <Animated.View
          style={[
            styles.successModal,
            { transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
          ]}
        >
          <Image
            source={CheckOutSuccess}
            style={{ width: 60, height: 60, resizeMode: 'contain' }}
          />
          <Text style={styles.successText}>Added to Cart!</Text>
        </Animated.View>
      )}
    </>
  );
}

// Styles remain unchanged


const styles = StyleSheet.create({
    overlay: {
    backgroundColor: 'rgba(0,0,0,0.5)', // semi-transparent black overlay
  },
  modalContainer: { height: 'auto', backgroundColor: '#f9f9f9', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 16, marginTop: 20},
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '700', color: '#1e3a8a' },
  productRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  productImageRow: { width: 100, height: 100, borderRadius: 12, marginRight: 12 },
  noImage: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e0e0' },
  productDetailsRow: { flex: 1, justifyContent: 'space-between' },
  productCatgory: { position: 'absolute', top: 4, left: 4, backgroundColor: '#1e3a8a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  productCat: { fontSize: 12, fontWeight: '600', color: '#fff' },
  qtyTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  quantityContainerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalTextRow: { fontSize: 25, fontWeight: '700', color: '#1e3a8a' },
  productName: { fontSize: 18, fontWeight: '700', color: '#333' },
  productPrice: { fontSize: 16, fontWeight: '700', color: '#000' },
  section: { marginVertical: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#555' },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  activeOption: { backgroundColor: '#fff', shadowOpacity: 0.1 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#1e3a8a', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1e3a8a' },
  checkbox: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#1e3a8a', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  optionText: { fontSize: 15, color: '#333' },
  qtyBtn: { backgroundColor: '#1e3a8a', padding: 8, borderRadius: 10 },
  qtyText: { fontSize: 16, fontWeight: '700' },
  addBtn: { flexDirection: 'row', backgroundColor: '#1e3a8a', paddingVertical: 14, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  addIcon: { width: 24, height: 24, marginRight: 8 },
  addText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingTop: 12,
  paddingBottom: 10,
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
  backgroundColor: '#1e3a8a',
  width: 30,
  height: 30,
  borderRadius: 50,
  justifyContent: 'center',
  alignItems: 'center',
  marginLeft: 200
},

  // Success Modal
  successModal: {
    position: 'absolute',
    bottom: 50,
    left: '10%',
    right: '10%',
    borderRadius: 20,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  successText: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 8 },
});
