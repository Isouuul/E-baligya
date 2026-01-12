import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, Alert } from "react-native";
import { db, auth } from "../../../firebase";
import { doc, deleteDoc, setDoc } from "firebase/firestore";
import * as FileSystem from "expo-file-system";

import EditIcon from "../../../../assets/Edit.png";
import TrashIcon from "../../../../assets/Trash.png";
import EditProductForm from "./EditProductForm";

const Base64Image = ({ base64, productId, style }) => {
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    const saveToFile = async () => {
      if (!base64) return;
      const fileUri = FileSystem.cacheDirectory + `${productId}.jpg`;
      try {
        // Remove the prefix if present
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

  if (!localUri) return null; // or a placeholder

  return <Image source={{ uri: localUri }} style={style} />;
};

const ProductCard = ({ product }) => {
  const [editVisible, setEditVisible] = useState(false);
  const [archived, setArchived] = useState(false);

  const currentUserUid = auth.currentUser ? auth.currentUser.uid : null;
  const productUploaderUid = product.uploadedBy?.uid;

  useEffect(() => {
    const archiveIfZero = async () => {
      if (product.quantityKg <= 0 && !archived) {
        try {
          await setDoc(doc(db, "Archived_Products", product.id), product);
          await deleteDoc(doc(db, "Products", product.id));
          setArchived(true);
        } catch (error) {
          console.error("Error archiving product:", error);
        }
      }
    };
    archiveIfZero();
  }, [product.quantityKg, archived]);

  if (!currentUserUid || currentUserUid !== productUploaderUid || archived) return null;

  const handleDelete = async () => {
    Alert.alert("Delete Product", "Are you sure you want to delete this product?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "Products", product.id));
            Alert.alert("Success", "Product deleted successfully");
          } catch (error) {
            console.error("Error deleting product:", error);
            Alert.alert("Error", "Could not delete product");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.card}>
      {/* Left Image */}
      {product.imageBase64 ? (
        <Base64Image base64={product.imageBase64} productId={product.id} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderText}>No Image</Text>
        </View>
      )}

      {/* Right Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.productName} numberOfLines={1}>
          {product.productName}
        </Text>
        <Text style={styles.price}>₱ {product.basePrice}</Text>
        <Text style={styles.quantity}>Qty: {product.quantityKg} kg</Text>
        {product.uploadedBy?.businessName && (
          <Text style={styles.uploader}>Uploaded by: {product.uploadedBy.businessName}</Text>
        )}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={() => setEditVisible(true)}
            style={[styles.actionBtn, { backgroundColor: "#2563eb" }]}
          >
            <Image source={EditIcon} style={styles.iconImage} />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDelete}
            style={[styles.actionBtn, { backgroundColor: "#dc2626" }]}
          >
            <Image source={TrashIcon} style={styles.iconImage} />
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Edit Modal */}
      <Modal visible={editVisible} animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <EditProductForm existingProduct={product} onCancel={() => setEditVisible(false)} />
      </Modal>
    </View>
  );
};

export default ProductCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 10,
    marginVertical: 6,
    marginHorizontal: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 1, height: 1 },
    shadowRadius: 4,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  placeholderText: { color: "#aaa", fontSize: 12 },
  infoContainer: { flex: 1, justifyContent: "space-between" },
  productName: { fontSize: 15, fontWeight: "700", color: "#1f2937" },
  price: { fontSize: 14, fontWeight: "700", color: "#15803d", marginVertical: 2 },
  quantity: { fontSize: 12, color: "#6b7280" },
  uploader: { fontSize: 11, color: "#4b5563", fontStyle: "italic", marginTop: 2 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-start", gap: 10, marginTop: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  iconImage: { width: 20, height: 20, resizeMode: "contain", marginRight: 6 },
  actionText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
