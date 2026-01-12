// src/screens/Users/ViewOrderDetails.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { doc, deleteDoc, setDoc } from "firebase/firestore";
import { db } from '../../firebase'; // make sure your firestore import is correct

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 200;

const getStatusBadgeStyle = status => {
  switch (status) {
    case 'Pending':
      return { backgroundColor: '#FBBF24', color: '#92400E' }; // yellow
    case 'Preparing':
      return { backgroundColor: '#3B82F6', color: '#FFFFFF' }; // blue
    case 'ToDeliver':
      return { backgroundColor: '#8B5CF6', color: '#FFFFFF' }; // purple
    case 'Completed':
      return { backgroundColor: '#10B981', color: '#FFFFFF' }; // green
    case 'Cancelled':
      return { backgroundColor: '#EF4444', color: '#FFFFFF' }; // red
    default:
      return { backgroundColor: '#D1D5DB', color: '#374151' }; // gray
  }
};


export default function ViewOrderDetails() {
  const navigation = useNavigation();
  const route = useRoute();
  const order = route.params?.order;
  const [isCancelling, setIsCancelling] = useState(false);

  // Group items by vendor
  const groupedItems = useMemo(() => {
    const groups = {};
    order.items.forEach(item => {
      const businessName = item.uploadedBy?.businessName || 'Unknown Vendor';
      if (!groups[businessName]) groups[businessName] = [];
      groups[businessName].push(item);
    });
    return Object.entries(groups).map(([shopName, items]) => ({ shopName, items }));
  }, [order.items]);

  const renderItemCard = item => {
    const base = Number(item.basePrice || 0);
    const variationPrice = Number(item.selectedVariationPrice || 0);
    const servicesTotal = (item.services || []).reduce((a, s) => a + Number(s.price || 0), 0);
    const itemTotal = (base + variationPrice + servicesTotal) * (item.quantity || 1);

    return (
      <View key={item.productId} style={styles.itemCardNew}>
        <View style={styles.productRow}>
          {item.productImage ? (
            <Image source={{ uri: item.productImage }} style={styles.productImageNew} />
          ) : (
            <View style={styles.placeholderImageNew}>
              <Ionicons name="image-outline" size={40} color="#9CA3AF" />
            </View>
          )}
          <View style={styles.productDetailsNew}>
            <Text style={styles.productTextNew} numberOfLines={2}>{item.productName}</Text>
            <Text style={styles.detailText}>Variant: {item.selectedVariation || 'N/A'}</Text>
            {item.services && item.services.length > 0 && (
              <View style={{ marginTop: 4 }}>
                <Text style={styles.serviceTextNew}>Services:</Text>
                {item.services.map((s, idx) => (
                  <Text key={idx} style={[styles.serviceTextNew, { marginLeft: 10 }]}>
                    - {s.label} (₱{Number(s.price).toFixed(2)})
                  </Text>
                ))}
              </View>
            )}
            <View style={styles.qtyPriceRow}>
              <Text style={styles.qtyTextNew}>Qty: {item.quantity}</Text>
              <Text style={styles.itemTotalNew}>₱{itemTotal.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // =============================
  // Cancel Order Function
  // =============================
  const handleCancelOrder = async () => {
    if (isCancelling) return;
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          onPress: async () => {
            setIsCancelling(true);
            try {
              const orderRef = doc(db, "Orders", order.id);

              // Copy order data to CancelledOrders
              await setDoc(doc(db, "CancelledOrders", order.id), {
                ...order,
                cancelledAt: new Date(),
              });

              // Delete original order
              await deleteDoc(orderRef);

              Alert.alert("Success", "Your order has been cancelled.");
              navigation.goBack();
            } catch (error) {
              console.log(error);
              Alert.alert("Error", "Something went wrong. Try again.");
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Order Status Title */}
<View style={{ paddingHorizontal: 15, paddingVertical: 10 }}>
  <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>
    {order.status === 'Pending' && 'Pending'}
    {order.status === 'Preparing' && 'Preparing'}
    {order.status === 'ToDeliver' && 'To Deliver'}
    {order.status === 'Completed' && 'Completed'}
    {order.status === 'Cancelled' && 'Cancelled'}
  </Text>
</View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
        {/* Address Card */}
        {order.address && (
          <View style={styles.addressWrapper}>
            <View style={styles.addressTitleRow}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={24} color="#3B82F6" />
              <Text style={styles.sectionTitleNew}>Delivery Address</Text>
  <Text style={{
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 12,
    marginLeft: 110,
    fontWeight: '700',
    ...getStatusBadgeStyle(order.status)
  }}>
    {order.status}
  </Text>
            </View>
            <View style={styles.addressDetailsContainer}>
              <Text style={styles.addressNameText}>{order.address.fullName}</Text>
              <Text style={styles.addressContactText}>{order.address.contactNumber}</Text>
              <Text style={styles.addressFullText}>{order.address.fullAddress}</Text>
              {order.address.latitude && order.address.longitude && (
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: order.address.latitude,
                    longitude: order.address.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: order.address.latitude,
                      longitude: order.address.longitude,
                    }}
                    title="Delivery Location"
                  />
                </MapView>
              )}
            </View>
          </View>
        )}

        {/* Grouped Items */}
        {groupedItems.map(group => {
          const shopImage = group.items[0].uploadedBy?.profileImage || null;
          return (
            <View key={group.shopName} style={styles.vendorContainer}>
              <View style={styles.vendorHeaderNew}>
                {shopImage ? (
                  <Image source={{ uri: shopImage }} style={styles.vendorImageNew} />
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

        {/* Order Summary */}
        <View style={styles.orderSummaryNew}>
          <Text style={styles.summaryTitleNew}>💰 Order Summary</Text> 
            <View style={styles.summaryRowNew}>
            <Text style={styles.summaryLabel}>Order #:</Text>
            <Text style={styles.summaryValue}>{order.orderNumber}</Text>
          </View>
          <View style={styles.summaryRowNew}>
            <Text style={styles.summaryLabel}>Subtotal:</Text>
            <Text style={styles.summaryValue}>₱{order.subtotal.toFixed(2)}</Text>
          </View>




          <View style={styles.summaryRowNew}>
            <Text style={styles.summaryLabel}>Shipping Fee:</Text>
            <Text style={styles.shippingValue}>₱{order.shippingFee.toFixed(2)}</Text>
          </View>
          <View style={[styles.divider, { marginVertical: 10 }]} />
          <View style={styles.summaryRowNew}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>₱{order.totalAmount.toFixed(2)}</Text>
          </View>
        </View>

{/* Cancel Button */}
{order.status === 'Pending' && (
  <TouchableOpacity
    disabled={isCancelling}
    style={[
      styles.cancelButton,
      {
        marginHorizontal: 15,
        marginBottom: 30,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isCancelling ? '#FCA5A5' : '#EF4444',
      },
    ]}
    onPress={handleCancelOrder}
  >
    {isCancelling ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Cancel Order</Text>
    )}
  </TouchableOpacity>
)}


      </ScrollView>
    </View>
  );
};



const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 10,
  },
  backButton: { padding: 6 },

  container: { flex: 1, backgroundColor: '#F3F4F6', },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },


  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6, color: '#111827' },
  sectionText: { fontSize: 14, color: '#374151' },

  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6, alignSelf: 'flex-start' },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  userImage: { width: 50, height: 50, borderRadius: 25, marginLeft: 10 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  map: { width:315, height: MAP_HEIGHT, borderRadius: 25, marginTop: 10 },
statusText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#374151', // gray-700
  marginTop: 4,
},
  // =========================
  // Address Card
  // =========================
  addressWrapper: { backgroundColor: '#fff', borderRadius: 12, margin: 15, padding: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  addressTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitleNew: { fontSize: 16, fontWeight: '700', marginLeft: 6, color: '#111827' },
  addressDetailsContainer: { marginTop: 5 },
  addressNameText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  addressContactText: { fontSize: 14, color: '#374151', marginTop: 2 },
  addressFullText: { fontSize: 14, color: '#6B7280', marginTop: 2 },

  // =========================
  // Vendor & Items
  // =========================
  vendorContainer: { marginHorizontal: 15, marginTop: 10 },
  vendorHeaderNew: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  vendorImageNew: { width: 35, height: 35, borderRadius: 17.5, marginRight: 8 },
  vendorPlaceholderNew: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  shopNameNew: { fontSize: 16, fontWeight: '700', color: '#111827' },

  itemCardNew: { backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  productRow: { flexDirection: 'row', gap: 10 },
  productImageNew: { width: 60, height: 60, borderRadius: 8 },
  placeholderImageNew: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  productDetailsNew: { flex: 1 },
  productTextNew: { fontSize: 14, fontWeight: '700', color: '#111827' },
  detailText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  serviceTextNew: { fontSize: 12, color: '#374151', marginTop: 2 },
  qtyPriceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  qtyTextNew: { fontSize: 12, color: '#374151' },
  itemTotalNew: { fontSize: 14, fontWeight: '700', color: '#111827' },

  // =========================
  // Order Summary
  // =========================
  orderSummaryNew: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginHorizontal: 15, marginTop: 15, marginBottom: 30, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  summaryTitleNew: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  summaryRowNew: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  summaryLabel: { fontSize: 14, color: '#374151' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#111827' },
  shippingValue: { fontSize: 14, fontWeight: '700', color: '#111827' },
  totalLabel: { fontSize: 16, fontWeight: '900', color: '#1F2937' },
  totalValue: { fontSize: 16, fontWeight: '900', color: '#D90000' },

  divider: { height: 1, backgroundColor: '#E5E7EB' },
});
