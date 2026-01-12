// src/screens/Users/Product.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { useRoute, useNavigation } from "@react-navigation/native";
import NoOrderImg from '../../../assets/no-order.png';
import BasketIcon from '../../../assets/basket.png';
import MessageIcon from '../../../assets/message.png';
import AddToBasketIcon from '../../../assets/add-to-basket.png';
import AddingCartModal from './AddingCartModal';
import BuyNowModal from './BuyNow';
import * as FileSystem from "expo-file-system";

const { width } = Dimensions.get('window');
const ITEMS_PER_PAGE = 16;

// Base64Image component
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

  if (!localUri) return null;
  return <Image source={{ uri: localUri }} style={style} />;
};

// Animated product card
function AnimatedProductCard({ item, index, onAddToCart, onBuyNow, navigation }) {
  const slideAnim = useRef(new Animated.Value(-width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ translateX: slideAnim }], opacity: fadeAnim }}>
      <View style={styles.productCard}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row' }}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ViewProduct', { productId: item.id })}
        >
          <View style={{ position: 'relative' }}>
            {item.imageBase64 ? (
              <Base64Image base64={item.imageBase64} productId={item.id} style={styles.productImage} />
            ) : (
              <View style={[styles.productImage, styles.noImage]}>
                <Text style={styles.noImageText}>No Image</Text>
              </View>
            )}
            {item.category && (
              <View style={styles.productCatgory}>
                <Text style={styles.productCat}>{item.category}</Text>
              </View>
            )}
          </View>

<View style={styles.productInfo}>
  <Text style={styles.productName} numberOfLines={1}>{item.productName}</Text>
  <Text style={styles.productPrice}>₱ {item.basePrice} / kg</Text>

  {/* Services below price */}
  {item.services?.length > 0 && (
    <View style={{ marginTop: 4 }}> 
      {item.services.map((s, idx) => (
        <Text key={idx} style={styles.serviceText}>• {s}</Text>
      ))}
    </View>
  )}
</View>
        </TouchableOpacity>

        <View style={styles.buttonColumn}>
          <TouchableOpacity
            style={styles.addToCartBtn}
            onPress={() => onAddToCart(item)}
          >
            <Image source={AddToBasketIcon} style={styles.addIcon} />
            <Text style={{ color: '#fff', fontWeight: '600' }}>Add To Cart</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addToCartBtn, { backgroundColor: '#1a458bff', marginTop: 6, width: 121}]}
            onPress={() => onBuyNow(item)}
          >
            <Ionicons name="cash" size={18} color="#fff" style={{ marginRight: 10 }} />
            <Text style={{ color: '#fff', fontWeight: '600' }}>Buy Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

export default function Product() {
  const navigation = useNavigation();
  const route = useRoute();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const initialCategory = route.params?.selectedCategory || "All";

  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [currentPage, setCurrentPage] = useState(1);
  const [cartItems, setCartItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Modal and lazy loading
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [buyNowModalVisible, setBuyNowModalVisible] = useState(false);
  const [buyNowProduct, setBuyNowProduct] = useState(null);

  const categories = [
    { name: "All", icon: require("../../../assets/all.png") },
    { name: "Fish", icon: require("../../../assets/Fish.png") },
    { name: "Mollusk", icon: require("../../../assets/mollusk.png") },
    { name: "Crustacean", icon: require("../../../assets/Crustacean.png") },
    { name: "Trend", icon: require("../../../assets/Trend.png") },
  ];

  const shuffleArray = (array) => {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const fetchProducts = async () => {
    try {
      const q = query(collection(db, 'Products'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      let list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.vendorSubscribed ? 1 : 0) - (a.vendorSubscribed ? 1 : 0));
      const subscribedProducts = shuffleArray(list.filter(p => p.vendorSubscribed));
      const normalProducts = shuffleArray(list.filter(p => !p.vendorSubscribed));
      setProducts([...subscribedProducts, ...normalProducts]);
    } catch (error) {
      console.log('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCartItems();
  }, []);

  const fetchCartItems = async () => {
    try {
      const q = query(collection(db, 'Carts'), where('userId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => doc.data());
      setCartItems(items);
    } catch (error) {
      console.log('Error fetching cart items:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  };

  const openAddToCartModal = (product) => {
    setSelectedProduct(product);
    setSelectedVariation(null);
    setSelectedServices([]);
    setModalVisible(true);
  };

  const handleBuyNow = (product) => {
    setBuyNowProduct(product);
    setBuyNowModalVisible(true);
  };

  // Filter products
  useEffect(() => {
    let filtered = [...products];
    if (category !== "All") filtered = filtered.filter(p => p.category === category);
    if (searchText.trim() !== '') {
      const text = searchText.toLowerCase();
      filtered = filtered.filter(
        p => (p.productName && p.productName.toLowerCase().includes(text)) ||
             (p.category && p.category.toLowerCase().includes(text))
      );
    }
    setFilteredProducts(filtered);
    setCurrentPage(1);
  }, [category, searchText, products]);

  // Animate empty list
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: filteredProducts.length === 0 ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [filteredProducts]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <View style={styles.container}>
<StatusBar hidden={true} />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or category..."
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          <Ionicons name="search" size={22} color="#1e40af" style={{ marginRight: 8 }} />
        </View>
        <View style={styles.iconGroup}>
          <TouchableOpacity onPress={() => navigation.navigate('CartShop')} style={{ position: 'relative' }}>
            <View style={styles.roundIcon}>
              <Image source={BasketIcon} style={styles.iconImagee} />
            </View>
            {cartItems.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartItems.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("InboxScreen")} style={styles.iconButton}>
            <View style={styles.roundIcon}>
              <Image source={MessageIcon} style={styles.iconImagee} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* CATEGORY FILTERS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
        {categories.map((cat, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.categoryButton, category === cat.name && styles.activeCategoryButton]}
            onPress={() => setCategory(cat.name)}
          >
            <Image source={cat.icon} style={styles.categoryIcon} />
            <Text style={[styles.categoryButtonText, category === cat.name && styles.activeCategoryText]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* PRODUCT LIST */}
      <View style={styles.listContainer}>
        {paginatedProducts.length > 0 ? (
          <FlatList
            data={paginatedProducts}
            renderItem={({ item, index }) => (
              <AnimatedProductCard
                item={item}
                index={index}
                onAddToCart={openAddToCartModal}
                onBuyNow={handleBuyNow}
                navigation={navigation}
              />
            )}
            keyExtractor={(item) => item.id}
            numColumns={1}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        ) : (
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <Image source={NoOrderImg} style={styles.noDataImage} />
            <Text style={styles.emptyText}>No products found</Text>
          </Animated.View>
        )}
      </View>

      {/* ADDING CART MODAL */}
      <AddingCartModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        product={selectedProduct}
        selectedVariation={selectedVariation}
        setSelectedVariation={setSelectedVariation}
        selectedServices={selectedServices}
        setSelectedServices={setSelectedServices}
        onAddToCart={fetchCartItems}
      />

      {/* BUY NOW MODAL */}
      <BuyNowModal
        visible={buyNowModalVisible}
        onClose={() => setBuyNowModalVisible(false)}
        product={buyNowProduct}
      />
    </View>
  );
}

// Styles (keep your original styles)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8FC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#3B82F6', },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, flex: 1, paddingHorizontal: 10, elevation: 3, marginRight: 15 },
  searchInput: { flex: 1, height: 42, fontSize: 15, color: '#374151' },
  iconGroup: { flexDirection: 'row' },
  iconButton: { marginLeft: 15 },
  badge: { position: 'absolute', top: -5, right: -10, backgroundColor: '#000', borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  categoryScroll: { paddingVertical: 12, paddingHorizontal: 15 },
  categoryButton: { backgroundColor: '#DBEAFE', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginRight: 10, height: 30, flexDirection: 'row', alignItems: 'center' },
  activeCategoryButton: { backgroundColor: '#1e3a8a' },
  categoryButtonText: { color: '#374151', fontSize: 14, fontWeight: '500' },
  activeCategoryText: { color: '#fff' },
  categoryIcon: { width: 20, height: 20, marginRight: 6, resizeMode: 'contain' },
productCard: {
  width: '100%',
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 10,
  marginVertical: 6,
  flexDirection: 'row',
  alignItems: 'center',
  // subtle shadow for depth
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 4,
  elevation: 2,
},

productImage: {
  width: 70,
  height: 70,
  borderRadius: 10,
},

productInfo: {
  flex: 1,
  justifyContent: 'center',
  marginLeft: 10,
},

productName: {
  fontSize: 14,
  fontWeight: '600',
  color: '#111827',
  marginTop: 0, // remove negative margin
},

productPrice: {
  fontSize: 13,
  fontWeight: '500',
  color: '#15803D',
  marginTop: 4, // small spacing below name
},

productCatgory: {
  position: 'absolute',
  top: 6,
  left: 6,
  backgroundColor: '#1E3A8A',
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 8,
},

productCat: {
  fontSize: 11,
  fontWeight: '500',
  color: '#fff',
},

  roundIcon: { width: 45, height: 45, borderRadius: 10, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginLeft: -2, marginRight: -10 },
  iconImagee: { width: 26, height: 26, resizeMode: 'contain' },
  noImage: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e2e8f0' },
  noImageText: { color: '#555', fontSize: 14 },
  addToCartBtn: { marginTop: 8, backgroundColor: '#3B82F6', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', justifyContent: 'center' },
  addIcon: { width: 22, height: 22, marginRight: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#64748b', fontSize: 15, marginTop: 10 },
  noDataImage: { width: 120, height: 120, resizeMode: 'contain', marginBottom: 10 },
  listContainer: { flex: 1, paddingTop: 10, paddingBottom: 20, marginTop: -650 },
  variationText: { fontSize: 13, color: '#374151', marginTop: 2 },
serviceText: {
  fontSize: 12,
  color: '#6b7280',
  marginTop: 2, // small spacing between services
},
 buttonColumn: { justifyContent: 'center', alignItems: 'flex-end' },
});
