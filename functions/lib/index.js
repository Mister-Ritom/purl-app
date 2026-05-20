"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOptimisticAccept = exports.registerPublicKey = exports.onUserDeleted = exports.expireStatuses = exports.sendCallNotification = exports.sendMessageNotification = exports.redeemInviteKey = exports.registerInviteKey = exports.createInviteKey = exports.initiateCall = exports.generateAgoraToken = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const v2_1 = require("firebase-functions/v2");
const admin = require("firebase-admin");
const v1_1 = require("firebase-functions/v1");
const agora_access_token_1 = require("agora-access-token");
admin.initializeApp();
const db = admin.firestore();
// ─── Secrets (set via: firebase functions:secrets:set AGORA_APP_ID) ──────────
const AGORA_APP_ID = (0, params_1.defineSecret)('AGORA_APP_ID');
const AGORA_APP_CERTIFICATE = (0, params_1.defineSecret)('AGORA_APP_CERTIFICATE');
// ─── Token expiry: 1 hour ──────────────────────────────────────────────────
const TOKEN_EXPIRY_S = 3600;
// ─── Hash uid to a stable Agora numeric uid ───────────────────────────────
function hashUidToNumber(uid) {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        const char = uid.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash);
}
// ─── 1. generateAgoraToken ─────────────────────────────────────────────────
exports.generateAgoraToken = (0, https_1.onCall)({ secrets: [AGORA_APP_ID, AGORA_APP_CERTIFICATE], invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const { channelName, uid } = request.data;
    if (!channelName || !uid) {
        throw new https_1.HttpsError('invalid-argument', 'channelName and uid are required');
    }
    const appId = AGORA_APP_ID.value();
    const certificate = AGORA_APP_CERTIFICATE.value();
    if (!appId || !certificate) {
        throw new https_1.HttpsError('internal', 'Agora credentials not configured');
    }
    const expireTs = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_S;
    const agoraUid = hashUidToNumber(uid);
    const token = agora_access_token_1.RtcTokenBuilder.buildTokenWithUid(appId, certificate, channelName, agoraUid, agora_access_token_1.RtcRole.PUBLISHER, expireTs);
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
});
// ─── 2. initiateCall ────────────────────────────────────────────────────────
exports.initiateCall = (0, https_1.onCall)({ secrets: [AGORA_APP_ID, AGORA_APP_CERTIFICATE], invoker: 'public' }, async (request) => {
    var _a, _b, _c;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const { receiverIds, type } = request.data;
    if (!receiverIds || !receiverIds.length || !type) {
        throw new https_1.HttpsError('invalid-argument', 'receiverIds and type are required');
    }
    const callerId = request.auth.uid;
    const appId = AGORA_APP_ID.value();
    const certificate = AGORA_APP_CERTIFICATE.value();
    if (!appId || !certificate) {
        throw new https_1.HttpsError('internal', 'Agora credentials not configured');
    }
    const callRef = db.collection('calls').doc();
    const callId = callRef.id;
    const channelName = callId;
    // Generate token for the caller
    const expireTs = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_S;
    const agoraUid = hashUidToNumber(callerId);
    const token = agora_access_token_1.RtcTokenBuilder.buildTokenWithUid(appId, certificate, channelName, agoraUid, agora_access_token_1.RtcRole.PUBLISHER, expireTs);
    const callerDoc = await db.collection('users').doc(callerId).get();
    const callerData = callerDoc.data();
    await callRef.set({
        id: callId,
        callerId,
        receiverIds,
        type,
        status: 'ringing',
        channelName,
        agoraToken: token, // This is the token for the caller
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        callerUsername: (_b = (_a = callerData === null || callerData === void 0 ? void 0 : callerData.username) !== null && _a !== void 0 ? _a : callerData === null || callerData === void 0 ? void 0 : callerData.displayName) !== null && _b !== void 0 ? _b : 'Someone',
        callerPhotoURL: (_c = callerData === null || callerData === void 0 ? void 0 : callerData.photoURL) !== null && _c !== void 0 ? _c : '',
    });
    return { callId, agoraToken: token };
});
// ─── 2. createInviteKey ───────────────────────────────────────────────────
exports.createInviteKey = (0, https_1.onCall)({ invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const uid = request.auth.uid;
    const { type, maxUses, expiryDays, label } = request.data;
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
        if (!existing.exists)
            break;
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
exports.registerInviteKey = (0, https_1.onCall)({ invoker: 'public' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const { token, keyId } = request.data;
    if (!token || !keyId)
        throw new https_1.HttpsError('invalid-argument', 'Missing params');
    await db.collection('inviteTokenIndex').doc(token).set({
        uid: request.auth.uid,
        keyId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
// ─── 3. redeemInviteKey ───────────────────────────────────────────────────
exports.redeemInviteKey = (0, https_1.onCall)({ invoker: 'public' }, async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const callerUid = request.auth.uid;
    const { token } = request.data;
    if (!token || !/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(token)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid token format');
    }
    // Look up token → owner
    const registryDoc = await db.collection('inviteTokenIndex').doc(token).get();
    if (!registryDoc.exists) {
        throw new https_1.HttpsError('not-found', 'Invite key not found');
    }
    const registryData = registryDoc.data();
    if (!registryData)
        throw new https_1.HttpsError('not-found', 'Invite key not found');
    const { uid: ownerUid, keyId } = registryData;
    if (ownerUid === callerUid) {
        throw new https_1.HttpsError('failed-precondition', 'You cannot redeem your own key');
    }
    // Load and validate the key document
    const keyRef = db
        .collection('users')
        .doc(ownerUid)
        .collection('inviteKeys')
        .doc(keyId);
    const keyDoc = await keyRef.get();
    if (!keyDoc.exists) {
        throw new https_1.HttpsError('not-found', 'Key not found');
    }
    const key = keyDoc.data();
    if (!key)
        throw new https_1.HttpsError('not-found', 'Key data missing');
    if (!key.isActive) {
        throw new https_1.HttpsError('failed-precondition', 'Key is no longer active');
    }
    if (key.expiresAt && key.expiresAt.toDate() < new Date()) {
        throw new https_1.HttpsError('failed-precondition', 'Key has expired');
    }
    if (key.type !== 'permanent' && key.usesConsumed >= key.usesAllowed) {
        throw new https_1.HttpsError('resource-exhausted', 'Key has reached its use limit');
    }
    if (Array.isArray(key.usedBy) && key.usedBy.includes(callerUid)) {
        throw new https_1.HttpsError('already-exists', 'You have already used this key');
    }
    // Check for existing conversation BEFORE the transaction
    const existingSnap = await db
        .collection('conversations')
        .where('participants', 'array-contains', ownerUid)
        .where('isGroup', '==', false)
        .get();
    const existingConv = existingSnap.docs.find((d) => {
        const p = d.data().participants;
        return Array.isArray(p) && p.includes(callerUid);
    });
    if (existingConv) {
        // Just consume a key use in a transaction
        await db.runTransaction(async (tx) => {
            tx.update(keyRef, Object.assign({ usesConsumed: admin.firestore.FieldValue.increment(1), usedBy: admin.firestore.FieldValue.arrayUnion(callerUid) }, (key.type === 'single' ? { isActive: false } : {})));
        });
        const ownerDoc = await db.collection('users').doc(ownerUid).get();
        const ownerUsername = (_b = (_a = ownerDoc.data()) === null || _a === void 0 ? void 0 : _a.username) !== null && _b !== void 0 ? _b : '';
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
        tx.update(keyRef, Object.assign({ usesConsumed: admin.firestore.FieldValue.increment(1), usedBy: admin.firestore.FieldValue.arrayUnion(callerUid) }, (key.type === 'single' ? { isActive: false } : {})));
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
    const ownerUsername = (_d = (_c = ownerDoc.data()) === null || _c === void 0 ? void 0 : _c.username) !== null && _d !== void 0 ? _d : '';
    return {
        success: true,
        conversationId: convRef.id,
        ownerUid,
        ownerUsername,
    };
});
// ─── 4. sendMessageNotification (data-only FCM with offline TTL) ───────────
exports.sendMessageNotification = (0, firestore_1.onDocumentCreated)('conversations/{convId}/messages/{msgId}', async (event) => {
    var _a, _b, _c, _d, _e;
    const snap = event.data;
    if (!snap)
        return;
    const message = snap.data();
    const convId = event.params.convId;
    const convDoc = await db.collection('conversations').doc(convId).get();
    if (!convDoc.exists)
        return;
    const conv = convDoc.data();
    if (!conv)
        return;
    const participants = conv.participants;
    const recipients = participants.filter((uid) => uid !== message.senderId);
    if (recipients.length === 0)
        return;
    const senderDoc = await db.collection('users').doc(message.senderId).get();
    const senderData = senderDoc.data();
    const senderUsername = (_b = (_a = senderData === null || senderData === void 0 ? void 0 : senderData.username) !== null && _a !== void 0 ? _a : senderData === null || senderData === void 0 ? void 0 : senderData.displayName) !== null && _b !== void 0 ? _b : 'Someone';
    const tokens = [];
    for (const recipientUid of recipients) {
        const userDoc = await db.collection('users').doc(recipientUid).get();
        const userData = userDoc.data();
        if (userData === null || userData === void 0 ? void 0 : userData.fcmToken) {
            tokens.push(userData.fcmToken);
        }
    }
    if (tokens.length === 0)
        return;
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
            messageType: (_c = message.type) !== null && _c !== void 0 ? _c : 'text',
            encryptedContent: (_d = message.encryptedContent) !== null && _d !== void 0 ? _d : '',
            nonce: (_e = message.nonce) !== null && _e !== void 0 ? _e : '',
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
    v2_1.logger.info(`Sent message notification to ${tokens.length} device(s) for conv ${convId}`);
});
// ─── 5. sendCallNotification ───────────────────────────────────────────────
exports.sendCallNotification = (0, firestore_1.onDocumentCreated)('calls/{callId}', async (event) => {
    var _a, _b, _c;
    const snap = event.data;
    if (!snap)
        return;
    const call = snap.data();
    const callId = event.params.callId;
    const { receiverIds, callerId, type: callType, channelName } = call;
    if (!(receiverIds === null || receiverIds === void 0 ? void 0 : receiverIds.length))
        return;
    const callerDoc = await db.collection('users').doc(callerId).get();
    const callerData = callerDoc.data();
    const callerUsername = (_b = (_a = callerData === null || callerData === void 0 ? void 0 : callerData.username) !== null && _a !== void 0 ? _a : callerData === null || callerData === void 0 ? void 0 : callerData.displayName) !== null && _b !== void 0 ? _b : 'Someone';
    const callerPhotoURL = (_c = callerData === null || callerData === void 0 ? void 0 : callerData.photoURL) !== null && _c !== void 0 ? _c : '';
    const tokens = [];
    for (const uid of receiverIds) {
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.data();
        if (userData === null || userData === void 0 ? void 0 : userData.fcmToken) {
            tokens.push(userData.fcmToken);
        }
    }
    if (tokens.length === 0)
        return;
    await admin.messaging().sendEachForMulticast({
        tokens,
        data: {
            type: 'incoming_call',
            callId,
            callerId,
            callerUsername,
            callerPhotoURL,
            callType: callType !== null && callType !== void 0 ? callType : 'voice',
            channelName: channelName !== null && channelName !== void 0 ? channelName : callId,
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
});
// ─── 6. expireStatuses (every hour) ───────────────────────────────────────
exports.expireStatuses = (0, scheduler_1.onSchedule)('every 60 minutes', async () => {
    const now = admin.firestore.Timestamp.now();
    const snap = await db
        .collectionGroup('items')
        .where('expiresAt', '<=', now)
        .get();
    if (snap.empty) {
        v2_1.logger.info('No expired status items found');
        return;
    }
    const batchSize = 400; // Firestore batch limit is 500
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
    v2_1.logger.info(`Deleted ${snap.size} expired status items`);
});
// ─── 7. onUserDeleted (Auth trigger) ─────────────────────────────────────
exports.onUserDeleted = v1_1.auth.user().onDelete(async (user) => {
    var _a;
    const uid = user.uid;
    // Get username before deleting user doc
    const userDoc = await db.collection('users').doc(uid).get();
    const username = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.username;
    const deletions = [];
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
    v2_1.logger.info(`Cleaned up data for deleted user: ${uid}`);
});
// ─── 8. registerPublicKey ──────────────────────────────────────────────────
exports.registerPublicKey = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const { publicKeyB64 } = request.data;
    if (!publicKeyB64) {
        throw new https_1.HttpsError('invalid-argument', 'publicKeyB64 is required');
    }
    await db.collection('users').doc(request.auth.uid).update({
        publicKey: publicKeyB64,
    });
    return { success: true };
});
// ─── 9. sendOptimisticAccept ───────────────────────────────────────────────
exports.sendOptimisticAccept = (0, firestore_1.onDocumentUpdated)('calls/{callId}', async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const before = snap.before.data();
    const after = snap.after.data();
    // Trigger when status changes to 'accepted'
    if ((before === null || before === void 0 ? void 0 : before.status) !== 'accepted' && (after === null || after === void 0 ? void 0 : after.status) === 'accepted') {
        const callId = event.params.callId;
        const callerId = after.callerId;
        const userSnap = await db.collection('users').doc(callerId).get();
        const token = userSnap.get('fcmToken');
        if (!token)
            return;
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
        v2_1.logger.info(`Sent CALL_ACCEPTED_OPTIMISTIC FCM message for call: ${callId}`);
    }
});
//# sourceMappingURL=index.js.map