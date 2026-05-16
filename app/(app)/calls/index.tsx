import React, { useState, useEffect } from "react";
import { FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { View, Text } from "../../../src/components/Themed";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../../../src/components/common/Avatar";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { COLORS } from "../../../src/utils/constants";
import { useAuthStore } from "../../../src/store/authStore";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDoc,
  doc,
} from "@react-native-firebase/firestore";
import { Call } from "../../../src/types/call";
import { UserProfile } from "../../../src/types/user";
import {
  formatConversationTime,
  formatDuration,
} from "../../../src/utils/formatTime";

export default function CallsScreen() {
  const { user } = useAuthStore();
  const [calls, setCalls] = useState<(Call & { otherUser?: UserProfile })[]>(
    [],
  );

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(getFirestore(), "calls"),
      where("callerId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(50),
    );

    const unsub = onSnapshot(q, async (snap) => {
      if (!snap || !snap.docs) {
        setCalls([]);
        return;
      }
      const rawCalls = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Call[];
      const enriched = await Promise.all(
        rawCalls.map(async (c) => {
          const otherUid =
            c.callerId === user.uid ? c.receiverIds[0] : c.callerId;
          const docSnap = await getDoc(doc(getFirestore(), "users", otherUid));
          const otherUser = docSnap.exists()
            ? ({ uid: otherUid, ...docSnap.data() } as UserProfile)
            : undefined;
          return { ...c, otherUser };
        }),
      );
      setCalls(enriched);
    });
    return () => unsub();
  }, [user]);

  const renderCall = ({
    item,
  }: {
    item: Call & { otherUser?: UserProfile };
  }) => {
    const isOutgoing = item.callerId === user?.uid;
    const isMissed = item.status === "missed" && !isOutgoing;
    const name =
      item.otherUser?.displayName ?? item.otherUser?.username ?? "Unknown";

    return (
      <TouchableOpacity style={styles.callRow} activeOpacity={0.7}>
        <Avatar uri={item.otherUser?.photoURL} name={name} size="md" />
        <View style={styles.callInfo}>
          <Text style={styles.callName}>{name}</Text>
          <View style={styles.callMeta}>
            <Text style={[styles.callDir, isMissed && styles.missed]}>
              {isOutgoing ? "↗ " : "↘ "}
              {item.type === "voice" ? "Voice" : "Video"} call
            </Text>
            {!!item.duration && (
              <Text style={styles.callDuration}>
                {" "}
                · {formatDuration(item.duration)}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.callRight}>
          <Text style={styles.callTime}>
            {formatConversationTime(item.createdAt)}
          </Text>
          <Text style={styles.callTypeIcon}>
            {item.type === "voice" ? "📞" : "📹"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Calls</Text>
      {calls.length === 0 ? (
        <EmptyState
          icon="📞"
          title="No calls yet"
          subtitle="Start a voice or video call from any conversation."
        />
      ) : (
        <FlatList
          data={calls}
          keyExtractor={(item) => item.id}
          renderItem={renderCall}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          windowSize={5}
          maxToRenderPerBatch={10}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { fontSize: 24, fontWeight: "800", padding: 16 },
  callRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  callInfo: { flex: 1 },
  callName: { fontSize: 16, fontWeight: "600" },
  callMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  callDir: { fontSize: 13, color: COLORS.textSecondary },
  missed: { color: COLORS.error },
  callDuration: { fontSize: 13, color: COLORS.textSecondary },
  callRight: { alignItems: "flex-end", gap: 6 },
  callTime: { fontSize: 12, color: COLORS.textSecondary },
  callTypeIcon: { fontSize: 18 },
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: 78 },
});
