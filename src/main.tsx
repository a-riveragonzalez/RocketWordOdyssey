// Learn more at developers.reddit.com/docs
import { Devvit, useState, useForm } from '@devvit/public-api';

import {
  differsBy1Letter,
  selectWordPairFromPostId,
  validateWord
} from './wordUtils.js';

Devvit.configure({
  redditAPI: true,
  http: true,
});

// ---------------------------------------------------------------------------------------------------------------------------------------

// ! Types and Interfaces

// Define types for game state
type Screen = 'start' | 'game' | 'complete';

// Use a type that aligns with JSONValue constraint for useState
interface GameState {
  startWord: string;
  targetWord: string;
  currentWord: string;
  wordChain: string[];
  moves: number;
  startTime: number | null;
  endTime: number | null;
  error: string;
  [key: string]: string | string[] | number | null; // index signature for JSONObject compatibility
}

// ---------------------------------------------------------------------------------------------------------------------------------------

// ! Main game component

const WordPuzzleGame: Devvit.CustomPostComponent = (context) => {
  // Performance tracking
  const [renderStart] = useState(Date.now());

  const selectedPair = selectWordPairFromPostId(context.postId!);

  const [gameConfig, setGameConfig] = useState({
    startWord: selectedPair.startWord.toUpperCase(),
    targetWord: selectedPair.targetWord.toUpperCase(),
  });

  // Game screen state
  const [screen, setScreen] = useState<Screen>('start');

  // Input state for the custom input field
  const [inputWord, setInputWord] = useState<string>('');

  // Core game state - consolidated for easier updates
  const [gameState, setGameState] = useState<GameState>({
    startWord: gameConfig.startWord,
    targetWord: gameConfig.targetWord,
    currentWord: '',
    wordChain: [],
    moves: 0,
    startTime: null,
    endTime: null,
    error: '',
  });

  // Create a form for word input using the useForm hook
  const wordInputForm = useForm(
    {
      title: "Enter next word",
      fields: [
        {
          type: "string",
          name: "word",
          label: "New Word",
          placeholder: "Enter a word...",
          required: false,
          defaultValue: `${gameState.currentWord.toLowerCase()}`,
          helpText: `New word must differ by exactly one letter from the current word. Current word: "${gameState.currentWord}" | Target Word: "${gameState.targetWord}"`,
        }
      ],
      acceptLabel: "Submit",
      cancelLabel: "Cancel"
    },
    async (values) => {
      if (values && values.word) {
        setInputWord(values.word);
        await submitWord(values.word);
      }
    }
  );

  // Log performance after initial render
  console.log(`Initial render took: ${Date.now() - renderStart} milliseconds`);

  // Show instructions when the info button is pressed
  const showInstructions = () => {
    context.ui.showToast({
      text: "Change one letter at a time to form valid words until you reach the target word.",
      appearance: "neutral"
    });
  };

  // Game initialization function
  const initializeGame = (newScreen: Screen): void => {
    if (newScreen === 'start') {
      setGameState({
        ...gameState,
        currentWord: '',
        wordChain: [],
        moves: 0,
        startTime: null,
        endTime: null,
        error: '',
      });
    } else if (newScreen === 'game') {
      setGameState({
        ...gameState,
        currentWord: gameConfig.startWord,
        wordChain: [gameConfig.startWord],
        moves: 0,
        startTime: Date.now(),
        endTime: null,
        error: '',
      });
    }
    setScreen(newScreen);
  };

  // Check for game completion
  if (gameState.currentWord === gameState.targetWord &&
    gameState.currentWord !== '' &&
    screen === 'game') {
    setGameState({
      ...gameState,
      endTime: Date.now()
    });
    setScreen('complete');
  }

  // Submit a new word - this will run on the server due to API call
  const submitWord = async (word: string): Promise<void> => {
    if (!word || word.trim() === '') {
      setGameState({
        ...gameState,
        error: 'Please enter a word.'
      });
      return;
    }

    const processedWord = word.toUpperCase();

    // Early validation checks (client-side performance)
    if (processedWord === gameState.currentWord) {
      setGameState({
        ...gameState,
        error: 'Word must be different from the current word.'
      });
      return;
    }

    if (!differsBy1Letter(processedWord, gameState.currentWord)) {
      setGameState({
        ...gameState,
        error: 'Word must differ by exactly one letter.'
      });
      return;
    }

    if (processedWord === gameState.targetWord) {
      setGameState({
        ...gameState,
        endTime: Date.now(),
        currentWord: processedWord,
        wordChain: [...gameState.wordChain, processedWord],
        moves: gameState.moves + 1,
        error: ''
      });
      setScreen('complete');
      return;
    }

    // Performance tracking for word validation
    const validationStart = Date.now();

    // Validate against dictionary API (with caching)
    const isValid = await validateWord(processedWord, context);

    console.log(`Word validation took: ${Date.now() - validationStart} milliseconds`);

    // Uncomment for production use
    if (!isValid) {
      setGameState({
        ...gameState,
        error: 'Not a valid word.'
      });
      return;
    }

    // Update game state
    setGameState({
      ...gameState,
      currentWord: processedWord,
      wordChain: [...gameState.wordChain, processedWord],
      moves: gameState.moves + 1,
      error: ''
    });

    // Clear input field after successful submission
    setInputWord('');
  };

  // ---------------------------------------------------------------------------------------------------------------------------------------

  // Start Screen
  if (screen === 'start') {
    return (
      <zstack width="100%" height="100%" >
        <image
          url="space_background.jpg"
          imageHeight="256px"
          imageWidth="256px"
          width="100%"
          height="100%"
          resizeMode="cover"
        />

        <vstack alignment="center middle" height="100%" width="100%">
          <text size="xxlarge" weight="bold" color="#FFFFFF">Rocket Word Odyssey</text>
          <spacer size="medium" />
          <text size="large" color="#b7cad5">Transform "{gameState.startWord}" into "{gameState.targetWord}" one letter at a time!</text>

          <spacer size="medium" />

          <button appearance="primary" onPress={() => initializeGame('game')}>
            Play Game
          </button>
          <spacer size="medium" />
          <button onPress={() => showInstructions()}>
            How to Play
          </button>
        </vstack>
      </zstack>
    );
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------

  // Game Screen
  if (screen === 'game') {
    return (
      <zstack width="100%" height="100%" >
        <image
          url="space_background.jpg"
          imageHeight="500px"
          imageWidth="500px"
          width="100%"
          height="100%"
          resizeMode="cover"
        />

        <vstack alignment="center middle" height="100%" width="100%">
          <hstack width="100%" padding="small">
            <text size="large" color="#b7cad5">Moves: {gameState.moves}</text>
            <spacer grow />
            <button
              icon="info"
              appearance="secondary"
              onPress={() => showInstructions()}
            />
          </hstack>

          <vstack gap="small" alignment="center middle" grow width="100%">
            <text size="xlarge" weight="bold" color="#FFFFFF">Target Word: {gameState.targetWord}</text>
            <text size="large" color="#b7cad5">Current Word: {gameState.currentWord}</text>

            <spacer size="small" />

            <hstack width="60%" alignment="center middle" gap="small" border="thin" cornerRadius="medium" padding="small" lightBorderColor='#afc1cc'>
              <text color="#b7cad5">{inputWord || 'Enter new word...'}</text>
              <spacer grow />
              <button
                icon="edit"
                appearance="primary"
                onPress={() => {
                  context.ui.showForm(wordInputForm);
                }}
              />
            </hstack>

            {gameState.error && <text color="red" size="small">{gameState.error}</text>}

            <spacer size="small" />

            <image
              url="rocket.gif"
              description="Animated rocket"
              imageWidth={100}
              imageHeight={100}
            />

            <spacer size="small" />

            <text size="medium" color="#b7cad5">Word Chain:</text>

            <vstack width="80%" gap="small">
              <hstack padding="small" gap="small" alignment='center'>
                {gameState.wordChain.length > 5 && <text color="#b7cad5">...</text>}
                {gameState.wordChain.slice(-5).map((word, i) => {
                  // Only show latest five words entered
                  const startPos = Math.max(0, gameState.wordChain.length - 5);
                  return (
                    <text key={(startPos + i).toString()} color="#b7cad5">{startPos + i + 1}. {word}</text>
                  );
                })}
              </hstack>
            </vstack>
          </vstack>
        </vstack>
      </zstack>
    );
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------

  // Complete Screen
  if (screen === 'complete') {
    const timeSpentSeconds = Math.floor(((gameState.endTime || 0) - (gameState.startTime || 0)) / 1000);
    const minutes = Math.floor(timeSpentSeconds / 60);
    const seconds = timeSpentSeconds % 60;

    return (
      <zstack width="100%" height="100%" >
        <image
          url="space_background.jpg"
          imageHeight="256px"
          imageWidth="256px"
          width="100%"
          height="100%"
          resizeMode="cover"
        />

        <vstack alignment="center middle" height="100%" width="100%">
          <text size="xxlarge" weight="bold" color="#FFFFFF">Congratulations!</text>
          <spacer size="small" />
          <text size="large" color="#b7cad5">You solved the puzzle!</text>

          <spacer size="medium" />

          <hstack>
            <image
              url="rocket_landed.png"
              description="Rocket on the moon"
              imageWidth={150}
              imageHeight={250}
            />

            <spacer size="medium" />

            <vstack padding="large" gap="medium" cornerRadius="medium" border="thin" width="80%" alignment="middle start" lightBorderColor='#afc1cc'>
              <text size="large" weight="bold" color="#b7cad5">Game Stats</text>
              <text color="#b7cad5">Total Moves: {gameState.moves}</text>
              <text color="#b7cad5">Time Spent: {minutes}m {seconds}s</text>
              <text size="medium" color="#b7cad5">Word Chain:</text>
              <vstack padding="small" gap="small">
                {Array.from({ length: Math.ceil(gameState.wordChain.length / 4) }).map((_, rowIndex) => (
                  <hstack key={`row-${rowIndex}`} gap="small">
                    {gameState.wordChain.slice(rowIndex * 4, rowIndex * 4 + 4).map((word, colIndex) => {
                      const wordIndex = rowIndex * 4 + colIndex;
                      return (
                        <text key={wordIndex.toString()} size="small" color="#b7cad5">{wordIndex + 1}. {word}</text>
                      );
                    })}
                  </hstack>
                ))}
              </vstack>
            </vstack>
          </hstack>

          <spacer size="medium" />

          <button appearance="primary" onPress={() => initializeGame('start')}>
            Play Again
          </button>
        </vstack>
      </zstack>
    );
  }

  // Default return (should never reach here)
  return null;
};

// ---------------------------------------------------------------------------------------------------------------------------------------

// ! Post preview component for faster initial load

const PostPreview = () => (
  <zstack width="100%" height="100%" backgroundColor="#1e262b">
    <vstack alignment="center middle" height="100%" width="100%">
      <text size="large" color="#b7cad5">Rocket Word Odyssey</text>
      <text size="medium" color="#b7cad5">Loading game...</text>
      <image
        url="rocket.gif"
        description="Animated rocket"
        imageWidth={80}
        imageHeight={80}
      />
    </vstack>
  </zstack>
);

// ---------------------------------------------------------------------------------------------------------------------------------------

// Add a menu item to the subreddit menu for on-demand games
Devvit.addMenuItem({
  label: 'Play Word Puzzle',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    ui.showToast("Creating Word Puzzle Game...");

    const subreddit = await reddit.getCurrentSubreddit();
    const post = await reddit.submitPost({
      title: 'Word Puzzle Challenge',
      subredditName: subreddit.name,
      preview: <PostPreview />,
    });
    ui.navigateTo(post);
  },
});

// Add a post type definition
Devvit.addCustomPostType({
  name: 'Word Puzzle Game',
  height: 'tall',
  render: WordPuzzleGame,
});

// Add a scheduler job to create daily posts at 9am
Devvit.addSchedulerJob({
  name: 'create_daily_challenge',
  onRun: async (_, context) => {
    try {
      const subreddit = await context.reddit.getCurrentSubreddit();
      const today = new Date();
      const formattedDate = today.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

      // Create a new post with today's date
      const post = await context.reddit.submitPost({
        title: `Daily Word Puzzle Challenge - ${formattedDate}`,
        subredditName: subreddit.name,
        preview: <PostPreview />,
      });

      console.log(`Created daily challenge for ${formattedDate} with post ID: ${post.id}`);

      // Optional: Add a comment with instructions
      await context.reddit.submitComment({
        id: post.id,
        text: "Welcome to today's word puzzle challenge! Can you solve it with the fewest moves? Share your solutions in the comments!"
      });
    } catch (e) {
      console.error('Error creating daily challenge post:', e);
    }
  }
});

// Set up the app installation trigger
Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (_, context) => {
    try {
      // Create the first challenge immediately
      await context.scheduler.runJob({
        name: 'create_daily_challenge',
        runAt: new Date(),
      });

      // Schedule the daily challenge creation at 9am
      const jobId = await context.scheduler.runJob({
        name: 'create_daily_challenge',
        cron: '0 9 * * *', // Run at 9am every day
      });

      // Store the job ID for potential cancellation later
      await context.redis.set('daily_challenge_jobId', jobId);

      console.log('App installation completed, daily challenge scheduled');
    } catch (e) {
      console.error('Error during app installation:', e);
      throw e;
    }
  }
});

export default Devvit;