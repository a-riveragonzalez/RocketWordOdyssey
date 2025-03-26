// Learn more at developers.reddit.com/docs
import { Devvit, useState, useForm } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
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

// ! Word Validation Functions 

// todo Word validation helper with caching to reduce API calls
const validateWord = async (word: string, context: Devvit.Context): Promise<boolean> => {
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
      ttl: 7 * 24 * 60 * 60 * 1000, // Cache for 7 days - dictionary words don't change often
    }
  );
};

// Check if two words differ by exactly one letter
const differsBy1Letter = (word1: string, word2: string): boolean => {
  if (word1.length !== word2.length) return false;

  let differences = 0;
  for (let i = 0; i < word1.length; i++) {
    if (word1[i] !== word2[i]) differences++;
    if (differences > 1) return false;
  }

  return differences === 1;
};

// ---------------------------------------------------------------------------------------------------------------------------------------

// ! Main game component

const WordPuzzleGame: Devvit.CustomPostComponent = (context) => {
  // Performance tracking
  const [renderStart] = useState(Date.now());

  // Game configuration - could be fetched from a configuration store
  const [gameConfig] = useState({
    startWord: 'COLD',
    targetWord: 'WARM',
  });

  // Game screen state
  const [screen, setScreen] = useState<Screen>('start');

  // Input state for the custom input field
  const [inputWord, setInputWord] = useState<string>('');

  // Animation state for the rocket
  const [rocketFrame, setRocketFrame] = useState<number>(0);

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
          required: true,
          helpText: `Must differ by exactly one letter from the current word`,
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

  // Log performance after initial render
  console.log(`Initial render took: ${Date.now() - renderStart} milliseconds`);

  // todo Show instructions when the info button is pressed
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

      // Start rocket animation
      const interval = setInterval(() => {
        setRocketFrame(prev => (prev + 1) % 3); // Assuming 3 frames for animation
      }, 300);

      // Store interval ID for cleanup - use regular JavaScript setTimeout
      setTimeout(() => clearInterval(interval), 30 * 60 * 1000); // Auto-cleanup after 30 minutes
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

    // Performance tracking for word validation
    const validationStart = Date.now();

    // Validate against dictionary API (with caching)
    const isValid = await validateWord(processedWord, context);

    console.log(`Word validation took: ${Date.now() - validationStart} milliseconds`);

    // // for testing 
    // if (!isValid) {
    //   setGameState({
    //     ...gameState,
    //     error: 'Not a valid word.'
    //   });
    //   return;
    // }

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
  // if (screen === 'start') {
  //   return (
  //     <vstack height="100%" width="100%" padding="large" gap="medium" alignment="center middle" backgroundColor="#f5f5f5">
  //       <image url="space_background.jpg" imageWidth={400} imageHeight={300} />
  //       <text size="xxlarge" weight="bold">Word Chain Puzzle</text>
  //       <text size="medium">Transform "{gameState.startWord}" into "{gameState.targetWord}" one letter at a time!</text>

  //       <spacer size="medium" />

  //       <hstack gap="small">
  //         <button appearance="primary" onPress={() => initializeGame('game')}>
  //           Play Game
  //         </button>
  //         <button onPress={() => showInstructions()}>
  //           How to Play
  //         </button>
  //       </hstack>
  //     </vstack>
  //   );
  // }
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
          <text size="xxlarge" weight="bold">Word Chain Puzzle</text>
          <spacer size="small" />

          <text size="medium">Transform "{gameState.startWord}" into "{gameState.targetWord}" one letter at a time!</text>

          <spacer size="large" />

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
  // <vstack height="100%" width="100%" padding="large" gap="medium" alignment="center middle">
  //   {/* Background image layer */}
  //   <image 
  //     url="space_background.jpg" 
  //     imageWidth={1000} 
  //     imageHeight={1000} 
  //     height="100%"
  //     width="100%"
  //     position="absolute" 
  //     top={0} 
  //     left={0} 
  //     zIndex={-1}
  //   />

  //   {/* Content layer */}
  //   <vstack 
  //     height="100%" 
  //     width="100%" 
  //     padding="large" 
  //     gap="medium" 
  //     alignment="center middle" 
  //     backgroundColor="rgba(245, 245, 245, 0.7)" // Semi-transparent background
  //     cornerRadius="medium"
  //   >
  //     <text size="xxlarge" weight="bold">Word Chain Puzzle</text>
  //     <text size="medium">Transform "{gameState.startWord}" into "{gameState.targetWord}" one letter at a time!</text>

  //     <spacer size="medium" />

  //     <hstack gap="small">
  //       <button appearance="primary" onPress={() => initializeGame('game')}>
  //         Play Game
  //       </button>
  //       <button onPress={() => showInstructions()}>
  //         How to Play
  //       </button>
  //     </hstack>
  //   </vstack>
  // </vstack>
  // ---------------------------------------------------------------------------------------------------------------------------------------

  // Game Screen
  if (screen === 'game') {
    const rocketImages = [
      "rocket_1.gif", // You would need to have these images uploaded to your app's assets
      "rocket_2.gif",
      "rocket_3.gif",
    ];

    return (
      <vstack height="100%" width="100%" padding="medium" gap="medium" backgroundColor="#f0f7ff">
        <hstack width="100%" gap="large" alignment="top center">
          <text>Moves: {gameState.moves}</text>
          <button
            icon="info"
            appearance="secondary"
            onPress={() => showInstructions()}
          />
        </hstack>

        <vstack gap="small" alignment="center middle" grow>
          <text size="large">Target Word: {gameState.targetWord}</text>
          <text size="xlarge" weight="bold">{gameState.currentWord}</text>

          {/* Custom input using standard text components */}
          <hstack width="80%" alignment="center middle" gap="small" border="thin" cornerRadius="medium" padding="small">
            {/* Since textInput doesn't exist, we'll simulate it with a button that shows a form */}
            <text>{inputWord || 'Enter new word...'}</text>
            <spacer grow />
            <button
              icon="edit"
              appearance="secondary"
              onPress={() => {
                // Show the form using the useForm hook
                context.ui.showForm(wordInputForm);
              }}
            />
            <button
              icon="search"
              appearance="primary"
              onPress={() => submitWord(inputWord)}
            />
          </hstack>

          {gameState.error && <text color="red" size="small">{gameState.error}</text>}

          <image
            url="rocket.gif" // Or use rocketImages[rocketFrame] for animated frames
            description="Animated rocket"
            imageWidth={100}
            imageHeight={100}
          />

          <spacer size="medium" />

          <text size="medium">Word Chain:</text>
          <vstack padding="small" gap="small" width="80%">
            {gameState.wordChain.map((word, index) => (
              <text key={index.toString()}>{index + 1}. {word}</text>
            ))}
          </vstack>
        </vstack>
      </vstack>
    );
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------

  // Complete Screen
  if (screen === 'complete') {
    const timeSpentSeconds = Math.floor(((gameState.endTime || 0) - (gameState.startTime || 0)) / 1000);
    const minutes = Math.floor(timeSpentSeconds / 60);
    const seconds = timeSpentSeconds % 60;

    return (
      <vstack height="100%" width="100%" padding="large" gap="medium" alignment="center middle" backgroundColor="#f0fff0">
        <text size="xxlarge" weight="bold">Congratulations!</text>
        <text size="large">You solved the puzzle!</text>

        <spacer size="medium" />

        <vstack padding="large" gap="medium" cornerRadius="medium" border="thin" width="80%">
          <text size="large" weight="bold">Game Stats</text>
          <text>Total Moves: {gameState.moves}</text>
          <text>Time Spent: {minutes}m {seconds}s</text>

          <text size="medium">Word Chain:</text>
          <vstack padding="small" gap="small">
            {gameState.wordChain.map((word, index) => (
              <text key={index.toString()}>{index + 1}. {word}</text>
            ))}
          </vstack>
        </vstack>

        <spacer size="medium" />

        <button appearance="primary" onPress={() => initializeGame('start')}>
          Play Again
        </button>
      </vstack>
    );
  }

  // Default return (should never reach here)
  return null;
};

// ---------------------------------------------------------------------------------------------------------------------------------------

// ! Post preview component for faster initial load

const PostPreview = () => (
  <vstack height="100%" width="100%" padding="large" alignment="middle center" backgroundColor="#f5f5f5">
    <text size="large">Word Chain Puzzle</text>
    <text size="medium">Loading game...</text>
    <image
      url="rocket.gif"
      description="Animated rocket"
      imageWidth={80}
      imageHeight={80}
    />
  </vstack>
);

// ---------------------------------------------------------------------------------------------------------------------------------------

// ! 

// Add a menu item to the subreddit menu
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

export default Devvit;