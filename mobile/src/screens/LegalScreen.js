import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

const LegalScreen = ({ route, navigation }) => {
  const { type = 'privacy' } = route.params || {};

  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';
  const lastUpdated = 'January 3, 2026';

  const renderPrivacyPolicy = () => (
    <>
      <Text style={styles.sectionTitle}>1. Information We Collect</Text>
      <Text style={styles.paragraph}>
        When you use Hantibink, we collect information you provide directly, including:
      </Text>
      <Text style={styles.bulletPoint}>
        • Account information (name, email, date of birth, gender)
      </Text>
      <Text style={styles.bulletPoint}>• Profile information (photos, bio, interests)</Text>
      <Text style={styles.bulletPoint}>• Location data (with your permission)</Text>
      <Text style={styles.bulletPoint}>• Messages and communications with other users</Text>
      <Text style={styles.bulletPoint}>• Usage data and app interactions</Text>

      <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
      <Text style={styles.paragraph}>We use your information to:</Text>
      <Text style={styles.bulletPoint}>• Create and maintain your account</Text>
      <Text style={styles.bulletPoint}>• Show you potential matches based on your preferences</Text>
      <Text style={styles.bulletPoint}>• Enable messaging between matched users</Text>
      <Text style={styles.bulletPoint}>• Improve our services and user experience</Text>
      <Text style={styles.bulletPoint}>• Send important service notifications</Text>
      <Text style={styles.bulletPoint}>• Ensure safety and prevent fraud</Text>

      <Text style={styles.sectionTitle}>3. Location Data</Text>
      <Text style={styles.paragraph}>
        We collect location data to show you nearby users and calculate distances. You can control
        location permissions in your device settings. If you disable location services, some
        features like distance-based discovery may not work.
      </Text>

      <Text style={styles.sectionTitle}>4. Information Sharing</Text>
      <Text style={styles.paragraph}>We share your information only in these circumstances:</Text>
      <Text style={styles.bulletPoint}>
        • With other users (only the profile information you choose to share)
      </Text>
      <Text style={styles.bulletPoint}>
        • With service providers who help us operate the app (hosting, analytics)
      </Text>
      <Text style={styles.bulletPoint}>• When required by law or to protect safety</Text>
      <Text style={styles.bulletPoint}>• With your explicit consent</Text>

      <Text style={styles.sectionTitle}>5. Data Security</Text>
      <Text style={styles.paragraph}>
        We implement industry-standard security measures to protect your data, including encryption
        of data in transit and at rest. However, no method of transmission over the internet is 100%
        secure.
      </Text>

      <Text style={styles.sectionTitle}>6. Data Retention</Text>
      <Text style={styles.paragraph}>
        We retain your data while your account is active. If you delete your account, we will delete
        your personal data within 30 days, except where retention is required by law.
      </Text>

      <Text style={styles.sectionTitle}>7. Your Rights</Text>
      <Text style={styles.paragraph}>You have the right to:</Text>
      <Text style={styles.bulletPoint}>• Access your personal data</Text>
      <Text style={styles.bulletPoint}>• Correct inaccurate data</Text>
      <Text style={styles.bulletPoint}>• Delete your account and data</Text>
      <Text style={styles.bulletPoint}>• Export your data</Text>
      <Text style={styles.bulletPoint}>• Opt out of marketing communications</Text>

      <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
      <Text style={styles.paragraph}>
        Hantibink is not intended for users under 18 years of age. We do not knowingly collect
        information from children under 18.
      </Text>

      <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
      <Text style={styles.paragraph}>
        We may update this Privacy Policy from time to time. We will notify you of significant
        changes through the app or via email.
      </Text>

      <Text style={styles.sectionTitle}>10. Contact Us</Text>
      <Text style={styles.paragraph}>
        If you have questions about this Privacy Policy or your data, please contact us at:
        {'\n'}support@hantibink.com
      </Text>
    </>
  );

  const renderTermsOfService = () => (
    <>
      <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
      <Text style={styles.paragraph}>
        By creating an account or using Hantibink, you agree to these Terms of Service. If you do
        not agree, please do not use our services.
      </Text>

      <Text style={styles.sectionTitle}>2. Eligibility</Text>
      <Text style={styles.paragraph}>To use Hantibink, you must:</Text>
      <Text style={styles.bulletPoint}>• Be at least 18 years old</Text>
      <Text style={styles.bulletPoint}>• Be legally able to enter into a binding contract</Text>
      <Text style={styles.bulletPoint}>
        • Not be prohibited from using the service under any law
      </Text>
      <Text style={styles.bulletPoint}>
        • Not have been previously banned from Hantibink for violating our terms
      </Text>

      <Text style={styles.sectionTitle}>3. Your Account</Text>
      <Text style={styles.paragraph}>You are responsible for:</Text>
      <Text style={styles.bulletPoint}>• Providing accurate and current information</Text>
      <Text style={styles.bulletPoint}>• Maintaining the security of your account</Text>
      <Text style={styles.bulletPoint}>• All activity that occurs under your account</Text>
      <Text style={styles.bulletPoint}>• Notifying us immediately of unauthorized access</Text>

      <Text style={styles.sectionTitle}>4. Community Guidelines</Text>
      <Text style={styles.paragraph}>When using Hantibink, you agree NOT to:</Text>
      <Text style={styles.bulletPoint}>• Use fake photos or misrepresent your identity</Text>
      <Text style={styles.bulletPoint}>• Harass, bully, or intimidate other users</Text>
      <Text style={styles.bulletPoint}>• Send spam, solicitations, or commercial content</Text>
      <Text style={styles.bulletPoint}>• Share illegal, offensive, or inappropriate content</Text>
      <Text style={styles.bulletPoint}>
        • Use the service for any illegal or unauthorized purpose
      </Text>
      <Text style={styles.bulletPoint}>
        • Attempt to hack, reverse engineer, or disrupt the service
      </Text>
      <Text style={styles.bulletPoint}>• Create multiple accounts</Text>
      <Text style={styles.bulletPoint}>• Collect user information without consent</Text>

      <Text style={styles.sectionTitle}>5. Content You Share</Text>
      <Text style={styles.paragraph}>
        You retain ownership of content you share but grant Hantibink a license to use, display, and
        distribute it within the service. You represent that you have the right to share any content
        you post.
      </Text>

      <Text style={styles.sectionTitle}>6. Safety</Text>
      <Text style={styles.paragraph}>
        While we work to maintain a safe community, we cannot guarantee the behavior of other users.
        You are responsible for your own safety when meeting people you connect with through
        Hantibink. We recommend:
      </Text>
      <Text style={styles.bulletPoint}>• Meeting in public places for first dates</Text>
      <Text style={styles.bulletPoint}>• Telling a friend where you're going</Text>
      <Text style={styles.bulletPoint}>• Trusting your instincts if something feels wrong</Text>
      <Text style={styles.bulletPoint}>• Reporting suspicious behavior to us</Text>

      <Text style={styles.sectionTitle}>7. Reporting and Blocking</Text>
      <Text style={styles.paragraph}>
        You can report or block other users at any time. We take reports seriously and will
        investigate violations of our terms. We reserve the right to suspend or terminate accounts
        that violate these terms.
      </Text>

      <Text style={styles.sectionTitle}>8. Service Availability</Text>
      <Text style={styles.paragraph}>
        We strive to keep Hantibink available but do not guarantee uninterrupted service. We may
        modify, suspend, or discontinue features at any time.
      </Text>

      <Text style={styles.sectionTitle}>9. Disclaimers</Text>
      <Text style={styles.paragraph}>
        Hantibink is provided "as is" without warranties of any kind. We do not guarantee you will
        find matches or that matches will meet your expectations. We are not responsible for the
        conduct of users on or off the platform.
      </Text>

      <Text style={styles.sectionTitle}>10. Limitation of Liability</Text>
      <Text style={styles.paragraph}>
        To the maximum extent permitted by law, Hantibink shall not be liable for any indirect,
        incidental, special, or consequential damages arising from your use of the service.
      </Text>

      <Text style={styles.sectionTitle}>11. Changes to Terms</Text>
      <Text style={styles.paragraph}>
        We may update these Terms from time to time. Continued use of the service after changes
        constitutes acceptance of the new terms.
      </Text>

      <Text style={styles.sectionTitle}>12. Governing Law</Text>
      <Text style={styles.paragraph}>
        These Terms are governed by the laws of the State of California, United States, without
        regard to conflict of law principles.
      </Text>

      <Text style={styles.sectionTitle}>13. Contact</Text>
      <Text style={styles.paragraph}>
        For questions about these Terms, contact us at:
        {'\n'}support@hantibink.com
      </Text>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>

        {isPrivacy ? renderPrivacyPolicy() : renderTermsOfService()}

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: theme.colors.primary,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#888',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletPoint: {
    fontSize: 15,
    color: '#555',
    lineHeight: 24,
    marginLeft: 16,
  },
  spacer: {
    height: 40,
  },
});

export default LegalScreen;
