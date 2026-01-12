import React, { useState, useEffect } from "react";
import { 
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, Image, ActivityIndicator, Modal, TouchableOpacity, Alert
} from "react-native";
import { db } from "../../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { Picker } from "@react-native-picker/picker";

const EditProductBiddingFormModal = ({ visible, existingBidding, onCancel, onSubmit }) => {
  const [category, setCategory] = useState(existingBidding.category || "");
  const [productName, setProductName] = useState(existingBidding.productName || "");
  const [description, setDescription] = useState(existingBidding.description || "");
  const [imageBase64, setImageBase64] = useState(existingBidding.imageBase64 || null);
  const [isLoading, setIsLoading] = useState(false);
  const [durationInMinutes, setDurationInMinutes] = useState(existingBidding.durationMinutes || null);
  const [customDuration, setCustomDuration] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const durationOptions = [20, 40, 60];

  // Default variations
  const defaultVariations = {
    "1kg": { price: "", enabled: false },
    "2kg": { price: "", enabled: false },
    "3kg": { price: "", enabled: false },
    "4kg": { price: "", enabled: false },
    "5kg": { price: "", enabled: false },
  };

  const [variations, setVariations] = useState(() => {
    const existing = existingBidding.variations || {};
    return Object.fromEntries(
      Object.entries(defaultVariations).map(([key, val]) => {
        const price = existing[key]?.price ?? "";
        return [key, { price, enabled: price !== "" }];
      })
    );
  });

  // Default services
  const defaultServices = {
    cleaned: { label: "Cleaned & Gutted", price: "", enabled: false },
    filleted: { label: "Filleted", price: "", enabled: false },
    vacuum: { label: "Vacuum Packed", price: "", enabled: false },
  };

  const [services, setServices] = useState(() => {
    const existing = existingBidding.services || {};
    return Object.fromEntries(
      Object.entries(defaultServices).map(([key, val]) => {
        const price = existing[key]?.price ?? "";
        return [key, { ...val, price, enabled: price !== "" }];
      })
    );
  });

  const [startingBid, setStartingBid] = useState(0);

  // Recalculate starting bid whenever variations change
  useEffect(() => {
    const prices = Object.values(variations)
      .filter(v => v.enabled && v.price)
      .map(v => parseFloat(v.price));
    if (prices.length) setStartingBid(Math.min(...prices) - 20);
    else setStartingBid(0);
  }, [variations]);

  // Image picker
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        setImageBase64(result.assets[0].base64);
      }
    } catch (err) {
      console.log("Image picker error:", err);
    }
  };

  const handleUpdate = async () => {
    const chosenDuration = useCustom ? parseInt(customDuration) : durationInMinutes;

    if (!category) return Alert.alert("Missing Info", "Please select a category.");
    if (!productName) return Alert.alert("Missing Info", "Product name is required.");
    if (!chosenDuration || isNaN(chosenDuration)) return Alert.alert("Missing Info", "Please set a valid bidding duration.");
    if (!variations["1kg"].enabled || !variations["1kg"].price) return Alert.alert("Missing Info", "Price for 1kg variation is required.");

    const cleanedVariations = Object.fromEntries(
      Object.entries(variations)
        .filter(([_, v]) => v.enabled && v.price)
        .map(([k, v]) => [k, { price: parseFloat(v.price) }])
    );

    const cleanedServices = Object.fromEntries(
      Object.entries(services).map(([k, v]) => [k, { ...v, price: v.price ? parseFloat(v.price) : null }])
    );

    try {
      setIsLoading(true);
      const biddingRef = doc(db, "Bidding_Products", existingBidding.id);
      const originalStart = existingBidding.startTime ? new Date(existingBidding.startTime) : new Date();
      await updateDoc(biddingRef, {
        category,
        productName,
        description,
        imageBase64,
        startingBid,
        variations: cleanedVariations,
        services: cleanedServices,
        durationMinutes: chosenDuration,
        startTime: originalStart,
        endTime: new Date(originalStart.getTime() + chosenDuration * 60000),
      });

      Alert.alert("Success", "Bidding updated successfully!");
      onSubmit?.();
      onCancel?.();
    } catch (error) {
      console.error("Error updating bidding:", error);
      Alert.alert("Error", "Failed to update bidding.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderVariationRow = (key) => {
    const isSelected = variations[key]?.enabled;
    return (
      <View key={key} style={styles.row}>
        <TouchableOpacity
          style={styles.radioCircle}
          onPress={() => setVariations(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }))}
        >
          {isSelected && <View style={styles.selectedRb} />}
        </TouchableOpacity>
        <Text style={{ marginLeft: 8 }}>{key}</Text>
        {isSelected && (
          <TextInput
            style={[styles.smallInput, { marginLeft: 8 }]}
            placeholder="Price"
            keyboardType="numeric"
            value={variations[key].price?.toString() || ""}
            onChangeText={txt => setVariations(prev => ({ ...prev, [key]: { ...prev[key], price: txt } }))}
          />
        )}
      </View>
    );
  };

  const renderServiceRow = (key) => (
    <View key={key} style={styles.row}>
      <View style={styles.rowLeft}>
        <TouchableOpacity
          style={styles.radioCircle}
          onPress={() => setServices(prev => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }))}
        >
          {services[key].enabled && <View style={styles.selectedRb} />}
        </TouchableOpacity>
        <Text style={{ marginLeft: 8 }}>{services[key].label}</Text>
      </View>
      {services[key].enabled && (
        <TextInput
          style={[styles.smallInput, { marginLeft: 8 }]}
          placeholder="Addon Price"
          keyboardType="numeric"
          value={services[key].price?.toString() || ""}
          onChangeText={txt => setServices(prev => ({ ...prev, [key]: { ...prev[key], price: txt } }))}
        />
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
<View style={styles.cardContainer}>
  <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
    <Text style={styles.closeButtonText}>✕</Text>
  </TouchableOpacity>

  {isLoading && (
    <View style={styles.loadingOverlay}>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  )}

          <ScrollView style={styles.cardContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.TitleBidding}>Edit Product Bidding</Text>

            <Text style={styles.label}>Category</Text>
            <Picker selectedValue={category} onValueChange={setCategory} style={styles.picker}>
              <Picker.Item label="Select Category" value="" />
              <Picker.Item label="Fish" value="Fish" />
              <Picker.Item label="Mollusk" value="Mollusk" />
              <Picker.Item label="Crustacean" value="Crustacean" />
              <Picker.Item label="Trend Fish" value="Trend Fish" />
              <Picker.Item label="Other Seafood" value="Other" />
            </Picker>

            <Text style={styles.label}>Product Name</Text>
            <TextInput style={styles.input} placeholder="Enter product name" value={productName} onChangeText={setProductName} />

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, { height: 80 }]} placeholder="Enter description" value={description} onChangeText={setDescription} multiline />

            <Text style={styles.label}>Upload Image</Text>
            <Pressable style={styles.button} onPress={pickImage}>
              <Text style={styles.buttonText}>Pick an Image</Text>
            </Pressable>
            {imageBase64 && <Image source={{ uri: `data:image/jpeg;base64,${imageBase64}` }} style={styles.imagePreview} />}

           <Text style={styles.sectionTitle}>Set Bidding Duration</Text>
<View style={styles.durationContainer}>
  {["20", "40", "60", "other"].map((opt) => {
    const isSelected = opt === durationInMinutes?.toString() || (opt === "other" && useCustom);
    return (
      <View key={opt} style={styles.durationRow}>
        <TouchableOpacity
          style={styles.radioCircle}
          onPress={() => {
            if (opt === "other") {
              setUseCustom(true);
              setDurationInMinutes(null);
            } else {
              setUseCustom(false);
              setDurationInMinutes(parseInt(opt));
            }
          }}
        >
          {isSelected && <View style={styles.selectedRb} />}
        </TouchableOpacity>
        <Text style={styles.durationLabel}>
          {opt === "other" ? "Other" : `${opt} mins`}
        </Text>

        {opt === "other" && isSelected && (
          <TextInput
            style={styles.otherDurationInput}
            placeholder="Enter minutes"
            keyboardType="numeric"
            value={customDuration}
            onChangeText={setCustomDuration}
          />
        )}
      </View>
    );
  })}
</View>

            <Text style={{ fontSize: 16, fontWeight: "600", marginVertical: 8, color: "#333" }}>
              Starting Bid: ₱{startingBid.toFixed(2)}
            </Text>

            <Text style={styles.label}>Weight Variations</Text>
            {Object.keys(variations).map(renderVariationRow)}

            <Text style={styles.label}>Optional Services</Text>
            {Object.keys(services).map(renderServiceRow)}

            <View style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 20 }}>
              <Pressable style={[styles.button, { flex: 1, marginRight: 5 }]} onPress={handleUpdate}>
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "90%",
    maxHeight: "90%",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
  },
  cardContent: {
    flexGrow: 0,
    paddingBottom: 20,
  },
  TitleBidding: {
    textAlign: "center",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 15,
    color: "#1e3a8a",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginVertical: 8,
    color: "#444",
  },
  input: {
    borderWidth: 1,
    borderColor: "#1e3a8a",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 15,
  },
  picker: {
    borderWidth: 1,
    borderColor: "#1e3a8a",
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#1e3a8a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  durationWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  durationButton: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 20,
    backgroundColor: "#e0e0e0",
    marginBottom: 10,
    minWidth: "30%",
    alignItems: "center",
  },
  durationButtonSelected: {
    backgroundColor: "#1e3a8a",
  },
  durationText: { fontSize: 16, color: "#333", fontWeight: "600" },
  durationTextSelected: { color: "#fff", fontWeight: "700" },
  imagePreview: {
    width: "100%",
    height: 220,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e3a8a",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e3a8a",
    backgroundColor: "#fafafa",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  smallInput: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1e3a8a",
    width: 110,
    fontSize: 14,
    marginLeft: "auto",
  },
  radioCircle: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#1e3a8a",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedRb: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1e3a8a" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  durationContainer: {
  width: "100%",
  marginTop: 10,
},
durationRow: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 10,
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#1e3a8a",
  backgroundColor: "#fff",
},
durationLabel: {
  marginLeft: 8,
  fontSize: 14,
  color: "#1f2937",
},
otherDurationInput: {
  flex: 1,
  marginLeft: 10,
  backgroundColor: "#f0f0f0",
  paddingVertical: 8,
  paddingHorizontal: 10,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#1e3a8a",
  fontSize: 14,
},
closeButton: {
  position: "absolute",
  top: 15,
  right: 15,
  zIndex: 10,
  backgroundColor: "#f0f0f0",
  width: 32,
  height: 32,
  borderRadius: 16,
  alignItems: "center",
  justifyContent: "center",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 2,
  elevation: 3,
},
closeButtonText: {
  fontSize: 18,
  fontWeight: "700",
  color: "#1e3a8a",
},


});

export default EditProductBiddingFormModal;
