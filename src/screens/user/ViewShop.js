// src/screens/Users/ViewShop.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db, auth } from "../../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import AddToBasketIcon from "../../../assets/add-to-basket.png";
import AddingCartModal from "./AddingCartModal";

export default function ViewShop() {
  const route = useRoute();
  const navigation = useNavigation();
  const { vendorId } = route.params;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorProfileImage, setVendorProfileImage] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [businessName, setBusinessName] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);

  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [filteredProducts, setFilteredProducts] = useState([]);
const [category, setCategory] = useState("All");

useEffect(() => {
  if (category === "All") {
    setFilteredProducts(products);
  } else {
    setFilteredProducts(products.filter(p => p.category === category));
  }
}, [category, products]);

  const categories = [
  { name: "All", icon: require("../../../assets/all.png") },
  { name: "Fish", icon: require("../../../assets/Fish.png") },
  { name: "Mollusk", icon: require("../../../assets/mollusk.png") },
  { name: "Crustacean", icon: require("../../../assets/Crustacean.png") },
  { name: "Trend", icon: require("../../../assets/Trend.png") },
];

  // Base64 image conversion
  const Base64Image = ({ base64, productId, style }) => {
    const [localUri, setLocalUri] = useState(null);

    useEffect(() => {
      const saveToFile = async () => {
        if (!base64) return;
        const fileUri = FileSystem.cacheDirectory + `${productId}.jpg`;

        try {
          const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
          await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setLocalUri(fileUri);
        } catch (err) {
          console.log("Base64 image error:", err);
        }
      };

      saveToFile();
    }, [base64]);

    if (!localUri) return null;
    return <Image source={{ uri: localUri }} style={style} />;
  };

  const openAddToCartModal = (product) => {
    setSelectedProduct(product);
    setSelectedVariation(null);
    setSelectedServices([]);
    setModalVisible(true);
  };

  const handleBuyNow = (item) => {
    navigation.navigate("BuyNowCheckedOut", {
      product: item,
      quantity: 1,
    });
  };

  // Load current user info
  useEffect(() => {
    const loadUser = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "Users", user.uid));
      if (snap.exists()) setCurrentUserData(snap.data());
    };
    loadUser();
  }, []);

  // Load vendor info, followers, products, ratings
  useEffect(() => {
    if (!vendorId) return;

    const loadVendorData = async () => {
      try {
        const vendorQuery = query(
          collection(db, "ApprovedVendors"),
          where("userId", "==", vendorId)
        );
        const vendorSnap = await getDocs(vendorQuery);
        if (vendorSnap.empty) return;

        const vendorDoc = vendorSnap.docs[0];
        const vendorDocId = vendorDoc.id;
        const vendorData = vendorDoc.data();

        setVendorProfileImage(vendorData.profileImage || null);

        // Followers
        const followersRef = collection(db, "ApprovedVendors", vendorDocId, "followers");
        const unsubscribeFollowers = onSnapshot(followersRef, (snapshot) => {
          setFollowersCount(snapshot.size);
          const currentUser = auth.currentUser;
          if (currentUser) {
            setIsFollowing(snapshot.docs.some(doc => doc.id === currentUser.uid));
          }
        });

        // Products
        const productsRef = collection(db, "Products");
        const q = query(productsRef, where("uploadedBy.uid", "==", vendorId));
        const unsubscribeProducts = onSnapshot(q, (snapshot) => {
          const list = [];
          snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
          setProducts(list);
          setLoading(false);

          if (list.length > 0) {
            setBusinessName(list[0].uploadedBy.businessName || "Unknown");
          } else {
            setBusinessName(vendorData.businessName || "Unknown");
          }
        });

        // Ratings
        const ratingsRef = collection(db, "ApprovedVendors", vendorDocId, "Rating");
        const unsubscribeRatings = onSnapshot(ratingsRef, (snapshot) => {
          const ratings = snapshot.docs.map(doc => doc.data().rating || 0);
          if (ratings.length > 0) {
            const total = ratings.reduce((acc, val) => acc + val, 0);
            setAverageRating(total / ratings.length);
            setTotalRatings(ratings.length);
          } else {
            setAverageRating(0);
            setTotalRatings(0);
          }
        });

        return () => {
          unsubscribeFollowers();
          unsubscribeProducts();
          unsubscribeRatings();
        };
      } catch (err) {
        console.log("Error loading vendor data:", err);
      }
    };

    loadVendorData();
  }, [vendorId]);

  // Handle follow/unfollow
  const handleFollow = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return alert("You must be logged in");

      const vendorQuery = query(
        collection(db, "ApprovedVendors"),
        where("userId", "==", vendorId)
      );
      const vendorSnap = await getDocs(vendorQuery);
      if (vendorSnap.empty) return;

      const vendorDocId = vendorSnap.docs[0].id;
      const followerRef = doc(
        db,
        "ApprovedVendors",
        vendorDocId,
        "followers",
        currentUser.uid
      );

      const followerSnap = await getDoc(followerRef);
      if (!followerSnap.exists()) {
        await setDoc(followerRef, {
          followerId: currentUser.uid,
          followerEmail: currentUser.email,
          followerName: `${currentUserData?.firstName || ""} ${currentUserData?.lastName || ""}`,
          followedAt: new Date(),
        });
      } else {
        await deleteDoc(followerRef);
      }
    } catch (err) {
      console.log("Follow/unfollow error:", err);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back-outline" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() =>
            Alert.alert("Report Vendor", "Are you sure you want to report this vendor?", [
              { text: "Cancel", style: "cancel" },
              { text: "Report", onPress: () => console.log("Vendor reported:", vendorId) },
            ])
          }
        >
          <Image
            source={require("../../../assets/Alert.png")}
            style={styles.headerIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {/* Vendor Info Card */}
      <View style={styles.vendorCard}>
        {vendorProfileImage ? (
          <Image source={{ uri: vendorProfileImage }} style={styles.vendorImage} />
        ) : (
          <View style={styles.vendorPlaceholder}>
            <Text style={{ color: "#000", fontWeight: "700" }}>
              {businessName?.[0] || "V"}
            </Text>
          </View>
        )}

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.vendorName}>{businessName}</Text>
          <Text style={styles.vendorEmail}>{followersCount} Followers</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            {[1, 2, 3, 4, 5].map(star => (
              <Ionicons
                key={star}
                name={star <= Math.round(averageRating) ? "star" : "star-outline"}
                size={16}
                color="#FBBF24"
                style={{ marginRight: 2 }}
              />
            ))}
            <Text style={{ marginLeft: 6, color: '#374151', fontSize: 12 }}>
              {averageRating.toFixed(1)} ({totalRatings})
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleFollow}
          style={[styles.followBtn, { flexDirection: "row", alignItems: "center" }]}
        >
          <Image
            source={require("../../../assets/follow.png")}
            style={styles.actionIcon}
          />
          <Text style={styles.followText}>{isFollowing ? "Following" : "Follow"}</Text>
        </TouchableOpacity>
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


      {/* Products List */}
<FlatList
  data={filteredProducts}
  keyExtractor={(item) => item.id}
  showsVerticalScrollIndicator={false}
  contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 30 }}
  renderItem={({ item }) => (
    <View style={styles.productCardRow}>
      {/* Left Image */}
      {item.imageBase64 ? (
        <Base64Image
          base64={item.imageBase64}
          productId={item.id}
          style={styles.productImageRow}
        />
      ) : (
        <View style={[styles.productImageRow, styles.noImage]}>
          <Text>No Image</Text>
        </View>
      )}

      {/* Center Info */}
      <View style={styles.productInfoRow}>
        <Text numberOfLines={1} style={styles.productNameRow}>
          {item.productName}
        </Text>
        <Text style={styles.productPriceRow}>₱ {item.basePrice} / kg</Text>
      </View>

      {/* Right Buttons */}
      <View style={styles.buttonColumnRow}>
        <TouchableOpacity
          style={styles.addToCartBtnRow}
          onPress={() => openAddToCartModal(item)}
        >
          <Image source={AddToBasketIcon} style={styles.addIconRow} />
          <Text style={{ color: "#fff", fontWeight: "600" }}>Add To Cart</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.addToCartBtnRow, { backgroundColor: "#22C55E", marginTop: 6 }]}
          onPress={() => handleBuyNow(item)}
        >
          <Ionicons name="cash" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 4 }}>
            Buy Now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )}
/>


      <AddingCartModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        product={selectedProduct}
        selectedVariation={selectedVariation}
        setSelectedVariation={setSelectedVariation}
        selectedServices={selectedServices}
        setSelectedServices={setSelectedServices}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#3B82F6",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 10,
  },
  backButton: { padding: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", marginRight: 12 },
  iconButton: { marginLeft: 16, padding: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)" },
  headerIcon: { width: 24, height: 24 },
  vendorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 12,
    borderRadius: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  vendorImage: { width: 60, height: 60, borderRadius: 30 },
  vendorPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  vendorName: { fontSize: 18, fontWeight: "700", color: "#000" },
  vendorEmail: { fontSize: 14, color: "#6B7280" },
  followBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#3B82F6" },
  followText: { color: "#fff", fontWeight: "bold" },
  actionIcon: { width: 20, height: 20, marginRight: 6, resizeMode: "contain" },

  // Product Row Styles
  productCardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginVertical: 6,
    padding: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  productImageRow: { width: 65 , height: 65, borderRadius: 10 },
  productInfoRow: { flex: 1, marginLeft: 12, justifyContent: "center" },
  productNameRow: { fontSize: 14, fontWeight: "600" },
  productPriceRow: { fontSize: 13, color: "#047857", marginTop: 4 },
  buttonColumnRow: { justifyContent: "center", alignItems: "flex-end" },
  addToCartBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  addIconRow: { width: 18, height: 18, marginRight: 4, resizeMode: "contain" },

  noImage: { justifyContent: "center", alignItems: "center", backgroundColor: "#E5E7EB", borderRadius: 10 },
  categoryScroll: { paddingVertical: 12, paddingHorizontal: 15 },
  categoryButton: { backgroundColor: '#DBEAFE', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginRight: 10, height: 30, flexDirection: 'row', alignItems: 'center' },
  activeCategoryButton: { backgroundColor: '#1e3a8a' },
  categoryButtonText: { color: '#374151', fontSize: 14, fontWeight: '500' },
  activeCategoryText: { color: '#fff' },
  categoryIcon: { width: 20, height: 20, marginRight: 6, resizeMode: 'contain' },
});
