/**
 * What a user does — asked once, at sign-up.
 *
 * Single source of truth for the sign-up form, the database enum, and anything
 * that displays a role, so the three cannot drift apart.
 *
 * Values are stable identifiers and safe to store; labels are what people see
 * and can be reworded freely. Never rename a value without a data migration.
 */
export const USER_ROLE_VALUES = [
  "designer",
  "developer",
  "product-manager",
  "marketer",
  "student",
  "other",
] as const;

export type UserRole = (typeof USER_ROLE_VALUES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  designer: "Designer",
  developer: "Developer",
  "product-manager": "Product Manager",
  marketer: "Marketer",
  student: "Student",
  other: "Other",
};

/** Ordered for display — matches the order above. */
export const USER_ROLE_OPTIONS = USER_ROLE_VALUES.map((value) => ({
  value,
  label: USER_ROLE_LABELS[value],
}));

export function roleLabel(role: string | null | undefined): string | null {
  if (!role) return null;
  return USER_ROLE_LABELS[role as UserRole] ?? role;
}
