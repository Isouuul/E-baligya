import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { auth, db } from "../../firebase";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

export default function ChatScreen({ route, navigation }) {
  const { vendorId } = route.params;
  const userId = auth.currentUser.uid;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [vendorProfile, setVendorProfile] = useState({
    businessName: "Unknown Vendor",
    profileImage: null,
  });

  const [currentUserProfile, setCurrentUserProfile] = useState({
    profileImage: null,
  });

  const flatListRef = useRef();
  const chatId = userId < vendorId ? `${userId}_${vendorId}` : `${vendorId}_${userId}`;
  const messagesRef = collection(db, "Chats", chatId, "messages");

  // -----------------------------
  // Fetch Vendor Profile
  // -----------------------------
  const fetchVendorProfile = async () => {
    try {
      const userSnap = await getDoc(doc(db, "Users", vendorId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        setVendorProfile({
          businessName:
            data.businessName ||
            `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
            "Unknown Vendor",
          profileImage: data.profileImage || data.selfieImage || null,
        });
        return;
      }

      const vendorQuery = query(collection(db, "ApprovedVendors"));
      const vendorSnap = await getDocs(vendorQuery);
      const vendorDoc = vendorSnap.docs.find((d) => d.data().userId === vendorId);
      if (vendorDoc) {
        const data = vendorDoc.data();
        setVendorProfile({
          businessName: data.businessName || "Unknown Vendor",
          profileImage: data.profileImage || data.selfie || null,
        });
      }
    } catch (err) {
      console.log("Error fetching vendor profile:", err);
    }
  };

  // -----------------------------
  // Fetch Current User Profile
  // -----------------------------
  const fetchCurrentUserProfile = async () => {
    try {
      const userSnap = await getDoc(doc(db, "Users", userId));
      if (userSnap.exists()) {
        const data = userSnap.data();
        setCurrentUserProfile({
          profileImage: data.profileImage || null,
        });
      }
    } catch (err) {
      console.log("Error fetching current user profile:", err);
    }
  };

  // -----------------------------
  // Real-time messages
  // -----------------------------
  useEffect(() => {
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setMessages(msgs);
      flatListRef.current?.scrollToEnd({ animated: true });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchVendorProfile();
    fetchCurrentUserProfile();
  }, []);

  // -----------------------------
  // Send message
  // -----------------------------
  const sendMessage = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const msgText = text.trim();
    setText("");

    try {
      await setDoc(
        doc(db, "Chats", chatId),
        {
          participants: [userId, vendorId],
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );

      await addDoc(messagesRef, {
        senderId: userId,
        text: msgText,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.log("Send error:", err);
    }

    setSending(false);
  };

  // -----------------------------
  // Render message
  // -----------------------------
  const renderMessage = ({ item }) => {
    const isMe = item.senderId === userId;
    return (
      <View
        style={[
          styles.messageRow,
          isMe ? styles.myMessageRow : styles.theirMessageRow,
        ]}
      >
        {!isMe && vendorProfile.profileImage && (
          <Image source={{ uri: vendorProfile.profileImage }} style={styles.avatar} />
        )}

        <View
          style={[
            styles.messageBubble,
            isMe ? styles.myMessage : styles.theirMessage,
          ]}
        >
          <Text style={isMe ? styles.myMessageText : styles.theirMessageText}>
            {item.text}
          </Text>
        </View>

        {isMe && currentUserProfile.profileImage && (
          <Image
            source={{
              uri: currentUserProfile.profileImage.startsWith("http")
                ? currentUserProfile.profileImage
                : `data:image/jpeg;base64,${currentUserProfile.profileImage}`,
            }}
            style={styles.avatar}
          />
        )}
      </View>
    );
  };

  // -----------------------------
  // Archive chat
  // -----------------------------
  const archiveChat = async () => {
    Alert.alert(
      "Archive Chat",
      "Are you sure you want to archive this chat?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: async () => {
            try {
              const msgsSnapshot = await getDocs(messagesRef);
              if (!msgsSnapshot.empty) {
                const archivedRef = collection(db, "Archived_Chats", chatId, "messages");

                msgsSnapshot.docs.forEach(async (docSnap) => {
                  await setDoc(doc(archivedRef, docSnap.id), docSnap.data());
                  await deleteDoc(doc(db, "Chats", chatId, "messages", docSnap.id));
                });

                await deleteDoc(doc(db, "Chats", chatId));
                alert("Chat archived successfully!");
                navigation.goBack();
              }
            } catch (err) {
              console.log("Archive error:", err);
              alert("Failed to archive chat.");
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={28} color="#fff" />
        </TouchableOpacity>

        {vendorProfile.profileImage ? (
          <Image
            source={{ uri: vendorProfile.profileImage }}
            style={styles.headerAvatar}
          />
        ) : (
          <View style={styles.headerAvatarPlaceholder}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {vendorProfile.businessName?.[0] || "V"}
            </Text>
          </View>
        )}

        <Text style={styles.headerName}>{vendorProfile.businessName}</Text>

        <TouchableOpacity onPress={archiveChat}>
          <Image
            source={require("../../../assets/Trash.png")}
            style={{ width: 28, height: 28, marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={`Message ${vendorProfile.businessName}`}
            value={text}
            onChangeText={setText}
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={sendMessage}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    margin: 8,
  },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginHorizontal: 8 },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6B7280",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
  },
  headerName: { color: "#fff", fontWeight: "700", fontSize: 16, flex: 1 },

  inputContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendText: { color: "#fff", fontWeight: "bold" },

  messageRow: { flexDirection: "row", alignItems: "flex-end", marginVertical: 4 },
  myMessageRow: { justifyContent: "flex-end" },
  theirMessageRow: { justifyContent: "flex-start" },

  messageBubble: { maxWidth: "70%", padding: 10, borderRadius: 12 },
  myMessage: { backgroundColor: "#3B82F6", borderTopRightRadius: 0 },
  theirMessage: { backgroundColor: "#E5E7EB", borderTopLeftRadius: 0 },

  myMessageText: { color: "#fff" },
  theirMessageText: { color: "#111827" },

  avatar: { width: 36, height: 36, borderRadius: 18, marginHorizontal: 6 },
});
