// src/screens/Users/AddressSelection.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  TextInput,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
  addDoc,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Swipeable } from 'react-native-gesture-handler';
import MapView, { Marker } from 'react-native-maps';

export default function AddressSelection() {
  const user = auth.currentUser;
  const navigation = useNavigation();

  // ✅ PHONE VALIDATOR
  const isValidPhoneNumber = (number) => {
    if (!number) return false;
    const phRegex = /^(09\d{9}|\+639\d{9})$/;
    return phRegex.test(number.trim());
  };

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [userInfo, setUserInfo] = useState({ firstName: '', lastName: '', phoneNumber: '' });
  const [phoneInput, setPhoneInput] = useState('');

  // Success Animation
  const [successVisible, setSuccessVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const showSuccess = () => {
    setSuccessVisible(true);
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
      easing: Easing.bounce,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setSuccessVisible(false));
      }, 1500);
    });
  };

  // Delete Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchUserInfo = async () => {
      try {
        const userDocRef = doc(db, 'Users', user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserInfo(data);
          setPhoneInput(data.phoneNumber || '');
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };
    fetchUserInfo();

    const q = query(collection(db, 'Users-Address', user.uid, 'addresses'));
    const unsubscribe = onSnapshot(q, snapshot => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (a.status === 'active' ? -1 : 1));
      setAddresses(list);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const handleSelectAddress = async (selectedAddr) => {
    try {
      setLoading(true);
      const addressRef = collection(db, 'Users-Address', user.uid, 'addresses');
      const snapshot = await getDocs(addressRef);
      const updates = snapshot.docs.map(async (d) => {
        await updateDoc(doc(db, 'Users-Address', user.uid, 'addresses', d.id), {
          status: d.id === selectedAddr.id ? 'active' : 'inactive',
        });
      });
      await Promise.all(updates);
      showSuccess();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = () => navigation.navigate('AddAddress');

  const handlePinLocation = async () => {
    try {
      setLocationLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setSelectedCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      setMapModalVisible(true);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to get your location.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!selectedCoords) return;

    if (!phoneInput.trim()) {
      Alert.alert(
        'Phone number required',
        'Please enter a contact number before saving.'
      );
      return;
    }

    if (!isValidPhoneNumber(phoneInput)) {
      Alert.alert(
        'Invalid phone number',
        'Use 09XXXXXXXXX or +639XXXXXXXXX.'
      );
      return;
    }

    try {
      setLoading(true);

      const { latitude, longitude } = selectedCoords;
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });

      const newAddress = {
        firstName: userInfo.firstName || '',
        lastName: userInfo.lastName || '',
        phoneNumber: phoneInput.trim(),
        streetName: place?.street || '',
        barangay: place?.subregion || '',
        city: place?.city || '',
        province: place?.region || '',
        region: place?.country || '',
        latitude,
        longitude,
        status: 'active',
      };

      const addressRef = collection(db, 'Users-Address', user.uid, 'addresses');

      const snapshot = await getDocs(addressRef);
      await Promise.all(
        snapshot.docs.map(d =>
          updateDoc(doc(db, 'Users-Address', user.uid, 'addresses', d.id), {
            status: 'inactive',
          })
        )
      );

      await addDoc(addressRef, newAddress);

      setMapModalVisible(false);
      setPhoneInput('');
      showSuccess();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save address.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = (addrId) => {
    setSelectedAddressId(addrId);
    setDeleteModalVisible(true);
  };

  const renderRightActions = (addrId) => (
    <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteAddress(addrId)}>
      <Ionicons name="trash-outline" size={26} color="#fff" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 10 }}>Loading addresses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Addresses</Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, { marginBottom: 12, backgroundColor: '#10B981' }]}
          onPress={handlePinLocation}
          disabled={mapLoading}
        >
          {mapLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="pin" size={20} color="#fff" />
              <Text style={[styles.addButtonText, { marginLeft: 6 }]}>
                Pin My Location
              </Text>
            </>
          )}
        </TouchableOpacity>

        {addresses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={60} color="#9CA3AF" />
            <Text style={styles.emptyText}>No saved addresses yet</Text>
          </View>
        ) : (
          addresses.map((addr) => (
            <Swipeable key={addr.id} renderRightActions={() => renderRightActions(addr.id)}>
              <TouchableOpacity
                style={[styles.addressCard, addr.status === 'active' && styles.activeCard]}
                onPress={() => handleSelectAddress(addr)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nameText}>
                      {addr.firstName || userInfo.firstName} {addr.lastName || userInfo.lastName}
                    </Text>

                    {addr.status === 'active' && (
                      <View style={styles.activeBadge}>
                        <Ionicons name="star" size={12} color="#fff" />
                        <Text style={styles.activeText}>Active</Text>
                      </View>
                    )}

                    <Text style={styles.infoText}>📍 {addr.streetName}</Text>
                    <Text style={styles.infoText}>
                      {addr.barangay}, {addr.city}
                    </Text>
                    <Text style={styles.infoText}>
                      {addr.province}, {addr.region}
                    </Text>
                    <Text style={styles.infoText}>📞 {addr.phoneNumber || userInfo.phoneNumber}</Text>
                  </View>

                  {addr.status === 'active' && <Ionicons name="checkmark-circle" size={26} color="#3B82F6" />}
                </View>
              </TouchableOpacity>
            </Swipeable>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.addButton} onPress={handleAddAddress}>
          <Ionicons name="add-circle-outline" size={22} color="#fff" />
          <Text style={styles.addButtonText}>Add New Address</Text>
        </TouchableOpacity>
      </View>

      {/* Animated Success Modal */}
      {successVisible && (
        <View style={styles.successOverlay}>
          <Animated.View style={[styles.successContainer, { transform: [{ scale: scaleAnim }] }]}>
            <Ionicons name="checkmark-circle" size={60} color="#10B981" />
            <Text style={styles.successText}>Success! Address has been updated</Text>
          </Animated.View>
        </View>
      )}

      {/* Map Modal */}
      <Modal
        visible={mapModalVisible}
        animationType="slide"
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View style={{ flex: 1, padding: 10 }}>
          {selectedCoords ? (
            <>
              <MapView
                style={{ flex: 1, borderRadius: 12 }}
                initialRegion={{
                  latitude: selectedCoords.latitude,
                  longitude: selectedCoords.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onPress={(e) => setSelectedCoords(e.nativeEvent.coordinate)}
              >
                <Marker
                  coordinate={selectedCoords}
                  draggable
                  onDragEnd={(e) => setSelectedCoords(e.nativeEvent.coordinate)}
                />
              </MapView>

              {/* Phone number input */}
              <View style={{ marginVertical: 10 }}>
                <Text style={{ fontWeight: '700', marginBottom: 5 }}>Contact Phone Number</Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontSize: 16,
                  }}
                  keyboardType="phone-pad"
                  placeholder="Enter phone number"
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                />
              </View>
            </>
          ) : (
            <ActivityIndicator size="large" style={{ flex: 1 }} />
          )}

          {/* Modal buttons */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity
              style={{ flex: 1, marginRight: 5, backgroundColor: '#9CA3AF', padding: 12, borderRadius: 10 }}
              onPress={() => setMapModalVisible(false)}
            >
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                marginLeft: 5,
                backgroundColor: isValidPhoneNumber(phoneInput) ? '#3B82F6' : '#9CA3AF',
                padding: 12,
                borderRadius: 10,
              }}
              disabled={!isValidPhoneNumber(phoneInput)}
              onPress={handleSaveLocation}
            >
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>
                Save Location
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Ionicons name="trash-outline" size={50} color="#EF4444" />
            <Text style={styles.modalTitle}>Delete Address</Text>
            <Text style={styles.modalText}>Are you sure you want to delete this address?</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#9CA3AF' }]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#EF4444' }]}
                onPress={async () => {
                  try {
                    setLoading(true);
                    await deleteDoc(doc(db, 'Users-Address', user.uid, 'addresses', selectedAddressId));
                    setDeleteModalVisible(false);
                  } catch (error) {
                    console.error(error);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Text style={styles.modalButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 10 },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  backButton: { marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  addressCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginVertical: 6, elevation: 2 },
  activeCard: { borderWidth: 2, borderColor: '#3B82F6' },
  nameText: { fontSize: 15, fontWeight: '700', color: '#111827' },
  infoText: { fontSize: 13, color: '#4B5563', marginTop: 2 },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 4,
  },
  activeText: { color: '#fff', fontSize: 11, marginLeft: 3, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#6B7280', marginTop: 8, fontSize: 14 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 10 },
  addButton: { backgroundColor: '#3B82F6', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 12, paddingVertical: 12 },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  successOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  successContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 5,
  },
  successText: { fontSize: 18, fontWeight: '700', marginTop: 10, color: '#111827' },
  deleteButton: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    borderRadius: 12,
    marginVertical: 6,
    marginRight: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginTop: 10, color: '#111827' },
  modalText: { fontSize: 14, color: '#4B5563', textAlign: 'center', marginVertical: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
