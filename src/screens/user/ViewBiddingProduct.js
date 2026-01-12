// src/screens/Users/ViewBiddingProduct.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from "../../firebase";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  orderBy,
  query,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";

const { width } = Dimensions.get("window");

const ViewBiddingProduct = ({ route, navigation }) => {
  const { productId } = route.params;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [bidAmount, setBidAmount] = useState("");
  const [bidders, setBidders] = useState([]);
  const [loadingBidders, setLoadingBidders] = useState(false);
  const [userData, setUserData] = useState(null);
  const [timeLeft, setTimeLeft] = useState("Loading...");
  const [isExpired, setIsExpired] = useState(false);
  const [placingBid, setPlacingBid] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  // Report modal state
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedReportText, setSelectedReportText] = useState("");
  const [reportImage, setReportImage] = useState(null);

  // Add state for loading and success modal
const [reportSubmitting, setReportSubmitting] = useState(false);
const [reportSuccessModal, setReportSuccessModal] = useState(false);


const pickReportImage = async () => {
  let result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
    base64: true,
  });

  if (!result.canceled) {
    setReportImage(result.assets[0].uri);
  }
};


  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const userRef = doc(db, "Users", currentUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) setUserData(snap.data());
      } catch (e) {
        console.log("User load error:", e);
      }
    };
    fetchUserData();
  }, []);

  // Fetch product
  useEffect(() => {
    const fetch = async () => {
      try {
        const ref = doc(db, "Bidding_Products", productId);
        const snap = await getDoc(ref);
        if (snap.exists()) setProduct({ id: snap.id, ...snap.data() });
        else setProduct(null);
      } catch (e) {
        console.log("Product error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [productId]);

  // Realtime bidders
  useEffect(() => {
    if (!productId) return;
    setLoadingBidders(true);
    const bidsRef = collection(db, "RequestBidding", productId, "Bids");
    const q = query(bidsRef, orderBy("bidAmount", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBidders(list);
        setLoadingBidders(false);
      },
      (err) => {
        console.log("onSnapshot error:", err);
        setLoadingBidders(false);
      }
    );
    return () => unsub();
  }, [productId]);

  // Countdown timer
  useEffect(() => {
    if (!product?.endTime?.seconds) return;
    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(product.endTime.seconds * 1000);
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft("Bidding Ended");
        setIsExpired(true);
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [product]);

  // Normalize variations
  const getVariations = () => {
    if (!product?.variations) return [];
    if (Array.isArray(product.variations)) {
      return product.variations.map((v, i) =>
        typeof v === "string" ? [v, { price: 0 }] : [v.label || `var_${i}`, v]
      );
    }
    return Object.entries(product.variations);
  };

  // Preselect first variation automatically
  useEffect(() => {
    const variations = getVariations();
    if (variations.length > 0 && !selectedVariation) {
      const [firstLabel, firstData] = variations[0];
      const price = firstData?.price ?? 0;
      setSelectedVariation(firstLabel || "var_0");
      setBidAmount(price !== undefined && price !== null ? String(price) : "");
    }
  }, [product]);

  const getImageUri = (p) => {
    if (!p) return null;
    if (p.imageBase64)
      return p.imageBase64.startsWith("data:image")
        ? p.imageBase64
        : `data:image/jpeg;base64,${p.imageBase64}`;
    if (p.image && typeof p.image === "string")
      return p.image.startsWith("data:image") ? p.image : p.image;
    return null;
  };

  const handleVariationSelect = (label, price) => {
    setSelectedVariation(label);
    setBidAmount(price !== undefined && price !== null ? String(price) : "");
  };

  const handlePlaceBid = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return alert("You must be logged in.");
    if (!selectedVariation) return alert("Select a variation.");
    if (!bidAmount || isNaN(bidAmount) || parseFloat(bidAmount) <= 0)
      return alert("Enter a valid bid amount.");

    setPlacingBid(true);

    // Calculate total including selected services
    const servicesTotal = selectedServices.reduce(
      (sum, s) => sum + (s.price || 0),
      0
    );
    const finalAmount = parseFloat(bidAmount) + servicesTotal;

const bidData = {
  userId: user.uid,
  userName:
    `${userData?.firstName || ""} ${userData?.lastName || ""}`.trim() ||
    "Anonymous",
  userEmail: userData?.email || "No email",

  productId: product.id,
  productName: product.productName || product.name || "Unknown Product",

  variation: selectedVariation,
  services: selectedServices,
  bidAmount: finalAmount,
  productImage: getImageUri(product),

  vendorId: product.uploadedBy?.uid || "unknown",
  vendorBusinessName: product.uploadedBy?.businessName || "Unknown Business",
  vendorCategory: product.uploadedBy?.category || "Uncategorized",

  createdAt: serverTimestamp(),
};


const bidsRef = collection(db, "RequestBidding", productId, "Bids");
const bidRef = await addDoc(bidsRef, bidData);

// Also include in user's MyBids
const userBidRef = collection(
  db,
  "Users",
  user.uid,
  "MyBids",
  productId,
  "UserBids"
);
await addDoc(userBidRef, { ...bidData, bidRefId: bidRef.id });


await addDoc(collection(db, "Vendor_Notifications_Bidding"), {

  message: `${bidData.userName} placed a bid of ₱${finalAmount} on your product "${product.productName}".`,

  userId: user.uid,
  userName:
    `${userData?.firstName || ""} ${userData?.lastName || ""}`.trim() ||
    "Anonymous",
  userEmail: userData?.email || "No email",
  productId: product.id,
  productName: product.productName || product.name || "Unknown Product",
  variation: selectedVariation,
  services: selectedServices,
  bidAmount: finalAmount,
  productImage: getImageUri(product), // ✅ Include product image
  createdAt: serverTimestamp(),
  vendorId: product.uploadedBy?.uid || "unknown",
  vendorBusinessName: product.uploadedBy?.businessName || "Unknown Business"
});

    // Reset modal and state
    setSelectedVariation(null);
    setSelectedServices([]);
    setBidAmount("");
    setModalVisible(false);
    setSuccessModalVisible(true);

  } catch (e) {
    console.log("Bid error:", e);
    alert("Something went wrong. Check console for details.");
  } finally {
    setPlacingBid(false);
  }
};


  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );

  if (!product)
    return (
      <View style={styles.center}>
        <Text>Product not found.</Text>
      </View>
    );

  const variations = getVariations();
  const highestBid = bidders[0]?.bidAmount ?? product.startingPrice ?? 0;
  const imageUri = getImageUri(product);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bidding Details</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 70, paddingBottom: 30 }}>
        {/* Image with Category Badge */}
        <View style={{ position: "relative" }}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} />
          ) : (
            <View
              style={[
                styles.image,
                { justifyContent: "center", alignItems: "center", backgroundColor: "#eef2ff" },
              ]}
            >
              <Text style={{ color: "#1e3a8a" }}>No Image</Text>
            </View>
          )}
          {product?.category && (
            <View style={styles.categoryBadge}>
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                {product.category}
              </Text>
            </View>
          )}
        </View>

        {/* Report Vendor Button */}
        <TouchableOpacity
          onPress={() => setReportModalVisible(true)}
          style={{
            marginTop: 10,
            backgroundColor: "#2563eb",
            width: 50,
            height: 50,
            borderRadius: 25,
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 6,
            elevation: 6,
            marginLeft: 300,
          }}
        >
          <Image
            source={require("../../../assets/Alert.png")}
            style={{ width: 28, height: 28 }}
          />
        </TouchableOpacity>

        <View style={styles.info}>
          <View style={styles.containerzxc}>
            <Text style={styles.title}>{product.productName || product.name || "Unnamed Product"}</Text>
            {product.businessName && <Text style={styles.business}>🏪 {product.businessName}</Text>}

            <Text style={styles.countdown}>
              Time Left: <Text style={{ color: isExpired ? "red" : "#2563eb" }}>{timeLeft}</Text>
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: "500", marginRight: 8 }}>Highest Bid:</Text>
              <View style={styles.highestBadge}>
                <Text style={styles.highestText}>₱{highestBid}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            disabled={isExpired}
            style={[styles.bidBtn, isExpired && { backgroundColor: "#9ca3af" }]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.bidBtnText}>{isExpired ? "Bidding Closed" : "Place a Bid"}</Text>
          </TouchableOpacity>

          <Text style={styles.starting}>Starting Price: ₱{product.startingPrice ?? 0}</Text>

          {/* Bidders List */}
          <Text style={styles.sectionTitle}>Bidders</Text>
          {loadingBidders ? (
            <ActivityIndicator size="small" />
          ) : bidders.length === 0 ? (
            <Text style={styles.none}>No bids yet</Text>
          ) : (
            bidders.map((b, i) => (
              <View
                key={b.id}
                style={[styles.bidCard, i === 0 && { borderColor: "#2563eb", borderWidth: 2 }]}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                  <View style={styles.bidAmountBadge}>
                    <Text style={styles.bidAmountText}>₱{b.bidAmount}</Text>
                  </View>
                  {b.variation && (
                    <View style={styles.variationBadge}>
                      <Text style={styles.variationText}>{b.variation}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.bidText}>👤 {b.userName} {i === 0 ? "(Highest Bidder)" : ""}</Text>

                {b.services && b.services.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 5 }}>
                    {b.services.map((s, idx) => (
                      <View key={idx} style={styles.serviceBadge}>
                        <Text style={styles.serviceBadgeText}>{s.label}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Place Bid Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modal, { padding: 20 }]}>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Place Your Bid</Text>

              {imageUri && <Image source={{ uri: imageUri }} style={styles.modalImg} />}

              {/* Variations */}
              <Text style={styles.sectionLabel}>Variations</Text>
              {variations.length === 0 ? (
                <Text style={styles.services}>No variations available</Text>
              ) : (
                variations.map(([label, data]) => {
                  const price = data?.price ?? 0;
                  const labelText = label || "Variation";
                  const selected = selectedVariation === labelText;
                  return (
                    <TouchableOpacity
                      key={labelText}
                      style={[styles.varBtn, selected && styles.selectedVar]}
                      onPress={() => handleVariationSelect(labelText, price)}
                    >
                      <View style={styles.radioOuter}>
                        {selected && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.varText}>{labelText} — ₱{price}</Text>
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Optional Services */}
              <Text style={styles.sectionLabel}>Optional Services</Text>
              {product.services ? (
                Object.values(product.services)
                  .filter((s) => s.enabled)
                  .map((s, i) => {
                    const selected = selectedServices.some(
                      (sel) => sel.label === s.label
                    );
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.serviceRow,
                          selected && { borderColor: "#2563eb", backgroundColor: "#dbeafe" },
                        ]}
                        onPress={() => {
                          if (selected)
                            setSelectedServices(
                              selectedServices.filter((sel) => sel.label !== s.label)
                            );
                          else
                            setSelectedServices([
                              ...selectedServices,
                              { label: s.label, price: s.price },
                            ]);
                        }}
                      >
                        <View style={styles.radioOuter}>
                          {selected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={styles.serviceText}>
                          {s.label} (₱{s.price})
                        </Text>
                      </TouchableOpacity>
                    );
                  })
              ) : (
                <Text style={styles.services}>No services available</Text>
              )}

              {/* Bid Input */}
              <Text style={styles.sectionLabel}>Your Bid</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={bidAmount}
                onChangeText={setBidAmount}
                placeholder="Enter bid amount"
              />

              {/* Total Display */}
              <Text style={styles.totalDisplay}>
                Total: ₱
                {(
                  (parseFloat(bidAmount) || 0) +
                  selectedServices.reduce((sum, s) => sum + (s.price || 0), 0)
                ).toFixed(2)}
              </Text>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.confirm, { shadowColor: "#000", shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 6, elevation: 6 }]}
                onPress={handlePlaceBid}
                disabled={placingBid}
              >
                {placingBid ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Submit Bid</Text>}
              </TouchableOpacity>
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.close, { backgroundColor: "#f3f4f6", padding: 5, borderRadius: 20 }]}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={24} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

{/* Report Modal */}
<Modal visible={reportModalVisible} transparent animationType="slide">
  <View style={styles.overlay}>
    <View style={[styles.modal, { padding: 20 }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.modalTitle}>Report Vendor</Text>

        {/* Display Business Name */}
        {product.uploadedBy?.businessName && (
          <Text style={{ fontSize: 16, marginVertical: 10, fontWeight: "500" }}>
            🏪 {product.uploadedBy.businessName}
          </Text>
        )}

        <Text style={{ marginTop: 10, fontSize: 16, fontWeight: "500" }}>
          Select a reason:
        </Text>

        {[
          "Spoiled Seafood",
          "Expired Products",
          "Mislabeling / Wrong Information",
          "Poor Quality",
          "Others",
        ].map((reason, idx) => {
          const selected = selectedReport === reason;
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.varBtn,
                selected && { backgroundColor: "#fee2e2", borderColor: "#f87171" },
              ]}
              onPress={() => setSelectedReport(reason)}
            >
              <View style={styles.radioOuter}>
                {selected && <View style={styles.radioInner} />}
              </View>
              <Text style={{ fontSize: 15, marginLeft: 10 }}>{reason}</Text>
            </TouchableOpacity>
          );
        })}

        {/* TextInput for detailed reason */}
        <Text style={{ marginTop: 15, fontSize: 16, fontWeight: "500" }}>Reason:</Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 5,
            padding: 10,
            marginTop: 5,
            fontSize: 14,
            height: 80,
            textAlignVertical: "top",
          }}
          multiline
          maxLength={60}
          placeholder="Provide a brief reason (max 60 characters)"
          value={selectedReportText}
          onChangeText={setSelectedReportText}
        />

        {/* Optional Image */}
        <Text style={{ marginTop: 15, fontSize: 16, fontWeight: "500" }}>Optional: Provide Image</Text>
        <TouchableOpacity
          onPress={pickReportImage}
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 8,
            padding: 10,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#2563eb" }}>
            {reportImage ? "Change Image" : "Pick Image"}
          </Text>
        </TouchableOpacity>

        {reportImage && (
          <Image
            source={{ uri: reportImage }}
            style={{ width: "100%", height: 150, borderRadius: 8, marginTop: 10 }}
          />
        )}

        {/* Submit Report */}
<TouchableOpacity
  style={[styles.confirm, { marginTop: 15 }]}
  onPress={async () => {
    if (!selectedReport && !selectedReportText.trim())
      return alert("Please select a reason or provide a brief reason.");

    setReportSubmitting(true);

    try {
      const user = auth.currentUser;
      if (!user) return alert("You must be logged in.");

      // Ensure vendor info exists
      const vendorId = product.uploadedBy?.uid || product.vendorId || "unknown";
      const vendorName = product.uploadedBy?.businessName || product.vendorBusinessName || "Unknown Business";

      const reportData = {
        status: 'pending',
        vendorId: vendorId, // ✅ Correct vendor UID
        reportedBy: {
          userId: user.uid,
          name: `${userData?.firstName || ""} ${userData?.lastName || ""}`.trim(),
          email: userData?.email || "",
        },
        productId: product.id,
        productName: product.productName || product.name || "Unknown Product",
        reason: selectedReportText.trim() || selectedReport || "No reason provided",
        image: reportImage || null,
        createdAt: serverTimestamp(),
        vendorBusinessName: vendorName
      };

      await addDoc(collection(db, "Reports_Bidding_Products"), reportData);

      // Success
      setReportSubmitting(false);
      setReportModalVisible(false);
      setSelectedReport(null);
      setSelectedReportText("");
      setReportImage(null);
      setReportSuccessModal(true);
    } catch (e) {
      console.log("Report error:", e);
      setReportSubmitting(false);
      alert("Failed to submit report.");
    }
  }}
  disabled={reportSubmitting}
>
  {reportSubmitting ? (
    <ActivityIndicator color="#fff" />
  ) : (
    <Text style={styles.confirmText}>Submit Report</Text>
  )}
</TouchableOpacity>

      </ScrollView>

      {/* Close Button */}
      <TouchableOpacity
        style={[styles.close, { backgroundColor: "#f3f4f6", padding: 5, borderRadius: 20 }]}
        onPress={() => setReportModalVisible(false)}
      >
        <Ionicons name="close" size={24} />
      </TouchableOpacity>
    </View>
  </View>
</Modal>



{/* Success Modal */}
<Modal visible={reportSuccessModal} transparent animationType="fade">
  <View style={styles.overlay}>
    <View
      style={{
        width: 250,
        height: 300,
        backgroundColor: "#fff",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 10,
      }}
    >
      <Image
        source={require("../../../assets/Complete.png")}
        style={{ width: 120, height: 120, marginBottom: 20 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 15 }}>
        Report Submitted Successfully!
      </Text>

      <TouchableOpacity
        style={[styles.confirm, { width: "80%", paddingVertical: 10 }]}
        onPress={() => setReportSuccessModal(false)}
      >
        <Text style={styles.confirmText}>OK</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>



    </View>
  );
};

export default ViewBiddingProduct;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#3B82F6", position: "absolute", top: 0, width: "100%", zIndex: 10, paddingVertical: 15, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  image: { width: '90%', height: 200, borderRadius: 8, marginLeft: 20 },
  categoryBadge: { position: "absolute", top: 10, left: 25, backgroundColor: "#2563eb", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  info: { paddingHorizontal: 20, marginTop: 10 },
  containerzxc: { marginBottom: 15 },
  title: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  business: { fontSize: 14, color: "#6b7280", marginTop: 3 },
  countdown: { marginTop: 5, fontSize: 14, color: "#374151" },
  highestBadge: { backgroundColor: "#2563eb", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 5 },
  highestText: { color: "#fff", fontWeight: "600" },
  bidBtn: { backgroundColor: "#2563eb", padding: 12, borderRadius: 10, marginTop: 15, shadowColor: "#000", shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 6, elevation: 6 },
  bidBtnText: { color: "#fff", fontWeight: "600", fontSize: 16, textAlign: "center" },
  starting: { fontSize: 14, color: "#6b7280", marginTop: 10 },
  sectionTitle: { marginTop: 15, fontWeight: "600", fontSize: 16 },
  none: { fontSize: 14, color: "#9ca3af", marginTop: 5 },
  bidCard: { padding: 10, backgroundColor: "#fff", borderRadius: 8, marginTop: 10, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 4 },
  bidAmountBadge: { backgroundColor: "#2563eb", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5 },
  bidAmountText: { color: "#fff", fontWeight: "600" },
  variationBadge: { backgroundColor: "#fbbf24", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, marginLeft: 5 },
  variationText: { color: "#111", fontWeight: "600" },
  bidText: { marginTop: 5, fontSize: 14 },
  serviceBadge: { backgroundColor: "#dbeafe", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, marginRight: 5, marginTop: 5 },
  serviceBadgeText: { color: "#1e40af", fontWeight: "500" },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  modal: { width: width - 40, backgroundColor: "#fff", borderRadius: 10, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  varBtn: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 5, borderWidth: 1, borderColor: "#d1d5db", marginTop: 8 },
  selectedVar: { borderColor: "#2563eb", backgroundColor: "#dbeafe" },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: "#2563eb", justifyContent: "center", alignItems: "center" },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#2563eb" },
  varText: { marginLeft: 10, fontSize: 15 },
  serviceRow: { flexDirection: "row", alignItems: "center", padding: 10, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 5, marginTop: 8 },
  serviceText: { marginLeft: 10, fontSize: 15 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 5, padding: 10, marginTop: 10 },
  confirm: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8, marginTop: 10, alignItems: "center" },
  confirmText: { color: "#fff", fontWeight: "600" },
  close: { position: "absolute", top: 10, right: 10 },
  modalImg: { width: "100%", height: 150, borderRadius: 8, marginVertical: 10 },
  sectionLabel: { fontWeight: "600", fontSize: 15, marginTop: 10 },
  services: { color: "#6b7280", marginTop: 5 },
  totalDisplay: { fontSize: 16, fontWeight: "600", marginTop: 10, textAlign: "right" },
});
