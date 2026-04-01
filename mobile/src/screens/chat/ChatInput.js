import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import AudioRecorder from '../../components/AudioRecorder';
import AnimatedSendButton from '../../components/chat/AnimatedSendButton';
import { theme } from '../../styles/theme';

/**
 * ChatInput component - Handles message input with text, GIF, and voice recording
 *
 * @param {Object} props
 * @param {string} props.messageText - Current text input value
 * @param {Function} props.onTextChange - Handler for text input changes
 * @param {Function} props.onSend - Handler for sending text message
 * @param {Function} props.onGifPress - Handler for opening GIF picker
 * @param {boolean} props.isRecording - Whether audio is being recorded
 * @param {Function} props.onRecordingStart - Handler for when recording starts
 * @param {Function} props.onRecordingComplete - Handler for when recording completes (uri, duration, waveform)
 * @param {Function} props.onRecordingCancel - Handler for when recording is cancelled
 * @param {Function} props.onRecordingError - Handler for recording errors
 * @param {boolean} props.isSending - Whether a message is being sent
 * @param {boolean} props.isUploadingAudio - Whether audio is being uploaded
 * @param {Object} props.inputRef - Ref for the TextInput
 */
const ChatInput = ({
  messageText,
  onTextChange,
  onSend,
  onGifPress,
  isRecording,
  onRecordingStart,
  onRecordingComplete,
  onRecordingCancel,
  onRecordingError,
  isSending,
  isUploadingAudio,
  inputRef,
}) => {
  const showSendButton = messageText.trim() && !isRecording;

  return (
    <View style={styles.inputContainer}>
      {/* Hide GIF and input when recording */}
      {!isRecording && (
        <>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={onGifPress}
            disabled={isUploadingAudio}
          >
            <Text style={[styles.gifButtonText, isUploadingAudio && styles.disabledText]}>GIF</Text>
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.messageInput}
            placeholder={isUploadingAudio ? 'Sending voice message...' : 'Type a message...'}
            value={messageText}
            onChangeText={onTextChange}
            multiline
            maxLength={500}
            editable={!isUploadingAudio}
          />
        </>
      )}

      {/* Show send button when has text, otherwise show AudioRecorder */}
      {showSendButton ? (
        <AnimatedSendButton
          onSend={onSend}
          disabled={!messageText.trim() || isSending}
          iconColor={theme.colors.primary}
        />
      ) : (
        <AudioRecorder
          onRecordingComplete={onRecordingComplete}
          onRecordingStart={onRecordingStart}
          onRecordingCancel={onRecordingCancel}
          onError={onRecordingError}
          disabled={isSending || isUploadingAudio}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: theme.colors.background.primary,
  },
  attachButton: {
    paddingBottom: 4,
    paddingRight: 8,
    justifyContent: 'center',
  },
  gifButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.secondary,
  },
  disabledText: {
    opacity: 0.4,
  },
  messageInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    fontSize: 15,
  },
});

export default ChatInput;
