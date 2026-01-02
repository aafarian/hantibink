import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

/**
 * Shared Premium Upgrade Modal
 * Shows premium features and upgrade CTA
 */
const PremiumUpgradeModal = ({ visible, onClose, onUpgrade }) => {
  const handleUpgrade = () => {
    onUpgrade?.();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.content}>
          <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.header}>
            <Ionicons name="star" size={40} color="white" />
            <Text style={styles.title}>Unlock Premium</Text>
          </LinearGradient>

          <View style={styles.features}>
            <View style={styles.featureItem}>
              <Ionicons name="eye" size={24} color={theme.colors.secondary} />
              <Text style={styles.featureText}>See who liked you</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="heart" size={24} color={theme.colors.primary} />
              <Text style={styles.featureText}>Unlimited likes</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="arrow-undo" size={24} color="#FFB300" />
              <Text style={styles.featureText}>Undo swipes</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="star" size={24} color="#00BCD4" />
              <Text style={styles.featureText}>5 Super Likes per day</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.accent]}
              style={styles.upgradeButtonGradient}
            >
              <Text style={styles.upgradeButtonText}>Get Premium</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 25,
    width: '85%',
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    padding: 30,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  features: {
    padding: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureText: {
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
  upgradeButton: {
    margin: 20,
  },
  upgradeButtonGradient: {
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
  },
});

export default PremiumUpgradeModal;
