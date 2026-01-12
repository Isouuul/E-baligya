import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { getAuth } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Ionicons } from "@expo/vector-icons";

const UserNotificationsBidding = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Fetch notifications for current user
  useEffect(() => {
    if (!currentUser) return;

    const notifRef = collection(db, "User_Notifications_Bidding");
    const q = query(notifRef, where("userId", "==", currentUser.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNotifications(list);
        setLoading(false);
      },
      (err) => {
        console.error("User notifications error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Mark notification as read and remove from list
  const markAsRead = async (notifId) => {
    try {
      const notifDoc = doc(db, "User_Notifications_Bidding", notifId);
      await updateDoc(notifDoc, { read: true });

      // Remove from local state immediately
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleNotificationPress = (item) => {
    markAsRead(item.id); // marks read in Firebase and removes locally
    setSelectedNotification(item);
    setModalVisible(true);
  };

  const handleAccept = (item) => {
    setModalVisible(false);

    const selectedItems = [
      {
        id: item.id,
        productId: item.productId || item.id,
        productName: item.productName || "Unnamed Product",
        productImage: item.productImage || null,
        basePrice: item.basePrice || item.totalAmount || 0,
        quantity: 1,
        selectedVariation: item.variation || null,
        selectedVariationPrice: item.variationPrice || 0,
        selectedServices: item.services || [],
        uploadedBy: {
          businessName: item.vendorBusinessName || "Unknown Vendor",
          profileImage: item.vendorProfileImage || null,
          userId: item.vendorId || item.userId || null,
        },
        category: item.category || item.productCategory || "Uncategorized",
      },
    ];

    navigation.navigate("CheckedOutBidding", { selectedItems });
  };

  const handleCancel = (item) => {
    setModalVisible(false);
    Alert.alert("Cancelled", "You cancelled this bid notification.");
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.notifItem,
        item.read ? { backgroundColor: "#f1f1f1" } : { backgroundColor: "#fff" },
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <Image
        source={
          item.productImage
            ? { uri: item.productImage }
            : require("../../../assets/Trash.png")
        }
        style={styles.productImage}
      />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.productName}>{item.productName}</Text>
        <Text style={styles.vendorName}>{item.vendorBusinessName}</Text>
        <Text numberOfLines={1} style={styles.message}>
          {item.message}
        </Text>
        <Text style={styles.amount}>₱{item.totalAmount}</Text>
      </View>
      <Text style={{ color: "#fbc02d", fontWeight: "bold" }}>New</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#43a047" />
        <Text>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F3F4F6" }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bidding Notifications</Text>
      </View>

      {/* Notification List */}
      <FlatList
        data={notifications.filter((n) => !n.read)} // only show unread
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
      />

      {/* MODAL for Details and Accept/Cancel */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedNotification && (
              <>
                <Image
                  source={
                    selectedNotification.productImage
                      ? { uri: selectedNotification.productImage }
                      : require("../../../assets/Trash.png")
                  }
                  style={styles.modalImage}
                />
                <Text style={styles.modalTitle}>{selectedNotification.productName}</Text>
                <Text style={styles.modalVendor}>{selectedNotification.vendorBusinessName}</Text>
                <Text style={styles.modalMessage}>{selectedNotification.message}</Text>
                {selectedNotification.variation && (
                  <Text style={styles.modalText}>Variation: {selectedNotification.variation}</Text>
                )}
                {selectedNotification.services?.length > 0 && (
                  <Text style={styles.modalText}>
                    Services: {selectedNotification.services.map((s) => (s.label || s)).join(", ")}
                  </Text>
                )}
                <Text style={styles.modalAmount}>₱{selectedNotification.totalAmount}</Text>

                <View style={{ flexDirection: "row", marginTop: 20 }}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: "#43a047", marginRight: 10 }]}
                    onPress={() => handleAccept(selectedNotification)}
                  >
                    <Text style={styles.modalButtonText}>Accept</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: "#f44336" }]}
                    onPress={() => handleCancel(selectedNotification)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default UserNotificationsBidding;

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: 15,
    paddingHorizontal: 15,
    elevation: 4,
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  notifItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
  },
  productImage: { width: 70, height: 70, borderRadius: 10 },
  productName: { fontWeight: "bold", fontSize: 16 },
  vendorName: { fontSize: 13, color: "#555" },
  message: { fontSize: 12, color: "#333" },
  amount: { fontWeight: "bold", color: "#2e7d32", marginTop: 3 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
  },
  modalImage: { width: 120, height: 120, marginBottom: 10, borderRadius: 12 },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#2563eb", marginBottom: 5, textAlign: "center" },
  modalVendor: { fontSize: 14, color: "#555", marginBottom: 10 },
  modalMessage: { fontSize: 14, color: "#333", textAlign: "center", marginBottom: 10 },
  modalText: { fontSize: 13, color: "#444", marginBottom: 5 },
  modalAmount: { fontSize: 16, fontWeight: "bold", color: "#2e7d32", marginTop: 5 },
  modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  modalButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
