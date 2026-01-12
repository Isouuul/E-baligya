import React, { useState, useEffect } from "react";
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, Modal 
} from "react-native";
import { db, auth } from "../../../firebase";
import { doc, deleteDoc, setDoc } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";

import TrashIcon from "../../../../assets/Trash.png";
import EditIcon from "../../../../assets/Edit.png";
import EditProductBiddingFormModal from "./EditProductBiddingFormModal";

const ProductBiddingCard = ({ product }) => {
  const navigation = useNavigation();

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [archived, setArchived] = useState(false);

  const currentUserUid = auth.currentUser ? auth.currentUser.uid : null;
  const productUploaderUid = product?.uploadedBy?.uid;

  // If product is missing or it's not the uploader's product, don't render
  if (!product || !currentUserUid || currentUserUid !== productUploaderUid || archived) return null;

  useEffect(() => {
    if (!product.endTime) return;

    const archiveProduct = async () => {
      try {
        await setDoc(doc(db, "Archived_BiddingProduct", product.id), product);
        await deleteDoc(doc(db, "Bidding_Products", product.id));
        setArchived(true);
      } catch (error) {
        console.error("Error archiving product:", error);
      }
    };

    const updateCountdown = () => {
      const now = new Date();
      const end = product.endTime.toDate ? product.endTime.toDate() : new Date(product.endTime);
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Auction Ended");
        archiveProduct();
        return false;
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        return true;
      }
    };

    if (!updateCountdown()) return;

    const interval = setInterval(() => {
      if (!updateCountdown()) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [product.endTime]);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "Bidding_Products", product.id));
      setDeleteVisible(false);
    } catch (error) {
      console.error("Error deleting product:", error);
      setDeleteVisible(false);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        if (!product) return;
        navigation.navigate("ViewClickBid", { bidding: product });
      }}
    >
      <View style={styles.card}>
        
        {/* Left Image */}
        {product.imageBase64 ? (
          <Image
            source={{ uri: product.imageBase64 }} // FIX: use directly
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}

        {/* Right Details */}
        <View style={styles.infoContainer}>
          <Text style={styles.productName} numberOfLines={1}>{product.productName}</Text>
          <Text style={styles.price}>₱ {product.startingPrice}</Text>

          {product.variations && (
            <Text style={styles.quantity}>
              Variations: {Object.keys(product.variations).join(", ")}
            </Text>
          )}

          <Text style={[styles.countdown, timeLeft === "Auction Ended" && { color: "#dc2626" }]}>
            Time Left: {timeLeft}
          </Text>

          <View style={styles.actionsRow}>

            {/* Edit Button */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setEditVisible(true);
              }}
              style={[styles.actionBtn, { backgroundColor: "#1e3a8a", marginRight: 10 }]}
              disabled={timeLeft === "Auction Ended"}
            >
              <Image source={EditIcon} style={styles.iconImage} />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>

            {/* Delete Button */}
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setDeleteVisible(true);
              }}
              style={[styles.actionBtn, { backgroundColor: "#dc2626" }]}
              disabled={timeLeft === "Auction Ended"}
            >
              <Image source={TrashIcon} style={styles.iconImage} />
              <Text style={styles.actionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delete Modal */}
        <Modal
          visible={deleteVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteVisible(false)}
        >
          <View style={styles.deleteModalBackground}>
            <View style={styles.deleteModalContainer}>
              <Image source={TrashIcon} style={styles.deleteIcon} />
              <Text style={styles.deleteText}>Are you sure you want to delete this product?</Text>

              <View style={styles.deleteActions}>
                <TouchableOpacity
                  style={[styles.deleteBtn, { backgroundColor: "#ccc" }]}
                  onPress={() => setDeleteVisible(false)}
                >
                  <Text style={{ fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.deleteBtn, { backgroundColor: "#1e3a8a" }]}
                  onPress={handleDelete}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Delete</Text>
                </TouchableOpacity>

              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Modal */}
        {editVisible && (
          <EditProductBiddingFormModal
            visible={editVisible}
            existingBidding={product}
            onCancel={() => setEditVisible(false)}
            onSubmit={() => setEditVisible(false)}
          />
        )}

      </View>
    </TouchableOpacity>
  );
};

export default ProductBiddingCard;

const styles = StyleSheet.create({
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 16, padding: 10, marginVertical: 6, marginHorizontal: 12, elevation: 3, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 1, height: 1 }, shadowRadius: 4, alignItems: "center", borderWidth: 2, borderColor: "transparent" },
image: {
  width: 100,
  height: 100,
  borderRadius: 12,
  marginRight: 12,
  borderWidth: 2,
  borderColor: "transparent",
  
  // iOS shadow
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,

  // Android shadow
  elevation: 5,
},
  imagePlaceholder: { width: 100, height: 100, borderRadius: 12, backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center", marginRight: 12 },
  placeholderText: { color: "#aaa", fontSize: 12 },
  infoContainer: { flex: 1, justifyContent: "space-between" },
  productName: { fontSize: 15, fontWeight: "700", color: "#1f2937" },
  price: { fontSize: 14, fontWeight: "700", color: "#15803d", marginVertical: 2 },
  quantity: { fontSize: 12, color: "#6b7280" },
  countdown: { fontSize: 12, fontWeight: "600", color: "#d97706", marginTop: 4 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-start", marginTop: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  iconImage: { width: 20, height: 20, resizeMode: "contain", marginRight: 6 },
  actionText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  deleteModalBackground: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  deleteModalContainer: { width: 280, backgroundColor: "#fff", borderRadius: 12, padding: 20, alignItems: "center" },
  deleteIcon: { width: 50, height: 50, marginBottom: 10},
  deleteText: { fontSize: 16, textAlign: "center", marginBottom: 20 },
  deleteActions: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  deleteBtn: { flex: 1, paddingVertical: 10, marginHorizontal: 5, borderRadius: 8, alignItems: "center" },
});
