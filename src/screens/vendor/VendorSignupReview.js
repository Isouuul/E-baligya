import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  SafeAreaView,
} from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db, auth } from "../../firebase";
import * as FileSystem from "expo-file-system";

// Small reusable progress indicator (3 steps)
const ProgressSteps = ({ currentStep = Review }) => {
  const steps = ["Step 1", "Step 2", "Step 3", "Review"];
  return (
    <View style={styles.progressContainer}>
      {steps.map((label, idx) => {
        const stepNumber = idx + 1;
        const completed = stepNumber < currentStep;
        const active = stepNumber === currentStep;
        const circleColor = completed || active ? "#1d4ed8" : "#cbd5e1"; 
        const lineColor = currentStep > stepNumber ? "#1d4ed8" : "#e2e8f0";
        const [agreed, setAgreed] = useState(false);


        return (
          <React.Fragment key={idx}>
            <View style={styles.stepWrapper}>
              <View style={[styles.circle, { backgroundColor: circleColor }]}>
                <Text style={styles.circleText}>{stepNumber}</Text>
              </View>
              <Text style={styles.stepLabel}>{label}</Text>
            </View>
            {idx !== steps.length - 1 && (
              <View style={[styles.line, { backgroundColor: lineColor }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const VendorSignupReview = ({ route, navigation }) => {
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const {
    businessName,
    ownerName,
    email,
    phone,
    password,
    birthday,
    gender,
    businessType,
    govIDFront,
    govIDBack,
    selfie,
    businessPermit,
    ocrFields,           // ✅ add OCR info (PhilID)
    businessPermitNumber, // ✅ add Business Number
    latitude,
    longitude,
    selectedProvince,
    selectedCity,
    selectedBarangay,
    streetName,
    marketName,
  } = route.params || {};

  const currentStep = route.params?.currentStep || 3;

// Final composed market/business address
const businessAddressFinal =
  route.params?.businessAddress ??
  (streetName && selectedBarangay && selectedCity && selectedProvince
    ? `${streetName}, ${selectedBarangay}, ${selectedCity}, ${selectedProvince}`
    : marketName ?? "Not provided");


  // Convert image URI to compressed base64 (for admin to upload later)
  const convertImageToBase64 = async (imageURI) => {
    if (!imageURI) return null;

    try {
      // Check if it's already base64 or URL
      if (imageURI.startsWith('http')) {
        return imageURI; // Already a URL
      }
      if (imageURI.startsWith('data:image')) {
        return imageURI; // Already base64
      }

      // Read file as base64 with compression
      // Note: We compress by reading at lower quality
      const base64 = await FileSystem.readAsStringAsync(imageURI, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64 || base64.length === 0) {
        throw new Error('Image file is empty or could not be read');
      }

      // Return as data URI format
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error(`Error converting image to base64:`, error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!agreed) {
      Alert.alert(
        "Agreement required",
        "Please agree to the Terms and Conditions before submitting."
      );
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create auth account first
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      const sanitizedEmail = email.replace(/\./g, "_");
      const timestamp = Date.now();

      // Step 2: Convert images to base64 (admin will upload to Storage during approval)
      // Store images in separate documents to avoid 1MB limit per document
      const [govIDFrontBase64, govIDBackBase64, selfieBase64, businessPermitBase64] = await Promise.all([
        convertImageToBase64(govIDFront),
        convertImageToBase64(govIDBack),
        convertImageToBase64(selfie),
        convertImageToBase64(businessPermit),
      ]);

      // Step 3: Save only minimal pending data (full data saved only after admin approval)
      // Store in PendingVendors collection with full data in subcollection
      const pendingPayload = {
        userId: user.uid,
        email: email ?? null,
        businessName: businessName ?? null,
        ownerName: ownerName ?? null,
        status: "Pending",
        createdAt: Timestamp.now(),
        // Flag indicating full data is in subcollection
        hasFullData: true,
      };

      // Save minimal data to PendingVendors (for admin to see the request)
      await setDoc(doc(db, "PendingVendors", sanitizedEmail), pendingPayload);

      // Step 4: Store full vendor data in subcollection (not in VendorUsers until approved)
      const fullDataPayload = {
        userId: user.uid,
        businessName: businessName ?? null,
        ownerName: ownerName ?? null,
        email: email ?? null,
        phone: phone ?? null,
        birthday: birthday ?? null,
        gender: gender ?? null,
        businessType: businessType ?? null,
        businessAddress: businessAddressFinal ?? null,
        agreedToTerms: agreed, // ✅ ADD
        agreedAt: agreed ? Timestamp.now() : null, // ✅ ADD
        ocrFields: ocrFields ?? null,
        businessPermitNumber: businessPermitNumber ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        role: "Vendor",
        subscription: "Unsubscribe",
        createdAt: Timestamp.now(),
      };

      // Save full data to subcollection
      await setDoc(doc(db, "PendingVendors", sanitizedEmail, "fullData", "vendorData"), fullDataPayload);

      // Step 5: Store images in subcollection (one per document to avoid size limits)
      const imageDocs = [];
      if (govIDFrontBase64) {
        imageDocs.push(setDoc(doc(db, "PendingVendors", sanitizedEmail, "images", "govIDFront"), {
          image: govIDFrontBase64,
          type: "govIDFront",
          createdAt: Timestamp.now(),
        }));
      }
      if (govIDBackBase64) {
        imageDocs.push(setDoc(doc(db, "PendingVendors", sanitizedEmail, "images", "govIDBack"), {
          image: govIDBackBase64,
          type: "govIDBack",
          createdAt: Timestamp.now(),
        }));
      }
      if (selfieBase64) {
        imageDocs.push(setDoc(doc(db, "PendingVendors", sanitizedEmail, "images", "selfie"), {
          image: selfieBase64,
          type: "selfie",
          createdAt: Timestamp.now(),
        }));
      }
      if (businessPermitBase64) {
        imageDocs.push(setDoc(doc(db, "PendingVendors", sanitizedEmail, "images", "businessPermit"), {
          image: businessPermitBase64,
          type: "businessPermit",
          createdAt: Timestamp.now(),
        }));
      }

      await Promise.all(imageDocs);

      Alert.alert("✅ Success", "Your registration has been submitted!");
      navigation.navigate("Login");
    } catch (error) {
      console.error("Registration Error:", error);
      
      // If auth was created but Firestore failed, try to delete the auth account
      if (auth.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch (deleteError) {
          console.error("Error deleting auth account:", deleteError);
        }
      }
      
      Alert.alert("❌ Error", error.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
  <View style={styles.header}>
    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
      <Text style={styles.backButtonText}>◀ Back</Text>
    </TouchableOpacity>
    <Text style={styles.headerTitle}>Vendor Registration</Text>
  </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ProgressSteps currentStep={currentStep} />

      <Text style={styles.title}>Review Your Information</Text>
      <Text style={styles.subtitle}>
        Please check your details before submitting.
      </Text>

      {/* Personal Info */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Personal Information</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Full Name:</Text>
          <Text style={styles.value}>{ownerName || 'Not provided'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{email || 'Not provided'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Phone:</Text>
          <Text style={styles.value}>{phone || 'Not provided'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Birthday:</Text>
          <Text style={styles.value}>{birthday || 'Not provided'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Gender:</Text>
          <Text style={styles.value}>{gender || 'Not provided'}</Text>
        </View>

          <View style={styles.row}>
          <Text style={styles.label}>Market Address:</Text>
          <Text style={styles.value}>{businessAddressFinal || 'Not provided'}</Text>
        </View>
      </View>

      {/* Business Info */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Business Information</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Market Name:</Text>
          <Text style={styles.value}>{marketName || 'Not provided'}</Text>
        </View>
        
      

        <View style={styles.row}>
          <Text style={styles.label}>Business Name:</Text>
          <Text style={styles.value}>{businessName || 'Not provided'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Type:</Text>
          <Text style={styles.value}>{businessType || 'Not provided'}</Text>
        </View>

            <View style={styles.row}>
      <Text style={styles.label}>Permit Number:</Text>
      <Text style={styles.value}>{businessPermitNumber}</Text>
    </View>

    
    {businessPermit && (
      <Image source={{ uri: businessPermit }} style={styles.image} />
    )}

    

      </View>

      {/* Government ID */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>Government ID</Text>

        {govIDFront ? (
          <View style={styles.idContainer}>
            <Text style={styles.idLabel}>Front:</Text>
            <Image source={{ uri: govIDFront }} style={styles.image} />
          </View>
        ) : (
          <Text style={styles.missing}>No ID Front uploaded</Text>
        )}

        {govIDBack ? (
          <View style={styles.idContainer}>
            <Text style={styles.idLabel}>Back:</Text>
            <Image source={{ uri: govIDBack }} style={styles.image} />
          </View>
        ) : (
          <Text style={styles.missing}>No ID Back uploaded</Text>
        )}
      </View>

      {/* Terms & Conditions */}
      <View style={styles.termsCard}>
        <Text style={styles.cardHeader}>Terms & Conditions</Text>
        <Text style={styles.termsText}>
          By submitting this registration you agree to our Terms & Conditions.
        </Text>

        <View style={styles.termsRow}>
          <TouchableOpacity
            style={[styles.checkbox, agreed && styles.checkboxChecked]}
            onPress={() => setAgreed((s) => !s)}
          >
            {agreed && <Text style={styles.checkboxMark}>✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setAgreed(true)}>
            <Text style={styles.checkboxLabel}>
              I agree to the Terms & Conditions
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate("TermsPolicyScreen")}
        >
          <Text style={styles.readFull}>Read full terms</Text>
        </TouchableOpacity>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Submit Registration</Text>
        )}
      </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default VendorSignupReview;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f1f6fb",
  },

  /* HEADER - Same UI as Step 1 */
header: {
  backgroundColor: '#1E40AF', // dark blue
  paddingTop: 50,
  paddingBottom: 15,
  paddingHorizontal: 20,
  flexDirection: 'row',
  alignItems: 'center',
},
backButton: {
  backgroundColor: '#113be5ff',
  padding: 6,
  borderRadius: 6,
  marginRight: 15,
},
backButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
headerTitle: {
  flex: 1,
  textAlign: 'center',
  color: '#fff',
  fontSize: 20,
  fontWeight: '700',
},

  container: {
    marginTop: 35,
    padding: 20,
    paddingBottom: Platform.OS === "android" ? 120 : 50,
    backgroundColor: "#f1f6fb",
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
    color: "#1e3a8a",
  },
  subtitle: {
    textAlign: "center",
    color: "#475569",
    marginBottom: 20,
    fontSize: 14,
  },
  card: {
    padding: 10,
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  row: {
    flexDirection: "column",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  label: {
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4,
  },
  value: {
    color: "#1e293b",
    fontWeight: "500",
    textAlign: "left",
    width: "100%",
  },
  idContainer: {
    marginBottom: 12,
  },
  idLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  image: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginTop: 8,
    backgroundColor: "#e2e8f0",
  },
  missing: {
    color: "#ef4444",
    fontStyle: "italic",
    textAlign: "center",
  },
  button: {
    backgroundColor: "#1e90ff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: Platform.OS === "android" ? 20 : 10,
    minHeight: 56,
    shadowColor: "#1e90ff",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    textTransform: "uppercase",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  stepWrapper: {
    alignItems: "center",
    width: 80,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  circleText: {
    color: "#fff",
    fontWeight: "700",
  },
  stepLabel: {
    marginTop: 6,
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
  },
  line: {
    height: 4,
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 2,
  },
  termsCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  termsText: {
    color: "#475569",
    fontSize: 13,
    marginBottom: 10,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 4,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  checkboxMark: {
    color: "#fff",
    fontWeight: "700",
  },
  checkboxLabel: {
    color: "#0f172a",
    fontWeight: "600",
  },
  readFull: {
    color: "#1d4ed8",
    marginTop: 6,
    fontWeight: "600",
  },
});
