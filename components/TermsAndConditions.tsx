import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { Check } from 'lucide-react-native';

interface TermsAndConditionsProps {
  onAccept: () => void;
}

const TERMS_CONTENT = `# GymCore Terms and Conditions

**Last Updated: January 5, 2026**

## 1. Acceptance of Terms

These Terms and Conditions ("Terms," "Agreement") constitute a legally binding agreement between you ("you," "your," or "User") and GymCore ("Company," "we," "us," or "our") governing your access to and use of the GymCore gym tracking and management application ("App") available at https://gymcore.beengg.space and any related services, features, and content provided by GymCore.

**Applicable Law:**
These Terms are governed by the laws of India, including but not limited to:
- Information Technology Act, 2000
- Consumer Protection Act, 2019
- Contract Act, 1872
- Indian Copyright Act, 1957
- Other applicable Indian laws and regulations

By creating an account, accessing, or using the App, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, you must not access or use the App.

## 2. Eligibility and Account Requirements

### 2.1 Age Requirements

To use GymCore, you must meet the following age requirements under Indian law:
- You must be at least 18 years old to create an account independently
- Users under 18 years old must have verifiable parental or guardian consent before using the App
- Parents/guardians are responsible for supervising minors' activity on the App

By using the App, you represent and warrant that you meet these age requirements and have the legal capacity to enter into this Agreement under Indian law.

### 2.2 Account Registration

To access certain features of the App, you must create an account by providing:
- Accurate, current, and complete information during registration
- A valid email address
- A secure password
- Other required information as prompted

You agree to:
- Keep your account information accurate and up-to-date
- Update information promptly when changes occur
- Not impersonate any person or entity
- Not create multiple accounts without authorization
- Not create an account if previously banned or terminated

### 2.3 Account Types

GymCore offers different account types with varying features and permissions:

**Gym Owner/Administrator Accounts:**
- Manage gym facilities, locations, and operations
- Access and manage member data, attendance, and analytics
- Assign trainers, coaches, and staff members
- Configure gym-specific settings and branding
- Process payments and manage memberships
- Generate reports and business analytics

**Gym Member Accounts:**
- Track personal workouts, exercises, and progress
- Log diet, nutrition, and meals
- Access personalized analytics and insights
- Connect with assigned trainers and coaches
- Participate in gym community features
- Check-in to gym using QR codes or location

**Trainer/Coach Accounts:**
- Manage assigned clients and members
- Create and modify workout plans
- View client progress and performance data
- Communicate with clients through the App
- Access training analytics and reports

### 2.4 Account Security

You are responsible for:
- Maintaining the confidentiality and security of your account credentials (username and password)
- All activities that occur under your account, whether authorized or not
- Ensuring your device is secure and protected
- Notifying us immediately at support@gymcore.beengg.space of any unauthorized access, use, or security breach
- Taking reasonable steps to prevent unauthorized access

We are not liable for any losses or damages arising from unauthorized use of your account if you fail to maintain security. You may be held liable for losses incurred by GymCore or other users due to unauthorized use of your account.

**Security Best Practices:**
- Use a strong, unique password
- Enable two-factor authentication if available
- Do not share your password with anyone
- Log out from shared or public devices
- Regularly update your password

### 2.5 Account Termination and Suspension

**Termination by You:**
- You may terminate your account at any time through account settings or by contacting beengg.space@gmail.com
- Termination does not relieve you of obligations incurred prior to termination
- Some data may be retained as described in our Privacy Policy and as required by Indian law

**Termination or Suspension by Us:**
We reserve the right to suspend, terminate, or restrict your account and access to the App, with or without notice, if you:
- Violate these Terms or our policies
- Provide false, misleading, or fraudulent information
- Engage in fraudulent activity or payment disputes
- Abuse, harass, threaten, or harm other users
- Violate applicable laws or regulations
- Infringe intellectual property rights
- Attempt to hack, disrupt, or compromise the App's security
- Use the App for unauthorized commercial purposes
- Create multiple accounts to circumvent restrictions
- Engage in spam, phishing, or malicious activities

**Appeal Process:**
If your account is suspended or terminated, you may appeal the decision by contacting beengg.space@gmail.com within 30 days. Appeals will be reviewed in good faith, but GymCore reserves sole discretion over final decisions.

**Effect of Termination:**
Upon termination:
- Your access to the App will be immediately revoked
- Your data may be deleted according to our retention policy
- Paid subscriptions will not be refunded (except as required by law)
- You must cease all use of the App

## 3. User Conduct and Prohibited Activities

### 3.1 Acceptable Use

GymCore is a fitness tracking and gym management platform. You agree to use the App lawfully, responsibly, and respectfully. You must comply with all applicable local, state, national, and international laws and regulations.

### 3.2 Prohibited Activities

You agree NOT to:

**Content-Related Prohibitions:**
- Post, upload, or share content that is illegal, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable
- Share sexually explicit content or nudity (except progress photos in appropriate contexts)
- Post content that promotes violence, discrimination, hatred, or harm based on race, ethnicity, religion, gender, sexual orientation, disability, or other protected characteristics
- Share content that infringes intellectual property rights, including copyrights, trademarks, patents, or trade secrets
- Post spam, advertising, or promotional content without authorization
- Share false, misleading, or deceptive information
- Post content that violates others' privacy or discloses personal information without consent

**Technical and Security Prohibitions:**
- Attempt to hack, breach, or compromise the App's security, servers, or networks
- Use automated scripts, bots, scrapers, or crawlers to access the App
- Reverse engineer, decompile, disassemble, or attempt to derive source code
- Introduce viruses, malware, trojans, or other malicious code
- Interfere with or disrupt the App's functionality or servers
- Bypass or circumvent security measures, authentication, or access restrictions
- Use the App to distribute malware or conduct phishing attacks
- Attempt to gain unauthorized access to other users' accounts or data

**Misuse and Abuse:**
- Impersonate any person, entity, or GymCore staff
- Create fake accounts or use false identities
- Harass, stalk, threaten, or abuse other users or staff
- Engage in fraudulent activities, including payment fraud
- Manipulate data or analytics for deceptive purposes
- Use the App for illegal activities or to facilitate violations of law
- Exploit bugs, glitches, or vulnerabilities for personal gain
- Resell, redistribute, or commercialize the App without authorization

**Commercial Misuse:**
- Use the App for unauthorized commercial purposes
- Scrape data for commercial use without permission
- Compete with GymCore using data obtained from the App

### 3.3 Consequences of Violations

Violations of these prohibited activities may result in:
- Warning or notification
- Temporary suspension of account
- Permanent termination of account
- Removal of content
- Legal action, including civil or criminal proceedings
- Reporting to law enforcement authorities

## 4. Health and Medical Disclaimers

### 4.1 Not Medical or Professional Advice

**IMPORTANT: READ CAREFULLY**

THE APP IS FOR INFORMATIONAL, EDUCATIONAL, AND TRACKING PURPOSES ONLY. IT DOES NOT PROVIDE MEDICAL ADVICE, DIAGNOSIS, TREATMENT, OR PROFESSIONAL FITNESS/NUTRITION GUIDANCE.

**No Doctor-Patient Relationship:**
- Using the App does not create a doctor-patient, trainer-client, or professional relationship
- Content on the App is not a substitute for professional medical advice, diagnosis, or treatment
- Always seek the advice of your physician, licensed healthcare provider, or qualified fitness professional before starting any exercise program, diet, or making health-related decisions

**Consult Professionals:**
- Consult a physician before beginning any exercise or diet program, especially if you:
  - Have any medical conditions or health concerns
  - Are pregnant or nursing
  - Are taking medications
  - Have a history of heart disease, high blood pressure, or other cardiovascular issues
  - Have injuries or physical limitations
  - Are significantly overweight or have not exercised recently
- Consult a registered dietitian or nutritionist for personalized dietary advice
- Work with certified trainers or coaches for personalized fitness guidance

### 4.2 Assumption of Risk

**Exercise and Physical Activity Risks:**
You acknowledge and agree that:
- Exercise and physical activity carry inherent risks of injury, illness, or death
- Risks include but are not limited to: muscle strains, sprains, tears, fractures, heart attack, stroke, heat exhaustion, dehydration, and other injuries
- You are voluntarily participating in physical activities at your own risk
- You are physically and medically capable of performing the exercises you attempt
- You have consulted a physician and received medical clearance if necessary

**Diet and Nutrition Risks:**
You acknowledge that:
- Dietary changes can affect your health and wellbeing
- Calorie and nutritional information may not be 100% accurate
- Food allergies and dietary restrictions are your responsibility to manage
- You should consult a healthcare professional for personalized nutritional advice

**Listen to Your Body:**
You agree to:
- Stop exercising immediately if you experience pain, discomfort, dizziness, nausea, chest pain, or other warning signs
- Use proper form and technique when exercising
- Use appropriate weights and resistance levels
- Warm up before and cool down after workouts
- Stay hydrated and maintain proper nutrition
- Seek immediate medical attention if you experience serious symptoms

### 4.3 No Guarantees of Results

We do not guarantee or warrant that:
- You will achieve specific fitness goals or results
- You will lose weight, gain muscle, or improve performance
- Workout plans or diet recommendations will be effective for you
- Information on the App is accurate, complete, or suitable for your individual needs

**Individual Results Vary:**
Results depend on many factors including genetics, effort, consistency, diet, sleep, stress, and medical conditions. Your results may differ from others or from expectations.

## 5. Privacy and Data Protection

### 5.1 Privacy Policy

Your use of the App is also governed by our Privacy Policy, which explains how we collect, use, share, and protect your personal information in compliance with:
- Information Technology Act, 2000
- SPDI Rules, 2011
- Digital Personal Data Protection Act, 2023 (when applicable)
- Other applicable Indian laws

By using the App, you agree to our Privacy Policy, which is incorporated into these Terms by reference.

Please read our Privacy Policy carefully.

### 5.2 Data Sharing Within Gym Communities

By joining a gym through GymCore, you expressly consent to:
- Your gym owner/administrator accessing your workout data, attendance records, diet logs, progress metrics, and analytics as described in the Privacy Policy
- Assigned trainers/coaches viewing your fitness information, workout plans, and progress
- Your data being used by gym owners for gym management, analytics, and reporting purposes
- Limited information being visible to other gym members (if you opt into social features)

You understand that gym owners and trainers need access to your data to provide services, guidance, and support. This consent is governed by the SPDI Rules, 2011.

### 5.3 Data Security

We implement reasonable security practices and procedures as required under Rule 8 of the SPDI Rules, 2011 to protect your data. However:
- We cannot guarantee absolute security
- Data transmission over the internet carries inherent risks
- You are responsible for maintaining the security of your account

See our Privacy Policy for more details on data security measures.

## 6. Subscriptions, Payments, and Billing

### 6.1 Subscription Plans

GymCore offers various subscription tiers with different features, access levels, and pricing:
- **Free Plan:** Basic features with limitations
- **Premium Plans:** Enhanced features, analytics, and integrations
- **Gym Owner Plans:** Management tools and administrative features

Current plans, pricing, and features are available in the App and on our website. All prices are in Indian Rupees (INR) unless otherwise stated.

### 6.2 Billing and Payment

**Billing Cycles:**
- Subscriptions may be billed monthly, quarterly, or annually, depending on your selected plan
- Billing cycles begin on the date you subscribe and recur on the same date each period
- You authorize us to charge your payment method on file automatically for each billing cycle

**Payment Methods:**
We accept the following payment methods:
- Credit cards and debit cards (Visa, Mastercard, RuPay, etc.)
- Net banking
- UPI (Unified Payments Interface) - Google Pay, PhonePe, Paytm, BHIM, etc.
- Mobile wallets (Paytm, PhonePe, Mobikwik, etc.)
- Other payment methods as indicated in the App

Payment processing is handled by secure third-party payment gateways registered with the Reserve Bank of India (RBI) such as Razorpay, PayU, CCAvenue, Instamojo, or similar services.

**Taxes - GST:**
- All prices exclude Goods and Services Tax (GST) unless stated otherwise
- Applicable GST (currently 18% on digital services) will be added to your invoice
- GST-registered businesses can provide their GSTIN for GST input credit
- You are responsible for paying all applicable taxes

### 6.3 Refund Policy

**General Policy - Consumer Protection Act, 2019:**
Under the Consumer Protection Act, 2019, you may be entitled to refunds in certain circumstances:
- Deficiency in service
- Defective or unsatisfactory services
- Unfair trade practices
- Non-delivery of services as promised

**Our Refund Policy:**
- Refunds for billing errors or technical issues on our part
- Refunds within 7 days of subscription purchase (cooling-off period) if no services have been substantially used
- Refunds as required by law or directed by consumer forums

**No Refunds:**
- No partial refunds for partial subscription periods
- No refunds if you violate these Terms
- No refunds after substantial use of services

**Requesting a Refund:**
To request a refund, contact beengg.space@gmail.com with:
- Your account email and username
- Transaction details (transaction ID, order ID, payment reference)
- Invoice number and date
- Reason for refund request
- Supporting documents if applicable

Refund requests will be reviewed within 7-10 business days. Approved refunds will be processed within 15-20 business days to the original payment method.

## 7. Limitation of Liability

TO THE FULLEST EXTENT PERMITTED BY LAW, GYMCORE AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AFFILIATES, PARTNERS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY:

**Types of Damages Excluded:**
- Indirect, incidental, special, consequential, exemplary, or punitive damages
- Loss of profits, revenue, data, goodwill, or business opportunities
- Personal injury, illness, or death resulting from use of the App
- Damages resulting from errors, inaccuracies, or omissions in content or data
- Damages resulting from unauthorized access to your account or data
- Damages from service interruptions, delays, or failures
- Damages from third-party actions or content
- Damages from reliance on information or advice from the App

**Maximum Liability:**
Our total liability to you for all claims arising from or related to the App shall not exceed the greater of:
- The amount you paid to GymCore in the 12 months preceding the claim, OR
- ₹1000 INR

## 8. Contact Information

For questions, concerns, or notices regarding these Terms:

**GymCore**
Website: https://gymcore.beengg.space
Email: beengg.space@gmail.com
Support: beengg.space@gmail.com
Legal & Privacy: beengg.space@gmail.com

**Response Time:**
We aim to respond to inquiries within 5-10 business days.

## 9. Acknowledgment and Acceptance

BY CREATING AN ACCOUNT, ACCESSING, OR USING GYMCORE, YOU ACKNOWLEDGE THAT:

1. You have read and understood these Terms and Conditions in their entirety
2. You agree to be legally bound by these Terms
3. You have read and agree to our Privacy Policy
4. You are legally capable of entering into binding contracts
5. You meet the age and eligibility requirements
6. If you are using the App on behalf of an organization, you have authority to bind that organization to these Terms

**If you do not agree with these Terms, you must not use the App.**

---

**Effective Date:** January 5, 2026

**Last Updated:** January 5, 2026

**GymCore - Terms and Conditions for Indian Users**

© 2026 GymCore. All rights reserved.

**These Terms are governed by the laws of India and subject to the jurisdiction of Indian courts.**`;

export default function TermsAndConditions({ onAccept }: TermsAndConditionsProps) {
  const { theme } = useTheme();
  const [agreed, setAgreed] = useState(false);
  const [scrollY] = useState(new Animated.Value(0));
  const scrollViewRef = useRef<ScrollView>(null);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
      marginTop: 8,
    },
    sectionSubtitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
      marginTop: 16,
    },
    text: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      marginBottom: 12,
    },
    boldText: {
      fontWeight: '700',
      color: theme.colors.text,
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      backgroundColor: theme.colors.card,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.colors.border,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.card,
    },
    checkboxChecked: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    checkboxLabel: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.text,
    },
    buttonContainer: {
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 30 : 20,
      backgroundColor: theme.colors.card,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    button: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: agreed ? 1 : 0.5,
    },
    buttonDisabled: {
      backgroundColor: theme.colors.border,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });

  // Parse markdown-like content
  const renderContent = () => {
    const lines = TERMS_CONTENT.split('\n');
    const elements: JSX.Element[] = [];
    let currentSection = '';
    let currentSubsection = '';

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      if (!trimmed) {
        return;
      }

      if (trimmed.startsWith('# ')) {
        // Main title
        elements.push(
          <Text key={index} style={[styles.sectionTitle, { fontSize: 20, marginTop: 0 }]}>
            {trimmed.substring(2)}
          </Text>
        );
      } else if (trimmed.startsWith('## ')) {
        // Section title
        currentSection = trimmed.substring(3);
        elements.push(
          <Text key={index} style={styles.sectionTitle}>
            {currentSection}
          </Text>
        );
      } else if (trimmed.startsWith('### ')) {
        // Subsection title
        currentSubsection = trimmed.substring(4);
        elements.push(
          <Text key={index} style={styles.sectionSubtitle}>
            {currentSubsection}
          </Text>
        );
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        // Bold text
        const text = trimmed.replace(/\*\*/g, '');
        elements.push(
          <Text key={index} style={[styles.text, styles.boldText]}>
            {text}
          </Text>
        );
      } else if (trimmed.startsWith('- ')) {
        // Bullet point
        const text = trimmed.substring(2);
        elements.push(
          <Text key={index} style={styles.text}>
            {'\u2022'} {text}
          </Text>
        );
      } else {
        // Regular text
        elements.push(
          <Text key={index} style={styles.text}>
            {trimmed}
          </Text>
        );
      }
    });

    return <View style={styles.content}>{elements}</View>;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Terms and Conditions</Text>
        <Text style={styles.subtitle}>Please read and accept to continue</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={true}
      >
        {renderContent()}
      </ScrollView>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={[styles.checkbox, agreed && styles.checkboxChecked]}
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.7}
        >
          {agreed && <Check size={16} color="#FFFFFF" />}
        </TouchableOpacity>
        <Text style={styles.checkboxLabel}>
          I have read and agree to the Terms and Conditions and Privacy Policy
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, !agreed && styles.buttonDisabled]}
          onPress={onAccept}
          disabled={!agreed}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>I Agree</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

