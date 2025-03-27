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
    return context.cache(
        async () => {
            try {
                const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
                return response.status === 200;
            } catch (error) {
                console.error('Error validating word:', error);
                return false;
            }
        },
        {
            key: `word_validation_${word.toLowerCase()}`,
            ttl: 7 * 24 * 60 * 60 * 1000,
        }
    );
};