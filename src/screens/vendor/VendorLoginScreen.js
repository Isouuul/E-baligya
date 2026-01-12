import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Modal,
  Image,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import LoginSuccess from '../../../assets/Login.png';
import WrongPasswordImage from '../../../assets/WrongPassword.png';

const VendorLoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [successModalVisible, setSuccessModalVisible] = useState(false);

  // Universal Error Modal
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showWrongPasswordImage, setShowWrongPasswordImage] = useState(false);
  const [showResetButton, setShowResetButton] = useState(false);

  // Pending status modal
  const [pendingModalVisible, setPendingModalVisible] = useState(false);

  // Hide status bar
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    return () => StatusBar.setHidden(false, 'fade');
  }, []);

const handleLogin = async () => {
  if (!email.trim() || !password) {
    setErrorMessage('Please enter both email and password.');
    setShowWrongPasswordImage(false);
    setShowResetButton(false);
    setErrorModalVisible(true);
    return;
  }

  setLoading(true);
  try {
    const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);

    // Check ApprovedVendors collection
    const approvedQ = query(collection(db, 'ApprovedVendors'), where('userId', '==', user.uid));
    const approvedSnap = await getDocs(approvedQ);

    if (!approvedSnap.empty) {
      // Vendor is approved -> allow login
      setSuccessModalVisible(true);
      setTimeout(() => {
        setSuccessModalVisible(false);
        navigation.replace('VendorDashboard');
      }, 1500);

    } else {
      // Check PendingVendors collection
      const pendingQ = query(collection(db, 'PendingVendors'), where('userId', '==', user.uid));
      const pendingSnap = await getDocs(pendingQ);

      if (!pendingSnap.empty) {
        // Vendor is pending -> show pending modal
        setPendingModalVisible(true);
        await signOut(auth); // prevent login
      } else {
        // Not found in either collection
        await signOut(auth);
        setErrorMessage('This account is not registered as a vendor.');
        setShowWrongPasswordImage(false);
        setShowResetButton(false);
        setErrorModalVisible(true);
      }
    }
  } catch (err) {
    console.error('[Login Error]', err.code, err.message);

    if (err.code === 'auth/wrong-password') {
      setShowWrongPasswordImage(true);
      setShowResetButton(true);
      setErrorMessage('Incorrect password. You can try again or reset your password.');
    } else {
      let msg = 'Something went wrong. Please try again.';
      if (err.code === 'auth/user-not-found') msg = 'No account with that email.';
      else if (err.code === 'auth/invalid-email') msg = 'Invalid email format.';
      else if (err.code === 'auth/network-request-failed') msg = 'Network error. Check your connection.';
      setShowWrongPasswordImage(false);
      setShowResetButton(false);
      setErrorMessage(msg);
    }

    setErrorModalVisible(true);
  } finally {
    setLoading(false);
  }
};


  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setErrorMessage('Please enter your email to receive a reset link.');
      setShowWrongPasswordImage(false);
      setShowResetButton(false);
      setErrorModalVisible(true);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setErrorMessage('Password reset link sent to your email.');
      setShowWrongPasswordImage(false);
      setShowResetButton(false);
      setErrorModalVisible(true);
    } catch (e) {
      console.error('[Reset Error]', e);
      setErrorMessage('Unable to send reset link. Please check your email.');
      setShowWrongPasswordImage(false);
      setShowResetButton(false);
      setErrorModalVisible(true);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity
        style={styles.switchIconContainer}
        onPress={() => navigation.navigate('Login')}
      >
        <FontAwesome name="arrow-left" size={20} color="#1d4ed8" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerBox}>
          <Text style={styles.headerTitle}>Welcome Back</Text>
          <Text style={styles.headerSubtitle}>Sign in to your vendor account</Text>
        </View>

        <View style={styles.card}>
          {/* Email */}
          <View style={styles.inputGroup}>
            <FontAwesome name="envelope" size={20} color="#555" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#888"
            />
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <FontAwesome name="lock" size={20} color="#555" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#888"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <FontAwesome name={showPassword ? 'eye' : 'eye-slash'} size={20} color="#555" />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotLink} onPress={handlePasswordReset}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginText}>Login</Text>}
          </TouchableOpacity>

          {/* Sign Up Prompt */}
          <View style={styles.signupPrompt}>
            <Text style={styles.promptText}>Not a vendor yet?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('VendorSignupStep1')}>
              <Text style={styles.signupText}> Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Success Modal */}
        <Modal
          transparent
          animationType="fade"
          visible={successModalVisible}
          onRequestClose={() => setSuccessModalVisible(false)}
        >
          <View style={successModalStyles.modalBackground}>
            <View style={successModalStyles.modalContent}>
              <Image
                source={LoginSuccess}
                style={successModalStyles.modalImage}
                resizeMode="contain"
              />
              <Text style={successModalStyles.modalText}>Logged in successfully!</Text>
            </View>
          </View>
        </Modal>

        {/* Universal Error Modal */}
        <Modal
          visible={errorModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setErrorModalVisible(false)}
        >
          <View style={errorModalStyles.modalBackground}>
            <View style={errorModalStyles.modalContent}>
              {showWrongPasswordImage && (
                <Image
                  source={WrongPasswordImage}
                  style={errorModalStyles.modalImage}
                  resizeMode="contain"
                />
              )}
              <Text style={[errorModalStyles.modalText, showWrongPasswordImage && { color: '#b91c1c' }]}>
                {errorMessage}
              </Text>
              <View style={errorModalStyles.modalActions}>
                <TouchableOpacity
                  style={errorModalStyles.modalButtonOutline}
                  onPress={() => setErrorModalVisible(false)}
                >
                  <Text style={errorModalStyles.modalButtonOutlineText}>Try Again</Text>
                </TouchableOpacity>
                {showResetButton && (
                  <TouchableOpacity
                    style={errorModalStyles.modalButton}
                    onPress={handlePasswordReset}
                  >
                    <Text style={errorModalStyles.modalButtonText}>Send Reset Link</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Pending Status Modal */}
        <Modal
          transparent
          animationType="fade"
          visible={pendingModalVisible}
          onRequestClose={() => setPendingModalVisible(false)}
        >
          <View style={errorModalStyles.modalBackground}>
            <View style={errorModalStyles.modalContent}>
              <Text style={[errorModalStyles.modalText, { color: '#b91c1c' }]}>
                Your account is still pending approval. Please wait for admin confirmation.
              </Text>
              <TouchableOpacity
                style={[errorModalStyles.modalButton, { marginTop: 10 }]}
                onPress={() => setPendingModalVisible(false)}
              >
                <Text style={errorModalStyles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default VendorLoginScreen;

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { padding: 24, flexGrow: 1, backgroundColor: '#f0f4f8', justifyContent: 'flex-start' },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 6 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', borderColor: '#ddd', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, marginBottom: 16, backgroundColor: '#f9f9f9' },
  icon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#222' },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { color: '#1d4ed8', fontWeight: '600' },
  loginButton: { backgroundColor: '#1d4ed8', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  loginText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  signupPrompt: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  promptText: { fontSize: 14, color: '#555' },
  signupText: { fontSize: 14, color: '#000', fontWeight: 'bold' },
  switchIconContainer: { position: 'absolute', top: 30, left: 16, zIndex: 10, backgroundColor: '#fff', height: 36, width: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 6, elevation: 4 },
  headerBox: { backgroundColor: '#eef2ff', borderRadius: 14, paddingVertical: 26, paddingHorizontal: 20, marginBottom: 18, alignItems: 'center', justifyContent: 'center', marginTop: 190 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1e3a8a' },
  headerSubtitle: { fontSize: 13, color: '#475569', marginTop: 6 },
});

// Success Modal
const successModalStyles = StyleSheet.create({
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: 200, height: 200, backgroundColor: '#fff', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  modalImage: { width: 80, height: 80, marginBottom: 15 },
  modalText: { fontSize: 16, fontWeight: '700', color: '#1e3a8a', textAlign: 'center' },
});

// Universal Error Modal
const errorModalStyles = StyleSheet.create({
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 15 },
  modalContent: { width: 280, backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center' },
  modalImage: { width: 80, height: 80, marginBottom: 15 },
  modalText: { fontSize: 16, color: '#475569', textAlign: 'center', marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalButtonOutline: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#475569' },
  modalButtonOutlineText: { color: '#475569', fontWeight: '600' },
  modalButton: { backgroundColor: '#1d4ed8', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  modalButtonText: { color: '#fff', fontWeight: '700' },
});
