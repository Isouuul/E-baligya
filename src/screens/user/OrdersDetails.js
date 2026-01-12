// src/screens/Users/OrdersDetails.js
import React, { useEffect, useState } from 'react';
import { 
  View, Text, StatusBar, FlatList, ActivityIndicator, StyleSheet, 
  SafeAreaView, TouchableOpacity, Image, ScrollView, TextInput, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const STATUSES = ['Pending', 'Preparing', 'To Deliver', 'Complete', 'Cancelled'];

const statusColors = {
  Pending: '#F59E0B',
  Preparing: '#3B82F6',
  'To Deliver': '#10B981',
  Complete: '#6366F1',
  Cancelled: '#EF4444',
};

const statusImages = {
  Pending: require('../../../assets/Pending.png'),
  Preparing: require('../../../assets/Preparing.png'),
  'To Deliver': require('../../../assets/ToDeliver.png'),
  Complete: require('../../../assets/Complete.png'),
  Cancelled: require('../../../assets/Complete.png'),
};

const OrdersDetails = () => {
  const [orders, setOrders] = useState([]);
  const [toDeliverOrders, setToDeliverOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const navigation = useNavigation();
  const userId = auth.currentUser?.uid;

  // Fetch Pending/Preparing Orders
  useEffect(() => {
    if (!userId) return;
    const ref = collection(db, 'Orders');
    const q = query(ref, where('userId', '==', userId));

    const unsubscribe = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Fetch To Deliver Orders
  useEffect(() => {
    const ref = collection(db, 'To_Deliver_Orders');
    const q = query(ref, where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, snapshot => {
      setToDeliverOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [userId]);

  // Fetch Completed Orders
  useEffect(() => {
    const ref = collection(db, 'Completed_Orders');
    const q = query(ref, where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, snapshot => {
      setCompletedOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [userId]);

  const handleCancelOrder = async (order) => {
    Alert.alert(
      "Cancel Order",
      `Are you sure you want to cancel order ${order.orderNumber}?`,
      [
        { text: "No", style: "cancel" },
        { text: "Yes", onPress: async () => {
          try {
            const orderRef = doc(db, 'Orders', order.id);
            await setDoc(doc(db, 'Cancelled_Orders', order.id), {
              ...order,
              cancelledAt: new Date(),
              status: 'Cancelled',
            });
            await deleteDoc(orderRef);
          } catch (error) {
            console.log(error);
            Alert.alert('Error', 'Failed to cancel order.');
          }
        } }
      ]
    );
  };

  const sourceOrders =
    activeStatus === 'To Deliver' ? toDeliverOrders :
    activeStatus === 'Complete' ? completedOrders : orders;

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

  const getStatusCount = (status) => {
    if (status === 'To Deliver') return toDeliverOrders.length;
    if (status === 'Complete') return completedOrders.length;
    return orders.filter(o => o.status === status).length;
  };

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
        onPress={() => navigation.navigate('ViewOrderDetails', { order: item })}
      >
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>Order #: {item.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] }]}>
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
          <TouchableOpacity style={styles.actionButton} onPress={() => handleCancelOrder(item)}>
            <Text style={styles.buttonText}>Cancel Order</Text>
          </TouchableOpacity>
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

      <View style={styles.header}>
  <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
    <Ionicons name="arrow-back" size={24} color="#fff" />
  </TouchableOpacity>
  <Text style={styles.headerTitle}>Orders</Text>
</View>

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
};

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
  statusImage: { width: 20, height: 20, resizeMode: 'contain', marginRight: 5 },
  header: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 15,
  paddingVertical: 10,
  backgroundColor: '#3B82F6',
  borderBottomWidth: 1,
  borderBottomColor: '#ddd',
},
backButton: {
  padding: 6,
  backgroundColor: '#2563EB',
  borderRadius: 6,
  marginRight: 10,
},
headerTitle: {
  fontSize: 20,
  fontWeight: '700',
  color: '#fff',
},

});

export default OrdersDetails;
