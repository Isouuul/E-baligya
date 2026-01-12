// src/screens/vendor/ChatScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

const dummyMessages = [
  { id: "1", text: "Hello! How can I help you?", sender: "vendor" },
  { id: "2", text: "Hi! I’m interested in your product.", sender: "user" },
  { id: "3", text: "Great! Do you have any questions?", sender: "vendor" },
];

const ChatScreen = ({ route }) => {
  const { chatWithUserName } = route.params || { chatWithUserName: "User" };
  const [messages, setMessages] = useState(dummyMessages);
  const [newMessage, setNewMessage] = useState("");

  const handleSend = () => {
    if (newMessage.trim() === "") return;

    const newMsg = { id: Date.now().toString(), text: newMessage, sender: "user" };
    setMessages((prev) => [...prev, newMsg]);
    setNewMessage("");
  };

  const renderItem = ({ item }) => {
    const isUser = item.sender === "user";
    return (
      <View style={[styles.messageContainer, isUser ? styles.userMsg : styles.vendorMsg]}>
        <Text style={[styles.messageText, isUser ? styles.userText : styles.vendorText]}>
          {item.text}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F9FAFB" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{chatWithUserName}</Text>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10 }}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={{ color: "#fff", fontWeight: "bold" }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#1e3a8a",
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  messageContainer: {
    maxWidth: "75%",
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  userMsg: {
    backgroundColor: "#1e3a8a",
    alignSelf: "flex-end",
  },
  vendorMsg: {
    backgroundColor: "#E5E7EB",
    alignSelf: "flex-start",
  },
  messageText: { fontSize: 14 },
  userText: { color: "#fff" },
  vendorText: { color: "#111" },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
  },
  input: {
    flex: 1,
    padding: 10,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: "#1e3a8a",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
});
