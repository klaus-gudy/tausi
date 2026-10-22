// The permission keys grouped by the part of the app they open up, for the
// roles page. The keys themselves are seeded by migrations; a key that isn't
// listed here still shows, under "Other", so a new one is never hidden.
//
// A module's `read` key is what its page needs to open at all, so a role
// given anything else in the module is given `read` too.

export type PermissionModule = {
  key: string
  label: string
  description: string
  read?: string
  permissions: { key: string; label: string }[]
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: "products",
    label: "Products",
    description: "The catalogue of what the organization stocks.",
    read: "products.read",
    permissions: [
      { key: "products.read", label: "View products and stock on hand" },
      { key: "products.manage", label: "Add, edit and archive products" },
    ],
  },
  {
    key: "warehouses",
    label: "Warehouses",
    description: "The stores and depots where stock is kept.",
    read: "warehouses.read",
    permissions: [
      { key: "warehouses.read", label: "View warehouses" },
      { key: "warehouses.manage", label: "Add, edit and deactivate warehouses" },
    ],
  },
  {
    key: "dealers",
    label: "Super dealers",
    description: "The shops and distributors stock is issued to.",
    read: "dealers.read",
    permissions: [
      { key: "dealers.read", label: "View super dealers" },
      { key: "dealers.manage", label: "Add, edit and deactivate super dealers" },
      { key: "dealers.onboard", label: "Sign up new super dealers in person, with their signature" },
    ],
  },
  {
    key: "salespeople",
    label: "Salespeople",
    description: "The field staff stock is sent to.",
    read: "salespeople.read",
    permissions: [
      { key: "salespeople.read", label: "View salespeople" },
      { key: "salespeople.manage", label: "Add, edit and deactivate salespeople" },
    ],
  },
  {
    key: "stock",
    label: "Stock",
    description: "Stock coming in, going out and corrections.",
    read: "stock.read",
    permissions: [
      { key: "stock.read", label: "View stock movements" },
      { key: "stock.receive", label: "Record stock received from suppliers" },
      { key: "stock.issue", label: "Record stock issued to super dealers" },
      { key: "stock.transfer", label: "Send stock to salespeople and update it until it arrives" },
      { key: "stock.adjust", label: "Correct stock after a count and reverse movements" },
    ],
  },
  {
    key: "deliveries",
    label: "Deliveries",
    description: "Stock salespeople supply to super dealers.",
    permissions: [
      { key: "deliveries.read", label: "View every salesperson's deliveries" },
      { key: "deliveries.record", label: "Acknowledge stock sent to you and supply it to super dealers" },
    ],
  },
  {
    key: "members",
    label: "Members & roles",
    description: "Who is in the organization and what they can do.",
    read: "members.read",
    permissions: [
      { key: "members.read", label: "View members" },
      { key: "members.invite", label: "Invite people and revoke invitations" },
      { key: "members.update", label: "Change members' roles" },
      { key: "members.remove", label: "Remove members" },
      { key: "roles.manage", label: "Create and edit custom roles" },
    ],
  },
  {
    key: "organization",
    label: "Organization",
    description: "The organization itself.",
    permissions: [
      { key: "org.update", label: "Edit the organization's name and settings" },
      { key: "billing.manage", label: "Manage the plan and billing" },
      { key: "org.delete", label: "Delete the organization" },
    ],
  },
]

/**
 * The modules with the permissions that exist in the database, in catalogue
 * order, plus an "Other" module for keys the catalogue doesn't know.
 */
export function groupPermissions(existing: { key: string; description: string | null }[]) {
  const keys = new Set(existing.map((permission) => permission.key))
  const listed = new Set(PERMISSION_MODULES.flatMap((group) => group.permissions.map((p) => p.key)))
  const modules = PERMISSION_MODULES.map((group) => ({
    ...group,
    permissions: group.permissions.filter((permission) => keys.has(permission.key)),
  }))
  const other = existing
    .filter((permission) => !listed.has(permission.key))
    .map((permission) => ({ key: permission.key, label: permission.description ?? permission.key }))
  if (other.length) {
    modules.push({ key: "other", label: "Other", description: "Everything else.", permissions: other })
  }
  return modules.filter((group) => group.permissions.length)
}

/** `keys` plus the read key of every module they touch. */
export function withReadKeys(keys: Iterable<string>) {
  const result = new Set(keys)
  for (const group of PERMISSION_MODULES) {
    if (group.read && group.permissions.some((permission) => result.has(permission.key))) {
      result.add(group.read)
    }
  }
  return result
}
