export const ROLE_LEVELS = {
  viewer: 1,
  worker: 2,
  manager: 3,
  ceo: 4,
} as const

export type RoleLevel = (typeof ROLE_LEVELS)[keyof typeof ROLE_LEVELS]

export const isRoleAtLeast = (level: number | undefined, target: RoleLevel) => {
  if (!level) return false
  return level >= target
}

export const getRoleLabel = (level: number | undefined) => {
  if (!level) return 'תפקיד לא ידוע'
  if (level >= ROLE_LEVELS.ceo) return 'מנכ"ל החברה'
  if (level >= ROLE_LEVELS.manager) return 'מנהל מרפאה'
  if (level >= ROLE_LEVELS.worker) return 'עובד מרפאה'
  return 'צופה מרפאה'
}

export const getRoleBadgeVariant = (level: number | undefined): 'default' | 'secondary' | 'outline' => {
  if (!level) return 'outline'
  if (level >= ROLE_LEVELS.ceo) return 'default'
  if (level >= ROLE_LEVELS.manager) return 'secondary'
  return 'outline'
}

