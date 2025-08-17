import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const OnboardingScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to Hantibink!',
      subtitle: 'The Armenian dating community',
      icon: 'heart',
      description: 'Connect with Armenian singles who share your culture and values.',
    },
    {
      title: 'Create Your Profile',
      subtitle: 'Show your best self',
      icon: 'person',
      description: 'Add photos and tell your story to attract meaningful connections.',
    },
    {
      title: 'Start Swiping',
      subtitle: 'Find your match',
      icon: 'people',
      description: "Swipe right on profiles you like and left on those you don't.",
    },
    {
      title: 'Start Chatting',
      subtitle: 'Build connections',
      icon: 'chatbubbles',
      description: 'When you match, start a conversation and see where it leads.',
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Navigate to main app
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    }
  };

  const skipOnboarding = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  const currentStepData = steps[currentStep];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.skipButton} onPress={skipOnboarding}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name={currentStepData.icon} size={80} color="#FF6B6B" />
          </View>

          <Text style={styles.title}>{currentStepData.title}</Text>
          <Text style={styles.subtitle}>{currentStepData.subtitle}</Text>
          <Text style={styles.description}>{currentStepData.description}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.stepIndicator}>
            {steps.map((_, index) => (
              <View
                key={index}
                style={[styles.stepDot, index === currentStep && styles.stepDotActive]}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
            <Text style={styles.nextButtonText}>
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  header: {
    alignItems: 'flex-end',
    marginTop: 40,
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    color: '#666',
    fontSize: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  stepDotActive: {
    backgroundColor: '#FF6B6B',
  },
  nextButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
});

export default OnboardingScreen;
