// src/screens/Vendor/VendorDashboardScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export default function VendorDashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);

  // Orders
  const [totalPendingOrders, setTotalPendingOrders] = useState(0);
  const [totalPreparingOrders, setTotalPreparingOrders] = useState(0);
  const [totalToDeliverOrders, setTotalToDeliverOrders] = useState(0);
  const [totalCompletedOrders, setTotalCompletedOrders] = useState(0);

  const [totalPendingQty, setTotalPendingQty] = useState(0);
  const [totalPreparingQty, setTotalPreparingQty] = useState(0);
  const [totalToDeliverQty, setTotalToDeliverQty] = useState(0);
  const [totalCompletedQty, setTotalCompletedQty] = useState(0);

  const [totalSales, setTotalSales] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [topCategories, setTopCategories] = useState([]);

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const db = getFirestore();

    const listenOrders = (status, setOrders, setQty, calculateAnalytics = false) => {
      const colName = status === "Complete" ? "Completed_Orders" : "Orders";
      const ordersRef = status === "Complete"
        ? collection(db, "Completed_Orders")
        : collection(db, "Orders");

      const q = query(ordersRef, where("vendorId", "==", user.uid));
      return onSnapshot(q, (snapshot) => {
        let ordersCount = 0;
        let quantityCount = 0;
        let salesCount = 0;
        const productCount = {};
        const categoryCount = {};

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        snapshot.forEach((doc) => {
          const order = doc.data();
          if (order.status !== status) return; // filter by status
          ordersCount += 1;
          order.items?.forEach((item) => {
            const qty = item.quantity || 0;
            quantityCount += qty;
            if (calculateAnalytics) salesCount += qty * (item.price || 0);

            // Top products
            if (calculateAnalytics) {
              const name = item.productName || "Unknown";
              productCount[name] = (productCount[name] || 0) + qty;

              const category = item.category || "Unknown";
              categoryCount[category] = (categoryCount[category] || 0) + qty;
            }
          });
        });

        setOrders(ordersCount);
        setQty(quantityCount);

        if (status === "Complete" && calculateAnalytics) {
          setTotalSales(salesCount);

          // Monthly sales
          let monthSales = 0;
          snapshot.forEach((doc) => {
            const order = doc.data();
            if (order.status !== "Complete") return;
            const orderDate = order.createdAt?.toDate?.() || new Date();
            if (orderDate >= thirtyDaysAgo) {
              order.items?.forEach(item => monthSales += (item.price || 0) * (item.quantity || 0));
            }
          });
          setMonthlySales(monthSales);

          // Top 3 products
          const sortedProducts = Object.entries(productCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, quantity]) => ({ name, quantity }));
          setTopProducts(sortedProducts);

          // Top 3 categories
          const sortedCategories = Object.entries(categoryCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([category, quantity]) => ({ category, quantity }));
          setTopCategories(sortedCategories);
        }

        setLoading(false);
      });
    };

    const unsubPending = listenOrders("Pending", setTotalPendingOrders, setTotalPendingQty);
    const unsubPreparing = listenOrders("Preparing", setTotalPreparingOrders, setTotalPreparingQty);
    const unsubToDeliver = listenOrders("To Deliver", setTotalToDeliverOrders, setTotalToDeliverQty);
    const unsubCompleted = listenOrders("Complete", setTotalCompletedOrders, setTotalCompletedQty, true);

    return () => {
      unsubPending();
      unsubPreparing();
      unsubToDeliver();
      unsubCompleted();
    };
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const totalItemsSold = totalCompletedQty;

  return (
    <>
      <StatusBar hidden={true} />
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Vendor Dashboard</Text>
          <View style={styles.iconGroup}>
            <TouchableOpacity
              style={styles.iconButtonBg}
              onPress={() => navigation.navigate("VendorNotifications")}
            >
              <Ionicons name="notifications-outline" size={26} color="#fff" />
            </TouchableOpacity>

          </View>
        </View>

        {/* Analytics */}
        <View style={styles.analyticsSection}>
          <Text style={styles.analyticsTitle}>📊 Analytics</Text>

          {/* Monthly Sales */}
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsCardTitle}>Monthly Sales</Text>
            <Text style={styles.analyticsCardValue}>₱ {monthlySales.toFixed(2)}</Text>
          </View>

          {/* Top Products */}
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsCardTitle}>Top Selling Products</Text>
            {topProducts.length === 0 ? (
              <Text style={styles.analyticsCardValue}>No sales yet</Text>
            ) : (
              topProducts.map((item, idx) => (
                <Text key={idx} style={styles.analyticsCardValue}>
                  {idx + 1}. {item.name} ({item.quantity})
                </Text>
              ))
            )}
          </View>

          {/* Top Categories */}
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsCardTitle}>Top Selling Categories</Text>
            {topCategories.length === 0 ? (
              <Text style={styles.analyticsCardValue}>No sales yet</Text>
            ) : (
              topCategories.map((item, idx) => (
                <Text key={idx} style={styles.analyticsCardValue}>
                  {idx + 1}. {item.category} ({item.quantity})
                </Text>
              ))
            )}
          </View>

          {/* Orders Breakdown */}
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsCardTitle}>Orders Breakdown</Text>
            {[
              { label: "Pending", value: totalPendingOrders, color: "#6b7280" },
              { label: "Preparing", value: totalPreparingOrders, color: "#3b82f6" },
              { label: "To Deliver", value: totalToDeliverOrders, color: "#f97316" },
              { label: "Completed", value: totalCompletedOrders, color: "#10b981" },
            ].map((item, idx) => {
              const total = totalPendingOrders + totalPreparingOrders + totalToDeliverOrders + totalCompletedOrders;
              const widthPercent = total === 0 ? 0 : (item.value / total) * 100;
              return (
                <View key={idx} style={{ marginVertical: 4 }}>
                  <Text style={styles.analyticsCardValue}>{item.label}: {item.value}</Text>
                  <View style={{ height: 10, backgroundColor: "#e5e7eb", borderRadius: 5, overflow: "hidden" }}>
                    <View style={{ width: `${widthPercent}%`, height: "100%", backgroundColor: item.color }} />
                  </View>
                </View>
              );
            })}
          </View>

          {/* Total Items Sold */}
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsCardTitle}>Total Items Sold</Text>
            <Text style={styles.analyticsCardValue}>{totalItemsSold}</Text>
          </View>

          {/* Total Orders & Total Sales */}
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsCardTitle}>Total Orders</Text>
            <Text style={styles.analyticsCardValue}>
              {totalPendingOrders + totalPreparingOrders + totalToDeliverOrders + totalCompletedOrders}
            </Text>
            <Text style={[styles.analyticsCardTitle, { marginTop: 8 }]}>Total Sales</Text>
            <Text style={styles.analyticsCardValue}>₱ {totalSales.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },

  /** Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 14,
    backgroundColor: "#1e3a8a",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  iconGroup: { flexDirection: "row" },
  iconButtonBg: {
    marginLeft: 12,
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
  },

  /** Analytics Section */
  analyticsSection: { marginTop: 20, paddingHorizontal: 20 },
  analyticsTitle: { fontSize: 18, fontWeight: "700", color: "#2563eb", marginBottom: 10 },
  analyticsCard: { backgroundColor: "#fff", padding: 15, borderRadius: 15, marginBottom: 10, elevation: 3 },
  analyticsCardTitle: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 6 },
  analyticsCardValue: { fontSize: 15, fontWeight: "500", color: "#1e3a8a" },
});
