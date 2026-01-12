// --- SAME IMPORTS ---
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  StatusBar,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

// ---------- Progress Circle UI ----------
//dasdasdasdasdasdasdasdasdas
const ProgressSteps = ({ currentStep = 2 }) => {
  const steps = ['Step 1', 'Step 2', 'Step 3', 'Review'];

  return (
    <View style={styles.progressContainer}>
      {steps.map((label, idx) => {
        const stepNumber = idx + 1;
        const active = stepNumber === currentStep;
        const completed = stepNumber < currentStep;

        return (
          <React.Fragment key={idx}>
            <View style={styles.stepWrapper}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: active || completed ? '#2563EB' : '#cbd5e1',
                    transform: [{ scale: active ? 1.15 : 1 }],
                  },
                ]}
              >
                <Text style={styles.circleText}>{stepNumber}</Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  { color: active ? '#2563EB' : '#64748b' },
                ]}
              >
                {label}
              </Text>
            </View>

            {idx !== steps.length - 1 && (
              <View
                style={[
                  styles.line,
                  { backgroundColor: completed ? '#2563EB' : '#e5e7eb' },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

// ---------- MAIN COMPONENT ----------
const VendorSignupStep2 = ({ route, navigation}) => {
  const {
    businessType,
    marketName,
    latitude,
    longitude,
    govIDFront,
    govIDBack,
    businessPermit,
    ocrFields,
    businessPermitNumber,
  } = route.params;

  const currentStep = 2;

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');

  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [streetName, setStreetName] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
const [otpSent, setOtpSent] = useState(false); // tracks if OTP was sent
const [userOtp, setUserOtp] = useState(''); // input value for OTP
const [generatedOtp, setGeneratedOtp] = useState(''); 
const [otpVerified, setOtpVerified] = useState(false); // marks OTP as verified
const [otpTimer, setOtpTimer] = useState(0); // countdown in seconds
const [resendVisible, setResendVisible] = useState(false); // show resend button

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  const provinces = ['Negros Occidental'];
  const citiesByProvince = { 'Negros Occidental': ['Bacolod City'] };
  const barangaysByCity = {
    'Bacolod City': [
      "Alangilan","Alijis","Banago","Barangay 1 (Poblacion)","Barangay 2 (Poblacion)","Barangay 3 (Poblacion)",
      "Barangay 4 (Poblacion)","Barangay 5 (Poblacion)","Barangay 6 (Poblacion)","Barangay 7 (Poblacion)",
      "Barangay 8 (Poblacion)","Barangay 9 (Poblacion)","Barangay 10 (Poblacion)","Barangay 11 (Poblacion)",
      "Barangay 12 (Poblacion)","Barangay 13 (Poblacion)","Barangay 14 (Poblacion)","Barangay 15 (Poblacion)",
      "Barangay 16 (Poblacion)","Barangay 17 (Poblacion)","Barangay 18 (Poblacion)","Barangay 19 (Poblacion)",
      "Barangay 20 (Poblacion)","Barangay 21 (Poblacion)","Barangay 22 (Poblacion)","Barangay 23 (Poblacion)",
      "Barangay 24 (Poblacion)","Barangay 25 (Poblacion)","Barangay 26 (Poblacion)","Barangay 27 (Poblacion)",
      "Barangay 28 (Poblacion)","Barangay 29 (Poblacion)","Barangay 30 (Poblacion)","Barangay 31 (Poblacion)",
      "Barangay 32 (Poblacion)","Barangay 33 (Poblacion)","Barangay 34 (Poblacion)","Barangay 35 (Poblacion)",
      "Barangay 36 (Poblacion)","Barangay 37 (Poblacion)","Barangay 38 (Poblacion)","Barangay 39 (Poblacion)",
      "Barangay 40 (Poblacion)","Barangay 41 (Poblacion)","Bata","Cabug","Estefanía","Felisa","Granada","Handumanan",
      "Mandalagan","Mansilingan","Montevista","Pahanocoy","Punta Taytay","Singcang-Airport","Sum-ag","Taculing",
      "Tangub","Villamonte","Vista Alegre"
    ],
  };

  const showAlert = (msg) => {
    setModalMessage(msg);
    setModalVisible(true);
  };

  React.useEffect(() => {
  let timer;
  if (otpTimer > 0) {
    timer = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
  } else if (otpTimer === 0 && otpSent) {
    setGeneratedOtp(''); // OTP invalid
    setResendVisible(true); // show resend
  }
  return () => clearTimeout(timer);
}, [otpTimer, otpSent]);

const handleSendOtp = async () => {
  try {
    if (!email) {
      alert('Please enter your email first.');
      return;
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otpCode);
    setOtpVerified(false); // reset verification
    setOtpSent(true);
    setOtpTimer(60); // start 60 seconds timer
    setResendVisible(false);

    console.log('Generated OTP:', otpCode);
    console.log('Sending OTP to:', email);

    const response = await fetch('http://192.168.8.116:3000/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        subject: 'Your OTP Code',
       text: `Good Day, Hi there,

Thank you for using E-Baligya! Your One-Time Password (OTP) for verification is:

🔐 OTP Code: ${otpCode}

This code is valid for 60 seconds only. Please do not share it with anyone.

If you did not request this code, please ignore this message.

Thank you,
The E-Baligya Team `,
      }),
    });

    const data = await response.json();
    console.log('Backend response:', data);

    if (!data.success) alert('Failed to send OTP.');

  } catch (err) {
    console.log('Error sending OTP:', err);
    alert('Error sending OTP: ' + err.message);
  }
};



const handleVerifyOtp = () => {
  if (!userOtp) {
    alert('Please enter the OTP.');
    return;
  }

  if (userOtp === generatedOtp && otpTimer > 0) {
    setOtpVerified(true);
    alert('OTP verified successfully!');
  } else if (otpTimer <= 0) {
    alert('OTP has expired. Please resend.');
  } else {
    alert('Invalid OTP. Please try again.');
  }
};





  const handleNext = () => {
    if (!businessName || !ownerName || !email || !phone || !password || !birthday || !gender) 
      return showAlert('Please fill in all fields before proceeding.');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showAlert('Please enter a valid email.');
    if (phone.length < 10 || !/^[0-9]+$/.test(phone)) return showAlert('Phone must be at least 10 digits.');
    if (password.length < 6) return showAlert('Password must be at least 6 characters long.');

    const age = new Date().getFullYear() - new Date(birthday).getFullYear();
    if (age < 18) return showAlert('You must be at least 18 years old.');

    if (!selectedProvince || !selectedCity || !selectedBarangay)
      return showAlert('Please complete province, city, and barangay.');

    if (!streetName) return showAlert('Please enter your street name.'); // ✅ NEW VALIDATION

    navigation.navigate('VendorSignupStep3', {
      businessType,        // from Step 1
      marketName,          // from Step 1
      latitude,            // from Step 1
      longitude,           // from Step 1
      govIDFront,          // from Step 1
      govIDBack,           // from Step 1
      businessPermit,      // from Step 1
      ocrFields,           // from Step 1 (PhilID OCR info)
      businessPermitNumber,// from Step 1 (Business Number)

      // Step 2 inputs
      businessName,
      ownerName,
      email,
      phone,
      password,
      birthday,
      gender,
      selectedProvince,
      selectedCity,
      selectedBarangay,
      streetName, // ✅ NEW PASSING
    });
  };

  return (
    <>
    <StatusBar hidden={false} />
<View style={styles.header}>
  <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
    <Text style={styles.backButtonText}>◀ Back</Text>
  </TouchableOpacity>
  <Text style={styles.headerTitle}>Vendor Registration</Text>
</View>

      <ScrollView contentContainerStyle={styles.container}>
        <ProgressSteps currentStep={currentStep} />

        <Text style={styles.title}>Personal Information</Text>

        <View style={styles.card}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>🏷 Business Type: <Text style={styles.infoValue}>{businessType}</Text></Text>
            <Text style={styles.infoText}>🏬 Market: <Text style={styles.infoValue}>{marketName}</Text></Text>
             {/* ---------- ADDED SCANNED DATA ---------- */}


  {businessPermitNumber && (
    <Text style={styles.infoText}>
      📝 Business Permit No.: <Text style={styles.infoValue}>{businessPermitNumber}</Text>
    </Text>
  )}

          </View>

          {/* --- INPUTS --- */}
          <TextInput style={styles.input} placeholder="Business Name" value={businessName} onChangeText={setBusinessName} />
          <TextInput style={styles.input} placeholder="Owner Name" value={ownerName} onChangeText={setOwnerName} />
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
{!otpSent ? (
  <TouchableOpacity style={styles.nextButton} onPress={handleSendOtp}>
    <Text style={styles.nextText}>Send OTP</Text>
  </TouchableOpacity>
) : (
  <>
    {!otpVerified ? (
      <>
        <TextInput
          style={styles.input}
          placeholder="Enter OTP"
          value={userOtp}
          onChangeText={setUserOtp}
          keyboardType="numeric"
        />
        <Text style={{ marginBottom: 6, color: '#64748b' }}>
          {otpTimer > 0 ? `Expires in ${otpTimer}s` : 'OTP expired'}
        </Text>

        <TouchableOpacity
          style={[styles.nextButton, { opacity: otpTimer > 0 ? 1 : 0.6 }]}
          onPress={handleVerifyOtp}
          disabled={otpTimer <= 0}
        >
          <Text style={styles.nextText}>Verify OTP</Text>
        </TouchableOpacity>

        {resendVisible && (
          <TouchableOpacity style={styles.nextButton} onPress={handleSendOtp}>
            <Text style={styles.nextText}>Resend OTP</Text>
          </TouchableOpacity>
        )}
      </>
    ) : (
      <View style={styles.verifiedContainer}>
        <Text style={styles.verifiedText}>OTP Verified</Text>
      </View>
    )}
  </>
)}



          <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

          {/* Birthdate */}
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
            <Text style={{ color: birthday ? '#111' : '#999' }}>Birthdate: {birthday || 'Select'}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={birthday ? new Date(birthday) : new Date()}
              mode="date"
              onChange={(e, d) => { setShowDatePicker(false); if (d) setBirthday(d.toISOString().split('T')[0]); }}
            />
          )}

          <Text style={styles.label}>Gender</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={gender} onValueChange={setGender}>
              <Picker.Item label="-- Select Gender --" value="" />
              <Picker.Item label="Male" value="Male" />
              <Picker.Item label="Female" value="Female" />
            </Picker>
          </View>

          <Text style={styles.label}>Province</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={selectedProvince} onValueChange={setSelectedProvince}>
              <Picker.Item label="-- Select Province --" value="" />
              {provinces.map((p, i) => (<Picker.Item key={i} label={p} value={p} />))}
            </Picker>
          </View>

          {selectedProvince && (
            <>
              <Text style={styles.label}>City</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={selectedCity} onValueChange={setSelectedCity}>
                  <Picker.Item label="-- Select City --" value="" />
                  {citiesByProvince[selectedProvince].map((c, i) => (<Picker.Item key={i} label={c} value={c} />))}
                </Picker>
              </View>
            </>
          )}

          {selectedCity && (
            <>
              <Text style={styles.label}>Barangay</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={selectedBarangay} onValueChange={setSelectedBarangay}>
                  <Picker.Item label="-- Select Barangay --" value="" />
                  {barangaysByCity[selectedCity].map((b, i) => (<Picker.Item key={i} label={b} value={b} />))}
                </Picker>
              </View>
            </>
          )}

          {/* ---------- STREET NAME (NEW) ---------- */}
          {selectedBarangay && (
            <TextInput
              style={styles.input}
              placeholder="Street Name"
              value={streetName}
              onChangeText={setStreetName}
            />
          )}

          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextText}>Next Step</Text>
          </TouchableOpacity>
        </View>

        {/* MODAL */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>⚠️ Attention</Text>
              <Text style={styles.modalMessage}>{modalMessage}</Text>
              <TouchableOpacity style={styles.modalButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </>
  );
};

export default VendorSignupStep2;

// ---------- EXTRA HEADER STYLES ----------
const styles = StyleSheet.create({
/* HEADER - SAME AS STEP 1 */
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

  // (rest are unchanged)
  container: { flexGrow: 1, padding: 20, backgroundColor: '#f1f5f9' },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 18, color: '#1e293b' },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 18, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  infoBox: { backgroundColor: '#eff6ff', padding: 14, borderRadius: 12, marginBottom: 16 },
  infoText: { fontSize: 14, color: '#334155', marginBottom: 6, fontWeight: '500' },
  infoValue: { fontWeight: '700', color: '#1d4ed8' },
  input: { borderWidth: 1, borderColor: '#d1d5db', padding: 14, borderRadius: 12, marginBottom: 12, backgroundColor: '#fff' },
  dateInput: { borderWidth: 1, borderColor: '#d1d5db', padding: 14, borderRadius: 12, marginBottom: 12, backgroundColor: '#fff' },
  label: { fontWeight: '600', marginBottom: 4, color: '#1e293b' },
  pickerWrapper: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, marginBottom: 16 },
  nextButton: { backgroundColor: '#2563EB', padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 6, marginBottom: 10 },
  nextText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  stepWrapper: { alignItems: 'center', width: 90 },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  circleText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  stepLabel: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  line: { height: 3, flex: 1, marginHorizontal: 6, borderRadius: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 30 },
  modalContainer: { backgroundColor: '#fff', padding: 24, borderRadius: 22, alignItems: 'center', elevation: 7 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#d97706', marginBottom: 10 },
  modalMessage: { fontSize: 16, color: '#334155', textAlign: 'center', marginBottom: 20 },
  modalButton: { backgroundColor: '#2563EB', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14 },
  modalButtonText: { color: '#fff', fontWeight: '700' },
  verifiedContainer: {backgroundColor: '#d1fae5', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, marginBottom: 10 },
});
