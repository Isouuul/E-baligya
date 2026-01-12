import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const HelpCenterScreen = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState(null);
  const navigation = useNavigation();
  const db = getFirestore();

  // Fetch FAQs from Firestore
  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'HelpCenter'));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFaqs(data);
      } catch (error) {
        console.error('Error fetching FAQs:', error);
        Alert.alert('Error', 'Failed to load FAQs');
      } finally {
        setLoading(false);
      }
    };
    fetchFaqs();
  }, []);

  // Filtered FAQs based on search
  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Submit ticket (dummy for now)
  const handleSubmitTicket = () => {
    navigation.navigate('SubmitTicketScreen');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Help Center</Text>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search FAQs..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* FAQs List */}
      {filteredFaqs.map((faq, index) => (
        <TouchableOpacity
          key={faq.id}
          style={styles.faqItem}
          onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
        >
          <View style={styles.faqHeader}>
            <Text style={styles.question}>{faq.question}</Text>
            <Ionicons
              name={expandedIndex === index ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={20}
              color="#2563eb"
            />
          </View>
          {expandedIndex === index && <Text style={styles.answer}>{faq.answer}</Text>}
        </TouchableOpacity>
      ))}

      {/* Submit Ticket Button */}
      <TouchableOpacity style={styles.ticketButton} onPress={handleSubmitTicket}>
        <Text style={styles.ticketButtonText}>Submit a Support Ticket</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default HelpCenterScreen;

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20, color: '#111827' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', padding: 10, borderRadius: 10, marginBottom: 20 },
  searchInput: { marginLeft: 10, flex: 1, fontSize: 16 },
  faqItem: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 10, elevation: 2 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  question: { fontSize: 16, fontWeight: '600', color: '#111827' },
  answer: { marginTop: 10, fontSize: 14, color: '#6b7280' },
  ticketButton: { marginTop: 20, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  ticketButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
