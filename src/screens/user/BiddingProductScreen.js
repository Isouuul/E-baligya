// src/screens/Users/BiddingProductScreen.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StatusBar,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import * as FileSystem from "expo-file-system";

import NoOrderImg from '../../../assets/no-order.png';
import FishIcon from '../../../assets/Fish.png';
import MolluskIcon from '../../../assets/mollusk.png';
import CrustaceanIcon from '../../../assets/Crustacean.png';
import TrendIcon from '../../../assets/Trend.png';
import AllIcon from '../../../assets/all.png';

const { width } = Dimensions.get('window');
const ITEMS_PER_PAGE = 16;

// Fixed Base64 Image component
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

// Animated bidding card
function AnimatedBiddingCard({ item, index, navigation }) {
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

  const now = new Date();
  const end = item.endTime?.seconds ? new Date(item.endTime.seconds * 1000) : null;

  let timeLeft = '';
  if (end) {
    const diff = end - now;
    if (diff > 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      timeLeft = `${hours}h ${minutes}m ${seconds}s`;
    } else {
      timeLeft = 'Bidding Ended';
    }
  }

  return (
    <Animated.View style={{ transform: [{ translateX: slideAnim }], opacity: fadeAnim }}>
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ViewBiddingProduct', { productId: item.id })}
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
          <Text
            style={[styles.productPrice, { color: timeLeft === 'Bidding Ended' ? '#dc2626' : '#2563eb' }]}
          >
            {timeLeft}
          </Text>
          <Text style={styles.productPrice}>Starting Bid: ₱{item.startingPrice}</Text>
          <Text style={styles.productName} numberOfLines={1}>{item.productName}</Text>

          {item.variations?.length > 0 && (
            <View style={{ marginTop: 4 }}>
              {item.variations.map((v, idx) => (
                <Text key={idx} style={styles.variationText}>• {v}</Text>
              ))}
            </View>
          )}

          {item.services?.length > 0 && (
            <View style={{ marginTop: 2 }}>
              {item.services.map((s, idx) => (
                <Text key={idx} style={styles.serviceText}>• {s}</Text>
              ))}
            </View>
          )}

          {item.currentBid && (
            <Text style={styles.highestBid}>Highest Bid: ₱{item.currentBid}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function BiddingProductScreen({ navigation }) {
  const [biddingProducts, setBiddingProducts] = useState([]);
  const [filteredBidding, setFilteredBidding] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  const categories = [
    { name: 'All', icon: AllIcon },
    { name: 'Fish', icon: FishIcon },
    { name: 'Mollusk', icon: MolluskIcon },
    { name: 'Crustacean', icon: CrustaceanIcon },
    { name: 'Trend', icon: TrendIcon },
  ];

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchBiddingProducts = async () => {
      try {
        const bidCollection = collection(db, 'Bidding_Products');
        const q = query(bidCollection, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        const now = new Date();
        const items = snapshot.docs.map(doc => {
          const data = doc.data();
          const endTime = data.endTime?.seconds
            ? new Date(data.endTime.seconds * 1000)
            : null;

          return {
            id: doc.id,
            ...data,
            isActive: endTime ? endTime > now : true,
          };
        });

        const activeItems = items.filter(item => item.isActive);
        setBiddingProducts(activeItems);
        setFilteredBidding(activeItems);
      } catch (error) {
        console.log('Error fetching bidding products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBiddingProducts();
  }, []);

  // Live countdown update
  useEffect(() => {
    const interval = setInterval(() => {
      setFilteredBidding(prev => [...prev]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter by category and search
  useEffect(() => {
    let filtered = [...biddingProducts];
    if (category !== 'All') filtered = filtered.filter(p => p.category === category);
    const text = searchText.trim().toLowerCase();
    if (text !== '') {
      filtered = filtered.filter(
        p => (p.productName && p.productName.toLowerCase().includes(text)) ||
             (p.category && p.category.toLowerCase().includes(text))
      );
    }
    setFilteredBidding(filtered);
    setCurrentPage(1);
  }, [category, searchText, biddingProducts]);

  // Animate empty list
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: filteredBidding.length === 0 ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [filteredBidding]);

  const totalPages = Math.ceil(filteredBidding.length / ITEMS_PER_PAGE);
  const paginatedBidding = filteredBidding.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search bidding items..."
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          <Ionicons name="search" size={22} color="#1e40af" style={{ marginRight: 8 }} />
        </View>
        <View style={styles.iconGroup}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.roundIcon}
          >
            <Ionicons name="notifications-outline" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.roundIcon, { marginLeft: 10 }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* CATEGORY FILTER */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 10 }}
      >
        {categories.map((cat, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.categoryButton, category === cat.name && styles.activeCategoryButton]}
            onPress={() => setCategory(cat.name)}
          >
            <Image source={cat.icon} style={styles.categoryIconStyle} />
            <Text style={[styles.categoryButtonText, category === cat.name && styles.activeCategoryText]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* BIDDING PRODUCTS */}
      <View style={styles.listContainer}>
        {paginatedBidding.length > 0 ? (
          <FlatList
            data={paginatedBidding}
            renderItem={({ item, index }) => (
              <AnimatedBiddingCard item={item} index={index} navigation={navigation} />
            )}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
          />
        ) : (
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <Image source={NoOrderImg} style={styles.noDataImage} />
            <Text style={styles.emptyText}>No Bidding Available</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// Styles (unchanged)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8FC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#3B82F6', },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, flex: 1, paddingHorizontal: 10, elevation: 3, marginRight: 15 },
  searchInput: { flex: 1, height: 42, fontSize: 15, color: '#374151' },
  iconGroup: { flexDirection: 'row' },
  roundIcon: { width: 45, height: 45, borderRadius: 45 / 2, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginLeft: -2, marginRight: -10 },
  categoryButton: { backgroundColor: '#DBEAFE', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginRight: 10, height: 30, flexDirection: 'row', alignItems: 'center' },
  activeCategoryButton: { backgroundColor: '#1e3a8a' },
  categoryButtonText: { color: '#374151', fontSize: 14, fontWeight: '500' },
  activeCategoryText: { color: '#fff' },
  categoryIconStyle: { width: 20, height: 20, marginRight: 6, resizeMode: 'contain' },
  listContainer: { flex: 1, paddingTop: 10, paddingBottom: 20, marginTop: -650 },
  productCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: { width: 70, height: 70, borderRadius: 10 },
  productInfo: { flex: 1, justifyContent: 'center', marginLeft: 10 },
  productName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  productPrice: { fontSize: 13, fontWeight: '500', color: '#15803D', marginTop: 2 },
  highestBid: { fontSize: 13, fontWeight: '500', color: '#d97706', marginTop: 2 },
  productCatgory: { position: 'absolute', top: 6, left: 6, backgroundColor: '#1E3A8A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  productCat: { fontSize: 11, fontWeight: '500', color: '#fff' },
  noImage: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#e2e8f0' },
  noImageText: { color: '#555', fontSize: 14 },
  variationText: { fontSize: 13, color: '#374151', marginTop: 2 },
  serviceText: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#64748b', fontSize: 15, marginTop: 10 },
  noDataImage: { width: 120, height: 120, resizeMode: 'contain', marginBottom: 10 },
});
