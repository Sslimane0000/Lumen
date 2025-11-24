// FSRS v4.5 Scheduler Implementation
// Based on the Free Spaced Repetition Scheduler algorithm
// Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm

export const Rating = {
    Again: 1,
    Hard: 2,
    Good: 3,
    Easy: 4,
};

export const State = {
    New: 0,
    Learning: 1,
    Review: 2,
    Relearning: 3,
};

// Default parameters for FSRS v4.5 (17 weights)
const w = [
    0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031,
    1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755
];

// FSRS v4.5 Constants
const DECAY = -0.5;
const FACTOR = 19 / 81;
const DEFAULT_REQUEST_RETENTION = 0.9;
const MAXIMUM_INTERVAL = 36500; // days

export const createEmptyCard = () => ({
    due: new Date(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: State.New,
    last_review: null,
});

export const scheduleCard = (card, rating, requestRetention = 0.9, now = new Date()) => {
    const newCard = { ...card, last_review: now };

    if (card.state === State.New) {
        // First review
        newCard.elapsed_days = 0;
        newCard.difficulty = initDifficulty(rating);
        newCard.stability = initStability(rating);
        newCard.state = State.Learning;
    } else {
        // Subsequent review
        const lastReview = new Date(card.last_review);
        newCard.elapsed_days = Math.max(0, (now - lastReview) / (24 * 60 * 60 * 1000));

        const retrievability = calcRetrievability(card.stability, newCard.elapsed_days);

        newCard.difficulty = nextDifficulty(card.difficulty, rating);
        newCard.stability = nextStability(card, rating, retrievability);

        if (rating === Rating.Again) {
            newCard.state = State.Relearning;
            newCard.lapses += 1;
        } else if (card.state === State.Learning || card.state === State.Relearning) {
            newCard.state = State.Review;
        }
    }

    newCard.reps += 1;

    // Calculate next interval (in days)
    const interval = rating === Rating.Again
        ? 0 // Re-review in 1 minute
        : nextInterval(newCard.stability, requestRetention);

    newCard.scheduled_days = interval;
    const dueDate = new Date(now);
    if (rating === Rating.Again) {
        dueDate.setMinutes(dueDate.getMinutes() + 1);
    } else {
        dueDate.setDate(dueDate.getDate() + interval);
    }
    newCard.due = dueDate;

    return newCard;
};

// Calculate retrievability using FSRS v4.5 formula
// R(t,S) = (1 + FACTOR * t/S)^DECAY
const calcRetrievability = (stability, elapsed_days) => {
    if (stability === 0) return 0;
    return Math.pow(1 + FACTOR * (elapsed_days / stability), DECAY);
};

// Calculate next interval using FSRS v4.5 formula
// I(r,S) = (S/FACTOR) * (r^(1/DECAY) - 1)
const nextInterval = (stability, requestRetention) => {
    const interval = (stability / FACTOR) * (Math.pow(requestRetention, 1 / DECAY) - 1);
    return Math.min(Math.max(1, Math.round(interval)), MAXIMUM_INTERVAL);
};

// Initial stability based on rating (first review)
const initStability = (rating) => {
    return Math.max(0.1, w[rating - 1]);
};

// Initial difficulty based on rating (first review)
const initDifficulty = (rating) => {
    return Math.max(1, Math.min(10, w[4] - w[5] * (rating - 3)));
};

// Update difficulty
const nextDifficulty = (d, rating) => {
    const delta_d = -w[6] * (rating - 3);
    const mean_reversion = w[7] * (w[4] - d);
    const next_d = d + delta_d + mean_reversion;
    return Math.max(1, Math.min(10, next_d));
};

// Update stability
const nextStability = (card, rating, retrievability) => {
    const { difficulty, stability, state } = card;

    if (rating === Rating.Again) {
        // Lapse: stability decreases
        const new_s = w[11] * Math.pow(difficulty, -w[12]) *
            (Math.pow(stability + 1, w[13]) - 1) *
            Math.exp(w[14] * (1 - retrievability));
        return Math.max(0.1, new_s);
    }

    // Successful review: stability increases
    let hard_penalty = 1;
    let easy_bonus = 1;

    if (rating === Rating.Hard) {
        hard_penalty = w[15];
    } else if (rating === Rating.Easy) {
        easy_bonus = w[16];
    }

    const SInc = hard_penalty * easy_bonus *
        Math.exp(w[8]) *
        (11 - difficulty) *
        Math.pow(stability, -w[9]) *
        (Math.exp(w[10] * (1 - retrievability)) - 1);

    return stability * (1 + SInc);
};
