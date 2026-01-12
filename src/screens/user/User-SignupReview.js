import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { db, auth } from "../../firebase";
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const SignupReview = ({ route, navigation }) => {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    selectedIDType,
    idImage,
    selfieImage,
    email,
    password,
    firstName,
    middleName,
    lastName,
    birthdate,
    gender,
    address,
  } = route.params;

  const handleSubmit = async () => {
    if (!agreed) {
      Alert.alert('Agreement Required', 'Please agree to the Terms & Conditions before submitting.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Save user details to Firestore
      const userRef = doc(db, 'Users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email,
        firstName,
        middleName,
        lastName,
        birthdate,
        gender,
        address,
        selectedIDType,
        idImage,
        selfieImage,
        role: 'Consumer',
        createdAt: new Date().toISOString(),
      });

      Alert.alert('Success', 'Registration submitted successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error) {
      console.error('Signup error:', error.code, error.message);
      Alert.alert('Error', error.message || 'Failed to submit registration. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Progress Steps */}
      <View style={styles.progressHolder}>
        <View style={styles.circleActive}><Text style={styles.circleText}>1</Text></View>
        <View style={styles.lineActive} />
        <View style={styles.circleActive}><Text style={styles.circleText}>2</Text></View>
        <View style={styles.lineActive} />
        <View style={styles.circleActive}><Text style={styles.circleText}>3</Text></View>
      </View>

      <Text style={styles.header}>Review Your Information</Text>

      {/* Personal Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal Information</Text>
        <Text style={styles.label}>Full Name:</Text>
        <Text style={styles.value}>{firstName} {middleName} {lastName}</Text>

        <Text style={styles.label}>Email:</Text>
        <Text style={styles.value}>{email}</Text>

        <Text style={styles.label}>Birthdate:</Text>
        <Text style={styles.value}>{birthdate}</Text>

        <Text style={styles.label}>Gender:</Text>
        <Text style={styles.value}>{gender}</Text>
      </View>

      {/* Address Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Address</Text>
        <Text style={styles.label}>Region:</Text>
        <Text style={styles.value}>{address?.region}</Text>

        <Text style={styles.label}>City:</Text>
        <Text style={styles.value}>{address?.city}</Text>

        <Text style={styles.label}>Barangay:</Text>
        <Text style={styles.value}>{address?.barangay}</Text>

        <Text style={styles.label}>Street / Block / House No:</Text>
        <Text style={styles.value}>{address?.street}</Text>
      </View>

      {/* ID Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ID Verification</Text>
        <Text style={styles.label}>ID Type:</Text>
        <Text style={styles.value}>{selectedIDType}</Text>

        <Text style={styles.label}>ID Image:</Text>
        <Image source={{ uri: idImage }} style={styles.image} />

        <Text style={styles.label}>Selfie Image:</Text>
        <Image source={{ uri: selfieImage }} style={styles.image} />
      </View>

      {/* Terms & Conditions */}
      <View style={styles.termsCard}>
        <Text style={styles.cardTitle}>Terms & Conditions</Text>
        <Text style={styles.termsText}>
          By submitting this registration you agree to our Terms & Conditions and confirm that the
          information provided is accurate. You may read the full Terms & Conditions before proceeding.
        </Text>
        <View style={styles.termsRow}>
          <TouchableOpacity
            style={[styles.checkbox, agreed && styles.checkboxChecked]}
            onPress={() => setAgreed(!agreed)}
          >
            {agreed && <Text style={styles.checkboxMark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAgreed(true)}>
            <Text style={styles.checkboxLabel}>I agree to the Terms & Conditions</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('TermsPolicyScreen')}>
          <Text style={styles.readFull}>Read full terms</Text>
        </TouchableOpacity>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, loading && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>✅ Submit Registration</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

export default SignupReview;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f0f4f8',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1e3a8a',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    color: '#555',
  },
  value: {
    fontSize: 15,
    color: '#222',
    marginTop: 2,
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginTop: 10,
  },
  submitButton: {
    backgroundColor: '#1e90ff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#1e90ff',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  /* Progress steps */
  progressHolder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  circleActive: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    color: '#fff',
    fontWeight: '700',
  },
  lineActive: {
    flex: 1,
    height: 4,
    backgroundColor: '#1d4ed8',
    marginHorizontal: 6,
    borderRadius: 2,
  },
  /* Terms & Conditions */
  termsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 4,
  },
  termsText: {
    color: '#475569',
    fontSize: 13,
    marginBottom: 10,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  checkboxMark: {
    color: '#fff',
    fontWeight: '700',
  },
  checkboxLabel: {
    color: '#0f172a',
    fontWeight: '600',
  },
  readFull: {
    color: '#1d4ed8',
    marginTop: 6,
    fontWeight: '600',
  },
});
