import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { getAuth } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../firebase";

const ViewClickBid = ({ route, navigation }) => {
  const { bidding } = route.params;
  const [bidders, setBidders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState("Loading...");
  const [isExpired, setIsExpired] = useState(false);
  const [notifiedBidders, setNotifiedBidders] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedBidder, setSelectedBidder] = useState(null);

  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Helper to format pesos
  const formatPeso = (amount) => {
    return "₱" + Number(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Countdown Timer
  useEffect(() => {
    if (!bidding?.endTime?.seconds) return;

    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(bidding.endTime.seconds * 1000);
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Bidding Ended");
        setIsExpired(true);
        clearInterval(interval);
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${h}h ${m}m ${s}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [bidding]);

  // Fetch Bidders
  useEffect(() => {
    if (!bidding?.id) return;

    const bidsRef = collection(db, "RequestBidding", bidding.id, "Bids");
    const q = query(bidsRef, orderBy("bidAmount", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => {
          const data = doc.data();
          const servicesTotal = Array.isArray(data.services)
            ? data.services.reduce((sum, s) => sum + (s?.price || 0), 0)
            : 0;
          const totalAmount = (data.totalAmount || data.bidAmount || 0) + servicesTotal;

          return {
            id: doc.id,

            // ===== USER =====
            userId: data.userId,
            bidderName: data.userName || "Anonymous",

            // ===== BID =====
            amount: data.bidAmount || 0,
            variation: data.variation || null,
            services: Array.isArray(data.services) ? data.services : [],
            totalAmount,
            timestamp: data.createdAt || null,

            // ===== VENDOR (SAFE) =====
            vendorId: data.vendorId || currentUser?.uid || "unknown",
            vendorBusinessName: data.vendorBusinessName || "Unknown Business",
            vendorCategory: data.vendorCategory || "Uncategorized",
          };
        });

        setBidders(list);
        setLoading(false);
      },
      (err) => {
        console.error("Bidders error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [bidding?.id]);

  // Fetch Notified Bidders
  useEffect(() => {
    if (!currentUser || !bidders.length) return;

    const notifRef = collection(db, "User_Notifications_Bidding");
    const q = query(
      notifRef,
      where("vendorId", "==", currentUser.uid),
      where("productId", "==", bidding.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifiedBidIds = snapshot.docs.map((doc) => doc.data().bidId);
      setNotifiedBidders(notifiedBidIds);
    });

    return () => unsubscribe();
  }, [bidders, currentUser]);

  // Handle Notification
  const handleConfirmNotification = async () => {
    if (!selectedBidder || !bidding) {
      Alert.alert("Error", "Invalid bidder selection.");
      return;
    }

    try {
      const servicesTotal = Array.isArray(selectedBidder.services)
        ? selectedBidder.services.reduce((sum, s) => sum + (s?.price || 0), 0)
        : 0;

      const payload = {
        read: false,
        createdAt: serverTimestamp(),

        userId: selectedBidder.userId,
        userName: selectedBidder.bidderName || "Anonymous",

        productId: bidding.id,
        productName: bidding.productName || "Unknown Product",
        productImage: bidding.imageBase64 || bidding.image || null,
        weightKg: bidding.weightKg || 0,
        basePrice: bidding.basePrice || bidding.price || 0,

        variation: selectedBidder.variation || null,
        variationPrice: selectedBidder.variationPrice || 0,

        services: Array.isArray(selectedBidder.services) ? selectedBidder.services : [],

        bidId: selectedBidder.id,
        bidAmount: selectedBidder.amount || 0,
        totalAmount: (selectedBidder.amount || 0) + servicesTotal,

        vendorId: selectedBidder.vendorId || currentUser?.uid || "unknown",
        vendorBusinessName: selectedBidder.vendorBusinessName || "Unknown Business",
        vendorCategory: selectedBidder.vendorCategory || "Uncategorized",

        message: `Hi ${selectedBidder.bidderName}, your total bid is ${formatPeso(
          (selectedBidder.amount || 0) + servicesTotal
        )}. Please confirm and proceed.`,

        bidDetails: selectedBidder,
        productDetails: bidding,
      };

      Object.keys(payload).forEach(
        (key) => payload[key] === undefined && delete payload[key]
      );

      await addDoc(collection(db, "User_Notifications_Bidding"), payload);

      setNotifiedBidders((prev) => [...prev, selectedBidder.id]);
      setShowSuccessModal(true);
      setConfirmModalVisible(false);
    } catch (err) {
      console.error("Notif error:", err);
      Alert.alert("Error", "Failed to send notification.");
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#43a047" />
        <Text>Loading bidders...</Text>
      </View>
    );
  }

  const renderItem = ({ item, index }) => {
    if (item.type === "product") {
      return (
        <View style={{ marginBottom: 20 }}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.productImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}

          {item.endTime && (
            <Text style={[styles.countdown, isExpired && { color: "red" }]}>
              Time Left: {timeLeft}
            </Text>
          )}

          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.category}>Category: {item.category}</Text>
          <Text style={styles.sectionTitle}>Bidders</Text>
        </View>
      );
    }

    const isNotified = notifiedBidders.includes(item.id);
    const isHighest = index === 1; // first bid in list is highest (after product)

    return (
      <View style={styles.bidItem}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bidderName}>{item.bidderName}</Text>
          <Text style={styles.bidAmount}>{formatPeso(item.totalAmount)}</Text>

          {item.variation && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.variation}</Text>
            </View>
          )}

          {item.services?.length > 0 && (
            <View style={styles.servicesBadgeContainer}>
              {item.services.map((service, idx) => (
                <View key={idx} style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {typeof service === "string" ? service : service.label || "Service"}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {isHighest && (
            <View style={[styles.badge, { backgroundColor: "#43a047", marginTop: 8 }]}>
              <Text style={[styles.badgeText, { color: "#fff" }]}>Highest Bid</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => {
            if (!isNotified) {
              setSelectedBidder(item);
              setConfirmModalVisible(true);
            }
          }}
        >
          <Ionicons
            name={isNotified ? "notifications" : "notifications-outline"}
            size={28}
            color={isNotified ? "#43a047" : "#fbc02d"}
          />

          {isNotified && (
            <View style={styles.notifiedBadge}>
              <Text style={{ color: "#fff", fontSize: 10 }}>Notified</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const flatListData = [
    {
      type: "product",
      id: bidding.id,
      image: bidding.imageBase64 || bidding.image || null,
      name: bidding.productName,
      category: bidding.category || "Uncategorized",
      endTime: bidding.endTime || null,
    },
    ...bidders.map((bid) => ({ type: "bid", ...bid })),
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bidding Details</Text>
      </View>

      <FlatList
        data={flatListData}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingTop: 80,
          paddingBottom: 100,
          paddingHorizontal: 20,
        }}
      />

      {/* Success Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={showSuccessModal}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Image
              source={require("../../../../assets/Complete.png")}
              style={styles.modalImage}
            />
            <Text style={styles.modalTitle}>Notification Sent!</Text>
            <Text style={styles.modalMessage}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={confirmModalVisible}
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send Notification?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to notify {selectedBidder?.bidderName} for{" "}
              {bidding.productName}?
            </Text>

            <View style={{ flexDirection: "row", marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#43a047", marginRight: 10 }]}
                onPress={handleConfirmNotification}
              >
                <Text style={styles.modalButtonText}>Yes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#f44336" }]}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ViewClickBid;

// --- styles remain unchanged ---
const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    width: "100%",
    height: 70,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 5,
  },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "bold", marginLeft: 15 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  productImage: {
    width: "100%",
    height: 260,
    borderRadius: 18,
    marginBottom: 12,
  },
  imagePlaceholder: {
    width: "100%",
    height: 260,
    borderRadius: 18,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  placeholderText: { fontSize: 13, color: "#aaa" },
  countdown: { textAlign: "center", fontSize: 16, marginBottom: 8, color: "#ff5722", fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "bold", color: "#2563eb", textAlign: "center", marginBottom: 5 },
  category: { fontSize: 16, marginBottom: 8, color: "#555", textAlign: "center" },
  sectionTitle: { fontSize: 20, fontWeight: "bold", marginTop: 15, marginBottom: 12, color: "#2563eb" },
  bidItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    alignItems: "center",
    justifyContent: "space-between",
  },
  bidderName: { fontSize: 16, fontWeight: "600", color: "#222" },
  bidAmount: { fontSize: 18, fontWeight: "700", color: "#2e7d32", marginTop: 3 },
  badge: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 5,
    marginRight: 5,
    elevation: 2,
    width: 45
  },
  badgeText: { fontSize: 12, color: "#1565c0", fontWeight: "bold", textAlign: "center" },
  servicesBadgeContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  notifiedBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#43a047",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 48,
    alignItems: "center",
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalContent: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 10,
  },
  modalImage: { width: 120, height: 120, marginBottom: 15, resizeMode: "contain" },
  modalTitle: { fontSize: 22, fontWeight: "bold", color: "#2563eb", marginBottom: 8, textAlign: "center" },
  modalMessage: { fontSize: 15, color: "#333", textAlign: "center", marginBottom: 20 },
  modalButton: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14 },
  modalButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
