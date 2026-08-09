/**
 * In-chat games UI: picker modal, active-game bar, and the interactive
 * GameMessageCard rendered inside the chat thread. The server's `view` is
 * already redacted per viewer — these components only render it.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../styles/theme';

export const GAME_META = {
  THIS_OR_THAT: {
    label: 'This or That',
    icon: 'swap-horizontal',
    tagline: 'Quick picks, instant compatibility',
  },
  TWO_TRUTHS: {
    label: 'Two Truths & a Lie',
    icon: 'help-circle',
    tagline: 'Can they spot your lie?',
  },
  QUESTION_ROULETTE: {
    label: 'Question Roulette',
    icon: 'chatbubbles',
    tagline: 'Same question, simultaneous reveal',
  },
  EMOJI_RIDDLE: {
    label: 'Emoji Riddle',
    icon: 'happy',
    tagline: 'Guess it from the emoji',
  },
};

const makeMoveId = () => `mv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

/* --------------------------- Picker (modal) --------------------------- */

export const GamePickerSheet = ({ visible, onClose, onPick }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.pickerContainer}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.pickerContent}>
        <Text style={styles.pickerTitle}>Break the ice 🧊</Text>
        <Text style={styles.pickerSubtitle}>Play right here in the chat</Text>
        {Object.entries(GAME_META).map(([type, meta]) => (
          <TouchableOpacity
            key={type}
            style={styles.pickerRow}
            onPress={() => {
              Haptics.selectionAsync();
              onPick(type);
            }}
          >
            <View style={styles.pickerIcon}>
              <Ionicons name={meta.icon} size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.pickerRowText}>
              <Text style={styles.pickerRowTitle}>{meta.label}</Text>
              <Text style={styles.pickerRowTagline}>{meta.tagline}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.text.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </Modal>
);

/* ------------------------ Two Truths composer ------------------------- */

export const TwoTruthsComposer = ({ visible, onClose, onSubmit }) => {
  const [statements, setStatements] = useState(['', '', '']);
  const [lieIndex, setLieIndex] = useState(null);
  const valid = statements.every(s => s.trim()) && lieIndex !== null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.pickerContainer}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.pickerContent}>
          <Text style={styles.pickerTitle}>Two Truths & a Lie</Text>
          <Text style={styles.pickerSubtitle}>
            Write three statements, then tap the one that's the lie
          </Text>
          {statements.map((statement, index) => (
            <View key={index} style={styles.composerRow}>
              <TextInput
                style={styles.composerInput}
                placeholder={`Statement ${index + 1}`}
                placeholderTextColor={theme.colors.text.muted}
                value={statement}
                maxLength={140}
                onChangeText={text =>
                  setStatements(prev => prev.map((s, i) => (i === index ? text : s)))
                }
              />
              <TouchableOpacity
                style={[styles.lieToggle, lieIndex === index && styles.lieToggleActive]}
                onPress={() => setLieIndex(index)}
              >
                <Text
                  style={[styles.lieToggleText, lieIndex === index && styles.lieToggleTextActive]}
                >
                  LIE
                </Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.primaryButton, !valid && styles.primaryButtonDisabled]}
            disabled={!valid}
            onPress={() => {
              onSubmit({ statements: statements.map(s => s.trim()), lieIndex });
              setStatements(['', '', '']);
              setLieIndex(null);
            }}
          >
            <Text style={styles.primaryButtonText}>Send challenge</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

/* --------------------------- Active game bar -------------------------- */

const turnLabel = (session, myId) => {
  const { gameType, view } = session;
  if (gameType === 'THIS_OR_THAT') {
    const round = view.rounds?.[view.currentRound];
    if (!round) {
      return 'Finishing up…';
    }
    return round.myPick
      ? `Waiting for their pick — round ${view.currentRound + 1}/${view.totalRounds}`
      : `Your pick — round ${view.currentRound + 1}/${view.totalRounds}`;
  }
  if (gameType === 'TWO_TRUTHS') {
    return view.players?.creatorId === myId ? 'Waiting for their guess…' : 'Spot the lie!';
  }
  if (gameType === 'QUESTION_ROULETTE') {
    return view.answers && view.answers[myId] ? 'Waiting for their answer…' : 'Your answer awaits';
  }
  if (gameType === 'EMOJI_RIDDLE') {
    if (view.phase === 'picking') {
      return view.players?.creatorId === myId ? 'Confirm your riddle' : 'Riddle incoming…';
    }
    return view.players?.creatorId === myId ? 'They are guessing…' : 'Your guess!';
  }
  return 'Game on';
};

export const ActiveGameBar = ({ session, myId, onPress }) => {
  if (!session || session.status !== 'ACTIVE') {
    return null;
  }
  const meta = GAME_META[session.gameType];
  return (
    <TouchableOpacity style={styles.bar} onPress={onPress}>
      <Ionicons name={meta.icon} size={16} color={theme.colors.primary} />
      <Text style={styles.barLabel} numberOfLines={1}>
        {meta.label} · {turnLabel(session, myId)}
      </Text>
      <Ionicons name="chevron-up" size={16} color={theme.colors.text.muted} />
    </TouchableOpacity>
  );
};

/* -------------------------- Per-game renderers ------------------------ */

const ThisOrThatBody = ({ view, canAct, onMove }) => {
  const round = view.rounds?.[view.currentRound];
  const finishedRounds = (view.rounds || []).filter(r => r.revealed);
  return (
    <View>
      {finishedRounds.length > 0 && (
        <View style={styles.totHistory}>
          {finishedRounds.map(r => (
            <View key={r.promptId} style={styles.totHistoryRow}>
              <Ionicons
                name={r.isMatch ? 'heart' : 'close-circle'}
                size={14}
                color={r.isMatch ? theme.colors.primary : theme.colors.text.muted}
              />
              <Text style={styles.totHistoryText} numberOfLines={1}>
                {r.a} / {r.b}
              </Text>
            </View>
          ))}
        </View>
      )}
      {round ? (
        <>
          <Text style={styles.cardPrompt}>
            Round {view.currentRound + 1} of {view.totalRounds}
          </Text>
          <View style={styles.totChoices}>
            {['A', 'B'].map(option => (
              <TouchableOpacity
                key={option}
                style={[styles.totChoice, round.myPick === option && styles.totChoiceActive]}
                disabled={!canAct || !!round.myPick}
                onPress={() => onMove({ type: 'pick', choice: option, clientMoveId: makeMoveId() })}
              >
                <Text
                  style={[
                    styles.totChoiceText,
                    round.myPick === option && styles.totChoiceTextActive,
                  ]}
                >
                  {option === 'A' ? round.a : round.b}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {round.myPick && !round.picks && (
            <Text style={styles.cardHint}>
              {round.opponentPicked ? 'Revealing…' : 'Waiting for their pick 👀'}
            </Text>
          )}
        </>
      ) : null}
    </View>
  );
};

const TwoTruthsBody = ({ view, myId, onMove }) => {
  const isAuthor = view.players?.creatorId === myId;
  const done = view.phase === 'done';
  return (
    <View>
      <Text style={styles.cardPrompt}>
        {done ? 'The reveal!' : isAuthor ? 'They are guessing your lie…' : 'Which one is the lie?'}
      </Text>
      {(view.statements || []).map((statement, index) => {
        const isLie = done && view.lieIndex === index;
        const wasGuess = done && view.guessIndex === index;
        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.statement,
              isLie && styles.statementLie,
              wasGuess && styles.statementGuess,
            ]}
            disabled={isAuthor || done}
            onPress={() => onMove({ type: 'guess', index, clientMoveId: makeMoveId() })}
          >
            <Text style={styles.statementText}>{statement}</Text>
            {isLie && <Text style={styles.statementTag}>THE LIE</Text>}
            {wasGuess && !isLie && <Text style={styles.statementTagMiss}>their guess</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const RouletteBody = ({ view, myId, onMove }) => {
  const [draft, setDraft] = useState('');
  const answered = !!(view.answers && view.answers[myId]);
  return (
    <View>
      <Text style={styles.cardPrompt}>{view.question}</Text>
      {view.revealed ? (
        Object.entries(view.answers).map(([userId, answer]) => (
          <View key={userId} style={styles.answerBubble}>
            <Text style={styles.answerAuthor}>{userId === myId ? 'You' : 'Them'}</Text>
            <Text style={styles.answerText}>{answer}</Text>
          </View>
        ))
      ) : answered ? (
        <Text style={styles.cardHint}>
          {view.opponentAnswered
            ? 'Revealing…'
            : 'Answered! Waiting for theirs — reveal is simultaneous 🤝'}
        </Text>
      ) : (
        <>
          <TextInput
            style={styles.answerInput}
            placeholder="Your answer (they can't see it early)"
            placeholderTextColor={theme.colors.text.muted}
            value={draft}
            onChangeText={setDraft}
            maxLength={280}
            multiline
          />
          <TouchableOpacity
            style={[styles.primaryButton, !draft.trim() && styles.primaryButtonDisabled]}
            disabled={!draft.trim()}
            onPress={() =>
              onMove({ type: 'answer', text: draft.trim(), clientMoveId: makeMoveId() })
            }
          >
            <Text style={styles.primaryButtonText}>Lock it in</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const EmojiRiddleBody = ({ view, myId, onMove }) => {
  const [draft, setDraft] = useState('');
  const isCreator = view.players?.creatorId === myId;
  const done = view.phase === 'done';
  const attemptsLeft = (view.maxAttempts || 3) - (view.attempts?.length || 0);
  return (
    <View>
      <Text style={styles.riddleEmoji}>{view.emoji}</Text>
      {view.phase === 'picking' ? (
        isCreator ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => onMove({ type: 'confirm-riddle', clientMoveId: makeMoveId() })}
          >
            <Text style={styles.primaryButtonText}>Send this riddle</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.cardHint}>They're choosing a riddle…</Text>
        )
      ) : done ? (
        <Text style={styles.cardPrompt}>
          {view.solved ? `Solved! It was ${view.answer} 🎉` : `It was "${view.answer}" 🙈`}
        </Text>
      ) : isCreator ? (
        <Text style={styles.cardHint}>
          They have {attemptsLeft} {attemptsLeft === 1 ? 'guess' : 'guesses'} left…
        </Text>
      ) : (
        <>
          {view.category && <Text style={styles.cardHint}>Hint: it's a {view.category}</Text>}
          {(view.attempts || []).map((attempt, index) => (
            <Text key={index} style={styles.missedGuess}>
              ✗ {attempt.text}
            </Text>
          ))}
          <TextInput
            style={styles.answerInput}
            placeholder={`Your guess (${attemptsLeft} left)`}
            placeholderTextColor={theme.colors.text.muted}
            value={draft}
            onChangeText={setDraft}
            maxLength={100}
          />
          <TouchableOpacity
            style={[styles.primaryButton, !draft.trim() && styles.primaryButtonDisabled]}
            disabled={!draft.trim()}
            onPress={() => {
              onMove({ type: 'guess', text: draft.trim(), clientMoveId: makeMoveId() });
              setDraft('');
            }}
          >
            <Text style={styles.primaryButtonText}>Guess</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

/* ---------------------------- Game card shell ------------------------- */

const BODIES = {
  THIS_OR_THAT: ThisOrThatBody,
  TWO_TRUTHS: TwoTruthsBody,
  QUESTION_ROULETTE: RouletteBody,
  EMOJI_RIDDLE: EmojiRiddleBody,
};

/**
 * Interactive card rendered in the thread for the ACTIVE session's start
 * message. Ended sessions render their summary from message metadata.
 */
export const GameMessageCard = ({ metadata, session, myId, onMove, onDecline }) => {
  const meta = GAME_META[metadata.gameType] || {};

  // Summary card (game over)
  if (metadata.kind === 'game-summary') {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name={meta.icon || 'game-controller'} size={16} color={theme.colors.primary} />
          <Text style={styles.cardTitle}>{meta.label}</Text>
        </View>
        <Text style={styles.summaryTitle}>{metadata.summary?.title}</Text>
        <Text style={styles.summaryLine}>{metadata.summary?.line}</Text>
      </View>
    );
  }

  // Start card: live if this is still the active session, else a stub
  const isLive = session && session.id === metadata.sessionId && session.status === 'ACTIVE';
  const Body = BODIES[metadata.gameType];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name={meta.icon || 'game-controller'} size={16} color={theme.colors.primary} />
        <Text style={styles.cardTitle}>{meta.label}</Text>
        {isLive && session.createdBy !== myId && (
          <TouchableOpacity onPress={onDecline} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
        )}
      </View>
      {isLive && Body ? (
        <Body view={session.view} myId={myId} canAct onMove={onMove} />
      ) : (
        <Text style={styles.cardHint}>
          {session && session.id === metadata.sessionId
            ? `Game ${session.status?.toLowerCase() || 'over'}`
            : 'This game has ended'}
        </Text>
      )}
    </View>
  );
};

/* -------------------------------- Styles ------------------------------ */

const styles = StyleSheet.create({
  pickerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.overlay.medium },
  pickerContent: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '88%',
    maxWidth: 380,
  },
  pickerTitle: {
    fontSize: theme.typography.sizes.xxl,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  pickerSubtitle: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: theme.spacing.lg,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  pickerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  pickerRowText: { flex: 1 },
  pickerRowTitle: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
  },
  pickerRowTagline: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
  },
  composerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
  },
  lieToggle: {
    marginLeft: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.tertiary,
  },
  lieToggleActive: { backgroundColor: theme.colors.primary },
  lieToggleText: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.secondary,
  },
  lieToggleTextActive: { color: theme.colors.text.white },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryTint,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.light,
  },
  barLabel: {
    flex: 1,
    marginHorizontal: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
  },
  card: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    padding: theme.spacing.lg,
    marginVertical: theme.spacing.xs,
    maxWidth: '85%',
    alignSelf: 'center',
    width: '85%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  cardTitle: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  declineText: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.muted,
  },
  cardPrompt: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  cardHint: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  totChoices: { flexDirection: 'row', gap: theme.spacing.sm },
  totChoice: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  totChoiceActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryTint,
  },
  totChoiceText: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  totChoiceTextActive: { color: theme.colors.primary },
  totHistory: { marginBottom: theme.spacing.sm },
  totHistoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  totHistoryText: {
    marginLeft: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
  },
  statement: {
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background.primary,
  },
  statementLie: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryTint },
  statementGuess: { borderColor: theme.colors.secondaryLight },
  statementText: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
  },
  statementTag: {
    marginTop: 4,
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary,
  },
  statementTagMiss: {
    marginTop: 4,
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.secondaryLight,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: theme.colors.border.medium,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 44,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.primary,
    marginBottom: theme.spacing.sm,
  },
  answerBubble: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  answerAuthor: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  answerText: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
  },
  riddleEmoji: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  missedGuess: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    marginBottom: 2,
  },
  summaryTitle: {
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  summaryLine: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  primaryButtonDisabled: { opacity: 0.4 },
  primaryButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.bold,
  },
});
