import { useAppStore } from '../store';

export const useContent = () => useAppStore(state => state.content);
