// src/screens/Users/HelpCenter.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function HelpCenter() {
  const navigation = useNavigation();
  const [expandedIndex, setExpandedIndex] = useState(null); // Track which FAQ is open

  const faqs = [
    {
      question: 'How do I place an order?',
      answer: 'Go to the Product Screen, select the items, and proceed to checkout.',
      action: () => navigation.navigate('ProductScreen'),
    },
    {
      question: 'How can I track my orders?',
      answer: 'Go to the Orders section in your profile to view the status of your orders.',
      action: () => navigation.navigate('OrdersDetails'),
    },
    {
      question: 'How do I edit my profile?',
      answer: 'Go to your profile and tap "Edit Profile" to update your information.',
      action: () => navigation.navigate('EditUserProfile'),
    },
    {
      question: 'How can I participate in bidding?',
      answer: 'Go to the Bidding Screen to place or view your bids.',
      action: () => navigation.navigate('MyBids'),
    },
    {
      question: 'How can I contact support?',
      answer: 'Use the "Chat with AgriFishery" option in the Support section of your profile.',
      action: () => navigation.navigate('SupportChat'),
    },
    {
      question: 'How do I report a product or shop?',
      answer: 'Go to the Product Screen or View Shop and tap the "Report" button to submit a report.',
      action: () => navigation.navigate('ReportScreen'),
    },
  ];

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {faqs.map((faq, index) => (
          <TouchableOpacity
            key={index}
            style={styles.faqCard}
            onPress={() => toggleExpand(index)}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.question}>{faq.question}</Text>
              <Ionicons
                name={expandedIndex === index ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={20}
                color="#2563eb"
              />
            </View>
            {expandedIndex === index && (
              <TouchableOpacity onPress={faq.action}>
                <Text style={styles.answer}>{faq.answer}</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}

        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Need more help?</Text>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => navigation.navigate('SupportChat')}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={22}
              color="#fff"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.contactButtonText}>Chat with Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  header: {
    height: 60,
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 15,
  },
  scrollContainer: {
    padding: 20,
  },
  faqCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  question: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  answer: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 10,
    paddingLeft: 5,
  },
  contactSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  contactButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
