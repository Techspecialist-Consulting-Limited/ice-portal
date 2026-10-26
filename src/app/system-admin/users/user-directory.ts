import {
  INCIDENT_RESPONDER,
  MANAGEMENT_USER,
  RISK_ADMINISTRATOR,
  SYSTEM_ADMINISTRATOR,
  type UserRole,
} from "../../auth/current-user";

export const STAFF_ROLE = "Staff" as const;

export type PortalAccountStatus = "Active" | "Suspended";
export type PortalDirectoryRole = string;

export type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

export type EmergencyContacts = {
  primary: EmergencyContact | null;
  secondary: EmergencyContact | null;
  tertiary: EmergencyContact | null;
};

export type PortalAccount = {
  id: string;
  name: string;
  email: string;
  department: string;
  dateOfBirth: string | null;
  bloodGroup: string | null;
  genotype: string | null;
  emergencyContacts: EmergencyContacts;
  role: PortalDirectoryRole;
  status: PortalAccountStatus;
};

export const PORTAL_ROLES: UserRole[] = [
  RISK_ADMINISTRATOR,
  INCIDENT_RESPONDER,
  MANAGEMENT_USER,
  SYSTEM_ADMINISTRATOR,
];

export const DIRECTORY_ROLES: PortalDirectoryRole[] = [...PORTAL_ROLES, STAFF_ROLE];

const noEmergencyContacts: EmergencyContacts = {
  primary: null,
  secondary: null,
  tertiary: null,
};

export const INITIAL_PORTAL_ACCOUNTS: PortalAccount[] = [
  { id: "USR-0001", name: "Mike Kanu", email: "mike.kanu@nsia.com", department: "Risk & Compliance", dateOfBirth: "1984-06-12", bloodGroup: "O+", genotype: "AA", emergencyContacts: { primary: { name: "Ada Kanu", relationship: "Spouse", phone: "+234 803 555 0101" }, secondary: { name: "Chika Kanu", relationship: "Sibling", phone: "+234 803 555 0102" }, tertiary: null }, role: RISK_ADMINISTRATOR, status: "Active" },
  { id: "USR-0002", name: "Amaka Nwosu", email: "amaka.nwosu@nsia.com", department: "Risk & Compliance", dateOfBirth: "1990-03-24", bloodGroup: "A+", genotype: "AS", emergencyContacts: { primary: { name: "Ngozi Nwosu", relationship: "Parent", phone: "+234 803 555 0103" }, secondary: null, tertiary: null }, role: RISK_ADMINISTRATOR, status: "Active" },
  { id: "USR-0003", name: "Chinedu Obi", email: "chinedu.obi@nsia.com", department: "Risk & Compliance", dateOfBirth: "1987-11-05", bloodGroup: "B+", genotype: "AA", emergencyContacts: noEmergencyContacts, role: RISK_ADMINISTRATOR, status: "Active" },
  { id: "USR-0004", name: "Fatima Bello", email: "fatima.bello@nsia.com", department: "Risk & Compliance", dateOfBirth: "1992-08-17", bloodGroup: "O-", genotype: "AS", emergencyContacts: { primary: { name: "Aisha Bello", relationship: "Parent", phone: "+234 803 555 0104" }, secondary: { name: "Musa Bello", relationship: "Sibling", phone: "+234 803 555 0105" }, tertiary: { name: "Zainab Bello", relationship: "Relative", phone: "+234 803 555 0106" } }, role: RISK_ADMINISTRATOR, status: "Active" },
  { id: "USR-0005", name: "Tunde Adebayo", email: "tunde.adebayo@nsia.com", department: "Risk & Compliance", dateOfBirth: "1982-02-09", bloodGroup: "Not yet set", genotype: "Not yet set", emergencyContacts: noEmergencyContacts, role: RISK_ADMINISTRATOR, status: "Suspended" },
  { id: "USR-0006", name: "Abbas Taofeeq", email: "abbas.taofeeq@nsia.com", department: "Operations", dateOfBirth: "1988-01-30", bloodGroup: "AB+", genotype: "AA", emergencyContacts: { primary: { name: "Bilkisu Taofeeq", relationship: "Spouse", phone: "+234 803 555 0107" }, secondary: null, tertiary: null }, role: INCIDENT_RESPONDER, status: "Active" },
  { id: "USR-0007", name: "Ifeoma Eze", email: "ifeoma.eze@nsia.com", department: "Operations", dateOfBirth: "1991-07-14", bloodGroup: "A-", genotype: "AS", emergencyContacts: noEmergencyContacts, role: INCIDENT_RESPONDER, status: "Active" },
  { id: "USR-0008", name: "Bashir Musa", email: "bashir.musa@nsia.com", department: "Operations", dateOfBirth: "1986-09-21", bloodGroup: "O+", genotype: "AA", emergencyContacts: { primary: { name: "Hauwa Musa", relationship: "Parent", phone: "+234 803 555 0108" }, secondary: null, tertiary: null }, role: INCIDENT_RESPONDER, status: "Active" },
  { id: "USR-0009", name: "Ngozi Okafor", email: "ngozi.okafor@nsia.com", department: "Operations", dateOfBirth: "1993-04-02", bloodGroup: "Not yet set", genotype: "Not yet set", emergencyContacts: noEmergencyContacts, role: INCIDENT_RESPONDER, status: "Active" },
  { id: "USR-0010", name: "Ibrahim Sani", email: "ibrahim.sani@nsia.com", department: "Operations", dateOfBirth: "1985-12-11", bloodGroup: "B-", genotype: "AS", emergencyContacts: { primary: { name: "Sani Ibrahim", relationship: "Parent", phone: "+234 803 555 0109" }, secondary: { name: "Amina Sani", relationship: "Sibling", phone: "+234 803 555 0110" }, tertiary: null }, role: INCIDENT_RESPONDER, status: "Active" },
  { id: "USR-0011", name: "Kelechi Nnamdi", email: "kelechi.nnamdi@nsia.com", department: "Operations", dateOfBirth: "1990-10-27", bloodGroup: "O+", genotype: "Not yet set", emergencyContacts: noEmergencyContacts, role: INCIDENT_RESPONDER, status: "Suspended" },
  { id: "USR-0012", name: "Suleman Olalomi", email: "suleman.olalomi@nsia.com", department: "Executive Management", dateOfBirth: "1979-05-18", bloodGroup: "A+", genotype: "AA", emergencyContacts: { primary: { name: "Kemi Olalomi", relationship: "Spouse", phone: "+234 803 555 0111" }, secondary: null, tertiary: null }, role: MANAGEMENT_USER, status: "Active" },
  { id: "USR-0013", name: "Amina Yusuf", email: "amina.yusuf@nsia.com", department: "Executive Management", dateOfBirth: "1983-02-03", bloodGroup: "B+", genotype: "AS", emergencyContacts: noEmergencyContacts, role: MANAGEMENT_USER, status: "Active" },
  { id: "USR-0014", name: "Emeka Udo", email: "emeka.udo@nsia.com", department: "Executive Management", dateOfBirth: "1976-12-29", bloodGroup: "O-", genotype: "AA", emergencyContacts: { primary: { name: "Chinyere Udo", relationship: "Spouse", phone: "+234 803 555 0112" }, secondary: { name: "Obinna Udo", relationship: "Sibling", phone: "+234 803 555 0113" }, tertiary: null }, role: MANAGEMENT_USER, status: "Active" },
  { id: "USR-0015", name: "Zainab Lawal", email: "zainab.lawal@nsia.com", department: "Executive Management", dateOfBirth: "1988-06-22", bloodGroup: "Not yet set", genotype: "AS", emergencyContacts: noEmergencyContacts, role: MANAGEMENT_USER, status: "Active" },
  { id: "USR-0016", name: "Samuel Okada", email: "samuel.okada@nsia.com", department: "ICT Administration", dateOfBirth: "1985-03-07", bloodGroup: "A+", genotype: "AA", emergencyContacts: { primary: { name: "Nneka Okada", relationship: "Spouse", phone: "+234 803 555 0114" }, secondary: null, tertiary: null }, role: SYSTEM_ADMINISTRATOR, status: "Active" },
  { id: "USR-0017", name: "Grace Ofori", email: "grace.ofori@nsia.com", department: "ICT Administration", dateOfBirth: "1991-09-16", bloodGroup: "O+", genotype: "Not yet set", emergencyContacts: noEmergencyContacts, role: SYSTEM_ADMINISTRATOR, status: "Active" },
  { id: "USR-0018", name: "David Danjuma", email: "david.danjuma@nsia.com", department: "ICT Administration", dateOfBirth: "1987-04-25", bloodGroup: "AB-", genotype: "AS", emergencyContacts: { primary: { name: "Mary Danjuma", relationship: "Parent", phone: "+234 803 555 0115" }, secondary: { name: "Joseph Danjuma", relationship: "Sibling", phone: "+234 803 555 0116" }, tertiary: null }, role: SYSTEM_ADMINISTRATOR, status: "Active" },
  { id: "STF-0001", name: "Mariam Ibrahim", email: "mariam.ibrahim@nsia.com", department: "Abuja Operations", dateOfBirth: "1994-02-14", bloodGroup: "O+", genotype: "AA", emergencyContacts: { primary: { name: "Hassan Ibrahim", relationship: "Spouse", phone: "+234 803 555 0201" }, secondary: null, tertiary: null }, role: STAFF_ROLE, status: "Active" },
  { id: "STF-0002", name: "Samuel Ekanem", email: "samuel.ekanem@nsia.com", department: "Abuja Operations", dateOfBirth: "1990-07-08", bloodGroup: "A+", genotype: "AS", emergencyContacts: { primary: { name: "Grace Ekanem", relationship: "Parent", phone: "+234 803 555 0202" }, secondary: null, tertiary: null }, role: STAFF_ROLE, status: "Active" },
  { id: "STF-0003", name: "Binta Abdullahi", email: "binta.abdullahi@nsia.com", department: "Lagos Operations", dateOfBirth: "1996-11-19", bloodGroup: "B+", genotype: "AA", emergencyContacts: noEmergencyContacts, role: STAFF_ROLE, status: "Active" },
  { id: "STF-0004", name: "Chukwuemeka Nwafor", email: "chukwuemeka.nwafor@nsia.com", department: "Port Harcourt Operations", dateOfBirth: "1989-05-03", bloodGroup: "O-", genotype: "AS", emergencyContacts: { primary: { name: "Ada Nwafor", relationship: "Spouse", phone: "+234 803 555 0203" }, secondary: { name: "Ikenna Nwafor", relationship: "Sibling", phone: "+234 803 555 0204" }, tertiary: null }, role: STAFF_ROLE, status: "Active" },
  { id: "STF-0005", name: "Hadiza Sulaiman", email: "hadiza.sulaiman@nsia.com", department: "Kano Operations", dateOfBirth: "1993-09-26", bloodGroup: "Not yet set", genotype: "Not yet set", emergencyContacts: noEmergencyContacts, role: STAFF_ROLE, status: "Active" },
  { id: "STF-0006", name: "Peter Ofori", email: "peter.ofori@nsia.com", department: "Abuja Operations", dateOfBirth: "1986-12-01", bloodGroup: "AB+", genotype: "AA", emergencyContacts: { primary: { name: "Mary Ofori", relationship: "Spouse", phone: "+234 803 555 0205" }, secondary: null, tertiary: null }, role: STAFF_ROLE, status: "Active" },
];
