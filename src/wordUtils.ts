import { Devvit } from '@devvit/public-api';
import { wordPairs, WordPair } from './words.js';

export const differsBy1Letter = (word1: string, word2: string): boolean => {
    if (word1.length !== word2.length) return false;

    let differences = 0;
    for (let i = 0; i < word1.length; i++) {
        if (word1[i] !== word2[i]) differences++;
        if (differences > 1) return false;
    }

    return differences === 1;
};

export const selectWordPairFromPostId = (postId: string): WordPair => {
    const hashCode = (str: string): number => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    };

    const pairIndex = hashCode(postId) % wordPairs.length;
    return wordPairs[pairIndex];
};

export const validateWord = async (word: string, context: Devvit.Context): Promise<boolean> => {
    try {
        console.log(`Validating word: ${word}`);
        
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        const data = await response.json();
        
        console.log('Validation Data:', JSON.stringify(data));
        console.log('Is Array:', Array.isArray(data));
        console.log('Data Length:', data.length);
        console.log('First Item Meanings:', data[0]?.meanings);
        console.log('Meanings Length:', data[0]?.meanings?.length);

        const isValid = Array.isArray(data) && 
                        data.length > 0 && 
                        data[0].meanings && 
                        data[0].meanings.length > 0;
        
        console.log('Is Valid Word:', isValid);
        return isValid;
    } catch (error) {
        console.error('Full error during word validation:', error);
        return false;
    }
};