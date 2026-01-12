// src/screens/Users/CartShop.js
import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import WarningIcon from '../../../assets/warning.png';

export default function CartShop() {
  const navigation = useNavigation();
  const user = auth.currentUser;
  const [cartItems, setCartItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const opacityRefs = useRef({});

  useEffect(() => { fetchCartItems(); }, []);

  const fetchCartItems = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'Carts', user.uid, 'items'));
      const data = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setCartItems(data);

      const newRefs = {};
      data.forEach(item => (newRefs[item.id] = new Animated.Value(1)));
      opacityRefs.current = newRefs;
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load cart items.');
    } finally { setLoading(false); }
  };

  const groupedItems = useMemo(() => {
    const groups = {};
    cartItems.forEach(item => {
      const vendorKey = item.uploadedBy?.email;
      if (!vendorKey) return;

      if (!groups[vendorKey]) {
        groups[vendorKey] = {
          vendorEmail: vendorKey,
          businessName: item.uploadedBy?.businessName || 'Unknown Vendor',
          items: [],
        };
      }
      groups[vendorKey].items.push(item);
    });
    return Object.values(groups);
  }, [cartItems]);

  const toggleSelectItem = id =>
    setSelectedItems(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));

  const toggleSelectShop = shopItems => {
    const shopItemIds = shopItems.map(i => i.id);
    const allSelected = shopItemIds.every(id => selectedItems.includes(id));
    setSelectedItems(prev =>
      allSelected
        ? prev.filter(id => !shopItemIds.includes(id))
        : [...prev, ...shopItemIds.filter(id => !prev.includes(id))]
    );
  };

  const updateQuantity = async (item, newQty) => {
    if (newQty < 1) return;
    try {
      await updateDoc(doc(db, 'Carts', user.uid, 'items', item.id), { quantity: newQty });
      setCartItems(prev => prev.map(i => (i.id === item.id ? { ...i, quantity: newQty } : i)));
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update quantity.');
    }
  };

  const removeItem = item => {
    Animated.timing(opacityRefs.current[item.id], { toValue: 0, duration: 300, useNativeDriver: true })
      .start(async () => {
        try {
          await deleteDoc(doc(db, 'Carts', user.uid, 'items', item.id));
          setCartItems(prev => prev.filter(i => i.id !== item.id));
          setSelectedItems(prev => prev.filter(id => id !== item.id));
        } catch (err) {
          console.error(err);
          Alert.alert('Error', 'Failed to remove item.');
        }
      });
  };

  const removeShop = shopItems => {
    const animations = shopItems.map(item =>
      Animated.timing(opacityRefs.current[item.id], { toValue: 0, duration: 200, useNativeDriver: true })
    );
    Animated.stagger(50, animations).start(async () => {
      try {
        await Promise.all(shopItems.map(item => deleteDoc(doc(db, 'Carts', user.uid, 'items', item.id))));
        const shopItemIds = shopItems.map(i => i.id);
        setCartItems(prev => prev.filter(i => !shopItemIds.includes(i.id)));
        setSelectedItems(prev => prev.filter(id => !shopItemIds.includes(id)));
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to remove shop items.');
      }
    });
  };

  const selectedTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      if (!selectedItems.includes(item.id)) return sum;
      const base = Number(item.basePrice || 0);
      const variationPrice = Number(item.selectedVariationPrice || 0);
      const servicesTotal = (item.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0);
      return sum + (base + variationPrice + servicesTotal) * (item.quantity || 1);
    }, 0);
  }, [selectedItems, cartItems]);

  const handleCheckout = () => {
    if (!selectedItems.length) return Alert.alert('Notice', 'Please select items to checkout.');
    navigation.navigate('CheckedOut', { selectedItems: cartItems.filter(i => selectedItems.includes(i.id)) });
  };

  const renderItemCard = item => {
    const isSelected = selectedItems.includes(item.id);
    const base = Number(item.basePrice || 0);
    const variationPrice = Number(item.selectedVariationPrice || 0);
    const servicesTotal = (item.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0);
    const itemTotal = (base + variationPrice + servicesTotal) * (item.quantity || 1);

    return (
      <Swipeable key={item.id} renderRightActions={() => renderRightActions(item)}>
        <Animated.View
          style={[
            styles.itemCard,
            isSelected && styles.itemSelected,
            { opacity: opacityRefs.current[item.id] },
          ]}
        >
          <View style={styles.productRow}>
            <TouchableOpacity style={styles.checkboxContainer} onPress={() => toggleSelectItem(item.id)}>
              <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={24} color={isSelected ? '#3B82F6' : '#9CA3AF'} />
            </TouchableOpacity>

            {item.productImage ? (
              <Image source={{ uri: item.productImage }} style={styles.productImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="image-outline" size={32} color="#9CA3AF" />
              </View>
            )}

            <View style={styles.productDetails}>
              <Text style={styles.productText}>{item.productName}</Text>
              {item.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{item.category}</Text>
                </View>
              )}
              <Text style={styles.variationText}>Variation: {item.selectedVariation || 'N/A'}</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity onPress={() => updateQuantity(item, item.quantity - 1)}>
                  <Ionicons name="remove-circle-outline" size={24} color="#3B82F6" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity onPress={() => updateQuantity(item, item.quantity + 1)}>
                  <Ionicons name="add-circle-outline" size={24} color="#3B82F6" />
                </TouchableOpacity>
                <Text style={styles.itemTotal}>₱{itemTotal.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </Swipeable>
    );
  };

  const renderRightActions = item => (
    <TouchableOpacity style={styles.deleteButton} onPress={() => removeItem(item)}>
      <Ionicons name="trash-outline" size={24} color="#fff" />
    </TouchableOpacity>
  );

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.center}>
          <Image source={WarningIcon} style={{ width: 80, height: 80, marginBottom: 15 }} />
          <Text style={styles.emptyText}>Your cart is empty</Text>
        </View>
      ) : (
        <FlatList
          data={groupedItems}
          keyExtractor={group => group.vendorEmail}
          contentContainerStyle={{ paddingBottom: 120 }}
          renderItem={({ item: group }) => {
            const shopAllSelected = group.items.every(i => selectedItems.includes(i.id));
            return (
              <View key={group.vendorEmail} style={{ marginBottom: 12 }}>
                <View style={styles.shopHeader}>
                  <TouchableOpacity onPress={() => toggleSelectShop(group.items)} style={styles.selectAllButton}>
                    <Ionicons name={shopAllSelected ? 'checkbox' : 'square-outline'} size={22} color="#3B82F6" />
                    <Text style={styles.selectAllText}>{group.businessName}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeShop(group.items)}>
                    <Ionicons name="trash-outline" size={22} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                {group.items.map(item => renderItemCard(item))}
              </View>
            );
          }}
        />
      )}

      {cartItems.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.totalAmount}>Total: ₱{selectedTotal.toFixed(2)}</Text>
          <TouchableOpacity style={[styles.checkoutButton, !selectedItems.length && { opacity: 0.5 }]} onPress={handleCheckout} disabled={!selectedItems.length}>
            <Text style={styles.checkoutText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Simplified UI styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { height: 50, backgroundColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, borderRadius: 8, marginBottom: 10 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginLeft: 10 },
  itemCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginVertical: 6, elevation: 1 },
  itemSelected: { borderWidth: 1.5, borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  productRow: { flexDirection: 'row', alignItems: 'center' },
  checkboxContainer: { marginRight: 8 },
  productImage: { width: 80, height: 80, borderRadius: 10, marginRight: 10, backgroundColor: '#E5E7EB' },
  placeholderImage: { width: 80, height: 80, borderRadius: 10, marginRight: 10, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  productDetails: { flex: 1 },
  productText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  variationText: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  qtyText: { fontSize: 14, marginHorizontal: 8 },
  itemTotal: { fontSize: 14, fontWeight: '600', color: '#111827', marginLeft: 10 },
  selectAllButton: { flexDirection: 'row', alignItems: 'center' },
  selectAllText: { fontSize: 14, fontWeight: '600', marginLeft: 6, color: '#111827' },
  shopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  deleteButton: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 60, borderRadius: 10 },
  categoryBadge: { backgroundColor: '#1e3a8a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginTop: 2, alignSelf: 'flex-start' },
  categoryBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  emptyText: { color: '#6B7280', fontSize: 15 },
  footer: { backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderTopWidth: 1, borderColor: '#E5E7EB', position: 'absolute', bottom: 0, width: '100%' },
  totalAmount: { fontSize: 16, fontWeight: '700' },
  checkoutButton: { backgroundColor: '#3B82F6', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 8 },
  checkoutText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
