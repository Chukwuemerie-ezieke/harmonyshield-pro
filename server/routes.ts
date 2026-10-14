import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { hashPassword, verifyPassword, generateToken, verifyToken, authMiddleware, hasActiveSession } from "./auth";
import { requireRole, verifyOwnership } from "./authz";
import { validateBody } from "./validate";
import { fetchLiveNews, fetchOTXThreats, checkIPReputation, getFeedStatus } from "./live-feeds";
import { authLimiter } from "./rate-limit";
import { evidenceUpload, ALLOWED_MIME_TYPES, UPLOAD_MAX_BYTES } from "./uploads";
import { buildComplianceCsv, buildCompliancePdf } from "./reports";
import fs from "fs";
import {
  insertIncidentSchema,
  insertIncidentActionSchema,
  insertComplianceItemSchema,
  insertSchoolSchema,
} from "@shared/schema";

// ─── Request body schemas ────────────────────────────
// These derive from the drizzle-zod insert schemas in shared/schema.ts but
// drop server-controlled fields so clients can never set id, schoolId,
// ownership, or audit timestamps. The server injects those from the
// authenticated session.

const allowedUserRoles = ["admin", "dpo", "staff", "teacher"] as const;

// POST /api/incidents - client supplies incident details; server injects
// schoolId and createdAt. reportedBy stays client-supplied (display name).
const createIncidentSchema = insertIncidentSchema.omit({
  schoolId: true,
  createdAt: true,
});

// PUT /api/incidents/:id - partial update of the client-editable subset.
const updateIncidentSchema = createIncidentSchema.partial();

// PUT /api/compliance/:id - partial update; schoolId/itemKey are not client
// editable through this route.
const updateComplianceSchema = insertComplianceItemSchema
  .omit({ schoolId: true, itemKey: true, updatedAt: true })
  .partial();

// POST /api/incidents/:id/actions - server injects incidentId and createdAt.
const createIncidentActionSchema = insertIncidentActionSchema.omit({
  incidentId: true,
  createdAt: true,
});

// PUT /api/incident-actions/:id - partial update of an action.
const updateIncidentActionSchema = createIncidentActionSchema.partial();

// POST /api/training/progress - progress is always scoped to the current user.
const trainingProgressSchema = z.object({
  courseId: z.number().int().positive(),
  status: z.string().min(1),
  score: z.number().int().min(0).max(100).optional(),
});

// PUT /api/settings - a school admin may edit their own school's details.
const updateSettingsSchema = insertSchoolSchema.partial();

// Session lifetime. Must match the JWT expiry in server/auth.ts (7 days) so a
// session row never outlives the signature it guards.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// POST /api/auth/register - admin-only. The creating admin's schoolId is
// forced server-side; role is constrained to a safe allowlist and defaults to
// "staff". Clients can never choose id/schoolId.
const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(allowedUserRoles).optional(),
  department: z.string().optional(),
});

async function seedDatabase() {
  // Check if already seeded
  const existingSchools = await storage.getSchools();
  if (existingSchools.length > 0) return;

  console.log("[Seed] Seeding database...");

  // ─── Schools ───────────────────────────────────────
  const school1 = await storage.createSchool({
    name: "Federal Government College Enugu",
    address: "Independence Layout, Enugu",
    state: "Enugu",
    lga: "Enugu North",
    type: "secondary",
    studentCount: 1200,
    ndpcRegNumber: "NDPC/SCH/2024/0042",
  });
  const school2 = await storage.createSchool({
    name: "Queens College Lagos",
    address: "Yaba, Lagos",
    state: "Lagos",
    lga: "Lagos Mainland",
    type: "secondary",
    studentCount: 2500,
    ndpcRegNumber: "NDPC/SCH/2024/0089",
  });
  const school3 = await storage.createSchool({
    name: "Government Secondary School Kano",
    address: "Nassarawa GRA, Kano",
    state: "Kano",
    lga: "Kano Municipal",
    type: "secondary",
    studentCount: 900,
    ndpcRegNumber: null,
  });

  // ─── Users (password: demo123) ─────────────────────
  const hashedPw = await hashPassword("demo123");

  const user1 = await storage.createUser({
    schoolId: school1.id,
    email: "admin@fgcenugu.edu.ng",
    name: "Chukwuemeka Okafor",
    password: hashedPw,
    role: "admin",
    department: "ICT",
  });
  await storage.createUser({
    schoolId: school1.id,
    email: "dpo@fgcenugu.edu.ng",
    name: "Adaeze Nnamdi",
    password: hashedPw,
    role: "dpo",
    department: "Data Protection",
  });
  await storage.createUser({
    schoolId: school1.id,
    email: "teacher@fgcenugu.edu.ng",
    name: "Ibrahim Musa",
    password: hashedPw,
    role: "teacher",
    department: "Computer Science",
  });
  await storage.createUser({
    schoolId: school2.id,
    email: "admin@queenscollege.edu.ng",
    name: "Folake Adeyemi",
    password: hashedPw,
    role: "admin",
    department: "Administration",
  });
  await storage.createUser({
    schoolId: school3.id,
    email: "admin@gsskano.edu.ng",
    name: "Abubakar Yusuf",
    password: hashedPw,
    role: "admin",
    department: "ICT",
  });

  // ─── Compliance Items (15 for school1) ─────────────
  const complianceData = [
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

  for (const item of complianceData) {
    const { category, ...rest } = item;
    await storage.createComplianceItem({
      schoolId: school1.id,
      itemKey: rest.itemKey,
      title: rest.title,
      description: rest.description,
      status: rest.status,
      weight: rest.weight,
      dueDate: "2025-06-30",
      updatedAt: new Date().toISOString(),
    });
  }

  // ─── Threats (12) ──────────────────────────────────
  const threatData = [
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

  for (const threat of threatData) {
    await storage.createThreat(threat);
  }

  // ─── Incidents (3 for school1) ─────────────────────
  const inc1 = await storage.createIncident({
    schoolId: school1.id,
    reportedBy: "Chukwuemeka Okafor",
    type: "phishing",
    severity: "high",
    status: "investigating",
    step: 2,
    description: "Multiple staff members received sophisticated phishing emails impersonating the school principal requesting urgent fund transfers. Two staff members clicked the malicious links.",
    affectedSystems: "Email System, Staff Accounts",
    affectedCount: 12,
  });
  await storage.createIncidentAction({
    incidentId: inc1.id,
    action: "Identified and quarantined phishing emails",
    performedBy: "Chukwuemeka Okafor",
    status: "completed",
    notes: "Used email filters to identify 47 similar emails across the organization",
  });
  await storage.createIncidentAction({
    incidentId: inc1.id,
    action: "Reset passwords for affected accounts",
    performedBy: "Adaeze Nnamdi",
    status: "in_progress",
    notes: "2 of 12 affected accounts have been reset so far",
  });

  const inc2 = await storage.createIncident({
    schoolId: school1.id,
    reportedBy: "Ibrahim Musa",
    type: "malware",
    severity: "medium",
    status: "contained",
    step: 3,
    description: "Malware detected on three computer lab workstations. The malware appears to be a keylogger variant that may have captured student login credentials.",
    affectedSystems: "Computer Lab Workstations",
    affectedCount: 3,
  });
  await storage.createIncidentAction({
    incidentId: inc2.id,
    action: "Isolated affected workstations from network",
    performedBy: "Ibrahim Musa",
    status: "completed",
    notes: "All 3 machines disconnected and quarantined",
  });

  const inc3 = await storage.createIncident({
    schoolId: school1.id,
    reportedBy: "Adaeze Nnamdi",
    type: "unauthorized_access",
    severity: "low",
    status: "resolved",
    step: 5,
    description: "Unusual login attempt detected on the student records system from an external IP address. The attempt was blocked by the firewall.",
    affectedSystems: "Student Records System",
    affectedCount: 0,
    resolvedAt: "2025-03-25T16:00:00Z",
  });

  // ─── Training Courses (6) ──────────────────────────
  const courses = [
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

  for (const course of courses) {
    await storage.createCourse(course);
  }

  // ─── News Articles (5) ─────────────────────────────
  const newsData = [
    { title: "NDPC Releases New Compliance Guidelines for Educational Institutions", source: "NDPC Official", url: "https://ndpc.gov.ng", summary: "The Nigeria Data Protection Commission has released updated compliance guidelines specifically tailored for primary and secondary schools, with a 6-month implementation deadline.", publishedAt: "2025-03-27T08:00:00Z", keywords: "NDPC,compliance,education,schools" },
    { title: "Lagos State Schools Complete Cybersecurity Audit", source: "ThisDay", url: "https://thisday.ng", summary: "The Lagos State Ministry of Education announced that 85% of state-owned secondary schools have completed their first comprehensive cybersecurity audit as mandated by the state government.", publishedAt: "2025-03-25T10:30:00Z", keywords: "Lagos,audit,cybersecurity,schools" },
    { title: "NCC-CSIRT Warns of Increased Cyber Threats to Nigerian Schools", source: "NCC", url: "https://ncc.gov.ng", summary: "The Nigerian Communications Commission's Computer Security Incident Response Team has issued an advisory warning educational institutions of a spike in targeted cyberattacks.", publishedAt: "2025-03-23T14:00:00Z", keywords: "NCC,CSIRT,threats,warning" },
    { title: "Workshop: Data Protection for School Administrators", source: "NITDA", url: "https://nitda.gov.ng", summary: "NITDA is organizing a free nationwide workshop series on data protection practices for school administrators, starting April 2025 across all six geopolitical zones.", publishedAt: "2025-03-20T09:00:00Z", keywords: "NITDA,workshop,training,administrators" },
    { title: "Ransomware Attack Disrupts Examinations at Federal University", source: "Punch Newspapers", url: "https://punchng.com", summary: "A major ransomware attack has disrupted examination schedules at a federal university, affecting over 15,000 students and raising concerns about cybersecurity preparedness in Nigerian education.", publishedAt: "2025-03-18T11:00:00Z", keywords: "ransomware,university,examination,disruption" },
  ];

  for (const article of newsData) {
    await storage.createNewsArticle(article);
  }

  // ─── Audit Log Entries ─────────────────────────────
  const auditEntries = [
    { schoolId: school1.id, userId: user1.id, action: "user_login", entityType: "user", entityId: user1.id, details: "Admin login from 192.168.1.100" },
    { schoolId: school1.id, userId: user1.id, action: "compliance_update", entityType: "compliance", entityId: 1, details: "Updated NDPC Registration status to compliant" },
    { schoolId: school1.id, userId: user1.id, action: "incident_created", entityType: "incident", entityId: 1, details: "Reported phishing incident affecting 12 staff members" },
    { schoolId: school1.id, userId: user1.id, action: "settings_update", entityType: "school", entityId: school1.id, details: "Updated school NDPC registration number" },
    { schoolId: school1.id, userId: user1.id, action: "training_completed", entityType: "training", entityId: 1, details: "Completed NDPR Fundamentals course with score 90%" },
  ];

  for (const entry of auditEntries) {
    await storage.createAuditEntry(entry);
  }

  console.log("[Seed] Database seeded successfully");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Seed database on startup
  await seedDatabase();

  // ═══════════════════════════════════════════════════
  // PUBLIC ROUTES (no auth required)
  // ═══════════════════════════════════════════════════

  // ─── Auth: Login ───────────────────────────────────
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await verifyPassword(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = generateToken(user.id, user.email, user.schoolId, user.role);
      const decoded = verifyToken(token);

      // Persist a server-side session keyed by the token's jti so the token
      // can be revoked on logout. The sessions.token column stores the jti
      // (an opaque identifier), never the raw JWT.
      if (decoded) {
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
        await storage.createSession({
          userId: user.id,
          token: decoded.jti,
          expiresAt,
        });
      }

      // Log the login
      await storage.createAuditEntry({
        schoolId: user.schoolId,
        userId: user.id,
        action: "user_login",
        entityType: "user",
        entityId: user.id,
        details: `Login from ${req.ip}`,
      });

      const { password: _, ...userData } = user;
      return res.json({ token, user: userData });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Auth: Register (admin-only) ───────────────────
  // Locked down: only an authenticated admin may create users, and new users
  // are always created WITHIN the admin's own school. The request body cannot
  // choose schoolId at all, and role is constrained to a safe allowlist
  // (defaulting to "staff"). This closes the previous hole where any
  // unauthenticated caller could self-assign role="admin" and an arbitrary
  // schoolId. Login and the seeded demo users are unaffected.
  app.post(
    "/api/auth/register",
    authLimiter,
    authMiddleware,
    requireRole("admin"),
    validateBody(registerSchema),
    async (req, res) => {
      try {
        const { name, email, password, role, department } = req.body;

        const existing = await storage.getUserByEmail(email);
        if (existing) {
          return res.status(409).json({ message: "Email already registered" });
        }

        const hashedPw = await hashPassword(password);
        const user = await storage.createUser({
          name,
          email,
          password: hashedPw,
          department,
          schoolId: req.user!.schoolId, // forced to the creating admin's school
          role: role || "staff",
        });

        const { password: _, ...userData } = user;
        return res.status(201).json({ user: userData });
      } catch (err) {
        console.error("Register error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // ─── Auth: Get Current User ────────────────────────
  app.get("/api/auth/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Honor server-side revocation: a logged-out token must not resolve a user.
    if (!(await hasActiveSession(decoded.jti))) {
      return res.status(401).json({ message: "Session expired or revoked" });
    }

    const user = await storage.getUser(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { password: _, ...userData } = user;
    return res.json(userData);
  });

  // ═══════════════════════════════════════════════════
  // PROTECTED ROUTES (require authMiddleware)
  // ═══════════════════════════════════════════════════

  // ─── Auth: Logout ──────────────────────────────────
  // Revoke the current token server-side by deleting its session row. After
  // this call the same bearer token is rejected by authMiddleware (401).
  app.post("/api/auth/logout", authMiddleware, async (req, res) => {
    try {
      const jti = req.user!.jti;
      await storage.deleteSession(jti);
      await storage.createAuditEntry({
        schoolId: req.user!.schoolId,
        userId: req.user!.id,
        action: "user_logout",
        entityType: "user",
        entityId: req.user!.id,
        details: `Logout from ${req.ip}`,
      });
      return res.json({ message: "Logged out" });
    } catch (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Auth: List current user's active sessions ─────
  app.get("/api/auth/sessions", authMiddleware, async (req, res) => {
    try {
      const current = await storage.getSession(req.user!.jti);
      // Only the current session is addressable by jti; expose a minimal,
      // secret-free view (never the jti/token value itself).
      const result = current
        ? [{ userId: current.userId, createdAt: current.createdAt, expiresAt: current.expiresAt, current: true }]
        : [];
      return res.json({ sessions: result });
    } catch (err) {
      console.error("Sessions error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Dashboard ─────────────────────────────────────
  app.get("/api/dashboard", authMiddleware, async (req, res) => {
    const stats = await storage.getDashboardStats(req.user!.schoolId, req.user!.id);
    return res.json(stats);
  });

  // ─── Schools ───────────────────────────────────────
  app.get("/api/schools", authMiddleware, async (_req, res) => {
    return res.json(await storage.getSchools());
  });

  app.get("/api/schools/:id", authMiddleware, async (req, res) => {
    const id = Number(req.params.id);
    // A user may only read the full details of their own school. Schools own
    // record uses `id` as the ownership key (there is no `schoolId` column), so
    // we check it directly rather than via verifyOwnership.
    if (id !== req.user!.schoolId) {
      return res.status(403).json({ message: "You do not have access to this resource" });
    }
    const school = await storage.getSchool(id);
    if (!school) return res.status(404).json({ message: "School not found" });
    return res.json(school);
  });

  // ─── Compliance ────────────────────────────────────
  app.get("/api/compliance", authMiddleware, async (req, res) => {
    const items = await storage.getComplianceItems(req.user!.schoolId);
    const score = await storage.getComplianceScore(req.user!.schoolId);
    return res.json({ items, score });
  });

  app.put(
    "/api/compliance/:id",
    authMiddleware,
    requireRole("admin", "dpo"),
    validateBody(updateComplianceSchema),
    async (req, res) => {
      const id = Number(req.params.id);
      const owned = await verifyOwnership(
        req,
        res,
        () => storage.getComplianceItem(id),
        "Item not found",
      );
      if (!owned) return;

      const updated = await storage.updateComplianceItem(id, req.body);
      if (!updated) return res.status(404).json({ message: "Item not found" });

      await storage.createAuditEntry({
        schoolId: req.user!.schoolId,
        userId: req.user!.id,
        action: "compliance_update",
        entityType: "compliance",
        entityId: id,
        details: `Updated status to ${req.body.status ?? "modified"}`,
      });

      return res.json(updated);
    },
  );

  // ─── Compliance Evidence ───────────────────────────
  // List evidence files attached to a compliance item in the caller's school.
  app.get(
    "/api/compliance/:id/evidence",
    authMiddleware,
    async (req, res) => {
      const id = Number(req.params.id);
      const owned = await verifyOwnership(
        req,
        res,
        () => storage.getComplianceItem(id),
        "Item not found",
      );
      if (!owned) return;

      return res.json(await storage.getComplianceEvidence(id));
    },
  );

  // Upload an evidence file for a compliance item in the caller's school.
  // Ownership is checked BEFORE the file is persisted so a cross-school upload
  // never writes a file to disk. multer runs first to parse the multipart body;
  // its size/type limits are enforced in server/uploads.ts, and any error is
  // mapped to a 400.
  app.post(
    "/api/compliance/:id/evidence",
    authMiddleware,
    requireRole("admin", "dpo"),
    (req, res, next) => {
      evidenceUpload.single("file")(req, res, (err: any) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              message: `File exceeds the maximum size of ${UPLOAD_MAX_BYTES} bytes`,
            });
          }
          return res.status(400).json({ message: "File upload failed" });
        }
        next();
      });
    },
    async (req, res) => {
      const id = Number(req.params.id);
      const file = req.file;

      // Remove any uploaded temp file if ownership/validation fails below.
      const cleanup = () => {
        if (file?.path) {
          fs.rm(file.path, { force: true }, () => undefined);
        }
      };

      const owned = await verifyOwnership(
        req,
        res,
        () => storage.getComplianceItem(id),
        "Item not found",
      );
      if (!owned) {
        cleanup();
        return;
      }

      if (!file) {
        return res.status(400).json({
          message: `A file is required (allowed types: ${ALLOWED_MIME_TYPES.join(", ")})`,
        });
      }

      const evidence = await storage.createComplianceEvidence({
        complianceItemId: id,
        schoolId: req.user!.schoolId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: req.user!.id,
      });

      await storage.createAuditEntry({
        schoolId: req.user!.schoolId,
        userId: req.user!.id,
        action: "evidence_uploaded",
        entityType: "compliance",
        entityId: id,
        details: `Uploaded evidence ${file.originalname}`,
      });

      return res.status(201).json(evidence);
    },
  );

  // ─── Reports Export ────────────────────────────────
  // Export the caller's school compliance status + score and incident summary
  // as CSV or PDF. Always scoped to req.user.schoolId; format defaults to csv.
  app.get("/api/reports/export", authMiddleware, async (req, res) => {
    const format = String(req.query.format || "csv").toLowerCase();
    if (format !== "csv" && format !== "pdf") {
      return res.status(400).json({ message: "format must be csv or pdf" });
    }

    const schoolId = req.user!.schoolId;
    const school = await storage.getSchool(schoolId);
    const items = await storage.getComplianceItems(schoolId);
    const complianceScore = await storage.getComplianceScore(schoolId);
    const incidents = await storage.getIncidents(schoolId);

    const data = {
      schoolName: school?.name ?? `School ${schoolId}`,
      complianceScore,
      compliance: items.map((i: any) => ({
        title: i.title,
        status: i.status,
        weight: i.weight ?? 5,
      })),
      incidents: incidents.map((i: any) => ({
        type: i.type,
        severity: i.severity,
        status: i.status,
      })),
    };

    await storage.createAuditEntry({
      schoolId,
      userId: req.user!.id,
      action: "report_exported",
      entityType: "report",
      entityId: schoolId,
      details: `Exported ${format.toUpperCase()} compliance report`,
    });

    if (format === "csv") {
      const csv = buildComplianceCsv(data);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="harmonyshield-report.csv"',
      );
      return res.status(200).send(csv);
    }

    const pdf = await buildCompliancePdf(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="harmonyshield-report.pdf"',
    );
    return res.status(200).send(pdf);
  });

  // ─── Threats ───────────────────────────────────────
  app.get("/api/threats", authMiddleware, async (_req, res) => {
    try {
      const seedThreats = await storage.getThreats();
      let liveThreats: any[] = [];
      try {
        const otx = await fetchOTXThreats();
        liveThreats = otx.map(t => ({ ...t, isLive: true }));
      } catch {
        // Live feeds may fail, that's ok
      }
      const seedWithFlag = seedThreats.map(t => ({ ...t, isLive: false }));
      return res.json([...liveThreats, ...seedWithFlag]);
    } catch (err) {
      const fallback = await storage.getThreats();
      return res.json(fallback.map(t => ({ ...t, isLive: false })));
    }
  });

  app.get("/api/threats/stats", authMiddleware, async (_req, res) => {
    return res.json(await storage.getThreatStats());
  });

  app.get("/api/ip-check/:ip", authMiddleware, async (req, res) => {
    const result = await checkIPReputation(String(req.params.ip));
    if (!result.available) {
      // 503: the live reputation source is not configured/available. Never
      // return fabricated numbers.
      return res.status(503).json(result);
    }
    return res.json(result);
  });

  // ─── Incidents ─────────────────────────────────────
  app.get("/api/incidents", authMiddleware, async (req, res) => {
    return res.json(await storage.getIncidents(req.user!.schoolId));
  });

  app.get("/api/incidents/:id", authMiddleware, async (req, res) => {
    const id = Number(req.params.id);
    const incident = await verifyOwnership(
      req,
      res,
      () => storage.getIncident(id),
      "Incident not found",
    );
    if (!incident) return;

    const actions = await storage.getIncidentActions(incident.id);
    return res.json({ ...incident, actions });
  });

  app.post(
    "/api/incidents",
    authMiddleware,
    requireRole("admin", "dpo", "staff", "teacher"),
    validateBody(createIncidentSchema),
    async (req, res) => {
      const incident = await storage.createIncident({
        ...req.body,
        schoolId: req.user!.schoolId, // server-injected ownership
      });

      await storage.createAuditEntry({
        schoolId: req.user!.schoolId,
        userId: req.user!.id,
        action: "incident_created",
        entityType: "incident",
        entityId: incident.id,
        details: `New ${incident.type} incident reported`,
      });

      return res.status(201).json(incident);
    },
  );

  app.put(
    "/api/incidents/:id",
    authMiddleware,
    requireRole("admin", "dpo", "staff", "teacher"),
    validateBody(updateIncidentSchema),
    async (req, res) => {
      const id = Number(req.params.id);
      const owned = await verifyOwnership(
        req,
        res,
        () => storage.getIncident(id),
        "Incident not found",
      );
      if (!owned) return;

      const updated = await storage.updateIncident(id, req.body);
      if (!updated) return res.status(404).json({ message: "Incident not found" });

      await storage.createAuditEntry({
        schoolId: req.user!.schoolId,
        userId: req.user!.id,
        action: "incident_updated",
        entityType: "incident",
        entityId: id,
        details: `Updated incident status to ${req.body.status || "modified"}`,
      });

      return res.json(updated);
    },
  );

  // ─── Incident Actions ──────────────────────────────
  app.post(
    "/api/incidents/:id/actions",
    authMiddleware,
    requireRole("admin", "dpo", "staff", "teacher"),
    validateBody(createIncidentActionSchema),
    async (req, res) => {
      const incidentId = Number(req.params.id);
      // Ownership flows through the parent incident's schoolId.
      const incident = await verifyOwnership(
        req,
        res,
        () => storage.getIncident(incidentId),
        "Incident not found",
      );
      if (!incident) return;

      const action = await storage.createIncidentAction({
        ...req.body,
        incidentId,
      });
      return res.status(201).json(action);
    },
  );

  app.put(
    "/api/incident-actions/:id",
    authMiddleware,
    requireRole("admin", "dpo", "staff", "teacher"),
    validateBody(updateIncidentActionSchema),
    async (req, res) => {
      const id = Number(req.params.id);
      // Resolve the action, then its parent incident, to check ownership.
      const action = await storage.getIncidentAction(id);
      if (!action) return res.status(404).json({ message: "Action not found" });

      const incident = await verifyOwnership(
        req,
        res,
        () => storage.getIncident(action.incidentId),
        "Action not found",
      );
      if (!incident) return;

      const updated = await storage.updateIncidentAction(id, req.body);
      if (!updated) return res.status(404).json({ message: "Action not found" });
      return res.json(updated);
    },
  );

  // ─── Training ──────────────────────────────────────
  app.get("/api/training/courses", authMiddleware, async (_req, res) => {
    return res.json(await storage.getCourses());
  });

  app.get("/api/training/courses/:id", authMiddleware, async (req, res) => {
    const course = await storage.getCourse(Number(req.params.id));
    if (!course) return res.status(404).json({ message: "Course not found" });
    return res.json(course);
  });

  app.get("/api/training/progress", authMiddleware, async (req, res) => {
    return res.json(await storage.getTrainingProgress(req.user!.id));
  });

  app.post(
    "/api/training/progress",
    authMiddleware,
    validateBody(trainingProgressSchema),
    async (req, res) => {
    const progress = await storage.upsertTrainingProgress({
      userId: req.user!.id,
      courseId: req.body.courseId,
      status: req.body.status,
      score: req.body.score,
    });

    if (req.body.status === "completed") {
      await storage.createAuditEntry({
        schoolId: req.user!.schoolId,
        userId: req.user!.id,
        action: "training_completed",
        entityType: "training",
        entityId: req.body.courseId,
        details: `Completed course with score ${req.body.score}%`,
      });
    }

    return res.json(progress);
    },
  );

  // ─── News ──────────────────────────────────────────
  app.get("/api/news", authMiddleware, async (_req, res) => {
    try {
      const seedNews = await storage.getNewsArticles();
      let liveNews: any[] = [];
      try {
        liveNews = await fetchLiveNews();
      } catch {
        // Live feeds may fail
      }
      const seedWithFlag = seedNews.map(n => ({ ...n, isLive: false }));
      return res.json([...liveNews.slice(0, 10), ...seedWithFlag]);
    } catch {
      const fallback = await storage.getNewsArticles();
      return res.json(fallback.map(n => ({ ...n, isLive: false })));
    }
  });

  // ─── Users ─────────────────────────────────────────
  app.get("/api/users", authMiddleware, async (req, res) => {
    return res.json(await storage.getUsers(req.user!.schoolId));
  });

  // ─── Audit ─────────────────────────────────────────
  app.get("/api/audit", authMiddleware, async (req, res) => {
    return res.json(await storage.getAuditLog(req.user!.schoolId));
  });

  // ─── Feed Status ───────────────────────────────────
  app.get("/api/feeds/status", authMiddleware, (_req, res) => {
    return res.json(getFeedStatus());
  });

  // ─── Settings ──────────────────────────────────────
  app.get("/api/settings", authMiddleware, async (req, res) => {
    const school = await storage.getSchool(req.user!.schoolId);
    if (!school) return res.status(404).json({ message: "School not found" });
    return res.json(school);
  });

  app.put(
    "/api/settings",
    authMiddleware,
    requireRole("admin", "dpo"),
    validateBody(updateSettingsSchema),
    async (req, res) => {
      const updated = await storage.updateSchool(req.user!.schoolId, req.body);
      if (!updated) return res.status(404).json({ message: "School not found" });

      await storage.createAuditEntry({
        schoolId: req.user!.schoolId,
        userId: req.user!.id,
        action: "settings_update",
        entityType: "school",
        entityId: req.user!.schoolId,
        details: "Updated school settings",
      });

      return res.json(updated);
    },
  );

  return httpServer;
}
