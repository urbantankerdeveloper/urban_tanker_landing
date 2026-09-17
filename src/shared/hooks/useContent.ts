import { useAppStore } from '../../app/store';

export const useContent = () => useAppStore(state => state.content);
