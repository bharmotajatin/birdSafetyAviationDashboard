import { loadEnvConfig } from "@next/env";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Department } from "../src/lib/db/models/Department";
import { Settings } from "../src/lib/db/models/Settings";
import { Station } from "../src/lib/db/models/Station";
import { type UserRole, User } from "../src/lib/db/models/User";

loadEnvConfig(process.cwd());

type StationSeed = {
  code: string;
  name: string;
  fullName: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

const STATIONS: StationSeed[] = [
  { code: "CJB", name: "CJB", fullName: "Coimbatore", latitude: 11.03, longitude: 77.04, timezone: "Asia/Kolkata" },
  { code: "COK", name: "COK", fullName: "Kochi", latitude: 10.15, longitude: 76.4, timezone: "Asia/Kolkata" },
  { code: "DEL", name: "DEL", fullName: "Delhi", latitude: 28.56, longitude: 77.1, timezone: "Asia/Kolkata" },
  { code: "GOI", name: "GOI", fullName: "Goa", latitude: 15.38, longitude: 73.84, timezone: "Asia/Kolkata" },
  { code: "HYD", name: "HYD", fullName: "Hyderabad", latitude: 17.24, longitude: 78.43, timezone: "Asia/Kolkata" },
  { code: "IMF", name: "IMF", fullName: "Imphal", latitude: 24.76, longitude: 93.9, timezone: "Asia/Kolkata" },
  { code: "IXA", name: "IXA", fullName: "Agartala", latitude: 23.89, longitude: 91.24, timezone: "Asia/Kolkata" },
  { code: "IXC", name: "IXC", fullName: "Chandigarh", latitude: 30.67, longitude: 76.79, timezone: "Asia/Kolkata" },
  { code: "MAA", name: "MAA", fullName: "Chennai", latitude: 12.99, longitude: 80.17, timezone: "Asia/Kolkata" },
  { code: "TRV", name: "TRV", fullName: "Thiruvananthapuram", latitude: 8.48, longitude: 76.92, timezone: "Asia/Kolkata" },
  { code: "TRZ", name: "TRZ", fullName: "Tiruchirappalli", latitude: 10.77, longitude: 78.71, timezone: "Asia/Kolkata" },
];

const DEPARTMENTS = [
  { code: "RAMP", name: "Ramp Operations", description: "Aircraft handling, loading and turnaround activities." },
  { code: "GSD", name: "Ground Services", description: "Ground operations service desk and operational support." },
  { code: "CARGO", name: "Cargo Operations", description: "Cargo handling, ULD movement and hold operations." },
  { code: "PAX", name: "Passenger Services", description: "Passenger-facing and boarding support operations." },
  { code: "ULD", name: "ULD Management", description: "ULD inspection, allocation, repair and tracking." },
  {
    code: "GSE_MAINT",
    name: "GSE Maintenance",
    description: "Ground support equipment reliability and maintenance team.",
  },
];

const DEFAULT_PASSWORD = "Admin@123";

async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is missing in environment. Update .env.local before running seed.");
  }
  await mongoose.connect(uri, { bufferCommands: false });
}

async function upsertStations() {
  for (const station of STATIONS) {
    await Station.updateOne(
      { code: station.code },
      {
        $set: {
          name: station.name,
          fullName: station.fullName,
          latitude: station.latitude,
          longitude: station.longitude,
          timezone: station.timezone,
          isActive: true,
        },
      },
      { upsert: true },
    );
  }
}

async function upsertDepartments() {
  for (const department of DEPARTMENTS) {
    await Department.updateOne(
      { code: department.code },
      {
        $set: {
          name: department.name,
          description: department.description,
          isActive: true,
        },
      },
      { upsert: true },
    );
  }
}

async function upsertSettings() {
  await Settings.updateOne(
    { key: "sla.hoursByCategory" },
    {
      $set: {
        value: {
          "CAT-A": 24,
          "CAT-B": 72,
          "CAT-C": 168,
          "CAT-D": 336,
        },
        description: "Default SLA response/closure windows in hours by category.",
      },
    },
    { upsert: true },
  );
}

async function upsertUser(params: {
  email: string;
  name: string;
  role: UserRole;
  stationId?: mongoose.Types.ObjectId | null;
  departmentId?: mongoose.Types.ObjectId | null;
  employeeId: string;
  phone?: string;
}) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  await User.updateOne(
    { email: params.email.toLowerCase() },
    {
      $set: {
        name: params.name,
        role: params.role,
        station: params.stationId ?? null,
        department: params.departmentId ?? null,
        employeeId: params.employeeId,
        phone: params.phone ?? "",
        passwordHash,
        isActive: true,
      },
    },
    { upsert: true },
  );
}

async function seedUsers() {
  const rampDepartment = await Department.findOne({ code: "RAMP" }).lean();
  const delStation = await Station.findOne({ code: "DEL" }).lean();
  const defaultDeptId = rampDepartment?._id ?? null;
  const defaultStationId = delStation?._id ?? null;

  await upsertUser({
    email: "admin@bfs.com",
    name: "BFS Admin",
    role: "admin",
    stationId: defaultStationId,
    departmentId: defaultDeptId,
    employeeId: "BFS-ADM-001",
  });

  for (const station of STATIONS) {
    const stationDoc = await Station.findOne({ code: station.code });
    if (!stationDoc) continue;
    const email = `safety.head.${station.code.toLowerCase()}@bfs.com`;
    const employeeId = `BFS-SH-${station.code}`;

    await upsertUser({
      email,
      name: `Safety Head ${station.code}`,
      role: "safety_head",
      stationId: stationDoc._id,
      departmentId: defaultDeptId,
      employeeId,
    });

    const safetyHead = await User.findOne({ email }).lean();
    await Station.updateOne({ _id: stationDoc._id }, { $set: { safetyHeadUserId: safetyHead?._id ?? null } });
  }

  const testRoleUsers: Array<{ role: UserRole; email: string; name: string; employeeId: string }> = [
    { role: "admin", email: "test.admin@bfs.com", name: "Test Admin", employeeId: "BFS-TST-ADM" },
    { role: "safety_head", email: "test.safetyhead@bfs.com", name: "Test Safety Head", employeeId: "BFS-TST-SH" },
    { role: "investigator", email: "test.investigator@bfs.com", name: "Test Investigator", employeeId: "BFS-TST-INV" },
    { role: "duty_manager", email: "test.dutymanager@bfs.com", name: "Test Duty Manager", employeeId: "BFS-TST-DM" },
    { role: "viewer", email: "test.viewer@bfs.com", name: "Test Viewer", employeeId: "BFS-TST-VWR" },
  ];

  for (const user of testRoleUsers) {
    await upsertUser({
      ...user,
      stationId: defaultStationId,
      departmentId: defaultDeptId,
    });
  }
}

async function printCounts() {
  const [stations, departments, settings, users] = await Promise.all([
    Station.countDocuments(),
    Department.countDocuments(),
    Settings.countDocuments(),
    User.countDocuments(),
  ]);

  console.log("Seed complete.");
  console.log(`Stations: ${stations}`);
  console.log(`Departments: ${departments}`);
  console.log(`Settings: ${settings}`);
  console.log(`Users: ${users}`);
  console.log("Default login: admin@bfs.com / Admin@123");
}

async function main() {
  await connectDb();
  await upsertStations();
  await upsertDepartments();
  await upsertSettings();
  await seedUsers();
  await printCounts();
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
