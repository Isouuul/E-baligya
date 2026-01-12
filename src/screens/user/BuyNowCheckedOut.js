// src/screens/Users/BuyNowCheckedOut.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth, db } from '../../firebase';
import * as FileSystem from 'expo-file-system';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import WarningIcon from '../../../assets/warning.png';

// ----------------- Base64Image Component -----------------
const Base64Image = ({ base64, productId, style }) => {
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    if (!base64) return;
    const saveToFile = async () => {
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

  if (!localUri) return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}>
      <Text style={{ color: '#777' }}>No Image</Text>
    </View>
  );

  return <Image source={{ uri: localUri }} style={style} />;
};

// ----------------- BuyNowCheckedOut -----------------
export default function BuyNowCheckedOut() {
  const navigation = useNavigation();
  const route = useRoute();
  const product = route.params?.product || null; // single product

  const [paymentMethod, setPaymentMethod] = useState('Cash-On-Delivery');
  const [deliveryMethod, setDeliveryMethod] = useState('Delivery');
  const [leaveNote, setLeaveNote] = useState('');
  const [address, setAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const SHIPPING_FEE = 50;

  const generateOrderNumber = () => `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Fetch user address
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const addressesRef = collection(db, 'Users-Address', user.uid, 'addresses');
    const q = query(addressesRef, where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, snapshot => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        setAddress({
          id: snapshot.docs[0].id,
          fullName: `${docData.firstName || ''} ${docData.lastName || ''}`.trim(),
          fullAddress: `${docData.streetName || ''}, ${docData.barangay || ''}, ${docData.city || ''}, ${docData.province || ''}, ${docData.region || ''}`,
          contactNumber: docData.phoneNumber || '',
          latitude: docData.latitude || null,
          longitude: docData.longitude || null,
        });
      } else {
        setAddress(null);
      }
      setLoadingAddress(false);
    }, error => {
      console.error('Error fetching address:', error);
      setLoadingAddress(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params?.selectedAddress) {
        setAddress(route.params.selectedAddress);
      }
    });
    return unsubscribe;
  }, [navigation, route.params?.selectedAddress]);

const subtotal = product
  ? (Number(product.selectedVariationPrice || product.basePrice || 0) +
     (product.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0)
    ) * (product.quantity || 1)
  : 0;
const totalAmount = subtotal + (deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0);

  if (!product) {
    return (
      <View style={styles.center}>
        <Image source={WarningIcon} style={{ width: 80, height: 80, marginBottom: 15 }} resizeMode="contain" />
        <Text style={styles.emptyText}>No product selected for checkout</Text>
        <TouchableOpacity
          style={styles.browseButton}
          onPress={() => navigation.navigate('ConsumerTabs', { screen: 'Product' })}
        >
          <Text style={styles.browseText}>Browse Products</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCheckout = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (deliveryMethod === 'Delivery' && !address) {
      Alert.alert('Address Required', 'Please select a delivery address to proceed.', [{ text: 'OK' }]);
      return;
    }

    setLoadingCheckout(true);

    try {
      const userRef = doc(db, 'Users', user.uid);
      const userSnap = await getDoc(userRef);
      let userData = {};
      if (userSnap.exists()) {
        const data = userSnap.data();
        userData = {
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          profileImage: data.profileImage || null,
        };
      }

      const orderData = {
        orderNumber: generateOrderNumber(),
        userId: user.uid,
        userFirstName: userData.firstName,
        userLastName: userData.lastName,
        userProfileImage: userData.profileImage,
        items: [
          {
            productId: product.id || product.docId,
            productName: product.productName,
 productImage: product.productImage 
        ? product.productImage.startsWith('data:image') 
          ? product.productImage 
          : product.productImage // ✅ FIXED IMAGE: ensures URL works
        : null,            quantity: product.quantity || 1,
            basePrice: product.basePrice,
            selectedVariation: product.selectedVariation || null,
            selectedVariationPrice: product.selectedVariationPrice || 0,
            services: product.selectedServices || [],
            uploadedBy: product.uploadedBy || null,
            category: product.category || 'Uncategorized', // ✅ Add category here

          },
        ],
        deliveryMethod,
        shippingFee: deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0,
        subtotal,
        totalAmount,
        paymentMethod,
        leaveNote: leaveNote || '',
        address: deliveryMethod === 'Delivery' ? address : null,
        status: 'Pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'Orders'), orderData);

      setLoadingCheckout(false);

      Alert.alert('Checkout Complete', `Your order has been placed successfully!`, [
        { text: 'OK', onPress: () => navigation.navigate('ConsumerTabs', { screen: 'Product' }) },
      ]);
    } catch (error) {
      console.error('Error placing order:', error);
      setLoadingCheckout(false);
      Alert.alert('Error', 'Something went wrong while placing your order.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Finalize Order</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
        {/* Address */}
        <View style={styles.addressWrapper}>
          <View style={styles.addressTitleRow}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={24} color="#3B82F6" />
            <Text style={styles.sectionTitleNew}>Delivery Address</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddressSelection', { from: 'BuyNowCheckedOut' })}
              style={styles.changeButton}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.addressDetailsContainer}>
            {loadingAddress ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : address ? (
              <>
                <Text style={styles.addressNameText}>{address.fullName}</Text>
                <Text style={styles.addressContactText}>{address.contactNumber}</Text>
                <Text style={styles.addressFullText}>{address.fullAddress}</Text>
              </>
            ) : (
              <Text style={styles.addressFullText}>No active address found.</Text>
            )}
          </View>
        </View>

        {/* Vendor & Product */}
        <View style={styles.vendorContainer}>
          <View style={styles.vendorHeaderNew}>
            {product.uploadedBy?.profileImage ? (
              <Image source={{ uri: product.uploadedBy.profileImage }} style={styles.vendorImageNew} />
            ) : (
              <View style={styles.vendorPlaceholderNew}>
                <Ionicons name="business-outline" size={20} color="#9CA3AF" />
              </View>
            )}
            <Text style={styles.shopNameNew}>{product.uploadedBy?.businessName || 'Unknown Vendor'}</Text>
          </View>

          <View style={styles.itemCardNew}>
<View style={styles.productRow}>
  {product.productImage ? (
    product.productImage.startsWith('data:image') ? (
      // It's a Base64 string
      <Base64Image base64={product.productImage} productId={product.id} style={styles.productImageNew} />
    ) : (
      // It's a URL
      <Image source={{ uri: product.productImage }} style={styles.productImageNew} />
    )
  ) : (
    <View style={styles.placeholderImageNew}>
      <Ionicons name="image-outline" size={40} color="#9CA3AF" />
    </View>
  )}
  <View style={styles.productDetailsNew}>
    <Text style={styles.productTextNew}>{product.productName}</Text>
    {product.category && (
      <View style={styles.categoryBadgeNew}>
        <Text style={styles.categoryBadgeTextNew}>{product.category}</Text>
      </View>
    )}
    <Text style={styles.detailText}>Variant: {product.selectedVariation || 'N/A'}</Text>
    {product.selectedServices?.length > 0 &&
      product.selectedServices.map((s, i) => (
        <Text key={i} style={styles.serviceTextNew}>
          • {s.label} (₱{s.price})
        </Text>
      ))}
  </View>
</View>

          </View>
        </View>

        {/* Payment Method Card */}
        <View style={styles.paymentMethodCard}>
          <Text style={styles.sectionTitleNew}>💳 Payment Method</Text>
          <TouchableOpacity style={styles.radioOption} onPress={() => setPaymentMethod('Cash-On-Delivery')} activeOpacity={0.8}>
            <View style={styles.radioOuterCircle}>{paymentMethod === 'Cash-On-Delivery' && <View style={styles.radioInnerCircle} />}</View>
            <Text style={styles.radioText}>Cash on Delivery (COD)</Text>
          </TouchableOpacity>

                    {/* Gcash - disabled */}
                    <View style={[styles.radioOption, styles.radioDisabled]}>
                      <View style={styles.radioOuterCircle} />
                      <Text style={[styles.radioText, { color: '#9CA3AF' }]}>Gcash (Coming Soon)</Text>
                    </View>
          
                    {/* Paymaya - disabled */}
                    <View style={[styles.radioOption, styles.radioDisabled]}>
                      <View style={styles.radioOuterCircle} />
                      <Text style={[styles.radioText, { color: '#9CA3AF' }]}>Paymaya (Coming Soon)</Text>
                    </View>
          
                    {/* BDO - disabled */}
                    <View style={[styles.radioOption, styles.radioDisabled]}>
                      <View style={styles.radioOuterCircle} />
                      <Text style={[styles.radioText, { color: '#9CA3AF' }]}>BDO (Coming Soon)</Text>
                    </View>
        </View>

        {/* Delivery Options */}
        <View style={styles.deliveryCard}>
          <Text style={styles.sectionTitleNew}>🚚 Delivery Options</Text>
          <TouchableOpacity style={styles.radioOption} onPress={() => setDeliveryMethod('Delivery')}>
            <View style={styles.radioOuterCircle}>{deliveryMethod === 'Delivery' && <View style={styles.radioInnerCircle} />}</View>
            <Text style={styles.radioText}>Delivery (₱{SHIPPING_FEE})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.radioOption} onPress={() => setDeliveryMethod('Pickup')}>
            <View style={styles.radioOuterCircle}>{deliveryMethod === 'Pickup' && <View style={styles.radioInnerCircle} />}</View>
            <Text style={styles.radioText}>Pick-Up (No Shipping Fee)</Text>
          </TouchableOpacity>
        </View>

        {/* Leave Note */}
        <View style={styles.noteCard}>
          <Text style={styles.sectionTitleNew}>📝 Leave a Note</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Add any special instructions for the seller..."
            value={leaveNote}
            onChangeText={setLeaveNote}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Order Summary */}
        <View style={styles.orderSummaryNew}>
          <Text style={styles.summaryTitleNew}>💰 Order Summary</Text>
          <View style={styles.summaryRowNew}>
            <Text style={styles.summaryLabel}>Subtotal (1 item):</Text>
            <Text style={styles.summaryValue}>₱{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRowNew}>
            <Text style={styles.summaryLabel}>Shipping Fee:</Text>
            <Text style={styles.shippingValue}>₱{deliveryMethod === 'Delivery' ? SHIPPING_FEE.toFixed(2) : '0.00'}</Text>
          </View>
          <View style={[styles.divider, { marginVertical: 10 }]} />
          <View style={styles.summaryRowNew}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>₱{totalAmount.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footerNew}>
        <View style={styles.totalDisplay}>
          <Text style={styles.footerTotalLabel}>Total:</Text>
          <Text style={styles.footerTotalValue}>₱{totalAmount.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButtonNew, loadingCheckout && { opacity: 0.7 }]}
          onPress={handleCheckout}
          disabled={loadingCheckout}
        >
          {loadingCheckout ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.checkoutTextNew}>Confirm Checkout</Text>
              <Ionicons name="chevron-forward-outline" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ----------------- Styles -----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7F9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ----- Header -----
  header: { 
    height: 60, 
    backgroundColor: '#3B82F6', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 15 
  },
  backButton: { marginRight: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },

  // ----- Empty State -----
  emptyText: { color: '#6B7280', fontSize: 16, marginTop: 10, textAlign: 'center' },
  browseButton: { marginTop: 15, backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 10 },
  browseText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ----- Address -----
  addressWrapper: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    margin: 10, 
    padding: 15, 
    shadowColor: '#000', 
    shadowOpacity: 0.08, 
    shadowOffset: { width: 0, height: 4 }, 
    shadowRadius: 10, 
    elevation: 5 
  },
  addressTitleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8, 
    borderBottomWidth: 1, 
    borderBottomColor: '#E5E7EB', 
    paddingBottom: 8 
  },
  sectionTitleNew: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginLeft: 8, flex: 1 },
  addressDetailsContainer: { paddingHorizontal: 5 },
  addressNameText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  addressContactText: { fontSize: 14, color: '#4B5563', marginBottom: 2 },
  addressFullText: { fontSize: 14, color: '#4B5563', lineHeight: 20 },

  // Change Address Button
  changeButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#EBF5FF',
  },
  changeButtonText: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 14,
  },

  // ----- Vendor & Product -----
  vendorContainer: { 
    marginHorizontal: 10, 
    marginTop: 10, 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 10, 
    elevation: 2 
  },
  vendorHeaderNew: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingBottom: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6' 
  },
  vendorImageNew: { width: 32, height: 32, borderRadius: 16, marginRight: 10, borderWidth: 1, borderColor: '#3B82F6' },
  vendorPlaceholderNew: { width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  shopNameNew: { fontSize: 15, fontWeight: '700', color: '#2563EB' },
  itemCardNew: { paddingVertical: 10 },
  productRow: { flexDirection: 'row', alignItems: 'center' },
  productImageNew: { width: 80, height: 80, borderRadius: 8, marginRight: 12, backgroundColor: '#E5E7EB' },
  placeholderImageNew: { width: 80, height: 80, borderRadius: 8, marginRight: 12, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  productDetailsNew: { flex: 1 },
  productTextNew: { fontSize: 15, fontWeight: '700', color: '#111827' },
  categoryBadgeNew: { backgroundColor: '#374151', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', marginTop: 2, marginBottom: 4 },
  categoryBadgeTextNew: { color: '#fff', fontSize: 11, fontWeight: '600' },
  detailText: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  serviceTextNew: { fontSize: 13, color: '#4B5563', fontStyle: 'italic', marginTop: 1 },

  // ----- Payment & Delivery -----
  paymentMethodCard: { backgroundColor: '#fff', borderRadius: 12, margin: 10, padding: 15 },
  deliveryCard: { backgroundColor: '#fff', borderRadius: 12, margin: 10, padding: 15 },
  radioOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  radioOuterCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  radioInnerCircle: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' },
  radioText: { fontSize: 14, fontWeight: '600', color: '#111827' },

  // ----- Note -----
  noteCard: { backgroundColor: '#fff', borderRadius: 12, margin: 10, padding: 15 },
  noteInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginTop: 8, minHeight: 60, textAlignVertical: 'top', backgroundColor: '#F9FAFB' },

  // ----- Order Summary -----
  orderSummaryNew: { backgroundColor: '#fff', borderRadius: 12, margin: 10, padding: 15 },
  summaryTitleNew: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  summaryRowNew: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  shippingValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#3B82F6' },
  divider: { height: 1, backgroundColor: '#E5E7EB', width: '100%' },

  // ----- Footer -----
  footerNew: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 15, borderTopWidth: 1, borderTopColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalDisplay: { flexDirection: 'row', alignItems: 'center' },
  footerTotalLabel: { fontSize: 16, fontWeight: '600', marginRight: 8 },
  footerTotalValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  checkoutButtonNew: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  checkoutTextNew: { color: '#fff', fontSize: 16, fontWeight: '700', marginRight: 5 },
});
