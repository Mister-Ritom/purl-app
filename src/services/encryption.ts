import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import * as Keychain from 'react-native-keychain';
import { createMMKV } from 'react-native-mmkv';
import * as FileSystem from 'expo-file-system/legacy';
import { getFirestore, doc, setDoc, getDoc } from '@react-native-firebase/firestore';
import * as crypto from 'expo-crypto';
import { KEYCHAIN_SERVICE_ENCRYPTION, MMKV_INSTANCE_ID } from '../utils/constants';

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
    const stored = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE_ENCRYPTION });
    if (stored) {
      const { username: pubKeyB64, password: privKeyB64 } = stored;
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
    const userDocRef = doc(getFirestore(), 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    // Only write if no publicKey exists yet — never overwrite to avoid destroying old chats
    if (!userDocSnap.exists() || !userDocSnap.data()?.publicKey) {
      await setDoc(userDocRef, { publicKey: pubKeyB64 }, { merge: true });
    }
  } catch (error) {
    console.error('[getOrCreateKeyPair] Failed to sync public key to Firestore:', error);
  }

  return { publicKey: keyPair.publicKey, privateKey: keyPair.secretKey };
}

export function getSharedSecret(
  myPrivateKey: Uint8Array,
  theirUid: string,
  theirPublicKeyBase64: string
): Uint8Array {
  const cacheKey = `ss_${theirUid}`;
  const cached = mmkv.getString(cacheKey);
  if (cached) return decodeBase64(cached);

  const theirPublicKey = decodeBase64(theirPublicKeyBase64);
  const secret = nacl.box.before(theirPublicKey, myPrivateKey);
  mmkv.set(cacheKey, encodeBase64(secret));
  return secret;
}

export function encryptMessage(
  sharedSecret: Uint8Array,
  plaintext: string
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
  nonceBase64: string
): string | null {
  try {
    const ciphertext = decodeBase64(ciphertextBase64);
    const nonce = decodeBase64(nonceBase64);
    const decrypted = nacl.secretbox.open(ciphertext, nonce, sharedSecret);
    if (!decrypted) return null;
    return encodeUTF8(decrypted);
  } catch {
    return null;
  }
}

export async function encryptFile(
  sharedSecret: Uint8Array,
  fileUri: string
): Promise<{ encryptedBytes: Uint8Array; nonce: Uint8Array }> {
  const base64Content = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const fileBytes = decodeBase64(base64Content);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const encryptedBytes = nacl.secretbox(fileBytes, nonce, sharedSecret);
  return { encryptedBytes, nonce };
}

export async function decryptFile(
  key: Uint8Array,
  encryptedFileUri: string,
  nonceBase64: string,
  destUri: string
): Promise<string | null> {
  try {
    const base64Content = await FileSystem.readAsStringAsync(encryptedFileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const encryptedBytes = decodeBase64(base64Content);
    const nonce = decodeBase64(nonceBase64);
    
    const decrypted = nacl.secretbox.open(encryptedBytes, nonce, key);
    if (!decrypted) return null;
    
    await FileSystem.writeAsStringAsync(destUri, encodeBase64(decrypted), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return destUri;
  } catch (error) {
    console.error('[decryptFile] Error:', error);
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
  myPrivateKey: Uint8Array
): { ciphertext: string; nonce: string } {
  const recipientPublicKey = decodeBase64(recipientPublicKeyB64);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(groupKey, nonce, recipientPublicKey, myPrivateKey);
  return { ciphertext: encodeBase64(ciphertext), nonce: encodeBase64(nonce) };
}

export function decryptGroupKey(
  encryptedKeyB64: string,
  nonceB64: string,
  senderPublicKeyB64: string,
  myPrivateKey: Uint8Array
): Uint8Array | null {
  try {
    const encryptedKey = decodeBase64(encryptedKeyB64);
    const nonce = decodeBase64(nonceB64);
    const senderPublicKey = decodeBase64(senderPublicKeyB64);
    const decrypted = nacl.box.open(encryptedKey, nonce, senderPublicKey, myPrivateKey);
    return decrypted;
  } catch {
    return null;
  }
}

export function encryptWithGroupKey(
  groupKey: Uint8Array,
  plaintext: string
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(decodeUTF8(plaintext), nonce, groupKey);
  return { ciphertext: encodeBase64(ciphertext), nonce: encodeBase64(nonce) };
}

export function decryptWithGroupKey(
  groupKey: Uint8Array,
  ciphertextB64: string,
  nonceB64: string
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
  allKeys.filter(k => k.startsWith('ss_')).forEach(k => mmkv.remove(k));
}
