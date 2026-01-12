// src/screens/Users/ViewProduct.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  deleteDoc
} from "firebase/firestore";
import { useRoute, useNavigation } from '@react-navigation/native';
import ReportModal from '../user/ReportModal';

export default function ViewProduct() {
  const route = useRoute();
  const navigation = useNavigation();
  const { vendorId } = route.params; // make sure this exists
  const { productId } = route.params;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariation, setSelectedVariation] = useState(null);
const [selectedServices, setSelectedServices] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [reportVisible, setReportVisible] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [vendorProfileImage, setVendorProfileImage] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const scaleAnim = useState(new Animated.Value(0))[0]; // Pop-in animation

  // Load current user info
  useEffect(() => {
    const loadUser = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const ref = doc(db, "Users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setUserData(snap.data());
      }
    };
    loadUser();
  }, []);

  // Fetch product
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const docRef = doc(db, 'Products', productId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProduct(docSnap.data());
        } else {
          Alert.alert('Error', 'Product not found');
        }
      } catch (err) {
        console.log(err);
        Alert.alert('Error', 'Failed to fetch product');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  // Fetch vendor info
  useEffect(() => {
    const fetchVendorData = async () => {
      if (!product?.uploadedBy?.uid) return;

      try {
        const vendorQuery = query(
          collection(db, 'ApprovedVendors'),
          where('userId', '==', product.uploadedBy.uid)
        );
        const vendorSnap = await getDocs(vendorQuery);
        if (!vendorSnap.empty) {
          const vendorDoc = vendorSnap.docs[0];
          const vendorData = vendorDoc.data();
          setVendorProfileImage(vendorData.profileImage);

          const followersRef = collection(db, 'ApprovedVendors', vendorDoc.id, 'followers');
          const followersSnap = await getDocs(followersRef);
          setFollowersCount(followersSnap.size);
        }
      } catch (err) {
        console.log("Error fetching vendor data:", err);
      }
    };
    fetchVendorData();
  }, [product]);

  // Check follow status
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!product) return;
      const user = auth.currentUser;
      if (!user) return;

      try {
        const vendorQuery = query(
          collection(db, "ApprovedVendors"),
          where("userId", "==", product.uploadedBy.uid)
        );
        const vendorSnap = await getDocs(vendorQuery);
        if (!vendorSnap.empty) {
          const vendorDocId = vendorSnap.docs[0].id;
          const followerRef = doc(db, "ApprovedVendors", vendorDocId, "followers", user.uid);
          const followerSnap = await getDoc(followerRef);
          setIsFollowing(followerSnap.exists());
        }
      } catch (err) {
        console.log("Follow check error:", err);
      }
    };
    checkFollowStatus();
  }, [product]);

  const variationPrice = selectedVariation
    ? product?.variations?.[selectedVariation]?.price || product?.basePrice || 0
    : product?.basePrice || 0;

const servicePrice = useMemo(() => {
  if (!Array.isArray(selectedServices)) return 0;

  return selectedServices.reduce((total, key) => {
    return total + (product?.services?.[key]?.price || 0);
  }, 0);
}, [selectedServices, product]);

  const totalPrice = useMemo(
    () => (variationPrice + servicePrice) * quantity,
    [variationPrice, servicePrice, quantity]
  );

  const handleFollow = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return Alert.alert("Error", "You must be logged in");

      const vendorQuery = query(
        collection(db, "ApprovedVendors"),
        where("userId", "==", product.uploadedBy.uid)
      );

      const vendorSnap = await getDocs(vendorQuery);
      if (vendorSnap.empty) return Alert.alert("Error", "Vendor not found");

      const vendorDocId = vendorSnap.docs[0].id;
      const followerRef = doc(db, "ApprovedVendors", vendorDocId, "followers", user.uid);
      const followerSnap = await getDoc(followerRef);

      if (!followerSnap.exists()) {
        await setDoc(followerRef, {
          followerId: user.uid,
          followerEmail: user.email,
          followerName: `${userData?.firstName || ''} ${userData?.lastName || ''}`,
          followedAt: new Date(),
        });
        setIsFollowing(true);
      } else {
        await deleteDoc(followerRef);
        setIsFollowing(false);
      }
    } catch (err) {
      console.log("Follow error:", err);
      Alert.alert("Error", "Failed to update follow status");
    }
  };
const handleAddToCart = async () => {
  if (!selectedVariation)
    return Alert.alert('Notice', 'Please select a variation');

  try {
    const cartData = {
      userId: auth.currentUser.uid,
      productId,
      uploadedBy: {
        uid: product.uploadedBy.uid,
        businessName: product.uploadedBy.businessName,
        email: product.uploadedBy.email,
      },
      productName: product.productName,
      basePrice: variationPrice,
      productImage: product.imageBase64
        ? product.imageBase64.startsWith('data:image')
          ? product.imageBase64
          : `data:image/jpeg;base64,${product.imageBase64}`
        : null,
      category: product.category || 'Uncategorized',
      selectedVariation,

      // ✅ FINAL FIX — MULTIPLE SERVICES
      selectedServices: selectedServices.map(key => ({
        label: product.services[key].label,
        price: product.services[key].price,
      })),

      quantity,
      totalPrice,
      createdAt: serverTimestamp(),
    };

    await addDoc(
      collection(db, 'Carts', auth.currentUser.uid, 'items'),
      cartData
    );

    showSuccessModal();
  } catch (err) {
    console.log('Add to cart failed:', err);
    Alert.alert('Error', 'Failed to add product to cart');
  }
};


  const showSuccessModal = () => {
    setSuccessModalVisible(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setSuccessModalVisible(false));
    }, 2000);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>;
  if (!product) return null;

const enabledServices = product.services
  ? Object.entries(product.services)                      // 🔴 ADDED
      .filter(([_, s]) => s.enabled)                       // 🔴 ADDED
      .map(([key, s]) => ({ key, ...s }))                  // 🔴 ADDED
  : [];

  const variations = product.variations
    ? Object.keys(product.variations).map(key => ({ label: key, price: product.variations[key].price }))
    : [];

  // Determine image URI for display
  const productImageURI = product.imageBase64
    ? product.imageBase64.startsWith('data:image')
      ? product.imageBase64
      : `data:image/jpeg;base64,${product.imageBase64}`
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.iconButton} onPress={() => setReportVisible(true)}>
          <Image source={require('../../../assets/Alert.png')} style={styles.headerIcon} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('CartShop')}
        >
          <Image source={require('../../../assets/basket.png')} style={styles.headerIcon} />
        </TouchableOpacity>
      </View>

      {/* Product Image */}
      {productImageURI ? (
        <Image
          source={{ uri: productImageURI }}
          style={styles.productImage}
        />
      ) : (
        <View style={styles.noImage}>
          <Text style={styles.noImageText}>No Image</Text>
        </View>
      )}

      {/* Vendor Card */}
      <View style={styles.vendorCard}>
        <View style={styles.vendorTopRow}>
          {vendorProfileImage ? (
            <Image source={{ uri: vendorProfileImage }} style={styles.vendorImage} />
          ) : (
            <View style={styles.vendorPlaceholder}>
              <Text style={{ color: '#6B7280', fontWeight: '700' }}>
                {product.uploadedBy.businessName?.[0] || 'V'}
              </Text>
            </View>
          )}

          <View style={styles.vendorInfoColumn}>
            <Text style={styles.businessName}>{product.uploadedBy.businessName}</Text>
            <Text style={styles.followersCount}>{followersCount} Followers</Text>
          </View>

          <TouchableOpacity
            onPress={handleFollow}
            style={[styles.followBtn, { backgroundColor: isFollowing ? "#059669" : "#3B82F6" }]}
          >
            <Text style={styles.followText}>{isFollowing ? "Following" : "Follow"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.vendorBottomRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('ViewShop', { vendorId: product.uploadedBy.uid })}
            style={styles.viewShopBtn}
          >
            <Text style={styles.viewShopText}>View Shop</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('ChatScreen', { vendorId: product.uploadedBy.uid })}
            style={styles.chatBtn}
          >
            <Text style={styles.chatText}>Chat Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Product Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.productName}>{product.productName}</Text>
        <Text style={styles.basePrice}>₱ {product.basePrice.toFixed(2)} / kg</Text>
      </View>

      {/* Variations */}
      {variations.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Variations</Text>
          {variations.map((v, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.optionRow, selectedVariation === v.label && styles.selectedOption]}
              onPress={() => setSelectedVariation(selectedVariation === v.label ? null : v.label)}
            >
              <View style={[styles.radioOuter, selectedVariation === v.label && styles.radioSelectedOuter]}>
                {selectedVariation === v.label && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.optionText}>{v.label} (₱{v.price})</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

{/* Services */}
{enabledServices.length > 0 && (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Optional Services</Text>

    {enabledServices.map((s, i) => {
      const isSelected = selectedServices.includes(s.key);

      return (
        <TouchableOpacity
          key={i}
          style={[styles.optionRow, isSelected && styles.selectedOption]}
          onPress={() => {
            setSelectedServices(prev =>
              isSelected
                ? prev.filter(k => k !== s.key)   // remove
                : [...prev, s.key]                 // add
            );
          }}
        >
          <View
            style={[
              styles.radioOuter,
              isSelected && styles.radioSelectedOuter
            ]}
          >
            {isSelected && <View style={styles.radioInner} />}
          </View>

          <Text style={styles.optionText}>
            {s.label} (₱{s.price})
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
)}



      {/* Quantity */}
      <View style={styles.quantityContainer}>
        <Text style={styles.cardTitle}>Quantity</Text>
        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(q => Math.max(1, q - 1))}>
            <Ionicons name="remove-outline" size={20} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.qtyText}>{quantity}</Text>

          <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(q => q + 1)}>
            <Ionicons name="add-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.totalText}>Total: ₱{totalPrice.toFixed(2)}</Text>
      </View>

      {/* Add to Cart */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
        <Text style={styles.addButtonText}>Add to Cart</Text>
      </TouchableOpacity>

      {/* Report Modal */}
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        productId={productId}
        productName={product.productName}
        product={product}
      />

      {/* Success Modal */}
      {successModalVisible && (
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleAnim }] }]}>
            <Image
              source={require('../../../assets/CheckOutSuccess.png')}
              style={styles.successImage}
            />
            <Text style={styles.modalTitle}>Added to Cart!</Text>
          </Animated.View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    marginBottom: 10
  },
  backButton: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  iconButton: { marginLeft: 12, padding: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  headerIcon: { width: 24, height: 24 },

  productImage: { width: '100%', height: 250, borderRadius: 16, marginBottom: 16 },
  noImage: { width: '100%', height: 250, borderRadius: 16, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  noImageText: { color: '#6B7280', fontSize: 16 },

  vendorCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginVertical: 8, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 3 },
  vendorTopRow: { flexDirection: "row", alignItems: "center" },
  vendorInfoColumn: { flex: 1, marginHorizontal: 12 },
  vendorImage: { width: 60, height: 60, borderRadius: 30 },
  vendorPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  businessName: { fontSize: 16, fontWeight: "600" },
  followersCount: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  vendorBottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  followBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  followText: { color: "#fff", fontWeight: "bold" },
  viewShopBtn: { backgroundColor: "#3B82F6", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, flex: 1, marginRight: 8 },
  viewShopText: { color: "#fff", fontWeight: "bold", textAlign: "center" },
  chatBtn: { backgroundColor: "#3B82F6", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, flex: 1 },
  chatText: { color: "#fff", fontWeight: "bold", textAlign: "center" },

  infoContainer: { marginBottom: 20 },
  productName: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  basePrice: { fontSize: 18, fontWeight: '600', color: '#15803D' },

  card: { backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  selectedOption: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 6 },
  optionText: { fontSize: 16, marginLeft: 10 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  radioSelectedOuter: { borderColor: '#2563EB' },
  radioInner: { width: 11, height: 11, backgroundColor: '#2563EB', borderRadius: 6 },

  quantityContainer: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 20 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  qtyButton: { backgroundColor: '#3B82F6', padding: 10, borderRadius: 8 },
  qtyText: { fontSize: 18, fontWeight: '600', marginHorizontal: 12 },
  totalText: { fontSize: 18, fontWeight: '700', color: '#111827' },

  addButton: { backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 14, marginBottom: 40 },
  addButtonText: { color: '#fff', fontSize: 18, textAlign: 'center', fontWeight: '700' },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    width: 350,
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  successImage: { width: 100, height: 100, marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#111827' },
});
