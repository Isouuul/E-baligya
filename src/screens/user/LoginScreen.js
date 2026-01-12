import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { auth, db } from '../../firebase'; 
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Login success image
import LoginSuccess from '../../../assets/Login.png';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(null); // message text
  const [messageType, setMessageType] = useState(null); // 'success' | 'error'
  const [loading, setLoading] = useState(false); 
  const [modalVisible, setModalVisible] = useState(false); // modal state

  const handleLogin = async () => {
  if (!email || !password) {
    setMessageType('error');
    setMessage('⚠️ Please enter both email and password.');
    return;
  }

  setLoading(true);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    const userQuery = query(collection(db, 'Users'), where('uid', '==', uid));
    const userSnapshot = await getDocs(userQuery);

    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();

      // ⭐ CHECK ACCOUNT STATUS
      const now = new Date();
      if (userData.status === 'banned') {
        setMessageType('error');
        setMessage('🚫 Your account has been permanently banned.');
        await auth.signOut();
        setLoading(false);
        return;
      }

      if (userData.status === 'restricted') {
        if (userData.restrictedUntil && userData.restrictedUntil.toDate() > now) {
          const remaining = Math.ceil(
            (userData.restrictedUntil.toDate() - now) / 1000 / 60
          ); // minutes
          setMessageType('error');
          setMessage(`⚠️ Your account is temporarily restricted. Try again in ${remaining} minutes.`);
          await auth.signOut();
          setLoading(false);
          return;
        } else {
          // restriction expired, allow login and reset status
          await updateDoc(userDoc.ref, { status: 'active', restrictedUntil: null });
        }
      }

      // ✅ Login successful
      setModalVisible(true);
      setTimeout(() => {
        setModalVisible(false);
        navigation.replace('ConsumerTabs');
      }, 1500);
    } else {
      await auth.signOut();
      setMessageType('error');
      setMessage('🚫 Access Denied: This account is not registered as a user.');
    }
  } catch (error) {
    console.error(error);
    setMessageType('error');
    setMessage('❌ Login Failed: ' + error.message);
  } finally {
    setLoading(false);
  }
};


  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Vendor Switch Button */}
        <TouchableOpacity
          style={styles.vendorIconContainer}
          onPress={() => navigation.navigate('VendorLoginScreen')}
        >
          <Image
            source={require('../user/images/Market.png')}
            style={styles.vendorIcon}
            resizeMode="contain"
          />
          <Text style={styles.vendorText}>Vendor</Text>
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../user/images/ebaligya.png')}
            style={styles.logo}
            resizeMode='contain'
          />
        </View>

        <Text style={styles.title}>Welcome Back</Text>

        {/* Error / Success Alert */}
        {message && (
          <View
            style={[
              styles.alertBox,
              messageType === 'success' ? styles.successBox : styles.errorBox,
            ]}
          >
            <FontAwesome
              name={messageType === 'success' ? 'check-circle' : 'exclamation-triangle'}
              size={20}
              color={messageType === 'success' ? '#166534' : '#b91c1c'}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.alertText,
                { color: messageType === 'success' ? '#166534' : '#b91c1c' },
              ]}
            >
              {message}
            </Text>
          </View>
        )}

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <FontAwesome name="envelope" size={20} color="#555" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#888"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <FontAwesome name="lock" size={24} color="#555" style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#888"
            />
          </View>

          <TouchableOpacity style={styles.forgotLink}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.loginText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signupPrompt}>
            <Text style={styles.promptText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupText}> Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Success Modal */}
        <Modal
          transparent
          animationType="fade"
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalBackground}>
            <View style={styles.modalContent}>
              <Image
                source={LoginSuccess}
                style={styles.modalImage}
                resizeMode="contain"
              />
              <Text style={styles.modalText}>Logged in successfully!</Text>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    padding: 24,
    flexGrow: 1,
    backgroundColor: '#f0f4f8',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e3a8a',
    textAlign: 'center',
    marginTop: -20,
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 18,
    backgroundColor: '#f9f9f9',
  },
  icon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#222' },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { color: '#1e90ff', fontWeight: '500' },
  loginButton: { backgroundColor: '#1e90ff', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  loginText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  vendorIconContainer: { position: 'absolute', top: 40, right: 0, zIndex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 14, borderTopLeftRadius: 30, borderBottomLeftRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  vendorIcon: { width: 28, height: 28, marginRight: 8 },
  vendorText: { fontSize: 16, fontWeight: '600', color: '#000' },
  logoContainer: { alignItems: 'center', marginTop: -10 },
  logo: { width: 250, height: 250, marginBottom: 10 },
  signupPrompt: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  promptText: { fontSize: 14, color: '#555' },
  signupText: { fontSize: 14, color: '#1e90ff', fontWeight: 'bold' },
  alertBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1 },
  successBox: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  errorBox: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  alertText: { flex: 1, fontSize: 14, fontWeight: '500' },

  // Modal styles
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: 200, height: 200, backgroundColor: '#fff', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  modalImage: { width: 80, height: 80, marginBottom: 15 },
  modalText: { fontSize: 16, fontWeight: '700', color: '#1e3a8a' },
});
