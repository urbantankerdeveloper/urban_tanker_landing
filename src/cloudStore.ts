import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore';
import { firebaseAuth, firebaseEnabled, firestore } from './firebase';

export type CloudState = Record<string, unknown>;
export type CloudStateHandler = (state: CloudState) => void;
export type CloudErrorHandler = (error: Error) => void;

const stateRef = () => {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Authentication is required for cloud state.');
  return doc(firestore!, 'users', user.uid, 'state', 'urban-tanker');
};
export const contentClientId = import.meta.env.VITE_CONTENT_CLIENT_ID || 'urban-tanker';
const contentRef = (clientId: string) => doc(firestore!, 'content', clientId);

export async function subscribeToContent(clientId: string, onContent: CloudStateHandler, onError: CloudErrorHandler): Promise<Unsubscribe> {
  if (!firebaseEnabled || !firestore) { onError(new Error('Firebase is not configured.')); return () => {}; }
  return onSnapshot(contentRef(clientId), snapshot => onContent(snapshot.exists() ? snapshot.data() : {}), onError);
}

export async function subscribeToCloudState(onState: CloudStateHandler, onError: CloudErrorHandler): Promise<Unsubscribe> {
  if (!firebaseEnabled || !firebaseAuth || !firestore) {
    onError(new Error('Firebase is not configured.'));
    return () => {};
  }
  if (!firebaseAuth.currentUser) { onError(new Error('Authentication is required.')); return () => {}; }
  return onSnapshot(stateRef(), snapshot => {
    onState(snapshot.exists() ? snapshot.data() : {});
  }, onError);
}

export async function refreshCloudState(): Promise<CloudState> {
  if (!firebaseEnabled || !firebaseAuth || !firestore) return {};
  if (!firebaseAuth.currentUser) return {};
  const snapshot = await getDoc(stateRef());
  return snapshot.exists() ? snapshot.data() : {};
}

export async function persistCloudState(state: CloudState): Promise<void> {
  if (!firebaseEnabled || !firebaseAuth || !firestore) return;
  if (!firebaseAuth.currentUser) return;
  await setDoc(stateRef(), { ...state, updatedAt: serverTimestamp() }, { merge: true });
}
