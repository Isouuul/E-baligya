import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { auth, db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigation, useIsFocused } from '@react-navigation/native';

// Import your PNG assets
import TermsIcon from '../../../assets/Terms.png';
import VoucherIcon from '../../../assets/Voucher.png';
import WalletIcon from '../../../assets/Wallet.png';
import FAQIcon from '../../../assets/FAQ.png';
import BiddingIcon from '../../../assets/Bidding.png';
import PointsIcon from '../../../assets/Points.png';
import PendingIcon from '../../../assets/Pending.png';
import RateIcon from '../../../assets/Rate.png';

export default function Me() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        const uid = auth.currentUser.uid;
        const q = query(collection(db, 'Users'), where('uid', '==', uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setUserData(snapshot.docs[0].data());
        }
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to fetch user data.');
      } finally {
        setLoading(false);
      }
    };
    if (isFocused) fetchUserData();
  }, [isFocused]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Logout Error', error.message);
    }
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfileUser', { userData });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.centered}>
        <Text>No user data found.</Text>
      </View>
    );
  }

  // Use base64 profileImage if available
  const profileImage = userData.profileImage
    ? userData.profileImage.startsWith('data:image')
      ? userData.profileImage
      : `data:image/jpeg;base64,${userData.profileImage}`
    : 'https://i.pravatar.cc/150'; // fallback image

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileContent}>
            <Image source={{ uri: profileImage }} style={styles.selfieImage} />
            <View style={styles.infoSection}>
              <Text style={styles.value}>
                {userData.firstName} {userData.lastName}
              </Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditProfile}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Orders Section */}
        <View style={styles.sectionColumn}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          {[ 
            { icon: PendingIcon, label: 'Orders', onPress: () => navigation.navigate('OrdersDetails') },
            { icon: BiddingIcon, label: 'Bidding', onPress: () => navigation.navigate('MyBids') },
            { icon: RateIcon, label: 'Rate', onPress: null, disabled: true },
          ].map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.columnBox, item.disabled && { opacity: 0.5 }]}
              onPress={item.onPress}
              disabled={item.disabled}
            >
              <Image source={item.icon} style={{ width: 28, height: 28, marginRight: 15 }} />
              <Text style={styles.columnText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Wallet Section */}
        <View style={styles.sectionColumn}>
          <Text style={styles.sectionTitle}>My Wallet</Text>
          {[
            { icon: WalletIcon, label: 'Wallet (Unavailable)' },
            { icon: PointsIcon, label: 'Points (Unavailable)' },
            { icon: VoucherIcon, label: 'Vouchers (Unavailable)' },
          ].map((item, index) => (
            <View key={index} style={[styles.columnBox, { opacity: 0.5 }]}>
              <Image source={item.icon} style={{ width: 28, height: 28, marginRight: 15 }} />
              <Text style={styles.columnText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Support Section */}
        <View style={styles.sectionColumn}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity
            style={styles.columnBox}
            onPress={() => navigation.navigate('HelpCenter')}
          >
            <Image source={FAQIcon} style={{ width: 28, height: 28, marginRight: 15 }} />
            <Text style={styles.columnText}>Help Center</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.columnBox}
            onPress={() => navigation.navigate('TermsPolicyScreen')}
          >
            <Image source={TermsIcon} style={{ width: 28, height: 28, marginRight: 15 }} />
            <Text style={styles.columnText}>Terms & Policy</Text>
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity
            style={[styles.columnBox, { justifyContent: 'center', backgroundColor: '#ef4444' }]}
            onPress={handleLogout}
          >
            <Text style={[styles.columnText, { color: '#fff', fontWeight: '700' }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  scrollContainer: { padding: 20, flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },

  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    height: 150,
  },
  selfieImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#eee',
    marginRight: 20,
  },
  infoSection: { flex: 1 },
  value: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  editButton: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10, alignSelf: 'flex-start' },
  editButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  sectionColumn: { marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  columnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  columnText: { fontSize: 16, fontWeight: '600', color: '#374151' },
});
