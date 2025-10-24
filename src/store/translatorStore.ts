import { create } from 'zustand';

export interface ExtractedItem {
  term: string;
  originalText: string;
  dataLineIndex?: number;
  linePrefix?: string;
}

interface TranslatorState {
  // File state
  content: string;
  fileName: string;
  
  // Extraction state
  extractedData: ExtractedItem[];
  translationMap: Map<string, string>;
  
  // UI state
  isLoading: boolean;
  progress: number;
  searchQuery: string;
  languageIndex: number;
  
  // Actions
  setContent: (content: string) => void;
  setFileName: (name: string) => void;
  setExtractedData: (data: ExtractedItem[]) => void;
  setTranslationMap: (map: Map<string, string>) => void;
  setLoading: (loading: boolean) => void;
  setProgress: (progress: number) => void;
  setSearchQuery: (query: string) => void;
  setLanguageIndex: (index: number) => void;
  reset: () => void;
}

export const useTranslatorStore = create<TranslatorState>((set) => ({
  // Initial state
  content: '',
  fileName: '',
  extractedData: [],
  translationMap: new Map(),
  isLoading: false,
  progress: 0,
  searchQuery: '',
  languageIndex: 0,

  // Actions
  setContent: (content) => set({ content }),
  setFileName: (fileName) => set({ fileName }),
  setExtractedData: (extractedData) => set({ extractedData }),
  setTranslationMap: (translationMap) => set({ translationMap }),
  setLoading: (isLoading) => set({ isLoading }),
  setProgress: (progress) => set({ progress }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setLanguageIndex: (languageIndex) => set({ languageIndex }),
  reset: () => set({
    content: '',
    fileName: '',
    extractedData: [],
    translationMap: new Map(),
    isLoading: false,
    progress: 0,
    searchQuery: '',
    languageIndex: 0,
  }),
}));
