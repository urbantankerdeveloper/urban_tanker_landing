// Web Worker for AES-GCM Encryption/Decryption
// Moves cryptographic operations off the main thread
// Usage: new Worker(new URL('cryptoWorker.ts', import.meta.url), { type: 'module' })

import { AES_KEY_SIZE, IV_SIZE } from '../lib/apiConfig';

interface EncryptMessage {
  type: 'encrypt';
  data: string;
  keyBase64: string;
  nonceBase64: string;
}

interface DecryptMessage {
  type: 'decrypt';
  encryptedBase64: string;
  nonceBase64: string;
  tagBase64: string;
  keyBase64: string;
}

interface WorkerResponse {
  type: 'success' | 'error';
  data?: string;
  error?: string;
}

async function deriveKey(keyBase64: string): Promise<CryptoKey> {
  const keyData = new Uint8Array(atob(keyBase64).split('').map(c => c.charCodeAt(0)));
  return crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encrypt(plaintext: string, keyBase64: string, nonceBase64: string): Promise<string> {
  const key = await deriveKey(keyBase64);
  const nonce = new Uint8Array(atob(nonceBase64).split('').map(c => c.charCodeAt(0)));
  const data = new TextEncoder().encode(plaintext);
  
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, data);
  const encryptedArray = new Uint8Array(ciphertext);
  
  // Convert to base64
  let binaryString = '';
  for (let i = 0; i < encryptedArray.length; i++) {
    binaryString += String.fromCharCode(encryptedArray[i]);
  }
  return btoa(binaryString);
}

async function decrypt(encryptedBase64: string, nonceBase64: string, tagBase64: string, keyBase64: string): Promise<string> {
  const key = await deriveKey(keyBase64);
  const nonce = new Uint8Array(atob(nonceBase64).split('').map(c => c.charCodeAt(0)));
  const encrypted = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)));
  const tag = new Uint8Array(atob(tagBase64).split('').map(c => c.charCodeAt(0)));
  
  // Combine encrypted data and tag
  const combined = new Uint8Array(encrypted.length + tag.length);
  combined.set(encrypted);
  combined.set(tag, encrypted.length);
  
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, combined);
  return new TextDecoder().decode(decrypted);
}

self.onmessage = async (event: MessageEvent<EncryptMessage | DecryptMessage>) => {
  try {
    if (event.data.type === 'encrypt') {
      const msg = event.data as EncryptMessage;
      const result = await encrypt(msg.data, msg.keyBase64, msg.nonceBase64);
      self.postMessage({ type: 'success', data: result } as WorkerResponse);
    } else if (event.data.type === 'decrypt') {
      const msg = event.data as DecryptMessage;
      const result = await decrypt(msg.encryptedBase64, msg.nonceBase64, msg.tagBase64, msg.keyBase64);
      self.postMessage({ type: 'success', data: result } as WorkerResponse);
    } else {
      self.postMessage({ type: 'error', error: 'Unknown message type' } as WorkerResponse);
    }
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) } as WorkerResponse);
  }
};
