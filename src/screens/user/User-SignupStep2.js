import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import Locations from './Locations.json';

// Small reusable progress indicator (3 steps)
const ProgressSteps = ({ currentStep = 2 }) => {
  const steps = ['Step 1', 'Step 2', 'Review'];
  return (
    <View style={progressStyles.progressContainer}>
      {steps.map((label, idx) => {
        const stepNumber = idx + 1;
        const completed = stepNumber < currentStep;
        const active = stepNumber === currentStep;
        const circleColor = completed || active ? '#1d4ed8' : '#cbd5e1';
        const lineColor = currentStep > stepNumber ? '#1d4ed8' : '#e2e8f0';

        return (
          <React.Fragment key={idx}>
            <View style={progressStyles.stepWrapper}>
              <View style={[progressStyles.circle, { backgroundColor: circleColor }]}>
                <Text style={progressStyles.circleText}>{stepNumber}</Text>
              </View>
              <Text style={progressStyles.stepLabel}>{label}</Text>
            </View>
            {idx !== steps.length - 1 && (
              <View style={[progressStyles.line, { backgroundColor: lineColor }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const SignupStep2 = ({ route, navigation }) => {
  const { selectedIDType, idImage, selfieImage } = route.params;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthdate, setBirthdate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('');

  const [otpSent, setOtpSent] = useState(false);
const [userOtp, setUserOtp] = useState('');
const [generatedOtp, setGeneratedOtp] = useState('');
const [otpVerified, setOtpVerified] = useState(false);
const [otpTimer, setOtpTimer] = useState(0);
const [resendVisible, setResendVisible] = useState(false);


  const region = 'Region VI - Western Visayas';
  const [city, setCity] = useState('');
  const [barangay, setBarangay] = useState('');
  const [street, setStreet] = useState('');

  const cities = Object.keys(Locations);


  const handleNext = () => {
    if (!email || !password || !confirmPassword || !firstName || !middleName || !lastName || !gender || !birthdate || !city || !barangay || !street) {
      Alert.alert('Error', 'Please fill out all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    navigation.navigate('SignupReview', {
      selectedIDType,
      idImage,
      selfieImage,
      email,
      password,
      firstName,
      middleName,
      lastName,
      birthdate: birthdate.toISOString().split('T')[0],
      gender,
      address: { region, city, barangay, street },
    });
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

    const response = await fetch('http://10.0.1.214:3000/send-email', {
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


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <ProgressSteps currentStep={route?.params?.currentStep || 2} />
        <Text style={styles.title}>Personal Information</Text>
        <View style={styles.card}>
          {/* Credentials */}
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

          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {/* Name */}
          <TextInput style={styles.input} placeholder="First Name" value={firstName} onChangeText={setFirstName} />
          <TextInput style={styles.input} placeholder="Middle Name" value={middleName} onChangeText={setMiddleName} />
          <TextInput style={styles.input} placeholder="Last Name" value={lastName} onChangeText={setLastName} />

          {/* Birthdate */}
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateInput}>
            <Text>Birthdate: {birthdate.toDateString()}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={birthdate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(e, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setBirthdate(date);
              }}
            />
          )}

          {/* Gender */}
          <Text style={styles.label}>Gender:</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={gender} onValueChange={setGender}>
              <Picker.Item label="Select Gender" value="" />
              <Picker.Item label="Male" value="Male" />
              <Picker.Item label="Female" value="Female" />
              <Picker.Item label="Other" value="Other" />
            </Picker>
          </View>

          {/* Region */}
          <Text style={styles.label}>Region:</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={region} enabled={false}>
              <Picker.Item label={region} value={region} />
            </Picker>
          </View>

          {/* City */}
          <Text style={styles.label}>City:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={city}
              onValueChange={(val) => {
                setCity(val);
                setBarangay('');
                setStreet('');
              }}
            >
              <Picker.Item label="Select City" value="" />
              {cities.map((c) => (
                <Picker.Item key={c} label={c} value={c} />
              ))}
            </Picker>
          </View>

          {/* Barangay */}
          {city && Locations[city] && (
            <>
              <Text style={styles.label}>Barangay:</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={barangay} onValueChange={setBarangay}>
                  <Picker.Item label="Select Barangay" value="" />
                  {Locations[city].map((b) => (
                    <Picker.Item key={b} label={b} value={b} />
                  ))}
                </Picker>
              </View>
            </>
          )}

          {/* Street */}
          {barangay && (
            <>
              <Text style={styles.label}>Street / Block / House No:</Text>
              <TextInput
                style={styles.input}
                placeholder="Street / Block / House No"
                value={street}
                onChangeText={setStreet}
              />
            </>
          )}

          {/* Next button */}
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextText}>Review & Submit</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignupStep2;

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#f0f4f8' },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, elevation: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 14, borderRadius: 10, marginBottom: 12 },
  dateInput: { borderWidth: 1, borderColor: '#ddd', padding: 14, borderRadius: 10, marginBottom: 12 },
  label: { fontWeight: '500', marginTop: 10, marginBottom: 8 },
  pickerWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, marginBottom: 12 },
  nextButton: { backgroundColor: '#1e90ff', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  nextText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

const progressStyles = StyleSheet.create({
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  stepWrapper: { alignItems: 'center', width: 80 },
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  circleText: { color: '#fff', fontWeight: '700' },
  stepLabel: { marginTop: 6, fontSize: 12, color: '#475569', textAlign: 'center' },
  line: { height: 4, flex: 1, marginHorizontal: 6, borderRadius: 2 },
});
