import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const TermsPolicyScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Policy</Text>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Terms of Service</Text>
          <Text style={styles.paragraph}>
            Welcome to AgriFishery! By using our app, you agree to comply with and be bound by the following terms and conditions...
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy Policy</Text>
          <Text style={styles.paragraph}>
            We value your privacy. Any information collected will be used solely for providing and improving our services...
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>User Responsibilities</Text>
          <Text style={styles.paragraph}>
            Users are responsible for maintaining the confidentiality of their accounts, using the app legally, and not engaging in prohibited activities...
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Reporting and Penalties</Text>
          <Text style={styles.paragraph}>• 1 verified report — 12-hour temporary login restriction.</Text>
          <Text style={styles.paragraph}>• 2 verified reports — 2-day account suspension.</Text>
          <Text style={styles.paragraph}>• 3 verified reports — 5-day account suspension.</Text>
          <Text style={styles.paragraph}>• 5 verified reports — 7-day account suspension.</Text>
          <Text style={styles.paragraph}>• 7 verified reports — permanent ban.</Text>

          <Text style={[styles.paragraph, { marginTop: 10 }]}>
            Appeals may be filed through the Help Center with proper evidence. All safety decisions undergo review.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            AgriFishery is not liable for damages or losses resulting from the use of this app, including but not limited to data loss or service interruptions...
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.paragraph}>
            For any concerns, contact us via Help Center or Chat with AgriFishery.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default TermsPolicyScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },

  /** Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    backgroundColor: '#2563eb',
    elevation: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 15,
  },

  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  /** Card Style (Matches Me.js Sections) */
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },

  paragraph: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 5,
  },
});
