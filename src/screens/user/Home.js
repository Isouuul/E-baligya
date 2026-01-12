// src/screens/Users/HomeScreen.js
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  FlatList,
  Dimensions,
  RefreshControl,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Swiper from "react-native-swiper";
import * as Location from "expo-location";
import { auth, db } from "../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

// Assets
import BasketIcon from "../../../assets/basket.png";
import MessageIcon from "../../../assets/message.png";
import FishIcon from "../../../assets/Fish.png";
import MolluskIcon from "../../../assets/mollusk.png";
import CrustaceanIcon from "../../../assets/Crustacean.png";
import TrendIcon from "../../../assets/Trend.png";
import NoOrderImg from "../../../assets/no-order.png";
import AddToBasketIcon from "../../../assets/add-to-basket.png";

const { width } = Dimensions.get("window");
const ITEMS_PER_PAGE = 4; // Horizontal pagination

export default function Home({ navigation }) {
  const [firstName, setFirstName] = useState("User");
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState("Fetching location...");
  const [products, setProducts] = useState([]);
  const [trendFish, setTrendFish] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const [productPage, setProductPage] = useState(1);
  const [trendPage, setTrendPage] = useState(1);

  const promos = [
    { id: 1, text: "Catch the deal before it swims away", color: "#E3F2FD", image: require("../../../assets/slid-1.jpg") },
    { id: 2, text: "Seafood made simple — pick up or delivery.", color: "#FFF3E0", image: require("../../../assets/slid-2.jpg") },
    { id: 3, text: "Life’s better with fresh fish", color: "#E8F5E9", image: require("../../../assets/slid-3.jpg") },
  ];

  const filters = [
    { name: "Fish", icon: FishIcon },
    { name: "Mollusk", icon: MolluskIcon },
    { name: "Crustacean", icon: CrustaceanIcon },
    { name: "Trend", icon: TrendIcon },
  ];

  // Shuffle array utility
  const shuffleArray = (array) => {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Fetch user's first name
  useEffect(() => {
    const fetchFirstName = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const q = query(collection(db, "Users"), where("uid", "==", uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          setFirstName(userData.firstName || "User");
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchFirstName();
  }, []);

  // Live location
  useEffect(() => {
    let sub;
    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setAddress("Permission denied");
        return;
      }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
        async (loc) => {
          const [geo] = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          setAddress(geo ? `${geo.city || ""}, ${geo.region || ""}` : "Unknown");
        }
      );
    };
    startTracking();
    return () => sub?.remove();
  }, []);

  // Fetch products and trending
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const qProducts = query(collection(db, "Products"));
      const snapshotProducts = await getDocs(qProducts);
      const listProducts = snapshotProducts.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(shuffleArray(listProducts));
      const listTrend = listProducts.filter((i) => i.category === "Trend");
      setTrendFish(shuffleArray(listTrend));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  // Animated product card
  const AnimatedProductCard = ({ item, index }) => {
    const slideAnim = useRef(new Animated.Value(-width)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 100, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true }),
      ]).start();
    }, []);

    return (
      <Animated.View style={{ transform: [{ translateX: slideAnim }], opacity: fadeAnim }}>
        <View style={styles.productCard}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('ViewProduct', { productId: item.id })}
          >
            {item.imageBase64 ? (
              <Image source={{ uri: item.imageBase64 }} style={styles.productImage} />
            ) : (
              <View style={[styles.productImage, styles.noImageBox]}>
                <Text>No Image</Text>
              </View>
            )}
            <Text style={styles.productName} numberOfLines={1}>{item.productName || item.name}</Text>
            <Text style={styles.productPrice}>₱{item.basePrice || item.price}</Text>
          </TouchableOpacity>

          <View style={styles.buttonColumn}>


            <TouchableOpacity style={[styles.addToCartBtn, { backgroundColor: '#1a458bff'}]} onPress={() => console.log("Buy Now", item)}>
              <Ionicons name="cash" size={18} color="#fff" style={{ marginRight: 10 }} />
              <Text style={{ color: '#fff', fontWeight: '600' }}>Buy Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  // Horizontal pagination logic
  const getPaginatedData = (data, page) => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return data.slice(start, start + ITEMS_PER_PAGE);
  };

  const renderSection = (data, type, title) => {
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const page = type === "trending" ? trendPage : productPage;
    const paginatedData = getPaginatedData(data, page);

    return (
      <View style={styles.cardSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Product", { selectedCategory: type === "trending" ? "Trend" : null })}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        {paginatedData.length > 0 ? (
          <FlatList
            data={paginatedData}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => <AnimatedProductCard item={item} index={index} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          />
        ) : (
          <View style={styles.emptyBox}>
            <Image source={NoOrderImg} style={styles.emptyImg} />
            <Text style={styles.emptyText}>{type === "trending" ? "No Trending Fish" : "No Products Available"}</Text>
          </View>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              onPress={() => type === "trending" ? setTrendPage(Math.max(1, trendPage - 1)) : setProductPage(Math.max(1, productPage - 1))}
              disabled={page === 1}
              style={[styles.paginationBtn, page === 1 && { opacity: 0.5 }]}
            >
              <Text style={styles.paginationText}>◀</Text>
            </TouchableOpacity>

            <Text style={styles.paginationText}>{page} / {totalPages}</Text>

            <TouchableOpacity
              onPress={() => type === "trending" ? setTrendPage(Math.min(totalPages, trendPage + 1)) : setProductPage(Math.min(totalPages, productPage + 1))}
              disabled={page === totalPages}
              style={[styles.paginationBtn, page === totalPages && { opacity: 0.5 }]}
            >
              <Text style={styles.paginationText}>▶</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A73E8" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <StatusBar hidden />

      {/* HEADER */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.helloText}>Hello,</Text>
          <Text style={styles.nameText}>{firstName}</Text>
          <Text style={styles.locationText}><Ionicons name="location-outline" size={16} /> {address}</Text>
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate("CartShop")}>
            <Image source={BasketIcon} style={styles.headerIconImg} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate("InboxScreen", { userId: auth.currentUser?.uid })}>
            <Image source={MessageIcon} style={styles.headerIconImg} />
          </TouchableOpacity>
        </View>
      </View>

      {/* FILTERS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {filters.map((f, i) => (
          <TouchableOpacity key={i} style={styles.filterCard} onPress={() => navigation.navigate("Product", { selectedCategory: f.name })}>
            <Image source={f.icon} style={styles.filterIcon} />
            <Text style={styles.filterText}>{f.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* SLIDER */}
      <View style={styles.slider}>
        <Swiper autoplay height={170} showsPagination activeDotColor="#1A73E8">
          {promos.map((p) => (
            <View key={p.id} style={styles.slide}>
              <Image source={p.image} style={styles.slideImg} />
              <View style={[styles.promoOverlay, { backgroundColor: p.color + "CC" }]}>
                <Text style={styles.promoText}>{p.text}</Text>
              </View>
            </View>
          ))}
        </Swiper>
      </View>

      {/* SECTIONS */}
      {renderSection(products, "product", "Products")}
      {renderSection(trendFish, "trending", "Trending Fish")}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F8FC", padding: 15 },
  topHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 15 },
  helloText: { fontSize: 18, color: "#555" },
  nameText: { fontSize: 24, fontWeight: "700", color: "#000", marginTop: -4 },
  locationText: { marginTop: 5, fontSize: 14, color: "#444" },
  headerIcons: { flexDirection: "row", alignItems: "center" },
  iconButton: { marginLeft: 15 },
  headerIconImg: { width: 26, height: 26 },

  filterRow: { marginBottom: 20 },
  filterCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#DBEAFE", paddingHorizontal: 15, paddingVertical: 9, borderRadius: 25, marginRight: 12, gap: 8 },
  filterIcon: { width: 22, height: 22 },
  filterText: { fontWeight: "600", color: "#01171cff" },

  slider: { height: 170, borderRadius: 15, overflow: "hidden", marginBottom: 25 },
  slide: { width: "100%", height: "100%" },
  slideImg: { width: "100%", height: "100%" },
  promoOverlay: { position: "absolute", bottom: 0, width: "100%", padding: 12, justifyContent: "center", alignItems: "center" },
  promoText: { fontSize: 18, fontWeight: "700", color: "#000" },

  cardSection: { marginBottom: 25 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#1A73E8" },
  seeAllText: { color: "#1A73E8", fontWeight: "600" },

  productCard: { backgroundColor: "#fff", borderRadius: 5, width: 140, marginRight: 12, paddingBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  productImage: { width: "100%", height: 120, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  noImageBox: { width: "100%", height: 120, justifyContent: "center", alignItems: "center", backgroundColor: "#E5E7EB" },
  productName: { marginTop: 8, marginLeft: 10, fontSize: 15, fontWeight: "700", color: "#333" },
  productPrice: { marginLeft: 10, marginBottom: 10, color: "#777", fontSize: 15 },
  buttonColumn: { justifyContent: 'center', alignItems: 'flex-start', padding: 8 },
  addToCartBtn: {  backgroundColor: '#3B82F6', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  addIcon: { width: 18, height: 18, marginRight: 4 },

  emptyBox: { alignItems: "center", marginVertical: 25 },
  emptyImg: { width: 80, height: 80, marginBottom: 10 },
  emptyText: { color: "#777" },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16, color: "#1A73E8" },

  paginationRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  paginationBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#DBEAFE', borderRadius: 8, marginHorizontal: 8 },
  paginationText: { fontSize: 14, fontWeight: '600', color: '#1A73E8' },
});
