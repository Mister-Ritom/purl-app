import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { auth } from 'firebase-functions/v1';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

admin.initializeApp();
const db = admin.firestore();

// ─── Secrets (set via: firebase functions:secrets:set AGORA_APP_ID) ──────────
const AGORA_APP_ID = defineSecret('AGORA_APP_ID');
const AGORA_APP_CERTIFICATE = defineSecret('AGORA_APP_CERTIFICATE');

// ─── Token expiry: 1 hour ──────────────────────────────────────────────────
const TOKEN_EXPIRY_S = 3600;

// ─── Hash uid to a stable Agora numeric uid ───────────────────────────────
function hashUidToNumber(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    const char = uid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── 1. generateAgoraToken ─────────────────────────────────────────────────
export const generateAgoraToken = onCall(
  { secrets: [AGORA_APP_ID, AGORA_APP_CERTIFICATE], invoker: 'public', minInstances: 1 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { channelName, uid } = request.data as { channelName?: string; uid?: string };
    if (!channelName || !uid) {
      throw new HttpsError('invalid-argument', 'channelName and uid are required');
    }

    const appId = AGORA_APP_ID.value();
    const certificate = AGORA_APP_CERTIFICATE.value();

    if (!appId || !certificate) {
      throw new HttpsError('internal', 'Agora credentials not configured');
    }

    const expireTs = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_S;
    const agoraUid = hashUidToNumber(uid);
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      certificate,
      channelName,
      agoraUid,
      RtcRole.PUBLISHER,
      expireTs
    );

    // Store token on the call document if it exists
    const callSnap = await db
      .collection('calls')
      .where('channelName', '==', channelName)
      .limit(1)
      .get();
    if (!callSnap.empty) {
      await callSnap.docs[0].ref.update({ agoraToken: token });
    }

    return { token, uid: agoraUid, expiresAt: expireTs };
  }
);

// ─── 2. initiateCall ────────────────────────────────────────────────────────
export const initiateCall = onCall(
  { secrets: [AGORA_APP_ID, AGORA_APP_CERTIFICATE], invoker: 'public', minInstances: 1 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { receiverIds, type } = request.data as { receiverIds: string[]; type: 'voice' | 'video' };
    if (!receiverIds || !receiverIds.length || !type) {
      throw new HttpsError('invalid-argument', 'receiverIds and type are required');
    }

    const callerId = request.auth.uid;
    const appId = AGORA_APP_ID.value();
    const certificate = AGORA_APP_CERTIFICATE.value();

    if (!appId || !certificate) {
      throw new HttpsError('internal', 'Agora credentials not configured');
    }

    const callRef = db.collection('calls').doc();
    const callId = callRef.id;
    const channelName = callId;

    const expireTs = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_S;

    // Pre-generate tokens for all participants in one shot.
    // This means the receiver never needs a second Cloud Function call.
    const agoraTokens: Record<string, string> = {};
    for (const uid of [callerId, ...receiverIds]) {
      agoraTokens[uid] = RtcTokenBuilder.buildTokenWithUid(
        appId,
        certificate,
        channelName,
        hashUidToNumber(uid),
        RtcRole.PUBLISHER,
        expireTs
      );
    }

    const callerDoc = await db.collection('users').doc(callerId).get();
    const callerData = callerDoc.data();

    await callRef.set({
      id: callId,
      callerId,
      receiverIds,
      type,
      status: 'ringing',
      channelName,
      agoraToken: agoraTokens[callerId],  // legacy field for compatibility
      agoraTokens,                         // per-uid map — receivers use this directly
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      callerUsername: callerData?.username ?? callerData?.displayName ?? 'Someone',
      callerPhotoURL: callerData?.photoURL ?? '',
    });

    return { callId, agoraToken: agoraTokens[callerId] };
  }
);

// ─── 2. createInviteKey ───────────────────────────────────────────────────
export const createInviteKey = onCall({ invoker: 'public' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const uid = request.auth.uid;
  const { type, maxUses, expiryDays, label } = request.data as {
    type: 'single' | 'multi' | 'permanent';
    maxUses?: number;
    expiryDays?: number;
    label?: string;
  };

  // Generate a unique token
  const generateToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${part()}-${part()}-${part()}`;
  };

  let token = generateToken();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.collection('inviteTokenIndex').doc(token).get();
    if (!existing.exists) break;
    token = generateToken();
    attempts++;
  }

  const expiresAt = expiryDays ? admin.firestore.Timestamp.fromDate(new Date(Date.now() + expiryDays * 86400000)) : null;
  const usesAllowed = type === 'single' ? 1 : type === 'multi' ? (maxUses || 5) : 999999;

  const keyRef = db.collection('users').doc(uid).collection('inviteKeys').doc();
  const keyId = keyRef.id;

  const batch = db.batch();

  // 1. User's personal key list
  batch.set(keyRef, {
    id: keyId,
    token,
    label: label || '',
    type,
    usesAllowed,
    usesConsumed: 0,
    expiresAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    isActive: true,
    usedBy: [],
  });

  // 2. Global index for redemption
  batch.set(db.collection('inviteTokenIndex').doc(token), {
    uid,
    keyId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { success: true, token, keyId };
});

// Deprecated: keeping for compatibility during migration
export const registerInviteKey = onCall({ invoker: 'public' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const { token, keyId } = request.data as { token?: string; keyId?: string };
  if (!token || !keyId) throw new HttpsError('invalid-argument', 'Missing params');
  
  await db.collection('inviteTokenIndex').doc(token).set({
    uid: request.auth.uid,
    keyId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});

// ─── 3. redeemInviteKey ───────────────────────────────────────────────────
export const redeemInviteKey = onCall({ invoker: 'public' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const callerUid = request.auth.uid;
  const { token } = request.data as { token?: string };

  if (!token || !/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(token)) {
    throw new HttpsError('invalid-argument', 'Invalid token format');
  }

  // Look up token → owner
  const registryDoc = await db.collection('inviteTokenIndex').doc(token).get();
  if (!registryDoc.exists) {
    throw new HttpsError('not-found', 'Invite key not found');
  }

  const registryData = registryDoc.data();
  if (!registryData) throw new HttpsError('not-found', 'Invite key not found');

  const { uid: ownerUid, keyId } = registryData as { uid: string; keyId: string };

  if (ownerUid === callerUid) {
    throw new HttpsError('failed-precondition', 'You cannot redeem your own key');
  }

  // Load and validate the key document
  const keyRef = db
    .collection('users')
    .doc(ownerUid)
    .collection('inviteKeys')
    .doc(keyId);
  const keyDoc = await keyRef.get();

  if (!keyDoc.exists) {
    throw new HttpsError('not-found', 'Key not found');
  }

  const key = keyDoc.data();
  if (!key) throw new HttpsError('not-found', 'Key data missing');

  if (!key.isActive) {
    throw new HttpsError('failed-precondition', 'Key is no longer active');
  }
  if (key.expiresAt && (key.expiresAt.toDate() as Date) < new Date()) {
    throw new HttpsError('failed-precondition', 'Key has expired');
  }
  if (key.type !== 'permanent' && key.usesConsumed >= key.usesAllowed) {
    throw new HttpsError('resource-exhausted', 'Key has reached its use limit');
  }
  if (Array.isArray(key.usedBy) && key.usedBy.includes(callerUid)) {
    throw new HttpsError('already-exists', 'You have already used this key');
  }

  // Check for existing conversation BEFORE the transaction
  const existingSnap = await db
    .collection('conversations')
    .where('participants', 'array-contains', ownerUid)
    .where('isGroup', '==', false)
    .get();

  const existingConv = existingSnap.docs.find((d) => {
    const p = d.data().participants as string[];
    return Array.isArray(p) && p.includes(callerUid);
  });

  if (existingConv) {
    // Just consume a key use in a transaction
    await db.runTransaction(async (tx) => {
      tx.update(keyRef, {
        usesConsumed: admin.firestore.FieldValue.increment(1),
        usedBy: admin.firestore.FieldValue.arrayUnion(callerUid),
        ...(key.type === 'single' ? { isActive: false } : {}),
      });
    });

    const ownerDoc = await db.collection('users').doc(ownerUid).get();
    const ownerUsername = ownerDoc.data()?.username ?? '';
    return {
      success: true,
      conversationId: existingConv.id,
      ownerUid,
      ownerUsername,
    };
  }

  // Create new conversation in transaction
  const convRef = db.collection('conversations').doc();
  await db.runTransaction(async (tx) => {
    tx.update(keyRef, {
      usesConsumed: admin.firestore.FieldValue.increment(1),
      usedBy: admin.firestore.FieldValue.arrayUnion(callerUid),
      ...(key.type === 'single' ? { isActive: false } : {}),
    });
    tx.set(convRef, {
      id: convRef.id,
      participants: [ownerUid, callerUid],
      isGroup: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      inviteKeyUsed: token,
      lastMessage: null,
      deletedFor: [],
    });
  });

  const ownerDoc = await db.collection('users').doc(ownerUid).get();
  const ownerUsername = ownerDoc.data()?.username ?? '';

  return {
    success: true,
    conversationId: convRef.id,
    ownerUid,
    ownerUsername,
  };
});

// ─── 4. sendMessageNotification (data-only FCM with offline TTL) ───────────
export const sendMessageNotification = onDocumentCreated(
  'conversations/{convId}/messages/{msgId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const message = snap.data();
    const convId = event.params.convId;

    const convDoc = await db.collection('conversations').doc(convId).get();
    if (!convDoc.exists) return;

    const conv = convDoc.data();
    if (!conv) return;

    const participants = conv.participants as string[];
    const recipients = participants.filter((uid: string) => uid !== message.senderId);
    if (recipients.length === 0) return;

    const senderDoc = await db.collection('users').doc(message.senderId).get();
    const senderData = senderDoc.data();
    const senderUsername = senderData?.username ?? senderData?.displayName ?? 'Someone';

    const tokens: string[] = [];
    for (const recipientUid of recipients) {
      const userDoc = await db.collection('users').doc(recipientUid).get();
      const userData = userDoc.data();
      if (userData?.fcmToken) {
        tokens.push(userData.fcmToken as string);
      }
    }

    if (tokens.length === 0) return;

    const nowEpoch = Math.floor(Date.now() / 1000);
    const ttlSeconds = 86400; // 24 hours

    // Data-only payload — client builds the notification via Notifee
    await admin.messaging().sendEachForMulticast({
      tokens,
      data: {
        type: 'message',
        convId,
        msgId: snap.id,
        senderId: message.senderId,
        senderUsername,
        messageType: message.type ?? 'text',
        encryptedContent: message.encryptedContent ?? '',
        nonce: message.nonce ?? '',
      },
      android: {
        priority: 'high',
        ttl: ttlSeconds * 1000, // Android TTL is in milliseconds
      },
      apns: {
        headers: {
          'apns-push-type': 'background',
          'apns-priority': '10',
          // apns-expiration: epoch + 24h for offline delivery
          'apns-expiration': String(nowEpoch + ttlSeconds),
        },
        payload: {
          aps: {
            contentAvailable: true,
          },
        },
      },
    });

    logger.info(`Sent message notification to ${tokens.length} device(s) for conv ${convId}`);
  }
);

// ─── 5. sendCallNotification ───────────────────────────────────────────────
export const sendCallNotification = onDocumentCreated(
  'calls/{callId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const call = snap.data();
    const callId = event.params.callId;
    const { receiverIds, callerId, type: callType, channelName } = call as {
      receiverIds: string[];
      callerId: string;
      type: string;
      channelName: string;
    };

    if (!receiverIds?.length) return;

    const callerDoc = await db.collection('users').doc(callerId).get();
    const callerData = callerDoc.data();
    const callerUsername = callerData?.username ?? callerData?.displayName ?? 'Someone';
    const callerPhotoURL = callerData?.photoURL ?? '';

    const tokens: string[] = [];
    for (const uid of receiverIds) {
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.data();
      if (userData?.fcmToken) {
        tokens.push(userData.fcmToken as string);
      }
    }

    if (tokens.length === 0) return;

    await admin.messaging().sendEachForMulticast({
      tokens,
      data: {
        type: 'incoming_call',
        callId,
        callerId,
        callerUsername,
        callerPhotoURL,
        callType: callType ?? 'voice',
        channelName: channelName ?? callId,
      },
      android: {
        priority: 'high',
        ttl: 30000, // 30 seconds for calls — expire quickly
      },
      apns: {
        headers: {
          'apns-push-type': 'background',
          'apns-priority': '10',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + 30),
        },
        payload: {
          aps: {
            contentAvailable: true,
          },
        },
      },
    });
  }
);

// ─── 6. expireStatuses (every hour) ───────────────────────────────────────
export const expireStatuses = onSchedule('every 60 minutes', async () => {
  const now = admin.firestore.Timestamp.now();
  const snap = await db
    .collectionGroup('items')
    .where('expiresAt', '<=', now)
    .get();

  if (snap.empty) {
    logger.info('No expired status items found');
    return;
  }

  const batchSize = 400; // Firestore batch limit is 500
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  logger.info(`Deleted ${snap.size} expired status items`);
});

// ─── 7. onUserDeleted (Auth trigger) ─────────────────────────────────────
export const onUserDeleted = auth.user().onDelete(async (user) => {
  const uid = user.uid;

  // Get username before deleting user doc
  const userDoc = await db.collection('users').doc(uid).get();
  const username = userDoc.data()?.username as string | undefined;

  const deletions: Promise<unknown>[] = [];

  // Delete username reservation
  if (username) {
    deletions.push(db.collection('usernames').doc(username).delete());
  }

  // Delete invite keys subcollection
  const keysSnap = await db
    .collection('users')
    .doc(uid)
    .collection('inviteKeys')
    .get();
  if (!keysSnap.empty) {
    const batch = db.batch();
    keysSnap.docs.forEach((d) => batch.delete(d.ref));
    deletions.push(batch.commit());
  }

  // Delete inviteTokenIndex entries owned by this user
  const tokenSnap = await db
    .collection('inviteTokenIndex')
    .where('uid', '==', uid)
    .get();
  if (!tokenSnap.empty) {
    const batch = db.batch();
    tokenSnap.docs.forEach((d) => batch.delete(d.ref));
    deletions.push(batch.commit());
  }

  // Delete user document
  deletions.push(db.collection('users').doc(uid).delete());

  await Promise.all(deletions);
  logger.info(`Cleaned up data for deleted user: ${uid}`);
});

// ─── 8. registerPublicKey ──────────────────────────────────────────────────
export const registerPublicKey = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { publicKeyB64 } = request.data as { publicKeyB64?: string };
  if (!publicKeyB64) {
    throw new HttpsError('invalid-argument', 'publicKeyB64 is required');
  }

  await db.collection('users').doc(request.auth.uid).update({
    publicKey: publicKeyB64,
  });

  return { success: true };
});

// ─── 9. sendOptimisticAccept ───────────────────────────────────────────────
export const sendOptimisticAccept = onDocumentUpdated(
  'calls/{callId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const before = snap.before.data();
    const after = snap.after.data();

    // Trigger when status changes to 'accepted'
    if (before?.status !== 'accepted' && after?.status === 'accepted') {
      const callId = event.params.callId;
      const callerId = after.callerId;

      const userSnap = await db.collection('users').doc(callerId).get();
      const token = userSnap.get('fcmToken');
      if (!token) return;

      await admin.messaging().send({
        token,
        data: {
          type: 'CALL_ACCEPTED_OPTIMISTIC',
          callId: callId,
        },
        android: {
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
            },
          },
        },
      });
      logger.info(`Sent CALL_ACCEPTED_OPTIMISTIC FCM message for call: ${callId}`);
    }
  }
);
