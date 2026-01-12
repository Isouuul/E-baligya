import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { db, auth } from '../../../firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, setDoc, runTransaction } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

export default function VendorOrdersScreen() {
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]); 
  const [toDeliverOrders, setToDeliverOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]); // ✅ Completed Orders
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('Pending');
  const [searchQuery, setSearchQuery] = useState('');

  const STATUSES = ['Pending', 'Preparing', 'To Deliver', 'Complete', 'Cancelled'];
  const statusImages = {
    Pending: require('../../../../assets/Pending.png'),
    Preparing: require('../../../../assets/Preparing.png'),
    'To Deliver': require('../../../../assets/ToDeliver.png'),
    Complete: require('../../../../assets/Complete.png'),
    Cancelled: require('../../../../assets/Complete.png'),
  };
  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return '#F59E0B';
      case 'Preparing': return '#3B82F6';
      case 'To Deliver': return '#10B981';
      case 'Complete': return '#6B7280';
      case 'Cancelled': return '#EF4444';
      default: return '#fff';
    }
  };

  const vendorId = auth.currentUser?.uid;

  // Fetch To Deliver Orders
  useEffect(() => {
    const ref = collection(db, 'To_Deliver_Orders');
    const q = query(ref, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setToDeliverOrders(data);
    });

    return () => unsubscribe();
  }, []);

  // Fetch Completed Orders
  useEffect(() => {
    const ref = collection(db, 'Completed_Orders');
    const q = query(ref, orderBy('completedAt', 'desc'));

    const unsubscribe = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCompletedOrders(data);
    });

    return () => unsubscribe();
  }, []);

  // Fetch all Orders
  useEffect(() => {
    const ordersRef = collection(db, 'Orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, snapshot => {
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const vendorOrders = allOrders
        .map(order => {
          const itemsArray = Array.isArray(order.items) ? order.items : [];
          const vendorItems = itemsArray.filter(item => item.uploadedBy?.uid === vendorId);
          if (vendorItems.length > 0) return { ...order, items: vendorItems };
          return null;
        })
        .filter(Boolean);

      setOrders(vendorOrders);
      setLoading(false);
    }, error => {
      console.log(error);
      setLoading(false);
      Alert.alert('Error', 'Failed to fetch orders.');
    });

    return () => unsubscribe();
  }, [vendorId]);

  const handleCancelOrder = async (order) => {
    try {
      const orderRef = doc(db, 'Orders', order.id);
      await runTransaction(db, async (transaction) => {
        transaction.set(doc(db, 'Cancelled_Orders', order.id), { ...order, status: 'Cancelled', cancelledAt: new Date() });
        transaction.delete(orderRef);
      });
      Alert.alert('Cancelled', `Order ${order.orderNumber} has been cancelled.`);
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Failed to cancel order.');
    }
  };

  const handleDeliverOrder = async (order) => {
    try {
      const deliverRef = doc(db, 'To_Deliver_Orders', order.id);
      await runTransaction(db, async (transaction) => {
        for (const item of order.items) {
          const productId = item.productId;
          const productRef = doc(db, 'Products', productId);
          const productSnap = await transaction.get(productRef);

          if (!productSnap.exists()) {
            throw new Error(`Product ${item.productName} does not exist!`);
          }

          const currentQty = productSnap.data().quantityKg || 0;
          const orderQty = item.quantity || 0;
          const newQty = currentQty - orderQty;

          if (newQty < 0) throw new Error(`Insufficient stock for ${item.productName}`);

          transaction.update(productRef, { quantityKg: newQty });
        }

        transaction.set(deliverRef, { ...order, status: 'To Deliver' });
        transaction.delete(doc(db, 'Orders', order.id));
      });

      Alert.alert('Success', `Order ${order.orderNumber} moved to To Deliver.`);
    } catch (error) {
      console.log(error);
      Alert.alert('Error', error.message || 'Failed to move order to To Deliver.');
    }
  };

  const handleAcceptOrder = async (order) => {
    try {
      const orderRef = doc(db, 'Orders', order.id);
      await updateDoc(orderRef, { status: 'Preparing' });
      Alert.alert('Accepted', `Order ${order.orderNumber} is now being prepared.`);
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Failed to accept order.');
    }
  };

  const handleCompleteOrder = async (order) => {
    try {
      const completeRef = doc(db, 'Completed_Orders', order.id);
      await runTransaction(db, async (transaction) => {
        transaction.set(completeRef, { ...order, status: 'Complete', completedAt: new Date() });
        transaction.delete(doc(db, 'To_Deliver_Orders', order.id));
      });
      Alert.alert('Completed', `Order ${order.orderNumber} has been completed.`);
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Failed to complete order.');
    }
  };

  const getStatusCount = (status) => {
    if (status === 'To Deliver') return toDeliverOrders.length;
    if (status === 'Complete') return completedOrders.length;
    return orders.filter(o => o.status === status).length;
  };

  const sourceOrders =
    activeStatus === 'To Deliver'
      ? toDeliverOrders
      : activeStatus === 'Complete'
        ? completedOrders
        : orders;

  const filteredOrders = sourceOrders.filter(o => {
    const matchesStatus =
      activeStatus === 'To Deliver' || activeStatus === 'Complete'
        ? true
        : o.status === activeStatus;

    const matchesSearch =
      searchQuery === '' ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  const renderOrderItem = ({ item }) => {
    const total = (Array.isArray(item.items) ? item.items : []).reduce((sum, i) => {
      const base = Number(i.basePrice || 0);
      const variation = Number(i.selectedVariationPrice || 0);
      const services = (i.services || []).reduce((a, s) => a + Number(s.price || 0), 0);
      return sum + (base + variation + services) * (i.quantity || 1);
    }, 0);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => navigation.navigate('ViewOrderDetailsVendor', { order: item })}
        disabled={item.status === 'Complete'} // ✅ completed orders read-only
      >
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>Order #: {item.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusBadgeText}>{item.status}</Text>
          </View>
        </View>

        {item.items.map((i, idx) => (
          <View key={idx} style={styles.itemRow}>
            {i.productImage && <Image source={{ uri: i.productImage }} style={styles.itemImage} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{i.productName} x{i.quantity}</Text>
              {i.selectedVariation && <Text style={styles.itemSub}>Variation: {i.selectedVariation}</Text>}
              {i.services?.length > 0 && (
                <Text style={styles.itemSub}>Services: {i.services.map(s => s.label || s.name).join(', ')}</Text>
              )}
            </View>
          </View>
        ))}

        <Text style={styles.totalAmount}>Total: ₱{total.toFixed(2)}</Text>

        {item.status === 'Pending' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#10B981' }]}
              onPress={() => handleAcceptOrder(item)}
            >
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCancelOrder(item)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'Preparing' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#10B981' }]}
              onPress={() => handleDeliverOrder(item)}
            >
              <Text style={styles.buttonText}>To Deliver</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCancelOrder(item)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'To Deliver' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#6366F1' }]}
              onPress={() => handleCompleteOrder(item)}
            >
              <Text style={styles.buttonText}>Complete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCancelOrder(item)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search by order # or item name"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <FlatList
        data={STATUSES}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item}
        contentContainerStyle={{ paddingHorizontal: 10, marginBottom: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.statusTabHorizontal, activeStatus === item && styles.activeTabHorizontal]}
            onPress={() => setActiveStatus(item)}
          >
            <Image source={statusImages[item]} style={styles.statusImage} />
            <Text style={[styles.statusTextHorizontal, activeStatus === item && styles.activeTextHorizontal]}>
              {item} ({getStatusCount(item)})
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filteredOrders}
        keyExtractor={item => item.id}
        renderItem={renderOrderItem}
        contentContainerStyle={{ padding: 15 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchInput: {
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 14, fontWeight: '700', color: '#111827' },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12 },
  statusBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  itemRow: { flexDirection: 'row', marginTop: 10, alignItems: 'center' },
  itemImage: { width: 60, height: 60, borderRadius: 10, marginRight: 10 },
  itemName: { fontWeight: '600', fontSize: 14, color: '#111827' },
  itemSub: { fontSize: 12, color: '#6B7280' },
  totalAmount: { fontSize: 14, fontWeight: '700', color: '#D90000', marginTop: 10 },
  statusTabHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 1,
    paddingHorizontal: 12,
    backgroundColor: '#eee',
    borderRadius: 15,
    marginRight: 8,
    height: 30,
  },
  statusTextHorizontal: { color: '#555', fontWeight: '600' },
  activeTabHorizontal: { backgroundColor: '#2196F3' },
  activeTextHorizontal: { color: '#fff' },
  actionButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#2196F3', borderRadius: 5, marginTop: 8, alignSelf: 'flex-start' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  statusImage: { width: 20, height: 20, resizeMode: 'contain' },
});
