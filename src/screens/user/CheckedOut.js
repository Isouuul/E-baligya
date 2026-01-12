// src/screens/Users/CheckedOut.js
import React, { useMemo, useEffect, useState } from 'react';
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
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  serverTimestamp, // ✅ NEW
  deleteDoc, runTransaction
} from 'firebase/firestore';
import WarningIcon from '../../../assets/warning.png';

export default function CheckedOut() {
  const navigation = useNavigation();
  const route = useRoute();
  const selectedItems = route.params?.selectedItems || [];
  const [paymentMethod, setPaymentMethod] = useState('Cash-On-Delivery');
  const [deliveryMethod, setDeliveryMethod] = useState('Delivery'); // default Delivery
  const [leaveNote, setLeaveNote] = useState(''); // COD selected by default

  const SHIPPING_FEE = 50; // Flat shipping fee

  // Address state
  const [address, setAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(true);

  
const convertImageToBase64 = async (uri) => {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error converting image to Base64:', error);
    return null;
  }
};


  const generateOrderNumber = () => {
  const timestamp = Date.now(); // current timestamp in milliseconds
  const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
  return `ORD-${timestamp}-${random}`;
};


  // Fetch active address
  useEffect(() => {
    const fetchAddress = () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
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
              latitude: docData.latitude || null,   // ✅ add this
              longitude: docData.longitude || null, // ✅ add this
            });
          } else {
            const allQ = query(addressesRef);
            onSnapshot(allQ, allSnapshot => {
              if (!allSnapshot.empty) {
                const docData = allSnapshot.docs[0].data();
                setAddress({
                  id: allSnapshot.docs[0].id,
                  fullName: `${docData.firstName || ''} ${docData.lastName || ''}`.trim(),
                  fullAddress: `${docData.streetName || ''}, ${docData.barangay || ''}, ${docData.city || ''}, ${docData.province || ''}, ${docData.region || ''}`,
                  contactNumber: docData.phoneNumber || '',
                });
              } else {
                setAddress(null);
              }
            });
          }
          setLoadingAddress(false);
        }, error => {
          console.error('Error fetching address:', error);
          setLoadingAddress(false);
        });
        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching address:', error);
        setLoadingAddress(false);
      }
    };
    fetchAddress();
  }, []);

  // Update address when coming back from AddressSelection
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params?.selectedAddress) {
        setAddress(route.params.selectedAddress);
      }
    });
    return unsubscribe;
  }, [navigation, route.params?.selectedAddress]);

  // Group items by vendor
  const groupedItems = useMemo(() => {
    const groups = {};
    selectedItems.forEach(item => {
      const businessName = item.uploadedBy?.businessName || 'Unknown Vendor';
      if (!groups[businessName]) groups[businessName] = [];
      groups[businessName].push(item);
    });
    return Object.entries(groups).map(([shopName, items]) => ({ shopName, items }));
  }, [selectedItems]);

  // Calculate subtotal
  const subtotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const base = Number(item.basePrice || 0);
      const variationPrice = Number(item.selectedVariationPrice || 0);
      const servicesTotal = (item.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0);
      return sum + (base + variationPrice + servicesTotal) * (item.quantity || 1);
    }, 0);
  }, [selectedItems]);

  const totalAmount = subtotal + (deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0);

  // Render each item card
const renderItemCard = item => {
  const base = Number(item.basePrice || 0);
  const variationPrice = Number(item.selectedVariationPrice || 0);
  const servicesTotal = (item.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0);
  const itemTotal = (base + variationPrice + servicesTotal) * (item.quantity || 1);

  return (
    <View key={item.id} style={styles.itemCardNew}>
      <View style={styles.productRow}>
        {item.productImage ? (
          <Image source={{ uri: item.productImage }} style={styles.productImageNew} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderImageNew}>
            <Ionicons name="image-outline" size={40} color="#9CA3AF" />
          </View>
        )}
        <View style={styles.productDetailsNew}>
          <Text style={styles.productTextNew} numberOfLines={2}>{item.productName}</Text>
          {item.category && (
            <View style={styles.categoryBadgeNew}>
              <Text style={styles.categoryBadgeTextNew}>{item.category}</Text>
            </View>
          )}
          <Text style={styles.detailText}>Variant: **{item.selectedVariation || 'N/A'}**</Text>

          {/* ✅ Grouped Services */}
          {item.selectedServices && item.selectedServices.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.serviceTextNew}>Services:</Text>
              {(item.selectedServices || []).map((s, index) => (
                <Text key={index} style={[styles.serviceTextNew, { marginLeft: 10 }]}>
                  - {s.label} (₱{Number(s.price).toFixed(2)})
                </Text>
              ))}
            </View>
          )}

          <View style={styles.qtyPriceRow}>
            <Text style={styles.qtyTextNew}>Qty: **{item.quantity}**</Text>
            <Text style={styles.itemTotalNew}>₱{itemTotal.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};


  if (selectedItems.length === 0) {
    return (
      <View style={styles.center}>
        <Image source={WarningIcon} style={{ width: 80, height: 80, marginBottom: 15 }} resizeMode="contain" />
        <Text style={styles.emptyText}>No items selected for checkout</Text>
        <TouchableOpacity
          style={styles.browseButton}
          onPress={() => navigation.navigate('ConsumerTabs', { screen: 'Product' })}
        >
          <Text style={styles.browseText}>Browse Products</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        {/* Address Card */}
        <View style={styles.addressWrapper}>
          <View style={styles.addressTitleRow}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={24} color="#3B82F6" />
            <Text style={styles.sectionTitleNew}>Delivery Address</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddressSelection', { from: 'CheckedOut' })}
              style={styles.changeButton}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.addressDetailsContainer}>
            {loadingAddress ? (
              <ActivityIndicator size="small" color="#3B82F6" style={{ paddingVertical: 10 }} />
            ) : address ? (
              <>
                <Text style={styles.addressNameText}>{address.fullName}</Text>
                <Text style={styles.addressContactText}>{address.contactNumber}</Text>
                <Text style={styles.addressFullText}>{address.fullAddress}</Text>
              </>
            ) : (
              <Text style={styles.addressFullText}>No active address found. Tap 'Change' to select one.</Text>
            )}
          </View>
        </View>

        {/* Grouped items by vendor */}
        {groupedItems.map(group => {
  const shopImage = group.items[0].uploadedBy?.profileImage || null;
          return (
            <View key={group.shopName} style={styles.vendorContainer}>
              <View style={styles.vendorHeaderNew}>
                {shopImage ? (
                  <Image source={{ uri: shopImage }} style={styles.vendorImageNew} resizeMode="cover" />
                ) : (
                  <View style={styles.vendorPlaceholderNew}>
                    <Ionicons name="business-outline" size={20} color="#9CA3AF" />
                  </View>
                )}
                <Text style={styles.shopNameNew}>{group.shopName}</Text>
              </View>

              {group.items.map(item => renderItemCard(item))}
            </View>
          );
        })}

        {/* Payment Method Card */}
        <View style={styles.paymentMethodCard}>
          <Text style={styles.sectionTitleNew}>💳 Payment Method</Text>

          {/* COD - enabled */}
          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => setPaymentMethod('Cash-On-Delivery')}
            activeOpacity={0.8}
          >
            <View style={styles.radioOuterCircle}>
              {paymentMethod === 'Cash-On-Delivery' && <View style={styles.radioInnerCircle} />}
            </View>
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

        <View style={styles.deliveryCard}>
          <Text style={styles.sectionTitleNew}>🚚 Delivery Options</Text>

          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => setDeliveryMethod('Delivery')}
          >
            <View style={styles.radioOuterCircle}>
              {deliveryMethod === 'Delivery' && <View style={styles.radioInnerCircle} />}
            </View>
            <Text style={styles.radioText}>Delivery {deliveryMethod === 'Delivery' ? `(₱${SHIPPING_FEE})` : ''}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => setDeliveryMethod('Pickup')}
          >
            <View style={styles.radioOuterCircle}>
              {deliveryMethod === 'Pickup' && <View style={styles.radioInnerCircle} />}
            </View>
            <Text style={styles.radioText}>Pick-Up (No Shipping Fee)</Text>
          </TouchableOpacity>
        </View>

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
            <Text style={styles.summaryLabel}>Subtotal ({selectedItems.length} items):</Text>
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

      {/* Footer / Confirm Checkout */}
      <View style={styles.footerNew}>
        <View style={styles.totalDisplay}>
            <Text style={styles.footerTotalLabel}>Total:</Text>
            <Text style={styles.footerTotalValue}>₱{totalAmount.toFixed(2)}</Text>
        </View>

        {/* ✅ UPDATED: Confirm Checkout with Firestore */}
<TouchableOpacity
  style={styles.checkoutButtonNew}
  onPress={async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (deliveryMethod === 'Delivery' && !address) {
      Alert.alert(
        'Address Required',
        'Please select a delivery address to proceed with the checkout.',
        [{ text: 'OK' }]
      );
      return;
    }

    const orderNumber = generateOrderNumber();

    try {
      // Fetch user info
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

      // Prepare order data
      const orderData = {
        orderNumber, // ✅ Add this
        userId: user.uid,
        userFirstName: userData.firstName,
        userLastName: userData.lastName,
        userProfileImage: userData.profileImage,
        items: selectedItems.map(item => ({
          productId: item.productId, // ✅ FIXED: use productId instead of id
          productName: item.productName,
          productImage: item.productImage || null, // ✅ include URL
          category: item.category || 'Uncategorized', // ✅ Add category here
          quantity: item.quantity,
          basePrice: item.basePrice,
          selectedVariation: item.selectedVariation || null,
          selectedVariationPrice: item.selectedVariationPrice || 0,
          services: item.selectedServices || [], // ✅ Rename here
          uploadedBy: item.uploadedBy || null,
        })),
        deliveryMethod,
        shippingFee: deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0,
        subtotal,
        totalAmount,
        paymentMethod,
        leaveNote: leaveNote || '',
        address: deliveryMethod === 'Delivery' ? {
          ...address,
          latitude: address.latitude || null,
          longitude: address.longitude || null,
        } : null, // ✅ include lat/lng
        status: 'Pending',  
        createdAt: serverTimestamp(),
      };

      // Save order to Firestore
      await addDoc(collection(db, 'Orders'), orderData);

      // ✅ Remove items from cart after successful order
      const cartCollection = collection(db, 'Carts', user.uid, 'items');
      await Promise.all(
        selectedItems.map(item => deleteDoc(doc(cartCollection, item.id)))
      );

      Alert.alert(
        'Checkout Complete',
        `Your order has been placed successfully!\nDelivery Method: ${deliveryMethod}\nNote: ${leaveNote || 'None'}`,
        [{ text: 'OK', onPress: () => navigation.navigate('ConsumerTabs', { screen: 'Product' }) }]
      );
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Something went wrong while placing your order.');
    }
  }}
>
  <Text style={styles.checkoutTextNew}>Confirm Checkout</Text>
  <Ionicons name="chevron-forward-outline" size={18} color="#fff" />
</TouchableOpacity>


      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Base/Utility Styles
  container: { flex: 1, backgroundColor: '#F4F7F9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    height: 60,
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  backButton: { marginRight: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  emptyText: { color: '#6B7280', fontSize: 16, marginTop: 10 },
  browseButton: { marginTop: 15, backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 10 },
  browseText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 5 },

  // --- New UI Styles ---
  
  // Address Styles
  addressWrapper: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  sectionTitleNew: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginLeft: 8, flex: 1 },
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
  addressDetailsContainer: { paddingHorizontal: 5 },
  addressNameText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  addressContactText: { fontSize: 14, color: '#4B5563', marginBottom: 2 },
  addressFullText: { fontSize: 14, color: '#4B5563', lineHeight: 20 },

  // Vendor/Shop Styles
  vendorContainer: { marginHorizontal: 10, marginTop: 10, backgroundColor: '#fff', borderRadius: 12, padding: 10, elevation: 2 },
  vendorHeaderNew: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  vendorImageNew: { width: 30, height: 30, borderRadius: 15, marginRight: 10, borderWidth: 1, borderColor: '#3B82F6' },
  vendorPlaceholderNew: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopNameNew: { fontSize: 15, fontWeight: '700', color: '#2563EB' },

  // Item Card Styles
  itemCardNew: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  productRow: { flexDirection: 'row', alignItems: 'center' },
  productImageNew: { width: 80, height: 80, borderRadius: 8, marginRight: 12, backgroundColor: '#E5E7EB' },
  placeholderImageNew: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productDetailsNew: { flex: 1 },
  productTextNew: { fontSize: 15, fontWeight: '700', color: '#111827' },
  categoryBadgeNew: {
    backgroundColor: '#374151',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 4,
  },
  categoryBadgeTextNew: { color: '#fff', fontSize: 11, fontWeight: '600' },
  detailText: { fontSize: 13, color: '#6B7280', marginTop: 1 },
  serviceTextNew: { fontSize: 13, color: '#4B5563', fontStyle: 'italic' },
  qtyPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 5 },
  qtyTextNew: { fontSize: 14, fontWeight: '600', color: '#374151' },
  itemTotalNew: { fontSize: 16, fontWeight: '700', color: '#1F2937' }, // Highlighted item price

  // Order Summary Styles
  orderSummaryNew: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
  },
  summaryTitleNew: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 10 },
  summaryRowNew: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  summaryLabel: { fontSize: 14, color: '#374151' },
  summaryValue: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  shippingValue: { fontSize: 14, color: '#1F2937', fontWeight: '600' },
  freeShippingValue: { fontSize: 14, color: '#059669', fontWeight: '700' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  totalValue: { fontSize: 18, fontWeight: '900', color: '#1F2937' }, // Total amount emphasis

  shippingNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 8, borderRadius: 8, marginTop: 10 },
  shippingNoteText: { fontSize: 12, color: '#059669', marginLeft: 5, flexShrink: 1 },
  weightWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', padding: 8, borderRadius: 8, marginTop: 10 },
  weightWarningText: { fontSize: 12, color: '#B45309', marginLeft: 5, flexShrink: 1 },

  paymentMethod: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  paymentValue: { fontSize: 14, color: '#3B82F6', fontWeight: '600' },

  // Footer Styles
  footerNew: {
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 30, // For modern phone safe areas
  },
  totalDisplay: { flexDirection: 'row', alignItems: 'center' },
  footerTotalLabel: { fontSize: 16, color: '#4B5563', marginRight: 5 },
  footerTotalValue: { fontSize: 22, fontWeight: '900', color: '#D90000' },
  checkoutButtonNew: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkoutTextNew: { color: '#fff', fontSize: 16, fontWeight: '700', marginRight: 5 },

  // Payment Method Card
paymentMethodCard: {
  backgroundColor: '#fff',
  borderRadius: 12,
  margin: 10,
  padding: 15,
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 10,
  elevation: 5,
},

paymentOption: {
  paddingVertical: 12,
  paddingHorizontal: 15,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#E5E7EB',
  marginTop: 8,
  backgroundColor: '#F9FAFB',
},

paymentOptionSelected: {
  borderColor: '#3B82F6',
  backgroundColor: '#DBEAFE',
},

paymentOptionDisabled: {
  backgroundColor: '#F3F4F6',
  borderColor: '#E5E7EB',
},
paymentOptionText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#111827',
},
radioOption: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 12,
},

radioOuterCircle: {
  height: 24,
  width: 24,
  borderRadius: 12,
  borderWidth: 2,
  borderColor: '#3B82F6',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
  shadowColor: '#3B82F6',
  shadowOpacity: 0.2,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 3,
  elevation: 2,
  backgroundColor: '#fff',
},

radioInnerCircle: {
  height: 12,
  width: 12,
  borderRadius: 6,
  backgroundColor: '#3B82F6',
},

radioText: {
  fontSize: 15,
  fontWeight: '600',
  color: '#111827',
},

radioDisabled: {
  opacity: 0.5,
},

deliveryCard: {
  backgroundColor: '#fff',
  borderRadius: 12,
  margin: 10,
  padding: 15,
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 10,
  elevation: 5,
},

noteCard: {
  backgroundColor: '#fff',
  borderRadius: 12,
  margin: 10,
  padding: 15,
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 10,
  elevation: 5,
  marginBottom: 15,
},

noteInput: {
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 8,
  padding: 10,
  marginTop: 8,
  textAlignVertical: 'top',
  fontSize: 14,
  color: '#111827',
  backgroundColor: '#F9FAFB',
  height: 100
},




});