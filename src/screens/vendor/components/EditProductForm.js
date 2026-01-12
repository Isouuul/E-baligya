import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Picker } from "@react-native-picker/picker";
import { db } from "../../../firebase";
import { doc, updateDoc, Timestamp } from "firebase/firestore";

const EditProductForm = ({ existingProduct, onCancel }) => {
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [imageBase64, setImageBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [variations, setVariations] = useState({});
  const [services, setServices] = useState({});

  useEffect(() => {
    if (!existingProduct) return;

    setProductName(existingProduct.productName || "");
    setCategory(existingProduct.category || "");
    setBasePrice(existingProduct.basePrice?.toString() || "");
    setQuantityKg(existingProduct.quantityKg?.toString() || "");

    // Normalize imageBase64
    let base64 = existingProduct.imageBase64 || null;
    if (base64 && !base64.startsWith("data:image")) {
      base64 = `data:image/jpeg;base64,${base64}`;
    }
    setImageBase64(base64);

    // Normalize variations
    const normalizedVariations = {};
    Object.entries(existingProduct.variations || {}).forEach(([key, val]) => {
      normalizedVariations[key] = {
        enabled: !!val.price,
        price: val.price?.toString() || "",
      };
    });
    setVariations(normalizedVariations);

    // Normalize services
    const normalizedServices = {};
    Object.entries(existingProduct.services || {}).forEach(([key, val]) => {
      normalizedServices[key] = {
        enabled: !!val.price,
        label: val.label || key,
        price: val.price?.toString() || "",
      };
    });
    setServices(normalizedServices);
  }, [existingProduct]);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        allowsEditing: true,
        quality: 0.5, // smaller images for Firestore
      });

      if (!result.canceled && result.assets.length > 0) {
        const base64 = result.assets[0].base64;
        if (base64) setImageBase64(`data:image/jpeg;base64,${base64}`);
      }
    } catch (err) {
      console.error("Pick image error:", err);
      Alert.alert("Error", "Could not pick image");
    }
  };

  const handleSave = async () => {
    if (!productName.trim() || !category.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      const productRef = doc(db, "Products", existingProduct.id);

      // Clean variations
      const cleanedVariations = Object.fromEntries(
        Object.entries(variations)
          .filter(([_, v]) => v.enabled && v.price)
          .map(([k, v]) => [k, { price: parseFloat(v.price) }])
      );

      // Clean services
      const cleanedServices = Object.fromEntries(
        Object.entries(services)
          .filter(([_, s]) => s.enabled && s.price)
          .map(([k, s]) => [k, { label: s.label, price: parseFloat(s.price) }])
      );

      await updateDoc(productRef, {
        productName: productName.trim(),
        category: category.trim(),
        basePrice: parseFloat(basePrice) || 0,
        quantityKg: parseFloat(quantityKg) || 0,
        imageBase64: imageBase64 || null,
        variations: cleanedVariations,
        services: cleanedServices,
        updatedAt: Timestamp.now(),
      });

      Alert.alert("Success", "Product updated successfully!");
      onCancel?.();
    } catch (err) {
      console.error("Update product error:", err);
      Alert.alert("Error", "Could not update product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.header}>Edit Product</Text>

          {/* Image */}
          <Pressable onPress={handlePickImage} style={styles.imageWrapper}>
            {imageBase64 ? (
              <Image
                source={{ uri: imageBase64 }}
                style={styles.image}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>Pick Image</Text>
              </View>
            )}
          </Pressable>

          {/* Category */}
          <Text style={styles.label}>Category</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={category}
              onValueChange={setCategory}
              style={styles.picker}
            >
              <Picker.Item label="Select Category" value="" />
              <Picker.Item label="Fish" value="Fish" />
              <Picker.Item label="Mollusk" value="Mollusk" />
              <Picker.Item label="Crustacean" value="Crustacean" />
              <Picker.Item label="Other Seafood" value="Other" />
            </Picker>
          </View>

          {/* Product Name */}
          <Text style={styles.label}>Product Name</Text>
          <TextInput
            style={styles.input}
            value={productName}
            onChangeText={setProductName}
            placeholder="Enter product name"
          />

          {/* Base Price */}
          <Text style={styles.label}>Base Price</Text>
          <TextInput
            style={styles.input}
            value={basePrice}
            onChangeText={setBasePrice}
            keyboardType="numeric"
            placeholder="Enter base price"
          />

          {/* Quantity */}
          <Text style={styles.label}>Quantity (Kg)</Text>
          <TextInput
            style={styles.input}
            value={quantityKg}
            onChangeText={setQuantityKg}
            keyboardType="numeric"
            placeholder="Enter quantity"
          />

          {/* Variations */}
          <Text style={styles.sectionHeader}>Variations</Text>
          {Object.keys(variations).map((key) => (
            <View key={key} style={styles.row}>
              <TouchableOpacity
                style={[
                  styles.toggleOuter,
                  variations[key]?.enabled && styles.toggleOuterSelected,
                ]}
                onPress={() =>
                  setVariations({
                    ...variations,
                    [key]: { ...variations[key], enabled: !variations[key].enabled },
                  })
                }
              >
                {variations[key]?.enabled && <View style={styles.toggleInner} />}
              </TouchableOpacity>
              <Text style={styles.rowLabel}>{key}</Text>
              <TextInput
                style={styles.priceInput}
                value={variations[key]?.price || ""}
                onChangeText={(val) =>
                  setVariations({ ...variations, [key]: { ...variations[key], price: val } })
                }
                keyboardType="numeric"
                placeholder="Price"
              />
            </View>
          ))}

          {/* Services */}
          <Text style={styles.sectionHeader}>Services</Text>
          {Object.keys(services).map((key) => (
            <View key={key} style={styles.row}>
              <TouchableOpacity
                style={[
                  styles.toggleOuter,
                  services[key]?.enabled && styles.toggleOuterSelected,
                ]}
                onPress={() =>
                  setServices({ ...services, [key]: { ...services[key], enabled: !services[key].enabled } })
                }
              >
                {services[key]?.enabled && <View style={styles.toggleInner} />}
              </TouchableOpacity>
              <Text style={styles.rowLabel}>{services[key]?.label || key}</Text>
              <TextInput
                style={styles.priceInput}
                value={services[key]?.price || ""}
                onChangeText={(val) =>
                  setServices({ ...services, [key]: { ...services[key], price: val } })
                }
                keyboardType="numeric"
                placeholder="Price"
              />
            </View>
          ))}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Product</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default EditProductForm;

const styles = StyleSheet.create({
  container: { paddingBottom: 40, backgroundColor: "#f0f4f8" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    margin: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: { fontSize: 22, fontWeight: "bold", marginBottom: 20, color: "#1976d2" },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 6, color: "#333" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 14, padding: 12, marginBottom: 16, backgroundColor: "#f9f9f9" },
  pickerWrapper: { borderWidth: 1, borderColor: "#ddd", borderRadius: 14, overflow: "hidden", marginBottom: 16, backgroundColor: "#f9f9f9" },
  picker: { height: 50, width: "100%" },
  imageWrapper: { alignItems: "center", marginBottom: 20 },
  image: { width: 160, height: 160, borderRadius: 16, marginBottom: 10 },
  imagePlaceholder: { width: 160, height: 160, backgroundColor: "#eee", borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  imagePlaceholderText: { color: "#777", fontWeight: "500" },
  sectionHeader: { fontSize: 16, fontWeight: "700", marginTop: 20, marginBottom: 12, color: "#1976d2" },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  rowLabel: { flex: 1, fontSize: 14, color: "#333" },
  priceInput: { borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 6, width: 80, textAlign: "center", backgroundColor: "#f9f9f9" },
  toggleOuter: { width: 22, height: 22, borderRadius: 12, borderWidth: 2, borderColor: "#1976d2", alignItems: "center", justifyContent: "center", marginRight: 10 },
  toggleOuterSelected: { backgroundColor: "#1976d2" },
  toggleInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff" },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  cancelBtn: { padding: 14, backgroundColor: "#e0e0e0", borderRadius: 14, flex: 1, marginRight: 10 },
  saveBtn: { padding: 14, backgroundColor: "#1976d2", borderRadius: 14, flex: 1, marginLeft: 10 },
  cancelText: { color: "#555", textAlign: "center", fontWeight: "700" },
  saveText: { color: "#fff", textAlign: "center", fontWeight: "700" },
});
