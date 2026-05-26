import AesGcmCrypto from "react-native-aes-gcm-crypto";
import nacl from "tweetnacl";
import * as FileSystem from "expo-file-system/legacy";
import {
  encodeBase64,
  decodeBase64,
  encodeUTF8,
  decodeUTF8,
} from "tweetnacl-util";
import * as Keychain from "react-native-keychain";
import { createMMKV } from "react-native-mmkv";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from "@react-native-firebase/firestore";
import * as crypto from "expo-crypto";
import {
  KEYCHAIN_SERVICE_ENCRYPTION,
  MMKV_INSTANCE_ID,
} from "../utils/constants";

// Set PRNG for tweetnacl
nacl.setPRNG((array, length) => {
  const randomBytes = crypto.getRandomBytes(length);
  for (let i = 0; i < length; i++) {
    array[i] = randomBytes[i];
  }
});

const mmkv = createMMKV({ id: MMKV_INSTANCE_ID });

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export async function getOrCreateKeyPair(uid: string): Promise<KeyPair> {
  try {
    const stored = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE_ENCRYPTION,
    });
    if (stored) {
      const { username: pubKeyB64, password: privKeyB64 } = stored;
      console.warn(
        `[getOrCreateKeyPair] Loaded existing keys for ${uid}. PubKey: ${pubKeyB64}`,
      );

      // Self-healing: verify Firestore has this exact public key
      try {
        const userDocRef = doc(getFirestore(), "users", uid);
        const userDocSnap = await getDoc(userDocRef);
        if (
          !userDocSnap.exists() ||
          userDocSnap.data()?.publicKey !== pubKeyB64
        ) {
          console.warn(
            `[getOrCreateKeyPair] Self-healing: Updating Firestore with local public key!`,
          );
          await setDoc(userDocRef, { publicKey: pubKeyB64 }, { merge: true });
        }
      } catch (e) {
        console.error("[getOrCreateKeyPair] Self-healing failed:", e);
      }

      return {
        publicKey: decodeBase64(pubKeyB64),
        privateKey: decodeBase64(privKeyB64),
      };
    }
  } catch {
    // No stored key, generate new one
  }

  const keyPair = nacl.box.keyPair();
  const pubKeyB64 = encodeBase64(keyPair.publicKey);
  const privKeyB64 = encodeBase64(keyPair.secretKey);

  await Keychain.setGenericPassword(pubKeyB64, privKeyB64, {
    service: KEYCHAIN_SERVICE_ENCRYPTION,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  try {
    const userDocRef = doc(getFirestore(), "users", uid);
    // Always write the new public key so others can communicate with this new device/keypair
    await setDoc(userDocRef, { publicKey: pubKeyB64 }, { merge: true });
  } catch (error) {
    console.error(
      "[getOrCreateKeyPair] Failed to sync public key to Firestore:",
      error,
    );
  }

  return { publicKey: keyPair.publicKey, privateKey: keyPair.secretKey };
}

export function getSharedSecret(
  myPrivateKey: Uint8Array,
  theirUid: string,
  theirPublicKeyBase64: string,
): Uint8Array {
  const cacheKey = `ss_${theirUid}_${theirPublicKeyBase64}`;
  const cached = mmkv.getString(cacheKey);
  if (cached) {
    console.warn(
      `[getSharedSecret] CACHED for ${theirUid}. TheirPub: ${theirPublicKeyBase64} | Secret: ${cached}`,
    );
    return decodeBase64(cached);
  }

  const theirPublicKey = decodeBase64(theirPublicKeyBase64);
  const secret = nacl.box.before(theirPublicKey, myPrivateKey);
  const secretB64 = encodeBase64(secret);
  mmkv.set(cacheKey, secretB64);

  console.warn(
    `[getSharedSecret] GENERATED for ${theirUid}. MyPriv: ${encodeBase64(myPrivateKey)} | TheirPub: ${theirPublicKeyBase64} | Secret: ${secretB64}`,
  );

  return secret;
}

export function encryptMessage(
  sharedSecret: Uint8Array,
  plaintext: string,
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(decodeUTF8(plaintext), nonce, sharedSecret);
  return {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
  };
}

export function decryptMessage(
  sharedSecret: Uint8Array,
  ciphertextBase64: string,
  nonceBase64: string,
): string | null {
  try {
    const ciphertext = decodeBase64(ciphertextBase64);
    const nonce = decodeBase64(nonceBase64);
    const decrypted = nacl.secretbox.open(ciphertext, nonce, sharedSecret);
    if (!decrypted) {
      console.warn(
        `[decryptMessage] FAILED (AUTH MISMATCH). Secret: ${encodeBase64(sharedSecret)} | Cipher: ${ciphertextBase64.substring(0, 20)}... | Nonce: ${nonceBase64}`,
      );
      return null;
    }
    return encodeUTF8(decrypted);
  } catch (err) {
    console.warn(`[decryptMessage] ERROR THROWN:`, err);
    return null;
  }
}

export async function encryptFile(
  sharedSecret: Uint8Array,
  fileUri: string,
  destUri: string,
): Promise<{
  mediaEncryption: { ciphertext: string; nonce: string };
  encryptedFileUri: string;
}> {
  // Generate random AES key (256-bit) as Base64 string
  const aesKeyBytes = crypto.getRandomBytes(32);
  const aesKeyBase64 = encodeBase64(aesKeyBytes);

  // Pre-create the destination file because some native stream implementations
  // (like NSFileHandle on iOS) fail if the file doesn't already exist.
  await FileSystem.writeAsStringAsync(destUri, "", {
    encoding: FileSystem.EncodingType.UTF8,
  });

  // Encrypt the file using the native GCM method
  const { iv, tag } = await AesGcmCrypto.encryptFile(
    fileUri.replace("file://", ""),
    destUri.replace("file://", ""),
    aesKeyBase64,
  );

  // Combine key, IV, and tag then encrypt with tweetnacl
  const combinedPayload = `${aesKeyBase64}:${iv}:${tag}`;
  const encryptedPayload = encryptMessage(sharedSecret, combinedPayload);

  return { mediaEncryption: encryptedPayload, encryptedFileUri: destUri };
}

export async function decryptFile(
  sharedSecret: Uint8Array,
  encryptedFileUri: string,
  mediaEncryptionOrNonce: { ciphertext: string; nonce: string } | string,
  destUri: string,
): Promise<string | null> {
  try {
    if (typeof mediaEncryptionOrNonce === "string") {
      console.warn(
        "[decryptFile] Legacy pure-tweetnacl file encryption is no longer supported.",
      );
      return null;
    }

    const mediaEncryption = mediaEncryptionOrNonce;
    // Decrypt the AES key bundle using tweetnacl
    const decryptedPayload = decryptMessage(
      sharedSecret,
      mediaEncryption.ciphertext,
      mediaEncryption.nonce,
    );
    if (!decryptedPayload) {
      console.warn("[decryptFile] Failed to decrypt media encryption bundle");
      return null;
    }

    const parts = decryptedPayload.split(":");
    if (parts.length !== 3) {
      if (parts.length === 2) {
        console.warn(
          "[decryptFile] Legacy react-native-aes-crypto format is no longer supported.",
        );
      } else {
        console.warn("[decryptFile] Invalid media encryption payload format");
      }
      return null;
    }

    const [aesKeyBase64, iv, tag] = parts;

    // Pre-create the destination file for the native decryption stream
    await FileSystem.writeAsStringAsync(destUri, "", {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Decrypt the file natively
    await AesGcmCrypto.decryptFile(
      encryptedFileUri.replace("file://", ""),
      destUri.replace("file://", ""),
      aesKeyBase64,
      iv,
      tag,
    );
    return destUri;
  } catch (error) {
    console.error("[decryptFile] Error:", error);
    return null;
  }
}

// Group encryption
export function generateGroupKey(): Uint8Array {
  return nacl.randomBytes(32);
}

export function encryptGroupKey(
  groupKey: Uint8Array,
  recipientPublicKeyB64: string,
  myPrivateKey: Uint8Array,
): { ciphertext: string; nonce: string } {
  const recipientPublicKey = decodeBase64(recipientPublicKeyB64);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(
    groupKey,
    nonce,
    recipientPublicKey,
    myPrivateKey,
  );
  return { ciphertext: encodeBase64(ciphertext), nonce: encodeBase64(nonce) };
}

export function decryptGroupKey(
  encryptedKeyB64: string,
  nonceB64: string,
  senderPublicKeyB64: string,
  myPrivateKey: Uint8Array,
): Uint8Array | null {
  try {
    const encryptedKey = decodeBase64(encryptedKeyB64);
    const nonce = decodeBase64(nonceB64);
    const senderPublicKey = decodeBase64(senderPublicKeyB64);
    const decrypted = nacl.box.open(
      encryptedKey,
      nonce,
      senderPublicKey,
      myPrivateKey,
    );
    return decrypted;
  } catch {
    return null;
  }
}

export function encryptWithGroupKey(
  groupKey: Uint8Array,
  plaintext: string,
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(decodeUTF8(plaintext), nonce, groupKey);
  return { ciphertext: encodeBase64(ciphertext), nonce: encodeBase64(nonce) };
}

export function decryptWithGroupKey(
  groupKey: Uint8Array,
  ciphertextB64: string,
  nonceB64: string,
): string | null {
  try {
    const ciphertext = decodeBase64(ciphertextB64);
    const nonce = decodeBase64(nonceB64);
    const decrypted = nacl.secretbox.open(ciphertext, nonce, groupKey);
    if (!decrypted) return null;
    return encodeUTF8(decrypted);
  } catch {
    return null;
  }
}

export function clearSharedSecretCache(): void {
  const allKeys = mmkv.getAllKeys();
  allKeys.filter((k) => k.startsWith("ss_")).forEach((k) => mmkv.remove(k));
}
