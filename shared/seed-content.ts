// Seed content: NDPR compliance template, training courses, and SAMPLE data for the demo school.
// Sample threats/news below are illustrative only and are shown exclusively in the demo.

export const complianceTemplate = [
  { itemKey: "ndpr_reg", title: "NDPC Registration", description: "Register with the Nigeria Data Protection Commission as a data controller", status: "compliant", weight: 10, category: "registration" },
  { itemKey: "dpo_appt", title: "Data Protection Officer Appointment", description: "Appoint a qualified DPO as required by NDPR", status: "compliant", weight: 8, category: "governance" },
  { itemKey: "privacy_policy", title: "Privacy Policy Publication", description: "Publish a comprehensive privacy policy on school website", status: "partial", weight: 7, category: "documentation" },
  { itemKey: "consent_forms", title: "Student Data Consent Forms", description: "Implement parental/guardian consent for student data collection", status: "compliant", weight: 9, category: "consent" },
  { itemKey: "data_inventory", title: "Data Processing Inventory", description: "Maintain a register of all data processing activities", status: "partial", weight: 8, category: "documentation" },
  { itemKey: "access_control", title: "Access Control Policies", description: "Implement role-based access controls for all systems handling personal data", status: "compliant", weight: 9, category: "security" },
  { itemKey: "encryption", title: "Data Encryption at Rest", description: "Encrypt stored personal data including student records", status: "non_compliant", weight: 8, category: "security" },
  { itemKey: "breach_procedure", title: "Data Breach Response Procedure", description: "Documented procedure for handling data breaches within 72-hour NDPC notification window", status: "partial", weight: 9, category: "incident_response" },
  { itemKey: "staff_training", title: "Staff Data Protection Training", description: "Annual mandatory data protection training for all staff", status: "non_compliant", weight: 7, category: "training" },
  { itemKey: "third_party", title: "Third-Party Data Agreements", description: "Data processing agreements with all third-party service providers", status: "not_started", weight: 6, category: "contracts" },
  { itemKey: "retention_policy", title: "Data Retention Policy", description: "Define and enforce data retention and deletion schedules", status: "partial", weight: 7, category: "documentation" },
  { itemKey: "dpia", title: "Data Protection Impact Assessment", description: "Conduct DPIA for high-risk processing activities", status: "not_started", weight: 8, category: "assessment" },
  { itemKey: "student_rights", title: "Data Subject Rights Process", description: "Process for handling student/parent data access, correction, and deletion requests", status: "partial", weight: 8, category: "rights" },
  { itemKey: "incident_log", title: "Security Incident Logging", description: "Maintain comprehensive logs of all security incidents", status: "compliant", weight: 6, category: "monitoring" },
  { itemKey: "network_security", title: "Network Security Assessment", description: "Regular network vulnerability assessments and penetration testing", status: "non_compliant", weight: 9, category: "security" },
];

export const sampleThreats = [
  { source: "NCC-CSIRT", title: "Ransomware Campaign Targeting Nigerian Schools", description: "A new ransomware variant 'EduLock' has been detected targeting educational institutions in West Africa, encrypting student databases and demanding Bitcoin payment.", severity: "critical", type: "ransomware", publishedAt: "2025-03-28T10:00:00Z", country: "Nigeria", isEducationSector: 1, iocData: null },
  { source: "AlienVault OTX", title: "Phishing Kit Mimicking JAMB Portal", description: "Threat actors deploying convincing phishing pages mimicking the Joint Admissions and Matriculation Board portal to harvest student credentials.", severity: "high", type: "phishing", publishedAt: "2025-03-27T14:30:00Z", country: "Nigeria", isEducationSector: 1, iocData: null },
  { source: "NCC-CSIRT", title: "DDoS Attacks on .edu.ng Domains", description: "Distributed denial of service attacks observed against multiple Nigerian education domain websites during examination periods.", severity: "high", type: "ddos", publishedAt: "2025-03-26T09:15:00Z", country: "Nigeria", isEducationSector: 1, iocData: null },
  { source: "Kaspersky ICS CERT", title: "Supply Chain Attack via School Software Vendor", description: "Compromised update mechanism in popular Nigerian school management software distributing malware to connected systems.", severity: "critical", type: "malware", publishedAt: "2025-03-25T16:45:00Z", country: "Nigeria", isEducationSector: 1, iocData: null },
  { source: "AlienVault OTX", title: "Credential Stuffing Against Educational Platforms", description: "Large-scale credential stuffing attacks targeting Nigerian e-learning platforms using previously leaked database credentials.", severity: "medium", type: "unauthorized_access", publishedAt: "2025-03-24T11:20:00Z", country: "Nigeria", isEducationSector: 1, iocData: null },
  { source: "NCC-CSIRT", title: "BEC Scam Targeting School Administrators", description: "Business email compromise campaign specifically targeting school bursars and administrators with fake vendor payment requests.", severity: "high", type: "phishing", publishedAt: "2025-03-23T08:00:00Z", country: "Nigeria", isEducationSector: 1, iocData: null },
  { source: "The Hacker News", title: "Critical Vulnerability in Student Information System", description: "SQL injection vulnerability discovered in widely used Nigerian student information management system allowing unauthorized data access.", severity: "critical", type: "vulnerability", publishedAt: "2025-03-22T13:30:00Z", country: "Nigeria", isEducationSector: 1, iocData: null },
  { source: "BleepingComputer", title: "WiFi Deauth Attack Tool Targeting Campus Networks", description: "New tool circulating on dark web specifically designed to disrupt campus WiFi networks during examinations.", severity: "medium", type: "ddos", publishedAt: "2025-03-21T15:00:00Z", country: null, isEducationSector: 1, iocData: null },
  { source: "Dark Reading", title: "Insider Threat: Student Record Data Exfiltration", description: "Documented cases of insider threats at educational institutions involving unauthorized export of student personal data.", severity: "medium", type: "insider_threat", publishedAt: "2025-03-20T10:45:00Z", country: null, isEducationSector: 1, iocData: null },
  { source: "NCC-CSIRT", title: "Cryptomining Malware on School Servers", description: "Unauthorized cryptocurrency mining software detected on multiple Nigerian school servers, degrading performance of educational services.", severity: "low", type: "malware", publishedAt: "2025-03-19T09:00:00Z", country: "Nigeria", isEducationSector: 1, iocData: null },
  { source: "AlienVault OTX", title: "Man-in-the-Middle Attack on School Payment Systems", description: "SSL stripping attacks detected targeting online school fee payment portals across multiple Nigerian states.", severity: "high", type: "unauthorized_access", publishedAt: "2025-03-18T14:00:00Z", country: "Nigeria", isEducationSector: 1, iocData: null },
  { source: "Krebs on Security", title: "Data Leak from Nigerian Education Ministry Database", description: "Personal data of thousands of students exposed through misconfigured cloud storage used by state education ministry.", severity: "critical", type: "data_breach", publishedAt: "2025-03-17T11:30:00Z", country: "Nigeria", isEducationSector: 1, iocData: null },
];

export const courses = [
  {
    title: "NDPR Fundamentals for Educators",
    description: "Learn the core principles of Nigeria Data Protection Regulation and how they apply to educational institutions.",
    durationMin: 45,
    icon: "Shield",
    contentMd: `# NDPR Fundamentals for Educators

## What is the NDPR?
The Nigeria Data Protection Regulation (NDPR) was issued in 2019 by NITDA to protect the rights of natural persons to data privacy. In 2023, the Nigeria Data Protection Act (NDPA) was signed into law, establishing the Nigeria Data Protection Commission (NDPC).

## Key Principles
1. **Lawfulness, Fairness, and Transparency** - Data must be processed lawfully and fairly
2. **Purpose Limitation** - Data collected for specified, explicit purposes only
3. **Data Minimization** - Only collect data that is necessary
4. **Accuracy** - Keep personal data accurate and up to date
5. **Storage Limitation** - Don't keep data longer than necessary
6. **Integrity and Confidentiality** - Ensure appropriate security

## Schools and NDPR
Educational institutions process significant amounts of sensitive data including:
- Student personal information and records
- Parent/guardian contact details
- Staff employment records
- Health records and special needs data
- Financial records (school fees, salaries)

## Compliance Requirements
- Register with NDPC as a data controller
- Appoint a Data Protection Officer (DPO)
- Conduct Data Protection Impact Assessments
- Maintain records of processing activities
- Report data breaches within 72 hours`,
    quizJson: JSON.stringify([
      { question: "What year was the NDPR first issued?", options: ["2017", "2018", "2019", "2020"], correct: 2 },
      { question: "How quickly must data breaches be reported to NDPC?", options: ["24 hours", "48 hours", "72 hours", "7 days"], correct: 2 },
      { question: "Which principle requires collecting only necessary data?", options: ["Purpose Limitation", "Data Minimization", "Accuracy", "Storage Limitation"], correct: 1 },
      { question: "Who established the NDPC?", options: ["NDPR 2019", "NITDA Act", "Nigeria Data Protection Act 2023", "Cybercrimes Act"], correct: 2 },
      { question: "Schools must appoint which role for NDPR compliance?", options: ["Chief Security Officer", "Data Protection Officer", "Privacy Manager", "Compliance Director"], correct: 1 },
    ]),
    passMark: 70,
  },
  {
    title: "Recognizing Phishing Attacks",
    description: "Learn to identify and respond to phishing attempts targeting educational staff.",
    durationMin: 30,
    icon: "Mail",
    contentMd: `# Recognizing Phishing Attacks

## What is Phishing?
Phishing is a social engineering attack where cybercriminals send fraudulent messages designed to trick recipients into revealing sensitive information or installing malware.

## Common Phishing Tactics in Schools
1. **Impersonation of Authority** - Emails pretending to be from the principal, ministry, or WAEC
2. **Urgent Payment Requests** - Fake invoices or urgent fund transfer requests
3. **JAMB/WAEC Result Scams** - Fake portals mimicking examination result sites
4. **Staff Salary Alerts** - Fake HR emails about salary changes requiring credential verification

## Red Flags to Watch
- Urgent language creating pressure to act immediately
- Unfamiliar sender addresses (check carefully for misspellings)
- Generic greetings like "Dear Sir/Madam"
- Requests for personal information or passwords
- Suspicious links (hover before clicking!)
- Unexpected attachments
- Poor grammar and formatting

## What to Do
1. **Don't click** any links or download attachments
2. **Report** the email to your ICT department immediately
3. **Verify** by contacting the supposed sender through known channels
4. **Delete** the email after reporting`,
    quizJson: JSON.stringify([
      { question: "What is the primary goal of a phishing attack?", options: ["Slow down your computer", "Trick you into revealing sensitive information", "Install updates", "Improve email security"], correct: 1 },
      { question: "Which is a red flag in a phishing email?", options: ["Sender's correct email", "No urgency", "Generic greeting", "Expected attachment"], correct: 2 },
      { question: "What should you do first when you suspect a phishing email?", options: ["Click links to verify", "Reply asking for confirmation", "Report to ICT department", "Forward to colleagues"], correct: 2 },
      { question: "Which Nigerian exam body is commonly impersonated in phishing?", options: ["NECO only", "NABTEB only", "JAMB and WAEC", "NUC only"], correct: 2 },
    ]),
    passMark: 70,
  },
  {
    title: "Password Security Best Practices",
    description: "Create and manage strong passwords to protect school systems and student data.",
    durationMin: 25,
    icon: "Lock",
    contentMd: `# Password Security Best Practices

## Why Strong Passwords Matter
Weak passwords are the #1 cause of unauthorized access to school systems. A compromised password can expose student records, financial data, and staff information.

## Creating Strong Passwords
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, and symbols
- Avoid personal information (names, birthdays)
- Use passphrases: "MySchool$Enugu2024!" is stronger than "password123"
- Never reuse passwords across systems

## Password Management
- Use a password manager to store credentials securely
- Enable two-factor authentication (2FA) wherever available
- Change passwords every 90 days for sensitive systems
- Never share passwords with colleagues

## School-Specific Guidelines
- Each staff member must have individual login credentials
- Shared accounts are prohibited for systems containing student data
- Admin accounts require stronger passwords (16+ characters)
- Student accounts should have age-appropriate password requirements`,
    quizJson: JSON.stringify([
      { question: "What is the minimum recommended password length?", options: ["6 characters", "8 characters", "10 characters", "12 characters"], correct: 3 },
      { question: "How often should sensitive system passwords be changed?", options: ["Every 30 days", "Every 90 days", "Every year", "Never"], correct: 1 },
      { question: "Which is the strongest password?", options: ["password123", "School2024", "MySchool$Enugu2024!", "12345678"], correct: 2 },
      { question: "What is prohibited for systems containing student data?", options: ["Long passwords", "Shared accounts", "Two-factor authentication", "Password managers"], correct: 1 },
    ]),
    passMark: 70,
  },
  {
    title: "Incident Response Procedures",
    description: "Know how to respond to cybersecurity incidents following the school's incident response plan.",
    durationMin: 40,
    icon: "AlertTriangle",
    contentMd: `# Incident Response Procedures

## The 5-Step Process
1. **Identify** - Detect and confirm the incident
2. **Contain** - Limit the damage and prevent spread
3. **Investigate** - Determine the root cause
4. **Remediate** - Fix the vulnerability and restore systems
5. **Review** - Document lessons learned

## Common School Incidents
- Unauthorized access to student records
- Malware infection on school computers
- Phishing attacks on staff email
- Website defacement
- Data leaks or breaches

## Your Role
Every staff member plays a role in incident response:
- **Report immediately** to the ICT department
- **Preserve evidence** - don't delete or modify anything
- **Follow instructions** from the incident response team
- **Document** what you observed and when

## NDPR Breach Notification
Under the NDPR/NDPA, data breaches must be reported to:
- The NDPC within 72 hours
- Affected data subjects without undue delay
- The school's management immediately`,
    quizJson: JSON.stringify([
      { question: "What is the first step in incident response?", options: ["Contain", "Investigate", "Identify", "Remediate"], correct: 2 },
      { question: "Within how many hours must breaches be reported to NDPC?", options: ["24 hours", "48 hours", "72 hours", "1 week"], correct: 2 },
      { question: "What should you NOT do when you discover an incident?", options: ["Report to ICT", "Preserve evidence", "Delete suspicious files", "Document observations"], correct: 2 },
      { question: "How many steps are in the incident response process?", options: ["3", "4", "5", "6"], correct: 2 },
    ]),
    passMark: 70,
  },
  {
    title: "Safe Internet Use in Schools",
    description: "Guidelines for safe internet usage for both staff and students.",
    durationMin: 30,
    icon: "Globe",
    contentMd: `# Safe Internet Use in Schools

## Staff Guidelines
- Only access work-related websites on school networks
- Use VPN when accessing school systems remotely
- Don't download unauthorized software
- Keep browsers and plugins updated
- Report suspicious websites to ICT

## Student Safety
- Implement content filtering on school networks
- Monitor computer lab usage
- Teach students about online safety
- Set clear acceptable use policies
- Report cyberbullying incidents

## Social Media Policy
- Don't share student information on social media
- Official school accounts must be managed by authorized staff
- Personal social media use should not reference students
- Staff should maintain professional boundaries online

## Network Security
- Connect only to authorized WiFi networks
- Don't use personal hotspots for school work
- Report unusual network behavior
- Don't share WiFi passwords with unauthorized persons`,
    quizJson: JSON.stringify([
      { question: "What should staff use when accessing school systems remotely?", options: ["Public WiFi", "VPN", "Personal email", "Social media"], correct: 1 },
      { question: "Who should manage official school social media accounts?", options: ["Any staff member", "Students", "Authorized staff only", "Parents"], correct: 2 },
      { question: "What should be implemented on school networks for student safety?", options: ["No restrictions", "Content filtering", "Social media access", "Gaming sites"], correct: 1 },
      { question: "What should you report to ICT?", options: ["Normal websites", "Suspicious websites", "Social media posts", "News articles"], correct: 1 },
    ]),
    passMark: 70,
  },
  {
    title: "Physical Security & Device Management",
    description: "Protecting school hardware, devices, and physical access to data systems.",
    durationMin: 35,
    icon: "HardDrive",
    contentMd: `# Physical Security & Device Management

## Device Security
- Lock computers when stepping away (Win+L or Cmd+L)
- Don't leave laptops/tablets unattended
- Use cable locks for equipment in public areas
- Encrypt portable storage devices
- Report lost or stolen devices immediately

## Access Control
- Server rooms must be locked at all times
- Maintain visitor logs for ICT areas
- Don't prop open secured doors
- Report broken locks or security cameras
- Key/card access for sensitive areas only

## Data Disposal
- Shred paper documents containing personal data
- Wipe hard drives before disposing of equipment
- Don't throw away documents in regular bins
- Follow the school's data retention schedule

## Backup Procedures
- Regular automated backups of student records
- Store backup copies securely offsite
- Test backup restoration quarterly
- Document backup schedules and procedures`,
    quizJson: JSON.stringify([
      { question: "What keyboard shortcut locks a Windows computer?", options: ["Ctrl+L", "Alt+L", "Win+L", "Shift+L"], correct: 2 },
      { question: "How should hard drives be handled before disposal?", options: ["Thrown away", "Wiped/destroyed", "Given to students", "Left in storage"], correct: 1 },
      { question: "How often should backup restoration be tested?", options: ["Monthly", "Quarterly", "Annually", "Never"], correct: 1 },
      { question: "What should be maintained for ICT area visitors?", options: ["Nothing", "Visitor logs", "Social media posts", "Email records"], correct: 1 },
    ]),
    passMark: 70,
  },
];

export const sampleNews = [
  { title: "NDPC Releases New Compliance Guidelines for Educational Institutions", source: "NDPC Official", url: "https://ndpc.gov.ng", summary: "The Nigeria Data Protection Commission has released updated compliance guidelines specifically tailored for primary and secondary schools, with a 6-month implementation deadline.", publishedAt: "2025-03-27T08:00:00Z", keywords: "NDPC,compliance,education,schools" },
  { title: "Lagos State Schools Complete Cybersecurity Audit", source: "ThisDay", url: "https://thisday.ng", summary: "The Lagos State Ministry of Education announced that 85% of state-owned secondary schools have completed their first comprehensive cybersecurity audit as mandated by the state government.", publishedAt: "2025-03-25T10:30:00Z", keywords: "Lagos,audit,cybersecurity,schools" },
  { title: "NCC-CSIRT Warns of Increased Cyber Threats to Nigerian Schools", source: "NCC", url: "https://ncc.gov.ng", summary: "The Nigerian Communications Commission's Computer Security Incident Response Team has issued an advisory warning educational institutions of a spike in targeted cyberattacks.", publishedAt: "2025-03-23T14:00:00Z", keywords: "NCC,CSIRT,threats,warning" },
  { title: "Workshop: Data Protection for School Administrators", source: "NITDA", url: "https://nitda.gov.ng", summary: "NITDA is organizing a free nationwide workshop series on data protection practices for school administrators, starting April 2025 across all six geopolitical zones.", publishedAt: "2025-03-20T09:00:00Z", keywords: "NITDA,workshop,training,administrators" },
  { title: "Ransomware Attack Disrupts Examinations at Federal University", source: "Punch Newspapers", url: "https://punchng.com", summary: "A major ransomware attack has disrupted examination schedules at a federal university, affecting over 15,000 students and raising concerns about cybersecurity preparedness in Nigerian education.", publishedAt: "2025-03-18T11:00:00Z", keywords: "ransomware,university,examination,disruption" },
];
