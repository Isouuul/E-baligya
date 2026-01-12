import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  StatusBar,
} from 'react-native';
import { getAuth, signOut } from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen = () => {
  const [vendorData, setVendorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  const navigation = useNavigation();
  const auth = getAuth();
  const db = getFirestore();
  const user = auth.currentUser;

  useEffect(() => {
    let unsubscribeFollowers = null;
    let unsubscribeVendor = null;

    const fetchVendorData = async () => {
      try {
        if (user) {
          const vendorQuery = query(
            collection(db, 'ApprovedVendors'),
            where('userId', '==', user.uid)
          );

          const querySnapshot = await getDocs(vendorQuery);

          if (!querySnapshot.empty) {
            const vendorDoc = querySnapshot.docs[0];
            setVendorData({ ...vendorDoc.data(), id: vendorDoc.id });

            // REAL-TIME LISTENER: update profile image & followers automatically
            const vendorDocRef = doc(db, 'ApprovedVendors', vendorDoc.id);
            unsubscribeVendor = onSnapshot(vendorDocRef, (snapshot) => {
              if (snapshot.exists()) {
                setVendorData({ ...snapshot.data(), id: snapshot.id });
              }
            });

            const followersRef = collection(db, 'ApprovedVendors', vendorDoc.id, 'followers');
            unsubscribeFollowers = onSnapshot(followersRef, (snapshot) => {
              setFollowersCount(snapshot.size);
            });
          } else {
            console.warn('No vendor found.');
          }
        }
      } catch (error) {
        console.error('Error fetching vendor data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVendorData();

    return () => {
      if (unsubscribeFollowers) unsubscribeFollowers();
      if (unsubscribeVendor) unsubscribeVendor();
    };
  }, [user, db]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Logout Error', error.message);
    }
  };

  const handleEditProfile = () => {
    if (vendorData) {
      navigation.navigate('EditVendorProfile', { vendorData });
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!vendorData) {
    return (
      <View style={styles.centered}>
        <Text>No vendor data found.</Text>
      </View>
    );
  }

  const profileImage = vendorData?.profileImage
    ? vendorData.profileImage.startsWith('data:')
      ? vendorData.profileImage
      : vendorData.profileImage
    : 'https://via.placeholder.com/100';

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Section */}
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={() => setPreviewVisible(true)}>
            <Image source={{ uri: profileImage }} style={styles.image} />
          </TouchableOpacity>

          <View style={styles.infoSection}>
            <Text style={styles.value}>
              {vendorData.businessName || 'Your Business'}
            </Text>

            {/* LIVE FOLLOWERS COUNT */}
            <Text style={styles.followingText}>
              Followers: {followersCount}
            </Text>

            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Modal */}
        <Modal transparent={true} visible={previewVisible} animationType="fade">
          <View style={styles.modalBackground}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setPreviewVisible(false)}
            >
              <Ionicons name="close-circle" size={40} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: profileImage }} style={styles.modalImage} />
          </View>
        </Modal>

<TouchableOpacity
  style={[styles.subscriptionsButton, { opacity: 0.5 }]} // faded look
  onPress={() => {}}
  disabled={true} // disables touch
>
  <Ionicons
    name="card-outline"
    size={20}
    color="#fff"
    style={{ marginRight: 8 }}
  />
  <Text style={styles.subscriptionsText}>Subscriptions</Text>
</TouchableOpacity>

{/* Generate Voucher (Disabled) */}
<TouchableOpacity
  style={[styles.subscriptionsButton, { opacity: 0.5 }]} // grayed out
  onPress={() => {}}
  disabled={true} // disables interaction
>
  <Ionicons
    name="pricetag-outline"
    size={20}
    color="#fff"
    style={{ marginRight: 8 }}
  />
  <Text style={styles.subscriptionsText}>Generate Voucher</Text>
</TouchableOpacity>



        {/* Support Section */}
        <View style={styles.supportSection}>
          <Text style={styles.sectionTitle}>Support</Text>

          {[
            {
              icon: 'help-circle-outline',
              label: 'Help Center',
              onPress: () => navigation.navigate('HelpCenterScreen'),
            },
            {
              icon: 'document-text-outline',
              label: 'Terms & Policy',
              onPress: () => navigation.navigate('TermsPolicyScreen'),
            },
            {
              icon: 'chatbubbles-outline',
              label: 'Chat with AgriFishery',
              onPress: () => navigation.navigate('ChatScreen'),
            },
          ].map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.supportCard}
              onPress={item.onPress}
            >
              <Ionicons
                name={item.icon}
                size={24}
                color="#2563eb"
                style={styles.supportIcon}
              />
              <Text style={styles.supportText}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          {/* Logout */}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButtonBelow}>
            <Text style={styles.logoutTextBelow}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9', marginTop: 0 },
  scrollContainer: { padding: 20, flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5
  },
  image: {
    width: 95,
    height: 95,
    borderRadius: 50,
    backgroundColor: '#eee',
    marginRight: 20
  },
  infoSection: { flex: 1 },
  value: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  followingText: { fontSize: 14, color: '#6b7280' },

  editButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginTop: 6,
    width: 120,
    alignItems: 'center'
  },
  editButtonText: { color: '#fff', fontWeight: '600' },

  subscriptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e40af',
    paddingVertical: 12,
    borderRadius: 18,
    marginVertical: 15,
    elevation: 4
  },
  subscriptionsText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  supportSection: { marginTop: 10 },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 12
  },
  supportIcon: { marginRight: 12 },
  supportText: { fontSize: 15, fontWeight: '500', color: '#111827' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e3a8a', marginBottom: 12 },

  logoutButtonBelow: {
    backgroundColor: '#1e3a8a',
    paddingVertical: 12,
    borderRadius: 15,
    marginTop: 20,
    alignItems: 'center'
  },
  logoutTextBelow: { color: '#fff', fontWeight: '600', fontSize: 16 },

  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeButton: { position: 'absolute', top: 40, right: 20 },
  modalImage: { width: 300, height: 300, borderRadius: 15 }
});
