/**
 * HavonaShield admin CLI — runs from your machine / CI against DATABASE_URL.
 *
 *   npm run db:migrate                         Apply migrations
 *   npm run db:seed                            Upsert training courses (safe to re-run)
 *   npm run db:seed-demo                       (Re)create the read-only demo school
 *   npm run school:create -- --name "School" --admin-email a@b.ng --admin-name "Jane Doe" [--state Lagos]
 *        Creates a school with the NDPR compliance checklist and its first admin.
 *        Prints a one-time temporary password (the admin should change it on first login).
 */
import { parseArgs } from "node:util";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../shared/schema";
import { complianceTemplate, courses, sampleNews, sampleThreats } from "../shared/seed-content";
import { hashPassword, randomSecret } from "../shared/password";

const {
  schools, users, complianceItems, threats, incidents, incidentActions, trainingCourses, newsArticles, auditLog,
} = schema;

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://havona:havona@localhost:5432/havonashield";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const db = drizzle(client, { schema });
  const now = new Date().toISOString();

  try {
    switch (command) {
      case "migrate": {
        await migrate(db, { migrationsFolder: "./migrations" });
        console.log("✓ Migrations applied");
        break;
      }

      case "seed-courses": {
        for (const c of courses) {
          const values = { ...c, slug: slugify(c.title) };
          await db
            .insert(trainingCourses)
            .values(values)
            .onConflictDoUpdate({
              target: trainingCourses.slug,
              set: {
                title: values.title, description: values.description, durationMin: values.durationMin,
                icon: values.icon, contentMd: values.contentMd, quizJson: values.quizJson, passMark: values.passMark,
              },
            });
        }
        console.log(`✓ ${courses.length} training courses upserted`);
        break;
      }

      case "create-school": {
        const { values: a } = parseArgs({
          args: rest,
          options: {
            name: { type: "string" },
            "admin-email": { type: "string" },
            "admin-name": { type: "string" },
            state: { type: "string" },
            lga: { type: "string" },
            type: { type: "string", default: "secondary" },
          },
        });
        if (!a.name || !a["admin-email"] || !a["admin-name"]) {
          throw new Error('Usage: npm run school:create -- --name "School" --admin-email you@school.ng --admin-name "Full Name"');
        }
        const email = a["admin-email"].trim().toLowerCase();
        const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
        if (exists) throw new Error(`User ${email} already exists`);

        const tempPassword = randomSecret(12);
        await db.transaction(async (tx) => {
          const [school] = await tx
            .insert(schools)
            .values({ name: a.name!, state: a.state, lga: a.lga, type: a.type!, createdAt: now })
            .returning();
          await tx.insert(complianceItems).values(
            complianceTemplate.map(({ category: _c, status: _s, ...item }) => ({
              ...item, schoolId: school.id, status: "not_started", updatedAt: now,
            })),
          );
          const [admin] = await tx
            .insert(users)
            .values({
              schoolId: school.id, email, name: a["admin-name"]!, role: "admin",
              password: await hashPassword(tempPassword), createdAt: now,
            })
            .returning();
          await tx.insert(auditLog).values({
            schoolId: school.id, userId: admin.id, action: "school_created", entityType: "school",
            entityId: school.id, details: "School onboarded", timestamp: now,
          });
          console.log(`✓ Created school #${school.id} "${school.name}"`);
        });
        console.log(`\n  Admin login:        ${email}`);
        console.log(`  Temporary password: ${tempPassword}`);
        console.log("  → Share this securely; ask them to change it under Settings → Security.\n");
        break;
      }

      case "seed-demo": {
        await db.transaction(async (tx) => {
          // Wipe previous demo school (cascades to users, compliance, incidents…)
          await tx.delete(schools).where(eq(schools.isDemo, true));
          await tx.delete(threats);
          await tx.delete(newsArticles);

          const [school] = await tx
            .insert(schools)
            .values({
              name: "Demo Secondary School", address: "Independence Layout, Enugu", state: "Enugu",
              lga: "Enugu North", type: "secondary", studentCount: 1200,
              ndpcRegNumber: "DEMO-0001", isDemo: true, createdAt: now,
            })
            .returning();

          // Demo users get random passwords nobody knows: they're only reachable via the demo button.
          const pw = await hashPassword(randomSecret());
          const demoUsers = [
            { name: "Demo Admin", email: "admin@demo.havonashield.tech", role: "admin", department: "ICT" },
            { name: "Demo DPO", email: "dpo@demo.havonashield.tech", role: "dpo", department: "Data Protection" },
            { name: "Demo Teacher", email: "teacher@demo.havonashield.tech", role: "teacher", department: "Sciences" },
          ];
          const [admin] = await tx
            .insert(users)
            .values(demoUsers.map((u) => ({ ...u, schoolId: school.id, password: pw, createdAt: now })))
            .returning();

          await tx.insert(complianceItems).values(
            complianceTemplate.map(({ category: _c, ...item }) => ({
              ...item, schoolId: school.id, dueDate: nextQuarterEnd(), updatedAt: now,
            })),
          );

          await tx.insert(threats).values(sampleThreats);
          await tx.insert(newsArticles).values(sampleNews);

          const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
          const [inc1, inc2] = await tx
            .insert(incidents)
            .values([
              {
                schoolId: school.id, reportedBy: "Demo Admin", type: "phishing", severity: "high",
                status: "investigating", step: 2, createdAt: daysAgo(2),
                description: "Multiple staff received emails impersonating the principal requesting urgent fund transfers. Two staff members clicked the links.",
                affectedSystems: "Email System, Staff Accounts", affectedCount: 12,
              },
              {
                schoolId: school.id, reportedBy: "Demo Teacher", type: "malware", severity: "medium",
                status: "contained", step: 3, createdAt: daysAgo(6),
                description: "Keylogger-like malware detected on three computer lab workstations.",
                affectedSystems: "Computer Lab Workstations", affectedCount: 3,
              },
              {
                schoolId: school.id, reportedBy: "Demo DPO", type: "unauthorized_access", severity: "low",
                status: "resolved", step: 5, createdAt: daysAgo(14), resolvedAt: daysAgo(13),
                description: "Unusual login attempt on the student records system from an external IP was blocked by the firewall.",
                affectedSystems: "Student Records System", affectedCount: 0,
              },
            ])
            .returning();
          await tx.insert(incidentActions).values([
            { incidentId: inc1.id, action: "Identified and quarantined phishing emails", performedBy: "Demo Admin", status: "completed", notes: "47 similar emails found via mail filters", createdAt: daysAgo(2) },
            { incidentId: inc1.id, action: "Reset passwords for affected accounts", performedBy: "Demo DPO", status: "in_progress", notes: "2 of 12 accounts reset so far", createdAt: daysAgo(1) },
            { incidentId: inc2.id, action: "Isolated affected workstations from network", performedBy: "Demo Teacher", status: "completed", notes: "All 3 machines quarantined", createdAt: daysAgo(6) },
          ]);
          await tx.insert(auditLog).values([
            { schoolId: school.id, userId: admin.id, action: "compliance_update", entityType: "compliance", details: 'Updated "NDPC Registration" to compliant', timestamp: daysAgo(3) },
            { schoolId: school.id, userId: admin.id, action: "incident_created", entityType: "incident", entityId: inc1.id, details: "New phishing incident reported", timestamp: daysAgo(2) },
            { schoolId: school.id, userId: admin.id, action: "settings_update", entityType: "school", entityId: school.id, details: "Updated school settings", timestamp: daysAgo(1) },
          ]);
          console.log(`✓ Demo school #${school.id} seeded`);
        });
        break;
      }

      default:
        console.log("Commands: migrate | seed-courses | seed-demo | create-school");
        process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

function nextQuarterEnd(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  return new Date(Date.UTC(d.getFullYear(), q * 3 + 3, 0)).toISOString().slice(0, 10);
}

main().catch((err) => {
  console.error("✗", err.message ?? err);
  process.exit(1);
});
